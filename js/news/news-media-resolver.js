// ==============================================================================
// 📰 news-media-resolver.js
// 出典メディア名の多段階解決・逆引き・見出しタイトルのスマート整形モジュール
// ==============================================================================

// 🚫 動画視聴前提、写真一覧、株価データ羅列、情報量不足記事を除外する判定
const INVALID_NEWS_TITLE_PATTERNS = [
  /【動画】|\[動画\]|\(動画\)/i, /【ライブ】/i, /【生中継】/i, /【ノーカット】/i,
  /【ハイライト】/i, /【まとめ】/i, /【会見】/i, /【独自】.*動画/i,
  /Pickup\s*NEWS/i, /ピックアップ\s*ニュース/i, /動画で見る/i,
  /動画ニュース/i, /ニュース動画/i, /LIVE配信/i, /ニュース速報LIVE/i,
  /今日のトピックス/i, /今週のまとめ/i, /主要ニュース一覧/i,
  /フォトギャラリー/i, /写真特集/i, /写真ニュース/i, /写真ギャラリー/i,
  /【写真まとめ】/i, /【写真多数】/i, /【写真】/i, /【画像】/i, /【フォト】/i,
  /画像ギャラリー/i, /写真で見る/i, /グラビア/i,
  // 📉 株価・市況・ランキングデータ羅列記事（文章情報量ゼロ・極小）
  /【成行注文】/i, /買い越しランキング/i, /売り越しランキング/i,
  /【ストップ高／ストップ安】/i, /ストップ高/i, /ストップ安/i,
  /値上がり率ランキング/i, /値下がり率ランキング/i, /出来高上位/i,
  /信用取引残高/i, /寄り付き/i, /大引け/i, /市況概況/i,
  /^(ニュース|Google\s*ニュース|Yahoo!\s*ニュース|トップニュース|主要ニュース|トピックス)$/i
];

const INVALID_NEWS_DESC_PATTERNS = [
  /動画をご覧ください/i, /動画で詳しく/i, /動画はこちら/i,
  /映像をご覧ください/i, /映像はこちら/i, /YouTubeで見る/i,
  /動画配信中/i, /詳しくは動画で/i, /動画ニュース/i,
  /まとめて.*分の動画でお伝えします/i, /データ放送では動画をご覧いただけません/i,
  /動画をご視聴ください/i, /写真はこちら/i, /詳細はリンク先/i, /画像はこちら/i
];

function isInvalidNewsVideoArticle(arg1, arg2) {
  let title = typeof arg1 === "object" && arg1 !== null ? (arg1.title || "") : (typeof arg1 === "string" ? arg1 : "");
  let desc = typeof arg1 === "object" && arg1 !== null ? (arg1.description || "") : (typeof arg2 === "string" ? arg2 : "");
  const t = (title || "").trim();
  const d = (desc || "").trim();
  if (!t) return true;

  for (const pat of INVALID_NEWS_TITLE_PATTERNS) {
    if (pat.test(t)) return true;
  }
  for (const pat of INVALID_NEWS_DESC_PATTERNS) {
    if (pat.test(d)) return true;
  }

  // 🛡️ 概要文（description）が極端に短く（15文字未満）、かつ本文情報が皆無の短報を除外
  if (d.length > 0 && d.length < 15 && /^(?:速報|短報|更新|【速報】)/.test(t)) {
    return true;
  }

  return false;
}

