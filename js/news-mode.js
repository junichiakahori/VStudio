
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
        window.newsListPopup = null;
      }
    }

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
      window.newsListPopup = window.open(url, "_blank");
    }
  } catch (err) {
    console.error("[記事一覧] ポップアップ起動エラー:", err);
    try { window.open("/news_list.html", "_blank"); } catch (e) {}
    window.newsListPopup = null;
  }
};

// ニュース見出しのスマート整形（メディア名サフィックスや無意味なサイト名の除去）
// 🌐 記事URLのドメインからメディア名（出典）を特定する逆引き辞書
const DOMAIN_MEDIA_MAP = {
    "bloomberg.co.jp": "ブルームバーグ",
  "bloomberg.com": "ブルームバーグ",
  "news.yahoo.co.jp": "Yahoo!ニュース",
  "yahoo.co.jp": "Yahoo!ニュース",
  "nhk.or.jp": "NHK",
  "mainichi.jp": "毎日新聞",
  "yomiuri.co.jp": "読売新聞",
  "asahi.com": "朝日新聞",
  "nikkei.com": "日本経済新聞",
  "sankei.com": "産経新聞",
  "kyodonews.net": "共同通信",
  "nordot.app": "共同通信",
  "jiji.com": "時事通信",
  "prtimes.jp": "PR TIMES",
  "itmedia.co.jp": "ITmedia",
  "oricon.co.jp": "ORICON NEWS",
  "daily.co.jp": "デイリースポーツ",
  "nikkansports.com": "日刊スポーツ",
  "sponichi.co.jp": "スポニチ",
  "sanspo.com": "サンスポ",
  "chunichi.co.jp": "中日新聞",
  "tokyo-np.co.jp": "東京新聞",
  "bunshun.jp": "文春オンライン",
  "dailyshincho.jp": "デイリー新潮",
  "toyokeizai.net": "東洋経済",
  "diamond.jp": "ダイヤモンド・オンライン",
  "reuters.com": "ロイター",
  "afpbb.com": "AFP",
  "cnn.co.jp": "CNN",
  "bbc.com": "BBC",
  "automaton-media.com": "AUTOMATON",
  "jp.ign.com": "IGN Japan",
  "ign.com": "IGN",
  "game.watch.impress.co.jp": "GAME Watch",
  "watch.impress.co.jp": "Impress Watch",
  "4gamer.net": "4Gamer",
  "famitsu.com": "ファミ通",
  "dengekionline.com": "電撃オンライン",
  "modelpress.jp": "モデルプレス",
  "natalie.mu": "ナタリー",
  "cinematoday.jp": "シネマトゥデイ",
  "huffingtonpost.jp": "ハフポスト",
  "buzzfeed.com": "BuzzFeed",
  "businessinsider.jp": "Business Insider",
  "gizmodo.jp": "ギズモード",
  "wired.jp": "WIRED",
  "cnet.com": "CNET"
};

function extractMediaSource(itemOrTitle) {
  let title = "";
  let item = null;
  if (typeof itemOrTitle === "object" && itemOrTitle !== null) {
    item = itemOrTitle;
    title = String(item.title || "").trim();
  } else {
    title = String(itemOrTitle || "").trim();
  }
  
  let t = stripHtmlTags(title).trim();

  // 1. RSSの <source> タグ（Googleニュース・Yahoo等の公式配信元名）
  if (item && item.source && typeof item.source === "string" && item.source.trim()) {
    const s = item.source.replace(/[\s\-–—]+(?:Google.*)$/i, "").trim();
    if (s && !/^(ニュース|Google\s*ニュース|主要ニュース|トピックス)$/i.test(s)) return s;
  }

  // 2. タイトル内の括弧 (例: (デイリースポーツ) (毎日新聞) (読売新聞) 等)
  const m = t.match(/[（\(]([^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR\s*TIMES|PRTIMES|タイムス|NHK|ロイター|AFP|CNN|BBC|Yahoo!|ヤフー|Impress|Watch|ナタリー)[^）\)]*)[）\)]/i);
  if (m) {
    let src = m[1].replace(/[\s\-–—]+(?:Yahoo!.*|Google.*)$/i, "").trim();
    if (src && !/^(ニュース|Google\s*ニュース|主要ニュース|トピックス)$/i.test(src)) return src;
  }

  // 3. タイトル末尾のサフィックス (例: - 読売新聞, - 朝日新聞デジタル, - NHK NEWS WEB 等)
  const m2 = t.match(/[\s|｜\-–—]+([A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s]+(?:のプレスリリース|PR\s*TIMES|PRTIMES|新聞[A-Za-z0-9\s]*|通信|日報|新報|NEWS[A-Za-z0-9\s]*|WEB|DIG|テレビ|デイリースポーツ|日刊スポーツ|スポニチ|zakzak|zakⅡ|ねとらぼ|AUTOMATON|IGN[A-Za-z0-9\s]*|Game\s*Watch|4Gamer|モデルプレス|文春オンライン|デイリー新潮|東洋経済オンライン|ダイヤモンド・オンライン|Yahoo!ニュース|Yahoo!|ヤフー|NHK[A-Za-z0-9\s]*|ロイター|AFP|ナタリー|シネマトゥデイ|ファミ通))[^\-–—|｜]*$/i);
  if (m2) {
    let src = m2[1].replace(/[\s\-–—]+(?:Google.*)$/i, "").trim();
    if (src && !/^(ニュース|Google\s*ニュース|主要ニュース|トピックス)$/i.test(src)) return src;
  }

  // 4. URLのドメイン逆引き（nhk.or.jp, mainichi.jp, yomiuri.co.jp 等）
  if (item) {
    const url = item.link || item.url || "";
    if (url) {
      for (const [dom, name] of Object.entries(DOMAIN_MEDIA_MAP)) {
        if (url.includes(dom)) return name;
      }
    }
    if (item.publisher && typeof item.publisher === "string" && item.publisher.trim()) {
      const p = item.publisher.replace(/[\s\-–—]+(?:Google.*)$/i, "").trim();
      if (p && !/^(ニュース|Google\s*ニュース|主要ニュース|トピックス)$/i.test(p)) return p;
    }
  }

  return "";
}

