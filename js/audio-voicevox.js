let currentPlayingDisplayText = "";

// 🍏 Safari / Web Audio 共通: AudioContextの自動復旧・自己修復関数
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
    window.voicevoxAnalyser = null;
    window.voicevoxGainNode = null;
    console.log("[VOICEVOX AudioContext] 🔄 オーディオセッションを新規初期化・再生成しました");
  }
  return window.voicevoxAudioContext;
}
window.getVoicevoxAudioContext = getVoicevoxAudioContext;

// 🍏 Safari 画面操作（クリック・タッチ・キー入力）時の自動音声ロック解除＆ハードウェア起動
(function setupSafariAudioAutoUnlock() {
  const unlock = () => {
    try {
      const ctx = getVoicevoxAudioContext();
      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        ctx.resume().catch(() => {});
      }
      if (window.bgmAudioContext && (window.bgmAudioContext.state === "suspended" || window.bgmAudioContext.state === "interrupted")) {
        window.bgmAudioContext.resume().catch(() => {});
      }
      // Safari hardware wake-up (無音バッファキック)
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {}
  };
  ['click', 'pointerdown', 'keydown', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, unlock, { passive: true, capture: true });
  });
})();

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

  textEl.textContent = text.trim();
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
        })
      });
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
      // Fallback: 直接 VOICEVOX (:50021) 呼び出し
      const queryRes = await fetch(
        `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
        { method: "POST" }
      );
      if (!queryRes.ok) throw new Error("Audio query failed");
      const queryJson = await queryRes.json();
      if (queryJson.kana) {
        console.log(`[VOICEVOX発音カナ] 🗣️ ${queryJson.kana}`);
      }
      const directSynthRes = await fetch(
        `http://localhost:50021/synthesis?speaker=${speakerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryJson)
        }
      );
      if (!directSynthRes.ok) throw new Error("Direct synthesis failed");
      return await directSynthRes.arrayBuffer();
    }
  })();

  voicevoxAudioBufferCache.set(cacheKey, promise);
  if (voicevoxAudioBufferCache.size > 80) {
    const firstKey = voicevoxAudioBufferCache.keys().next().value;
    voicevoxAudioBufferCache.delete(firstKey);
  }
  return await promise;
}

window.preloadVoicevoxSentenceAudio = function (text, speakerId, speed, pitch) {
  const speakerIdEl = document.getElementById("voicevox-speaker-id");
  const speedEl = document.getElementById("voicevox-speed");
  const pitchEl = document.getElementById("voicevox-pitch");
  const spk = speakerId || (speakerIdEl ? speakerIdEl.value : (window.voicevoxSpeakerId ? window.voicevoxSpeakerId.value : "3"));
  const spd = speed !== undefined ? speed : (speedEl ? parseFloat(speedEl.value) || 1.0 : 1.0);
  const ptc = pitch !== undefined ? pitch : (pitchEl ? parseFloat(pitchEl.value) || 0.0 : 0.0);
  return fetchVoicevoxBuffer(text, spk, spd, ptc);
};