function stripHtmlTags(html) {
  if (!html) return "";
  const clean = html.replace(/<[^>]*>/g, "");
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(clean, "text/html");
      return doc.body.textContent || "";
    } catch (e) {
      return clean;
    }
  }
  return clean;
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
  "av.watch.impress.co.jp": "AV Watch",
  "watch.impress.co.jp": "Impress Watch",
  "4gamer.net": "4Gamer",
  "famitsu.com": "ファミ通",
  "dengekionline.com": "電撃オンライン",
  "modelpress.jp": "モデルプレス",
  "mdpr.jp": "モデルプレス",
  "fujinkoron.jp": "婦人公論.jp",
  "kahoku.news": "河北新報",
  "kyoto-np.co.jp": "京都新聞",
  "kobe-np.co.jp": "神戸新聞",
  "sportsbull.jp": "スポーツブル",
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
  const url = item ? (item.link || item.url || "") : "";

  // 1. RSSの <source> タグ（Googleニュース・Yahoo等の公式配信元名）
  if (item && item.source && typeof item.source === "string" && item.source.trim()) {
    let s = item.source.replace(/[\s\-–—]+(?:Google.*)$/i, "").trim();
    // 🛡️ URLがYahoo!ニュースなのにsourceがNHK等の場合は「Yahoo!ニュース」へ整合
    if (url && url.includes("news.yahoo.co.jp") && (/NHK/i.test(s) || !s)) {
      s = "Yahoo!ニュース";
      item.source = "Yahoo!ニュース";
    }
    if (s && !/^(ニュース|Google|Google\s*ニュース|主要ニュース|トピックス)$/i.test(s)) return s;
  }

  // 2. タイトル内の括弧 (例: (デイリースポーツ) (毎日新聞) (読売新聞) 等)
  const m = t.match(/[（\(]([^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR\s*TIMES|PRTIMES|タイムス|NHK|ロイター|AFP|CNN|BBC|Yahoo!|ヤフー|Impress|Watch|ナタリー)[^）\)]*)[）\)]/i);
  if (m) {
    let src = m[1].replace(/[\s\-–—]+(?:Yahoo!.*|Google.*)$/i, "").trim();
    if (url && url.includes("news.yahoo.co.jp") && /NHK/i.test(src)) {
      src = "Yahoo!ニュース";
    }
    if (src && !/^(ニュース|Google|Google\s*ニュース|主要ニュース|トピックス)$/i.test(src)) return src;
  }

  // 3. タイトル末尾のサフィックス (例: - 読売新聞, - 朝日新聞デジタル, - Lmaga.jp, - crypto-times.jp 等)
  // ※ 単なるスペース区切りの地名（例: '男児が海に流され行方不明 神奈川'）をメディア名と誤認しないよう、必ず明確な区切り記号（- や |）を義務付け
  const m2 = t.match(/(?:[\s　]*[|｜\-–—]+[\s　]*)\s*([A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff.・][A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s.・\-]*)$/);
  if (m2) {
    let src = m2[1].replace(/[\s\-–—]+(?:Google.*)$/i, "").trim();
    if (url && url.includes("news.yahoo.co.jp") && /NHK/i.test(src)) {
      src = "Yahoo!ニュース";
    }
    const NON_MEDIA_WORDS = new Set([
      '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
      '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
      '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜',
      '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫',
      '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口',
      '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎',
      '熊本', '大分', '宮崎', '鹿児島', '沖縄',
      '全国', '地域', '地方', '速報', '話題', '写真', '動画', '解説',
      'ニュース', 'Google', 'Googleニュース', '主要ニュース', 'トピックス'
    ]);
    const srcBase = src.replace(/[都道府県市区町村]$/, "");
    if (src && src.length >= 2 && src.length <= 25 && !NON_MEDIA_WORDS.has(src) && !NON_MEDIA_WORDS.has(srcBase)) {
      return src;
    }
  }

  // 4. URLのドメイン逆引き（nhk.or.jp, mainichi.jp, yomiuri.co.jp 等）
  if (item) {
    if (url) {
      if (url.includes("news.yahoo.co.jp")) return "Yahoo!ニュース";
      for (const [dom, name] of Object.entries(DOMAIN_MEDIA_MAP)) {
        if (url.includes(dom)) return name;
      }
    }
    if (item.publisher && typeof item.publisher === "string" && item.publisher.trim()) {
      let p = item.publisher.replace(/[\s\-–—]+(?:Google.*)$/i, "").trim();
      if (p === "Google") p = "Googleニュース";
      if (url && url.includes("news.yahoo.co.jp") && /NHK/i.test(p)) p = "Yahoo!ニュース";
      if (p && !/^(ニュース|主要ニュース|トピックス)$/i.test(p)) return p;
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
  if (mediaSrc) {
    const esc = mediaSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`[\\s|｜\\-–—]+${esc}$`, 'i'), '');
  }
  t = t.replace(/[（\(][^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR|タイムス|NHK|Yahoo!|ヤフー|Bloomberg|Reuters|bloomberg|reuters)[^）\)]*[）\)]/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s]+のプレスリリース|PR\s*TIMES|PRTIMES|プレスリリース).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+(?:Google\s*ニュース|Google\s*News|Google|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|Yahoo!|ヤフー|NHK\s*(?:ニュース|NEWS\s*WEB|NEWS)?|NHK|ITmedia[A-Za-z0-9\s]*|共同通信|時事通信|読売新聞|朝日新聞|毎日新聞|産経新聞|日経新聞|日本経済新聞|TBS\s*NEWS\s*DIG|FNNプライムオンライン|テレ朝news|日テレNEWS[A-Za-z0-9\s]*|ORICON\s*NEWS|モデルプレス|デイリースポーツ|日刊スポーツ|スポニチ|zakzak|zakⅡ|ねとらぼ|AUTOMATON|IGN\s*Japan|Game\s*Watch|4Gamer|bloomberg\.com|bloomberg|ブルームバーグ|reuters\.com|reuters|ロイター).*$/gi, "");
  // ドメイン名（.co.jp, .jp, .com, .net 等）の末尾サフィックス除去（スペル読み防止）
  t = t.replace(/[\s|｜\-–—]+[a-zA-Z0-9\-_.]+\.(?:co\.jp|ne\.jp|or\.jp|ac\.jp|go\.jp|jp|com|net|org|info|biz).*$/gi, "");
  t = t.replace(/[\s|｜\-–—]+$/g, "").trim();
  
  if (/^(ニュース|Google\s*ニュース|Google\s*News|Google|Yahoo!\s*ニュース|Yahoo!|ヤフー|トップニュース|主要ニュース|トピックス)$/i.test(t.trim())) {
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

// グローバル互換
if (typeof window !== "undefined") {
  window.isInvalidNewsVideoArticle = isInvalidNewsVideoArticle;
  window.stripHtmlTags = stripHtmlTags;
  window.DOMAIN_MEDIA_MAP = DOMAIN_MEDIA_MAP;
  window.extractMediaSource = extractMediaSource;
  window.cleanTitleForSpeech = cleanTitleForSpeech;
}

