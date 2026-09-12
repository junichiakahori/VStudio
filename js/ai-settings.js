window.aiHiraganaCache = {};
window.loadHiraganaData = async function () {
  try {
    const res = await fetch("/hiragana_data.json");
    if (res.ok) {
      const data = await res.json();
      if (data.dictionary !== undefined || data.cache !== undefined) {
        aiHiraganaCache = data.cache || {};
        if (aiHiraganaDict && data.dictionary !== undefined) {
          // 「私, わたし」などの危険な単漢字置換行があれば自動的に除去
          let dictText = data.dictionary || "";
          dictText = dictText.split("\n").filter(l => !/^\s*私\s*,\s*(わたし|わたくし)\s*$/i.test(l)).join("\n");
          aiHiraganaDict.value = dictText;
        }
        localStorage.removeItem("aiHiraganaCache");
        return;
      }
    }
  } catch (e) {
    console.warn("Failed to load hiragana_data.json", e);
  }
};
window.saveHiraganaData = async function () {
  const dictionary = aiHiraganaDict ? aiHiraganaDict.value : "";
  const payload = { dictionary: dictionary, cache: aiHiraganaCache };
  try {
    await fetch("/update_hiragana_data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Failed to save hiragana data to server", e);
  }
};
window.renderCacheEditorList = function renderCacheEditorList(filterText = "") {
  if (!cacheEditorTbody) return;
  cacheEditorTbody.innerHTML = "";

  const entries = Object.entries(aiHiraganaCache).reverse();
  for (const [key, value] of entries) {
    if (filterText && !key.includes(filterText) && !value.includes(filterText))
      continue;

    const tr = document.createElement("tr");

    const tdKey = document.createElement("td");
    tdKey.textContent = key;
    tdKey.title = key;
    tdKey.style.overflow = "hidden";
    tdKey.style.textOverflow = "ellipsis";
    tdKey.style.whiteSpace = "nowrap";
    tdKey.style.maxWidth = "200px";

    const tdVal = document.createElement("td");
    const inputVal = document.createElement("input");
    inputVal.type = "text";
    inputVal.value = value;
    inputVal.className = "cache-edit-input";
    tdVal.appendChild(inputVal);

    const tdAction = document.createElement("td");
    tdAction.style.textAlign = "right";
    tdAction.style.whiteSpace = "nowrap";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.style.marginRight = "5px";
    saveBtn.style.padding = "2px 8px";
    saveBtn.style.fontSize = "0.75rem";
    saveBtn.style.background = "var(--primary)";
    saveBtn.style.color = "#000";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "4px";
    saveBtn.style.cursor = "pointer";
    saveBtn.onclick = () => {
      if (inputVal.value.trim() === "") return;
      aiHiraganaCache[key] = inputVal.value.trim();
      saveHiraganaData();
      saveBtn.textContent = "✓";
      setTimeout(() => (saveBtn.textContent = "保存"), 1000);
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.style.padding = "2px 8px";
    delBtn.style.fontSize = "0.75rem";
    delBtn.style.background = "var(--danger, #ff4444)";
    delBtn.style.color = "#fff";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "4px";
    delBtn.style.cursor = "pointer";
    delBtn.onclick = () => {
      if (confirm("このキャッシュを削除しますか？")) {
        delete aiHiraganaCache[key];
        saveHiraganaData();
        renderCacheEditorList(cacheEditorSearch.value);
      }
    };

    tdAction.appendChild(saveBtn);
    tdAction.appendChild(delBtn);

    tr.appendChild(tdKey);
    tr.appendChild(tdVal);
    tr.appendChild(tdAction);
    cacheEditorTbody.appendChild(tr);
  }
};
window.updateAiLink = function updateAiLink() {
  if (!aiApiLink) return;
  const apiKeyContainer = document.getElementById("ai-api-key-container");
  const provider = aiProviderSelect ? aiProviderSelect.value : "gemini";
  if (provider === "ollama") {
    aiApiLink.href = "http://localhost:11434";
    aiApiLink.textContent = "🦙 Ollama (完全無料・APIキー不要・利用枠無制限)";
    aiApiLink.style.color = "#00ff88";
    if (apiKeyContainer) apiKeyContainer.style.display = "none";
  } else if (provider === "openai") {
    aiApiLink.href = "https://platform.openai.com/api-keys";
    aiApiLink.textContent = "▶︎ OpenAI APIキーを取得する";
    aiApiLink.style.color = "#ff6b6b";
    if (apiKeyContainer) apiKeyContainer.style.display = "block";
  } else {
    aiApiLink.href = "https://aistudio.google.com/app/apikey";
    aiApiLink.textContent = "▶︎ Gemini APIキーを取得する";
    aiApiLink.style.color = "#00f3ff";
    if (apiKeyContainer) apiKeyContainer.style.display = "block";
  }
};

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("ai-settings", () => {
  // =====================================================================
  // TikTok & VOICEVOX 連携
  // =====================================================================
  // Populate VOICEVOX speakers
  if (voicevoxSpeakerId) {
    const savedSpeaker = localStorage.getItem("savedVoicevoxSpeaker");

    fetch("http://localhost:50021/speakers")
      .then((res) => res.json())
      .then((speakers) => {
        voicevoxSpeakerId.innerHTML = ""; // clear default
        let foundSaved = false;
        speakers.forEach((speaker) => {
          speaker.styles.forEach((style) => {
            const option = document.createElement("option");
            option.value = style.id;
            option.textContent = `${speaker.name} (${style.name})`;
            if (savedSpeaker && style.id.toString() === savedSpeaker) {
              option.selected = true;
              foundSaved = true;
            } else if (!savedSpeaker && style.id === 3) {
              // Default to Zundamon normal (id 3) if nothing is saved
              option.selected = true;
            }
            voicevoxSpeakerId.appendChild(option);
          });
        });

        // Save whenever it changes
        voicevoxSpeakerId.addEventListener("change", () => {
          localStorage.setItem("savedVoicevoxSpeaker", voicevoxSpeakerId.value);
        });
      })
      .catch((err) => {
        console.warn("Failed to fetch VOICEVOX speakers:", err);
      });
  }
  if (voicevoxToggle) {
    const savedToggle = localStorage.getItem("savedVoicevoxToggle");
    if (savedToggle !== null) {
      voicevoxToggle.checked = savedToggle === "true";
      window.isVoicevoxEnabled = voicevoxToggle.checked;
    }
    voicevoxToggle.addEventListener("change", () => {
      window.isVoicevoxEnabled = voicevoxToggle.checked;
      localStorage.setItem("savedVoicevoxToggle", voicevoxToggle.checked);
    });
  }

  window.idleSpeechToggle = document.getElementById("idle-speech-toggle");
  window.isIdleSpeechEnabled = true;

  if (idleSpeechToggle) {
    const savedIdleToggle = localStorage.getItem("savedIdleSpeechToggle");
    if (savedIdleToggle !== null) {
      idleSpeechToggle.checked = savedIdleToggle === "true";
      window.isIdleSpeechEnabled = idleSpeechToggle.checked;
    }
    idleSpeechToggle.addEventListener("change", () => {
      window.isIdleSpeechEnabled = idleSpeechToggle.checked;
      localStorage.setItem("savedIdleSpeechToggle", idleSpeechToggle.checked);
      if (window.isIdleSpeechEnabled) {
        if (typeof resetIdleTimer === "function") resetIdleTimer();
      } else {
        if (typeof clearIdleTimer === "function") clearIdleTimer();
      }
    });
  }

  // 一人称・二人称の設定保存
  window.idleFirstPersonEl = document.getElementById("idle-first-person");
  window.idleSecondPersonEl = document.getElementById("idle-second-person");
  if (idleFirstPersonEl) {
    const saved = localStorage.getItem("savedIdleFirstPerson");
    if (saved) idleFirstPersonEl.value = saved;
    idleFirstPersonEl.addEventListener("change", () => {
      localStorage.setItem("savedIdleFirstPerson", idleFirstPersonEl.value);
    });
  }
  if (idleSecondPersonEl) {
    const saved = localStorage.getItem("savedIdleSecondPerson");
    if (saved) idleSecondPersonEl.value = saved;
    idleSecondPersonEl.addEventListener("change", () => {
      localStorage.setItem("savedIdleSecondPerson", idleSecondPersonEl.value);
    });
  }

  // AI Settings
  window.aiReplyToggle = document.getElementById("ai-reply-toggle");
  window.aiSettingsPanel = document.getElementById("ai-settings-panel");
  window.aiProviderSelect = document.getElementById("ai-provider-select");
  window.aiApiKeyInput = document.getElementById("ai-api-key");
  window.aiSystemPromptInput = document.getElementById("ai-system-prompt");
  window.aiSearchSelect = document.getElementById("ai-search-select");

  window.isAiReplyEnabled = false;
  window.aiChatHistory = []; // 過去のコンテキスト保持用
  window.isAiGenerating = false;
  window.lastAiRequestTime = 0;

  if (aiReplyToggle) {
    const savedAiToggle = localStorage.getItem("savedAiReplyToggle");
    if (savedAiToggle !== null) {
      aiReplyToggle.checked = savedAiToggle === "true";
      isAiReplyEnabled = aiReplyToggle.checked;
      aiSettingsPanel.style.display = isAiReplyEnabled ? "block" : "none";
    }

    const savedProvider = localStorage.getItem("savedAiProvider");
    if (savedProvider) aiProviderSelect.value = savedProvider;

    const savedApiKey = localStorage.getItem("savedAiApiKey");
    if (savedApiKey) aiApiKeyInput.value = savedApiKey;

    const savedPrompt = localStorage.getItem("savedAiPrompt");
    if (savedPrompt) {
      const oldDefault =
        "あなたは元気で明るい女の子のVTuberです。視聴者からのコメントに対して、タメ口で親しみやすく、一言で短く返答してください。「文字」や「制限」などのAIの設定に関する言葉は絶対に口に出さないでください。";
      const newDefault =
        "あなたは元気で明るい女の子のVTuberです。視聴者からのコメントに対して、タメ口で親しみやすく返答してください。「文字」や「制限」などのAIの設定に関する言葉は絶対に口に出さないでください。\n【重要】もし質問の答えを知らない場合や最新情報が必要な場合は、推測ではぐらかさずに「[search] 調べたいキーワード」だけを返答してください。例: [search] ドル円 現在";
      if (savedPrompt === oldDefault) {
        aiSystemPromptInput.value = newDefault;
        localStorage.setItem("savedAiPrompt", newDefault);
      } else {
        aiSystemPromptInput.value = savedPrompt;
      }
    }

    if (aiSearchSelect) {
      const savedSearchSelect = localStorage.getItem("savedAiSearchSelect");
      if (savedSearchSelect) {
        aiSearchSelect.value = savedSearchSelect;
      } else {
        aiSearchSelect.value = "ddg";
      }
    }

    aiReplyToggle.addEventListener("change", () => {
      isAiReplyEnabled = aiReplyToggle.checked;
      localStorage.setItem("savedAiReplyToggle", aiReplyToggle.checked);
      aiSettingsPanel.style.display = isAiReplyEnabled ? "block" : "none";
    });
  }

  window.aiHiraganaToggle = document.getElementById("ai-hiragana-toggle");
  window.aiHiraganaDictContainer = document.getElementById(
    "ai-hiragana-dict-container",
  );
  window.aiHiraganaDict = document.getElementById("ai-hiragana-dict");
  if (aiHiraganaToggle) {
    const savedAiHiragana = localStorage.getItem("savedAiHiraganaToggle");
    if (savedAiHiragana !== null) {
      aiHiraganaToggle.checked = savedAiHiragana === "true";
    }
    if (aiHiraganaDictContainer) {
      aiHiraganaDictContainer.style.display = aiHiraganaToggle.checked
        ? "flex"
        : "none";
    }
    aiHiraganaToggle.addEventListener("change", () => {
      localStorage.setItem("savedAiHiraganaToggle", aiHiraganaToggle.checked);
      if (aiHiraganaDictContainer) {
        aiHiraganaDictContainer.style.display = aiHiraganaToggle.checked
          ? "flex"
          : "none";
      }
    });
  }
  if (aiHiraganaDict) {
    let saveTimeout;
    aiHiraganaDict.addEventListener("input", () => {
      localStorage.setItem("savedAiHiraganaDict", aiHiraganaDict.value); // keeping localstorage as backup
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveHiraganaData, 1000);
    });
  }

  // Logic moved to ui_features.js

  loadHiraganaData();

  // AI Cache Editor UI Logic
  window.openCacheEditorBtn = document.getElementById("open-cache-editor-btn");
  window.cacheEditorModal = document.getElementById("cache-editor-modal");
  window.cacheEditorCloseBtn = document.getElementById(
    "cache-editor-close-btn",
  );
  window.cacheEditorTbody = document.getElementById("cache-editor-tbody");
  window.cacheEditorSearch = document.getElementById("cache-editor-search");

  window.cacheEditorClearAllBtn = document.getElementById(
    "cache-editor-clear-all-btn",
  );

  if (openCacheEditorBtn && cacheEditorModal) {
    openCacheEditorBtn.addEventListener("click", () => {
      cacheEditorModal.style.display = "flex";
      cacheEditorSearch.value = "";
      renderCacheEditorList();
    });
    cacheEditorCloseBtn.addEventListener("click", () => {
      cacheEditorModal.style.display = "none";
    });
    if (cacheEditorClearAllBtn) {
      cacheEditorClearAllBtn.addEventListener("click", () => {
        if (
          confirm(
            "本当にすべてのAI変換キャッシュを削除しますか？\n（この操作は元に戻せません）",
          )
        ) {
          for (const key in aiHiraganaCache) {
            delete aiHiraganaCache[key];
          }
          saveHiraganaData();
          renderCacheEditorList(cacheEditorSearch.value);
        }
      });
    }
    cacheEditorSearch.addEventListener("input", () => {
      renderCacheEditorList(cacheEditorSearch.value);
    });
  }

  window.aiApiLink = document.getElementById("ai-api-link");

  window.aiModelInput = document.getElementById("ai-model-input");
  const savedModel = localStorage.getItem("savedAiModel");
  if (savedModel && aiModelInput) aiModelInput.value = savedModel;

  window.voicevoxVolumeSlider = document.getElementById(
    "voicevox-volume-slider",
  );
  window.voicevoxVolumeVal = document.getElementById("voicevox-volume-val");
  if (voicevoxVolumeSlider) {
    const savedVol = localStorage.getItem("savedVoicevoxVolume");
    if (savedVol !== null) {
      voicevoxVolumeSlider.value = savedVol;
      if (voicevoxVolumeVal) voicevoxVolumeVal.textContent = savedVol;
    }
    voicevoxVolumeSlider.addEventListener("input", () => {
      const vol = parseFloat(voicevoxVolumeSlider.value);
      if (voicevoxVolumeVal) voicevoxVolumeVal.textContent = Math.round(vol);
      localStorage.setItem("savedVoicevoxVolume", vol);
      if (voicevoxGainNode) {
        voicevoxGainNode.gain.value = vol / 100.0;
      }
      if (window.currentVoicevoxAudioEl) {
        window.currentVoicevoxAudioEl.volume = Math.min(1.0, Math.max(0.0, vol / 100.0));
      }
    });
  }

  // 🛡️ VOICEVOX 音割れ防止リミッター (DynamicsCompressor) UI初期化＆バインド
  const limiterToggle = document.getElementById("voicevox-limiter-toggle");
  const limiterThreshold = document.getElementById("limiter-threshold");
  const limiterThresholdVal = document.getElementById("limiter-threshold-val");
  const limiterRatio = document.getElementById("limiter-ratio");
  const limiterRatioVal = document.getElementById("limiter-ratio-val");
  const limiterGain = document.getElementById("limiter-gain");
  const limiterGainVal = document.getElementById("limiter-gain-val");
  const limiterKnee = document.getElementById("limiter-knee");
  const limiterKneeVal = document.getElementById("limiter-knee-val");
  const limiterAttack = document.getElementById("limiter-attack");
  const limiterAttackVal = document.getElementById("limiter-attack-val");
  const limiterRelease = document.getElementById("limiter-release");
  const limiterReleaseVal = document.getElementById("limiter-release-val");

  const btnPresetSafe = document.getElementById("btn-limiter-preset-safe");
  const btnPresetBroadcast = document.getElementById("btn-limiter-preset-broadcast");
  const btnPresetHard = document.getElementById("btn-limiter-preset-hard");
  const btnLimiterReset = document.getElementById("btn-limiter-reset");

  // 🎛️ リミッタープリセットマスター定義
  const LIMITER_PRESETS = {
    safe: {
      name: "safe",
      label: "🛡️ 標準",
      color: "#00f3ff",
      bgActive: "rgba(0, 243, 255, 0.2)",
      borderColor: "var(--neon-cyan)",
      textColor: "var(--neon-cyan)",
      settings: { enabled: true, threshold: -6, ratio: 20, makeupGain: 1.5, knee: 3, attack: 0.001, release: 0.10 },
    },
    broadcast: {
      name: "broadcast",
      label: "🎙️ 配信",
      color: "#bf5af2",
      bgActive: "rgba(191, 90, 242, 0.25)",
      borderColor: "#bf5af2",
      textColor: "#bf5af2",
      settings: { enabled: true, threshold: -18, ratio: 4, makeupGain: 5.0, knee: 6, attack: 0.005, release: 0.15 },
    },
    hard: {
      name: "hard",
      label: "⚡ 強力",
      color: "#ff9f0a",
      bgActive: "rgba(255, 159, 10, 0.25)",
      borderColor: "#ff9f0a",
      textColor: "#ff9f0a",
      settings: { enabled: true, threshold: -12, ratio: 20, makeupGain: 3.0, knee: 0, attack: 0.001, release: 0.05 },
    },
  };

  function updateLimiterUIFromValues(settings) {
    if (limiterToggle) limiterToggle.checked = settings.enabled !== false;
    if (limiterThreshold) {
      limiterThreshold.value = settings.threshold;
      if (limiterThresholdVal) limiterThresholdVal.textContent = settings.threshold;
    }
    if (limiterRatio) {
      limiterRatio.value = settings.ratio;
      if (limiterRatioVal) limiterRatioVal.textContent = settings.ratio;
    }
    if (limiterGain) {
      limiterGain.value = settings.makeupGain !== undefined ? settings.makeupGain : 1.5;
      if (limiterGainVal) limiterGainVal.textContent = parseFloat(limiterGain.value).toFixed(1);
    }
    if (limiterKnee) {
      limiterKnee.value = settings.knee;
      if (limiterKneeVal) limiterKneeVal.textContent = settings.knee;
    }
    if (limiterAttack) {
      limiterAttack.value = settings.attack;
      if (limiterAttackVal) limiterAttackVal.textContent = Math.round(settings.attack * 1000);
    }
    if (limiterRelease) {
      limiterRelease.value = settings.release;
      if (limiterReleaseVal) limiterReleaseVal.textContent = Math.round(settings.release * 1000);
    }
  }

  function setPresetButtonActive(presetName) {
    const pSafe = LIMITER_PRESETS.safe;
    const pBc = LIMITER_PRESETS.broadcast;
    const pHard = LIMITER_PRESETS.hard;

    const resetBtn = (btn) => {
      if (!btn) return;
      btn.style.background = "rgba(255,255,255,0.05)";
      btn.style.borderColor = "rgba(255,255,255,0.2)";
      btn.style.color = "#ddd";
    };

    const activateBtn = (btn, presetDef) => {
      if (!btn) return;
      btn.style.background = presetDef.bgActive;
      btn.style.borderColor = presetDef.borderColor;
      btn.style.color = presetDef.textColor;
    };

    [btnPresetSafe, btnPresetBroadcast, btnPresetHard].forEach(resetBtn);

    if (presetName === "safe") activateBtn(btnPresetSafe, pSafe);
    else if (presetName === "broadcast") activateBtn(btnPresetBroadcast, pBc);
    else if (presetName === "hard") activateBtn(btnPresetHard, pHard);
  }

  function checkMatchingPreset(th, rt, mk, kn) {
    if (Math.abs(th - (-6)) < 0.5 && Math.abs(rt - 20) < 0.5 && Math.abs(mk - 1.5) < 0.2 && Math.abs(kn - 3) < 0.5) return "safe";
    if (Math.abs(th - (-18)) < 0.5 && Math.abs(rt - 4) < 0.5 && Math.abs(mk - 5.0) < 0.2 && Math.abs(kn - 6) < 0.5) return "broadcast";
    if (Math.abs(th - (-12)) < 0.5 && Math.abs(rt - 20) < 0.5 && Math.abs(mk - 3.0) < 0.2 && Math.abs(kn - 0) < 0.5) return "hard";
    return "custom";
  }

  function saveAndApplyLimiter(checkPreset = true) {
    const settings = {
      enabled: limiterToggle ? limiterToggle.checked : true,
      threshold: limiterThreshold ? parseFloat(limiterThreshold.value) : -6,
      ratio: limiterRatio ? parseFloat(limiterRatio.value) : 20,
      makeupGain: limiterGain ? parseFloat(limiterGain.value) : 1.5,
      knee: limiterKnee ? parseFloat(limiterKnee.value) : 3,
      attack: limiterAttack ? parseFloat(limiterAttack.value) : 0.001,
      release: limiterRelease ? parseFloat(limiterRelease.value) : 0.10,
    };

    localStorage.setItem("voicevoxLimiterEnabled", settings.enabled);
    localStorage.setItem("voicevoxLimiterThreshold", settings.threshold);
    localStorage.setItem("voicevoxLimiterRatio", settings.ratio);
    localStorage.setItem("voicevoxLimiterMakeupGain", settings.makeupGain);
    localStorage.setItem("voicevoxLimiterKnee", settings.knee);
    localStorage.setItem("voicevoxLimiterAttack", settings.attack);
    localStorage.setItem("voicevoxLimiterRelease", settings.release);

    if (checkPreset) {
      const matched = checkMatchingPreset(settings.threshold, settings.ratio, settings.makeupGain, settings.knee);
      localStorage.setItem("voicevoxLimiterPreset", matched);
      setPresetButtonActive(matched === "custom" ? null : matched);
    }

    if (typeof window.updateVoicevoxLimiterSettings === "function") {
      window.updateVoicevoxLimiterSettings(settings);
    }
    drawLimiterGraph();
  }

  function applyPreset(presetName) {
    const preset = LIMITER_PRESETS[presetName] || LIMITER_PRESETS.safe;
    const s = { ...preset.settings };
    if (limiterToggle) {
      s.enabled = limiterToggle.checked;
    }

    // 1. localStorage に確実に保存
    localStorage.setItem("voicevoxLimiterPreset", preset.name);
    localStorage.setItem("voicevoxLimiterEnabled", s.enabled);
    localStorage.setItem("voicevoxLimiterThreshold", s.threshold);
    localStorage.setItem("voicevoxLimiterRatio", s.ratio);
    localStorage.setItem("voicevoxLimiterMakeupGain", s.makeupGain);
    localStorage.setItem("voicevoxLimiterKnee", s.knee);
    localStorage.setItem("voicevoxLimiterAttack", s.attack);
    localStorage.setItem("voicevoxLimiterRelease", s.release);

    // 2. DOMコントロールに値を反映
    updateLimiterUIFromValues(s);

    // 3. ボタン選択スタイルを更新
    setPresetButtonActive(preset.name);

    // 4. 音声エンジンにパラメータを即時伝達
    if (typeof window.updateVoicevoxLimiterSettings === "function") {
      window.updateVoicevoxLimiterSettings(s);
    }

    // 5. グラフ再描画
    drawLimiterGraph();
  }

  // 📊 リミッター入出力特性グラフ（Transfer Curve: 入力dB vs 出力dB）描画エンジン
  const graphCanvas = document.getElementById("limiter-graph-canvas");
  const graphBadge = document.getElementById("limiter-graph-badge");

  function drawLimiterGraph() {
    if (!graphCanvas) return;
    const ctx = graphCanvas.getContext("2d");
    if (!ctx) return;

    // 高DPI Retinaディスプレイ対応
    const dpr = window.devicePixelRatio || 1;
    const rect = graphCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (graphCanvas.width !== Math.round(rect.width * dpr) || graphCanvas.height !== Math.round(rect.height * dpr)) {
      graphCanvas.width = Math.round(rect.width * dpr);
      graphCanvas.height = Math.round(rect.height * dpr);
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 現在のパラメータ
    const enabled = limiterToggle ? limiterToggle.checked : true;
    const threshold = limiterThreshold ? parseFloat(limiterThreshold.value) : -6;
    const ratio = limiterRatio ? parseFloat(limiterRatio.value) : 20;
    const knee = limiterKnee ? parseFloat(limiterKnee.value) : 3;

    // 背景クリア＆ダークグリッド描画
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(4, 15, 26, 0.95)";
    ctx.fillRect(0, 0, w, h);

    // プロットエリア（パディング）
    const padL = 24;
    const padR = 8;
    const padT = 8;
    const padB = 16;
    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);

    // 入出力範囲: -40dB 〜 0dB
    const minDb = -40;
    const maxDb = 0;
    const dbRange = maxDb - minDb;

    const dbToX = (db) => padL + ((db - minDb) / dbRange) * plotW;
    const dbToY = (db) => padT + (1.0 - (db - minDb) / dbRange) * plotH;

    // 1. グリッド線 (-30dB, -20dB, -10dB, 0dB)
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(0, 243, 255, 0.08)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let db = -30; db <= 0; db += 10) {
      const x = dbToX(db);
      const y = dbToY(db);

      // 縦グリッド
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      // 横グリッド
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      // Y軸ラベル
      ctx.fillText(db, padL - 3, y);
    }

    // 2. リニア基準線 (45度点線: y = x, No Compression)
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(dbToX(minDb), dbToY(minDb));
    ctx.lineTo(dbToX(maxDb), dbToY(maxDb));
    ctx.stroke();
    ctx.restore();

    // 3. 圧縮伝達関数の計算 (Soft-Knee + 補償ゲイン Makeup Gain)
    const makeupGain = limiterGain ? (parseFloat(limiterGain.value) || 0) : 0;

    function getOutDb(inDb) {
      if (!enabled) return inDb; // リミッターOFF時はリニア
      const diffDb = inDb - threshold;
      let compOut = inDb;
      if (2.0 * diffDb < -knee) {
        compOut = inDb;
      } else if (2.0 * Math.abs(diffDb) <= knee) {
        const kneeTerm = diffDb + knee / 2.0;
        compOut = inDb + ((1.0 / ratio - 1.0) * kneeTerm * kneeTerm) / (2.0 * knee);
      } else {
        compOut = threshold + diffDb / ratio;
      }

      // 補償ゲイン（Makeup Gain）を加算
      let finalDb = compOut + makeupGain;
      // 0dBピークでのスタジオ品質ソフトリミッティング表現
      if (finalDb > -0.5) {
        const excess = finalDb - (-0.5);
        finalDb = -0.5 + 0.49 * Math.tanh(excess / 2.0);
      }
      return Math.min(0.0, finalDb);
    }

    // 4. カラー設定（プリセットに応じた発光色）
    let strokeColor = "#00f3ff"; // デフォルト・標準
    let fillColorTop = "rgba(0, 243, 255, 0.25)";
    let badgeText = "🛡️ 標準";

    const currentPreset = localStorage.getItem("voicevoxLimiterPreset") || "safe";

    if (!enabled) {
      strokeColor = "#888";
      fillColorTop = "rgba(255, 255, 255, 0.05)";
      badgeText = "OFF (バイパス)";
    } else if (currentPreset === "broadcast" || (Math.abs(threshold - (-18)) < 0.5 && Math.abs(ratio - 4) < 0.5)) {
      strokeColor = "#bf5af2"; // 配信（パープル/マゼンタ）
      fillColorTop = "rgba(191, 90, 242, 0.25)";
      badgeText = "🎙️ 配信";
    } else if (currentPreset === "hard" || (Math.abs(threshold - (-12)) < 0.5 && Math.abs(ratio - 20) < 0.5 && knee <= 1)) {
      strokeColor = "#ff9f0a"; // 強力（ネオンアンバー/オレンジ）
      fillColorTop = "rgba(255, 159, 10, 0.25)";
      badgeText = "⚡ 強力";
    } else if (currentPreset === "safe" || (Math.abs(threshold - (-6)) < 0.5 && Math.abs(ratio - 20) < 0.5)) {
      strokeColor = "#00f3ff"; // 標準
      fillColorTop = "rgba(0, 243, 255, 0.25)";
      badgeText = "🛡️ 標準";
    } else {
      badgeText = `Th:${Math.round(threshold)} R:${Math.round(ratio)} +${makeupGain.toFixed(1)}dB`;
      strokeColor = "#00f3ff";
      fillColorTop = "rgba(0, 243, 255, 0.25)";
    }

    if (graphBadge) {
      graphBadge.textContent = badgeText;
      graphBadge.style.color = strokeColor;
      graphBadge.style.borderColor = strokeColor;
      graphBadge.style.background = enabled ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.05)";
    }

    // 5. カーブ塗りつぶし (Gradient Fill)
    const points = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const inDb = minDb + (i / steps) * dbRange;
      const outDb = getOutDb(inDb);
      points.push({ x: dbToX(inDb), y: dbToY(outDb) });
    }

    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, fillColorTop);
    grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, padT + plotH);
    for (const pt of points) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(points[points.length - 1].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 6. カーブライン描画 (発光エフェクト付き)
    ctx.save();
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = enabled ? 6 : 0;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // 7. 閾値（Threshold）インジケータードット
    if (enabled && threshold >= minDb && threshold <= maxDb) {
      const thX = dbToX(threshold);
      const thY = dbToY(getOutDb(threshold));

      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(thX, thY, 3, 0, Math.PI * 2);
      ctx.fill();

      // 閾値の縦ガイド点線
      ctx.setLineDash([1, 2]);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(thX, thY);
      ctx.lineTo(thX, padT + plotH);
      ctx.stroke();
      ctx.restore();
    }
  }

  window.drawLimiterGraph = drawLimiterGraph;

  // live2d_studio_auto_ui_state に過去保存された limiter-* キーを完全消去（競合防止）
  try {
    const autoKey = "live2d_studio_auto_ui_state";
    const autoState = JSON.parse(localStorage.getItem(autoKey) || "{}");
    let changed = false;
    Object.keys(autoState).forEach((k) => {
      if (k.startsWith("limiter-") || k.startsWith("voicevox-limiter-") || k.startsWith("btn-limiter-")) {
        delete autoState[k];
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(autoKey, JSON.stringify(autoState));
    }
  } catch (e) {}

  // 初期値の復元
  const savedPreset = localStorage.getItem("voicevoxLimiterPreset") || "safe";
  let initialLimiterSettings;

  if (LIMITER_PRESETS[savedPreset]) {
    // プリセットが指定されている場合は、そのプリセットの設定をベースにする（微小誤差による崩れを完全防止）
    initialLimiterSettings = { ...LIMITER_PRESETS[savedPreset].settings };
    initialLimiterSettings.enabled = localStorage.getItem("voicevoxLimiterEnabled") !== "false";
    // localStorage の各値も念のため同期
    localStorage.setItem("voicevoxLimiterThreshold", initialLimiterSettings.threshold);
    localStorage.setItem("voicevoxLimiterRatio", initialLimiterSettings.ratio);
    localStorage.setItem("voicevoxLimiterMakeupGain", initialLimiterSettings.makeupGain);
    localStorage.setItem("voicevoxLimiterKnee", initialLimiterSettings.knee);
    localStorage.setItem("voicevoxLimiterAttack", initialLimiterSettings.attack);
    localStorage.setItem("voicevoxLimiterRelease", initialLimiterSettings.release);
  } else {
    // customの場合
    initialLimiterSettings = {
      enabled: localStorage.getItem("voicevoxLimiterEnabled") !== "false",
      threshold: parseFloat(localStorage.getItem("voicevoxLimiterThreshold") || "-6"),
      ratio: parseFloat(localStorage.getItem("voicevoxLimiterRatio") || "20"),
      makeupGain: parseFloat(localStorage.getItem("voicevoxLimiterMakeupGain") || "1.5"),
      knee: parseFloat(localStorage.getItem("voicevoxLimiterKnee") || "3"),
      attack: parseFloat(localStorage.getItem("voicevoxLimiterAttack") || "0.001"),
      release: parseFloat(localStorage.getItem("voicevoxLimiterRelease") || "0.10"),
    };
  }

  updateLimiterUIFromValues(initialLimiterSettings);
  setPresetButtonActive(savedPreset === "custom" ? null : savedPreset);
  if (typeof window.updateVoicevoxLimiterSettings === "function") {
    window.updateVoicevoxLimiterSettings(initialLimiterSettings);
  }
  setTimeout(drawLimiterGraph, 100);
  window.addEventListener("resize", drawLimiterGraph);
  document.querySelectorAll(".nav-tab, .tab-btn, button[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => setTimeout(drawLimiterGraph, 80));
  });
  document.querySelectorAll("details").forEach((d) => {
    d.addEventListener("toggle", () => setTimeout(drawLimiterGraph, 50));
  });

  // イベントリスナー
  if (limiterToggle) {
    limiterToggle.addEventListener("change", saveAndApplyLimiter);
  }
  if (limiterThreshold) {
    limiterThreshold.addEventListener("input", () => {
      if (limiterThresholdVal) limiterThresholdVal.textContent = limiterThreshold.value;
      saveAndApplyLimiter();
    });
  }
  if (limiterRatio) {
    limiterRatio.addEventListener("input", () => {
      if (limiterRatioVal) limiterRatioVal.textContent = limiterRatio.value;
      saveAndApplyLimiter();
    });
  }
  if (limiterGain) {
    limiterGain.addEventListener("input", () => {
      if (limiterGainVal) limiterGainVal.textContent = parseFloat(limiterGain.value).toFixed(1);
      saveAndApplyLimiter();
    });
  }
  if (limiterKnee) {
    limiterKnee.addEventListener("input", () => {
      if (limiterKneeVal) limiterKneeVal.textContent = limiterKnee.value;
      saveAndApplyLimiter();
    });
  }
  if (limiterAttack) {
    limiterAttack.addEventListener("input", () => {
      if (limiterAttackVal) limiterAttackVal.textContent = Math.round(parseFloat(limiterAttack.value) * 1000);
      saveAndApplyLimiter();
    });
  }
  if (limiterRelease) {
    limiterRelease.addEventListener("input", () => {
      if (limiterReleaseVal) limiterReleaseVal.textContent = Math.round(parseFloat(limiterRelease.value) * 1000);
      saveAndApplyLimiter();
    });
  }

  if (btnPresetSafe) btnPresetSafe.addEventListener("click", () => applyPreset("safe"));
  if (btnPresetBroadcast) btnPresetBroadcast.addEventListener("click", () => applyPreset("broadcast"));
  if (btnPresetHard) btnPresetHard.addEventListener("click", () => applyPreset("hard"));
  if (btnLimiterReset) btnLimiterReset.addEventListener("click", () => applyPreset("safe"));

  window.seVolumeSlider = document.getElementById("se-volume-slider");
  window.seVolumeVal = document.getElementById("se-volume-val");
  if (seVolumeSlider) {
    const savedSeVol = localStorage.getItem("savedSeVolume");
    if (savedSeVol !== null) {
      seVolumeSlider.value = savedSeVol;
      if (seVolumeVal) seVolumeVal.textContent = savedSeVol;
    }
    seVolumeSlider.addEventListener("input", () => {
      const vol = parseFloat(seVolumeSlider.value);
      if (seVolumeVal) seVolumeVal.textContent = Math.round(vol);
      localStorage.setItem("savedSeVolume", vol);
    });
  }

  function restoreSavedModelList(provider) {
    const p = provider || (aiProviderSelect ? aiProviderSelect.value : "gemini");
    if (p === "ollama") {
      const defaultOllama = ["qwen2.5:7b", "qwen2.5:14b", "llama3.1:8b", "gemma2:9b"];
      const rawList = localStorage.getItem("savedAiModelList_ollama");
      let list = defaultOllama;
      if (rawList) {
        try {
          const parsed = JSON.parse(rawList);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        } catch (e) {}
      }
      if (aiModelInput) {
        aiModelInput.innerHTML = "";
        list.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          aiModelInput.appendChild(opt);
        });
        const savedModel = localStorage.getItem("savedAiModel");
        if (savedModel && list.includes(savedModel)) {
          aiModelInput.value = savedModel;
        } else {
          aiModelInput.value = list[0];
        }
        localStorage.setItem("savedAiModel", aiModelInput.value);
      }
      return;
    }

    const rawList = localStorage.getItem("savedAiModelList_" + p);
    if (rawList && aiModelInput) {
      try {
        let list = JSON.parse(rawList);
        if (Array.isArray(list) && list.length > 0) {
          // 不正モデルやロボティクス等の特殊モデルをキャッシュから除外
          list = list.filter(
            (m) =>
              !m.includes("robotics") &&
              !m.includes("vision") &&
              !m.includes("embedding") &&
              !m.includes("aqa") &&
              !m.includes("image") &&
              !m.includes("tts") &&
              !m.includes("computer-use") &&
              !m.includes("customtools") &&
              m !== "gemini-pro" &&
              m !== "gemini-pro-latest",
          );

          if (list.length === 0) {
            list = ["gemini-3.7-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
          }

          localStorage.setItem("savedAiModelList_" + p, JSON.stringify(list));

          aiModelInput.innerHTML = "";
          list.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            aiModelInput.appendChild(opt);
          });
          const savedModel = localStorage.getItem("savedAiModel");
          if (savedModel && list.includes(savedModel) && !savedModel.includes("robotics")) {
            aiModelInput.value = savedModel;
          } else {
            aiModelInput.value = list.includes("gemini-3.7-flash")
              ? "gemini-3.7-flash"
              : (list.includes("gemini-2.0-flash") ? "gemini-2.0-flash" : list[0]);
          }
          localStorage.setItem("savedAiModel", aiModelInput.value);
        }
      } catch (e) {}
    }
  }

  async function fetchAiModels(silent = false) {
    if (window.__isFetchingAiModels) return;
    const provider = aiProviderSelect ? aiProviderSelect.value : "gemini";
    const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : "";
    if (provider !== "ollama" && !apiKey) {
      if (!silent) alert("APIキーを入力してください");
      return;
    }

    window.__isFetchingAiModels = true;
    console.log(`[AI設定] 🌐 ${provider.toUpperCase()} APIから利用可能モデル一覧を取得中...`);

    if (!silent && aiFetchModelsBtn) {
      aiFetchModelsBtn.textContent = "取得中...";
      aiFetchModelsBtn.disabled = true;
    }

    try {
      if (provider === "ollama") {
        const res = await fetch("http://localhost:11434/api/tags");
        if (res.ok) {
          const json = await res.json();
          if (json && json.models) {
            const modelNames = json.models.map((m) => m.name);
            if (modelNames.length > 0) {
              aiModelInput.innerHTML = "";
              modelNames.forEach((m) => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                aiModelInput.appendChild(opt);
              });
              localStorage.setItem("savedAiModelList_ollama", JSON.stringify(modelNames));
              const saved = localStorage.getItem("savedAiModel");
              if (saved && modelNames.includes(saved)) {
                aiModelInput.value = saved;
              } else {
                aiModelInput.value = modelNames[0];
              }
              localStorage.setItem("savedAiModel", aiModelInput.value);
              console.log(`[AI設定] ✅ Ollamaローカルモデル取得完了: ${modelNames.length}件 (選択中: [${aiModelInput.value}])`, modelNames);
            }
          }
        } else {
          console.warn("[AI設定] Ollamaサーバー未起動または未応答");
        }
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const json = await res.json();
        if (res.ok && json.data) {
          const chatModels = json.data
            .filter((m) => m.id.includes("gpt"))
            .map((m) => m.id)
            .sort((a, b) =>
              b.localeCompare(a, undefined, {
                numeric: true,
                sensitivity: "base",
              }),
            );
          if (chatModels.length > 0) {
            aiModelInput.innerHTML = "";
            chatModels.forEach((m) => {
              const option = document.createElement("option");
              option.value = m;
              option.textContent = m;
              aiModelInput.appendChild(option);
            });
            localStorage.setItem(
              "savedAiModelList_openai",
              JSON.stringify(chatModels),
            );
            const saved = localStorage.getItem("savedAiModel");
            if (saved && chatModels.includes(saved)) {
              aiModelInput.value = saved;
            } else {
              aiModelInput.value = chatModels.includes("gpt-4o-mini")
                ? "gpt-4o-mini"
                : chatModels[0];
            }
            localStorage.setItem("savedAiModel", aiModelInput.value);
            console.log(`[AI設定] ✅ OpenAIモデル取得完了: ${chatModels.length}件 (選択中: [${aiModelInput.value}])`, chatModels);
          }
        }
      } else if (provider === "gemini") {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        const json = await res.json();
        if (res.ok && json.models) {
          const availableModels = json.models
            .filter((m) => {
              if (!m.name) return false;
              const methods = m.supportedGenerationMethods || [];
              if (!methods.includes("generateContent")) return false;
              const id = m.name.replace("models/", "");
              if (
                id.includes("vision") ||
                id.includes("embedding") ||
                id.includes("aqa") ||
                id.includes("robotics") ||
                id.includes("deep-research") ||
                id.includes("medlm") ||
                id.includes("image") ||
                id.includes("tts") ||
                id.includes("computer-use") ||
                id.includes("customtools") ||
                id === "gemini-pro" ||
                id === "gemini-pro-latest"
              ) {
                return false;
              }
              return id.startsWith("gemini");
            })
            .map((m) => m.name.replace("models/", ""))
            .sort((a, b) =>
              b.localeCompare(a, undefined, {
                numeric: true,
                sensitivity: "base",
              }),
            );

          if (availableModels.length > 0) {
            aiModelInput.innerHTML = "";
            availableModels.forEach((m) => {
              const option = document.createElement("option");
              option.value = m;
              option.textContent = m;
              aiModelInput.appendChild(option);
            });
            localStorage.setItem(
              "savedAiModelList_gemini",
              JSON.stringify(availableModels),
            );

            const saved = localStorage.getItem("savedAiModel");
            if (saved && availableModels.includes(saved) && !saved.includes("robotics")) {
              aiModelInput.value = saved;
            } else {
              aiModelInput.value = availableModels.includes("gemini-3.7-flash")
                ? "gemini-3.7-flash"
                : (availableModels.includes("gemini-2.0-flash")
                  ? "gemini-2.0-flash"
                  : (availableModels.includes("gemini-1.5-flash") ? "gemini-1.5-flash" : availableModels[0]));
            }
            localStorage.setItem("savedAiModel", aiModelInput.value);
            console.log(`[AI設定] ✅ Gemini生成モデル取得完了: ${availableModels.length}件 (選択中: [${aiModelInput.value}])`, availableModels);
          }
        } else {
          console.warn("[AI設定] ⚠️ Geminiモデル取得レスポンス異常:", json);
        }
      }
    } catch (e) {
      console.error("[AI設定] ❌ モデル一覧取得エラー:", e);
    } finally {
      window.__isFetchingAiModels = false;
      if (aiFetchModelsBtn) {
        aiFetchModelsBtn.textContent = "一覧を取得";
        aiFetchModelsBtn.disabled = false;
      }
    }
  }

  aiProviderSelect.addEventListener("change", () => {
    localStorage.setItem("savedAiProvider", aiProviderSelect.value);
    restoreSavedModelList(aiProviderSelect.value);
    fetchAiModels(true);
    updateAiLink();
  });
  aiApiKeyInput.addEventListener("input", () => {
    localStorage.setItem("savedAiApiKey", aiApiKeyInput.value.trim());
    fetchAiModels(true);
  });
  aiSystemPromptInput.addEventListener("input", () =>
    localStorage.setItem("savedAiPrompt", aiSystemPromptInput.value.trim()),
  );
  if (aiSearchSelect) {
    aiSearchSelect.addEventListener("change", () =>
      localStorage.setItem("savedAiSearchSelect", aiSearchSelect.value),
    );
  }
  if (aiModelInput) {
    aiModelInput.addEventListener("change", () =>
      localStorage.setItem("savedAiModel", aiModelInput.value.trim()),
    );
    aiModelInput.addEventListener("input", () =>
      localStorage.setItem("savedAiModel", aiModelInput.value.trim()),
    );
  }

  // 初期化：保存済みのモデル一覧を復元＆バックグラウンドで最新同期
  restoreSavedModelList();
  updateAiLink();
  setTimeout(() => fetchAiModels(true), 500);

  window.aiFetchModelsBtn = document.getElementById("ai-fetch-models-btn");
  if (aiFetchModelsBtn) {
    aiFetchModelsBtn.addEventListener("click", () => fetchAiModels(false));
  }

  window.aiTestBtn = document.getElementById("ai-test-btn");
  window.aiTestStatus = document.getElementById("ai-test-status");

  if (aiTestBtn) {
    aiTestBtn.addEventListener("click", async () => {
      const apiKey = aiApiKeyInput.value.trim();
      const provider = aiProviderSelect.value;
      window.aiModelInput = document.getElementById("ai-model-input");
      const modelName = aiModelInput
        ? aiModelInput.value.trim()
        : provider === "openai"
          ? "gpt-4o-mini"
          : (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash");

      if (provider === "ollama") {
        aiTestStatus.textContent = "⏳ Ollama (ローカルLLM) テスト中...";
        aiTestStatus.style.color = "var(--text-muted)";
        aiTestBtn.disabled = true;
        try {
          const res = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName || "qwen2.5:7b",
              prompt: "こんにちは！",
              stream: false,
            }),
          });
          if (res.ok) {
            aiTestStatus.textContent = "✅ Ollama (ローカルLLM) 正常稼働中！";
            aiTestStatus.style.color = "#00ff88";
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (ollamaErr) {
          aiTestStatus.textContent = "❌ Ollama未起動 (brew services start ollama)";
          aiTestStatus.style.color = "var(--danger, #ff4444)";
        } finally {
          aiTestBtn.disabled = false;
        }
        return;
      }

      if (!apiKey) {
        aiTestStatus.textContent = "❌ APIキーを入力してください";
        aiTestStatus.style.color = "var(--danger, #ff4444)";
        return;
      }

      aiTestStatus.textContent = "⏳ テスト中...";
      aiTestStatus.style.color = "var(--text-muted)";
      aiTestBtn.disabled = true;

      try {
        if (provider === "openai") {
          const res = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: modelName || "gpt-4o-mini",
                messages: [{ role: "user", content: "test" }],
                max_tokens: 5,
              }),
            },
          );
          const json = await res.json();
          if (res.ok && json.choices) {
            aiTestStatus.textContent = "✅ 有効なAPIキーです";
            aiTestStatus.style.color = "#00f3ff";
          } else {
            throw new Error(json.error?.message || "Invalid response");
          }
        } else if (provider === "gemini") {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/interactions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                model: modelName || "gemini-1.5-flash",
                input: "test",
              }),
            },
          );
          const json = await res.json();
          if (res.ok && json.id) {
            aiTestStatus.textContent = "✅ 有効なAPIキーです";
            aiTestStatus.style.color = "#00f3ff";
          } else {
            throw new Error(json.error?.message || "Invalid response");
          }
        }
      } catch (e) {
        console.error("API Test Error:", e);
        let errMsg = e.message || "不明なエラー";
        if (errMsg.includes("Failed to fetch")) {
          errMsg = "通信エラー (ネット未接続など)";
        }
        aiTestStatus.textContent = `❌ ${errMsg}`;
        aiTestStatus.style.color = "var(--danger, #ff4444)";
      } finally {
        aiTestBtn.disabled = false;
      }
    });
  }
});
