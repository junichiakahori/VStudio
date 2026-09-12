let currentPlayingDisplayText = "";

// 🍏 Safari / Web Audio 共通: 単一Master AudioContextの自動復旧・自己修復関数
function getVoicevoxAudioContext() {
  if (
    !window.voicevoxAudioContext ||
    window.voicevoxAudioContext.state === "closed" ||
    window.voicevoxAudioContext.state === "interrupted"
  ) {
    try {
      if (window.voicevoxAudioContext && typeof window.voicevoxAudioContext.close === "function") {
        window.voicevoxAudioContext.close().catch(() => {});
      }
    } catch (e) {}
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    window.voicevoxAudioContext = new AudioCtx();
    window.bgmAudioContext = window.voicevoxAudioContext; // BGMと完全共有（複数デバイス競合・ハング防止）
    window.voicevoxAnalyser = null;
    window.voicevoxGainNode = null;
    window.voicevoxCompressorNode = null;
    window.bgmGainNode = null;
    window.bgmAnalyser = null;
    console.log("[Master AudioContext] 🔄 単一共通オーディオセッションを新規初期化・再生成しました (" + window.voicevoxAudioContext.sampleRate + "Hz)");
  }
  return window.voicevoxAudioContext;
}
window.getVoicevoxAudioContext = getVoicevoxAudioContext;

// ⚡ アプリ再起動不要！音声エンジン強制リセット＆ハードウェア即時再起動（配信に音を乗せない完全サイレント修復）
window.hardResetAudioEngine = async function hardResetAudioEngine() {
  console.log("[AudioEngine] ⚡ 音声エンジンをサイレント強制再起動・修復します...");

  // 1. HTML5 Audio で物理オーディオデバイス (CoreAudio HAL) を無音で強制覚醒
  try {
    const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    silentAudio.volume = 0.0001;
    silentAudio.play().catch(() => {});
  } catch (e) {}

  // 2. 既存の壊れた/休止した AudioContext を解放
  try {
    if (window.voicevoxAudioContext && typeof window.voicevoxAudioContext.close === "function") {
      await window.voicevoxAudioContext.close().catch(() => {});
    }
  } catch (e) {}

  // CoreAudio リソース解放の待機 (WebKitパイプラインの競合防止)
  await new Promise(r => setTimeout(r, 60));

  window.voicevoxAudioContext = null;
  window.bgmAudioContext = null;
  window.voicevoxAnalyser = null;
  window.voicevoxGainNode = null;
  window.voicevoxCompressorNode = null;
  window.bgmGainNode = null;
  window.bgmAnalyser = null;

  // 3. 新規 AudioContext をクリーンに生成＆完全サイレント覚醒
  const ctx = getVoicevoxAudioContext();
  if (ctx.state === "suspended" || ctx.state === "interrupted") {
    await ctx.resume().catch(() => {});
  }

  // 無音バッファを同期再生して WebKit Web Audio を静かに完全アンロック
  try {
    const sampleRate = ctx.sampleRate || 48000;
    const silentBuffer = ctx.createBuffer(1, 1, sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = silentBuffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch (e) {}

  console.log("[AudioEngine] ✅ 音声エンジン完全リセット・再起動完了！ (サイレント修復)");

  // 非同期フィードバック（配信画面を止めない通知）
  if (typeof window.showNotification === "function") {
    window.showNotification("⚡ 音声エンジンを修復・再起動しました");
  } else if (typeof window.showToast === "function") {
    window.showToast("⚡ 音声エンジンを修復・再起動しました");
  }
};

// 🔇 ソフトウェアリミッター（DynamicsCompressor）の設定をlocalStorageからロード＆動的適用
function getSavedLimiterSettings() {
  const preset = localStorage.getItem("voicevoxLimiterPreset") || "safe";
  let defaultThreshold = -6, defaultRatio = 20, defaultGain = 1.5, defaultKnee = 3, defaultAttack = 0.001, defaultRelease = 0.10;
  if (preset === "broadcast") {
    defaultThreshold = -18; defaultRatio = 4; defaultGain = 5.0; defaultKnee = 6; defaultAttack = 0.005; defaultRelease = 0.15;
  } else if (preset === "hard") {
    defaultThreshold = -12; defaultRatio = 20; defaultGain = 3.0; defaultKnee = 0; defaultAttack = 0.001; defaultRelease = 0.05;
  }

  const enabled = localStorage.getItem("voicevoxLimiterEnabled") !== "false"; // デフォルトON
  const threshold = parseFloat(localStorage.getItem("voicevoxLimiterThreshold") || String(defaultThreshold));
  const ratio = parseFloat(localStorage.getItem("voicevoxLimiterRatio") || String(defaultRatio));
  const makeupGain = parseFloat(localStorage.getItem("voicevoxLimiterMakeupGain") || String(defaultGain));
  const knee = parseFloat(localStorage.getItem("voicevoxLimiterKnee") || String(defaultKnee));
  const attack = parseFloat(localStorage.getItem("voicevoxLimiterAttack") || String(defaultAttack));
  const release = parseFloat(localStorage.getItem("voicevoxLimiterRelease") || String(defaultRelease));
  return { enabled, threshold, ratio, makeupGain, knee, attack, release };
}

function applyCompressorNodeParams(comp, ctx, settings) {
  if (!comp || !ctx) return;
  const s = settings || getSavedLimiterSettings();
  const now = ctx.currentTime;
  try {
    if (!s.enabled) {
      // バイパスモード: ratioを1にして圧縮を完全に無効化
      comp.ratio.setValueAtTime(1, now);
      comp.threshold.setValueAtTime(0, now);
    } else {
      comp.threshold.setValueAtTime(s.threshold, now);
      comp.knee.setValueAtTime(s.knee, now);
      comp.ratio.setValueAtTime(s.ratio, now);
      comp.attack.setValueAtTime(s.attack, now);
      comp.release.setValueAtTime(s.release, now);
    }
  } catch (e) {
    console.warn("[VOICEVOX Limiter] パラメータ適用エラー:", e);
  }
}

// 🔇 ソフトウェアリミッター（DynamicsCompressor）を共有ノードとして1回だけ生成・再利用
function getVoicevoxCompressor(ctx) {
  if (!window.voicevoxCompressorNode || window.voicevoxCompressorNode.context !== ctx) {
    const comp = ctx.createDynamicsCompressor();
    applyCompressorNodeParams(comp, ctx);
    window.voicevoxCompressorNode = comp;
    console.log("[VOICEVOX Limiter] 🔇 ソフトウェアリミッター初期化完了");
  }
  return window.voicevoxCompressorNode;
}
window.getVoicevoxCompressor = getVoicevoxCompressor;

// 🎛️ 画面UIからのリアルタイム更新用グローバル関数
window.updateVoicevoxLimiterSettings = function(customSettings) {
  const ctx = window.voicevoxAudioContext;
  if (window.voicevoxCompressorNode && ctx) {
    applyCompressorNodeParams(window.voicevoxCompressorNode, ctx, customSettings);
    console.log("[VOICEVOX Limiter] 🎛️ パラメータをリアルタイム更新しました:", customSettings || getSavedLimiterSettings());
  }
};

// 🔄 別ウィンドウからの設定変更（localStorage）自動同期
window.addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("voicevoxLimiter")) {
    window.updateVoicevoxLimiterSettings();
  }
});


