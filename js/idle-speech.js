window.idleSpeechTimer = null;

window.clearIdleTimer = function () {
  if (window.idleSpeechTimer) {
    clearTimeout(window.idleSpeechTimer);
    window.idleSpeechTimer = null;
  }
};

window.isZundamonSelected = function () {
  window.voicevoxSpeakerId = document.getElementById("voicevox-speaker-id");
  return (
    voicevoxSpeakerId &&
    voicevoxSpeakerId.options[voicevoxSpeakerId.selectedIndex]?.text.includes(
      "ずんだもん",
    )
  );
};

window.getTimeGreeting = function () {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "おはよう";
  if (hour >= 11 && hour < 18) return "こんにちは";
  return "こんばんは";
};

window.guessEmotionFromText = function (text) {
  const lowerText = text.toLowerCase();
  if (
    /(嬉|うれしい|嬉しい|たのしい|楽しい|わーい|おめでとう|感謝|ありがとう|かわちい|かわいい|可愛い|カワイイ|えへへ|あはは|笑|草|w|ww|www|うける|ウケる|爆笑)/.test(
      lowerText,
    )
  ) {
    return "joy";
  }
  if (
    /(怒|おこ|怒る|おこる|ムカつく|むかつく|ひどい|サイテー|最悪|嫌い|きらい|うざい|ウザい|ちがう|違う|ダメ|だめ)/.test(
      lowerText,
    )
  ) {
    return "angry";
  }
  if (
    /(悲|かなしい|悲しい|つらい|辛い|さみしい|寂しい|泣|しくしく|えーん|ショック|がっかり|残念|ざんねん|すいません|すみません|ごめん)/.test(
      lowerText,
    )
  ) {
    return "sad";
  }
  return "neutral";
};

window.spokenIdlePhrases = new Set();
window.customIdlePhrases = {
  NORMAL_PHRASES: {
    general: [],
    morning: [],
    afternoon: [],
    night: [],
    spring: [],
    summer: [],
    autumn: [],
    winter: [],
  },
  ZUNDA_PHRASES: {
    general: [],
    morning: [],
    afternoon: [],
    night: [],
    spring: [],
    summer: [],
    autumn: [],
    winter: [],
  },
  NORMAL_LONG_STORIES: { general: [] },
  ZUNDA_LONG_STORIES: { general: [] },
};

window.loadCustomIdlePhrases = async function () {
  try {
    const res = await fetch("/custom_idle_phrases.json");
    if (res.ok) {
      const data = await res.json();
      Object.assign(window.customIdlePhrases, data);
    }
  } catch (e) {
    console.warn("[CustomIdle] ローカルサーバーに接続できません:", e);
  }
};
// 初回ロード
loadCustomIdlePhrases();

window.saveCustomIdlePhrase = async function (model, category, phrase) {
  try {
    await fetch("/add_idle_phrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, category, phrase }),
    });
    // キャッシュも更新
    if (!window.customIdlePhrases[model]) window.customIdlePhrases[model] = {};
    if (!window.customIdlePhrases[model][category])
      window.customIdlePhrases[model][category] = [];
    if (!window.customIdlePhrases[model][category].includes(phrase)) {
      window.customIdlePhrases[model][category].push(phrase);
    }
  } catch (e) {
    console.error("[CustomIdle] 保存エラー:", e);
  }
};