async function playNextVoicevox() {
  if (voicevoxAudioQueue.length === 0) {
    isVoicevoxPlaying = false;
    currentPlayingDisplayText = "";
    hideSubtitles();
    if (typeof resetIdleTimer === "function") resetIdleTimer();
    return;
  }

  const item = voicevoxAudioQueue.shift();
  // console.log("[DEBUG 最終キュー確認] displayText:", item.displayText, "/ original:", item.original);

  isVoicevoxPlaying = true;
  currentPlayingIsIdle = false;

  // 1. 表示用（字幕・原稿ログ）は常に item.displayText を死守する
  let displayString = typeof item === "object" && item !== null ? (item.displayText || item.original || String(item)) : String(item);

  // 2. 音声合成用（読み）は item.original を基本にする
  let speakString = typeof item === "object" && item !== null ? (item.original || item.displayText || String(item)) : String(item);

  // 実質文字（日本語・英数字）が一切含まれていない記号のみの空行（"。" や " " 等）は安全にスキップ
  if (!/[\u4E00-\u9FFFぁ-んァ-ヶーA-Za-z0-9]/.test(displayString) && !/[\u4E00-\u9FFFぁ-んァ-ヶーA-Za-z0-9]/.test(speakString)) {
    isVoicevoxPlaying = false;
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
    if (!arrayBuffer) throw new Error("Empty audio buffer");

    const ctx = getVoicevoxAudioContext();
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      await ctx.resume().catch((e) => console.warn("[VOICEVOX] Resume error:", e));
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    currentVoicevoxSource = ctx.createBufferSource();
    currentVoicevoxSource.buffer = audioBuffer;

    if (!window.voicevoxAnalyser) {
      window.voicevoxAnalyser = ctx.createAnalyser();
      window.voicevoxAnalyser.fftSize = 256;
    }
    const volSlider = document.getElementById("voicevox-volume-slider");
    const savedVol = localStorage.getItem("savedVoicevoxVolume");
    const targetVol = volSlider ? (parseFloat(volSlider.value) / 100.0) : (savedVol ? (parseFloat(savedVol) / 100.0) : 1.0);

    if (!window.voicevoxGainNode) {
      window.voicevoxGainNode = ctx.createGain();
      window.voicevoxGainNode.gain.setValueAtTime(targetVol, ctx.currentTime);
      window.voicevoxGainNode.connect(window.voicevoxAnalyser);
      window.voicevoxAnalyser.connect(ctx.destination);
    } else {
      window.voicevoxGainNode.gain.cancelScheduledValues(ctx.currentTime);
      window.voicevoxGainNode.gain.setValueAtTime(targetVol, ctx.currentTime);
    }

    currentVoicevoxSource.connect(window.voicevoxGainNode);

    currentVoicevoxSource.onended = () => {
      if (currentVoicevoxSource) currentVoicevoxSource.disconnect();
      currentVoicevoxSource = null;
      isVoicevoxPlaying = false;

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
        playNextVoicevox();
      }
    };
    currentVoicevoxSource.start(0);
  } catch (e) {
    console.error("VOICEVOX Error:", e);
    currentPlayingDisplayText = "";
    hideSubtitles();
    playNextVoicevox();
  }
}

window.playNextVoicevox = playNextVoicevox;
async function queueVoicevoxAudio(
  text,
  isIdle = false,
  preConvertedYomi = null,
) {
  if (!text || !text.trim()) return;
  // 単独の「ニュース」「？」などの無意味なゴミ単語・記号のみの行を完全遮断
  const trimmed = text.trim();
  if (/^(ニュース|主要ニュース|トピックス|[？!！\?。、\-–—…\s　]+)$/.test(trimmed)) {
    return;
  }

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

  // クリーンアップ関数
  const cleanYomi = (t) => {
    // 「行う（おこなう）」の文脈誤読防止ルール
    t = t.replace(/([をがにでもはと])行([っいうわえな])/g, "$1おこな$2");
    t = t.replace(/(活動|調査|支援|開発|実験|作業|対応|対策|工事|手続き|点検|研修|指導|投票|開票|審査|試験|発表|配信|運営|管理|処理|実行|実施|施行|開催|避難|提供|販売|製造|修理|変更|修正|開始|終了|停止|中止|延期|再開)行([っいうわえな])/g, "$1おこな$2");
    t = t.replace(/行わ([れせないずぬてたまば])/g, "おこなわ$1");
    t = t.replace(/行い([まてた])/g, "おこない$1");
    t = t.replace(/行う([こともの予定方針見込みよう際時ためとがのからに。！？、]|$)/g, "おこなう$1");
    t = t.replace(/だなにゃ([！!？?。、\s　]|$)/g, "だにゃ$1");
    t = t.replace(/だなのだ([！!？?。、\s　]|$)/g, "なのだ$1");
    t = t.replace(/だねにゃ([！!？?。、\s　]|$)/g, "ですね$1");
    t = t.replace(/だねのだ([！!？?。、\s　]|$)/g, "なのだ$1");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:とろろ|トロロ)にゃ[、,\s　]*/g, "とろろとしては、");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:とろろ|トロロ)はにゃ[、,\s　]*/g, "とろろとしては、");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:ずんだもん|ズンダモン)(?:なのだ|のだ)[、,\s　]*/g, "ずんだもんとしては、");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:ずんだもん|ズンダモン)は(?:なのだ|のだ)[、,\s　]*/g, "ずんだもんとしては、");
    let pt = t.replace(/[ 　]+/g, "");
    pt = pt.replace(/、+/g, "、");
    pt = pt.replace(/[\u4E00-\u9FFF々ヶ〆〇0-9a-zA-Z]+[（\(]([ぁ-んァ-ヶー]+)[）\)]/g, "$1");
    pt = pt.replace(/[（\(][^）\)]*[）\)]/g, "");
    if (typeof aiFeatures !== "undefined" && typeof aiFeatures.applyCustomHiraganaDict === "function") {
      pt = aiFeatures.applyCustomHiraganaDict(pt);
    }
    return pt;
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
    // キュー投入直後の非同期音声生成・再生開始ラグを考慮して最低300ms待機してから判定
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
        if (queueEmpty && notPlaying) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    }, 350);
  });
}