// 🍏 WebKit / Safari 画面操作（クリック・タッチ・キー入力）時の完全同期アンロックエンジン
function unlockAudioSystemSynchronously() {
  try {
    const ctx = getVoicevoxAudioContext();
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      ctx.resume().catch(() => {});
    }
    // Safari / WebKit hardware wake-up: AudioContext のサンプルレートと一致する無音バッファを同期再生
    const sampleRate = ctx.sampleRate || 48000;
    const silentBuffer = ctx.createBuffer(1, 1, sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = silentBuffer;
    src.connect(ctx.destination);
    src.start(0);

    // HTML5 Audio フォールバックアンロック (WebKit メディアパイプラインを強制アクティブ化)
    if (!window._unlockAudioEl) {
      window._unlockAudioEl = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    }
    window._unlockAudioEl.play().catch(() => {});
    console.log("[AudioEngine] 🔓 Web Audio & HTML5 Audio 同期アンロック成功 (state:", ctx.state, ")");
  } catch (e) {
    console.warn("[AudioEngine] 同期アンロック警告:", e);
  }
}
window.unlockAudioSystemSynchronously = unlockAudioSystemSynchronously;

(function setupSafariAudioAutoUnlock() {
  ['click', 'pointerdown', 'keydown', 'touchstart', 'mousedown'].forEach(evt => {
    document.addEventListener(evt, unlockAudioSystemSynchronously, { passive: true, capture: true });
  });

  // 💤 放置後の画面アクティブ化・フォーカス復帰時の自動ヘルスチェック＆覚醒
  const wakeOnActivity = () => {
    try {
      const ctx = window.voicevoxAudioContext;
      if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
        console.log("[AudioEngine] ⏰ 画面復帰検知: オーディオエンジンを自動覚醒します (state:", ctx.state, ")");
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  };
  window.addEventListener("focus", wakeOnActivity);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wakeOnActivity();
  });
})();

// 🛡️ WAVバイナリ（16bit PCM）に対する高精度スタジオ品質ソフトウェアリミッター＆ゲイン調整DSPエンジン
function processWavAudio(arrayBuffer, gain, limiterSettings) {
  if (!arrayBuffer || arrayBuffer.byteLength < 44) return arrayBuffer;
  const s = limiterSettings || getSavedLimiterSettings();
  const isLimiterOn = s.enabled !== false;
  const hasGain = gain !== 1.0;

  // リミッターもOFFでゲインも1.0なら無変換で返す
  if (!isLimiterOn && !hasGain) return arrayBuffer;

  try {
    const copy = arrayBuffer.slice(0);
    const view = new DataView(copy);

    let offset = 12;
    let sampleRate = 24000;
    let pcmStart = -1;
    let pcmBytes = 0;

    // WAV チャンクの解析
    while (offset < view.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === "fmt ") {
        sampleRate = view.getUint32(offset + 12, true) || 24000;
      } else if (chunkId === "data") {
        pcmStart = offset + 8;
        pcmBytes = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
    }

    if (pcmStart < 0 || pcmStart >= view.byteLength) return arrayBuffer;

    const numSamples = Math.min(Math.floor(pcmBytes / 2), Math.floor((view.byteLength - pcmStart) / 2));
    if (numSamples <= 0) return arrayBuffer;

    const thresholdDb = typeof s.threshold === "number" ? s.threshold : -6.0;
    const ratio = typeof s.ratio === "number" && s.ratio > 1 ? s.ratio : 20.0;
    const kneeDb = typeof s.knee === "number" && s.knee >= 0 ? s.knee : 3.0;
    const attackSec = typeof s.attack === "number" && s.attack > 0 ? s.attack : 0.001;
    const releaseSec = typeof s.release === "number" && s.release > 0 ? s.release : 0.10;
    const makeupDb = typeof s.makeupGain === "number" ? s.makeupGain : 0.0;
    const makeupLinear = isLimiterOn && makeupDb !== 0 ? Math.pow(10.0, makeupDb / 20.0) : 1.0;

    const attackCoeff = Math.exp(-1.0 / (sampleRate * attackSec));
    const releaseCoeff = Math.exp(-1.0 / (sampleRate * releaseSec));

    let envDb = 0.0; // 現在のゲインリダクション量 (dB, <= 0)

    for (let i = 0; i < numSamples; i++) {
      const byteIdx = pcmStart + i * 2;
      let rawSample = view.getInt16(byteIdx, true);

      // 1. ゲイン適用 (正規化 [-1.0, 1.0])
      let x = (rawSample * gain) / 32768.0;

      if (isLimiterOn) {
        // 2. 入力レベル (dB)
        const absX = Math.abs(x);
        const xDb = absX > 1e-6 ? 20.0 * Math.log10(absX) : -120.0;

        // 3. 静的コンプレッションカーブ (Soft-Knee)
        let deltaDb = 0.0;
        const diffDb = xDb - thresholdDb;

        if (2.0 * diffDb < -kneeDb) {
          // ニー領域以下: 圧縮なし
          deltaDb = 0.0;
        } else if (2.0 * Math.abs(diffDb) <= kneeDb) {
          // ソフトニー遷移領域: 2次スプライン平滑化
          const kneeTerm = diffDb + kneeDb / 2.0;
          deltaDb = ((1.0 / ratio - 1.0) * kneeTerm * kneeTerm) / (2.0 * kneeDb);
        } else {
          // 閾値以上: 比率圧縮
          deltaDb = diffDb * (1.0 / ratio - 1.0);
        }

        // 4. アタック / リリース エンベロープスムージング
        if (deltaDb < envDb) {
          // 圧縮を強める（Attack）
          envDb = attackCoeff * envDb + (1.0 - attackCoeff) * deltaDb;
        } else {
          // 圧縮を戻す（Release）
          envDb = releaseCoeff * envDb + (1.0 - releaseCoeff) * deltaDb;
        }

        // 5. ゲインリダクション適用 ＆ 補償ゲイン（Makeup Gain）適用
        const reductionGain = Math.pow(10.0, envDb / 20.0);
        x = x * reductionGain * makeupLinear;

        // 6. 万が一の突発ピークに対するスタジオ品質ソフトサチュレーション (Brickwall Soft-Limiter)
        if (Math.abs(x) > 0.95) {
          const sign = x >= 0 ? 1 : -1;
          const excess = (Math.abs(x) - 0.95) / 0.05;
          x = sign * (0.95 + 0.049 * Math.tanh(excess));
        }
      }

      // 7. 16-bit PCM へ再エンコード
      let outInt16 = Math.round(x * 32767.0);
      if (outInt16 > 32767) outInt16 = 32767;
      if (outInt16 < -32768) outInt16 = -32768;

      view.setInt16(byteIdx, outInt16, true);
    }

    return copy;
  } catch (e) {
    console.warn("[VOICEVOX DSP Limiter Error]:", e);
    return arrayBuffer;
  }
}

