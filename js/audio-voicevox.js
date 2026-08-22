let currentPlayingDisplayText = "";

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

async function playNextVoicevox() {
  if (voicevoxAudioQueue.length === 0) {
    isVoicevoxPlaying = false;
    currentPlayingDisplayText = "";
    hideSubtitles();
    if (typeof resetIdleTimer === "function") resetIdleTimer();
    return;
  }
  isVoicevoxPlaying = true;
  const item = voicevoxAudioQueue.shift();

  let text = item;
  let rawDisplayText = typeof item === "object" && item !== null ? item.displayText || item.original : item;
  currentPlayingIsIdle = false;

  if (typeof item === "object" && item !== null && item.promise) {
    currentPlayingIsIdle = item.isIdle || false;
    try {
      text = await item.promise;
    } catch (e) {
      text = item.original;
    }
  }
  const speakerId = voicevoxSpeakerId ? voicevoxSpeakerId.value : "3";

  try {
    let arrayBuffer;
    try {
      // 1. Python バックエンド経由で辞書適用＆音声合成
      const synthRes = await fetch("/api/voicevox/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          speakerId: parseInt(speakerId, 10) || 3,
          speedScale: 1.0,
          pitchScale: 0.0
        })
      });
      if (synthRes.ok) {
        arrayBuffer = await synthRes.arrayBuffer();
      } else {
        throw new Error("Backend synthesis failed: " + synthRes.statusText);
      }
    } catch (backendErr) {
      console.warn("[VOICEVOX] Backend synthesis fallback to direct call:", backendErr);
      // Fallback: 直接 VOICEVOX (:50021) 呼び出し
      const queryRes = await fetch(
        `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
        { method: "POST" }
      );
      if (!queryRes.ok) throw new Error("Audio query failed");
      const queryJson = await queryRes.json();
      const directSynthRes = await fetch(
        `http://localhost:50021/synthesis?speaker=${speakerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryJson)
        }
      );
      if (!directSynthRes.ok) throw new Error("Direct synthesis failed");
      arrayBuffer = await directSynthRes.arrayBuffer();
    }

    // 3. Play Audio
    if (!voicevoxAudioContext) {
      voicevoxAudioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    if (voicevoxAudioContext.state === "suspended") {
      console.warn(
        "[VOICEVOX] AudioContext is suspended. Please click the page to unmute.",
      );
      voicevoxAudioContext
        .resume()
        .catch((e) => console.error("[VOICEVOX] Resume error:", e));
    }

    const audioBuffer = await voicevoxAudioContext.decodeAudioData(arrayBuffer);
    currentVoicevoxSource = voicevoxAudioContext.createBufferSource();
    currentVoicevoxSource.buffer = audioBuffer;

    if (!voicevoxAnalyser) {
      voicevoxAnalyser = voicevoxAudioContext.createAnalyser();
      voicevoxAnalyser.fftSize = 256;
    }
    const volSlider = document.getElementById("voicevox-volume-slider");
    const savedVol = localStorage.getItem("savedVoicevoxVolume");
    const targetVol = volSlider ? (parseFloat(volSlider.value) / 100.0) : (savedVol ? (parseFloat(savedVol) / 100.0) : 1.0);

    if (!voicevoxGainNode) {
      voicevoxGainNode = voicevoxAudioContext.createGain();
      voicevoxGainNode.gain.setValueAtTime(targetVol, voicevoxAudioContext.currentTime);
      voicevoxGainNode.connect(voicevoxAnalyser);
      voicevoxAnalyser.connect(voicevoxAudioContext.destination);
    } else {
      voicevoxGainNode.gain.cancelScheduledValues(voicevoxAudioContext.currentTime);
      voicevoxGainNode.gain.setValueAtTime(targetVol, voicevoxAudioContext.currentTime);
    }

    currentVoicevoxSource.connect(voicevoxGainNode);

    currentVoicevoxSource.onended = () => {
      if (currentVoicevoxSource) currentVoicevoxSource.disconnect();
      currentVoicevoxSource = null;
      isVoicevoxPlaying = false;

      if (voicevoxAudioQueue.length === 0) {
        hideSubtitles();
      }

      // ラジオモードかつキューが空の場合、短い間隔で次の台本行を読む
      const radioModeToggle = document.getElementById("ai-radio-mode-toggle");
      const isRadioMode = radioModeToggle && radioModeToggle.checked;
      const aiRemakeToggle = document.getElementById("ai-idle-remake-toggle");
      const aiApiKeyInput = document.getElementById("ai-api-key");
      const hasApiKey = aiApiKeyInput && aiApiKeyInput.value.trim();
      const isRadioActive = isRadioMode; // ラジオモードはAI機能に依存しない

      if (
        isRadioActive &&
        radioModeState.currentPhase === "playing" &&
        radioModeState.scriptLines &&
        radioModeState.currentScriptIndex < radioModeState.scriptLines.length &&
        voicevoxAudioQueue.length === 0
      ) {
        // 1〜2秒後に次の行を読む
        setTimeout(() => triggerIdleSpeech(), 1500);
      } else {
        playNextVoicevox();
      }
    };

    if (rawDisplayText && rawDisplayText !== text) {
      console.log(`[原稿] "${rawDisplayText}"`);
    }
    console.log(`[VOICEVOX] Playing: "${text}" (Speaker ID: ${speakerId})`);
    currentPlayingDisplayText = rawDisplayText || text;
    showSubtitles(rawDisplayText);
    currentVoicevoxSource.start(0);
  } catch (e) {
    console.error("VOICEVOX Error:", e);
    currentPlayingDisplayText = "";
    hideSubtitles();
    playNextVoicevox(); // Skip to next
  }
}

