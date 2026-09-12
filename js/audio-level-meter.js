// =====================================================================
// audio-level-meter.js: リアルタイム・オーディオレベルメーター（VUメーター）専任モジュール
// =====================================================================

(function () {
  "use strict";

  // キャッシュ・バッファ（メモリ再確保防止）
  const voiceData = new Uint8Array(256);
  const bgmData = new Uint8Array(256);

  // 平滑化・減衰用ステート
  let voiceLevelSmoothed = 0;
  let voicePeakHold = 0;
  let voicePeakHoldTimer = 0;

  let bgmLevelSmoothed = 0;
  let bgmPeakHold = 0;
  let bgmPeakHoldTimer = 0;

  let animFrameId = null;
  let isMeterActive = true;

  // DOM要素キャッシュ
  let elVoiceBar = null;
  let elVoicePeak = null;
  let elVoiceVal = null;
  let elVoiceClip = null;

  let elBgmBar = null;
  let elBgmPeak = null;
  let elBgmVal = null;
  let elBgmClip = null;

  let elMasterBar = null;
  let elMasterVal = null;

  // 画面上HUD
  let elHudContainer = null;
  let elHudVoiceBar = null;
  let elHudBgmBar = null;
  let elHudVoicePeak = null;
  let elHudBgmPeak = null;

  /**
   * 時間領域データ（0〜255、無音=128）からRMS値（0.0〜1.0）とPeak値（0.0〜1.0）を計算
   */
  function calculateAudioLevels(analyser, dataArray) {
    if (!analyser) return { rms: 0, peak: 0, db: -60 };
    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;
    let peak = 0;
    const len = dataArray.length;

    for (let i = 0; i < len; i++) {
      // -1.0 〜 +1.0 に正規化
      const sample = (dataArray[i] - 128) / 128;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / len);
    // デシベル換算 (-60dB 〜 0dB)
    let db = -60;
    if (rms > 0.001) {
      db = 20 * Math.log10(rms);
      if (db > 0) db = 0;
    }

    return { rms, peak, db };
  }

  /**
   * RMS値をメーター表示用パーセンテージ（0〜100%）に知覚的（対数スケール近似）にマッピング
   */
  function dbToPercent(db) {
    if (db <= -50) return 0;
    // -50dB 〜 0dB を 0% 〜 100% に変換
    const pct = ((db + 50) / 50) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /**
   * 毎フレームのメーター描画ループ
   */
  function updateMeters() {
    if (!isMeterActive) return;

    // VOICEVOX & SE アナライザー
    const voiceAnalyser = window.voicevoxAnalyser;
    const voiceLevels = calculateAudioLevels(voiceAnalyser, voiceData);

    // BGM アナライザー
    const bgmAnalyser = window.bgmAnalyser;
    const bgmLevels = calculateAudioLevels(bgmAnalyser, bgmData);

    const now = performance.now();

    // 1. VOICE スムージング & ピークホールド
    const voiceTargetPct = dbToPercent(voiceLevels.db);
    if (voiceTargetPct > voiceLevelSmoothed) {
      voiceLevelSmoothed = voiceTargetPct; // アタック（即座に立ち上がり）
    } else {
      voiceLevelSmoothed = voiceLevelSmoothed * 0.88; // リリース（スムーズに減衰）
      if (voiceLevelSmoothed < 0.5) voiceLevelSmoothed = 0;
    }

    if (voiceTargetPct >= voicePeakHold) {
      voicePeakHold = voiceTargetPct;
      voicePeakHoldTimer = now + 900; // 900msホールド
    } else if (now > voicePeakHoldTimer) {
      voicePeakHold = Math.max(voiceLevelSmoothed, voicePeakHold * 0.94);
    }

    // 2. BGM スムージング & ピークホールド
    const bgmTargetPct = dbToPercent(bgmLevels.db);
    if (bgmTargetPct > bgmLevelSmoothed) {
      bgmLevelSmoothed = bgmTargetPct;
    } else {
      bgmLevelSmoothed = bgmLevelSmoothed * 0.90;
      if (bgmLevelSmoothed < 0.5) bgmLevelSmoothed = 0;
    }

    if (bgmTargetPct >= bgmPeakHold) {
      bgmPeakHold = bgmTargetPct;
      bgmPeakHoldTimer = now + 900;
    } else if (now > bgmPeakHoldTimer) {
      bgmPeakHold = Math.max(bgmLevelSmoothed, bgmPeakHold * 0.94);
    }

    // 3. MASTER 合算
    const masterTargetPct = Math.min(100, Math.max(voiceLevelSmoothed, bgmLevelSmoothed) * 1.05);

    // 4. パネル内 UI の更新
    if (elVoiceBar) {
      elVoiceBar.style.width = `${voiceLevelSmoothed.toFixed(1)}%`;
    }
    if (elVoicePeak) {
      elVoicePeak.style.left = `${voicePeakHold.toFixed(1)}%`;
      elVoicePeak.style.opacity = voicePeakHold > 2 ? "1" : "0";
    }
    if (elVoiceVal) {
      elVoiceVal.textContent = voiceLevelSmoothed > 1 ? `${Math.round(voiceLevels.db)} dB` : "-∞";
    }
    if (elVoiceClip) {
      if (voiceLevels.peak >= 0.98 || voiceLevels.db >= -0.5) {
        elVoiceClip.classList.add("clipped");
      } else {
        elVoiceClip.classList.remove("clipped");
      }
    }

    if (elBgmBar) {
      elBgmBar.style.width = `${bgmLevelSmoothed.toFixed(1)}%`;
    }
    if (elBgmPeak) {
      elBgmPeak.style.left = `${bgmPeakHold.toFixed(1)}%`;
      elBgmPeak.style.opacity = bgmPeakHold > 2 ? "1" : "0";
    }
    if (elBgmVal) {
      elBgmVal.textContent = bgmLevelSmoothed > 1 ? `${Math.round(bgmLevels.db)} dB` : "-∞";
    }
    if (elBgmClip) {
      if (bgmLevels.peak >= 0.98 || bgmLevels.db >= -0.5) {
        elBgmClip.classList.add("clipped");
      } else {
        elBgmClip.classList.remove("clipped");
      }
    }

    if (elMasterBar) {
      elMasterBar.style.width = `${masterTargetPct.toFixed(1)}%`;
    }
    if (elMasterVal) {
      const masterDb = Math.max(voiceLevels.db, bgmLevels.db);
      elMasterVal.textContent = masterTargetPct > 1 ? `${Math.round(masterDb)} dB` : "-∞";
    }

    // 5. 画面上HUD（オーバーレイ）の更新（表示中の場合のみ）
    if (elHudContainer && elHudContainer.style.display !== "none") {
      if (elHudVoiceBar) elHudVoiceBar.style.width = `${voiceLevelSmoothed.toFixed(1)}%`;
      if (elHudVoicePeak) elHudVoicePeak.style.left = `${voicePeakHold.toFixed(1)}%`;
      if (elHudBgmBar) elHudBgmBar.style.width = `${bgmLevelSmoothed.toFixed(1)}%`;
      if (elHudBgmPeak) elHudBgmPeak.style.left = `${bgmPeakHold.toFixed(1)}%`;
    }

    animFrameId = requestAnimationFrame(updateMeters);
  }

  /**
   * DOM参照の初期化およびイベントリスナーの登録
   */
  function initAudioLevelMeter() {
    // パネル側要素
    elVoiceBar = document.getElementById("meter-voice-bar");
    elVoicePeak = document.getElementById("meter-voice-peak");
    elVoiceVal = document.getElementById("meter-voice-val");
    elVoiceClip = document.getElementById("meter-voice-clip");

    elBgmBar = document.getElementById("meter-bgm-bar");
    elBgmPeak = document.getElementById("meter-bgm-peak");
    elBgmVal = document.getElementById("meter-bgm-val");
    elBgmClip = document.getElementById("meter-bgm-clip");

    elMasterBar = document.getElementById("meter-master-bar");
    elMasterVal = document.getElementById("meter-master-val");

    // 画面上HUD要素
    elHudContainer = document.getElementById("stream-audio-meter");
    elHudVoiceBar = document.getElementById("hud-meter-voice-bar");
    elHudVoicePeak = document.getElementById("hud-meter-voice-peak");
    elHudBgmBar = document.getElementById("hud-meter-bgm-bar");
    elHudBgmPeak = document.getElementById("hud-meter-bgm-peak");

    // 画面上HUDの表示/非表示スイッチ連動
    const hudToggle = document.getElementById("toggle-stream-audio-meter");
    if (hudToggle && elHudContainer) {
      const savedState = localStorage.getItem("streamAudioMeterVisible") === "true";
      hudToggle.checked = savedState;
      elHudContainer.style.display = savedState ? "flex" : "none";

      hudToggle.onchange = () => {
        const isChecked = hudToggle.checked;
        elHudContainer.style.display = isChecked ? "flex" : "none";
        localStorage.setItem("streamAudioMeterVisible", isChecked ? "true" : "false");
      };
    }

    // 音声テスト試聴ボタン (同期User Gestureで完全アンロック＆直接発音保証)
    const testVoiceBtn = document.getElementById("btn-audio-test-voice");
    if (testVoiceBtn) {
      testVoiceBtn.onclick = () => {
        console.log("[AudioMeter] 🎙️ 音声レベルテスト実行");
        try {
          // 🚨 WebKit同期アンロックを即時実行（awaitの前に叩くことが絶対条件）
          if (typeof window.unlockAudioSystemSynchronously === "function") {
            window.unlockAudioSystemSynchronously();
          }

          const ctx = typeof window.getVoicevoxAudioContext === "function" ? window.getVoicevoxAudioContext() : window.voicevoxAudioContext;
          if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
            ctx.resume().catch(() => {});
          }

          // VOICEVOX 発話 (原稿キューへ投入)
          if (typeof window.queueVoicevoxAudio === "function") {
            window.queueVoicevoxAudio("マイクと音声の出力テストです。聞こえていますか？", false, null, true, true);
          } else if (typeof window.playVoicevoxDirectAndWait === "function") {
            window.playVoicevoxDirectAndWait("マイクと音声の出力テストです。聞こえていますか？");
          } else {
            console.warn("[AudioMeter] queueVoicevoxAudio が見つかりません");
          }
        } catch (e) {
          console.error("[AudioMeter] 音声テスト再生エラー:", e);
        }
      };
    }

    // BGMテストボタン
    const testBgmBtn = document.getElementById("btn-audio-test-bgm");
    if (testBgmBtn) {
      testBgmBtn.onclick = () => {
        if (typeof window.unlockAudioSystemSynchronously === "function") {
          window.unlockAudioSystemSynchronously();
        }
        if (window.bgmIsPlaying) {
          console.log("[AudioMeter] 🎵 BGMテスト停止");
          if (typeof window.fadeOutBgm === "function") window.fadeOutBgm(800);
        } else {
          console.log("[AudioMeter] 🎵 BGMテスト再生");
          if (typeof window.fadeInBgm === "function") {
            window.fadeInBgm(800);
          } else {
            const playBtn = document.getElementById("bgm-play-btn");
            if (playBtn) playBtn.click();
          }
        }
      };
    }

    // ループ開始（未開始なら）
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(updateMeters);
      console.log("[AudioMeter] 🎚️ リアルタイム・レベルメーター監視エンジン稼働開始");
    }
  }

  // グローバル公開 & イベントバインド (Rule 8 & Rule 12遵守)
  window.initAudioLevelMeter = initAudioLevelMeter;

  if (typeof window.onUILoaded === "function") {
    window.onUILoaded("audio-level-meter", initAudioLevelMeter);
  }
  document.addEventListener("DOMContentLoaded", initAudioLevelMeter);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initAudioLevelMeter();
  }
})();
