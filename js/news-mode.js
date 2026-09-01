
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

window.newsListPopup = null;

// 📰 記事一覧を別ウィンドウ（ポップアップ）で開く共通関数（配信中も何度でも確実に起動）
window.openNewsListPopup = function () {
  if (window.latestFetchedNews && window.latestFetchedNews.length > 0) {
    try {
      localStorage.setItem("latestFetchedNews", JSON.stringify(window.latestFetchedNews));
    } catch (e) { }
  }

  try {
    // 既存ポップアップが本当に生きているか検証
    if (window.newsListPopup) {
      try {
        if (!window.newsListPopup.closed && window.newsListPopup.document) {
          if (typeof window.newsListPopup.renderNewsList === "function") {
            window.newsListPopup.renderNewsList();
          }
          window.newsListPopup.focus();
          return;
        }
      } catch (e) {
        // クロスオリジンまたは破棄済みの場合は参照クリアして再生成へ進む
        window.newsListPopup = null;
      }
    }

    // 画面中央付近に配置
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    const popupWidth = 820;
    const popupHeight = 860;
    const left = ((width / 2) - (popupWidth / 2)) + dualScreenLeft;
    const top = ((height / 2) - (popupHeight / 2)) + dualScreenTop;

    const url = `/news_list.html?t=${Date.now()}`;
    const windowFeatures = `scrollbars=yes,width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes,status=no,toolbar=no,menubar=no,location=no`;

    window.newsListPopup = window.open(url, "_blank", windowFeatures);
    if (window.newsListPopup) {
      try { window.newsListPopup.focus(); } catch (e) {}
    } else {
      // フォールバック
      window.newsListPopup = window.open(url, "_blank");
    }
  } catch (err) {
    console.error("[記事一覧] ポップアップ起動エラー:", err);
    try { window.open("/news_list.html", "_blank"); } catch (e) {}
    window.newsListPopup = null;
  }
};

// ニュース見出しのスマート整形（PR TIMESやメディア名サフィックス、不要なサイト名の除去）
function cleanTitleForSpeech(title) {
  if (!title) return "";
  let t = stripHtmlTags(String(title)).trim();
  
  // 1. 末尾の（メディア名）や（デイリースポーツ）などの括弧付き配信元＋サフィックスを除去
  t = t.replace(/[（\(][^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR|タイムス)[^）\)]*[）\)]/gi, "");
  
  // 2. 末尾の - Yahoo!ニュース や PR TIMES 等のメディア名サフィックスを完全除去
  t = t.replace(/[\s|｜\-–—]+(?:[A-Za-z0-9一-鿿゠-ヿ\s]+のプレスリリース|PR\s*TIMES|PRTIMES|プレスリリース).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|Yahoo!|ヤフー|NHK\s*NEWS\s*WEB|ITmedia[A-Za-z0-9\s]*|共同通信|時事通信|読売新聞|朝日新聞|毎日新聞|産経新聞|日経新聞|日本経済新聞|TBS\s*NEWS\s*DIG|FNNプライムオンライン|テレ朝news|日テレNEWS[A-Za-z0-9\s]*|ORICON\s*NEWS|モデルプレス|デイリースポーツ|日刊スポーツ|スポニチ|zakzak|zakⅡ|ねとらぼ|AUTOMATON|IGN\s*Japan|Game\s*Watch|4Gamer.*)$/gi, "");
  
  // 3. 末尾に残ったハイフンや記号の掃除
  t = t.replace(/[\s|｜\-–—]+$/g, "").trim();
  
  // 4. 単なるサイト名・ヘッダー名のみの場合は空文字にしてスキップ
  if (/^(ニュース|Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!|ヤフー|トップニュース|主要ニュース|トピックス)$/i.test(t.trim())) {
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

    // 📰 ② 元記事タイトルをそのまま発話（タイトル内の感嘆符や記号で細切れに分割させず、1文として直接明瞭に発話）
        if (item.title) {
          const headlineText = cleanTitleForSpeech(item.title);
          if (headlineText && headlineText.length >= 3 && !/^(ニュース|主要ニュース|トピックス)$/.test(headlineText)) {
            console.log(`[原稿] [見出し] "${headlineText}"`);
            await playVoicevoxDirectAndWait(headlineText, headlineText);
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

  // 📰 記事一覧ボタンの明示的イベントリスナー登録
  const newsListBtn = document.getElementById("header-news-list-btn");
  if (newsListBtn) {
    newsListBtn.onclick = (e) => {
      e.preventDefault();
      window.openNewsListPopup();
    };
  }

  // ⌨️ キーボードショートカット: 'N' キー または 'Alt+N' で記事一覧を開く
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) return;

    if (e.code === "KeyN" || e.key === "n" || e.key === "N" || (e.altKey && (e.code === "KeyN" || e.key === "n" || e.key === "N"))) {
      if (e.isComposing) return;
      e.preventDefault();
      window.openNewsListPopup();
    }
  });
});