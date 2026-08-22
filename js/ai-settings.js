window.aiHiraganaCache = {};
window.loadHiraganaData = async function () {
  try {
    const res = await fetch("/hiragana_data.json");
    if (res.ok) {
      const data = await res.json();
      if (data.dictionary !== undefined || data.cache !== undefined) {
        aiHiraganaCache = data.cache || {};
        if (aiHiraganaDict && data.dictionary !== undefined) {
          aiHiraganaDict.value = data.dictionary;
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
  if (aiProviderSelect.value === "openai") {
    aiApiLink.href = "https://platform.openai.com/api-keys";
    aiApiLink.textContent = "▶︎ OpenAI APIキーを取得する";
    aiApiLink.style.color = "#ff6b6b";
  } else {
    aiApiLink.href = "https://aistudio.google.com/app/apikey";
    aiApiLink.textContent = "▶︎ Gemini APIキーを取得する";
    aiApiLink.style.color = "#00f3ff";
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
    });
  }

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
    const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : "";
    const provider = aiProviderSelect ? aiProviderSelect.value : "gemini";
    if (!apiKey) {
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
      if (provider === "openai") {
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
          : "gemini-1.5-flash";

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
