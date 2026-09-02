// ==============================================================================
// 📰 news-media-resolver.js
// 出典メディア名の多段階解決・逆引き・見出しタイトルのスマート整形モジュール
// ==============================================================================

// 🚫 動画視聴前提のダイジェスト記事（Pickup NEWS等）や無意味なサイトヘッダーを除外する判定
const VIDEO_TITLE_PATTERNS = [
  /【動画】/i, /【ライブ】/i, /【生中継】/i, /【ノーカット】/i,
  /【ハイライト】/i, /【まとめ】/i, /【会見】/i, /【独自】.*動画/i,
  /Pickup\s*NEWS/i, /ピックアップ\s*ニュース/i, /動画で見る/i,
  /動画ニュース/i, /ニュース動画/i, /LIVE配信/i, /ニュース速報LIVE/i,
  /今日のトピックス/i, /今週のまとめ/i, /主要ニュース一覧/i,
  /フォトギャラリー/i, /写真特集/i, /写真ニュース/i
];

const VIDEO_DESC_PATTERNS = [
  /動画をご覧ください/i, /動画で詳しく/i, /動画はこちら/i,
  /映像をご覧ください/i, /映像はこちら/i, /YouTubeで見る/i,
  /動画配信中/i, /詳しくは動画で/i, /動画ニュース/i
];

function isInvalidNewsVideoArticle(title, desc) {
  const t = title || "";
  const d = desc || "";
  for (const pat of VIDEO_TITLE_PATTERNS) {
    if (pat.test(t)) return true;
  }
  for (const pat of VIDEO_DESC_PATTERNS) {
    if (pat.test(d)) return true;
  }
  return false;
}

function stripHtmlTags(html) {
  if (!html) return "";
  const clean = html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(clean, "text/html");
  return doc.body.textContent || "";
}

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
  
  // 1. タイトル末尾のメディア名サフィックスを徹底除去
  t = t.replace(/[（\(][^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR|タイムス|Yahoo!|ヤフー|Bloomberg|Reuters|bloomberg|reuters)[^）\)]*[）\)]/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s]+のプレスリリース|PR\s*TIMES|PRTIMES|プレスリリース).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|Yahoo!|ヤフー|NHK\s*NEWS\s*WEB|ITmedia[A-Za-z0-9\s]*|共同通信|時事通信|読売新聞|朝日新聞|毎日新聞|産経新聞|日経新聞|日本経済新聞|TBS\s*NEWS\s*DIG|FNNプライムオンライン|テレ朝news|日テレNEWS[A-Za-z0-9\s]*|ORICON\s*NEWS|モデルプレス|デイリースポーツ|日刊スポーツ|スポニチ|zakzak|zakⅡ|ねとらぼ|AUTOMATON|IGN\s*Japan|Game\s*Watch|4Gamer|bloomberg\.com|bloomberg|ブルームバーグ|reuters\.com|reuters|ロイター).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+$/g, "").trim();
  
  if (/^(ニュース|Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!|ヤフー|トップニュース|主要ニュース|トピックス)$/i.test(t.trim())) {
    return "";
  }
  
  // 2. 出典メディア名の付与
  if (mediaSrc) {
    const cleanTail = t.replace(/[\s|｜\-–—　]+$/, "");
    if (cleanTail.endsWith(mediaSrc) || (typeof itemOrTitle === "object" && itemOrTitle.source && cleanTail.endsWith(itemOrTitle.source))) {
      return `${cleanTail}より`;
    }
    return `${t}（${mediaSrc}より）`;
  }
  return t;
}

function getNewsTransitionPhrase(index, total) {
  if (index === 0) {
    const openings = [
      "それでは、最初のニュースです。",
      "まずは、こちらのニュースからお伝えします。",
      "最初の話題はこちらですにゃ。",
      "では、注目の最新ニュースから見ていきましょう。"
    ];
    return openings[Math.floor(Math.random() * openings.length)];
  } else if (index === total - 1) {
    const closings = [
      "続いて、本日最後のニュースです。",
      "最後にお伝えするニュースはこちらです。",
      "締めくくりの話題はこちらですにゃ。"
    ];
    return closings[Math.floor(Math.random() * closings.length)];
  } else {
    const transitions = [
      "続いてのニュースです。",
      "次の話題に移りますにゃ。",
      "続いてはこちらのニュースです。",
      "さて、次のニュースをお伝えします。"
    ];
    return transitions[Math.floor(Math.random() * transitions.length)];
  }
}

// グローバル互換
if (typeof window !== "undefined") {
  window.isInvalidNewsVideoArticle = isInvalidNewsVideoArticle;
  window.stripHtmlTags = stripHtmlTags;
  window.DOMAIN_MEDIA_MAP = DOMAIN_MEDIA_MAP;
  window.extractMediaSource = extractMediaSource;
  window.cleanTitleForSpeech = cleanTitleForSpeech;
  window.getNewsTransitionPhrase = getNewsTransitionPhrase;
}