// 1文を直接VOICEVOX合成して再生し、再生完了（onended）まで確実に待機する関数
async function playVoicevoxDirectAndWait(displayText, speakText = null) {
  if (!displayText || !displayText.trim()) return;
  if (/^(ニュース|主要ニュース|トピックス|[？!！\?。、\-–—…\s　]+)$/.test(displayText.trim())) return;
  const rawSpeak = speakText || displayText;
  
  const cleanYomi = (t) => {
    // 「行う（おこなう）」の文脈誤読防止ルール
    t = t.replace(/([をがにでもはと])行([っいうわえな])/g, "$1おこな$2");
    t = t.replace(/(活動|調査|支援|開発|実験|作業|対応|対策|工事|手続き|点検|研修|指導|投票|開票|審査|試験|発表|配信|運営|管理|処理|実行|実施|施行|開催|避難|提供|販売|製造|修理|変更|修正|開始|終了|停止|中止|延期|再開)行([っいうわえな])/g, "$1おこな$2");
    t = t.replace(/行わ([れせないずぬてたまば])/g, "おこなわ$1");
    t = t.replace(/行い([まてた])/g, "おこない$1");
    t = t.replace(/行う([こともの予定方針見込みよう際時ためとがのからに。！？、]|$)/g, "おこなう$1");
    t = t.replace(/だなにゃ([！!？?。、\s　]|$)/g, "だにゃ$1");
    t = t.replace(/だなのだ([！!？?。、\s　]|$)/g, "なのだ$1");
    t = t.replace(/だねにゃ([！!？?。、\s　]|$)/g, "ですね$1");
    t = t.replace(/だねのだ([！!？?。、\s　]|$)/g, "なのだ$1");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:とろろ|トロロ)にゃ[、,\s　]*/g, "とろろとしては、");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:とろろ|トロロ)はにゃ[、,\s　]*/g, "とろろとしては、");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:ずんだもん|ズンダモン)(?:なのだ|のだ)[、,\s　]*/g, "ずんだもんとしては、");
    t = t.replace(/(?:^|(?<=[。！？\s]))(?:ずんだもん|ズンダモン)は(?:なのだ|のだ)[、,\s　]*/g, "ずんだもんとしては、");
    let pt = t.replace(/[ 　]+/g, "");
    pt = pt.replace(/、+/g, "、");
    pt = pt.replace(/[\u4E00-\u9FFF々ヶ〆〇0-9a-zA-Z]+[（\(]([ぁ-んァ-ヶー]+)[）\)]/g, "$1");
    pt = pt.replace(/[（\(][^）\)]*[）\)]/g, "");
    if (typeof aiFeatures !== "undefined" && typeof aiFeatures.applyCustomHiraganaDict === "function") {
      pt = aiFeatures.applyCustomHiraganaDict(pt);
    }
    return pt;
  };
  
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
      const volSlider = document.getElementById("voicevox-volume-slider");
      const savedVol = localStorage.getItem("savedVoicevoxVolume");
      const targetVol = volSlider ? (parseFloat(volSlider.value) / 100.0) : (savedVol ? (parseFloat(savedVol) / 100.0) : 1.0);

      if (!window.voicevoxGainNode) {
        window.voicevoxGainNode = ctx.createGain();
        window.voicevoxGainNode.gain.setValueAtTime(targetVol, ctx.currentTime);
        window.voicevoxGainNode.connect(window.voicevoxAnalyser);
        window.voicevoxAnalyser.connect(ctx.destination);
      } else {
        window.voicevoxGainNode.gain.cancelScheduledValues(ctx.currentTime);
        window.voicevoxGainNode.gain.setValueAtTime(targetVol, ctx.currentTime);
      }

      currentVoicevoxSource.connect(window.voicevoxGainNode);

      currentVoicevoxSource.onended = () => {
        if (currentVoicevoxSource) currentVoicevoxSource.disconnect();
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
