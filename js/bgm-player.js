// BGM制御 (IndexedDB 記憶対応)
// =====================================================================
function getBgmAudioContext() {
  if (typeof window.getVoicevoxAudioContext === "function") {
    window.bgmAudioContext = window.getVoicevoxAudioContext();
    return window.bgmAudioContext;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!window.bgmAudioContext || window.bgmAudioContext.state === "closed") {
    window.bgmAudioContext = new AudioCtx({ sampleRate: 48000 });
  }
  return window.bgmAudioContext;
}
window.getBgmAudioContext = getBgmAudioContext;

function safeDecodeAudioData(audioCtx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const promise = audioCtx.decodeAudioData(
        arrayBuffer,
        (decodedData) => resolve(decodedData),
        (e) => reject(e),
      );
      if (promise && typeof promise.catch === "function") {
        promise.catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

const DB_NAME = "Live2DBGMDB";
const STORE_NAME = "bgmStore";

function initBgmDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveBgmToDB(arrayBuffer, fileName) {
  try {
    const db = await initBgmDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ buffer: arrayBuffer, name: fileName }, "currentBGM");
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error("BGM Save Error:", e);
  }
}

async function loadBgmFromDB() {
  try {
    const db = await initBgmDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get("currentBGM");
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(req.error);
    });
  } catch (e) {
    console.error("BGM Load Error:", e);
    return null;
  }
}
// =====================================================================
window.bgmUpload = null;
window.bgmFileName = null;
window.bgmPlayBtn = null;
window.bgmStopBtn = null;
window.bgmVolumeSlider = null;
window.bgmVolumeVal = null;
window.bgmLoopStart = null;
window.bgmLoopEnd = null;
window.bgmWaveformContainer = null;
window.bgmWaveformCanvas = null;
window.bgmLoopHighlight = null;
window.bgmHandleStart = null;
window.bgmHandleEnd = null;

let bgmViewZoom = 1.0;
let bgmViewOffset = 0.0; // 表示開始位置（秒）

