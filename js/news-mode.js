async function playNextContinuousNews(isOneOff = false) {
  if (isReadingNews) return;
  if (!isOneOff && !isContinuousNewsMode) return;

  // --- 終了1分前チェック ---
  const autoEndToggle = document.getElementById("stream-end-toggle");
  const endTimeInput = document.getElementById("stream-end-time");
  if (
    !isOneOff &&
    autoEndToggle &&
    autoEndToggle.checked &&
    endTimeInput &&
    endTimeInput.value
  ) {
    const now = new Date();
    const [targetH, targetM] = endTimeInput.value.split(":").map(Number);
    const targetDate = new Date();
    targetDate.setHours(targetH, targetM, 0, 0);

    // もし目標時刻が過去になっていたら明日にする
    if (targetDate < now) targetDate.setDate(targetDate.getDate() + 1);

    const diffSec = (targetDate - now) / 1000;
    console.log(
      `[ニュースモード] 自動終了時刻までの残り時間: ${Math.floor(diffSec)}秒`,
    );

    if (diffSec > 0 && diffSec <= 60) {
      // 終了1分前を切った！
      console.log(
        "[ニュースモード] 終了1分前を切ったため、連続モードを終了して締めの挨拶に入ります。",
      );
      isContinuousNewsMode = false;
      if (newsContinuousToggle) newsContinuousToggle.checked = false;

      // 締めの挨拶
      const isZunda =
        currentModelId === "zundamon" || currentModelId === "zundamon_human";
      const zundaPrompt = isZunda
        ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。"
        : "";
      const prompt = `あなたはVTuberの配信者です。配信の終了時間が1分後に迫っています。これまで読んでいたニュースコーナーを締めくくり、リスナーに向けて「本日のニュースは以上になります。それでは、配信終了のお時間までごゆっくりお過ごしください！」といった内容の挨拶を1〜2文で述べてください。余計な説明や括弧書きは不要です。${zundaPrompt}`;

      const apiKeyInput = document.getElementById("ai-api-key");
      const providerSelect = document.getElementById("ai-provider-select");

      if (apiKeyInput && apiKeyInput.value.trim()) {
        const text = await aiFeatures.callAI(
          prompt,
          apiKeyInput.value.trim(),
          providerSelect ? providerSelect.value : "gemini",
          true,
        );
        if (text) {
          let phraseToSpeak = aiFeatures.adjustIdlePhraseForModel(
            text,
            currentModelId,
          );
          queueVoicevoxAudio(phraseToSpeak, true).catch((e) => console.warn(e));
        }
      }
      return;
    }
  }

  isReadingNews = true;

  try {
    const rssUrl = newsRssUrlInput
      ? newsRssUrlInput.value.trim()
      : "https://www.nhk.or.jp/rss/news/cat0.xml";
    if (!rssUrl) throw new Error("RSS URLが設定されていません");

    const apiKeyInput = document.getElementById("ai-api-key");
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
    if (!apiKey) throw new Error("AIのAPIキー（Gemini等）が設定されていません");

    // キューが空ならRSSから取得
    if (continuousNewsItems.length === 0) {
      console.log("[ニュースモード] RSSからニュースを取得中...");
      const res = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
      );
      const json = await res.json();
      if (json.status !== "ok" || !json.items || json.items.length === 0) {
        throw new Error("ニュースを取得できませんでした。");
      }
      // ランダムに並び替えてプールに入れる
      continuousNewsItems = json.items.sort(() => Math.random() - 0.5);
    }

    const item = continuousNewsItems.shift();

    // 画面表示
    newsArticleTitle.textContent = item.title;
    const tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = item.description || "";
    let plainDesc = tmpDiv.textContent || tmpDiv.innerText || "";
    if (plainDesc.length > 100) plainDesc = plainDesc.substring(0, 100) + "...";
    newsArticleDesc.textContent = plainDesc;
    newsArticleDate.textContent = item.pubDate
      ? new Date(item.pubDate.replace(/-/g, "/")).toLocaleString()
      : new Date().toLocaleString();

    newsBoard.classList.add("active");

    // 独り言一時停止
    if (typeof clearIdleTimer === "function") clearIdleTimer();

    // プロンプト作成
    const providerSelect = document.getElementById("ai-provider-select");
    const provider = providerSelect ? providerSelect.value : "gemini";
    const isZunda =
      currentModelId === "zundamon" || currentModelId === "zundamon_human";
    const zundaPrompt = isZunda
      ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。"
      : "";

    let introInstruction = isOneOff
      ? "まずリスナーに向けて1文で要約して紹介し"
      : "「次のニュースです」などと一言添えてからリスナーに向けて1文で要約し";

    const prompt = `あなたはVTuberの配信者です。以下のニュース記事について、${introInstruction}、続けてあなた自身の率直な感想やリアクションを1〜2文で述べてください。余計な説明や括弧書きは不要です。${zundaPrompt}
        
【ニュースタイトル】
${item.title}

【概要】
${plainDesc}`;

    console.log("[ニュースモード] AIにリクエスト中...");
    const generatedText = await aiFeatures.callAI(
      prompt,
      apiKey,
      provider,
      true,
    );

    // API待機中に配信終了画面になった場合は中断する
    if (typeof isStreamEndedState !== "undefined" && isStreamEndedState) {
      console.log(
        "[ニュースモード] 配信終了状態になったため、ニュースの読み上げを中断します。",
      );
      newsBoard.classList.remove("active");
      isReadingNews = false;
      return;
    }

    if (generatedText) {
      // VOICEVOXにキュー追加
      setTimeout(() => {
        let phraseToSpeak = aiFeatures.adjustIdlePhraseForModel(
          generatedText,
          currentModelId,
        );
        const idleFirstPerson = document.getElementById("idle-first-person");
        if (idleFirstPerson && idleFirstPerson.value) {
          const fp = idleFirstPerson.value;
          phraseToSpeak = phraseToSpeak.replace(
            /わたくし|わたし|あたし|私|ぼく|僕|おれ|俺|うち/g,
            fp,
          );
        }

        if (typeof aiChatHistory !== "undefined") {
          aiChatHistory.push({ role: "assistant", content: phraseToSpeak });
          if (aiChatHistory.length > 10) aiChatHistory.shift();
        }

        queueVoicevoxAudio(phraseToSpeak, true).catch((e) => console.warn(e));

        // 読み上げ完了を監視
        const checkInterval = setInterval(() => {
          const isDone =
            (typeof voicevoxAudioQueue !== "undefined"
              ? voicevoxAudioQueue.length === 0
              : true) &&
            (typeof isVoicevoxPlaying !== "undefined"
              ? !isVoicevoxPlaying
              : true);
          if (isDone) {
            clearInterval(checkInterval);
            setTimeout(() => {
              newsBoard.classList.remove("active");
              isReadingNews = false;

              if (isOneOff) {
                if (typeof resetIdleTimer === "function") resetIdleTimer();
              } else if (isContinuousNewsMode) {
                // 連続モードの場合は数秒後に次へ
                setTimeout(() => {
                  playNextContinuousNews();
                }, 4000);
              } else {
                if (typeof resetIdleTimer === "function") resetIdleTimer();
              }
            }, 3000);
          }
        }, 1000);
      }, 1000);
    } else {
      throw new Error("AIがテキストを生成しませんでした");
    }
  } catch (error) {
    console.error("[ニュースモード] エラー:", error);
    newsArticleDesc.textContent = "エラーが発生しました: " + error.message;
    setTimeout(() => {
      newsBoard.classList.remove("active");
      isReadingNews = false;

      if (isContinuousNewsMode) {
        // エラーでも数秒後にリトライ
        setTimeout(() => {
          playNextContinuousNews();
        }, 10000);
      } else {
        if (typeof resetIdleTimer === "function") resetIdleTimer();
      }
    }, 3000);
  }
}

window.playNextContinuousNews = playNextContinuousNews;

window.addEventListener("uiLoaded", () => {
  if (window.newsFetchBtn) {
    window.newsFetchBtn.addEventListener("click", () => {
      if (!window.newsBoard) return;
      window.isContinuousNewsMode = false;
      if (window.newsContinuousToggle)
        window.newsContinuousToggle.checked = false;
      window.continuousNewsItems = []; // リセット
      window.playNextContinuousNews(true);
    });
  }

  if (window.newsContinuousToggle) {
    window.newsContinuousToggle.addEventListener("change", (e) => {
      window.isContinuousNewsMode = e.target.checked;
      if (window.isContinuousNewsMode) {
        window.continuousNewsItems = []; // 新しく始める
        if (!window.isReadingNews) window.playNextContinuousNews(false);
      }
    });
  }
});