// 後方互換性用エイリアス
function applyGainToWavArrayBuffer(arrayBuffer, gain) {
  return processWavAudio(arrayBuffer, gain, getSavedLimiterSettings());
}

function showSubtitles(text) {
  const subEl = document.getElementById("avatar-subtitles");
  const textEl = document.getElementById("avatar-subtitles-text");
  const toggle = document.getElementById("subtitles-display-toggle");
  const savedEnabled = localStorage.getItem("subtitlesEnabled");
  const isEnabled = toggle ? toggle.checked : (savedEnabled !== "false");
  if (!subEl || !textEl || !isEnabled || !text || !text.trim()) {
    if (subEl) subEl.style.display = "none";
    return;
  }

  let cleanText = text.trim();
  cleanText = cleanText.replace(/[。！？]+[\s　]*(にゃ|のだ|なのだ)[！!。？?]*/g, '$1。');
  cleanText = cleanText.replace(/(?:にゃ[！!。？?\s　]*){2,}/g, 'にゃ！');
  cleanText = cleanText.replace(/(?:のだ[！!。？?\s　]*){2,}/g, 'のだ！');
  cleanText = cleanText.replace(/。{2,}/g, '。');

  textEl.textContent = cleanText;
  subEl.style.display = "flex";
}

function hideSubtitles() {
  const subEl = document.getElementById("avatar-subtitles");
  if (subEl) {
    subEl.style.display = "none";
  }
}

// VOICEVOX音声合成バッファの先行キャッシュ（先読み時に事前に音声化してラグ0.0秒化）
const voicevoxAudioBufferCache = new Map();

async function fetchVoicevoxBuffer(text, speakerId, speedScaleVal, pitchScaleVal) {
  if (!text || !text.trim()) return null;
  const cacheKey = `${speakerId}_${speedScaleVal}_${pitchScaleVal}_${text.trim()}`;
  if (voicevoxAudioBufferCache.has(cacheKey)) {
    return await voicevoxAudioBufferCache.get(cacheKey);
  }

  const promise = (async () => {
    const ctrl = new AbortController();
    const tId = setTimeout(() => ctrl.abort(), 15000);
    try {
      // 1. Python バックエンド経由で辞書適用＆音声合成
      const synthRes = await fetch("/api/voicevox/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          speakerId: parseInt(speakerId, 10) || 3,
          speedScale: speedScaleVal,
          pitchScale: pitchScaleVal
        }),
        signal: ctrl.signal
      });
      clearTimeout(tId);
      if (synthRes.ok) {
        const kanaHeader = synthRes.headers.get("X-Voicevox-Kana");
        const cleanKanaHeader = synthRes.headers.get("X-Voicevox-Clean-Kana");
        const finalTextHeader = synthRes.headers.get("X-Voicevox-Final-Text");
        const corrected = synthRes.headers.get("X-Voicevox-Corrected");

        let rawKana = "";
        let cleanKana = "";
        let finalText = text.trim();

        if (kanaHeader) {
          try { rawKana = decodeURIComponent(kanaHeader); } catch (e) { }
        }
        if (cleanKanaHeader) {
          try { cleanKana = decodeURIComponent(cleanKanaHeader); } catch (e) { }
        }
        if (finalTextHeader) {
          try { finalText = decodeURIComponent(finalTextHeader); } catch (e) { }
        }

        if (corrected === "1" || (finalText && finalText !== text.trim())) {
          console.log(`[VOICEVOX発音確認] 🗣️ 「${text.trim()}」 ➔ 変換後: 「${finalText}」 (読み: "${cleanKana || rawKana}")`);
        } else {
          console.log(`[VOICEVOX発音確認] 🗣️ 読み: "${cleanKana || rawKana}"`);
        }
        return await synthRes.arrayBuffer();
      }
      throw new Error("Backend synthesis failed: " + synthRes.statusText);
    } catch (backendErr) {
      clearTimeout(tId);
      // Fallback: 直接 VOICEVOX (:50021) 呼び出し
      const directCtrl = new AbortController();
      const directTId = setTimeout(() => directCtrl.abort(), 15000);
      try {
        const queryRes = await fetch(
          `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
          { method: "POST", signal: directCtrl.signal }
        );
        if (!queryRes.ok) throw new Error("Audio query failed");
        const queryJson = await queryRes.json();
        // 🎙️ 発声終了後の余白（postPhonemeLength）を 0.15秒に最適化（語尾切れ防止と軽快テンポの両立）
        queryJson.postPhonemeLength = 0.15;
        queryJson.prePhonemeLength = 0.08;
        // ⚡ フォールバック時でもユーザー設定の話速（speedScale）と音高（pitchScale）を100%確実に適用
        if (typeof speedScaleVal === "number" && !isNaN(speedScaleVal) && speedScaleVal > 0) {
          queryJson.speedScale = speedScaleVal;
        }
        if (typeof pitchScaleVal === "number" && !isNaN(pitchScaleVal)) {
          queryJson.pitchScale = pitchScaleVal;
        }
        if (queryJson.kana) {
          console.log(`[VOICEVOX発音カナ] 🗣️ ${queryJson.kana}`);
        }
        const directSynthRes = await fetch(
          `http://localhost:50021/synthesis?speaker=${speakerId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryJson),
            signal: directCtrl.signal
          }
        );

        clearTimeout(directTId);
        if (directSynthRes.ok) {
          return await directSynthRes.arrayBuffer();
        }
      } catch (directErr) {
        clearTimeout(directTId);
      }
    }
    return null;
  })();




  voicevoxAudioBufferCache.set(cacheKey, promise);

  if (voicevoxAudioBufferCache.size > 80) {
    const firstKey = voicevoxAudioBufferCache.keys().next().value;
    voicevoxAudioBufferCache.delete(firstKey);
  }
  return await promise;
}

