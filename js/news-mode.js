let readNewsTitles = new Set(JSON.parse(localStorage.getItem("newsReadTitles") || "[]")); // 既読ニュースのタイトルを保持するセット
try {
  const savedNews = localStorage.getItem("latestFetchedNews");
  if (savedNews) {
    window.latestFetchedNews = JSON.parse(savedNews);
  }
} catch (e) { }
try {
  window.latestFetchedNews = JSON.parse(localStorage.getItem("latestFetchedNews") || "[]");
} catch (e) {
  window.latestFetchedNews = [];
}

const NEWS_CATEGORIES = {
  "cat_top": ["https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/top-picks.xml", "https://www.nhk.or.jp/rss/news/cat0.xml"],
  "cat_society": ["https://news.google.com/news/rss/headlines/section/topic/NATION?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/domestic.xml", "https://www.nhk.or.jp/rss/news/cat1.xml"],
  "cat_world": ["https://news.google.com/news/rss/headlines/section/topic/WORLD?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/world.xml", "https://www.nhk.or.jp/rss/news/cat6.xml"],
  "cat_business": ["https://news.google.com/news/rss/headlines/section/topic/BUSINESS?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/business.xml", "https://www.nhk.or.jp/rss/news/cat5.xml"],
  "cat_politics": ["https://www.nhk.or.jp/rss/news/cat4.xml"],
  "cat_entertainment": ["https://news.google.com/news/rss/headlines/section/topic/ENTERTAINMENT?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/entertainment.xml", "https://www.nhk.or.jp/rss/news/cat2.xml"],
  "cat_sports": ["https://news.google.com/news/rss/headlines/section/topic/SPORTS?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/sports.xml", "https://www.nhk.or.jp/rss/news/cat7.xml"],
  "cat_tech": ["https://news.google.com/news/rss/headlines/section/topic/TECHNOLOGY?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/it.xml", "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml"],
  "cat_science": ["https://news.yahoo.co.jp/rss/topics/science.xml", "https://www.nhk.or.jp/rss/news/cat3.xml"],
  "cat_local": ["https://news.yahoo.co.jp/rss/topics/local.xml"]
};

const CATEGORY_NAMES = {
  "cat_top": "総合",
  "cat_society": "国内・社会",
  "cat_world": "国際・世界",
  "cat_business": "経済・ビジネス",
  "cat_politics": "政治",
  "cat_entertainment": "エンタメ・カルチャー",
  "cat_sports": "スポーツ",
  "cat_tech": "IT・テクノロジー",
  "cat_science": "科学・医療",
  "cat_local": "地域"
};