window.playNextVoicevox = playNextVoicevox;
async function queueVoicevoxAudio(
  text,
  isIdle = false,
  preConvertedYomi = null,
) {
  if (!text || !text.trim()) return;

  // 1文ずつ（句点・感嘆符・疑問符・改行）に分割する正規表現
  const splitPattern = /(?<=[。！？!?\n])/g;

  // クリーンアップ関数
  const cleanYomi = (t) => {
    let pt = t.replace(/[ 　]+/g, "");
    pt = pt.replace(/、+/g, "、");
    pt = pt.replace(/[\u4E00-\u9FFF々ヶ〆〇0-9a-zA-Z]+[（\(]([ぁ-んァ-ヶー]+)[）\)]/g, "$1");
    pt = pt.replace(/[（\(][^）\)]*[）\)]/g, "");
    if (typeof aiFeatures !== "undefined" && typeof aiFeatures.applyCustomHiraganaDict === "function") {
      pt = aiFeatures.applyCustomHiraganaDict(pt);
    }
    return pt;
  };

  const origSentences = text.split(splitPattern).map(s => s.trim()).filter(s => s.length > 0);

  if (preConvertedYomi) {
    const yomiSentences = preConvertedYomi.split(splitPattern).map(s => s.trim()).filter(s => s.length > 0);

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
      const parts = fullProcessed.split(splitPattern).map(s => s.trim()).filter(s => s.length > 0);
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

// VOICEVOXの再生を即座に完全停止する関数
function stopVoicevoxPlayback() {
  if (typeof voicevoxAudioQueue !== "undefined") {
    voicevoxAudioQueue.length = 0;
  }
  if (currentVoicevoxSource) {
    try {
      currentVoicevoxSource.onended = null;
      currentVoicevoxSource.stop();
    } catch (e) {}
    currentVoicevoxSource = null;
  }
  const audioEl = document.getElementById("voicevox-audio");
  if (audioEl) {
    try {
      audioEl.pause();
      audioEl.currentTime = 0;
    } catch (e) {}
  }
  isVoicevoxPlaying = false;
  if (typeof hideSubtitles === "function") hideSubtitles();
  console.log("[VOICEVOX] 再生キューをクリアし、音声を即時強制停止しました。");
}

window.stopVoicevoxPlayback = stopVoicevoxPlayback;

// VOICEVOXのキューが空になり、再生が終わるまで待つ関数
function waitForVoicevoxFinish() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      // ニュース番組が停止された場合は即座に待機を解除
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
  });
}

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

  document.onmousemove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    subtitlesEl.style.left = `${initLeft + dx}px`;
    subtitlesEl.style.top = `${initTop + dy}px`;
  };

  document.onmouseup = () => {
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