// 🧹 VOICEVOX送信前テキストの共通クリーンアップ（本編・先読みで100%同一のキーを保証）
function cleanVoicevoxYomi(t) {
  if (!t || typeof t !== "string") return "";
  // 「行う（おこなう）」の文脈誤読防止ルール
  t = t.replace(/([をがにでもはと])行([っいうわえな])/g, "$1おこな$2");
  t = t.replace(/(活動|調査|支援|開発|実験|作業|対応|対策|工事|手続き|点検|研修|指導|投票|開票|審査|試験|発表|配信|運営|管理|処理|実行|実施|施行|開催|避難|提供|販売|製造|修理|変更|修正|開始|終了|停止|中止|延期|再開)行([っいうわえな])/g, "$1おこな$2");
  t = t.replace(/行わ([れせないずぬてたまば])/g, "おこなわ$1");
  t = t.replace(/行い([まてた])/g, "おこない$1");
  t = t.replace(/行う([こともの予定方針見込みよう際時ためとがのからに。！？、]|$)/g, "おこなう$1");
  t = t.replace(/だなにゃ([！!？?。、\s　]|$)/g, "だにゃ$1");
  t = t.replace(/だなのだ([！!？?。、\s　]|$)/g, "なのだ$1");
  t = t.replace(/だねにゃ([！!？?。、\s　]|$)/g, "ですね$1");
  t = t.replace(/(?:この(?:ニュース|話題|記事|出来事)を?(?:受けた|に対する))?(?:とろろ|トロロ|ずんだもん|ズンダモン)としては[、,\s　]*/g, "");
  t = t.replace(/(^|[。！？\s「（])(?:とろろ|トロロ|ずんだもん|ズンダモン)(?:としては|にゃ|はにゃ|なのだ|のだ|はなのだ|はのだ)[、,\s　]*/g, "$1");
  t = t.replace(/^[、,\s　]+/, "");
  let pt = t.replace(/(?<![A-Za-z0-9])[ 　]+(?![A-Za-z0-9])/g, "");
  // 括弧内の出典・年齢・ルビの安全な発音化（中身を消去せず残す）
  pt = pt.replace(/[（\(]([^）\)]*より)[）\)]/g, "、$1");
  pt = pt.replace(/[\u4E00-\u9FFF々ヶ〆〇0-9a-zA-Z]+[（\(]([ぁ-んァ-ヶー]+)[）\)]/g, "$1");
  pt = pt.replace(/[（\(]([^）\)]*)[）\)]/g, "、$1、");
  pt = pt.replace(/、+/g, "、").replace(/^、|、$/g, "");
  if (typeof aiFeatures !== "undefined" && typeof aiFeatures.applyCustomHiraganaDict === "function") {
    pt = aiFeatures.applyCustomHiraganaDict(pt);
  }
  return pt;
}
window.cleanVoicevoxYomi = cleanVoicevoxYomi;

window.preloadVoicevoxSentenceAudio = function (text, speakerId, speed, pitch) {
  if (!text || !text.trim()) return Promise.resolve(null);
  const speakerIdEl = document.getElementById("voicevox-speaker-id");
  const speedEl = document.getElementById("voicevox-speed");
  const pitchEl = document.getElementById("voicevox-pitch");
  const spk = speakerId || (speakerIdEl ? speakerIdEl.value : (window.voicevoxSpeakerId ? window.voicevoxSpeakerId.value : "3"));
  const spd = speed !== undefined ? speed : (speedEl ? parseFloat(speedEl.value) || 1.0 : 1.0);
  const ptc = pitch !== undefined ? pitch : (pitchEl ? parseFloat(pitchEl.value) || 0.0 : 0.0);
  // 🎯 本編の queueVoicevoxAudio と 100% 一致する cleanVoicevoxYomi を通してキャッシュキーを完全一致
  const cleanedText = cleanVoicevoxYomi(text);
  return fetchVoicevoxBuffer(cleanedText, spk, spd, ptc);
};

let _isVoicevoxProcessing = false;
let _voicevoxNextTimerId = null;

