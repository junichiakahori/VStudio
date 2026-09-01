
// 🚫 動画視聴前提のダイジェスト記事（Pickup NEWS等）や無意味なサイトヘッダーを除外する判定
function isInvalidNewsVideoArticle(item) {
  if (!item || !item.title) return true;
  const title = item.title.trim();
  const desc = (item.description || "").trim();

  // 1. タイトル判定
  const VIDEO_TITLE_PATTERNS = [
    /【動画】|\[動画\]|\(動画\)/i,
    /Pickup\s*NEWS|ピックアップニュース/i,
    /1分でわかる|まるわかり|ダイジェスト/i,
    /動画で見る|動画ニュース|動画配信/i,
    /Live配信|ライブ配信|生中継|ライブ中継/i,
    /^(ニュース|Google\s*ニュース|Yahoo!\s*ニュース|トップニュース|主要ニュース|トピックス)$/i
  ];
  for (const pat of VIDEO_TITLE_PATTERNS) {
    if (pat.test(title)) return true;
  }

  // 2. 本文（description）判定
  const VIDEO_DESC_PATTERNS = [
    /まとめて.*分の動画でお伝えします/i,
    /動画でお伝えします/i,
    /動画をご覧ください/i,
    /データ放送では動画をご覧いただけません/i,
    /動画をご視聴ください/i
  ];
  for (const pat of VIDEO_DESC_PATTERNS) {
    if (pat.test(desc)) return true;
  }

  return false;
}
let readNewsTitles = new Set(JSON.parse(localStorage.getItem("newsReadTitles") || "[]")); // 既読ニュースのタイトルを保持するセット
window.readNewsTitles = readNewsTitles;
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

