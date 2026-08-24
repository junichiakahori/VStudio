(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("radio-mode", () => {
  // =====================================================================
  // ラジオ台本作成モーダル関連のロジック
  // =====================================================================
  window.radioScriptBtn = document.getElementById("ai-radio-script-btn");
  window.radioScriptModal = document.getElementById("radio-script-modal");
  window.radioScriptGenBtn = document.getElementById(
    "radio-script-generate-btn",
  );
  window.radioScriptClearBtn = document.getElementById(
    "radio-script-clear-btn",
  );
  window.radioScriptSaveBtn = document.getElementById("radio-script-save-btn");
  window.radioScriptCancelBtn = document.getElementById(
    "radio-script-cancel-btn",
  );
  window.radioScriptTextarea = document.getElementById("radio-script-textarea");
  window.radioScriptLoading = document.getElementById("radio-script-loading");
  window.radioScriptPlayBtn = document.getElementById("radio-script-play-btn");

  if (radioScriptPlayBtn) {
    radioScriptPlayBtn.addEventListener("click", () => {
      window.radioModeToggle = document.getElementById("ai-radio-mode-toggle");
      if (radioModeToggle && radioModeToggle.checked) {
        if (
          !radioModeState.scriptLines ||
          radioModeState.scriptLines.length === 0
        ) {
          alert("先にラジオ台本を作成・保存してください。");
          return;
        }
        if (
          radioModeState.currentPhase === "none" ||
          radioModeState.currentPhase === "finished"
        ) {
          radioModeState.currentPhase = "playing";

          window.radioScriptStopBtn = document.getElementById(
            "radio-script-stop-btn",
          );
          if (radioScriptPlayBtn) radioScriptPlayBtn.style.display = "none";
          if (radioScriptStopBtn) radioScriptStopBtn.style.display = "block";

          window.startLineInput = document.getElementById(
            "radio-script-start-line",
          );
          let startIdx = 0;
          if (startLineInput) {
            let val = parseInt(startLineInput.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > radioModeState.scriptLines.length)
              val = radioModeState.scriptLines.length;
            startIdx = val - 1;
          }
          radioModeState.currentScriptIndex = startIdx;

          console.log(
            `[ラジオモード] 手動/スケジュールトリガーにより台本読み上げ開始。全${radioModeState.scriptLines.length}行 (開始行: ${startIdx + 1})`,
          );

          // BGMを最初から再生し直す
          window.bgmPlayBtnRef = document.getElementById("bgm-play-btn");
          if (bgmPlayBtnRef && typeof bgmBuffer !== "undefined" && bgmBuffer) {
            console.log("[ラジオモード] BGMを最初から再生し直します");
            bgmPlayBtnRef.click();
          }

          if (typeof triggerIdleSpeech === "function") {
            triggerIdleSpeech();
          }
        } else {
          console.log("[ラジオモード] すでに再生中です。");
        }
      } else {
        alert("先に「ラジオ番組モード」のスイッチをONにしてください。");
      }
    });
  }

  window.radioScriptStopBtn = document.getElementById("radio-script-stop-btn");
  if (radioScriptStopBtn) {
    radioScriptStopBtn.addEventListener("click", () => {
      radioModeState.currentPhase = "none";
      if (radioScriptPlayBtn) radioScriptPlayBtn.style.display = "block";
      if (radioScriptStopBtn) radioScriptStopBtn.style.display = "none";

      // Clear queues and timers to stop playback immediately
      if (typeof voicevoxAudioQueue !== "undefined") {
        voicevoxAudioQueue.length = 0;
      }
      if (typeof clearIdleTimer === "function") {
        clearIdleTimer();
      }
      console.log("[ラジオモード] 再生を停止しました。");
      console.log("[ラジオモード] 再生を停止しました。");
    });
  }

  window.radioPoolTestBtn = document.getElementById("radio-pool-test-btn");
  window.radioPoolClearBtn = document.getElementById("radio-pool-clear-btn");
  window.radioPoolCount = document.getElementById("radio-pool-count");

  // プール件数を定期的に更新
  setInterval(() => {
    if (radioPoolCount && typeof radioCommentQueue !== "undefined") {
      radioPoolCount.textContent = radioCommentQueue.length;
    }
  }, 1000);

  if (radioPoolTestBtn) {
    radioPoolTestBtn.addEventListener("click", () => {
      if (typeof queueCommentAudio === "function") {
        const nickname = "テスト";
        window.inputEl = document.getElementById("radio-pool-test-input");
        const comment =
          inputEl && inputEl.value.trim().length > 0
            ? inputEl.value.trim()
            : "手動テストコメントです！";

        // コメントを画面のビューアーにも表示する
        if (typeof addCommentToViewer === "function") {
          addCommentToViewer(nickname, comment, "youtube", false, "");
        }

        // コメント自体を読み上げキューへ（通常フローと同じ）
        queueCommentAudio(`${nickname}さん、${comment}`);

        // AI返答の生成をトリガー（通常フローと同じ）
        if (typeof generateAIResponse === "function") {
          window.aiApiKeyInput = document.getElementById("ai-api-key");
          window.isAiReplyEnabled =
            document.getElementById("ai-reply-toggle")?.checked;
          if (
            isAiReplyEnabled &&
            aiApiKeyInput &&
            aiApiKeyInput.value.trim().length > 0
          ) {
            generateAIResponse(nickname, comment);
            console.log(
              "[ラジオモード] テストコメントとAI返信生成をリクエストしました",
            );
          } else {
            console.log(
              "[ラジオモード] テストコメントを追加しました (AI返信はOFFです)",
            );
          }
        }
      }
    });
  }

  if (radioPoolClearBtn) {
    radioPoolClearBtn.addEventListener("click", () => {
      if (typeof radioCommentQueue !== "undefined") {
        radioCommentQueue = [];
        if (radioPoolCount) radioPoolCount.textContent = 0;
        console.log("[ラジオモード] コメントプールをクリアしました。");
      }
      if (typeof window.clearAllComments === "function") {
        window.clearAllComments();
      }
    });
  }

  window.radioScriptYomiTextarea = document.getElementById(
    "radio-script-yomi-textarea",
  );
  window.radioConfigNameInput = document.getElementById("radio-config-name");
  window.radioConfigOpeningInput = document.getElementById(
    "radio-config-opening",
  );
  window.radioConfigClosingInput = document.getElementById(
    "radio-config-closing",
  );
  window.radioConfigSaveBtn = document.getElementById("radio-config-save-btn");

  // 設定の読み込み
  const loadRadioConfig = async () => {
    try {
      const res = await fetch("/radio_script_config");
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg) {
        window.radioConfigTitleInput =
          document.getElementById("radio-config-title");
        window.radioConfigThemeInput =
          document.getElementById("radio-config-theme");
        if (radioConfigTitleInput && cfg.program_title)
          radioConfigTitleInput.value = cfg.program_title;
        if (radioConfigThemeInput && cfg.program_theme)
          radioConfigThemeInput.value = cfg.program_theme;
      }
      if (cfg.personality) {
        if (radioConfigNameInput && cfg.personality.name)
          radioConfigNameInput.value = cfg.personality.name;
        if (radioConfigOpeningInput && cfg.personality.greeting_opening)
          radioConfigOpeningInput.value = cfg.personality.greeting_opening;
        if (radioConfigClosingInput && cfg.personality.greeting_closing)
          radioConfigClosingInput.value = cfg.personality.greeting_closing;

        window.radioConfigStartTimeInput = document.getElementById(
          "radio-config-start-time",
        );
        window.radioConfigEndTimeInput = document.getElementById(
          "radio-config-end-time",
        );
        window.radioConfigDateInput =
          document.getElementById("radio-config-date");
        if (radioConfigStartTimeInput && cfg.personality.start_time)
          radioConfigStartTimeInput.value = cfg.personality.start_time;
        if (radioConfigEndTimeInput && cfg.personality.end_time)
          radioConfigEndTimeInput.value = cfg.personality.end_time;
        if (radioConfigDateInput && cfg.personality.broadcast_date)
          radioConfigDateInput.value = cfg.personality.broadcast_date;
      }
      if (cfg.se_allowed && Array.isArray(cfg.se_allowed)) {
        // チェックボックスを設定ファイルの値で復元
        const cbs = document.querySelectorAll(
          '#radio-script-settings-details input[name="se"]',
        );
        cbs.forEach((cb) => {
          cb.checked = cfg.se_allowed.includes(cb.value);
        });
      }
    } catch (e) {
      console.warn("[台本設定] 設定ファイルの読み込みに失敗:", e);
    }
  };
  loadRadioConfig();

  // 設定の保存ボタン
  if (radioConfigSaveBtn) {
    radioConfigSaveBtn.addEventListener("click", async () => {
      const name = radioConfigNameInput
        ? radioConfigNameInput.value.trim()
        : "";
      const opening = radioConfigOpeningInput
        ? radioConfigOpeningInput.value.trim()
        : "";
      const closing = radioConfigClosingInput
        ? radioConfigClosingInput.value.trim()
        : "";

      window.radioConfigTitleInput =
        document.getElementById("radio-config-title");
      window.radioConfigThemeInput =
        document.getElementById("radio-config-theme");
      const program_title = radioConfigTitleInput
        ? radioConfigTitleInput.value.trim()
        : "";
      const program_theme = radioConfigThemeInput
        ? radioConfigThemeInput.value.trim()
        : "";

      window.radioConfigStartTimeInput = document.getElementById(
        "radio-config-start-time",
      );
      window.radioConfigEndTimeInput = document.getElementById(
        "radio-config-end-time",
      );
      window.radioConfigDateInput =
        document.getElementById("radio-config-date");
      const start_time = radioConfigStartTimeInput
        ? radioConfigStartTimeInput.value
        : "20:00";
      const end_time = radioConfigEndTimeInput
        ? radioConfigEndTimeInput.value
        : "20:30";
      const broadcast_date = radioConfigDateInput
        ? radioConfigDateInput.value
        : "";

      const cbs = document.querySelectorAll(
        '#radio-script-settings-details input[name="se"]:checked',
      );
      const seAllowed = Array.from(cbs).map((cb) => cb.value);
      const config = {
        program_title,
        program_theme,
        personality: {
          name,
          greeting_opening: opening,
          greeting_closing: closing,
          start_time,
          end_time,
          broadcast_date,
        },
        se_allowed: seAllowed,
      };
      try {
        const res = await fetch("/radio_script_config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (res.ok) {
          radioConfigSaveBtn.textContent = "✅ 保存しました！";
          setTimeout(() => {
            radioConfigSaveBtn.textContent = "💾 この設定を保存";
          }, 2000);
        }
      } catch (e) {
        console.warn("[台本設定] 設定保存に失敗:", e);
      }
    });
  }

  // 読み込み時に保存された台本を復元（サーバーのテキストファイルから読み込み）
  Promise.all([
    fetch("/radio_script")
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => ""),
    fetch("/radio_script_yomi")
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => ""),
  ]).then(([savedScript, savedYomi]) => {
    if (savedScript && savedScript.trim()) {
      if (radioScriptTextarea) radioScriptTextarea.value = savedScript;
      const lines = savedScript
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      radioModeState.scriptLines = lines;
      if (!window.__radioScriptLoaded) {
        console.log(
          `[ラジオ台本] radio_script.txtから${lines.length}行読み込みました`,
        );
      }
    } else {
      // APIサーバー未起動などの場合はlocalStorageにフォールバック
      const fallbackScript = localStorage.getItem("savedRadioScript");
      if (fallbackScript) {
        if (radioScriptTextarea) radioScriptTextarea.value = fallbackScript;
        const lines = fallbackScript
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        radioModeState.scriptLines = lines;
        if (!window.__radioScriptLoaded) {
          console.log(
            `[ラジオ台本] localStorageから${lines.length}行読み込み（フォールバック）`,
          );
        }
      }
    }

    if (savedYomi && savedYomi.trim()) {
      if (radioScriptYomiTextarea) radioScriptYomiTextarea.value = savedYomi;
      const yomiLines = savedYomi
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      radioModeState.scriptYomiLines = yomiLines;
      if (!window.__radioScriptLoaded) {
        console.log(
          `[ラジオ台本] radio_script_yomi.txtから${yomiLines.length}行読み込みました`,
        );
      }
    } else {
      const fallbackYomi = localStorage.getItem("savedRadioScriptYomi");
      if (fallbackYomi) {
        if (radioScriptYomiTextarea)
          radioScriptYomiTextarea.value = fallbackYomi;
        const yomiLines = fallbackYomi
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        radioModeState.scriptYomiLines = yomiLines;
        if (!window.__radioScriptLoaded) {
          console.log(
            `[ラジオ台本] localStorageから${yomiLines.length}行読み込み（フォールバック）`,
          );
        }
      }
    }
    window.__radioScriptLoaded = true;

    // 進行状況の復元
    const lastIndex = parseInt(
      localStorage.getItem("radioScriptLastIndex") || "0",
      10,
    );
    window.startLineInput = document.getElementById("radio-script-start-line");
    if (startLineInput && lastIndex > 0) {
      // トラブル復帰用に「次に読むべき行」を初期値としてセットしておく
      startLineInput.value = lastIndex + 1;
    }
  });

  if (radioScriptBtn && radioScriptModal) {
    let seListLoaded = false;
    radioScriptBtn.addEventListener("click", () => {
      radioScriptModal.style.display = "flex";
      if (!seListLoaded) {
        window.seSelect = document.getElementById("radio-script-se-select");
        if (seSelect) {
          fetch("/se_list")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data && data.files) {
                seSelect.innerHTML = "";
                data.files
                  .sort((a, b) => a.localeCompare(b, "ja"))
                  .forEach((f) => {
                    const opt = document.createElement("option");
                    opt.value = f;
                    opt.textContent = f;
                    seSelect.appendChild(opt);
                  });
                seListLoaded = true;
              } else {
                seSelect.innerHTML = '<option value="">(取得失敗)</option>';
              }
            })
            .catch(
              () =>
              (seSelect.innerHTML =
                '<option value="">(サーバー未接続)</option>'),
            );
        }
      }
    });

    window.sePlayBtn = document.getElementById("radio-script-se-play-btn");
    window.seInsertBtn = document.getElementById("radio-script-se-insert-btn");
    window.seSelect = document.getElementById("radio-script-se-select");
    let currentSeAudio = null;
    if (sePlayBtn && seSelect) {
      sePlayBtn.addEventListener("click", () => {
        if (!seSelect.value) return;
        if (currentSeAudio) {
          currentSeAudio.pause();
          currentSeAudio.currentTime = 0;
        }
        const seVolSlider = document.getElementById("se-volume-slider");
        const savedSeVol = localStorage.getItem("savedSeVolume");
        const targetSeVol = seVolSlider ? (parseFloat(seVolSlider.value) / 100.0) : (savedSeVol ? (parseFloat(savedSeVol) / 100.0) : 1.0);
        currentSeAudio = new Audio(`se/${seSelect.value}.mp3`);
        currentSeAudio.volume = targetSeVol;
        currentSeAudio.play().catch((e) => console.warn("SE再生エラー:", e));
      });
    }
    if (seInsertBtn && seSelect && radioScriptTextarea) {
      seInsertBtn.addEventListener("click", () => {
        if (!seSelect.value) return;
        const insertText = `\n[SE: ${seSelect.value}]\n`;
        const startPos = radioScriptTextarea.selectionStart;
        const endPos = radioScriptTextarea.selectionEnd;
        radioScriptTextarea.value =
          radioScriptTextarea.value.substring(0, startPos) +
          insertText +
          radioScriptTextarea.value.substring(
            endPos,
            radioScriptTextarea.value.length,
          );
        radioScriptTextarea.focus();
        radioScriptTextarea.selectionStart = startPos + insertText.length;
        radioScriptTextarea.selectionEnd = startPos + insertText.length;
      });
    }

    // 台本テキストエリア内で[SE: 〇〇]をクリックした際に再生する機能
    const setupScriptSeClickPlay = (textarea) => {
      if (!textarea) return;
      textarea.addEventListener("click", (e) => {
        const pos = e.target.selectionStart;
        const text = e.target.value;
        const lastNewline = text.lastIndexOf("\n", pos - 1);
        const nextNewline = text.indexOf("\n", pos);
        const start = lastNewline === -1 ? 0 : lastNewline + 1;
        const end = nextNewline === -1 ? text.length : nextNewline;
        const line = text.substring(start, end).trim();

        const seMatch = line.match(/^\[SE:\s*(.+?)\]$/);
        if (seMatch) {
          const seName = seMatch[1];
          if (currentSeAudio) {
            currentSeAudio.pause();
            currentSeAudio.currentTime = 0;
          }
          const seVolSlider = document.getElementById("se-volume-slider");
          const savedSeVol = localStorage.getItem("savedSeVolume");
          const targetSeVol = seVolSlider ? (parseFloat(seVolSlider.value) / 100.0) : (savedSeVol ? (parseFloat(savedSeVol) / 100.0) : 1.0);
          currentSeAudio = new Audio(`se/${seName}.mp3`);
          currentSeAudio.volume = targetSeVol;
          currentSeAudio
            .play()
            .catch((err) => console.warn("クリックSE再生エラー:", err));
        }
      });
    };
    setupScriptSeClickPlay(radioScriptTextarea);
    window.radioScriptYomiTextarea = document.getElementById(
      "radio-script-yomi-textarea",
    );
    setupScriptSeClickPlay(radioScriptYomiTextarea);

    radioScriptGenBtn.addEventListener("click", async () => {
      window.aiApiKeyInput = document.getElementById("ai-api-key");
      const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
      if (!apiKey) {
        alert(
          "AIのAPIキーが設定されていません。AI設定項目からAPIキーを入力してください。",
        );
        return;
      }

      window.aiProviderSelect = document.getElementById("ai-provider-select");
      const provider = aiProviderSelect ? aiProviderSelect.value : "gemini";

      window.startTimeInput = document.getElementById(
        "radio-config-start-time",
      );
      window.endTimeInput = document.getElementById("radio-config-end-time");
      let duration = 30;
      let timeOfDay = "夜";
      let timeContextStr = "";

      if (
        startTimeInput &&
        endTimeInput &&
        startTimeInput.value &&
        endTimeInput.value
      ) {
        const [startH, startM] = startTimeInput.value.split(":").map(Number);
        const [endH, endM] = endTimeInput.value.split(":").map(Number);
        let diffMins = endH * 60 + endM - (startH * 60 + startM);
        if (diffMins <= 0) diffMins += 24 * 60; // 日またぎ
        duration = diffMins;

        if (startH >= 4 && startH < 10) timeOfDay = "朝";
        else if (startH >= 10 && startH < 16) timeOfDay = "昼";
        else if (startH >= 16 && startH < 19) timeOfDay = "夕方";
        else if (startH >= 19 && startH < 24) timeOfDay = "夜";
        else timeOfDay = "深夜";

        window.dateInput = document.getElementById("radio-config-date");
        if (dateInput && dateInput.value) {
          const d = new Date(dateInput.value);
          if (!isNaN(d.getTime())) {
            window.days = ["日", "月", "火", "水", "木", "金", "土"];
            const dateStr = `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
            timeContextStr = `\n【コンテキスト・日時】\n- この番組は【${dateStr}の${timeOfDay}】（開始時刻: ${startTimeInput.value}）に放送されます。オープニング挨拶やフリートークなどで、放送日（${dateStr}）や時間帯に合った自然な話題、季節感を取り入れてください（例：週末なら「今週もお疲れ様でした」、朝なら「おはようございます」など）。\n`;
          } else {
            timeContextStr = `\n【コンテキスト・時間帯】\n- この番組は【${timeOfDay}】（開始時刻: ${startTimeInput.value}）に放送されます。オープニング挨拶やフリートークなどで、時間帯に合った自然な話題やトーンを取り入れてください。\n`;
          }
        } else {
          timeContextStr = `\n【コンテキスト・時間帯】\n- この番組は【${timeOfDay}】（開始時刻: ${startTimeInput.value}）に放送されます。オープニング挨拶やフリートークなどで、時間帯に合った自然な話題やトーンを取り入れてください。\n`;
        }
      }

      window.radioTitleInput = document.getElementById("radio-config-title");
      window.radioThemeInput = document.getElementById("radio-config-theme");
      const radioTitle = radioTitleInput ? radioTitleInput.value.trim() : "";
      const radioTheme = radioThemeInput ? radioThemeInput.value.trim() : "";

      window.mainStreamTitle = document.getElementById("stream-title")
        ? document.getElementById("stream-title").value.trim()
        : "";
      window.mainAiTheme = document.getElementById("ai-stream-theme")
        ? document.getElementById("ai-stream-theme").value.trim()
        : "";

      const programTitle =
        radioTitle || mainStreamTitle || "名無しのラジオ番組";
      const programTheme = radioTheme || mainAiTheme || "まったり雑談";

      radioScriptGenBtn.disabled = true;
      radioScriptLoading.style.display = "block";
      radioScriptTextarea.disabled = true;
      if (radioScriptYomiTextarea) radioScriptYomiTextarea.disabled = true;

      try {
        // 番組設定の取得
        const configName = radioConfigNameInput
          ? radioConfigNameInput.value.trim()
          : "";
        const configOpening = radioConfigOpeningInput
          ? radioConfigOpeningInput.value.trim()
          : "";
        const configClosing = radioConfigClosingInput
          ? radioConfigClosingInput.value.trim()
          : "";
        const checkedSeCbs = document.querySelectorAll(
          '#radio-script-settings-details input[name="se"]:checked',
        );
        const selectedSEs = Array.from(checkedSeCbs).map((cb) => cb.value);

        // SEリストの構築（チェックされたSEを優先、なければサーバーから取得）
        let seListStr = "";
        if (selectedSEs.length > 0) {
          seListStr =
            "利用可能な効果音(SE)リスト（このリストの中から選んでください）:\n" +
            selectedSEs.join(", ");
        } else {
          try {
            const res = await fetch("/se_list");
            if (res.ok) {
              const data = await res.json();
              if (data.files && data.files.length > 0) {
                seListStr =
                  "利用可能な効果音(SE)の例:\n" +
                  data.files.slice(0, 50).join(", ");
              }
            }
          } catch (e) {
            console.warn("SEリストの取得に失敗しました", e);
          }
        }

        // 読み上げ速度から台本の目安文字数・行数を計算
        // VOICEVOXの読み上げ速度は概ね1分あたり約300文字（日本語）
        const charsPerMinute = 300;
        const totalChars = charsPerMinute * duration;
        // 1セリフ平均80〜120文字として行数を計算
        const avgCharsPerLine = 100;
        const targetLines = Math.round(totalChars / avgCharsPerLine);

        // パーソナリティ情報の構築
        const personalityName = configName || "パーソナリティ";
        const personalityDesc = configName
          ? `あなたはラジオパーソナリティの「${personalityName}」です。`
          : "あなたはラジオパーソナリティです。";
        const openingInstruction = configOpening
          ? `台本の最初の行（第1行）は必ず次の挨拶で始めてください（変更不可）:\n「${configOpening}」`
          : "";
        const closingInstruction = configClosing
          ? `台本の最終行は必ず次の挨拶で締めてください（変更不可）:\n「${configClosing}」`
          : "";

        // プロンプトの構築
        const prompt = `${personalityDesc}「${programTitle}」という番組の、「${programTheme}」というテーマで、約${duration}分間の番組台本を生成してください。
以下のルールに必ず従ってください。
${timeContextStr}
【文字数・行数の目安】
- 読み上げ速度は1分あたり約${charsPerMinute}文字です
- ${duration}分の番組なので、台本全体の総文字数は約${totalChars}文字が目安です
- 1行（1セリフ）は80〜120文字程度にしてください
- したがって全体で約${targetLines}行の台本を生成してください（±3行程度は許容）
${openingInstruction ? "\n【オープニング（最初の行）の指定】\n" + openingInstruction : ""}
${closingInstruction ? "\n【エンディング（最終行）の指定】\n" + closingInstruction : ""}

【フォーマットのルール】
1. 1セリフにつき1行で出力してください。セリフの中に改行を含めないでください。
2. 構成は「オープニング（2〜3行）」→「メイントーク（パーソナリティの独り語り）」→「[ラジオ一時停止: コメント返し]」→「エンディング（2〜3行）」のように自然な流れにしてください。
3. SE（効果音）を鳴らしたいタイミングで、独立した1行として \`[SE: 効果音の名前]\` と記述してください。セリフと同じ行には書かないでください。SEは場面転換や盛り上がりのタイミングで数回使用してください。
4. 【重要・禁止事項】「リスナーからのお便り、メール、コメントの紹介」は【完全に禁止】です。架空のリスナー名や架空のコメント（例：「〜さんからのお便りです」「〜というコメントが来ていますね」等）は【絶対に捏造・出力しないでください】。番組は終始「パーソナリティの独り語り」のみで進行してください。
5. 【重要】エンディングの直前に、独立した1行として \`[ラジオ一時停止: コメント返し]\` というタグだけを1回出力してください。このタグの前後で、コメントを読み上げるようなセリフは一切不要です。
${seListStr}

【出力形式の例】
${configOpening || "皆さんこんにちは！今夜もまったりやっていきましょう。"}
[SE: 大勢で拍手]
今回のテーマはですね、${programTheme}についていろいろ話していきたいと思います。
実はわたし最近ちょっとした発見がありまして、みなさんにもシェアしたいんですよ。
（…このように${targetLines}行程度まで「パーソナリティ自身の体験談や考え（独り語り）」を続ける…）
（…絶対に架空のリスナーのお便りやコメントを捏造しないでください…）
[ラジオ一時停止: コメント返し]
さて、そろそろお別れの時間ですね。
${configClosing || "今夜もたくさん聴いてくれてありがとう。また次回もよろしくね！"}
[SE: 放送終了チャイム]

上記の形式で、台本のセリフのみを出力してください（説明書きや前置き・セクション見出しは不要です）。`;

        // aiFeaturesを使って生成 (AIモデルはシステムプロンプト欄のロジックを流用)
        const generatedScript = await aiFeatures.callAI(
          prompt,
          apiKey,
          provider,
          true,
        );

        if (generatedScript) {
          // AI出力を整形：1行1セリフまたは1行1SEになるよう正規化する
          const cleaned = generatedScript
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n") // 改行コード統一
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .join("\n");
          radioScriptTextarea.value = cleaned;
          const lineCount = cleaned.split("\n").length;
          console.log(
            `[台本生成] ${lineCount}行の台本を生成しました（目標: ${targetLines}行）`,
          );

          // 読み上げ用台本（ひらがな）の生成
          radioScriptLoading.textContent = "ひらがな変換中...";
          window.dictValue = document.getElementById("ai-hiragana-dict")
            ? document.getElementById("ai-hiragana-dict").value.trim()
            : "";
          let dictInstruction = "";
          if (dictValue) {
            dictInstruction = `\n【ユーザー指定辞書（大文字小文字を問わず適用）】\n以下の単語は、大文字・小文字の違いを無視して一致した場合も含め、必ず右側の指定された読みに変換してください。\n${dictValue}\n`;
          }

          const getPromptForChunk = (
            chunk,
          ) => `以下の台本テキストをVOICEVOXで読み上げるための「完全なひらがな・カタカナのみのテキスト」に変換してください。

【絶対ルール（必ず守ること）】
1. すべての「漢字」と「アルファベット」を、例外なく「ひらがな」または「カタカナ」の読み仮名に変換すること。「今」「私」「何」のような簡単な漢字も含め、完全に変換してください。
2. 「カタカナ」は絶対にひらがなに変換せず、元の「カタカナ」のまま維持すること（例：「マイク」→「マイク」）。
3. 「[SE: 大勢で拍手]」や「[ラジオ一時停止: コメント返し]」のような [ ] で囲まれたタグ部分は、システム制御用なので絶対に変換せず、1文字も変えずにそのまま残すこと。
4. 各行の対応関係を維持し（1行入力＝1行出力）、行数を増減しないこと。
5. 句読点（、。）や記号、改行のフォーマットは一切変更しないこと。
6. 【重要】音声合成に発音通り読ませるため、助詞の「は」「へ」「を」は必ず発音通り「わ」「え」「お」に書き換えること（例：「わたしは東京へ空を飛ぶ」→「わたしわとうきょうえそらおとぶ」）。
7. 【重要】数字や英単語は、必ず日本語の発音通りに変換すること（例：「7時」→「しちじ」、「100%」→「ひゃくぱーせんと」、「BGM」→「びーじーえむ」）。
8. 元の文章にない言葉を追加したり、単語の読み（癒やし→いやし、Vtuber→ぶいちゅーばー等）を間違えたりしないよう、正確に変換してください。${dictInstruction}
9. 結果のテキストのみを出力し、説明は不要です。

台本:
${chunk}`;

          try {
            const lines = cleaned.split("\n");
            const chunkSize = 15;
            const chunks = [];
            for (let i = 0; i < lines.length; i += chunkSize) {
              chunks.push(lines.slice(i, i + chunkSize).join("\n"));
            }

            let yomiScript = "";
            for (let i = 0; i < chunks.length; i++) {
              const chunkText = chunks[i];
              if (!chunkText.trim()) continue;
              radioScriptLoading.textContent = `ひらがな変換中... (${i + 1}/${chunks.length})`;
              const resText = await aiFeatures.callAI(
                getPromptForChunk(chunkText),
                apiKey,
                provider,
                true,
              );
              if (resText) {
                yomiScript += resText + "\n";
              }
            }

            if (yomiScript && radioScriptYomiTextarea) {
              let cleanedYomi = yomiScript
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
                .join("\n");

              // ダブルチェック機構
              radioScriptLoading.textContent =
                "ひらがなの誤字脱字をダブルチェック中...";
              const checkPrompt = window.PromptLoader
                ? await window.PromptLoader.getFormattedPrompt("radio_check", {
                    kanji_script: cleaned,
                    yomi_script: cleanedYomi,
                  })
                : `以下の「漢字の台本」を元に作成された「現在のひらがな台本」をチェックしてください。\n【漢字の台本】\n${cleaned}\n\n【現在のひらがな台本】\n${cleanedYomi}`;
              try {
                const checkedYomi = await aiFeatures.callAI(
                  checkPrompt,
                  apiKey,
                  provider,
                  true,
                );
                if (checkedYomi) {
                  cleanedYomi = checkedYomi
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n")
                    .split("\n")
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0)
                    .join("\n");
                  console.log(`[ダブルチェック] 完了`);
                }
              } catch (checkErr) {
                console.warn("[ダブルチェックエラー]", checkErr);
              }

              // さらにpykakasiのローカルAPIでダメ押しの完全置換を行う
              try {
                const resKakasi = await fetch(
                  "/convert_remaining_kanji",
                  {
                    method: "POST",
                    headers: { "Content-Type": "text/plain; charset=utf-8" },
                    body: cleanedYomi,
                  },
                );
                if (resKakasi.ok) {
                  cleanedYomi = await resKakasi.text();
                  console.log("[ローカル変換] 完了");
                }
              } catch (e) {
                console.warn("pykakasi変換フォールバックエラー:", e);
              }

              radioScriptYomiTextarea.value = cleanedYomi;
              console.log(
                `[ひらがな変換] ${cleanedYomi.split("\n").length}行生成完了`,
              );

              // 自動で保存ボタンをクリックしてシステムに反映させる
              if (radioScriptSaveBtn) {
                radioScriptSaveBtn.click();
              }
            }
          } catch (yomiErr) {
            console.warn("[ひらがな変換エラー]", yomiErr);
          }
        } else {
          alert("台本の生成に失敗しました（返答が空でした）。");
        }
      } catch (e) {
        console.error("台本生成エラー:", e);
        alert("台本の生成中にエラーが発生しました。\n" + e.message);
      } finally {
        radioScriptGenBtn.disabled = false;
        radioScriptLoading.style.display = "none";
        radioScriptLoading.textContent = "生成中...（しばらくお待ちください）";
        radioScriptTextarea.disabled = false;
        if (radioScriptYomiTextarea) radioScriptYomiTextarea.disabled = false;
      }
    });

    const closeScriptModal = () => {
      radioScriptModal.style.display = "none";
    };
    radioScriptCancelBtn.addEventListener("click", closeScriptModal);

    radioScriptClearBtn.addEventListener("click", () => {
      if (confirm("台本をクリアしてよろしいですか？")) {
        radioScriptTextarea.value = "";
      }
    });

    window.radioScriptFixYomiBtn = document.getElementById(
      "radio-script-fix-yomi-btn",
    );
    if (radioScriptFixYomiBtn) {
      radioScriptFixYomiBtn.addEventListener("click", async () => {
        window.aiApiKeyInput = document.getElementById("ai-api-key");
        const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
        if (!apiKey) {
          alert(
            "AIのAPIキーが設定されていません。AI設定項目からAPIキーを入力してください。",
          );
          return;
        }

        const yomiText = radioScriptYomiTextarea.value.trim();
        if (!yomiText) return;

        window.aiProviderSelect = document.getElementById("ai-provider-select");
        const provider = aiProviderSelect ? aiProviderSelect.value : "gemini";

        const originalBtnText = radioScriptFixYomiBtn.textContent;
        radioScriptFixYomiBtn.textContent = "⏳ AIで自動修正中...";
        radioScriptFixYomiBtn.disabled = true;

        try {
          let fixedText = yomiText;

          // 台本が長すぎるとAIが処理をサボる（途中から元の漢字のまま出力する等）ため、15行ずつチャンク分割して処理する
          const lines = fixedText.split("\n");
          const chunkSize = 15;
          const chunks = [];
          for (let i = 0; i < lines.length; i += chunkSize) {
            chunks.push(lines.slice(i, i + chunkSize).join("\n"));
          }

          window.dictValue = document.getElementById("ai-hiragana-dict")
            ? document.getElementById("ai-hiragana-dict").value.trim()
            : "";
          let dictInstruction = "";
          if (dictValue) {
            dictInstruction = `\n【ユーザー指定辞書（大文字小文字を問わず適用）】\n以下の単語は、大文字・小文字の違いを無視して一致した場合も含め、必ず右側の指定された読みに変換してください。\n${dictValue}\n`;
          }

          let finalConvertedText = "";
          for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];
            if (!chunkText.trim()) continue;

            radioScriptFixYomiBtn.textContent = `⏳ AIで自動修正中... (${i + 1}/${chunks.length})`;

            const prompt = window.PromptLoader
              ? await window.PromptLoader.getFormattedPrompt("radio_yomi", {
                  dictInstruction,
                  script: chunkText,
                })
              : `以下の台本テキストをVOICEVOXで読み上げるための「完全なひらがな・カタカナのみのテキスト」に変換してください。\n${chunkText}`;

            const resText = await aiFeatures.callAI(
              prompt,
              apiKey,
              provider,
              true,
            );
            if (resText) {
              finalConvertedText += resText + "\n";
            } else {
              throw new Error(
                "チャンクの処理中にAIからの返答が空になりました。",
              );
            }
          }

          if (finalConvertedText) {
            const finalYomi = finalConvertedText.trim();
            radioScriptYomiTextarea.value = finalYomi;
            // 以前のように radioScriptSaveBtn.click() を呼ぶとアラートが出てモーダルが閉じてしまうため、
            // ここで静かに状態反映とサーバーへの上書き保存のみを行う
            if (typeof radioModeState !== "undefined") {
              const yomiLines = finalYomi
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
              radioModeState.scriptYomiLines = yomiLines;
            }

            try {
              await fetch("/radio_script_yomi", {
                method: "POST",
                headers: { "Content-Type": "text/plain; charset=utf-8" },
                body: finalYomi,
              });

              // 保存が完了したことをユーザーに控えめに通知する
              radioScriptFixYomiBtn.textContent = "✅ 修正＆保存完了！";
              setTimeout(() => {
                if (
                  radioScriptFixYomiBtn.textContent === "✅ 修正＆保存完了！"
                ) {
                  radioScriptFixYomiBtn.textContent = originalBtnText;
                }
              }, 2000);
            } catch (saveErr) {
              console.warn("静的保存に失敗しました:", saveErr);
              localStorage.setItem("savedRadioScriptYomi", finalYomi);
            }
          } else {
            alert("AIによる自動修正に失敗しました。");
          }
        } catch (e) {
          console.error("ひらがな自動修正エラー:", e);
          alert("ひらがな自動修正中にエラーが発生しました。");
        } finally {
          radioScriptFixYomiBtn.textContent = originalBtnText;
          radioScriptFixYomiBtn.disabled = false;
        }
      });
    }

    radioScriptSaveBtn.addEventListener("click", async () => {
      const rawScript = radioScriptTextarea.value;
      const lines = rawScript
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const rawYomi = radioScriptYomiTextarea
        ? radioScriptYomiTextarea.value
        : "";
      const yomiLines = rawYomi
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      radioModeState.scriptLines = lines;
      radioModeState.scriptYomiLines = yomiLines;
      radioModeState.currentScriptIndex = 0;
      radioModeState.currentPhase = "none";

      // 進行状況（開始行）をリセット
      localStorage.setItem("radioScriptLastIndex", "0");
      window.startLineInput = document.getElementById(
        "radio-script-start-line",
      );
      if (startLineInput) startLineInput.value = 1;

      // テキストファイルに保存（APIサーバー経由）
      try {
        const res = await fetch("/radio_script", {
          method: "POST",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: rawScript,
        });
        if (!res.ok) throw new Error("Save script failed");

        const resYomi = await fetch("/radio_script_yomi", {
          method: "POST",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: rawYomi,
        });
        if (!resYomi.ok) throw new Error("Save yomi failed");

        const json = await res.json();
        console.log(
          `[ラジオ台本保存] radio_script.txtに${json.lines}行保存しました。`,
        );
        alert(
          `台本を保存しました！（${json.lines}行）\nラジオモードONの状態で届くと、順番に読み上げます。`,
        );
      } catch (e) {
        // フォールバック: localStorageに保存
        localStorage.setItem("savedRadioScript", rawScript);
        localStorage.setItem("savedRadioScriptYomi", rawYomi);
        console.warn(
          `[ラジオ台本保存] APIサーバーに接続できないためlocalStorageに保存しました。`,
        );
        console.log(
          `[ラジオ台本保存] 全 ${lines.length} セリフとして保存しました。`,
        );
        alert(
          `台本を保存しました！\nラジオモードONの状態で届くと、順番に読み上げます。`,
        );
      }
      closeScriptModal();
    });

    // モーダルの背景クリックで閉じる
    radioScriptModal.addEventListener("click", (e) => {
      if (e.target === radioScriptModal) {
        closeScriptModal();
      }
    });
  }
});