async function playNextVoicevox() {
  if (_isVoicevoxProcessing) {
    return; // 🛡️ 既にキュー取り出しまたは音声生成・再生準備中のため二重実行を100%遮断
  }
  if (isVoicevoxPlaying) {
    return; // 🛡️ 既に発声中のため二重起動を遮断
  }

  if (voicevoxAudioQueue.length === 0) {
    isVoicevoxPlaying = false;
    _isVoicevoxProcessing = false;
    currentPlayingDisplayText = "";
    hideSubtitles();
    if (typeof resetIdleTimer === "function") resetIdleTimer();
    return;
  }

  // 🛡️ 保留中の遅延発火タイマーがあればクリアして二重発火を完全防止
  if (_voicevoxNextTimerId) {
    clearTimeout(_voicevoxNextTimerId);
    _voicevoxNextTimerId = null;
  }

  _isVoicevoxProcessing = true;
  const item = voicevoxAudioQueue.shift();

  // 1. 表示用（字幕・原稿ログ）は常に item.displayText を死守する
  let displayString = typeof item === "object" && item !== null ? (item.displayText || item.original || String(item)) : String(item);

  // 2. 音声合成用（読み）は item.original を基本にする
  let speakString = typeof item === "object" && item !== null ? (item.original || item.displayText || String(item)) : String(item);

  // 実質文字（日本語・英数字）が一切含まれていない記号のみの空行（"。" や " " 等）は安全にスキップ
  if (!/[\u4E00-\u9FFFぁ-んァ-ヶーA-Za-z0-9]/.test(displayString) && !/[\u4E00-\u9FFFぁ-んァ-ヶーA-Za-z0-9]/.test(speakString)) {
    isVoicevoxPlaying = false;
    _isVoicevoxProcessing = false;
    playNextVoicevox();
    return;
  }
  if (typeof item === "object" && item !== null && item.promise) {
    currentPlayingIsIdle = item.isIdle || false;
    try {
      const resolvedYomi = await item.promise;
      if (resolvedYomi && typeof resolvedYomi === "string") {
        speakString = resolvedYomi;
      }
    } catch (e) {
      speakString = item.original || displayString;
    }
  }

  const speakerIdEl = document.getElementById("voicevox-speaker-id");
  const speedEl = document.getElementById("voicevox-speed");
  const pitchEl = document.getElementById("voicevox-pitch");
  const speakerId = speakerIdEl ? speakerIdEl.value : (window.voicevoxSpeakerId ? window.voicevoxSpeakerId.value : "3");
  const speedScaleVal = speedEl ? parseFloat(speedEl.value) || 1.0 : 1.0;
  const pitchScaleVal = pitchEl ? parseFloat(pitchEl.value) || 0.0 : 0.0;

  try {
    // 📝 ログと画面字幕には「常に漢字の displayString」を使う
    if (displayString) {
      console.log(`[原稿] "${displayString}"`);
    }
    // 🗣️ VOICEVOXの音声合成と再生ログ
    console.log(`[VOICEVOX] 音声リクエスト送信: "${speakString}" (Speaker ID: ${speakerId})`);

    currentPlayingDisplayText = displayString;
    showSubtitles(displayString); // 画面の字幕には漢字混じりの綺麗な原稿を表示
    // 音声バッファの取得と再生には speakString を渡す
    let arrayBuffer = await fetchVoicevoxBuffer(speakString, speakerId, speedScaleVal, pitchScaleVal);
    if (!arrayBuffer) {
      console.warn("[VOICEVOX] 音声取得初回失敗 ➔ 600ms後に再試行します...");
      await new Promise(r => setTimeout(r, 600));
      arrayBuffer = await fetchVoicevoxBuffer(speakString, speakerId, speedScaleVal, pitchScaleVal);
    }
    if (!arrayBuffer) throw new Error("Empty audio buffer");

    const ctx = getVoicevoxAudioContext();
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("[VOICEVOX] Resume error:", e);
      }
    }
    const volSlider = document.getElementById("voicevox-volume-slider");
    const savedVol = localStorage.getItem("savedVoicevoxVolume");
    let targetVol = 1.0;
    if (volSlider && !isNaN(parseFloat(volSlider.value))) {
      targetVol = parseFloat(volSlider.value) / 100.0;
    } else if (savedVol !== null && !isNaN(parseFloat(savedVol))) {
      targetVol = parseFloat(savedVol) / 100.0;
    }
    if (isNaN(targetVol)) targetVol = 1.0;
    targetVol = Math.max(0.0, targetVol);

    // 🛡️ ソフトウェアリミッター（DynamicsCompressor）および音量ゲイン調整の適用
    const limiterSettings = getSavedLimiterSettings();
    let outputWavBuffer = arrayBuffer;
    let html5Vol = 1.0;

    // 音量調整またはリミッターが有効な場合はWAVバイナリをDSP処理（スタジオ品質Soft-Knee＆クリッピング防止）
    if (targetVol !== 1.0 || (limiterSettings && limiterSettings.enabled)) {
      outputWavBuffer = processWavAudio(arrayBuffer, targetVol, limiterSettings);
      html5Vol = 1.0; // WAVバイナリ側でゲインおよびリミッティング処理済み
    } else {
      html5Vol = Math.min(1.0, targetVol);
    }

    const audioBlob = new Blob([outputWavBuffer], { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audioEl = new Audio(audioUrl);
    audioEl.volume = html5Vol;

    // Web Audio は Live2D リップシンク & レベルメーターの波形解析専用として並行稼働
    // メーター/リップシンク側にもリミッター処理後の outputWavBuffer を渡すことで実音と完全同期
    const audioBuffer = await ctx.decodeAudioData(outputWavBuffer.slice(0));
    currentVoicevoxSource = ctx.createBufferSource();
    currentVoicevoxSource.buffer = audioBuffer;

    if (!window.voicevoxAnalyser) {
      window.voicevoxAnalyser = ctx.createAnalyser();
      window.voicevoxAnalyser.fftSize = 256;
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
    currentVoicevoxSource.connect(gainNode);

    // 🎚️ レベルメーター・Live2Dリップシンク計測用アナライザーへ分岐接続
    gainNode.connect(window.voicevoxAnalyser);

    let isEnded = false;
    const handleVoicevoxEnded = () => {
      if (isEnded) return;
      isEnded = true;
      try { currentVoicevoxSource.disconnect(); } catch(e){}
      try { gainNode.disconnect(); } catch(e){}
      currentVoicevoxSource = null;
      window.currentVoicevoxAudioEl = null;
      isVoicevoxPlaying = false;
      _isVoicevoxProcessing = false;
      setTimeout(() => {
        try { URL.revokeObjectURL(audioUrl); } catch(e){}
      }, 1000);

      if (voicevoxAudioQueue.length === 0) {
        hideSubtitles();
      }

      const radioModeToggle = document.getElementById("ai-radio-mode-toggle");
      const isRadioMode = radioModeToggle && radioModeToggle.checked;
      const isRadioActive = isRadioMode;

      if (
        isRadioActive &&
        radioModeState.currentPhase === "playing" &&
        radioModeState.scriptLines &&
        radioModeState.currentScriptIndex < radioModeState.scriptLines.length &&
        voicevoxAudioQueue.length === 0
      ) {
        setTimeout(() => triggerIdleSpeech(), 1500);
      } else {
        // 🌬️ 文と文の間に軽快なブレス（約60msの間）を設けて淀みないテンポへ向上
        if (_voicevoxNextTimerId) clearTimeout(_voicevoxNextTimerId);
        _voicevoxNextTimerId = setTimeout(() => {
          _voicevoxNextTimerId = null;
          playNextVoicevox();
        }, 60);
      }
    };

    audioEl.onended = handleVoicevoxEnded;
    currentVoicevoxSource.onended = () => {
      // 🛡️ Web Audio側が先に終了しても、実際に発声している audioEl が再生中の場合は絶対に中断させない
      setTimeout(() => {
        if (!isEnded) {
          if (audioEl && !audioEl.paused && !audioEl.ended) {
            return;
          }
          handleVoicevoxEnded();
        }
      }, 800);
    };

    window.currentVoicevoxAudioEl = audioEl;

    // 🎧 再生準備完了: 発声フラグを確定し処理中フラグを解除
    isVoicevoxPlaying = true;
    _isVoicevoxProcessing = false;

    // 同期再生スタート (HTML5 Audioでスピーカー発音 + Web Audioでメーター/口パク駆動)
    currentVoicevoxSource.start(0);
    audioEl.play().catch((err) => {
      console.warn("[VOICEVOX HTML5 Audio play rejected, falling back to Web Audio destination]:", err);
      try { gainNode.connect(ctx.destination); } catch(e){}
    });

  } catch (e) {
    console.error("VOICEVOX Error:", e);
    currentPlayingDisplayText = "";
    isVoicevoxPlaying = false;
    _isVoicevoxProcessing = false;
    hideSubtitles();
    playNextVoicevox();
  }
}

window.playNextVoicevox = playNextVoicevox;
async function queueVoicevoxAudio(
  text,
  isIdle = false,
  preConvertedYomi = null,
  forcePlay = false,
  noSplit = false,
) {
  if (!text || !text.trim()) return;
  // 単独の「ニュース」「？」などの無意味なゴミ単語・記号のみの行を完全遮断
  const trimmed = text.trim();
  if (/^(ニュース|主要ニュース|トピックス|[？!！\?。、\-–—…\s　]+)$/.test(trimmed)) {
    return;
  }

  // クリーンアップ関数（共通の cleanVoicevoxYomi を利用）
  const cleanYomi = cleanVoicevoxYomi;

  // 📰 見出しモード（noSplit: true）: 人名等の「。」で文分割させず、1つの見出しとして一息で発話
  if (noSplit) {
    const rawSpeak = preConvertedYomi || text;
    const yomiS = cleanYomi(rawSpeak);
    voicevoxAudioQueue.push({
      original: yomiS,
      displayText: text.trim(),
      promise: Promise.resolve(yomiS),
      isIdle,
    });
  } else {
    // Yahoo! や M!LK 等のブランド名感嘆符で誤分割されない安全な文分割関数
    const splitSentencesSafely = (rawText) => {
      if (!rawText) return [];
      let tSafe = rawText.replace(/Yahoo[!！]/gi, "Yahoo__EXCL__")
                         .replace(/M[!！]LK/g, "M__EXCL__LK")
                         .replace(/Y[!！]ニュース/g, "Y__EXCL__ニュース");
      const parts = tSafe.split(/(?<=[。！？\n])|(?<=[!?])(?![A-Za-z0-9])/g)
                         .map(s => s.trim())
                         .filter(s => s.length > 0 && /[\u4E00-\u9FFFぁ-んァ-ヶーA-Za-z0-9]/.test(s));
      return parts.map(s => s.replace(/Yahoo__EXCL__/g, "Yahoo!").replace(/M__EXCL__LK/g, "M!LK").replace(/Y__EXCL__ニュース/g, "Y!ニュース"));
    };

    const origSentences = splitSentencesSafely(text);

  if (preConvertedYomi) {
    const yomiSentences = splitSentencesSafely(preConvertedYomi);

    if (origSentences.length > 0 && origSentences.length === yomiSentences.length) {
      // 1対1で文が一致する場合（各文ごとにキューへ投入）
      for (let i = 0; i < origSentences.length; i++) {
        const origS = origSentences[i];
        const yomiS = cleanYomi(yomiSentences[i]);
        voicevoxAudioQueue.push({
          original: yomiS,
          displayText: origS,
          promise: Promise.resolve(yomiS),
          isIdle,
        });
      }
    } else {
      // 文数が異なる場合でも1文ずつ分割して投入
      const fullProcessed = cleanYomi(preConvertedYomi);
      const parts = splitSentencesSafely(fullProcessed);
      for (let i = 0; i < parts.length; i++) {
        const s = parts[i];
        const disp = origSentences[i] || origSentences[origSentences.length - 1] || text;
        voicevoxAudioQueue.push({
          original: s,
          displayText: disp,
          promise: Promise.resolve(s),
          isIdle,
        });
      }
    }
  } else {
    for (const origS of origSentences) {
      const processedS = cleanYomi(origS);
      voicevoxAudioQueue.push({
        original: processedS,
        displayText: origS,
        promise: Promise.resolve(processedS),
        isIdle,
      });
    }
  }
}

  if (
    !isIdle &&
    currentVoicevoxSource &&
    isVoicevoxPlaying &&
    currentPlayingIsIdle
  ) {
    const radioModeToggle = document.getElementById("ai-radio-mode-toggle");
    const isRadioMode = radioModeToggle && radioModeToggle.checked;
    console.log(
      isRadioMode
        ? "[VOICEVOX] ラジオ台本を中断してコメントを優先します！"
        : "[VOICEVOX] 独り言を中断してコメントを優先します！",
    );
    try {
      currentVoicevoxSource.stop(); // This triggers onended -> playNextVoicevox()
    } catch (e) {
      console.warn("Failed to stop current source", e);
    }
  } else if (!isVoicevoxPlaying) {
    playNextVoicevox();
  }

  if (typeof clearIdleTimer === "function") clearIdleTimer();
}

// VOICEVOXの再生を即座に完全停止する関数
function stopVoicevoxPlayback() {
  if (typeof voicevoxAudioQueue !== "undefined") {
    voicevoxAudioQueue.length = 0;
  }
  if (_voicevoxNextTimerId) {
    clearTimeout(_voicevoxNextTimerId);
    _voicevoxNextTimerId = null;
  }
  _isVoicevoxProcessing = false;
  if (currentVoicevoxSource) {
    try {
      currentVoicevoxSource.onended = null;
      currentVoicevoxSource.stop();
    } catch (e) { }
    currentVoicevoxSource = null;
  }
  const audioEl = document.getElementById("voicevox-audio");
  if (audioEl) {
    try {
      audioEl.pause();
      audioEl.currentTime = 0;
    } catch (e) { }
  }
  if (window.currentVoicevoxAudioEl) {
    try {
      window.currentVoicevoxAudioEl.pause();
      window.currentVoicevoxAudioEl.currentTime = 0;
    } catch(e){}
    window.currentVoicevoxAudioEl = null;
  }
  isVoicevoxPlaying = false;
  if (typeof hideSubtitles === "function") hideSubtitles();
  console.log("[VOICEVOX] 再生キューをクリアし、音声を即時強制停止しました。");
}

window.stopVoicevoxPlayback = stopVoicevoxPlayback;

// 🚨 全ての番組・音声・BGMを一発で即時完全停止する緊急停止関数
window.emergencyStopAll = function emergencyStopAll() {
  console.log("[緊急停止] 🚨 緊急停止を実行しました");

  // 1. ニュース番組の停止
  if (typeof window.stopNewsBroadcast === "function") {
    window.stopNewsBroadcast();
  }
  if (window.newsBroadcastState) {
    window.newsBroadcastState.isRunning = false;
  }
  window.isReadingNews = false;

  // 2. ラジオ番組・待機発話の停止
  if (window.radioModeState) {
    window.radioModeState.isRunning = false;
    window.radioModeState.currentPhase = "idle";
  }

  // 3. VOICEVOX音声の完全停止
  stopVoicevoxPlayback();

  // 4. BGMの停止
  if (window.bgmPlayer && typeof window.bgmPlayer.stop === "function") {
    window.bgmPlayer.stop();
  } else if (typeof window.stopBgm === "function") {
    window.stopBgm();
  }

  // 5. 字幕の消去
  if (typeof hideSubtitles === "function") hideSubtitles();

  // 6. UIボタン状態の復元
  const startBtn = document.getElementById("news-broadcast-start-btn");
  const stopBtn = document.getElementById("news-broadcast-stop-btn");
  const progressEl = document.getElementById("news-broadcast-progress");
  if (startBtn) startBtn.style.display = "block";
  if (stopBtn) stopBtn.style.display = "none";
  if (progressEl) progressEl.textContent = "🚨 緊急停止しました";
};

// ⌨️ Escキーによる即座の緊急停止（入力欄フォーカス中以外）
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
      return;
    }
    if (
      (window.newsBroadcastState && window.newsBroadcastState.isRunning) ||
      (typeof isVoicevoxPlaying !== "undefined" && isVoicevoxPlaying) ||
      window.isReadingNews
    ) {
      e.preventDefault();
      window.emergencyStopAll();
    }
  }
});