window.triggerIdleSpeech = async function () {
  // ニュース放送中・ラジオモード中・配信終了後・準備中は独り言を一切発声しない
  const isNewsRunning = window.newsBroadcastState && window.newsBroadcastState.isRunning;
  const isNewsMode = window.currentBroadcastMode === "news";
  const isRadioModeActive = window.currentBroadcastMode === "radio" || (document.getElementById("ai-radio-mode-toggle")?.checked);
  const isEnded = (typeof isStreamEndedState !== "undefined" && isStreamEndedState) || (typeof isStreamEndProcessRunning !== "undefined" && isStreamEndProcessRunning);

  if (
    !window.isIdleSpeechEnabled ||
    !window.isVoicevoxEnabled ||
    isNewsRunning ||
    isNewsMode ||
    isRadioModeActive ||
    isEnded ||
    (typeof isPreparing !== "undefined" && isPreparing)
  ) {
    return;
  }

  const isZunda =
    window.isZundamonSelected() && window.currentModelId === "hiyori";
  let phrase = "";
  let selectedCategory = "";
  let selectedModelType = "";

  const h = new Date().getHours();
  let timeCategory = "night";
  if (h >= 5 && h < 11) timeCategory = "morning";
  else if (h >= 11 && h < 18) timeCategory = "afternoon";

  const month = new Date().getMonth() + 1;
  let seasonCategory = "winter";
  if (month >= 3 && month <= 5) seasonCategory = "spring";
  else if (month >= 6 && month <= 8) seasonCategory = "summer";
  else if (month >= 9 && month <= 11) seasonCategory = "autumn";

  const getValidPhrases = (categoryObj, customObj) => {
    let availablePhrases = [
      ...(categoryObj.general || []),
      ...(categoryObj[timeCategory] || []),
    ];
    if (categoryObj[seasonCategory]) {
      availablePhrases.push(...categoryObj[seasonCategory]);
    }
    if (customObj) {
      if (customObj.general) availablePhrases.push(...customObj.general);
      if (customObj[timeCategory])
        availablePhrases.push(...customObj[timeCategory]);
      if (customObj[seasonCategory])
        availablePhrases.push(...customObj[seasonCategory]);
    }
    // 既に喋ったものを除外
    const unreadPhrases = availablePhrases.filter(
      (p) => !spokenIdlePhrases.has(p),
    );
    return { availablePhrases: unreadPhrases, totalPhrases: availablePhrases };
  };

  const useLong = Math.random() < 0.15;
  let modelObj = null;
  let customObj = null;

  if (isZunda) {
    modelObj = useLong ? ZUNDA_LONG_STORIES : ZUNDA_PHRASES;
    customObj = useLong
      ? customIdlePhrases.ZUNDA_LONG_STORIES
      : customIdlePhrases.ZUNDA_PHRASES;
    selectedModelType = useLong ? "ZUNDA_LONG_STORIES" : "ZUNDA_PHRASES";
  } else {
    modelObj = useLong ? NORMAL_LONG_STORIES : NORMAL_PHRASES;
    customObj = useLong
      ? customIdlePhrases.NORMAL_LONG_STORIES
      : customIdlePhrases.NORMAL_PHRASES;
    selectedModelType = useLong ? "NORMAL_LONG_STORIES" : "NORMAL_PHRASES";
  }

  const { availablePhrases, totalPhrases } = getValidPhrases(
    modelObj,
    customObj,
  );

  window.aiRemakeToggle = document.getElementById("ai-idle-remake-toggle");
  window.aiApiKeyInput = document.getElementById("ai-api-key");
  const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
  window.aiProviderSelect = document.getElementById("ai-provider-select");
  const provider = aiProviderSelect ? aiProviderSelect.value : "gemini";

  let shouldRemake = aiRemakeToggle && aiRemakeToggle.checked && apiKey;

  // 配信テーマの取得
  window.streamTitle = document.getElementById("stream-title")
    ? document.getElementById("stream-title").value.trim()
    : "";
  window.aiTheme = document.getElementById("ai-stream-theme")
    ? document.getElementById("ai-stream-theme").value.trim()
    : "";
  let themeContext = "";
  let themeKeyword = aiTheme || streamTitle;
  if (themeKeyword) {
    themeContext = `今回の配信テーマや概要は「${themeKeyword}」です。ただし、このキーワードを直接オウム返しするのではなく、このテーマから連想される話題や、自然な雑談の流れとしてふんわりと関連付けてください。`;
  }

  // ラジオモードの設定取得と進行管理
  window.radioModeToggle = document.getElementById("ai-radio-mode-toggle");
  const isRadioMode = radioModeToggle && radioModeToggle.checked;

  let seToPlay = null; // 今回鳴らす効果音

  let useRadioScript = false;
  if (isRadioMode) {
    if (
      !radioModeState.scriptLines ||
      radioModeState.scriptLines.length === 0
    ) {
      console.log(
        "[ラジオモード] 台本が設定されていません。事前準備が必要です。",
      );
      return;
    }
    if (
      radioModeState.currentPhase === "none" ||
      radioModeState.currentPhase === "finished" ||
      radioModeState.currentPhase === "waiting_for_comments"
    ) {
      // ラジオモードがONの時は、再生中でなくても通常の独り言はスキップする
      return;
    }
    if (radioModeState.currentPhase === "playing") {
      useRadioScript = true;
    }
  }

  if (useRadioScript) {
    // ----- 新しいラジオモード（事前台本逐次読み上げ） -----
    const totalLines = radioModeState.scriptLines.length;
    if (radioModeState.currentScriptIndex >= totalLines) {
      radioModeState.currentPhase = "finished";
      console.log("[ラジオモード] 台本の全行を読み終わりました");

      window.playBtn = document.getElementById("radio-script-play-btn");
      window.stopBtn = document.getElementById("radio-script-stop-btn");
      if (playBtn) playBtn.style.display = "block";
      if (stopBtn) stopBtn.style.display = "none";

      // ラジオ終了時に、自動配信終了が有効なら配信終了プロセスを開始する
      window.streamEndToggle = document.getElementById("stream-end-toggle");
      if (streamEndToggle && streamEndToggle.checked) {
        if (typeof window.executeStreamEndProcess === "function") {
          window.executeStreamEndProcess();
        }
      }

      return;
    }

    // 現在の行を取得して進める
    phrase = radioModeState.scriptLines[radioModeState.currentScriptIndex];
    let yomiPhrase = phrase;
    if (
      radioModeState.scriptYomiLines &&
      radioModeState.scriptYomiLines.length > radioModeState.currentScriptIndex
    ) {
      yomiPhrase =
        radioModeState.scriptYomiLines[radioModeState.currentScriptIndex];
    }

    // 一時停止タグのパース
    if (phrase.includes("[ラジオ一時停止")) {
      console.log(
        "[ラジオモード] 一時停止タグを検出。3分間のコメント返し待機モードに入ります。",
      );
      radioModeState.currentPhase = "waiting_for_comments";

      if (
        typeof radioCommentQueue !== "undefined" &&
        radioCommentQueue.length > 0
      ) {
        console.log(
          `[ラジオモード] 溜まっていたコメント ${radioCommentQueue.length} 件を読み上げキューに移動`,
        );
        radioCommentQueue.forEach((text) => {
          queueVoicevoxAudio(text).catch((e) => console.warn(e));
        });
        radioCommentQueue = [];
      }

      window.playBtn = document.getElementById("radio-script-play-btn");
      window.stopBtn = document.getElementById("radio-script-stop-btn");
      if (playBtn) playBtn.style.display = "block";
      if (stopBtn) stopBtn.style.display = "none";

      // 読み終わった行番号を保存して、UIにも反映（一時停止タグの次の行から再開できるようにする）
      radioModeState.currentScriptIndex++;
      localStorage.setItem(
        "radioScriptLastIndex",
        radioModeState.currentScriptIndex,
      );
      window.startLineInput = document.getElementById(
        "radio-script-start-line",
      );
      if (startLineInput) {
        startLineInput.value = radioModeState.currentScriptIndex + 1;
      }

      // コメント読み上げ（キュー）が空になるのを監視し、完了したら自動で再開する
      const checkQueueInterval = setInterval(() => {
        if (radioModeState.currentPhase !== "waiting_for_comments") {
          clearInterval(checkQueueInterval);
          return;
        }
        const isQueueEmpty = typeof voicevoxAudioQueue !== "undefined" ? voicevoxAudioQueue.length === 0 : (window.voicevoxAudioQueue ? window.voicevoxAudioQueue.length === 0 : true);
        const isPlaying = typeof isVoicevoxPlaying !== "undefined" ? isVoicevoxPlaying : !!window.isVoicevoxPlaying;
        if (isQueueEmpty && !isPlaying) {
          clearInterval(checkQueueInterval);
          console.log(
            "[ラジオモード] コメント読み上げキューが空になったため、間もなく自動再生を再開します。",
          );

          // コメントの余韻を残すため、少しだけ待機（3秒）してから再開
          setTimeout(() => {
            if (radioModeState.currentPhase === "waiting_for_comments") {
              console.log("[ラジオモード] 自動再生を再開します。");
              radioModeState.currentPhase = "playing";
              window.currentPlayBtn = document.getElementById(
                "radio-script-play-btn",
              );
              if (currentPlayBtn && currentPlayBtn.style.display !== "none") {
                currentPlayBtn.click();
              } else {
                triggerIdleSpeech();
              }
            }
          }, 3000);
        }
      }, 1000);

      resetIdleTimer();
      return;
    }

    radioModeState.currentScriptIndex++;

    // 読み終わった行番号を保存して、UIにも反映
    localStorage.setItem(
      "radioScriptLastIndex",
      radioModeState.currentScriptIndex,
    );
    window.startLineInput = document.getElementById("radio-script-start-line");
    if (startLineInput) {
      startLineInput.value = radioModeState.currentScriptIndex + 1; // 次に読む行
    }

    console.log(
      `[ラジオモード] ${radioModeState.currentScriptIndex}/${totalLines}行目: ${phrase.substring(0, 30)}...`,
    );

    // [SE: 〇〇] のパース
    const seMatch = phrase.match(/\[SE:\s*(.+?)\]/);
    if (seMatch) {
      seToPlay = seMatch[1].trim();
      phrase = phrase.replace(/\[SE:\s*.+?\]/g, "").trim();
    }
    const seMatchYomi = yomiPhrase.match(/\[SE:\s*(.+?)\]/);
    if (seMatchYomi) {
      yomiPhrase = yomiPhrase.replace(/\[SE:\s*.+?\]/g, "").trim();
    }
  } else {
    // ----- 通常モード（既存辞書 or AI完全新規） -----
    if (availablePhrases.length === 0) {
      spokenIdlePhrases.clear(); // 辞書リセット
    }
    const rawPhrase =
      availablePhrases.length > 0
        ? availablePhrases[Math.floor(Math.random() * availablePhrases.length)]
        : null;

    if (shouldRemake) {
      // 外部プロンプト（prompts.json）からロード＆展開
      let prompt = "";
      if (typeof window.PromptLoader !== "undefined" && typeof window.PromptLoader.getFormattedPrompt === "function") {
        prompt = await window.PromptLoader.getFormattedPrompt("idle_speech", {
          seasonCategory,
          timeCategory,
          themeContext,
          zundaPrompt: isZunda ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。" : ""
        });
      }
      if (!prompt) {
        prompt = `あなたは配信者です。今の季節は「${seasonCategory}」、時間帯は「${timeCategory}」です。${themeContext}配信中の自然な独り言を1〜2文で生成してください。${isZunda ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。" : ""}`;
      }

      const generatedPhrase = await aiFeatures.callAI(
        prompt,
        apiKey,
        provider,
        true,
      );
      if (generatedPhrase) {
        phrase = generatedPhrase;
        if (rawPhrase) spokenIdlePhrases.add(rawPhrase); // 内部的な進行のため消費
      } else {
        phrase = rawPhrase; // エラー時フォールバック
      }
    } else {
      // AI機能OFFの場合は既存のフレーズ
      phrase = rawPhrase;
    }
  }

  if (phrase) {
    spokenIdlePhrases.add(phrase);
  }

  // 感情アニメーションの設定
  if (phrase.includes("チラッ")) {
    aiEmotion = "glance";
  } else if (
    phrase.includes("だめだめ") ||
    phrase.includes("ひどくない") ||
    phrase.includes("はずかしかった")
  ) {
    aiEmotion = "sad";
  } else {
    aiEmotion = "joy";
  }

  // モデルに応じた語尾の調整や一人称の置換は、キャラの個性を出すために台本モードでも適用する
  phrase = aiFeatures.adjustIdlePhraseForModel(phrase, currentModelId);
  if (typeof yomiPhrase !== "undefined") {
    yomiPhrase = aiFeatures.adjustIdlePhraseForModel(
      yomiPhrase,
      currentModelId,
    );
  }

  window.idleFirstPerson = document.getElementById("idle-first-person");
  if (idleFirstPerson && idleFirstPerson.value) {
    const fp = idleFirstPerson.value;
    phrase = phrase.replace(
      /わたくし|わたし|あたし|私(?![一-龠々])|ぼく|僕(?![一-龠々])|おれ|俺(?![一-龠々])|うち/g,
      fp,
    );
    if (typeof yomiPhrase !== "undefined")
      yomiPhrase = yomiPhrase.replace(
        /わたくし|わたし|あたし|私(?![一-龠々])|ぼく|僕(?![一-龠々])|おれ|俺(?![一-龠々])|うち/g,
        fp,
      );
  }

  // 事前台本（ラジオモード）の場合は、リスナーの呼称（二人称）の強制置換のみ行わない
  if (!isRadioMode) {
    window.idleSecondPerson = document.getElementById("idle-second-person");
    if (idleSecondPerson && idleSecondPerson.value) {
      const sp = idleSecondPerson.value;
      phrase = phrase.replace(
        /リスナーのみなさん|視聴者のみなさん|リスナーのみんな|視聴者のみんな|みんな|あなた|君|きみ|お前|リスナーさん|リスナー|視聴者さん/g,
        sp,
      );
      if (typeof yomiPhrase !== "undefined")
        yomiPhrase = yomiPhrase.replace(
          /リスナーのみなさん|視聴者のみなさん|リスナーのみんな|視聴者のみんな|みんな|あなた|君|きみ|お前|リスナーさん|リスナー|視聴者さん/g,
          sp,
        );
    }
  }

  const logPrefix = useRadioScript ? "[ラジオ台本]" : "[独り言]";
  console.log(`${logPrefix} ${phrase}`);

  // 独り言も会話履歴に追加し、視聴者が独り言に反応した時に文脈が繋がるようにする
  if (typeof aiChatHistory !== "undefined") {
    aiChatHistory.push({ role: "assistant", content: phrase });
    if (aiChatHistory.length > 10) aiChatHistory.shift();
  }

  if (typeof seToPlay !== "undefined" && seToPlay) {
    console.log(`[SE再生] ${seToPlay}`);
    (async () => {
      try {
        // まずvoicevoxAudioContextが初期化・解除済みであることを確認
        const ctx = typeof getVoicevoxAudioContext === "function" ? getVoicevoxAudioContext() : (window.voicevoxAudioContext || new (window.AudioContext || window.webkitAudioContext)());
        if (ctx.state === "suspended" || ctx.state === "interrupted") {
          await ctx.resume().catch(() => {});
        }
        // mp3を優先、失敗したらwavを試みる
        const tryFetch = async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.arrayBuffer();
        };
        let arrayBuffer;
        try {
          arrayBuffer = await tryFetch(`se/${seToPlay}.mp3`);
        } catch {
          arrayBuffer = await tryFetch(`se/${seToPlay}.wav`);
        }
        const audioBuffer =
          await ctx.decodeAudioData(arrayBuffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        window.seVolSlider = document.getElementById("se-volume-slider");
        const seVol = seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 1.0;

        const seGainNode = voicevoxAudioContext.createGain();
        seGainNode.gain.value = seVol;

        source.connect(seGainNode);
        seGainNode.connect(voicevoxAudioContext.destination);

        source.onended = () => {
          source.disconnect();
          seGainNode.disconnect();
        };

        source.start(0);
      } catch (e) {
        console.warn(`[SE再生エラー] ${seToPlay}:`, e.message);
      }
    })();
  }

  if (!phrase) {
    // テキストがない（SEのみだった）場合、VOICEVOXは呼ばずに次の行をスケジュール
    window.radioModeToggle = document.getElementById("ai-radio-mode-toggle");
    if (radioModeToggle && radioModeToggle.checked) {
      // SEが鳴る時間を考慮して少し長めに待ってから次へ
      setTimeout(() => triggerIdleSpeech(), 2500);
    }
    return;
  }

  if (typeof yomiPhrase !== "undefined" && yomiPhrase) {
    queueVoicevoxAudio(phrase, true, yomiPhrase);
  } else {
    queueVoicevoxAudio(phrase, true);
  }
};