function cleanTitleForSpeech(itemOrTitle) {
  let title = typeof itemOrTitle === "object" && itemOrTitle !== null ? itemOrTitle.title : itemOrTitle;
  if (!title) return "";
  let t = stripHtmlTags(String(title)).trim();
  const mediaSrc = extractMediaSource(itemOrTitle);
  
  // 1. タイトル末尾のメディア名サフィックス（ドメイン名、英語名、日本語名）を徹底除去
  t = t.replace(/[（\(][^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR|タイムス|Yahoo!|ヤフー|Bloomberg|Reuters|bloomberg|reuters)[^）\)]*[）\)]/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s]+のプレスリリース|PR\s*TIMES|PRTIMES|プレスリリース).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|Yahoo!|ヤフー|NHK\s*NEWS\s*WEB|ITmedia[A-Za-z0-9\s]*|共同通信|時事通信|読売新聞|朝日新聞|毎日新聞|産経新聞|日経新聞|日本経済新聞|TBS\s*NEWS\s*DIG|FNNプライムオンライン|テレ朝news|日テレNEWS[A-Za-z0-9\s]*|ORICON\s*NEWS|モデルプレス|デイリースポーツ|日刊スポーツ|スポニチ|zakzak|zakⅡ|ねとらぼ|AUTOMATON|IGN\s*Japan|Game\s*Watch|4Gamer|bloomberg\.com|bloomberg|ブルームバーグ|reuters\.com|reuters|ロイター).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+$/g, "").trim();
  
  if (/^(ニュース|Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!|ヤフー|トップニュース|主要ニュース|トピックス)$/i.test(t.trim())) {
    return "";
  }
  
  // 2. 出典メディア名の付与（二重重複の完全防止）
  if (mediaSrc) {
    // タイトル末尾に既にメディア名またはドメイン名が含まれている場合は「より」のみを付与
    const cleanTail = t.replace(/[\s|｜\-–—　]+$/, "");
    if (cleanTail.endsWith(mediaSrc) || (typeof itemOrTitle === "object" && itemOrTitle.source && cleanTail.endsWith(itemOrTitle.source))) {
      return `${cleanTail}より`;
    }
    return `${t}（${mediaSrc}より）`;
  }
  return t;
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

// 旧 playNextContinuousNews は startNewsBroadcast に統合・委譲済み
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

    // 効果音再生は js/news/news-audio-player.js へ分離移管済み
function playSE(name) { return window.newsAudioPlayer ? window.newsAudioPlayer.playSE(name) : Promise.resolve(); }

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

        // 📰 ② 元記事タイトルをそのまま発話（見出しは文分割させず、字幕と音声で出典も明瞭に発話）
        if (item.title) {
          const headlineText = cleanTitleForSpeech(item);
          if (headlineText && headlineText.length >= 3 && !/^(ニュース|主要ニュース|トピックス)$/.test(headlineText)) {
            console.log(`[原稿] [見出し] "${headlineText}"`);
            const speakHeadline = headlineText.replace(/[（\(]([^）\)]*より)[）\)]/g, "、$1");
            await queueVoicevoxAudio(headlineText, true, speakHeadline, false, true);
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
      console.log("[ニュース番組] 🎬 オープニング挨拶を開始します...");
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

      console.log(`[ニュース番組] 📰 記事 #${i + 1}/${sortedNews.length} 「${item.title}」の読み上げを開始します`);
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
// fetchNewsWithOptions は js/news/news-fetcher.js に完全委譲済み
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