function drawBgmWaveform(buffer) {
  if (!bgmWaveformContainer || !bgmWaveformCanvas) return;
  bgmWaveformContainer.style.display = "block";

  // Canvasのリサイズ (CSSのサイズに合わせる)
  const rect = bgmWaveformContainer.getBoundingClientRect();
  bgmWaveformCanvas.width = rect.width > 0 ? rect.width : 280;
  bgmWaveformCanvas.height = rect.height > 0 ? rect.height : 60;

  const ctx = bgmWaveformCanvas.getContext("2d");
  const data = buffer.getChannelData(0); // Lチャンネル
  const dur = buffer.duration;

  // 表示範囲の計算
  let visibleDuration = dur / bgmViewZoom;
  if (bgmViewOffset < 0) bgmViewOffset = 0;
  if (bgmViewOffset + visibleDuration > dur)
    bgmViewOffset = dur - visibleDuration;
  if (bgmViewOffset < 0) bgmViewOffset = 0; // fallback if zoom < 1 (should not happen)

  const startSample = Math.floor((bgmViewOffset / dur) * data.length);
  const endSample = Math.min(
    data.length,
    Math.floor(((bgmViewOffset + visibleDuration) / dur) * data.length),
  );
  const samplesToDraw = endSample - startSample;

  const step = Math.max(1, Math.ceil(samplesToDraw / bgmWaveformCanvas.width));
  const amp = bgmWaveformCanvas.height / 2;

  ctx.fillStyle = "#00f3ff";
  ctx.clearRect(0, 0, bgmWaveformCanvas.width, bgmWaveformCanvas.height);

  for (let i = 0; i < bgmWaveformCanvas.width; i++) {
    let min = 1.0,
      max = -1.0;
    const dataOffset = startSample + i * step;
    if (dataOffset >= data.length) break;

    for (let j = 0; j < step; j++) {
      if (dataOffset + j >= data.length) break;
      const datum = data[dataOffset + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
  }
  updateHighlightUI();
}

function updateHighlightUI() {
  if (
    !window.bgmBuffer ||
    !bgmLoopHighlight ||
    !bgmWaveformContainer ||
    !bgmHandleStart ||
    !bgmHandleEnd
  )
    return;
  const dur = window.bgmBuffer.duration;
  const visibleDuration = dur / bgmViewZoom;

  let startVal = parseFloat(bgmLoopStart.value);
  let endVal = parseFloat(bgmLoopEnd.value);
  if (isNaN(startVal) || startVal < 0) startVal = 0;
  if (isNaN(endVal) || endVal <= 0 || endVal > dur) endVal = dur;
  if (startVal > endVal) startVal = endVal;

  // 表示範囲に対する相対的なパーセンテージを計算
  const startPct = ((startVal - bgmViewOffset) / visibleDuration) * 100;
  const endPct = ((endVal - bgmViewOffset) / visibleDuration) * 100;

  // クリップ処理
  const displayStartPct = Math.max(0, Math.min(100, startPct));
  const displayEndPct = Math.max(0, Math.min(100, endPct));

  if (
    displayStartPct < 100 &&
    displayEndPct > 0 &&
    displayStartPct < displayEndPct
  ) {
    bgmLoopHighlight.style.display = "block";
    bgmLoopHighlight.style.left = displayStartPct + "%";
    bgmLoopHighlight.style.width = displayEndPct - displayStartPct + "%";
  } else {
    bgmLoopHighlight.style.display = "none";
  }

  // ハンドルの表示・非表示と位置調整
  if (startPct >= 0 && startPct <= 100) {
    bgmHandleStart.style.display = "block";
    bgmHandleStart.style.left = startPct + "%";
  } else {
    bgmHandleStart.style.display = "none";
  }

  if (endPct >= 0 && endPct <= 100) {
    bgmHandleEnd.style.display = "block";
    bgmHandleEnd.style.left = endPct + "%";
  } else {
    bgmHandleEnd.style.display = "none";
  }
}


// グローバルのunlockAudioで処理するため、個別のイベントリスナーは削除します。

// ループ区間の取得ヘルパー
function getBgmLoopRange() {
  const startEl = document.getElementById("bgm-loop-start");
  const endEl = document.getElementById("bgm-loop-end");
  let sVal = startEl ? parseFloat(startEl.value) : NaN;
  let eVal = endEl ? parseFloat(endEl.value) : NaN;
  if (isNaN(sVal)) {
    const savedS = localStorage.getItem("savedBgmLoopStart");
    sVal = savedS !== null && savedS !== "" ? parseFloat(savedS) : 0;
  }
  if (isNaN(eVal)) {
    const savedE = localStorage.getItem("savedBgmLoopEnd");
    eVal = savedE !== null && savedE !== "" ? parseFloat(savedE) : 0;
  }
  if (isNaN(sVal) || sVal < 0) sVal = 0;
  if (isNaN(eVal) || eVal <= sVal) eVal = 0;
  return { start: sVal, end: eVal };
}

window.stopBgm = function stopBgm() {
  if (window._bgmLoopWatcherId) {
    cancelAnimationFrame(window._bgmLoopWatcherId);
    window._bgmLoopWatcherId = null;
  }
  if (window.currentBgmAudioEl) {
    try {
      window.currentBgmAudioEl.pause();
      window.currentBgmAudioEl.currentTime = 0;
    } catch(e){}
    window.currentBgmAudioEl = null;
  }
  if (window.currentBgmBlobUrl) {
    try { URL.revokeObjectURL(window.currentBgmBlobUrl); } catch(e){}
    window.currentBgmBlobUrl = null;
  }
  if (window.bgmSource) {
    try {
      window.bgmSource.stop();
    } catch (e) {}
    try {
      window.bgmSource.disconnect();
    } catch (e) {}
    window.bgmSource = null;
  }
  window.bgmIsPlaying = false;
  console.log("[BGM] 停止しました");
};

// スムーズなフェードアウト停止 (デフォルト 1.8秒)
window.fadeOutBgm = function (durationMs = 1800) {
  return new Promise((resolve) => {
    if (!window.bgmIsPlaying) {
      window.stopBgm();
      return resolve();
    }
    const audioEl = window.currentBgmAudioEl;
    if (audioEl) {
      const initialVol = audioEl.volume;
      const steps = 20;
      const stepInterval = Math.max(10, Math.floor(durationMs / steps));
      let currentStep = 0;
      const fadeTimer = setInterval(() => {
        currentStep++;
        const factor = 1.0 - (currentStep / steps);
        audioEl.volume = Math.max(0.0001, initialVol * factor);
        if (currentStep >= steps) {
          clearInterval(fadeTimer);
          window.stopBgm();
          resolve();
        }
      }, stepInterval);
    } else {
      window.stopBgm();
      resolve();
    }
  });
};

// スムーズなフェードイン再生 (デフォルト 2.0秒)
window.fadeInBgm = async function (durationMs = 2000) {
  if (!window.bgmBuffer && !window.bgmRawArrayBuffer) return;
  const volSlider = document.getElementById("bgm-volume-slider");
  const parsedVol = volSlider ? parseFloat(volSlider.value) : 50;
  const targetVol = (isNaN(parsedVol) ? 50 : parsedVol) / 100.0;

  window.stopBgm();

  const loopRange = getBgmLoopRange();

  // 🍏 HTML5 Audio パイプライン（WebKit CoreAudio HAL休止・無音化の完全対策）
  if (window.bgmRawArrayBuffer) {
    try {
      const blob = new Blob([window.bgmRawArrayBuffer], { type: "audio/mp3" });
      const blobUrl = URL.createObjectURL(blob);
      const audioEl = new Audio(blobUrl);
      audioEl.loop = false; // 自前で正確な loopStart / loopEnd 区間制御
      audioEl.volume = 0.0001;

      // 開始位置を loopStart に同期
      if (loopRange.start > 0) {
        audioEl.currentTime = loopRange.start;
      }

      // ループ区間監視 (requestAnimationFrameでフレーム単位で監視)
      const checkLoop = () => {
        if (!window.bgmIsPlaying || window.currentBgmAudioEl !== audioEl) return;
        const curLoop = getBgmLoopRange();
        if (curLoop.end > 0 && curLoop.end > curLoop.start) {
          if (audioEl.currentTime >= curLoop.end) {
            audioEl.currentTime = curLoop.start;
          }
        }
        window._bgmLoopWatcherId = requestAnimationFrame(checkLoop);
      };
      window._bgmLoopWatcherId = requestAnimationFrame(checkLoop);

      // ファイル終端に到達した場合のループ処理
      audioEl.onended = () => {
        if (!window.bgmIsPlaying || window.currentBgmAudioEl !== audioEl) return;
        const curLoop = getBgmLoopRange();
        audioEl.currentTime = curLoop.start;
        audioEl.play().catch((e) => console.warn("[BGM loop replay error]:", e));
      };

      // フェードイン処理
      const steps = 20;
      const stepInterval = Math.max(10, Math.floor(durationMs / steps));
      let currentStep = 0;
      const fadeTimer = setInterval(() => {
        currentStep++;
        const factor = currentStep / steps;
        audioEl.volume = Math.min(1.0, Math.max(0.0001, targetVol * factor));
        if (currentStep >= steps) {
          clearInterval(fadeTimer);
          audioEl.volume = Math.min(1.0, Math.max(0.0, targetVol));
        }
      }, stepInterval);

      audioEl.play().catch(e => console.warn("[BGM HTML5 Audio play error]:", e));
      window.currentBgmAudioEl = audioEl;
      window.currentBgmBlobUrl = blobUrl;
    } catch (e) {
      console.warn("[BGM HTML5 Audio init error]:", e);
    }
  }

  // Web Audio アナライザー（メーター・波形表示用）も並行駆動
  const ctx = getBgmAudioContext();
  if (ctx) {
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      try { await ctx.resume(); } catch(e){}
    }
    if (!window.bgmAnalyser) {
      window.bgmAnalyser = ctx.createAnalyser();
      window.bgmAnalyser.fftSize = 256;
    }
    if (window.bgmBuffer) {
      try {
        window.bgmSource = ctx.createBufferSource();
        window.bgmSource.buffer = window.bgmBuffer;
        window.bgmSource.loop = true;
        if (loopRange.start >= 0) {
          window.bgmSource.loopStart = loopRange.start;
        }
        if (loopRange.end > 0 && loopRange.end > loopRange.start) {
          window.bgmSource.loopEnd = loopRange.end;
        }
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(targetVol, ctx.currentTime);
        window.bgmSource.connect(gainNode);
        gainNode.connect(window.bgmAnalyser);
        // HTML5 Audio未初期化時のみ destination へフォールバック接続
        if (!window.currentBgmAudioEl) {
          gainNode.connect(ctx.destination);
        }
        window.bgmSource.start(0);
      } catch(e) {}
    }
  }

  window.bgmIsPlaying = true;
  console.log(`[BGM] フェードイン再生開始 (目標音量: ${targetVol}, 時間: ${durationMs}ms, ループ: ${loopRange.start}s - ${loopRange.end > 0 ? loopRange.end + 's' : '末尾'})`);
};

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("bgm-player", () => {
  window.bgmUpload = document.getElementById("bgm-upload");
  window.bgmFileName = document.getElementById("bgm-file-name");
  window.bgmPlayBtn = document.getElementById("bgm-play-btn");
  window.bgmStopBtn = document.getElementById("bgm-stop-btn");
  window.bgmVolumeSlider = document.getElementById("bgm-volume-slider");
  window.bgmVolumeVal = document.getElementById("bgm-volume-val");
  window.bgmLoopStart = document.getElementById("bgm-loop-start");
  window.bgmLoopEnd = document.getElementById("bgm-loop-end");
  window.bgmWaveformContainer = document.getElementById(
    "bgm-waveform-container",
  );
  window.bgmWaveformCanvas = document.getElementById("bgm-waveform-canvas");
  window.bgmLoopHighlight = document.getElementById("bgm-loop-highlight");
  window.bgmHandleStart = document.getElementById("bgm-handle-start");
  window.bgmHandleEnd = document.getElementById("bgm-handle-end");

  if (window.bgmUpload) {
    window.bgmUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (window.bgmFileName) window.bgmFileName.textContent = file.name;

      const bgmCtx = getBgmAudioContext();
      if (bgmCtx.state === "suspended" || bgmCtx.state === "interrupted") {
        await bgmCtx.resume().catch(() => {});
      }

      const arrayBuffer = await file.arrayBuffer();
      try {
        window.bgmBuffer = await safeDecodeAudioData(
          bgmCtx,
          arrayBuffer,
        );
        console.log(
          `[BGM] 読み込み完了: ${file.name} (長さ: ${window.bgmBuffer.duration.toFixed(2)}秒)`,
        );
        if (window.bgmPlayBtn) window.bgmPlayBtn.disabled = false;
        if (window.bgmStopBtn) window.bgmStopBtn.disabled = false;

        drawBgmWaveform(window.bgmBuffer);

        // 再度 arrayBuffer を取得して保存
        const arrayBufferToSave = await file.arrayBuffer();
        window.bgmRawArrayBuffer = arrayBufferToSave;
        await saveBgmToDB(arrayBufferToSave, file.name);
        console.log(`[BGM] IndexedDBに保存しました`);
        
        // 値をクリアして次回同じファイルを選べるようにする
        e.target.value = "";
      } catch (error) {
        console.error("BGM decode error:", error);
        if (window.bgmFileName) window.bgmFileName.textContent = "読み込みエラー";
      }
    });
  }

  // Load saved settings
  if (bgmVolumeSlider) {
    const savedVol = localStorage.getItem("savedBgmVolume");
    if (savedVol !== null) {
      bgmVolumeSlider.value = savedVol;
      if (bgmVolumeVal)
        bgmVolumeVal.textContent = Math.round(parseFloat(savedVol));
    }
  }
  if (bgmLoopStart) {
    const savedStart = localStorage.getItem("savedBgmLoopStart");
    if (savedStart !== null) bgmLoopStart.value = savedStart;
  }
  if (bgmLoopEnd) {
    const savedEnd = localStorage.getItem("savedBgmLoopEnd");
    if (savedEnd !== null) bgmLoopEnd.value = savedEnd;
  }

  // 初期ロード時にDBからBGMを復元
  (async () => {
    if (window.__bgmRestoredFromDB || window.bgmBuffer) {
      if (window.bgmBuffer && bgmPlayBtn && bgmStopBtn) {
        bgmPlayBtn.disabled = false;
        bgmStopBtn.disabled = false;
      }
      return;
    }
    window.__bgmRestoredFromDB = true;
    const savedBGM = await loadBgmFromDB();
    if (savedBGM && savedBGM.buffer) {
      window.bgmRawArrayBuffer = savedBGM.buffer;
      const bgmCtx = getBgmAudioContext();
      try {
        if (bgmFileName) bgmFileName.textContent = savedBGM.name;
        window.bgmBuffer = await safeDecodeAudioData(
          bgmCtx,
          savedBGM.buffer,
        );
        console.log(
          `[BGM] DBから復元完了: ${savedBGM.name} (長さ: ${window.bgmBuffer.duration.toFixed(2)}秒)`,
        );
        if (bgmPlayBtn) bgmPlayBtn.disabled = false;
        if (bgmStopBtn) bgmStopBtn.disabled = false;
        drawBgmWaveform(window.bgmBuffer);

        // 準備ができたら自動再生を試みる
        if (bgmPlayBtn && !window.bgmIsPlaying) {
          setTimeout(() => {
            if (!window.bgmIsPlaying) bgmPlayBtn.click();
          }, 100);
        }
      } catch (error) {
        console.error("BGM decode error on restore:", error);
        if (bgmFileName) bgmFileName.textContent = "復元エラー";
      }
    }
  })();

  if (bgmPlayBtn) {
    bgmPlayBtn.onclick = async () => {
      console.log("[BGM] Play button clicked (Fade In)!");
      if (!window.bgmBuffer || !window.bgmAudioContext) {
        console.warn("[BGM] バッファがないかAudioContextが初期化されていません");
        return;
      }
      fadeInBgm(1500);
    };
  }

  if (bgmStopBtn) {
    bgmStopBtn.onclick = () => {
      console.log("[BGM] Stop button clicked (Fade Out)!");
      fadeOutBgm(1500);
    };
  }

  if (bgmVolumeSlider) {
    bgmVolumeSlider.oninput = () => {
      const vol = parseFloat(bgmVolumeSlider.value);
      if (bgmVolumeVal) bgmVolumeVal.textContent = Math.round(vol);
      localStorage.setItem("savedBgmVolume", vol);
      if (window.bgmGainNode) {
        window.bgmGainNode.gain.value = vol / 100.0;
      }
      if (window.currentBgmAudioEl) {
        window.currentBgmAudioEl.volume = Math.min(1.0, Math.max(0.0, vol / 100.0));
      }
    };
  }

  const updateLoopPoints = () => {
    const startVal = parseFloat(bgmLoopStart.value);
    const endVal = parseFloat(bgmLoopEnd.value);

    localStorage.setItem("savedBgmLoopStart", isNaN(startVal) ? "" : startVal);
    localStorage.setItem("savedBgmLoopEnd", isNaN(endVal) ? "" : endVal);

    updateHighlightUI();

    if (window.bgmSource && bgmIsPlaying) {
      if (!isNaN(startVal) && startVal >= 0) {
        window.bgmSource.loopStart = startVal;
      } else {
        window.bgmSource.loopStart = 0;
      }
      if (!isNaN(endVal) && endVal > 0 && endVal <= (window.bgmBuffer ? window.bgmBuffer.duration : Infinity)) {
        window.bgmSource.loopEnd = endVal;
      } else if (window.bgmBuffer) {
        window.bgmSource.loopEnd = window.bgmBuffer.duration;
      }
    }

    // 再生中の HTML5 Audio の現在位置が endVal を超えていたら startVal に戻す
    if (window.currentBgmAudioEl && bgmIsPlaying) {
      const s = isNaN(startVal) ? 0 : startVal;
      const e = isNaN(endVal) ? 0 : endVal;
      if (e > 0 && window.currentBgmAudioEl.currentTime >= e) {
        window.currentBgmAudioEl.currentTime = Math.max(0, s);
      }
    }
  };

  if (bgmLoopStart) {
    bgmLoopStart.addEventListener("change", updateLoopPoints);
    bgmLoopStart.addEventListener("input", updateLoopPoints);
  }
  if (bgmLoopEnd) {
    bgmLoopEnd.addEventListener("change", updateLoopPoints);
    bgmLoopEnd.addEventListener("input", updateLoopPoints);
  }

  // キャンバス上のマウスドラッグによる範囲選択・ハンドルのドラッグ・ズーム・パン
  if (bgmWaveformContainer) {
    // ズーム・パン処理
    bgmWaveformContainer.addEventListener(
      "wheel",
      (e) => {
        if (!window.bgmBuffer) return;
        e.preventDefault();

        const dur = window.bgmBuffer.duration;
        const rect = bgmWaveformContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseTimeRatio = mouseX / rect.width;

        // 現在のマウス位置が指している時間を計算
        const visibleDuration = dur / bgmViewZoom;
        const mouseTime = bgmViewOffset + mouseTimeRatio * visibleDuration;

        // 縦スクロールでズーム
        if (e.deltaY !== 0) {
          const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
          bgmViewZoom = Math.max(1.0, bgmViewZoom * zoomFactor);

          // ズーム後の新しい表示範囲を計算し、マウス位置の時間をキープする
          const newVisibleDuration = dur / bgmViewZoom;
          bgmViewOffset = mouseTime - mouseTimeRatio * newVisibleDuration;
        }

        // 横スクロールでパン
        if (e.deltaX !== 0) {
          const panFactor = e.deltaX * 0.005; // 適当な感度
          bgmViewOffset += visibleDuration * panFactor;
        }

        drawBgmWaveform(window.bgmBuffer);
      },
      { passive: false },
    );

    let isDraggingWaveform = false;
    let draggingHandle = null; // 'start', 'end', or null
    let dragStartX = 0;
    let dragStartOffset = 0;
    let dragStartVal = 0;
    let dragEndVal = 0;

    const getTimeFromX = (x, rect) => {
      const ratio = Math.max(0, Math.min(x / rect.width, 1));
      const visibleDuration = window.bgmBuffer.duration / bgmViewZoom;
      return bgmViewOffset + ratio * visibleDuration;
    };

    const updateRangeFromMouse = (e, isStart) => {
      if (!window.bgmBuffer) return;
      const rect = bgmWaveformContainer.getBoundingClientRect();
      let x = e.clientX - rect.left;
      const time = getTimeFromX(x, rect);

      if (draggingHandle === "start") {
        const endV = parseFloat(bgmLoopEnd.value) || window.bgmBuffer.duration;
        bgmLoopStart.value = Math.min(time, endV - 0.01).toFixed(3);
      } else if (draggingHandle === "end") {
        const startV = parseFloat(bgmLoopStart.value) || 0;
        bgmLoopEnd.value = Math.max(time, startV + 0.01).toFixed(3);
      } else {
        // 新規選択
        if (isStart) {
          dragStartX = x;
          bgmLoopStart.value = time.toFixed(3);
          bgmLoopEnd.value = "";
        } else {
          const time1 = getTimeFromX(dragStartX, rect);
          const time2 = time;
          bgmLoopStart.value = Math.min(time1, time2).toFixed(3);
          bgmLoopEnd.value = Math.max(time1, time2).toFixed(3);
        }
      }
      updateLoopPoints();
    };

    bgmWaveformContainer.addEventListener("mousedown", (e) => {
      if (!window.bgmBuffer) return;
      isDraggingWaveform = true;

      if (e.target === bgmHandleStart) {
        draggingHandle = "start";
      } else if (e.target === bgmHandleEnd) {
        draggingHandle = "end";
      } else {
        draggingHandle = null;
        updateRangeFromMouse(e, true);
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDraggingWaveform) return;
      updateRangeFromMouse(e, false);
    });
    window.addEventListener("mouseup", () => {
      if (isDraggingWaveform) {
        isDraggingWaveform = false;
        draggingHandle = null;
      }
    });
  }
});