window.resetIdleTimer = function () {
  clearIdleTimer();
  const isNewsRunning = window.newsBroadcastState && window.newsBroadcastState.isRunning;
  const isNewsMode = window.currentBroadcastMode === "news";
  const isRadioModeActive = window.currentBroadcastMode === "radio" || (document.getElementById("ai-radio-mode-toggle")?.checked);
  const isEnded = (typeof isStreamEndedState !== "undefined" && isStreamEndedState) || (typeof isStreamEndProcessRunning !== "undefined" && isStreamEndProcessRunning);

  if (isNewsRunning || isNewsMode || isRadioModeActive || isEnded) {
    return;
  }

  const isVoicevoxOn = typeof isVoicevoxEnabled !== "undefined" ? isVoicevoxEnabled : !!window.isVoicevoxEnabled;
  const isIdleSpeechOn = typeof isIdleSpeechEnabled !== "undefined" ? isIdleSpeechEnabled : !!window.isIdleSpeechEnabled;

  if (isVoicevoxOn && isIdleSpeechOn) {
    // UI上の設定(5秒)に合わせる (5秒〜10秒のランダム)
    const delay = 5000 + Math.random() * 5000;
    idleSpeechTimer = setTimeout(triggerIdleSpeech, delay);
  }
};

// ひらがな変換キャッシュは上部で宣言し、loadHiraganaDataで読み込み済み

// =====================================================================
// =====================================================================