// VOICEVOXのキューが空になり、音声再生が完全に終わるまで待つ関数
function waitForVoicevoxFinish() {
  return new Promise((resolve) => {
    // キュー投入直後の非同期音声生成・再生開始ラグを考慮して待機してから判定
    setTimeout(() => {
      const check = setInterval(() => {
        // ニュース番組が手動停止された場合は即座に待機を解除
        if (window.newsBroadcastState && !window.newsBroadcastState.isRunning) {
          clearInterval(check);
          resolve();
          return;
        }
        const queueEmpty = (typeof voicevoxAudioQueue !== "undefined" ? voicevoxAudioQueue.length === 0 : true);
        const notPlaying = (typeof isVoicevoxPlaying !== "undefined" ? !isVoicevoxPlaying : true);
        const notProcessing = (typeof _isVoicevoxProcessing !== "undefined" ? !_isVoicevoxProcessing : true);
        const noPendingTimer = !_voicevoxNextTimerId;
        if (queueEmpty && notPlaying && notProcessing && noPendingTimer) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    }, 100);
  });
}

// 1文を直接VOICEVOX合成して再生し、再生完了（onended）まで確実に待機する関数
async function playVoicevoxDirectAndWait(displayText, speakText = null) {
  if (!displayText || !displayText.trim()) return;
  if (/^(ニュース|主要ニュース|トピックス|[？!！\?。、\-–—…\s　]+)$/.test(displayText.trim())) return;
  const rawSpeak = speakText || displayText;
  
  const cleanYomi = cleanVoicevoxYomi;
  
  const speakString = cleanYomi(rawSpeak);
  const displayString = displayText.trim();

  const speakerIdEl = document.getElementById("voicevox-speaker-id");
  const speedEl = document.getElementById("voicevox-speed");
  const pitchEl = document.getElementById("voicevox-pitch");
  const speakerId = speakerIdEl ? speakerIdEl.value : (window.voicevoxSpeakerId ? window.voicevoxSpeakerId.value : "3");
  const speedScaleVal = speedEl ? parseFloat(speedEl.value) || 1.0 : 1.0;
  const pitchScaleVal = pitchEl ? parseFloat(pitchEl.value) || 0.0 : 0.0;

  console.log(`[原稿] "${displayString}"`);
  console.log(`[VOICEVOX] Playing: "${speakString}" (Speaker ID: ${speakerId})`);
  
  currentPlayingDisplayText = displayString;
  showSubtitles(displayString);
  isVoicevoxPlaying = true;

  try {
    let arrayBuffer = await fetchVoicevoxBuffer(speakString, speakerId, speedScaleVal, pitchScaleVal);
    if (!arrayBuffer) throw new Error("Empty audio buffer");

    const ctx = getVoicevoxAudioContext();
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      await ctx.resume().catch((e) => console.warn("[VOICEVOX] Resume error:", e));
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    await new Promise((resolve) => {
      currentVoicevoxSource = ctx.createBufferSource();
      currentVoicevoxSource.buffer = audioBuffer;

      if (!window.voicevoxAnalyser) {
        window.voicevoxAnalyser = ctx.createAnalyser();
        window.voicevoxAnalyser.fftSize = 256;
      }

      const compressor = getVoicevoxCompressor(ctx);

      const volSlider = document.getElementById("voicevox-volume-slider");
      const savedVol = localStorage.getItem("savedVoicevoxVolume");
      const targetVol = volSlider ? (parseFloat(volSlider.value) / 100.0) : (savedVol ? (parseFloat(savedVol) / 100.0) : 1.0);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(targetVol, ctx.currentTime);
      currentVoicevoxSource.connect(gainNode);

      // 🛡️ リミッター（DynamicsCompressor）経由でスピーカー＆アナライザーへ接続
      if (compressor) {
        gainNode.connect(compressor);
        compressor.connect(ctx.destination);
        compressor.connect(window.voicevoxAnalyser);
      } else {
        gainNode.connect(ctx.destination);
        gainNode.connect(window.voicevoxAnalyser);
      }

      currentVoicevoxSource.onended = () => {
        try { currentVoicevoxSource.disconnect(); } catch(e){}
        try { gainNode.disconnect(); } catch(e){}
        currentVoicevoxSource = null;
        isVoicevoxPlaying = false;
        currentPlayingDisplayText = "";
        hideSubtitles();
        console.log(`[VOICEVOX Direct] ✅ 発声完了: "${displayString}"`);
        resolve();
      };

      currentVoicevoxSource.start(0);
    });
  } catch (err) {
    console.error("[VOICEVOX Direct Error]:", err);
    isVoicevoxPlaying = false;
    currentPlayingDisplayText = "";
    hideSubtitles();
  }
}

window.playVoicevoxDirectAndWait = playVoicevoxDirectAndWait;
window.queueVoicevoxAudio = queueVoicevoxAudio;
window.waitForVoicevoxFinish = waitForVoicevoxFinish;

// 字幕テロップのドラッグ＆ドロップと位置復元・トグル制御
function initSubtitlesControl() {
  const subtitlesEl = document.getElementById("avatar-subtitles");
  const handleEl = document.getElementById("subtitles-drag-handle");
  const toggleEl = document.getElementById("subtitles-display-toggle");

  // スイッチの保存状態を復元
  if (toggleEl) {
    const savedEnabled = localStorage.getItem("subtitlesEnabled");
    if (savedEnabled !== null) {
      toggleEl.checked = (savedEnabled === "true");
    }
    if (!toggleEl.checked && subtitlesEl) {
      subtitlesEl.style.display = "none";
    }
  }

  if (!subtitlesEl) return;

  // 位置復元
  const savedPos = localStorage.getItem("subtitlesPosition");
  if (savedPos) {
    try {
      const { left, top, bottom, transform } = JSON.parse(savedPos);
      if (left) subtitlesEl.style.left = left;
      if (top) subtitlesEl.style.top = top;
      if (bottom) subtitlesEl.style.bottom = bottom;
      if (transform !== undefined) subtitlesEl.style.transform = transform;
    } catch (e) { }
  }

  let isDragging = false;
  let startX, startY, initLeft, initTop;

  const dragTarget = handleEl || subtitlesEl;
  dragTarget.onmousedown = (e) => {
    isDragging = true;
    subtitlesEl.classList.add("dragging");
    const rect = subtitlesEl.getBoundingClientRect();
    const parentRect = subtitlesEl.parentElement.getBoundingClientRect();
    initLeft = rect.left - parentRect.left;
    initTop = rect.top - parentRect.top;
    startX = e.clientX;
    startY = e.clientY;
    subtitlesEl.style.transform = "none";
    subtitlesEl.style.bottom = "auto";
    subtitlesEl.style.left = `${initLeft}px`;
    subtitlesEl.style.top = `${initTop}px`;
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    subtitlesEl.style.left = `${initLeft + dx}px`;
    subtitlesEl.style.top = `${initTop + dy}px`;
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    subtitlesEl.classList.remove("dragging");
    const pos = {
      left: subtitlesEl.style.left,
      top: subtitlesEl.style.top,
      bottom: "auto",
      transform: "none"
    };
    localStorage.setItem("subtitlesPosition", JSON.stringify(pos));
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

// uiLoaded（サイドバー読み込み完了）と DOMContentLoaded の両方で初期化
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("audio-voicevox", initSubtitlesControl);
document.addEventListener("DOMContentLoaded", initSubtitlesControl);

// グローバルイベント委譲によるトグル即時検知（いつでも確実に双方向リアルタイム反映）
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "subtitles-display-toggle") {
    const isEnabled = e.target.checked;
    localStorage.setItem("subtitlesEnabled", isEnabled);
    const subtitlesEl = document.getElementById("avatar-subtitles");
    if (!isEnabled) {
      if (subtitlesEl) subtitlesEl.style.display = "none";
    } else {
      // OFFからONに切り替えた瞬間に、現在発声中なら即座に字幕を表示
      if (typeof isVoicevoxPlaying !== "undefined" && isVoicevoxPlaying && currentPlayingDisplayText) {
        showSubtitles(currentPlayingDisplayText);
      }
    }
  }
});