// HTMLタグ・実体参照（&lt;, &gt;, <ol>, <a> 等）を安全かつ完全に除去して平文にする共通関数
function stripHtmlTags(htmlStr) {
  if (!htmlStr) return "";
  let clean = String(htmlStr).replace(/<[^>]*>/g, " ");
  try {
    const doc = new DOMParser().parseFromString(clean, "text/html");
    clean = doc.body.textContent || "";
  } catch (e) { }
  return clean.replace(/<[^>]*>/g, " ").replace(/&[a-zA-Z0-9#]+;/g, " ").replace(/\s+/g, " ").trim();
}

// 📰 記事一覧を別ウィンドウ（ポップアップ）で開く共通関数（配信画面への被りを完全防止）
window.openNewsListPopup = function () {
  if (window.latestFetchedNews && window.latestFetchedNews.length > 0) {
    try {
      localStorage.setItem("latestFetchedNews", JSON.stringify(window.latestFetchedNews));
    } catch (e) { }
  }

  try {
    if (window.newsListPopup && !window.newsListPopup.closed) {
      try {
        if (typeof window.newsListPopup.renderNewsList === "function") {
          window.newsListPopup.renderNewsList();
        }
        window.newsListPopup.focus();
        return;
      } catch (checkErr) {
        window.newsListPopup = null;
      }
    }
  } catch (e) {
    window.newsListPopup = null;
  }

  try {
    const url = "/news_list.html?t=" + Date.now();
    const popup = window.open(url, "_blank", "width=820,height=860,menubar=no,toolbar=no,location=no,status=no");
    if (popup) {
      window.newsListPopup = popup;
      try { popup.focus(); } catch (e) {}
    }
  } catch (err) {
    console.error("[記事一覧] 別窓起動エラー:", err);
    try { window.open("/news_list.html", "_blank"); } catch (e) {}
  }
};

// ニュース見出しのスマート整形（メディア名サフィックスや無意味なサイト名の除去）
function cleanTitleForSpeech(title) {
  if (!title) return "";
  let t = stripHtmlTags(String(title)).trim();
  // 末尾のメディア名サフィックスを除去 (例: "〇〇 - Google ニュース" ➔ "〇〇")
  t = t.replace(/[\s\-–—|｜]+(Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|NHK\s*NEWS\s*WEB|ITmedia[A-Za-z0-9\s]*|共同通信|時事通信|読売新聞|朝日新聞|毎日新聞|産経新聞|日経新聞|日本経済新聞|TBS\s*NEWS\s*DIG|FNNプライムオンライン|テレ朝news|日テレNEWS[A-Za-z0-9\s]*)$/i, "");
  // 単なるサイト名・ヘッダー名のみの場合は読み上げスキップ
  if (/^(ニュース|Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|トップニュース|主要ニュース|トピックス)$/i.test(t.trim())) {
    return "";
  }
  return t.trim();
}

function getNewsTransitionPhrase(isFirst = false, isCatChanged = false, catName = "") {
  const modelId = (typeof currentModelId !== "undefined" ? String(currentModelId) : "");
  const isZunda = modelId.includes("zunda");
  const isCat = modelId.includes("tororo") || modelId.includes("cat");

  if (isFirst) {
    return isZunda ? "最初のニュースなのだ！" : (isCat ? "最初のニュースですにゃ！" : "最初のニュースです！");
  } else if (isCatChanged && catName) {
    return isZunda ? `続いては、${catName}のニュースなのだ！` : (isCat ? `続いては、${catName}のニュースですにゃ！` : `続いては、${catName}のニュースです！`);
  } else {
    return isZunda ? "次のニュースなのだ！" : (isCat ? "次のニュースですにゃ！" : "次のニュースです！");
  }
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

/**
 * RSS XMLのitemノードから記事のURL（link/guid）を確実に抽出する
 */
function extractLinkFromXmlNode(node) {
  if (!node) return "";
  const linkNode = node.querySelector("link") || node.getElementsByTagName("link")[0] || node.querySelector("guid");
  if (linkNode) {
    const text = (linkNode.textContent || linkNode.getAttribute("href") || "").trim();
    if (text.startsWith("http")) return text;
  }
  // 全タグからhttpで始まるものを探すフォールバック
  const allNodes = node.getElementsByTagName("*");
  for (let i = 0; i < allNodes.length; i++) {
    const val = (allNodes[i].textContent || "").trim();
    if (val.startsWith("http://") || val.startsWith("https://")) {
      return val;
    }
  }
  return "";
}

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
      let prompt = "";
      if (typeof window.PromptLoader !== "undefined" && typeof window.PromptLoader.getFormattedPrompt === "function") {
        prompt = await window.PromptLoader.getFormattedPrompt("news_ending_soon", { zundaPrompt });
      }
      if (!prompt) {
        prompt = `あなたはVTuberの配信者です。配信の終了時間が1分後に迫っています。リスナーに向けて締めの挨拶を1〜2文で述べてください。余計な説明は不要です。${zundaPrompt}`;
      }

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

            const linkUrl = extractLinkFromXmlNode(node);

            return {
              title: titleNode ? titleNode.textContent : "",
              description: stripHtmlTags(descNode ? descNode.textContent : ""),
              link: linkUrl,
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

      // 動画ダイジェスト記事・ヘッダー行の除外 & 重複排除
      const uniqueItemsMap = new Map();
      allParsedItems.forEach(item => {
        if (item.title && !isInvalidNewsVideoArticle(item) && !uniqueItemsMap.has(item.title)) {
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
        let prompt = "";
        if (typeof window.PromptLoader !== "undefined" && typeof window.PromptLoader.getFormattedPrompt === "function") {
          prompt = await window.PromptLoader.getFormattedPrompt("news_closing", { zundaPrompt });
        }
        if (!prompt) {
          prompt = `あなたはVTuberの配信者です。最新ニュースをすべて読み終えたので、リスナーに向けて締めの挨拶を1文で述べてください。${zundaPrompt}`;
        }

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
    const provider = (providerSelect && providerSelect.value) || localStorage.getItem("savedAiProvider") || "ollama";
    const apiKeyInput = document.getElementById("ai-api-key");
    const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : "") || localStorage.getItem("savedAiApiKey") || localStorage.getItem("ai_api_key") || "";
    const isZunda =
      currentModelId === "zundamon" || currentModelId === "zundamon_human";
    const zundaPrompt = isZunda
      ? "語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。"
      : "";

    let introInstruction = isOneOff
      ? "まずリスナーに向けて1文で要約して紹介し"
      : "「次のニュースです」などと一言添えてからリスナーに向けて1文で要約し";

    let prompt = "";
    if (typeof window.PromptLoader !== "undefined" && typeof window.PromptLoader.getFormattedPrompt === "function") {
      prompt = await window.PromptLoader.getFormattedPrompt("news_reaction", {
        introInstruction,
        zundaPrompt,
        title: item.title,
        content: plainDesc
      });
    }
    if (!prompt) {
      prompt = `以下のニュースについて要約と感想を述べてください。\n【タイトル】${item.title}\n【本文】${plainDesc}`;
    }

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
    let scriptData = null;
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
        scriptData = data;
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
      console.warn("[ニュースモード] ⚠️ AI原稿の生成に失敗したため、番組品質維持のためニュース読み上げを中断し、待機・再試行します。");
      if (newsBoard) {
        if (newsArticleTitle) newsArticleTitle.textContent = "📡 通信状況を確認中...";
        if (newsArticleDesc) newsArticleDesc.textContent = "AI原稿サーバーの応答を待機しています。しばらくお待ちください...";
        newsBoard.classList.add("active");
      }
      isReadingNews = false;
      setTimeout(() => {
        if (window.isContinuousNewsMode && typeof window.playNextContinuousNews === "function") {
          window.playNextContinuousNews();
        }
      }, 4000);
      return;
    }

    // 🎙️ ① システムによる定型繋ぎセリフを発話
    const categoryDisplayName = CATEGORY_NAMES[item.categoryKey || "cat_top"] || catName || "";
    const transitionPhrase = getNewsTransitionPhrase(false, false, categoryDisplayName);
    queueVoicevoxAudio(transitionPhrase, true).catch((e) => console.warn(e));

    // 📰 ② 元記事タイトルをそのまま発話
    if (item && item.title) {
      const headlineText = cleanTitleForSpeech(item.title);
      if (headlineText) {
        console.log(`[原稿] [見出し] "${headlineText}"`);
        queueVoicevoxAudio(headlineText, true, headlineText).catch((e) => console.warn(e));
      }
    }

    // 各文をVOICEVOXに順次キュー追加して再生
    setTimeout(() => {
      const idleFirstPerson = document.getElementById("idle-first-person");
      const fp = idleFirstPerson ? idleFirstPerson.value : "";

      scriptItems.forEach((sItem, sIdx) => {
        let displayTxt = sItem.display || sItem.speech;
        let speechTxt = sItem.speech || sItem.display;

        displayTxt = aiFeatures.adjustIdlePhraseForModel(displayTxt, currentModelId);
        speechTxt = aiFeatures.adjustIdlePhraseForModel(speechTxt, currentModelId);

        if (fp) {
          displayTxt = displayTxt.replace(/わたくし|わたし|あたし|私(?![一-龠々])|ぼく|僕(?![一-龠々])|おれ|俺(?![一-龠々])|うち/g, fp);
          speechTxt = speechTxt.replace(/わたくし|わたし|あたし|私(?![一-龠々])|ぼく|僕(?![一-龠々])|おれ|俺(?![一-龠々])|うち/g, fp);
        }

        if (typeof aiChatHistory !== "undefined") {
          aiChatHistory.push({ role: "assistant", content: displayTxt });
          if (aiChatHistory.length > 10) aiChatHistory.shift();
        }

        // 🎯 【修正】音声用（speechTxt）を第1引数、表示用（displayTxt）を明確に紐付けてキューに直接プッシュする
        if (typeof voicevoxAudioQueue !== "undefined") {
          voicevoxAudioQueue.push({
            original: speechTxt,       // 🗣️ 音声用の読み（ひらがな等）
            displayText: displayTxt,   // 📝 字幕・原稿用の綺麗な漢字テキスト
            promise: Promise.resolve(speechTxt),
            isIdle: true
          });
          if (!isVoicevoxPlaying && typeof playNextVoicevox === "function") {
            playNextVoicevox();
          }
        }
      });

      // 読み上げ完了を監視
      const checkInterval = setInterval(async () => {
        const isDone =
          (typeof voicevoxAudioQueue !== "undefined"
            ? voicevoxAudioQueue.length === 0
            : true) &&
          (typeof isVoicevoxPlaying !== "undefined"
            ? !isVoicevoxPlaying
            : true);
        if (isDone) {
          clearInterval(checkInterval);

          // 🎙️ 単発モードでも待機コメントがあれば合間に紹介＆返信
          if (typeof processNewsInterludeComments === "function" && window.newsCommentQueue && window.newsCommentQueue.length > 0) {
            await processNewsInterludeComments();
          }

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

// 📰 記事一覧からの特定記事指定再生
window.startNewsFromTitle = async function (targetTitle) {
  console.log(`[ニュースモード] 🎯 指定記事から開始リクエスト: "${targetTitle}"`);

  let newsList = window.latestFetchedNews || [];
  if (!newsList || newsList.length === 0) {
    try {
      newsList = JSON.parse(localStorage.getItem("latestFetchedNews") || "[]");
    } catch (e) {}
  }

  if (!newsList || newsList.length === 0) {
    console.warn("[ニュースモード] ニュース記事データが存在しません");
    return;
  }

  const CATEGORY_ORDER = ["cat_top", "cat_society", "cat_world", "cat_business", "cat_politics", "cat_entertainment", "cat_sports", "cat_tech", "cat_science", "cat_local"];
  const sortedNews = [...newsList].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.categoryKey || "cat_top");
    const bi = CATEGORY_ORDER.indexOf(b.categoryKey || "cat_top");
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (catDiff !== 0) return catDiff;
    const dateA = new Date(a.pubDate || 0).getTime();
    const dateB = new Date(b.pubDate || 0).getTime();
    return dateA - dateB;
  });

  const targetIdx = sortedNews.findIndex((n) => n.title === targetTitle || n.title.includes(targetTitle));
  if (targetIdx === -1) {
    console.warn("[ニュースモード] 指定記事が見つかりませんでした:", targetTitle);
    return;
  }

  // 全自動ニュース番組（アジェンダボード＋先読み＋待機制御付き）を指定インデックスから開始（OBS制御はスキップ）
  if (typeof window.startNewsBroadcast === "function") {
    await window.startNewsBroadcast(targetIdx, null, true);
    return;
  }

  // フォールバック（従来方式）
  const beforeItems = sortedNews.slice(0, targetIdx);
  const remainingItems = sortedNews.slice(targetIdx);

  beforeItems.forEach((item) => readNewsTitles.add(item.title));
  remainingItems.forEach((item) => readNewsTitles.delete(item.title));
  localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles)));

  window.continuousNewsItems = [...remainingItems];

  const newsToggle = document.getElementById("ai-news-mode-toggle");
  if (newsToggle && !newsToggle.checked) {
    newsToggle.checked = true;
    newsToggle.dispatchEvent(new Event("change"));
  }
  window.isContinuousNewsMode = true;

  if (window.voicevoxAudioQueue) {
    window.voicevoxAudioQueue = [];
  }
  if (window.currentVoicevoxSource) {
    try { window.currentVoicevoxSource.stop(); } catch (e) {}
  }
  window.isVoicevoxPlaying = false;

  await window.playNextContinuousNews(false);
};

// 別ウィンドウからのstorageイベントリクエストを監視（ポーリング併用で100%確実に受信）
let lastProcessedNewsRequestTime = 0;
function processStartNewsRequest(raw) {
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data && data.title && data.timestamp && data.timestamp > lastProcessedNewsRequestTime) {
      lastProcessedNewsRequestTime = data.timestamp;
      console.log(`[ニュースモード] 📥 記事一覧からの再生リクエストを受信: "${data.title}"`);
      window.startNewsFromTitle(data.title);
    }
  } catch (err) {}
}

window.addEventListener("storage", (e) => {
  if (e.key === "startNewsRequest" && e.newValue) {
    processStartNewsRequest(e.newValue);
  }
});

// イベント不達時のためのポーリングバックアップ
setInterval(() => {
  const req = localStorage.getItem("startNewsRequest");
  if (req) {
    processStartNewsRequest(req);
  }
}, 500);

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("news-mode", () => {
  if (typeof window.initNewsResumeSystem === "function") {
    window.initNewsResumeSystem();
  }
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
    if (window.newsListPopup && !window.newsListPopup.closed) {
      try {
        if (typeof window.newsListPopup.renderNewsList === "function") {
          window.newsListPopup.renderNewsList();
        }
      } catch (e) { }
    }
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
  const headerNewsListBtn = document.getElementById("header-news-list-btn");
  if (newsListBtn) {
    newsListBtn.addEventListener("click", () => {
      window.openNewsListPopup();
    });
  }
  if (headerNewsListBtn) {
    headerNewsListBtn.addEventListener("click", () => {
      window.openNewsListPopup();
    });
  }

  // ⌨️ キーボードショートカット: 'N' キー または 'Alt+N' で即座に記事一覧を開く
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) return;

    // 物理キー "KeyN"、英数 "n"/"N"、日本語入力状態 "ん" 等に包括対応
    if (e.code === "KeyN" || e.key === "n" || e.key === "N" || e.key === "ん" || (e.altKey && (e.code === "KeyN" || e.key === "n" || e.key === "N"))) {
      if (e.isComposing) return;
      e.preventDefault();
      if (typeof window.openNewsListPopup === "function") {
        window.openNewsListPopup();
      }
    }
  });

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
          await ctx.resume().catch(() => { });
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

  const preloadedNewsMap = new Map();

  function triggerNewsPrefetch(item, isFirst = false, isCategoryChanged = false) {
    if (!item || !item.title || preloadedNewsMap.has(item.title)) return;
    const apiKeyInput = document.getElementById("ai-api-key");
    const providerSelect = document.getElementById("ai-provider-select");
    const modelInput = document.getElementById("ai-model-input");
    const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : "") || localStorage.getItem("savedAiApiKey") || localStorage.getItem("ai_api_key") || "";
    const provider = (providerSelect ? providerSelect.value : "") || localStorage.getItem("savedAiProvider") || "ollama";
    const modelName = (modelInput ? modelInput.value.trim() : "") || localStorage.getItem("savedAiModel") || (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash");

    let plainDesc = stripHtmlTags(item.description || "");
    if (plainDesc.length > 120) plainDesc = plainDesc.substring(0, 120) + "…";

    if (!item.link && window.latestFetchedNews) {
      const found = window.latestFetchedNews.find(x => x.title === item.title);
      if (found && found.link) item.link = found.link;
    }

    const payload = {
      title: item.title,
      description: plainDesc,
      url: item.link || "",
      categoryName: item.categoryName || "",
      modelId: window.currentModelId || "hiyori",
      isFirst: isFirst,
      isCategoryChanged: isCategoryChanged,
      apiKey: apiKey,
      provider: provider,
      modelName: modelName
    };

    const promise = (async () => {
      try {
        console.log(`[ニュース先読み] 🚀 次の記事「${item.title.substring(0, 20)}...」🔗 ${item.link || 'URLなし'} を先行生成中...`);
        const res = await fetch("/api/news/generate_item_script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && data.status === "ok") {
          console.log(`[ニュース先読み] ✅ 先行生成完了:「${item.title.substring(0, 20)}...」`);
          // 🚀 最初の文の音声もバックグラウンドで事前合成（記事切り替えラグを0.0秒化）
          try {
            const firstSentence = (data.items && data.items[0])
              ? (data.items[0].speech || data.items[0].display)
              : ((data.sentences && data.sentences[0]) || null);
            if (firstSentence && typeof window.preloadVoicevoxSentenceAudio === "function") {
              window.preloadVoicevoxSentenceAudio(firstSentence);
            }
          } catch (audioPreloadErr) { }
          return data;
        }
        return null;
      } catch (e) {
        console.warn(`[ニュース先読み] 先行生成スキップ (${item.title}):`, e);
        return null;
      }
    })();

    preloadedNewsMap.set(item.title, promise);
  }

  window.triggerNewsPrefetch = triggerNewsPrefetch;

  /**
   * 🎙️ ニュース記事合間のキャスターコメント返信ハンドラ
   * ニュース読み上げ中に視聴者から届いたコメントを記事終了時にキャスターとして紹介＆返信
   */
  async function processNewsInterludeComments() {
    if (!window.newsCommentQueue || window.newsCommentQueue.length === 0) return;
    if (typeof newsBroadcastState !== "undefined" && !newsBroadcastState.isRunning && !window.isReadingNews) return;

    const item = window.newsCommentQueue.shift();
    if (!item || !item.comment) return;

    console.log(`[ニュース番組] 🎙️ 記事合間のコメント紹介を開始: ${item.nickname}さん「${item.comment}」 (残り待機: ${window.newsCommentQueue.length}件)`);

    const isZunda = (currentModelId in ["zundamon", "zundamon_human"]);
    const isCat = (currentModelId in ["tororo", "hijiki"]);

    // 1. コメント読み上げの導入セリフ
    let intro = `リスナーの${item.nickname}さんからコメントをいただきました。「${item.comment}」とのことです。`;
    if (isZunda) {
      intro = `ここでリスナーの${item.nickname}さんからコメントなのだ！「${item.comment}」とのことなのだ！`;
    } else if (isCat) {
      intro = `ここでリスナーの${item.nickname}さんからコメントをいただきました！「${item.comment}」とのことですにゃ！`;
    }
    intro = aiFeatures.adjustIdlePhraseForModel(intro, currentModelId);

    // 一人称置換設定を反映
    const idleFirstPerson = document.getElementById("idle-first-person");
    const fp = idleFirstPerson ? idleFirstPerson.value : "";
    if (fp) {
      intro = intro.replace(/わたくし|わたし|あたし|私(?![一-龠々])|ぼく|僕(?![一-龠々])|おれ|俺(?![一-龠々])|うち/g, fp);
    }

    await queueVoicevoxAudio(intro, true);

    // 2. AIによるキャスター風の返信生成
    const isAiReplyEnabled = document.getElementById("ai-reply-toggle")?.checked;
    const apiKeyInput = document.getElementById("ai-api-key");
    const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : "") || localStorage.getItem("savedAiApiKey") || "";
    const providerSelect = document.getElementById("ai-provider-select");
    const provider = (providerSelect ? providerSelect.value : "") || localStorage.getItem("savedAiProvider") || "ollama";
    const modelInput = document.getElementById("ai-model-input");
    const modelName = (modelInput ? modelInput.value.trim() : "") || localStorage.getItem("savedAiModel") || (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash");

    if (isAiReplyEnabled && (apiKey || provider === "ollama")) {
      try {
        let charDesc = isZunda
          ? "明るく元気なずんだ妖精のニュースキャスター「ずんだもん」です。語尾は「〜のだ」「〜なのだ」です。"
          : (isCat ? "愛嬌のある白猫のニュースキャスター「とろろ」です。語尾は自然に「〜にゃ」を使います。" : "明るく丁寧なニュースキャスターです。");

        let prompt = "";
        if (typeof window.PromptLoader !== "undefined" && typeof window.PromptLoader.getFormattedPrompt === "function") {
          prompt = await window.PromptLoader.getFormattedPrompt("news_comment_reply", {
            charDesc,
            nickname: item.nickname,
            comment: item.comment
          });
        }
        if (!prompt) {
          prompt = `${item.nickname}さんのコメント「${item.comment}」に対して1〜2文で返信してください。`;
        }

        let reply = "";
        const res = await fetch("/api/news/generate_item_script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `コメント返信: ${item.nickname}さん`,
            description: prompt,
            categoryName: "コメント返信",
            modelId: currentModelId,
            isFirst: false,
            isCategoryChanged: false,
            apiKey: apiKey,
            provider: provider,
            modelName: modelName
          })
        });
        if (res.ok) {
          const d = await res.json();
          if (d && d.items && d.items.length > 0) {
            reply = d.items.map(it => it.display).join(" ");
          } else if (d && d.fullText) {
            reply = d.fullText;
          }
        }

        if (reply) {
          reply = aiFeatures.adjustIdlePhraseForModel(reply, currentModelId);
          if (fp) {
            reply = reply.replace(/わたくし|わたし|あたし|私(?![一-龠々])|ぼく|僕(?![一-龠々])|おれ|俺(?![一-龠々])|うち/g, fp);
          }
          await queueVoicevoxAudio(reply, true);
        }
      } catch (e) {
        console.warn("[ニュース番組] キャスターコメントAI返信エラー:", e);
      }
    }

    // 発話完了まで待機
    await waitForVoicevoxFinish();
    console.log(`[ニュース番組] 🎙️ 記事合間のコメント紹介が完了しました。`);
  }

  window.processNewsInterludeComments = processNewsInterludeComments;

  async function readOneNewsItem(item, config, isCategoryChanged, isFirst, nextItem = null, nextIsCatChanged = false) {
    if (!newsBroadcastState.isRunning) return false;

    const newsTitleEl = document.getElementById("news-article-title");
    const newsDescEl = document.getElementById("news-article-desc");
    const newsBoardEl = document.getElementById("news-board");
    const catEl = document.getElementById("news-board-category");
    const newsDateEl = document.getElementById("news-article-date");
    const progressBadge = document.getElementById("news-board-progress");

    let plainDesc = stripHtmlTags(item.description || "");
    if (plainDesc.length > 120) plainDesc = plainDesc.substring(0, 120) + "…";

    newsBroadcastState.currentTitle = item.title;
    window.newsBroadcastState = newsBroadcastState;
    updateBroadcastProgress(item);

    const apiKeyInput = document.getElementById("ai-api-key");
    const providerSelect = document.getElementById("ai-provider-select");
    const modelInput = document.getElementById("ai-model-input");
    const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : "") || localStorage.getItem("savedAiApiKey") || localStorage.getItem("ai_api_key") || "";
    const provider = (providerSelect ? providerSelect.value : "") || localStorage.getItem("savedAiProvider") || "ollama";
    const modelName = (modelInput ? modelInput.value.trim() : "") || localStorage.getItem("savedAiModel") || (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash");

    if (!item.link && window.latestFetchedNews) {
      const found = window.latestFetchedNews.find(x => x.title === item.title);
      if (found && found.link) item.link = found.link;
    }

    const isZundaMode = (typeof currentModelId !== "undefined" ? String(currentModelId) : "").includes("zunda");
    const charDescVal = isZundaMode
      ? "明るく元気なずんだ妖精のニュースキャスター「ずんだもん」です。語尾は「〜のだ」「〜なのだ」を使います。"
      : "愛嬌のある白猫のニュースキャスター「とろろ」です。語尾には自然に「〜にゃ」「〜にゃ！」を使います。";

    const payload = {
      title: item.title,
      description: plainDesc,
      url: item.link || "",
      categoryName: item.categoryName || "",
      modelId: currentModelId,
      charDesc: charDescVal,
      isFirst: isFirst,
      isCategoryChanged: isCategoryChanged,
      apiKey: apiKey,
      provider: provider,
      modelName: modelName
    };

    let hasAnnouncedOutage = false;
    let retryFailCount = 0;

    while (newsBroadcastState.isRunning) {
      let data = null;

      // 1. 先読み（プリフェッチ）キャッシュが存在する場合は即時活用（待ち時間ゼロ！）
      if (preloadedNewsMap.has(item.title)) {
        try {
          data = await preloadedNewsMap.get(item.title);
          preloadedNewsMap.delete(item.title);
          if (data && data.status === "ok") {
            console.log(`[ニュース番組] ⚡ 先読みキャッシュから即時再生開始:「${item.title.substring(0, 20)}...」`);
          }
        } catch (e) {
          data = null;
        }
      }

      // 2. キャッシュにない場合は通常フェッチ
      if (!data) {
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
            data = await res.json();
          } catch (jsonErr) {
            console.warn("[ニュース番組] JSONパースエラー:", jsonErr);
          }
        }
      }

      

      if (data && data.status === "ok" && (data.items || data.sentences) && ((data.items && data.items.length > 0) || (data.sentences && data.sentences.length > 0))) {
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

        // 記事読み上げ開始時に即座に既読フラグを記録・保存
        readNewsTitles.add(item.title);
        window.readNewsTitles = readNewsTitles;
        try { localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles))); } catch (e) { }

        // 🎙️ ① システムによる定型繋ぎセリフを発話
        const isFirstItem = isFirst || (newsBroadcastState.currentIndex === 1);
        const isCatChanged = !!isCategoryChanged;
        const catName = CATEGORY_NAMES[item.categoryKey || "cat_top"] || item.categoryName || "";
        const transitionPhrase = getNewsTransitionPhrase(isFirstItem, isCatChanged, catName);
        newsBroadcastState.lastCategory = item.categoryKey || "cat_top";

        await queueVoicevoxAudio(transitionPhrase, true);

        // 📰 ② 元記事タイトルをそのまま発話
        if (item.title) {
          const headlineText = cleanTitleForSpeech(item.title);
          if (headlineText) {
            console.log(`[原稿] [見出し] "${headlineText}"`);
            await queueVoicevoxAudio(headlineText, true, headlineText);
          }
        }

        // 🚀 ③ 次の記事の裏側先読みをトリガー（発話中に先読み）
        if (nextItem) {
          triggerNewsPrefetch(nextItem, false, nextIsCatChanged);
        }

        // 📝 ④ AIが生成したニュース本文の解説・感想を発話
        const count = (data.items || data.sentences || []).length;
        const articleUrl = item.link || item.url || "";
        console.log(`[ニュース原稿(Backend)] [${newsBroadcastState.currentIndex}/${newsBroadcastState.totalCount}件] 🔗 ${articleUrl || 'URLなし'}\n「${data.fullText}」 (${count}文)`);
        if (data.items && data.items.length > 0) {
          for (let sIdx = 0; sIdx < data.items.length; sIdx++) {
            if (!newsBroadcastState.isRunning) return false;
            const it = data.items[sIdx];
            try {
              localStorage.setItem("newsActiveState", JSON.stringify({
                isRunning: true,
                articleIndex: newsBroadcastState.currentIndex - 1,
                totalArticles: newsBroadcastState.totalCount,
                item: item,
                scriptData: data,
                sentenceIndex: sIdx,
                timestamp: Date.now()
              }));
            } catch (e) { }
            await queueVoicevoxAudio(it.display, true, it.speech);
          }
        } else if (data.sentences) {
          for (let sIdx = 0; sIdx < data.sentences.length; sIdx++) {
            if (!newsBroadcastState.isRunning) return false;
            const s = data.sentences[sIdx];
            await queueVoicevoxAudio(s, true);
          }
        }
        // VOICEVOXの読み上げが完全に終わるまで待機
        await waitForVoicevoxFinish();

        // 🎙️ 記事終了時に待機コメントがあればキャスターとして紹介＆返信！
        if (typeof processNewsInterludeComments === "function") {
          await processNewsInterludeComments();
        }

        // 既読マーク
        readNewsTitles.add(item.title);
        if (window.readNewsTitles) window.readNewsTitles.add(item.title);
        try { localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles))); } catch (e) { }
        if (typeof window.updateNewsListPopup === "function") {
          window.updateNewsListPopup();
        }
        return true; // 正常読み上げ完了！
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

      // 3. API無駄打ち防止バックオフ待機
      retryFailCount++;
      if (retryFailCount >= 3) {
        console.warn(`[ニュース番組] ⏩ 3回連続で生成不可のため、この記事をスキップして次へ進みます: 「${item.title}」`);
        readNewsTitles.add(item.title);
        if (window.readNewsTitles) window.readNewsTitles.add(item.title);
        try { localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles))); } catch (e) { }
        return false; // 次のニュースへ進んで配信を継続！
      }
      const waitTimeMs = 3000;
      await new Promise(r => setTimeout(r, waitTimeMs));
    }

    return false;
  }

  window.readOneNewsItem = readOneNewsItem;

  async function startNewsBroadcast(startIndex = 0, items = null, isFromNewsList = false) {
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

    const isMidwayStart = (startIndex > 0);
    newsBroadcastState = { isRunning: true, currentIndex: startIndex, totalCount: sortedNews.length, lastCategory: "", isFromNewsList: !!isFromNewsList };
    if (startBtn) startBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "block";
    if (progressEl) progressEl.style.display = "block";

    const startIdxInput = document.getElementById("news-broadcast-start-index");
    if (startIdxInput) startIdxInput.value = startIndex + 1;

    if (typeof clearIdleTimer === "function") clearIdleTimer();

    // 番組開始時にセットリストボードを初期化・表示
    initNewsSetlist(sortedNews);

    // 途中から開始した場合は、それ以前の記事をすべて既読フラグに反映して保存
    if (startIndex > 0) {
      for (let k = 0; k < startIndex; k++) {
        if (sortedNews[k]) readNewsTitles.add(sortedNews[k].title);
      }
      try {
        localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles)));
      } catch (e) { }
    }

    // 番組開始時にコメント履歴とコメント数を初期化（途中再開でない場合のみクリア）
    if (startIndex === 0 && typeof window.clearAllComments === "function") {
      window.clearAllComments();
    }

    // OBS配信状態の確認（「OBS配信も同時にスタートする」トグルがON、かつ第1件目からの新規スタートの場合のみ実行）
    const obsStreamToggle = document.getElementById("news-obs-auto-stream-toggle");
    const isObsStreamEnabled = obsStreamToggle ? obsStreamToggle.checked : false;

    if (!isMidwayStart && isObsStreamEnabled && typeof window.ensureObsStreamingStarted === "function") {
      if (progressEl) progressEl.textContent = "📡 OBS配信接続を確認中...";
      await window.ensureObsStreamingStarted((msg) => {
        if (progressEl) progressEl.textContent = `📡 ${msg}`;
      });
    } else {
      if (isMidwayStart) {
        console.log("[ニュース番組] 途中レジューム・個別再生のため、OBS WebSocket配信制御はスキップします。");
      } else {
        console.log("[ニュース番組] OBS自動配信連携はOFFのため、OBS配信開始をスキップしてローカルで番組を進行します。");
      }
    }

    // YouTube接続の自動確認（未接続なら保存済みの動画ID/チャンネルへ自動接続して統計・コメントを取得開始）
    if (typeof window.startYoutubeConnection === "function") {
      const isConnected = window.youtubeWs && window.youtubeWs.readyState === WebSocket.OPEN;
      if (!isConnected) {
        const savedYt = localStorage.getItem("savedYoutubeVideoId") || localStorage.getItem("savedYoutubeChannel") || "@drone.akahori";
        if (savedYt) {
          console.log(`[ニュース番組] YouTubeコメント＆統計サーバーへ自動接続します: ${savedYt}`);
          window.startYoutubeConnection(savedYt);
        }
      }
    }

    if (!newsBroadcastState.isRunning) return;

    const config = getNewsConfig();

    preloadedNewsMap.clear();
    if (startIndex < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex], startIndex === 0, false);
    if (startIndex + 1 < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex + 1], false, (sortedNews[startIndex + 1].categoryKey || "") !== (sortedNews[startIndex].categoryKey || ""));

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

      const nextItem = (i + 1 < sortedNews.length) ? sortedNews[i + 1] : null;
      const nextIsCatChanged = nextItem ? ((nextItem.categoryKey || "") !== (item.categoryKey || "")) : false;

      // カテゴリが切り替わった時（2カテゴリ目以降の最初）にシーン切り替えSEを確実に鳴らす
      if (isCategoryChanged && config.useTransition) {
        console.log(`[ニュース番組] カテゴリ切り替え検知: [${item.categoryName || item.categoryKey}] シーン切り替えSEを再生します`);
        await playSE("シーン切り替え1");
        await new Promise(r => setTimeout(r, 600));
      }

      const reader = window.readOneNewsItem || readOneNewsItem;
      const success = await reader(item, config, isCategoryChanged, isFirst, nextItem, nextIsCatChanged);
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
    
    // EDの各文を直接VOICEVOX再生し、最後の1文字が鳴り終わるまで1文ずつ確実に待機
    const edSentences = config.ed.split(/(?<=[。！？\n])/g).map(s => s.trim()).filter(s => s.length > 0);
    for (const edSentence of edSentences) {
      if (!newsBroadcastState.isRunning) break;
      if (typeof window.playVoicevoxDirectAndWait === "function") {
        await window.playVoicevoxDirectAndWait(edSentence, edSentence);
      } else {
        await queueVoicevoxAudio(edSentence, true, edSentence);
        await waitForVoicevoxFinish();
      }
      await new Promise(r => setTimeout(r, 400));
    }
    await new Promise(r => setTimeout(r, 800)); // 全セリフ完了後の息継ぎ余白

    // EDチャイム再生（セリフが完全に全部喋り終わってから初めて鳴らす）
    if (config.useEdChime) {
      await playSE("放送終了チャイム");
      await new Promise(r => setTimeout(r, 4800)); // チャイムがしっかり鳴り響いて静まるまで待機
    }

    // 番組終了（セットリスト完了状態に更新＆レジューム一時状態を完全消去）
    finishNewsSetlist(sortedNews.length);
    newsBroadcastState.isRunning = false;
    try { localStorage.removeItem("newsActiveState"); } catch (e) { }
    if (startBtn) startBtn.style.display = "block";
    if (stopBtn) stopBtn.style.display = "none";
    if (progressEl) progressEl.textContent = `✅ 番組終了（全${sortedNews.length}件を読み終えました）`;
    console.log("[ニュース番組] 全件放送完了！");

    // ニュース終了時自動終了が有効な場合は配信終了プロセスを実行
    const mainEndModeEl = document.getElementById("main-stream-end-mode");
    const isAutoEndNews = (typeof window.isAutoEndAfterNews === "undefined") || window.isAutoEndAfterNews === true || (mainEndModeEl && mainEndModeEl.value === "news_end");
    const endToggle = document.getElementById("stream-end-toggle");
    
    if ((isAutoEndNews || (endToggle && endToggle.checked)) && typeof window.executeStreamEndProcess === "function") {
      console.log("[ニュース番組] 🏁 ニュース全件読み終わりによる配信終了プロセスを開始します");
      window.executeStreamEndProcess();
    } else {
      console.log("[ニュース番組] 自動終了が無効（耐久・手動停止モード）のため、配信を継続します（待機状態）");
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

          const linkUrl = extractLinkFromXmlNode(node);

          return {
            title: titleNode ? titleNode.textContent : "",
            description: stripHtmlTags(descNode ? descNode.textContent : ""),
            link: linkUrl,
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
    results.forEach(items => {
      items.forEach(it => {
        if (it && it.title && !isInvalidNewsVideoArticle(it)) {
          allParsedItems.push(it);
        }
      });
    });

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
    } else if (rangeKey === "6h") {
      const past = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      if (pStartInput) pStartInput.value = formatDatetimeLocal(past);
      if (pEndInput) pEndInput.value = formatDatetimeLocal(now);
      const btn6 = document.getElementById("panel-quick-6h");
      if (btn6) {
        btn6.style.background = "rgba(0, 210, 211, 0.25)";
        btn6.style.borderColor = "#00d2d3";
        btn6.style.color = "#00ffff";
        btn6.style.fontWeight = "bold";
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

    syncPanelInputsFromHidden();
    localStorage.setItem("savedNewsQuickRange", rangeKey);
  };

  // メインパネルの時セレクト初期化＆双方向同期
  const initPanelHourSelects = () => {
    const sHour = document.getElementById("panel-start-hour");
    const eHour = document.getElementById("panel-end-hour");
    if (sHour && sHour.options.length === 0) {
      for (let i = 0; i < 24; i++) {
        const val = String(i).padStart(2, "0");
        sHour.innerHTML += `<option value="${val}">${val}時</option>`;
      }
    }
    if (eHour && eHour.options.length === 0) {
      for (let i = 0; i < 24; i++) {
        const val = String(i).padStart(2, "0");
        eHour.innerHTML += `<option value="${val}">${val}時</option>`;
      }
    }
  };

  const syncPanelInputsFromHidden = () => {
    initPanelHourSelects();
    const startHidden = document.getElementById("news-date-start");
    const endHidden = document.getElementById("news-date-end");
    const sDate = document.getElementById("panel-start-date");
    const sHour = document.getElementById("panel-start-hour");
    const eDate = document.getElementById("panel-end-date");
    const eHour = document.getElementById("panel-end-hour");

    if (startHidden && startHidden.value) {
      const parts = startHidden.value.split("T");
      if (sDate && parts[0]) sDate.value = parts[0];
      if (sHour && parts[1]) sHour.value = parts[1].slice(0, 2);
    }
    if (endHidden && endHidden.value) {
      const parts = endHidden.value.split("T");
      if (eDate && parts[0]) eDate.value = parts[0];
      if (eHour && parts[1]) eHour.value = parts[1].slice(0, 2);
    }
  };

  const syncPanelHiddenFromInputs = () => {
    const startHidden = document.getElementById("news-date-start");
    const endHidden = document.getElementById("news-date-end");
    const sDate = document.getElementById("panel-start-date");
    const sHour = document.getElementById("panel-start-hour");
    const eDate = document.getElementById("panel-end-date");
    const eHour = document.getElementById("panel-end-hour");

    if (startHidden && sDate && sHour) {
      startHidden.value = sDate.value ? `${sDate.value}T${sHour.value || "00"}:00` : "";
    }
    if (endHidden && eDate && eHour) {
      endHidden.value = eDate.value ? `${eDate.value}T${eHour.value || "23"}:59` : "";
    }
  };

  document.getElementById("panel-start-date")?.addEventListener("change", syncPanelHiddenFromInputs);
  document.getElementById("panel-start-hour")?.addEventListener("change", syncPanelHiddenFromInputs);
  document.getElementById("panel-end-date")?.addEventListener("change", syncPanelHiddenFromInputs);
  document.getElementById("panel-end-hour")?.addEventListener("change", syncPanelHiddenFromInputs);

  window.stepPanelDate = function(type, hoursDiff) {
    syncPanelHiddenFromInputs();
    const hidden = document.getElementById(type === "start" ? "news-date-start" : "news-date-end");
    if (!hidden) return;
    let current = hidden.value ? new Date(hidden.value) : new Date();
    if (isNaN(current.getTime())) current = new Date();
    current.setTime(current.getTime() + hoursDiff * 60 * 60 * 1000);
    hidden.value = formatDatetimeLocal(current);
    syncPanelInputsFromHidden();
  };

  window.setPanelNow = function() {
    const endHidden = document.getElementById("news-date-end");
    if (endHidden) {
      endHidden.value = formatDatetimeLocal(new Date());
      syncPanelInputsFromHidden();
    }
  };

  window.adjustNumberInput = function(inputId, diff, minVal = -Infinity, maxVal = Infinity) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const current = parseInt(input.value, 10) || 0;
    const nextVal = Math.min(maxVal, Math.max(minVal, current + diff));
    input.value = nextVal;
    input.dispatchEvent(new Event('change'));
  };

  document.getElementById("panel-quick-6h")?.addEventListener("click", () => applyQuickRange("6h"));
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

  // =========================================================================
  // 🚨 ワンクリック配信中断・リロード復帰システム（ピンポイント感想復帰）
  // =========================================================================
  window.initNewsResumeSystem = function () {
    try {
      const container = document.getElementById("news-resume-container") || document.querySelector(".panel-header-wrapper") || document.body;
      const resumeContainer = document.getElementById("news-resume-container");

      // 1. ピンポイント中断データ（newsActiveState）が存在する場合
      const raw = localStorage.getItem("newsActiveState");
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved && saved.item && (Date.now() - (saved.timestamp || 0) < 60 * 60 * 1000)) {
            const totalS = (saved.scriptData && saved.scriptData.items) ? saved.scriptData.items.length : 1;
            const currentS = (saved.sentenceIndex || 0) + 1;
            const artNum = (saved.articleIndex || 0) + 1;
            const titleShort = saved.item.title.length > 20 ? saved.item.title.substring(0, 20) + "…" : saved.item.title;

            const existing = document.getElementById("news-resume-banner");
            if (existing) existing.remove();

            const banner = document.createElement("div");
            banner.id = "news-resume-banner";
            banner.className = "news-resume-banner";
            banner.innerHTML = `
              <div class="resume-info">
                <div class="resume-header-row">
                  <span class="resume-badge">⚠️ 中断復帰</span>
                  <span class="resume-progress-tag">第${artNum}件 (${currentS}/${totalS}文目)</span>
                </div>
                <div class="resume-text" title="${saved.item.title}">「${titleShort}」</div>
              </div>
              <div class="resume-actions">
                <button id="news-quick-resume-btn" class="resume-btn resume-btn-primary">⚡ 途中から再開</button>
                <button id="news-discard-resume-btn" class="resume-btn resume-btn-secondary">✕ 破棄</button>
              </div>
            `;

            if (resumeContainer) {
              resumeContainer.innerHTML = "";
              resumeContainer.appendChild(banner);
              resumeContainer.style.display = "block";
            } else {
              container.appendChild(banner);
            }

            document.getElementById("news-quick-resume-btn").onclick = async () => {
              if (resumeContainer) resumeContainer.style.display = "none";
              banner.remove();
              if (saved.scriptData && saved.scriptData.items) {
                await window.quickResumeNewsBroadcast(saved);
              } else {
                await window.startNewsBroadcast(saved.articleIndex || 0);
              }
            };

            document.getElementById("news-discard-resume-btn").onclick = () => {
              if (resumeContainer) resumeContainer.style.display = "none";
              banner.remove();
              localStorage.removeItem("newsActiveState");
            };
            return;
          }
        } catch (e) {}
      }

      // 2. ピンポイント中断データがない場合：既読リストから「未読の先頭」を自動判定して開始位置をセット
      const savedNews = window.latestFetchedNews || JSON.parse(localStorage.getItem("latestFetchedNews") || "[]");
      const readTitles = new Set(JSON.parse(localStorage.getItem("newsReadTitles") || "[]"));
      if (savedNews && savedNews.length > 0 && readTitles.size > 0) {
        const CATEGORY_ORDER = ["cat_top", "cat_society", "cat_world", "cat_business", "cat_politics", "cat_entertainment", "cat_sports", "cat_tech", "cat_science", "cat_local"];
        const sorted = [...savedNews].sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a.categoryKey || "cat_top");
          const bi = CATEGORY_ORDER.indexOf(b.categoryKey || "cat_top");
          const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          if (catDiff !== 0) return catDiff;
          return new Date(a.pubDate || 0).getTime() - new Date(b.pubDate || 0).getTime();
        });

        const firstUnreadIdx = sorted.findIndex(n => !readTitles.has(n.title));
        if (firstUnreadIdx !== -1 && firstUnreadIdx < sorted.length) {
          const startIdxInput = document.getElementById("news-broadcast-start-index");
          if (startIdxInput) {
            startIdxInput.value = firstUnreadIdx + 1;
          }
          console.log(`[ニュースレジューム] 🎯 未読の先頭記事(#${firstUnreadIdx + 1}: ${sorted[firstUnreadIdx].title.substring(0, 15)}...) を開始位置に自動セットしました`);

          // 復帰バナーを表示
          const existing = document.getElementById("news-resume-banner");
          if (existing) existing.remove();

          const banner = document.createElement("div");
          banner.id = "news-resume-banner";
          banner.className = "news-resume-banner";
          const titleShort = sorted[firstUnreadIdx].title.length > 20 ? sorted[firstUnreadIdx].title.substring(0, 20) + "…" : sorted[firstUnreadIdx].title;
          banner.innerHTML = `
            <div class="resume-info">
              <div class="resume-header-row">
                <span class="resume-badge" style="background:#00d2d3; color:#0f121d;">🔁 続きから再開</span>
                <span class="resume-progress-tag">第${firstUnreadIdx + 1}件 / 全${sorted.length}件</span>
              </div>
              <div class="resume-text" title="${sorted[firstUnreadIdx].title}">「${titleShort}」</div>
            </div>
            <div class="resume-actions">
              <button id="news-quick-resume-btn" class="resume-btn resume-btn-primary">▶ 続きから開始</button>
            </div>
          `;

          if (resumeContainer) {
            resumeContainer.innerHTML = "";
            resumeContainer.appendChild(banner);
            resumeContainer.style.display = "block";
          }

          document.getElementById("news-quick-resume-btn").onclick = async () => {
            if (resumeContainer) resumeContainer.style.display = "none";
            banner.remove();
            await window.startNewsBroadcast(firstUnreadIdx);
          };
        }
      }
    } catch (e) {
      console.warn("[ニュース復帰システム] 初期化エラー:", e);
    }
  };

  window.quickResumeNewsBroadcast = async function (saved) {
    if (!saved || !saved.item || !saved.scriptData) return;
    console.log(`[ニュース復帰] ⚡ 第${saved.articleIndex + 1}件の第${(saved.sentenceIndex || 0) + 1}文目から即座に配信を再開します...`);

    // 1. AudioContextアンミュート
    if (window.voicevoxAudioContext && window.voicevoxAudioContext.state === "suspended") {
      await window.voicevoxAudioContext.resume().catch(() => { });
    }

    // 2. YouTube WebSocket再接続
    if (typeof window.startYoutubeConnection === "function") {
      const savedYt = localStorage.getItem("savedYoutubeId") || "@drone.akahori";
      window.startYoutubeConnection(savedYt);
    }

    // 3. ニュース状態復元
    const allItems = saved.scriptData.items || [];
    const startIndex = saved.sentenceIndex || 0;

    newsBroadcastState = {
      isRunning: true,
      currentIndex: (saved.articleIndex || 0) + 1,
      totalCount: saved.totalArticles || 298,
      lastCategory: saved.item.categoryKey || ""
    };
    window.newsBroadcastState = newsBroadcastState;

    const startBtn = document.getElementById("news-broadcast-start-btn");
    const stopBtn = document.getElementById("news-broadcast-stop-btn");
    const progressEl = document.getElementById("news-broadcast-progress");
    if (startBtn) startBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "block";
    if (progressEl) progressEl.textContent = `📰 進行中: ${newsBroadcastState.currentIndex} / ${newsBroadcastState.totalCount}件`;

    const newsTitleEl = document.getElementById("news-article-title");
    const newsDescEl = document.getElementById("news-article-desc");
    const newsBoardEl = document.getElementById("news-board");
    const catEl = document.getElementById("news-board-category");
    const progressBadge = document.getElementById("news-board-progress");

    if (newsTitleEl) newsTitleEl.textContent = saved.item.title;
    if (newsDescEl) newsDescEl.textContent = stripHtmlTags(saved.item.description || "");
    if (newsBoardEl) newsBoardEl.classList.add("active");
    if (catEl) catEl.textContent = saved.item.categoryName || "";
    if (progressBadge) {
      progressBadge.style.display = "inline-block";
      progressBadge.textContent = `${newsBroadcastState.currentIndex} / ${newsBroadcastState.totalCount}`;
    }

    updateNewsSetlistProgress(saved.item.categoryKey || "cat_top", newsBroadcastState.currentIndex, newsBroadcastState.totalCount);

    // 4. 残りの文（感想の途中〜）を順番に再生
    for (let sIdx = startIndex; sIdx < allItems.length; sIdx++) {
      if (!newsBroadcastState.isRunning) return;
      const it = allItems[sIdx];
      try {
        localStorage.setItem("newsActiveState", JSON.stringify({
          ...saved,
          sentenceIndex: sIdx,
          timestamp: Date.now()
        }));
      } catch (e) { }
      await queueVoicevoxAudio(it.display, true, it.speech);
    }
    await waitForVoicevoxFinish();

    // 5. 既読にして次の記事の通常ループへ突入
    readNewsTitles.add(saved.item.title);
    if (window.readNewsTitles) window.readNewsTitles.add(saved.item.title);
    try { localStorage.setItem("newsReadTitles", JSON.stringify(Array.from(readNewsTitles))); } catch (e) { }

    if (newsBroadcastState.isRunning) {
      startNewsBroadcast((saved.articleIndex || 0) + 1, null, false);
    }
  };

  // ページ読み込み時に中断状態をチェック
  setTimeout(() => {
    if (typeof window.initNewsResumeSystem === "function") {
      window.initNewsResumeSystem();
    }
  }, 1200);

  // 🔗 ニュースリストの全件（298件）に対して記事URLを一括事前取得・自動補完する強力エンジン
  window.enrichCurrentNewsWithLinks = async function () {
    try {
      if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) {
        try {
          const saved = localStorage.getItem("latestFetchedNews");
          if (saved) window.latestFetchedNews = JSON.parse(saved);
        } catch (e) { }
      }
      if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) return;

      // すでに全件URL取得済みなら何もせず静かに終了
      const needsEnrichment = window.latestFetchedNews.some(item => !item.link);
      if (!needsEnrichment) return;

      // 1. サーバーのURLキャッシュ（article_urls.json）から全URLマップを取得
      let serverUrlMap = {};
      try {
        const res = await fetch("/api/news/get_all_urls");
        if (res.ok) {
          const data = await res.json();
          if (data && data.urls) serverUrlMap = data.urls;
        }
      } catch (e) { }

      let enrichedCount = 0;
      const missingTitles = [];

      window.latestFetchedNews.forEach(item => {
        if (!item.link) {
          if (serverUrlMap[item.title]) {
            item.link = serverUrlMap[item.title];
            enrichedCount++;
          } else {
            const tPrefix = (item.title || "").replace(/[【】『』「」\s　・、。！？!?]+/g, "").slice(0, 10);
            if (tPrefix) {
              for (const [k, u] of Object.entries(serverUrlMap)) {
                if (k.includes(tPrefix) || tPrefix.includes(k.slice(0, 8))) {
                  item.link = u;
                  enrichedCount++;
                  break;
                }
              }
            }
          }
        }
        if (!item.link) {
          missingTitles.push(item.title);
        }
      });

      if (enrichedCount > 0) {
        console.log(`[ニュースURL補完] 🔗 キャッシュから記事URLを反映 (${enrichedCount}件反映 / 未取得: ${missingTitles.length}件)`);
      }

      // 2. それでも未取得のタイトルがあれば、バックエンドの一括解決APIに投げて全件取得！
      if (missingTitles.length > 0) {
        try {
          const batchRes = await fetch("/api/news/batch_resolve_urls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titles: missingTitles.slice(0, 80) })
          });
          if (batchRes.ok) {
            const batchData = await batchRes.json();
            if (batchData && batchData.urls) {
              let batchCount = 0;
              window.latestFetchedNews.forEach(item => {
                if (!item.link && batchData.urls[item.title]) {
                  item.link = batchData.urls[item.title];
                  batchCount++;
                }
              });
              if (batchCount > 0) {
                console.log(`[ニュースURL補完] 🌐 未取得URLの一括逆引き取得完了 (新たに${batchCount}件のURLを紐付け)`);
              }
              if (typeof window.updateNewsListPopup === "function") {
                window.updateNewsListPopup();
              }
            }
          }
        } catch (batchErr) { }
      }
    } catch (e) { }
  };

  window.enrichCurrentNewsWithLinks();
});