async function playNextContinuousNews(isOneOff = false, isFetchOnly = false) {
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
    let rssUrl = "https://www.nhk.or.jp/rss/news/cat0.xml";
    if (window.newsRssSelect) {
      if (window.newsRssSelect.value === "custom") {
        rssUrl = newsRssUrlInput ? newsRssUrlInput.value.trim() : "";
      } else {
        rssUrl = window.newsRssSelect.value;
      }
    } else {
      rssUrl = newsRssUrlInput ? newsRssUrlInput.value.trim() : "https://www.nhk.or.jp/rss/news/cat0.xml";
    }

    if (!rssUrl) throw new Error("RSS URLが設定されていません");

    const apiKeyInput = document.getElementById("ai-api-key");
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
    if (!apiKey) throw new Error("AIのAPIキー（Gemini等）が設定されていません");

    // キューが空ならRSSから取得
    if (continuousNewsItems.length === 0) {
      let sourceName = "カスタムURL";
      let fetchTargets = [];

      if (rssUrl === "cat_all") {
        sourceName = "全て（全カテゴリを一括取得）";
        for (const catKey of Object.keys(NEWS_CATEGORIES)) {
          NEWS_CATEGORIES[catKey].forEach(u => {
            fetchTargets.push({ url: u, categoryKey: catKey, categoryName: CATEGORY_NAMES[catKey] });
          });
        }
      } else if (window.newsRssSelect && window.newsRssSelect.value !== "custom") {
        sourceName = window.newsRssSelect.options[window.newsRssSelect.selectedIndex].text;
        if (NEWS_CATEGORIES[rssUrl]) {
          NEWS_CATEGORIES[rssUrl].forEach(u => {
            fetchTargets.push({ url: u, categoryKey: rssUrl, categoryName: CATEGORY_NAMES[rssUrl] });
          });
        } else {
          fetchTargets.push({ url: rssUrl, categoryKey: "custom", categoryName: sourceName });
        }
      } else {
        fetchTargets.push({ url: rssUrl, categoryKey: "custom", categoryName: sourceName });
      }

      console.log(`[ニュースモード] 【${sourceName}】RSSからニュースを取得中... (${fetchTargets.length}サイト)`);

      let allParsedItems = [];
      const fetchPromises = fetchTargets.map(async (target) => {
        try {
          const res = await fetch("/fetch_rss", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: target.url })
          });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const xmlText = await res.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          const itemsNodes = Array.from(xmlDoc.querySelectorAll("item"));
          return itemsNodes.map((node) => {
            const titleNode = node.querySelector("title");
            const descNode = node.querySelector("description");
            const pubDateNode = node.querySelector("pubDate") || node.querySelector("date");

            let publisherName = "その他";
            if (target.url.includes('yahoo.co.jp')) publisherName = 'Yahoo!';
            else if (target.url.includes('google.com')) publisherName = 'Google';
            else if (target.url.includes('nhk.or.jp')) publisherName = 'NHK';
            else if (target.url.includes('itmedia.co.jp')) publisherName = 'ITmedia';

            return {
              title: titleNode ? titleNode.textContent : "",
              description: descNode ? descNode.textContent : "",
              pubDate: pubDateNode ? pubDateNode.textContent : "",
              categoryName: target.categoryName,
              categoryKey: target.categoryKey,
              publisherName: publisherName
            };
          });
        } catch (e) {
          console.warn(`[ニュースモード] 取得失敗 (${target.url}):`, e);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(items => {
        allParsedItems = allParsedItems.concat(items);
      });

      if (allParsedItems.length === 0) {
        throw new Error("ニュースが見つかりませんでした。");
      }

      // 重複排除（タイトルが同じものは除外）
      const uniqueItemsMap = new Map();
      allParsedItems.forEach(item => {
        if (item.title && !uniqueItemsMap.has(item.title)) {
          uniqueItemsMap.set(item.title, item);
        }
      });
      const parsedItems = Array.from(uniqueItemsMap.values());

      // 日付フィルタリング
      const dateStartInput = document.getElementById("news-date-start");
      const dateEndInput = document.getElementById("news-date-end");
      let startTimestamp = -Infinity;
      let endTimestamp = Infinity;

      if (dateStartInput && dateStartInput.value) {
        const d = new Date(dateStartInput.value);
        d.setHours(0, 0, 0, 0);
        startTimestamp = d.getTime();
      }
      if (dateEndInput && dateEndInput.value) {
        const d = new Date(dateEndInput.value);
        d.setHours(23, 59, 59, 999);
        endTimestamp = d.getTime();
      }

      const filteredItems = parsedItems.filter(item => {
        if (!item.pubDate) return true;
        const itemDate = new Date(item.pubDate).getTime();
        if (isNaN(itemDate)) return true;
        return itemDate >= startTimestamp && itemDate <= endTimestamp;
      });

      // 取得したリストを全体保存
      window.latestFetchedNews = filteredItems;
      try {
        localStorage.setItem("latestFetchedNews", JSON.stringify(filteredItems));
      } catch (e) { }
      if (typeof window.updateNewsListPopup === "function") {
        window.updateNewsListPopup();
      }

      // 取得元/カテゴリ名をセット
      const categorySpan = document.getElementById("news-board-category");
      if (categorySpan) {
        categorySpan.textContent = sourceName;
      }

      // 未読のニュースのみを抽出
      const unreadItems = filteredItems.filter(item => !readNewsTitles.has(item.title));

      if (unreadItems.length === 0) {
        console.log("[ニュースモード] 新しいニュースはありません。連続モードを終了します。");
        isContinuousNewsMode = false;
        if (newsContinuousToggle) newsContinuousToggle.checked = false;

        const providerSelect = document.getElementById("ai-provider-select");
        const provider = providerSelect ? providerSelect.value : "gemini";
        const isZunda = currentModelId === "zundamon" || currentModelId === "zundamon_human";
        const zundaPrompt = isZunda ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。" : "";
        const prompt = `あなたはVTuberの配信者です。先ほどまでニュースを読んでいましたが、現在の最新ニュースをすべて読み終えました。リスナーに向けて「現在の最新ニュースは以上になります！また新しいニュースが入ったらお伝えしますね！」といった内容の締めの挨拶を1文で述べてください。余計な説明は不要です。${zundaPrompt}`;

        const text = await aiFeatures.callAI(prompt, apiKey, provider, true);
        if (text) {
          let phraseToSpeak = aiFeatures.adjustIdlePhraseForModel(text, currentModelId);
          queueVoicevoxAudio(phraseToSpeak, true).catch((e) => console.warn(e));

          // 締めの挨拶が完了したあとにフラグを解除する
          const checkInterval = setInterval(() => {
            const isDone =
              (typeof voicevoxAudioQueue !== "undefined" ? voicevoxAudioQueue.length === 0 : true) &&
              (typeof isVoicevoxPlaying !== "undefined" ? !isVoicevoxPlaying : true);
            if (isDone) {
              clearInterval(checkInterval);
              isReadingNews = false;
              if (typeof resetIdleTimer === "function") resetIdleTimer();
            }
          }, 1000);
        } else {
          isReadingNews = false;
        }
        return;
      }

      if (rssUrl === "cat_all") {
        // 全ての場合は、カテゴリ毎＆古い順にソートする
        const catOrder = Object.keys(NEWS_CATEGORIES);
        continuousNewsItems = unreadItems.sort((a, b) => {
          const idxA = catOrder.indexOf(a.categoryKey);
          const idxB = catOrder.indexOf(b.categoryKey);
          if (idxA !== idxB) {
            return idxA - idxB;
          }
          const dateA = new Date(a.pubDate || 0).getTime();
          const dateB = new Date(b.pubDate || 0).getTime();
          return dateA - dateB; // 昇順（古い順）
        });
      } else {
        // ランダムに並び替えてプールに入れる
        continuousNewsItems = unreadItems.sort(() => Math.random() - 0.5);
      }
    }

    if (isFetchOnly) {
      console.log("[ニュースモード] 取得のみ完了しました。");
      const fetchedCount = window.latestFetchedNews ? window.latestFetchedNews.length : 0;
      alert(`ニュースの取得が完了しました！（${fetchedCount}件）\n「取得したニュース一覧を確認」から確認できます。`);
      return;
    }

    const item = continuousNewsItems.shift();
    readNewsTitles.add(item.title);

    // 肥大化防止（200件を超えたら古いものを削除したいが、Setなので一旦200件でクリアする等の簡易処理、または配列変換して削減）
    if (readNewsTitles.size > 200) {
      const arr = Array.from(readNewsTitles);
      readNewsTitles = new Set(arr.slice(arr.length - 100)); // 最新100件を残す
    }
    localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles)));

    // 別ウィンドウのニュース一覧が開いていれば更新
    if (typeof window.updateNewsListPopup === "function") {
      window.updateNewsListPopup();
    }


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

    const categorySpanForLog = document.getElementById("news-board-category");
    const catName = item.categoryName || (categorySpanForLog ? categorySpanForLog.textContent : "ニュース");
    const publisherName = item.publisherName || "";
    const displayCatName = publisherName ? `${catName} / ${publisherName}` : catName;
    if (categorySpanForLog) {
      categorySpanForLog.textContent = displayCatName;
    }
    console.log(`[ニュースモード] 【${displayCatName}】AIにリクエスト中...`);

    const modelInput = document.getElementById("ai-model-input");
    const modelName = (modelInput ? modelInput.value.trim() : "") || localStorage.getItem("savedAiModel") || (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash");

    let scriptItems = [];
    try {
      const res = await fetch("/api/news/generate_item_script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          description: plainDesc,
          categoryName: item.categoryName || "",
          modelId: currentModelId,
          isFirst: isOneOff,
          isCategoryChanged: false,
          apiKey: apiKey,
          provider: provider,
          modelName: modelName
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok" && Array.isArray(data.items) && data.items.length > 0) {
          scriptItems = data.items;
        }
      }
    } catch (apiErr) {
      console.warn("[ニュースモード] AI原稿API呼び出し失敗:", apiErr);
    }

    // API待機中に配信終了画面になった場合は中断する
    if (typeof isStreamEndedState !== "undefined" && isStreamEndedState) {
      console.log(
        "[ニュースモード] 配信終了状態になったため、ニュースの読み上げを中断します。",
      );
      newsBoard.classList.remove("active");
      isReadingNews = false;
      return;
    }

    if (scriptItems.length === 0) {
      console.warn("[ニュースモード] AI生成が空欄のため、フォールバック原稿を使用します");
      const isZunda = currentModelId === "zundamon" || currentModelId === "zundamon_human";
      const prefix = isOneOff ? "" : (isZunda ? "次のニュースなのだ！" : "次のニュースですにゃ！");
      const suffix = isZunda ? "なのだ。" : "にゃ。";
      const fallbackText = `${prefix} ${item.title}。${plainDesc ? plainDesc.slice(0, 100) : ""}${suffix}`;
      scriptItems = [{ display: fallbackText, speech: fallbackText }];
    }

    // 各文をVOICEVOXに順次キュー追加して再生
    setTimeout(() => {
      const idleFirstPerson = document.getElementById("idle-first-person");
      const fp = idleFirstPerson ? idleFirstPerson.value : "";

      scriptItems.forEach((sItem) => {
        let displayTxt = sItem.display || sItem.speech;
        let speechTxt = sItem.speech || sItem.display;

        displayTxt = aiFeatures.adjustIdlePhraseForModel(displayTxt, currentModelId);
        speechTxt = aiFeatures.adjustIdlePhraseForModel(speechTxt, currentModelId);

        if (fp) {
          displayTxt = displayTxt.replace(/わたくし|わたし|あたし|私|ぼく|僕|おれ|俺|うち/g, fp);
          speechTxt = speechTxt.replace(/わたくし|わたし|あたし|私|ぼく|僕|おれ|俺|うち/g, fp);
        }

        if (typeof aiChatHistory !== "undefined") {
          aiChatHistory.push({ role: "assistant", content: displayTxt });
          if (aiChatHistory.length > 10) aiChatHistory.shift();
        }

        queueVoicevoxAudio(speechTxt, true, displayTxt).catch((e) => console.warn(e));
      });

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

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("news-mode", () => {
  window.newsRssSelect = document.getElementById("news-rss-select");
  const localNewsRssUrlInput = document.getElementById("news-rss-url");
  if (window.newsRssSelect && localNewsRssUrlInput) {
    const savedCat = localStorage.getItem("savedNewsCategory");
    if (savedCat) {
      window.newsRssSelect.value = savedCat;
      if (savedCat === "custom") {
        localNewsRssUrlInput.style.display = "block";
      } else {
        localNewsRssUrlInput.style.display = "none";
      }
    }

    // セレクトボックスの変更時にカスタムURL入力欄の表示/非表示を切り替える
    window.newsRssSelect.addEventListener("change", (e) => {
      localStorage.setItem("savedNewsCategory", e.target.value);
      if (e.target.value === "custom") {
        localNewsRssUrlInput.style.display = "block";
      } else {
        localNewsRssUrlInput.style.display = "none";
      }
      // ユーザーの手動操作(isTrusted=true)による変更の場合のみ既読リストをリセットする
      // (自動保存スクリプトによるページ読み込み時の復元処理ではリセットしない)
      if (e.isTrusted) {
        readNewsTitles.clear();
        localStorage.setItem("newsReadTitles", JSON.stringify([]));
        window.continuousNewsItems = [];
        window.latestFetchedNews = [];
      }
    });
  }

  window.newsListPopup = window.newsListPopup || null;
  window.updateNewsListPopup = function () {
    if (!window.newsListPopup || window.newsListPopup.closed) {
      try {
        const w = window.open("", "NewsList");
        if (w && !w.closed && w.document && w.document.getElementById("news-list-container")) {
          window.newsListPopup = w;
        } else {
          return;
        }
      } catch (e) {
        return;
      }
    }
    const doc = window.newsListPopup.document;
    const container = doc.getElementById("news-list-container");
    if (!container) return;

    if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) {
      try {
        const saved = localStorage.getItem("latestFetchedNews");
        if (saved) window.latestFetchedNews = JSON.parse(saved);
      } catch (e) { }
    }

    container.innerHTML = "";
    if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) {
      container.innerHTML = '<p style="color:#aaa; font-size:0.8rem; text-align:center; padding:20px;">まだニュースが取得されていません。<br><span style="font-size:0.75rem; color:#888;">「⬇️ ニュースを取得」を押してください。</span></p>';
      return;
    }

    const CATEGORY_ORDER = ["cat_top", "cat_society", "cat_world", "cat_business", "cat_politics", "cat_entertainment", "cat_sports", "cat_tech", "cat_science", "cat_local"];
    const sortedNews = [...window.latestFetchedNews].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.categoryKey || "cat_top");
      const bi = CATEGORY_ORDER.indexOf(b.categoryKey || "cat_top");
      const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      if (catDiff !== 0) return catDiff;
      const dateA = new Date(a.pubDate || 0).getTime();
      const dateB = new Date(b.pubDate || 0).getTime();
      return dateA - dateB; // カテゴリ内は古い順（時系列昇順: 朝➔夜）
    });

    const currentRead = window.readNewsTitles || readNewsTitles || new Set();
    let storedReadList = [];
    try {
      storedReadList = JSON.parse(localStorage.getItem("newsReadTitles") || "[]");
    } catch (e) {}

    const progressEl = document.getElementById("news-broadcast-progress") || document.getElementById("news-setlist-progress-badge");
    const m = progressEl ? (progressEl.textContent || "").match(/(\d+)\s*\/\s*(\d+)/) : null;
    const curIdx = m ? parseInt(m[1], 10) : ((window.newsBroadcastState && window.newsBroadcastState.currentIndex) || 0);
    const isBroadcasting = m !== null || (window.newsBroadcastState && window.newsBroadcastState.isRunning);
    const curTitle = (document.getElementById("news-title") ? document.getElementById("news-title").textContent.trim() : "") || (window.newsBroadcastState && window.newsBroadcastState.currentTitle) || "";

    sortedNews.forEach((item, idx) => {
      const isCurrentByTitle = curTitle && item.title && (item.title.includes(curTitle.slice(0, 10)) || curTitle.includes(item.title.slice(0, 10)));
      const isPlaying = isBroadcasting && (isCurrentByTitle || (curIdx > 0 && idx === curIdx - 1));
      const isRead = isBroadcasting ? ((curIdx > 0 && idx < curIdx - 1) || (!isPlaying && isCurrentByTitle)) : (currentRead.has(item.title) || storedReadList.includes(item.title));

      const card = doc.createElement("div");
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "6px";
      card.style.padding = "10px 14px";
      card.style.background = isPlaying
        ? "linear-gradient(135deg, rgba(0, 230, 118, 0.16), rgba(0, 230, 118, 0.06))"
        : (isRead ? "rgba(255, 255, 255, 0.03)" : "linear-gradient(135deg, rgba(108, 92, 231, 0.12), rgba(255, 255, 255, 0.04))");
      card.style.borderRadius = "8px";
      card.style.border = isPlaying
        ? "1px solid rgba(0, 230, 118, 0.45)"
        : (isRead ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(108, 92, 231, 0.25)");
      card.style.borderLeft = isPlaying
        ? "4px solid #00e676"
        : (isRead ? "4px solid #555" : "4px solid #6c5ce7");
      card.style.transition = "all 0.2s ease";

      // 上段: 番号 + バッジ + カテゴリ/配信元/日時 + 右端の再開ボタン
      const headerRow = doc.createElement("div");
      headerRow.style.display = "flex";
      headerRow.style.alignItems = "center";
      headerRow.style.justifyContent = "space-between";
      headerRow.style.gap = "8px";

      const leftMeta = doc.createElement("div");
      leftMeta.style.display = "flex";
      leftMeta.style.alignItems = "center";
      leftMeta.style.gap = "6px";
      leftMeta.style.flexWrap = "wrap";

      const numBadge = doc.createElement("span");
      numBadge.style.fontSize = "0.78rem";
      numBadge.style.color = isPlaying ? "#00e676" : (isRead ? "#777" : "#a29bfe");
      numBadge.style.fontFamily = "monospace";
      numBadge.style.fontWeight = "bold";
      numBadge.textContent = `#${idx + 1}`;

      const badge = doc.createElement("span");
      badge.style.fontSize = "0.68rem";
      badge.style.padding = "2px 8px";
      badge.style.borderRadius = "10px";
      badge.style.fontWeight = "bold";
      badge.style.textAlign = "center";
      if (isPlaying) {
        badge.textContent = "🎙️ 放送中";
        badge.style.background = "#00e676";
        badge.style.color = "#000";
        badge.style.boxShadow = "0 0 8px rgba(0, 230, 118, 0.5)";
      } else if (isRead) {
        badge.textContent = "既読";
        badge.style.background = "rgba(255, 255, 255, 0.1)";
        badge.style.color = "#888";
      } else {
        badge.textContent = "未読";
        badge.style.background = "rgba(108, 92, 231, 0.35)";
        badge.style.color = "#d6d0ff";
        badge.style.border = "1px solid rgba(108, 92, 231, 0.5)";
      }

      const catSpan = doc.createElement("span");
      catSpan.style.fontSize = "0.72rem";
      catSpan.style.color = isRead ? "#777" : "#81ecec";
      catSpan.style.fontWeight = "500";
      catSpan.textContent = `[${item.categoryName || '一般'}] ${item.publisherName || ''}`;

      leftMeta.appendChild(numBadge);
      leftMeta.appendChild(badge);
      leftMeta.appendChild(catSpan);

      if (item.pubDate) {
        const d = new Date(item.pubDate);
        if (!isNaN(d.getTime())) {
          const dateSpan = doc.createElement("span");
          dateSpan.style.color = isRead ? "#666" : "#888";
          dateSpan.style.fontSize = "0.68rem";
          dateSpan.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          leftMeta.appendChild(dateSpan);
        }
      }

      const playBtn = doc.createElement("button");
      playBtn.textContent = "▶️ ここから再開";
      playBtn.style.background = isPlaying
        ? "linear-gradient(135deg, #00e676, #00b894)"
        : "linear-gradient(135deg, rgba(108, 92, 231, 0.4), rgba(108, 92, 231, 0.2))";
      playBtn.style.color = isPlaying ? "#000" : "#fff";
      playBtn.style.border = isPlaying ? "none" : "1px solid rgba(108, 92, 231, 0.5)";
      playBtn.style.borderRadius = "12px";
      playBtn.style.padding = "3px 10px";
      playBtn.style.fontSize = "0.72rem";
      playBtn.style.fontWeight = "600";
      playBtn.style.cursor = "pointer";
      playBtn.style.whiteSpace = "nowrap";
      playBtn.style.transition = "transform 0.1s ease, filter 0.2s ease";
      playBtn.onmouseenter = () => { playBtn.style.filter = "brightness(1.2)"; playBtn.style.transform = "scale(1.03)"; };
      playBtn.onmouseleave = () => { playBtn.style.filter = "brightness(1.0)"; playBtn.style.transform = "scale(1.0)"; };
      playBtn.onclick = () => {
        console.log(`[ニュース一覧] 指定位置(#${idx + 1})から再開リクエストを受信しました`);
        const starter = (typeof window.startNewsBroadcast === "function"
          ? window.startNewsBroadcast
          : (window.opener && typeof window.opener.startNewsBroadcast === "function" ? window.opener.startNewsBroadcast : null));
        if (starter) {
          starter(idx);
          setTimeout(() => {
            if (typeof window.updateNewsListPopup === "function") window.updateNewsListPopup();
            if (window.opener && typeof window.opener.updateNewsListPopup === "function") window.opener.updateNewsListPopup();
          }, 300);
        } else {
          console.error("[ニュース一覧] startNewsBroadcast 関数が見つかりません");
        }
      };

      headerRow.appendChild(leftMeta);
      headerRow.appendChild(playBtn);

      // 下段: 全幅を使った読みやすいタイトル
      const titleSpan = doc.createElement("div");
      titleSpan.style.fontSize = "0.88rem";
      titleSpan.style.lineHeight = "1.45";
      titleSpan.style.fontWeight = isPlaying ? "bold" : "normal";
      titleSpan.style.color = isPlaying ? "#fff" : (isRead ? "#888" : "#f1f2f6");
      titleSpan.style.wordBreak = "break-word";
      titleSpan.textContent = item.title;

      card.appendChild(headerRow);
      card.appendChild(titleSpan);
      container.appendChild(card);
    });
  };

  window.clearNewsReadFlags = function (silent = false) {
    readNewsTitles.clear();
    localStorage.removeItem("newsReadTitles");
    console.log("[ニュース番組] 全ニュースの既読フラグを初期化（未読化）しました。");
    if (typeof window.updateNewsListPopup === "function") {
      window.updateNewsListPopup();
    }
    if (!silent) {
      alert("既読フラグをすべてクリアしました！");
    }
  };

  const newsClearReadBtn = document.getElementById("news-clear-read-btn");
  if (newsClearReadBtn) {
    newsClearReadBtn.addEventListener("click", () => {
      if (confirm("すべてのニュースの既読フラグをクリアしますか？")) {
        window.clearNewsReadFlags(false);
      }
    });
  }

  const newsListBtn = document.getElementById("news-list-btn") || document.getElementById("news-list-popup-btn");
  if (newsListBtn) {
    newsListBtn.addEventListener("click", () => {
      if (window.newsListPopup && !window.newsListPopup.closed) {
        window.updateNewsListPopup();
        window.newsListPopup.focus();
        return;
      }

      window.newsListPopup = window.open("", "NewsList", "width=640,height=700,menubar=no,toolbar=no,location=no,status=no");
      if (!window.newsListPopup) {
        alert("ポップアップがブロックされました。ブラウザの設定で許可してください。");
        return;
      }

      const doc = window.newsListPopup.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <title>📰 取得済みのニュース一覧</title>
          <style>
            * { box-sizing: border-box; }
            body {
              background: #0f121d;
              color: #f1f2f6;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", Meiryo, sans-serif;
              margin: 0;
              padding: 16px 20px;
            }
            header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 14px;
              padding-bottom: 10px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            h3 {
              margin: 0;
              font-size: 1.05rem;
              font-weight: 700;
              color: #fff;
            }
            #news-list-container {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
          </style>
        </head>
        <body>
          <header>
            <h3>📰 取得済みのニュース一覧</h3>
          </header>
          <div id="news-list-container"></div>
          <script>
            setInterval(() => {
              if (window.opener && typeof window.opener.updateNewsListPopup === 'function') {
                window.opener.updateNewsListPopup();
              }
            }, 3000);
          </script>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        window.updateNewsListPopup();
      }, 100);
    });
  }

  // デフォルトの日付設定（1日前〜今日）
  const dateStartInput = document.getElementById("news-date-start");
  const dateEndInput = document.getElementById("news-date-end");
  if (dateStartInput && dateEndInput) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    dateStartInput.value = formatDate(yesterday);
    dateEndInput.value = formatDate(today);
  }

  if (window.newsFetchBtn) {
    window.newsFetchBtn.addEventListener("click", () => {
      if (!window.newsBoard) return;
      window.isContinuousNewsMode = false;
      if (window.newsContinuousToggle)
        window.newsContinuousToggle.checked = false;
      window.continuousNewsItems = []; // リセット
      window.playNextContinuousNews(true, false);
    });
  }

  const newsFetchOnlyBtn = document.getElementById("news-fetch-only-btn");
  if (newsFetchOnlyBtn) {
    newsFetchOnlyBtn.addEventListener("click", async () => {
      window.isContinuousNewsMode = false;
      if (window.newsContinuousToggle)
        window.newsContinuousToggle.checked = false;
      window.continuousNewsItems = []; // リセット

      const catSelect = document.getElementById("news-rss-select");
      const countSelect = document.getElementById("news-item-count-select");
      const startDateInput = document.getElementById("news-date-start");
      const endDateInput = document.getElementById("news-date-end");

      const selectedCat = catSelect ? catSelect.value : "cat_all";
      const maxCount = countSelect ? parseInt(countSelect.value, 10) : 3;
      const startDate = startDateInput ? startDateInput.value : null;
      const endDate = endDateInput ? endDateInput.value : null;

      newsFetchOnlyBtn.textContent = "⬇️ 取得中...";
      newsFetchOnlyBtn.disabled = true;

      try {
        await window.fetchNewsWithOptions(selectedCat, maxCount, startDate, endDate);
        const count = window.latestFetchedNews ? window.latestFetchedNews.length : 0;
        console.log(`[ニュース取得] メイン画面から取得完了: ${count}件`);
      } catch (e) {
        console.error("[ニュース取得] エラー:", e);
      } finally {
        newsFetchOnlyBtn.textContent = "⬇️ ニュースを取得";
        newsFetchOnlyBtn.disabled = false;
      }
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

  const newsAiGenYtBtn = document.getElementById("news-ai-generate-yt-btn");
  if (newsAiGenYtBtn) {
    newsAiGenYtBtn.addEventListener("click", async () => {
      if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) {
        alert("先にニュースを取得してください。（ポップアップで取得済み一覧が確認できる状態である必要があります）");
        return;
      }

      const apiKey = localStorage.getItem("savedAiApiKey") || "";
      const provider = localStorage.getItem("savedAiProvider") || "gemini";
      const aiModel = localStorage.getItem("savedAiModel") || (provider === "openai" ? "gpt-4o-mini" : (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash"));

      if (!apiKey && provider !== "ollama") {
        alert("AI設定タブでAPIキーを設定してください。");
        return;
      }

      const jpNames = { hiyori: "ひより", akari: "あかり", hijiki: "ひじき", tororo: "とろろ", wanko: "わんこ" };
      const charName = typeof currentModelId !== "undefined" && jpNames[currentModelId] ? jpNames[currentModelId] : "VTuber";

      const slot = window.activeStreamSlot || (new Date().getHours() >= 4 && new Date().getHours() < 12 ? "morning" : "evening");
      const slotInfo = slot === "morning"
        ? "【配信時間帯】: 🌅 朝の生放送（出勤・通学前にサクッとチェック、爽やかで元気な挨拶、今日1日の見通し。タイトル例: 【朝の生放送】〜☀️）"
        : "【配信時間帯】: 🌙 夜の生放送（今日1日の重要ニュース総ざらい、お仕事お疲れ様の挨拶、おやすみ前のニュースまとめ。タイトル例: 【夜の生放送】〜🌙）";

      const userSns = document.getElementById("ai-stream-sns")?.value.trim() || "";
      const userCredits = document.getElementById("ai-stream-credits")?.value.trim() || "";

      const snsInstruction = userSns
        ? `3. X(Twitter)などのSNSへのリンク（以下のユーザー指定のリンクをそのまま使用してください）\n   ${userSns}`
        : `3. X(Twitter)などのSNSへのリンク（URLは https://twitter.com/${charName}_vtuber のようなダミーを生成してください）`;

      const creditsInstruction = userCredits
        ? `4. 素材・モデルのクレジット表記（以下のユーザー指定の内容をそのまま使用してください）\n   ${userCredits}`
        : `4. 素材・モデルのクレジット表記（以下の内容を必ず含めてください）\n   - Live2Dモデル: 「${charName}」© Live2D Inc. (Live2D Creative Studio サンプルモデル)\n   - BGMやその他素材`;

      // 上位10件をピックアップ
      const topNews = window.latestFetchedNews.slice(0, 10).map((item, idx) => {
        let desc = item.description || "";
        if (desc.length > 50) desc = desc.substring(0, 50) + "...";
        return `${idx + 1}. [${item.categoryName || 'ニュース'}] ${item.title} - ${desc}`;
      }).join("\n");

      const prompt = `あなたはプロのVTuber配信マネージャーです。
本日のニュース番組配信に向けた、YouTubeの「配信タイトル」と「概要文」のセットを5通り作成してください。

${slotInfo}

【本日の主要ニュース（抜粋）】
${topNews}

【概要文の要件】
他の人気VTuberがよくやっているように、以下の要素を盛り込んでリッチな概要文にしてください：
1. ニュースキャスターとしての元気な挨拶と、今日の主なニュースのあらすじ（主要ニュースからいくつかピックアップして触れてください）
2. 関連するハッシュタグ（あなたの名前「${charName}」を含めたニュース配信用のオリジナルハッシュタグを2〜3個作成してください）
${snsInstruction}
${creditsInstruction}
5. 視聴者へのお願い・配信のルール（「話題に出ていない他の配信者の名前を出さない」「伝書鳩NG」「荒らしはブロック＆スルー」など）

必ず以下のJSONフォーマットのみを返してください（マークダウンやバッククォート、説明などは一切不要です）。
[
  { "title": "タイトル1", "description": "概要1" },
  { "title": "タイトル2", "description": "概要2" }
]`;

      newsAiGenYtBtn.textContent = "✨ 生成中...";
      newsAiGenYtBtn.disabled = true;

      try {
        let jsonText = "";
        if (provider === "ollama") {
          const res = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: aiModel, prompt: prompt, stream: false }),
          });
          if (!res.ok) throw new Error("Ollama API Error");
          const data = await res.json();
          jsonText = data.response;
        } else if (provider === "openai") {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({ model: aiModel, messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
          });
          if (!res.ok) throw new Error("OpenAI API Error");
          const data = await res.json();
          jsonText = data.choices[0].message.content;
        } else {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } }),
          });
          if (!res.ok) throw new Error("Gemini API Error");
          const data = await res.json();
          jsonText = data.candidates[0].content.parts[0].text;
        }

        if (jsonText.includes("\`\`\`json")) {
          jsonText = jsonText.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
        } else if (jsonText.includes("\`\`\`")) {
          jsonText = jsonText.split("\`\`\`")[1].split("\`\`\`")[0].trim();
        }

        const candidates = JSON.parse(jsonText);

        const aiCandidatesModal = document.getElementById("ai-candidates-modal");
        const aiCandidatesList = document.getElementById("ai-candidates-list");
        const streamTitleInput = document.getElementById("stream-title");
        const streamDescInput = document.getElementById("stream-description");

        if (aiCandidatesModal && aiCandidatesList) {
          const modalTitle = aiCandidatesModal.querySelector("h3");
          if (modalTitle) modalTitle.textContent = "✨ ニュース配信用 AI候補";

          aiCandidatesList.innerHTML = "";
          candidates.forEach((cand, i) => {
            const div = document.createElement("div");
            div.className = "ai-candidate-item";
            const title = document.createElement("h4");
            title.textContent = `${i + 1}. ${cand.title}`;
            const desc = document.createElement("p");
            desc.textContent = cand.description;
            const applyBtn = document.createElement("button");
            applyBtn.className = "apply-btn";
            applyBtn.textContent = "適用する";
            applyBtn.onclick = () => {
              if (streamTitleInput) streamTitleInput.value = cand.title;
              if (streamDescInput) {
                streamDescInput.value = cand.description;
                const ytDescTextarea = document.getElementById("yt-desc-textarea");
                if (ytDescTextarea) ytDescTextarea.value = cand.description;
                if (typeof updateYtDescCount === "function") updateYtDescCount();
              }
              localStorage.setItem("savedStreamTitle", cand.title);
              localStorage.setItem("savedStreamDesc", cand.description);
              aiCandidatesModal.style.display = "none";

              // Move to stream tab to show the result
              const streamTab = document.querySelector('.tab-btn[data-target="tab-stream"]');
              if (streamTab) streamTab.click();
            };
            div.appendChild(title);
            div.appendChild(desc);
            div.appendChild(applyBtn);
            aiCandidatesList.appendChild(div);
          });
          aiCandidatesModal.style.display = "flex";
        }
      } catch (err) {
        console.error(err);
        alert("AI生成に失敗しました。\\n" + err.message);
      } finally {
        newsAiGenYtBtn.textContent = "✨ 取得ニュースから配信タイトル・概要を生成";
        newsAiGenYtBtn.disabled = false;
      }
    });
  }

  // =====================================================================
  // 📰 ニュース台本ジェネレーター＆番組進行ロジック
  // =====================================================================
  window.newsModeState = {
    scriptLines: [],
    scriptYomiLines: [],
    currentScriptIndex: 0,
    isPlaying: false,
    isPaused: false
  };

  window.newsScriptBtn = document.getElementById("news-script-btn");
  window.newsScriptModal = document.getElementById("news-script-modal");
  window.newsScriptGenBtn = document.getElementById("news-script-generate-btn");
  window.newsScriptClearBtn = document.getElementById("news-script-clear-btn");
  window.newsScriptSaveBtn = document.getElementById("news-script-save-btn");
  window.newsScriptCancelBtn = document.getElementById("news-script-cancel-btn");
  window.newsScriptTextarea = document.getElementById("news-script-textarea");
  window.newsScriptYomiTextarea = document.getElementById("news-script-yomi-textarea");
  window.newsScriptLoading = document.getElementById("news-script-loading");
  window.newsScriptPlayBtn = document.getElementById("news-script-play-btn");
  window.newsScriptStopBtn = document.getElementById("news-script-stop-btn");
  window.newsScriptStartLine = document.getElementById("news-script-start-line");
  window.newsScriptFixYomiBtn = document.getElementById("news-script-fix-yomi-btn");
  window.newsConfigSaveBtn = document.getElementById("news-config-save-btn");

  // 設定の読み込み
  const loadNewsConfig = async () => {
    try {
      const res = await fetch("/news_script_config");
      if (res.ok) {
        const cfg = await res.json();
        if (cfg) {
          if (document.getElementById("news-config-title") && cfg.program_title)
            document.getElementById("news-config-title").value = cfg.program_title;
          if (document.getElementById("news-config-category") && cfg.category)
            document.getElementById("news-config-category").value = cfg.category;
          if (document.getElementById("news-config-count") && cfg.count)
            document.getElementById("news-config-count").value = cfg.count;
          if (document.getElementById("news-config-name") && cfg.caster_name)
            document.getElementById("news-config-name").value = cfg.caster_name;
          if (document.getElementById("news-config-date") && cfg.broadcast_date)
            document.getElementById("news-config-date").value = cfg.broadcast_date;
          if (document.getElementById("news-config-opening") && cfg.opening)
            document.getElementById("news-config-opening").value = cfg.opening;
          if (document.getElementById("news-config-closing") && cfg.closing)
            document.getElementById("news-config-closing").value = cfg.closing;
          if (cfg.se_allowed && Array.isArray(cfg.se_allowed)) {
            const cbs = document.querySelectorAll('#news-script-settings-details input[name="news-se"]');
            cbs.forEach(cb => cb.checked = cfg.se_allowed.includes(cb.value));
          }
        }
      }
    } catch (e) {
      console.warn("[ニュース台本] 設定読み込み失敗 (フォールバック使用):", e);
    }
  };
  loadNewsConfig();

  // 既存の保存台本を復元
  Promise.all([
    fetch("/news_script").then(r => r.ok ? r.text() : "").catch(() => ""),
    fetch("/news_script_yomi").then(r => r.ok ? r.text() : "").catch(() => "")
  ]).then(([savedScript, savedYomi]) => {
    if (savedScript && savedScript.trim()) {
      if (newsScriptTextarea) newsScriptTextarea.value = savedScript;
      newsModeState.scriptLines = savedScript.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    } else {
      const fb = localStorage.getItem("savedNewsScript");
      if (fb && newsScriptTextarea) {
        newsScriptTextarea.value = fb;
        newsModeState.scriptLines = fb.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      }
    }
    if (savedYomi && savedYomi.trim()) {
      if (newsScriptYomiTextarea) newsScriptYomiTextarea.value = savedYomi;
      newsModeState.scriptYomiLines = savedYomi.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    } else {
      const fbY = localStorage.getItem("savedNewsScriptYomi");
      if (fbY && newsScriptYomiTextarea) {
        newsScriptYomiTextarea.value = fbY;
        newsModeState.scriptYomiLines = fbY.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      }
    }
  });

  // 設定保存ボタン
  if (newsConfigSaveBtn) {
    newsConfigSaveBtn.addEventListener("click", async () => {
      const cbs = document.querySelectorAll('#news-script-settings-details input[name="news-se"]:checked');
      const se_allowed = Array.from(cbs).map(cb => cb.value);
      const config = {
        program_title: document.getElementById("news-config-title")?.value || "",
        category: document.getElementById("news-config-category")?.value || "cat_top",
        count: document.getElementById("news-config-count")?.value || "3",
        caster_name: document.getElementById("news-config-name")?.value || "",
        broadcast_date: document.getElementById("news-config-date")?.value || "",
        opening: document.getElementById("news-config-opening")?.value || "",
        closing: document.getElementById("news-config-closing")?.value || "",
        se_allowed: se_allowed
      };
      try {
        await fetch("/news_script_config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config)
        });
        localStorage.setItem("savedNewsConfig", JSON.stringify(config));
        alert("ニュース番組設定を保存しました！");
      } catch (e) {
        localStorage.setItem("savedNewsConfig", JSON.stringify(config));
        alert("ローカルストレージに設定を保存しました。");
      }
    });
  }

  // モーダル開閉
  if (newsScriptBtn && newsScriptModal) {
    let seListLoaded = false;
    newsScriptBtn.addEventListener("click", () => {
      newsScriptModal.style.display = "flex";
      if (!seListLoaded) {
        const seSel = document.getElementById("news-script-se-select");
        if (seSel) {
          fetch("/se_list")
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data && data.files) {
                seSel.innerHTML = "";
                data.files.sort((a, b) => a.localeCompare(b, "ja")).forEach(f => {
                  const opt = document.createElement("option");
                  opt.value = f;
                  opt.textContent = f;
                  seSel.appendChild(opt);
                });
                seListLoaded = true;
              }
            }).catch(() => { });
        }
      }
    });
  }
  if (newsScriptCancelBtn && newsScriptModal) {
    newsScriptCancelBtn.addEventListener("click", () => {
      newsScriptModal.style.display = "none";
    });
  }

  // SE挿入＆再生
  const newsSePlayBtn = document.getElementById("news-script-se-play-btn");
  const newsSeInsertBtn = document.getElementById("news-script-se-insert-btn");
  const newsSeSelect = document.getElementById("news-script-se-select");
  if (newsSePlayBtn && newsSeSelect) {
    newsSePlayBtn.addEventListener("click", () => {
      if (!newsSeSelect.value) return;
      const audio = new Audio(`se/${newsSeSelect.value}.mp3`);
      const seVolSlider = document.getElementById("se-volume-slider");
      const savedSeVol = localStorage.getItem("savedSeVolume");
      audio.volume = seVolSlider ? (parseFloat(seVolSlider.value) / 100.0) : (savedSeVol ? (parseFloat(savedSeVol) / 100.0) : 1.0);
      audio.play().catch(e => console.warn("SE再生エラー:", e));
    });
  }
  if (newsSeInsertBtn && newsSeSelect && newsScriptTextarea) {
    newsSeInsertBtn.addEventListener("click", () => {
      if (!newsSeSelect.value) return;
      const tag = `\n[SE: ${newsSeSelect.value}]\n`;
      const s = newsScriptTextarea.selectionStart;
      const e = newsScriptTextarea.selectionEnd;
      newsScriptTextarea.value = newsScriptTextarea.value.substring(0, s) + tag + newsScriptTextarea.value.substring(e);
      newsScriptTextarea.focus();
      newsScriptTextarea.selectionStart = newsScriptTextarea.selectionEnd = s + tag.length;
    });
  }

  // ひらがな自動修正ボタン
  if (newsScriptFixYomiBtn && newsScriptTextarea && newsScriptYomiTextarea) {
    newsScriptFixYomiBtn.addEventListener("click", async () => {
      const src = newsScriptTextarea.value;
      if (!src.trim()) return;
      newsScriptFixYomiBtn.disabled = true;
      newsScriptFixYomiBtn.textContent = "変換中...";
      try {
        let res = await fetch("/convert_remaining_kanji", {
          method: "POST",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: src
        });
        if (res.ok) {
          const hira = await res.text();
          newsScriptYomiTextarea.value = hira;
        } else {
          // フォールバック: 単純コピー
          newsScriptYomiTextarea.value = src;
        }
      } catch (e) {
        newsScriptYomiTextarea.value = src;
      } finally {
        newsScriptFixYomiBtn.disabled = false;
        newsScriptFixYomiBtn.textContent = "✨ 漢字を自動修正";
      }
    });
  }

  // 台本クリア
  if (newsScriptClearBtn && newsScriptTextarea && newsScriptYomiTextarea) {
    newsScriptClearBtn.addEventListener("click", () => {
      if (confirm("ニュース台本をクリアしますか？")) {
        newsScriptTextarea.value = "";
        newsScriptYomiTextarea.value = "";
      }
    });
  }

  // 台本保存
  if (newsScriptSaveBtn && newsScriptTextarea && newsScriptYomiTextarea) {
    newsScriptSaveBtn.addEventListener("click", async () => {
      const text = newsScriptTextarea.value.trim();
      const yomi = newsScriptYomiTextarea.value.trim();
      if (!text) {
        alert("台本が入力されていません。");
        return;
      }
      newsModeState.scriptLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      newsModeState.scriptYomiLines = yomi.split("\n").map(l => l.trim()).filter(l => l.length > 0);

      localStorage.setItem("savedNewsScript", text);
      localStorage.setItem("savedNewsScriptYomi", yomi);

      try {
        await fetch("/news_script", {
          method: "POST",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: text
        });
        await fetch("/news_script_yomi", {
          method: "POST",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: yomi
        });
      } catch (e) { }

      alert(`ニュース台本 (${newsModeState.scriptLines.length}行) を保存しました！`);
      if (newsScriptModal) newsScriptModal.style.display = "none";
    });
  }


  // ========================
  // ニュース番組 全自動進行
  // ========================
  let newsBroadcastState = window.newsBroadcastState || {
    isRunning: false,
    currentIndex: 0,
    totalCount: 0,
    lastCategory: ""
  };
  window.newsBroadcastState = newsBroadcastState;

  function getTimeBasedGreeting(isZunda = false, title = "ニュース番組") {
    const hour = new Date().getHours();
    let greetingWord = "こんにちは";
    if (hour >= 4 && hour < 11) {
      greetingWord = "おはようございます";
    } else if (hour >= 11 && hour < 18) {
      greetingWord = "こんにちは";
    } else {
      greetingWord = "こんばんは";
    }

    if (isZunda) {
      return `みなさん${greetingWord}なのだ！本日の最新ニュースをお届けするのだ！`;
    } else {
      return `みなさん${greetingWord}！本日の最新ニュースをお届けします！`;
    }
  }

  function getTimeBasedClosing(isZunda = false) {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 18) {
      return isZunda
        ? "本日のニュースは以上になります。それでは皆さん、良い一日をなのだ！"
        : "本日のニュースは以上になります。それでは皆さん、良い一日をお過ごしください！";
    } else {
      return isZunda
        ? "本日のニュースは以上になります。それでは皆さん、今夜もごゆっくりお過ごしくださいなのだ！"
        : "本日のニュースは以上になります。それでは皆さん、今夜もごゆっくりお過ごしください！";
    }
  }

  function adjustGreetingToCurrentTime(text) {
    if (!text) return text;
    const hour = new Date().getHours();
    let target = "こんにちは";
    if (hour >= 4 && hour < 11) target = "おはようございます";
    else if (hour >= 11 && hour < 18) target = "こんにちは";
    else target = "こんばんは";

    // 既存の挨拶語を現在の時間帯に合わせて置換
    return text.replace(/(おはようございます|こんにちは|こんばんは)/g, target);
  }

  function getNewsConfig() {
    const isZunda = currentModelId === "zundamon" || currentModelId === "zundamon_human";
    const saved = JSON.parse(localStorage.getItem("newsScriptConfig") || "{}");
    const title = document.getElementById("news-config-title")?.value.trim() || saved.title || "ニュース番組";
    
    let rawOp = document.getElementById("news-config-opening")?.value.trim() || saved.opGreeting;
    let op = rawOp ? adjustGreetingToCurrentTime(rawOp) : getTimeBasedGreeting(isZunda, title);

    let rawEd = document.getElementById("news-config-closing")?.value.trim() || saved.edGreeting;
    let ed = rawEd ? rawEd : getTimeBasedClosing(isZunda);

    const useOpChime = document.getElementById("news-se-op-chime")?.checked ?? (saved.useOpChime ?? true);
    const useTransition = document.getElementById("news-se-transition")?.checked ?? (saved.useTransition ?? true);
    const useEdChime = document.getElementById("news-se-ed-chime")?.checked ?? (saved.useEdChime ?? true);
    return { title, op, ed, useOpChime, useTransition, useEdChime, isZunda };
  }

  function playSE(name) {
    return new Promise(async (resolve) => {
      try {
        const ctx = window.voicevoxAudioContext || window.bgmAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        if (!window.voicevoxAudioContext) window.voicevoxAudioContext = ctx;

        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }

        const tryFetch = async (path) => {
          const res = await fetch(path);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.arrayBuffer();
        };

        let arrayBuffer = null;
        const encoded = encodeURIComponent(name);
        try {
          arrayBuffer = await tryFetch(`/se/${encoded}.mp3`);
        } catch {
          try {
            arrayBuffer = await tryFetch(`/se/${encoded}.wav`);
          } catch (err) {
            console.warn(`[ニュースSE] 音声ファイルが見つかりません (${name}):`, err);
            return resolve();
          }
        }

        // Web Audio API でデコードして再生
        ctx.decodeAudioData(arrayBuffer, (audioBuffer) => {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;

          const seVolSlider = document.getElementById("se-volume-slider");
          const seVol = seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 0.85;

          const seGain = ctx.createGain();
          seGain.gain.value = seVol;

          source.connect(seGain);
          seGain.connect(ctx.destination);

          source.onended = () => {
            source.disconnect();
            seGain.disconnect();
            resolve();
          };

          // タイムアウト保護（最長5秒で必ずresolveして番組進行がフリーズしないようにする）
          setTimeout(() => resolve(), Math.min((audioBuffer.duration * 1000) + 500, 5000));

          source.start(0);
          console.log(`[ニュースSE] 🔊 WebAudio再生開始: ${name}`);
        }, (decodeErr) => {
          console.warn(`[ニュースSE] デコード失敗 (${name}):`, decodeErr);
          resolve();
        });
      } catch (e) {
        console.warn(`[ニュースSE] 再生例外 (${name}):`, e);
        resolve();
      }
    });
  }

  // =====================================================================
  // セットリスト風カテゴリアジェンダボード管理
  // =====================================================================
  function initNewsSetlist(newsList) {
    const setlistBoard = document.getElementById("news-setlist-board");
    const listEl = document.getElementById("setlist-category-list");
    const badgeEl = document.getElementById("setlist-progress-badge");
    if (!setlistBoard || !listEl) return;

    listEl.innerHTML = "";
    if (!newsList || newsList.length === 0) {
      setlistBoard.style.display = "none";
      return;
    }

    // カテゴリ順にグループ化 & 件数集計
    const CATEGORY_ORDER = ["cat_top", "cat_society", "cat_world", "cat_business", "cat_politics", "cat_entertainment", "cat_sports", "cat_tech", "cat_science", "cat_local"];
    const catCountMap = new Map();

    newsList.forEach(item => {
      const key = item.categoryKey || "cat_top";
      const name = item.categoryName || CATEGORY_NAMES[key] || "総合";
      if (!catCountMap.has(key)) {
        catCountMap.set(key, { key, name, count: 0 });
      }
      catCountMap.get(key).count++;
    });

    const sortedCategories = Array.from(catCountMap.values()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.key);
      const bi = CATEGORY_ORDER.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    sortedCategories.forEach((cat) => {
      const itemEl = document.createElement("div");
      itemEl.className = "setlist-item";
      itemEl.id = `setlist-cat-${cat.key}`;
      itemEl.dataset.catKey = cat.key;
      itemEl.innerHTML = `
        <div class="setlist-item-left">
          <span class="setlist-item-status">・</span>
          <span class="setlist-item-name">${cat.name}</span>
        </div>
        <span class="setlist-item-count">${cat.count}件</span>
      `;
      listEl.appendChild(itemEl);
    });

    if (badgeEl) {
      badgeEl.textContent = `0 / ${newsList.length}`;
    }

    setlistBoard.style.display = "flex";
  }

  function updateNewsSetlistProgress(activeCategoryKey, currentIndex, totalCount) {
    const setlistBoard = document.getElementById("news-setlist-board");
    const badgeEl = document.getElementById("setlist-progress-badge");
    if (!setlistBoard) return;

    if (badgeEl) {
      badgeEl.textContent = `${currentIndex} / ${totalCount}`;
    }

    const items = setlistBoard.querySelectorAll(".setlist-item");
    let foundActive = false;

    items.forEach(itemEl => {
      const catKey = itemEl.dataset.catKey;
      const statusEl = itemEl.querySelector(".setlist-item-status");

      if (catKey === activeCategoryKey) {
        itemEl.classList.remove("completed");
        itemEl.classList.add("active");
        if (statusEl) statusEl.textContent = "🎙️";
        foundActive = true;
        try { itemEl.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { }
      } else if (!foundActive) {
        itemEl.classList.remove("active");
        itemEl.classList.add("completed");
        if (statusEl) statusEl.textContent = "✓";
      } else {
        itemEl.classList.remove("active", "completed");
        if (statusEl) statusEl.textContent = "・";
      }
    });
  }

  function finishNewsSetlist(totalCount) {
    const setlistBoard = document.getElementById("news-setlist-board");
    const badgeEl = document.getElementById("setlist-progress-badge");
    if (!setlistBoard) return;

    if (badgeEl) {
      badgeEl.textContent = `${totalCount} / ${totalCount}`;
    }

    const items = setlistBoard.querySelectorAll(".setlist-item");
    items.forEach(itemEl => {
      itemEl.classList.remove("active");
      itemEl.classList.add("completed");
      const statusEl = itemEl.querySelector(".setlist-item-status");
      if (statusEl) statusEl.textContent = "✓";
    });
  }

  window.initNewsSetlist = initNewsSetlist;
  window.updateNewsSetlistProgress = updateNewsSetlistProgress;
  window.finishNewsSetlist = finishNewsSetlist;

  function updateBroadcastProgress(item) {
    const el = document.getElementById("news-broadcast-progress");
    if (el) {
      const catLabel = item?.categoryName || "";
      el.textContent = `📰 進行中: ${newsBroadcastState.currentIndex} / ${newsBroadcastState.totalCount}件${catLabel ? ` [${catLabel}]` : ""}`;
    }
  }

  async function readOneNewsItem(item, config, isCategoryChanged, isFirst) {
    if (!newsBroadcastState.isRunning) return false;

    const newsTitleEl = document.getElementById("news-article-title");
    const newsDescEl = document.getElementById("news-article-desc");
    const newsBoardEl = document.getElementById("news-board");
    const catEl = document.getElementById("news-board-category");
    const newsDateEl = document.getElementById("news-article-date");
    const progressBadge = document.getElementById("news-board-progress");

    const tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = item.description || "";
    let plainDesc = (tmpDiv.textContent || tmpDiv.innerText || "").replace(/\s+/g, " ").trim();
    if (plainDesc.length > 120) plainDesc = plainDesc.substring(0, 120) + "…";

    newsBroadcastState.currentTitle = item.title;
    window.newsBroadcastState = newsBroadcastState;
    updateBroadcastProgress(item);

    const apiKeyInput = document.getElementById("ai-api-key");
    const providerSelect = document.getElementById("ai-provider-select");
    const modelInput = document.getElementById("ai-model-input");
    const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : "") || localStorage.getItem("savedAiApiKey") || localStorage.getItem("ai_api_key") || "";
    const provider = (providerSelect ? providerSelect.value : "") || localStorage.getItem("savedAiProvider") || "gemini";
    const modelName = (modelInput ? modelInput.value.trim() : "") || localStorage.getItem("savedAiModel") || "gemini-1.5-flash";

    const payload = {
      title: item.title,
      description: plainDesc,
      categoryName: item.categoryName || "",
      modelId: currentModelId,
      isFirst: isFirst,
      isCategoryChanged: isCategoryChanged,
      apiKey: apiKey,
      provider: provider,
      modelName: modelName
    };

    let hasAnnouncedOutage = false;
    let retryFailCount = 0;

    while (newsBroadcastState.isRunning) {
      if (!apiKey && provider !== "ollama") {
        console.warn("[ニュース番組] ⚠️ APIキーが未設定です。復旧待機画面に移行します...");
      }

      let res = null;
      if (apiKey || provider === "ollama") {
        try {
          res = await fetch("/api/news/generate_item_script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        } catch (netErr) {
          console.warn("[ニュース番組] 通信エラー検知 (Local API / Network):", netErr);
        }
      }

      if (res && res.ok) {
        try {
          const data = await res.json();
          if (data && data.status === "ok" && (data.items || data.sentences)) {
            // ▼▼▼ AI生成が完全に成功した段階で初めてテロップと日付を表示！ ▼▼▼
            if (newsTitleEl) newsTitleEl.textContent = item.title;
            if (newsDescEl) newsDescEl.textContent = plainDesc;
            if (newsBoardEl) newsBoardEl.classList.add("active");
            if (catEl) catEl.textContent = item.categoryName || "";
            if (progressBadge) {
              progressBadge.style.display = "inline-block";
              progressBadge.textContent = `${newsBroadcastState.currentIndex} / ${newsBroadcastState.totalCount}`;
            }
            if (newsDateEl) {
              if (item.pubDate) {
                const d = new Date(item.pubDate);
                if (!isNaN(d.getTime())) {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  const hh = String(d.getHours()).padStart(2, "0");
                  const mm = String(d.getMinutes()).padStart(2, "0");
                  newsDateEl.textContent = `${y}/${m}/${day} ${hh}:${mm}`;
                } else {
                  newsDateEl.textContent = item.pubDate;
                }
              } else {
                newsDateEl.textContent = "";
              }
            }

            // セットリストボードの進行目印を更新
            updateNewsSetlistProgress(item.categoryKey || "cat_top", newsBroadcastState.currentIndex, newsBroadcastState.totalCount);

            const count = (data.items || data.sentences || []).length;
            console.log(`[ニュース原稿(Backend)] [${newsBroadcastState.currentIndex}/${newsBroadcastState.totalCount}件] 「${data.fullText}」 (${count}文)`);
            if (data.items && data.items.length > 0) {
              for (const it of data.items) {
                if (!newsBroadcastState.isRunning) return false;
                await queueVoicevoxAudio(it.display, true, it.speech);
              }
            } else if (data.sentences) {
              for (const s of data.sentences) {
                if (!newsBroadcastState.isRunning) return false;
                await queueVoicevoxAudio(s, true);
              }
            }
            // VOICEVOXの読み上げが完全に終わるまで待機
            await waitForVoicevoxFinish();

            // 既読マーク
            readNewsTitles.add(item.title);
            if (window.readNewsTitles) window.readNewsTitles.add(item.title);
            try { localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles))); } catch (e) { }
            if (typeof window.updateNewsListPopup === "function") {
              window.updateNewsListPopup();
            }
            return true; // 正常読み上げ完了！
          }
        } catch (jsonErr) {
          console.warn("[ニュース番組] JSONパースエラー:", jsonErr);
        }
      }

      // ▼▼▼ 異常発生時: ニュースは絶対に読まない！「しばらくお待ちください」待機画面に切り替え ▼▼▼
      console.warn("[ニュース番組] ⚠️ 異常検知（AI未応答・エラーまたはAPIキー未設定）。待機画面へ移行し復旧を待ちます...");

      // 1. テロップを「しばらくお待ちください」待機画面へ切り替え
      const newsArticleTitleEl = document.getElementById("news-article-title");
      const newsArticleDescEl = document.getElementById("news-article-desc");
      if (newsArticleTitleEl) newsArticleTitleEl.textContent = "📡 通信状況を確認中...";
      if (newsArticleDescEl) newsArticleDescEl.textContent = "原稿サーバーまたはネットワークの復旧を待機しています。しばらくお待ちください...";
      if (catEl) catEl.textContent = "待機中";
      if (newsBoardEl) newsBoardEl.classList.add("active");

      // 2. 待機アナウンス（初回のみ発話）
      if (!hasAnnouncedOutage) {
        hasAnnouncedOutage = true;
        const isZunda = ["zundamon", "zundamon_human"].includes(currentModelId);
        const isCat = ["tororo", "hijiki"].includes(currentModelId);
        const waitMsg = isZunda
          ? "電波の状況を確認中なのだ。復旧までしばらくお待ちくださいなのだ！"
          : (isCat ? "電波の状況を確認中ですにゃ。復旧までしばらくお待ちくださいにゃ！" : "通信状況を確認中です。復旧までしばらくお待ちください。");
        
        await queueVoicevoxAudio(waitMsg, true);
        await waitForVoicevoxFinish();
      }

      // 3. Local APIサーバーの自動再起動を試みる (Vite Backend Manager経由)
      if (retryFailCount === 0) {
        try {
          console.log("[ニュース番組] 🚀 Local APIサーバーの自動復旧(start)コマンドを送信中...");
          await fetch("/_api/servers/local_api_server/start", { method: "POST" });
        } catch (smErr) {}
      }

      // 4. API無駄打ち防止バックオフ待機（初回5秒、以降は20秒間隔）
      retryFailCount++;
      const waitTimeMs = (retryFailCount > 2) ? 20000 : 5000;
      await new Promise(r => setTimeout(r, waitTimeMs));
    }

    return false;
  }

  async function startNewsBroadcast(startIndex = 0) {
    if (newsBroadcastState.isRunning) {
      console.log(`[ニュース番組] 指定位置(#${startIndex + 1})から再開するため、現在の番組を安全に切り替えます...`);
      newsBroadcastState.isRunning = false;
      if (typeof window.stopVoicevoxPlayback === "function") {
        window.stopVoicevoxPlayback();
      }
      await new Promise(r => setTimeout(r, 400));
    }

    const startBtn = document.getElementById("news-broadcast-start-btn");
    const stopBtn = document.getElementById("news-broadcast-stop-btn");
    const progressEl = document.getElementById("news-broadcast-progress");

    // ニュースが取得されていなければ先に取得
    if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) {
      if (progressEl) { progressEl.style.display = "block"; progressEl.textContent = "⬇️ ニュースを取得中..."; }
      const fetchOnlyBtn = document.getElementById("news-fetch-only-btn");
      if (fetchOnlyBtn) fetchOnlyBtn.click();
      await new Promise(r => setTimeout(r, 3000));
    }

    const allNews = window.latestFetchedNews || [];
    if (allNews.length === 0) {
      alert("ニュース記事がありません。先に「⬇️ ニュースを取得」してください。");
      return;
    }

    // カテゴリ順 ＆ カテゴリ内は時系列順（古い順）にソート
    const CATEGORY_ORDER = ["cat_top", "cat_society", "cat_world", "cat_business", "cat_politics", "cat_entertainment", "cat_sports", "cat_tech", "cat_science", "cat_local"];
    const sortedNews = [...allNews].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.categoryKey || "cat_top");
      const bi = CATEGORY_ORDER.indexOf(b.categoryKey || "cat_top");
      const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      if (catDiff !== 0) return catDiff;
      const dateA = new Date(a.pubDate || 0).getTime();
      const dateB = new Date(b.pubDate || 0).getTime();
      return dateA - dateB; // カテゴリ内は古い順（時系列昇順: 朝➔夜）
    });

    newsBroadcastState = { isRunning: true, currentIndex: startIndex, totalCount: sortedNews.length, lastCategory: "" };
    if (startBtn) startBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "block";
    if (progressEl) progressEl.style.display = "block";

    const startIdxInput = document.getElementById("news-broadcast-start-index");
    if (startIdxInput) startIdxInput.value = startIndex + 1;

    if (typeof clearIdleTimer === "function") clearIdleTimer();

    // 番組開始時にセットリストボードを初期化・表示
    initNewsSetlist(sortedNews);

    // 番組開始時にすべての記事を未読状態に初期化（途中再開でない場合のみクリア）
    if (startIndex === 0 && typeof window.clearNewsReadFlags === "function") {
      window.clearNewsReadFlags(true);
    }

    // 番組開始時にコメント履歴とコメント数を初期化（途中再開でない場合のみクリア）
    if (startIndex === 0 && typeof window.clearAllComments === "function") {
      window.clearAllComments();
    }

    // OBS配信状態の確認（「OBS配信も同時にスタートする」トグルがONの場合のみ実行）
    const obsStreamToggle = document.getElementById("news-obs-auto-stream-toggle");
    const isObsStreamEnabled = obsStreamToggle ? obsStreamToggle.checked : false;

    if (isObsStreamEnabled && typeof window.ensureObsStreamingStarted === "function") {
      if (progressEl) progressEl.textContent = "📡 OBS配信接続を確認中...";
      await window.ensureObsStreamingStarted((msg) => {
        if (progressEl) progressEl.textContent = `📡 ${msg}`;
      });
    } else {
      console.log("[ニュース番組] OBS自動配信連携はOFFのため、OBS配信開始をスキップしてローカルで番組を進行します。");
    }

    if (!newsBroadcastState.isRunning) return;

    const config = getNewsConfig();

    // OP挨拶（途中再開でない場合のみ再生）
    if (startIndex === 0) {
      if (progressEl) progressEl.textContent = "🎬 オープニング再生中...";
      if (config.useOpChime) { await playSE("放送開始チャイム"); await new Promise(r => setTimeout(r, 600)); }
      await queueVoicevoxAudio(config.op, true, config.op);
      await waitForVoicevoxFinish();
      if (!newsBroadcastState.isRunning) return;
    }

    // ニュースループ
    for (let i = startIndex; i < sortedNews.length; i++) {
      if (!newsBroadcastState.isRunning) break;
      const item = sortedNews[i];
      const isFirst = (i === 0);
      const isCategoryChanged = (i > 0) && (item.categoryKey || "") !== newsBroadcastState.lastCategory;

      newsBroadcastState.currentIndex = i + 1;
      newsBroadcastState.lastCategory = item.categoryKey || "";

      if (startIdxInput) startIdxInput.value = i + 1;

      // カテゴリが切り替わった時（2カテゴリ目以降の最初）にシーン切り替えSEを確実に鳴らす
      if (isCategoryChanged && config.useTransition) {
        console.log(`[ニュース番組] カテゴリ切り替え検知: [${item.categoryName || item.categoryKey}] シーン切り替えSEを再生します`);
        await playSE("シーン切り替え1");
        await new Promise(r => setTimeout(r, 600));
      }

      const success = await readOneNewsItem(item, config, isCategoryChanged, isFirst);
      if (!success && newsBroadcastState.isRunning) {
        console.warn(`[ニュース番組] 記事(#${i + 1})の読み上げが未完了のため、スキップせず同じ記事を再試行します。`);
        i--;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!newsBroadcastState.isRunning) break;
    }

    if (!newsBroadcastState.isRunning) {
      if (startBtn) startBtn.style.display = "block";
      if (stopBtn) stopBtn.style.display = "none";
      if (progressEl) progressEl.textContent = "⏹ 番組を停止しました";
      return;
    }

    // ED挨拶
    if (progressEl) progressEl.textContent = "🏁 エンディング再生中...";
    await queueVoicevoxAudio(config.ed, true, config.ed);
    await waitForVoicevoxFinish();
    if (config.useEdChime) { await playSE("放送終了チャイム"); await new Promise(r => setTimeout(r, 600)); }

    // 番組終了（セットリスト完了状態に更新）
    finishNewsSetlist(sortedNews.length);
    newsBroadcastState.isRunning = false;
    if (startBtn) startBtn.style.display = "block";
    if (stopBtn) stopBtn.style.display = "none";
    if (progressEl) progressEl.textContent = `✅ 番組終了（全${sortedNews.length}件を読み終えました）`;
    console.log("[ニュース番組] 全件放送完了！");

    // 独り言は絶対に言わない（startIdleTimerは起動しない）

    // ニュース終了時自動終了がON、または時計自動終了がONの場合は配信終了プロセスを実行
    const isAutoEndNews = (typeof window.isAutoEndAfterNews === "undefined") || window.isAutoEndAfterNews === true;
    const endToggle = document.getElementById("stream-end-toggle");
    if ((isAutoEndNews || (endToggle && endToggle.checked)) && typeof window.executeStreamEndProcess === "function") {
      console.log("[ニュース番組] ニュース読み終わりによる配信終了プロセスを開始します");
      window.executeStreamEndProcess();
    } else {
      console.log("[ニュース番組] 自動終了が無効のため、配信を継続します（待機状態）");
    }
  }

  function stopNewsBroadcast() {
    newsBroadcastState.isRunning = false;
    if (typeof window.stopVoicevoxPlayback === "function") {
      window.stopVoicevoxPlayback();
    }
    const startBtn = document.getElementById("news-broadcast-start-btn");
    const stopBtn = document.getElementById("news-broadcast-stop-btn");
    const progressEl = document.getElementById("news-broadcast-progress");
    if (startBtn) startBtn.style.display = "block";
    if (stopBtn) stopBtn.style.display = "none";
    if (progressEl) progressEl.textContent = "⏹ 番組を停止しました";
    console.log("[ニュース番組] 番組を停止しました。");
  }

  window.startNewsBroadcast = startNewsBroadcast;
  window.stopNewsBroadcast = stopNewsBroadcast;
  window.newsBroadcastState = newsBroadcastState;

  // ボタンイベント
  const newsBroadcastStartBtn = document.getElementById("news-broadcast-start-btn");
  const newsBroadcastStopBtn = document.getElementById("news-broadcast-stop-btn");
  if (newsBroadcastStartBtn) {
    newsBroadcastStartBtn.onclick = () => {
      const startIdxInput = document.getElementById("news-broadcast-start-index");
      const idx = startIdxInput ? (parseInt(startIdxInput.value, 10) || 1) - 1 : 0;
      startNewsBroadcast(Math.max(0, idx));
    };
  }
  if (newsBroadcastStopBtn) {
    newsBroadcastStopBtn.onclick = () => stopNewsBroadcast();
  }

  // カテゴリ・件数・日付範囲指定によるニュース取得
  window.fetchNewsWithOptions = async function (categoryKey = "cat_all", maxPerCategory = Infinity, startDate = null, endDate = null) {
    let fetchTargets = [];
    let sourceName = "全て（全カテゴリを一括取得）";

    if (categoryKey === "cat_all") {
      for (const catKey of Object.keys(NEWS_CATEGORIES)) {
        NEWS_CATEGORIES[catKey].forEach(u => {
          fetchTargets.push({ url: u, categoryKey: catKey, categoryName: CATEGORY_NAMES[catKey] });
        });
      }
    } else if (NEWS_CATEGORIES[categoryKey]) {
      sourceName = CATEGORY_NAMES[categoryKey] || categoryKey;
      NEWS_CATEGORIES[categoryKey].forEach(u => {
        fetchTargets.push({ url: u, categoryKey: categoryKey, categoryName: CATEGORY_NAMES[categoryKey] });
      });
    }

    console.log(`[ニュース取得] 【${sourceName}】最大${maxPerCategory}件/カテゴリ (期間: ${startDate || '指定なし'} 〜 ${endDate || '指定なし'}) で取得中...`);

    const fetchPromises = fetchTargets.map(async (target) => {
      try {
        const res = await fetch("/fetch_rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target.url })
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const xmlText = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const itemsNodes = Array.from(xmlDoc.querySelectorAll("item"));
        return itemsNodes.map((node) => {
          const titleNode = node.querySelector("title");
          const descNode = node.querySelector("description");
          const pubDateNode = node.querySelector("pubDate") || node.querySelector("date");
          let publisherName = "その他";
          if (target.url.includes('yahoo.co.jp')) publisherName = 'Yahoo!';
          else if (target.url.includes('google.com')) publisherName = 'Google';
          else if (target.url.includes('nhk.or.jp')) publisherName = 'NHK';
          else if (target.url.includes('itmedia.co.jp')) publisherName = 'ITmedia';

          return {
            title: titleNode ? titleNode.textContent : "",
            description: descNode ? descNode.textContent : "",
            pubDate: pubDateNode ? pubDateNode.textContent : "",
            categoryName: target.categoryName,
            categoryKey: target.categoryKey,
            publisherName: publisherName
          };
        });
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    let allParsedItems = [];
    results.forEach(items => { allParsedItems = allParsedItems.concat(items); });

    // タイトルの正規化（装飾タグやメディア名の除去）
    function normalizeNewsTitle(title) {
      if (!title) return "";
      let t = title.trim();
      // 先頭の装飾タグ除去: 【速報】/【独自】/【詳報】/【解説】/[PR]/[速報]など
      t = t.replace(/^(\[[^\]]+\]|【[^】]+】|〈[^〉]+〉|（[^）]+）|\([^\)]+\))\s*/g, "");
      // 末尾のメディア名サフィックス除去: （読売新聞オンライン） / - Yahoo!ニュース / (産経新聞) など
      t = t.replace(/\s*([（\(][^）\)]*(?:新聞|通信|テレビ|TV|ニュース|News|時事|共同|ロイター|BBC|CNN|産経|朝日|読売|毎日|日経|TBS|NHK|日テレ|テレ朝|フジ)[^）\)]*[）\)]|[-–—|]\s*[^|–—-]+)$/gi, "");
      // 全角英数字を半角に変換、記号や余分な空白を除去
      t = t.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
      t = t.replace(/[\s\u3000]+/g, " ").trim();
      return t;
    }

    // 2-gram類似度 (Dice係数)
    function calculateTitleSimilarity(str1, str2) {
      if (!str1 || !str2) return 0;
      if (str1 === str2) return 1.0;
      
      // 片方がもう片方（10文字以上）を完全に含む場合
      if (str1.length >= 10 && str2.length >= 10) {
        if (str1.includes(str2) || str2.includes(str1)) return 0.9;
      }
      
      const getBiGrams = (s) => {
        const biGrams = new Set();
        for (let i = 0; i < s.length - 1; i++) {
          biGrams.add(s.substring(i, i + 2));
        }
        return biGrams;
      };
      
      const bg1 = getBiGrams(str1);
      const bg2 = getBiGrams(str2);
      if (bg1.size === 0 || bg2.size === 0) return 0;
      
      let intersection = 0;
      for (const g of bg1) {
        if (bg2.has(g)) intersection++;
      }
      
      return (2.0 * intersection) / (bg1.size + bg2.size);
    }

    // スマート重複排除
    function smartDeduplicateNewsItems(items) {
      const uniqueList = [];
      let dupCount = 0;
      
      for (const item of items) {
        if (!item.title) continue;
        const normTitle = normalizeNewsTitle(item.title);
        
        let duplicateIndex = -1;
        for (let i = 0; i < uniqueList.length; i++) {
          const existing = uniqueList[i];
          const existingNorm = normalizeNewsTitle(existing.title);
          
          // 完全一致、または類似度が0.65以上の場合
          if (normTitle === existingNorm || calculateTitleSimilarity(normTitle, existingNorm) >= 0.65) {
            duplicateIndex = i;
            break;
          }
        }
        
        if (duplicateIndex === -1) {
          uniqueList.push(item);
        } else {
          dupCount++;
          // 重複あり：説明文が長い方、または新しい方を残す
          const existing = uniqueList[duplicateIndex];
          const existingDescLen = (existing.description || "").length;
          const currentDescLen = (item.description || "").length;
          if (currentDescLen > existingDescLen + 20) {
            uniqueList[duplicateIndex] = item;
          }
        }
      }
      if (dupCount > 0) {
        console.log(`[ニュース取得] スマート重複排除: ${dupCount}件の重複・類似記事を統合しました (残り${uniqueList.length}件)`);
      }
      return uniqueList;
    }

    const uniqueItems = smartDeduplicateNewsItems(allParsedItems);

    // 日時フィルタリング（日付のみでも日時でも高精度に対応）
    let startTimestamp = -Infinity;
    let endTimestamp = Infinity;

    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        if (typeof startDate === "string" && !startDate.includes("T") && !startDate.includes(":")) {
          d.setHours(0, 0, 0, 0);
        }
        startTimestamp = d.getTime();
      }
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) {
        if (typeof endDate === "string" && !endDate.includes("T") && !endDate.includes(":")) {
          d.setHours(23, 59, 59, 999);
        }
        endTimestamp = d.getTime();
      }
    }

    const filteredItems = uniqueItems.filter(item => {
      if (!item.pubDate) return true;
      const itemDate = new Date(item.pubDate).getTime();
      if (isNaN(itemDate)) return true;
      return itemDate >= startTimestamp && itemDate <= endTimestamp;
    });

    // カテゴリごとに全記事をプール
    const categorized = {};
    for (const item of filteredItems) {
      const k = item.categoryKey || "cat_top";
      if (!categorized[k]) categorized[k] = [];
      categorized[k].push(item);
    }

    let finalItems = [];
    const selectedTitles = [];

    // トピックキーワード抽出（同一事件・同一トピック検知用）
    const extractTopicKeywords = (t) => {
      const norm = normalizeNewsTitle(t);
      const matches = norm.match(/([\u4E00-\u9FFF]{2,}|[\u30A1-\u30F6ー]{3,}|[a-zA-Z0-9]{3,})/g) || [];
      return new Set(matches);
    };

    // カテゴリ間トピック重複判定
    const isTopicDuplicate = (itemTitle, existingTitles) => {
      const norm = normalizeNewsTitle(itemTitle);
      const keywords = extractTopicKeywords(norm);
      for (const ex of existingTitles) {
        const exNorm = normalizeNewsTitle(ex);
        // 1. タイトル類似度チェック（Dice係数 >= 0.45）
        if (calculateTitleSimilarity(norm, exNorm) >= 0.45) return true;
        // 2. キーワード重なりチェック（主要固有名詞・単語が2つ以上一致）
        const exKeywords = extractTopicKeywords(exNorm);
        let common = 0;
        for (const kw of keywords) {
          if (exKeywords.has(kw)) common++;
        }
        if (common >= 2 && keywords.size >= 2) return true;
      }
      return false;
    };

    const CATEGORY_ORDER = ["cat_top", "cat_society", "cat_world", "cat_business", "cat_politics", "cat_entertainment", "cat_sports", "cat_tech", "cat_science", "cat_local"];
    
    // 各カテゴリから重複しない記事を maxPerCategory 件ずつ選出
    CATEGORY_ORDER.forEach(catKey => {
      if (categorized[catKey]) {
        let count = 0;
        for (const item of categorized[catKey]) {
          if (count >= maxPerCategory) break;
          // 総合や他カテゴリで選出済みのトピックと被っていないか判定
          if (!isTopicDuplicate(item.title, selectedTitles)) {
            finalItems.push(item);
            selectedTitles.push(item.title);
            count++;
          }
        }
        // 重複除外ですべて弾かれてしまった場合のフォールバック（最初の記事を採用）
        if (count === 0 && categorized[catKey].length > 0) {
          finalItems.push(categorized[catKey][0]);
          selectedTitles.push(categorized[catKey][0].title);
        }
      }
    });

    // その他カテゴリ
    Object.keys(categorized).forEach(k => {
      if (!CATEGORY_ORDER.includes(k)) {
        for (const item of categorized[k]) {
          if (!isTopicDuplicate(item.title, selectedTitles)) {
            finalItems.push(item);
            selectedTitles.push(item.title);
          }
        }
      }
    });

    window.latestFetchedNews = finalItems;
    try {
      localStorage.setItem("latestFetchedNews", JSON.stringify(finalItems));
    } catch (e) { }
    if (typeof window.updateNewsListPopup === "function") {
      window.updateNewsListPopup();
    }

    return finalItems;
  };

  // 進行テンプレート自動生成ボタン
  if (window.newsScriptGenBtn) {
    window.newsScriptGenBtn.addEventListener("click", () => {
      const catSelect = document.getElementById("news-config-category");
      const countSelect = document.getElementById("news-config-count");
      const titleInput = document.getElementById("news-config-title");
      const nameInput = document.getElementById("news-config-name");
      const opInput = document.getElementById("news-config-opening");
      const edInput = document.getElementById("news-config-closing");

      const count = parseInt(countSelect ? countSelect.value : "3", 10);
      const progTitle = titleInput?.value.trim() || "ニュース番組";
      const isZunda = currentModelId === "zundamon" || currentModelId === "zundamon_human";
      const opGreeting = opInput?.value.trim() || (isZunda ? `こんにちは！${progTitle}のお時間なのだ！` : `こんにちは！${progTitle}のお時間です！`);
      const edGreeting = edInput?.value.trim() || (isZunda ? "本日のニュースは以上になります。それでは皆さん、良い一日をなのだ！" : "本日のニュースは以上になります。それでは皆さん、良い一日をお過ごしください！");

      const cbs = document.querySelectorAll('#news-script-settings-details input[name="news-se"]:checked');
      const seList = Array.from(cbs).map(cb => cb.value);

      // ニュース取得は行わず、瞬時に進行テンプレートを生成
      let templateLines = [];
      templateLines.push(opGreeting);
      if (seList.includes("放送開始チャイム")) {
        templateLines.push("[SE: 放送開始チャイム]");
      }

      for (let i = 0; i < count; i++) {
        templateLines.push("[ニュース枠]");
        if (i < count - 1 && seList.includes("シーン切り替え1")) {
          templateLines.push("[SE: シーン切り替え1]");
        }
      }

      templateLines.push(edGreeting);
      if (seList.includes("放送終了チャイム")) {
        templateLines.push("[SE: 放送終了チャイム]");
      }

      const scriptText = templateLines.join("\n");
      if (newsScriptTextarea) newsScriptTextarea.value = scriptText;
      if (newsScriptYomiTextarea) newsScriptYomiTextarea.value = scriptText;

      alert(`ニュース番組の進行テンプレート（ニュース枠 ${count}本）を生成しました！\nお好みでセリフやSEを手直ししてください。`);
    });
  }

  let newsSlotCurrentIndex = 0;
  let lastNewsCategory = "";

  // ニュース台本シーケンス再生ロジック
  async function playNextNewsScriptLine() {
    if (!newsModeState.isPlaying) return;
    if (newsModeState.currentScriptIndex >= newsModeState.scriptLines.length) {
      console.log("[ニュース台本] 全ての台本読み上げが完了しました。");
      newsModeState.isPlaying = false;
      newsSlotCurrentIndex = 0;
      lastNewsCategory = "";
      if (newsScriptPlayBtn) newsScriptPlayBtn.style.display = "block";
      if (newsScriptStopBtn) newsScriptStopBtn.style.display = "none";
      return;
    }

    const rawLine = newsModeState.scriptLines[newsModeState.currentScriptIndex];
    const yomiLine = (newsModeState.scriptYomiLines && newsModeState.scriptYomiLines[newsModeState.currentScriptIndex])
      ? newsModeState.scriptYomiLines[newsModeState.currentScriptIndex]
      : rawLine;

    console.log(`[ニュース台本] 行 ${newsModeState.currentScriptIndex + 1}/${newsModeState.scriptLines.length}: ${rawLine}`);

    // SEタグ判定
    const seMatch = rawLine.match(/^\[SE:\s*(.+?)\]$/i);
    if (seMatch) {
      const seName = seMatch[1].trim();
      try {
        const audio = new Audio(`se/${seName}.mp3`);
        const seVolSlider = document.getElementById("se-volume-slider");
        const savedSeVol = localStorage.getItem("savedSeVolume");
        audio.volume = seVolSlider ? (parseFloat(seVolSlider.value) / 100.0) : (savedSeVol ? (parseFloat(savedSeVol) / 100.0) : 1.0);
        audio.play().catch(e => console.warn(e));
      } catch (e) { }
      newsModeState.currentScriptIndex++;
      setTimeout(playNextNewsScriptLine, 1200);
      return;
    }

    // [ニュース枠] タグ判定（その場で最新ニュースを1本流し込んで読む）
    if (rawLine.trim() === "[ニュース枠]" || rawLine.includes("[NEWS_SLOT]")) {
      console.log(`[ニュース台本] 【ニュース枠】第${newsSlotCurrentIndex + 1}本の記事を読み上げます`);

      // 取得済みニュースの確認
      if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) {
        console.log("[ニュース台本] 取得済みニュースがないため、RSSから自動取得します...");
        try {
          await playNextContinuousNews(true, true); // 取得だけ実行
        } catch (e) {
          console.warn("[ニュース台本] RSS自動取得エラー:", e);
        }
      }

      const availableNews = window.latestFetchedNews || [];
      if (availableNews.length === 0) {
        console.warn("[ニュース台本] 読み上げるニュース記事が見つかりません。次行へスキップします。");
        newsModeState.currentScriptIndex++;
        setTimeout(playNextNewsScriptLine, 500);
        return;
      }

      // 未読記事、またはインデックス順で取得
      let item = availableNews.find(n => !readNewsTitles.has(n.title));
      if (!item) {
        item = availableNews[newsSlotCurrentIndex % availableNews.length];
      }
      readNewsTitles.add(item.title);
      try {
        localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles)));
      } catch (e) { }
      if (typeof window.updateNewsListPopup === "function") {
        window.updateNewsListPopup();
      }

      // 画面表示更新
      const newsTitleEl = document.getElementById("news-article-title");
      const newsDescEl = document.getElementById("news-article-desc");
      const newsBoardEl = document.getElementById("news-board");
      const tmpDiv = document.createElement("div");
      tmpDiv.innerHTML = item.description || "";
      let plainDesc = tmpDiv.textContent || tmpDiv.innerText || "";
      if (plainDesc.length > 100) plainDesc = plainDesc.substring(0, 100) + "...";

      if (newsTitleEl) newsTitleEl.textContent = item.title;
      if (newsDescEl) newsDescEl.textContent = plainDesc;
      if (newsBoardEl) newsBoardEl.classList.add("active");

      // つなぎとAI要約のプロンプト構築
      const isZunda = currentModelId === "zundamon" || currentModelId === "zundamon_human";
      const zundaPrompt = isZunda ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。" : "";

      let transitionText = "";
      if (newsSlotCurrentIndex === 0) {
        transitionText = isZunda ? "「最初のニュースなのだ」と前置きして" : "「最初のニュースです」と前置きして";
      } else if (item.categoryName && item.categoryName !== lastNewsCategory) {
        transitionText = isZunda ? `「続いては、${item.categoryName}のニュースなのだ」と前置きして` : `「続いては、${item.categoryName}のニュースです」と前置きして`;
      } else {
        transitionText = isZunda ? "「次のニュースなのだ」と前置きして" : "「次のニュースです」と前置きして";
      }
      if (item.categoryName) lastNewsCategory = item.categoryName;
      newsSlotCurrentIndex++;

      const prompt = `あなたはVTuberのニュースキャスターです。以下のニュース記事について、${transitionText}、リスナーに向けて分かりやすく1〜2文で要約し、続けてあなた自身の率直な一言感想・リアクションを述べてください。余計な前置きや括弧書きは不要です。${zundaPrompt}

【ニュースタイトル】: ${item.title}
【概要】: ${plainDesc}`;

      const apiKeyInput = document.getElementById("ai-api-key");
      const providerSelect = document.getElementById("ai-provider-select");
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
      const provider = providerSelect ? providerSelect.value : "gemini";

      try {
        if (apiKey) {
          const text = await aiFeatures.callAI(prompt, apiKey, provider, true);
          if (text) {
            let phraseToSpeak = aiFeatures.adjustIdlePhraseForModel(text, currentModelId);
            await queueVoicevoxAudio(phraseToSpeak, true);
          }
        }
      } catch (e) {
        console.warn("[ニュース枠] 読み上げエラー:", e);
      }

      // 次の台本行へ
      newsModeState.currentScriptIndex++;
      if (newsModeState.isPlaying) {
        setTimeout(playNextNewsScriptLine, 1200);
      }
      return;
    }

    // TELOPタグ判定 (手動見出し更新)
    const telopMatch = rawLine.match(/^\[(?:TELOP|ニュース見出し):\s*(.+?)\]$/i);
    if (telopMatch) {
      const telopText = telopMatch[1].trim();
      const titleEl = document.getElementById("news-article-title");
      const boardEl = document.getElementById("news-board");
      if (titleEl) titleEl.textContent = telopText;
      if (boardEl) boardEl.style.display = "flex";
      newsModeState.currentScriptIndex++;
      setTimeout(playNextNewsScriptLine, 400);
      return;
    }

    // 通常のセリフ発声（OPやED挨拶など）
    try {
      await queueVoicevoxAudio(yomiLine, true);
    } catch (e) {
      console.warn("台本発声エラー:", e);
    }

    // 次の行へ
    newsModeState.currentScriptIndex++;
    if (newsModeState.isPlaying) {
      setTimeout(playNextNewsScriptLine, 1200);
    }
  }

  // ニュース台本再生ボタン
  if (newsScriptPlayBtn) {
    newsScriptPlayBtn.addEventListener("click", () => {
      if (!newsModeState.scriptLines || newsModeState.scriptLines.length === 0) {
        alert("先にニュース台本を作成・保存してください。");
        return;
      }
      let startIdx = 0;
      if (newsScriptStartLine) {
        let val = parseInt(newsScriptStartLine.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > newsModeState.scriptLines.length) val = newsModeState.scriptLines.length;
        startIdx = val - 1;
      }
      newsModeState.currentScriptIndex = startIdx;
      newsModeState.isPlaying = true;

      newsScriptPlayBtn.style.display = "none";
      if (newsScriptStopBtn) newsScriptStopBtn.style.display = "block";

      console.log(`[ニュース台本] 再生開始。開始行: ${startIdx + 1}`);
      playNextNewsScriptLine();
    });
  }

  // ニュース台本停止ボタン
  if (newsScriptStopBtn) {
    newsScriptStopBtn.addEventListener("click", () => {
      newsModeState.isPlaying = false;
      newsScriptPlayBtn.style.display = "block";
      newsScriptStopBtn.style.display = "none";
      if (typeof voicevoxAudioQueue !== "undefined") {
        voicevoxAudioQueue.length = 0;
      }
      console.log("[ニュース台本] 再生を停止しました。");
    });
  }

  // メイン画面のニュース取得期間クイックボタン
  const formatDatetimeLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const pStartInput = document.getElementById("news-date-start");
  const pEndInput = document.getElementById("news-date-end");

  const applyQuickRange = (rangeKey = "12h") => {
    const now = new Date();
    const btn12 = document.getElementById("panel-quick-12h");
    const btn24 = document.getElementById("panel-quick-24h");
    const btnToday = document.getElementById("panel-quick-today");
    const btnAll = document.getElementById("panel-quick-all");
    const allBtns = [btn12, btn24, btnToday, btnAll].filter(Boolean);

    allBtns.forEach(btn => {
      btn.style.background = "rgba(255,255,255,0.08)";
      btn.style.borderColor = "rgba(255,255,255,0.2)";
      btn.style.color = "#fff";
      btn.style.fontWeight = "normal";
    });

    if (rangeKey === "12h") {
      const past = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      if (pStartInput) pStartInput.value = formatDatetimeLocal(past);
      if (pEndInput) pEndInput.value = formatDatetimeLocal(now);
      if (btn12) {
        btn12.style.background = "rgba(0, 210, 211, 0.25)";
        btn12.style.borderColor = "#00d2d3";
        btn12.style.color = "#00ffff";
        btn12.style.fontWeight = "bold";
      }
    } else if (rangeKey === "24h") {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (pStartInput) pStartInput.value = formatDatetimeLocal(past);
      if (pEndInput) pEndInput.value = formatDatetimeLocal(now);
      if (btn24) {
        btn24.style.background = "rgba(0, 210, 211, 0.25)";
        btn24.style.borderColor = "#00d2d3";
        btn24.style.color = "#00ffff";
        btn24.style.fontWeight = "bold";
      }
    } else if (rangeKey === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      if (pStartInput) pStartInput.value = formatDatetimeLocal(todayStart);
      if (pEndInput) pEndInput.value = formatDatetimeLocal(todayEnd);
      if (btnToday) {
        btnToday.style.background = "rgba(0, 210, 211, 0.25)";
        btnToday.style.borderColor = "#00d2d3";
        btnToday.style.color = "#00ffff";
        btnToday.style.fontWeight = "bold";
      }
    } else if (rangeKey === "all") {
      if (pStartInput) pStartInput.value = "";
      if (pEndInput) pEndInput.value = "";
      if (btnAll) {
        btnAll.style.background = "rgba(0, 210, 211, 0.25)";
        btnAll.style.borderColor = "#00d2d3";
        btnAll.style.color = "#00ffff";
        btnAll.style.fontWeight = "bold";
      }
    }

    localStorage.setItem("savedNewsQuickRange", rangeKey);
  };

  document.getElementById("panel-quick-12h")?.addEventListener("click", () => applyQuickRange("12h"));
  document.getElementById("panel-quick-24h")?.addEventListener("click", () => applyQuickRange("24h"));
  document.getElementById("panel-quick-today")?.addEventListener("click", () => applyQuickRange("today"));
  document.getElementById("panel-quick-all")?.addEventListener("click", () => applyQuickRange("all"));

  // 起動時の初期化：保存されたモード（デフォルトは12h）を現在時刻基準で適用
  const savedQuickRange = localStorage.getItem("savedNewsQuickRange") || "12h";
  applyQuickRange(savedQuickRange);

  const pCountSelect = document.getElementById("news-item-count-select");
  if (pCountSelect) {
    const savedCount = localStorage.getItem("savedNewsCountSelect");
    if (savedCount) pCountSelect.value = savedCount;
    pCountSelect.addEventListener("change", () => {
      localStorage.setItem("savedNewsCountSelect", pCountSelect.value);
    });
  }

  // OBS配信連動スイッチの初期化（デフォルトは安全重視でOFF）
  const newsObsToggle = document.getElementById("news-obs-auto-stream-toggle");
  if (newsObsToggle) {
    const saved = localStorage.getItem("newsObsAutoStreamToggle");
    if (saved !== null) {
      newsObsToggle.checked = saved === "true";
    } else {
      newsObsToggle.checked = false;
    }
    newsObsToggle.addEventListener("change", () => {
      localStorage.setItem("newsObsAutoStreamToggle", newsObsToggle.checked);
    });
  }

  // Draggable News Board
  if (window.newsBoard) {
    const newsHeader = window.newsBoard.querySelector(".news-header");
    if (newsHeader) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      // Load saved position
      const savedLeft = localStorage.getItem("newsBoardLeft");
      const savedTop = localStorage.getItem("newsBoardTop");
      if (savedLeft && savedTop) {
        window.newsBoard.style.left = savedLeft;
        window.newsBoard.style.top = savedTop;
      }

      newsHeader.addEventListener("mousedown", (e) => {
        isDragging = true;
        window.newsBoard.classList.add("dragging");

        // Calculate initial positions
        const rect = window.newsBoard.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Keep it within screen bounds
        newLeft = Math.max(
          0,
          Math.min(newLeft, window.innerWidth - window.newsBoard.offsetWidth),
        );
        newTop = Math.max(
          0,
          Math.min(newTop, window.innerHeight - window.newsBoard.offsetHeight),
        );

        window.newsBoard.style.left = `${newLeft}px`;
        window.newsBoard.style.top = `${newTop}px`;
      });

      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          window.newsBoard.classList.remove("dragging");

          // Save position
          localStorage.setItem("newsBoardLeft", window.newsBoard.style.left);
          localStorage.setItem("newsBoardTop", window.newsBoard.style.top);
        }
      });
    }
  }

  // Draggable News Setlist Board
  const setlistBoard = document.getElementById("news-setlist-board");
  if (setlistBoard) {
    const setlistHeader = setlistBoard.querySelector(".setlist-header");
    if (setlistHeader) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      const savedLeft = localStorage.getItem("newsSetlistBoardLeft");
      const savedTop = localStorage.getItem("newsSetlistBoardTop");
      if (savedLeft && savedTop) {
        setlistBoard.style.left = savedLeft;
        setlistBoard.style.top = savedTop;
      }

      setlistHeader.addEventListener("mousedown", (e) => {
        isDragging = true;
        setlistBoard.classList.add("dragging");

        const rect = setlistBoard.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        newLeft = Math.max(
          0,
          Math.min(newLeft, window.innerWidth - setlistBoard.offsetWidth),
        );
        newTop = Math.max(
          0,
          Math.min(newTop, window.innerHeight - setlistBoard.offsetHeight),
        );

        setlistBoard.style.left = `${newLeft}px`;
        setlistBoard.style.top = `${newTop}px`;
      });

      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          setlistBoard.classList.remove("dragging");

          localStorage.setItem("newsSetlistBoardLeft", setlistBoard.style.left);
          localStorage.setItem("newsSetlistBoardTop", setlistBoard.style.top);
        }
      });
    }
  }
});