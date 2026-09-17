// ==============================================================================
// 🌐 news-fetcher.js
// RSSニュースの取得・XMLパース・重複排除・URL逆引き補完モジュール
// (本番ネイティブアプリ完全一致版)
// ==============================================================================

window.NEWS_CATEGORIES = window.NEWS_CATEGORIES || {
  "cat_top": ["https://news.yahoo.co.jp/rss/topics/top-picks.xml", "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_society": ["https://news.yahoo.co.jp/rss/topics/domestic.xml", "https://news.google.com/news/rss/headlines/section/topic/NATION?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_world": ["https://news.yahoo.co.jp/rss/topics/world.xml", "https://news.google.com/news/rss/headlines/section/topic/WORLD?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_business": ["https://news.yahoo.co.jp/rss/topics/business.xml", "https://news.google.com/news/rss/headlines/section/topic/BUSINESS?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_politics": ["https://news.google.com/news/rss/headlines/section/topic/POLITICS?hl=ja&gl=JP&ceid=JP:ja", "https://news.yahoo.co.jp/rss/topics/domestic.xml"],
  "cat_entertainment": ["https://news.yahoo.co.jp/rss/topics/entertainment.xml", "https://news.google.com/news/rss/headlines/section/topic/ENTERTAINMENT?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_sports": ["https://news.yahoo.co.jp/rss/topics/sports.xml", "https://news.google.com/news/rss/headlines/section/topic/SPORTS?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_tech": ["https://news.yahoo.co.jp/rss/topics/it.xml", "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml", "https://news.google.com/news/rss/headlines/section/topic/TECHNOLOGY?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_science": ["https://news.yahoo.co.jp/rss/topics/science.xml", "https://news.google.com/news/rss/headlines/section/topic/SCIENCE?hl=ja&gl=JP&ceid=JP:ja"],
  "cat_local": ["https://news.yahoo.co.jp/rss/topics/local.xml"]
};

window.CATEGORY_NAMES = window.CATEGORY_NAMES || {
  "cat_all": "全て（全カテゴリを一括取得）",
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

function formatNewsPubDate(rawDateStr) {
  if (!rawDateStr) return "";
  try {
    const d = new Date(rawDateStr);
    if (isNaN(d.getTime())) return rawDateStr.trim();
    const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return jstFormatter.format(d).replace(/\//g, '-');
  } catch (e) {
    return rawDateStr.trim();
  }
}

function extractLinkFromXmlNode(node) {
  let linkUrl = "";
  const linkNodes = Array.from(node.getElementsByTagName("link"));
  for (const lNode of linkNodes) {
    if (lNode.textContent && lNode.textContent.trim().startsWith("http")) {
      linkUrl = lNode.textContent.trim();
      break;
    }
    const href = lNode.getAttribute("href");
    if (href && href.startsWith("http")) {
      linkUrl = href.trim();
      break;
    }
  }
  if (!linkUrl) {
    const guidNode = node.querySelector("guid");
    if (guidNode && guidNode.textContent && guidNode.textContent.trim().startsWith("http")) {
      linkUrl = guidNode.textContent.trim();
    }
  }
  return linkUrl;
}

window.stripHtmlTags = window.stripHtmlTags || function(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || "").trim();
};

// タイトルの正規化（装飾タグやメディア名の除去）
function normalizeNewsTitle(title) {
  if (!title) return "";
  let t = title.trim();
  t = t.replace(/^(\[[^\]]+\]|【[^】]+】|〈[^〉]+〉|（[^）]+）|\([^\)]+\))\s*/g, "");
  t = t.replace(/\s*([（\(][^）\)]*(?:新聞|通信|テレビ|TV|ニュース|News|時事|共同|ロイター|BBC|CNN|産経|朝日|読売|毎日|日経|TBS|NHK|日テレ|テレ朝|フジ)[^）\)]*[）\)]|[-–—|]\s*[^|–—-]+)$/gi, "");
  t = t.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  t = t.replace(/[\s\u3000]+/g, " ").trim();
  return t;
}

// 2-gram類似度 (Dice係数)
function calculateTitleSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1.0;
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
      if (normTitle === existingNorm || calculateTitleSimilarity(normTitle, existingNorm) >= 0.65) {
        duplicateIndex = i;
        break;
      }
    }
    if (duplicateIndex === -1) {
      uniqueList.push(item);
    } else {
      dupCount++;
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

async function fetchNewsWithOptions(categoryKey = "cat_all", maxPerCategory = Infinity, startDate = null, endDate = null) {
  let fetchTargets = [];
  let sourceName = "全て";

  if (categoryKey === "cat_all") {
    sourceName = "全て（全カテゴリを一括取得）";
    for (const catKey of Object.keys(window.NEWS_CATEGORIES)) {
      window.NEWS_CATEGORIES[catKey].forEach(u => {
        fetchTargets.push({ url: u, categoryKey: catKey, categoryName: window.CATEGORY_NAMES[catKey] || "総合" });
      });
    }
  } else if (window.NEWS_CATEGORIES[categoryKey]) {
    sourceName = window.CATEGORY_NAMES[categoryKey] || categoryKey;
    window.NEWS_CATEGORIES[categoryKey].forEach(u => {
      fetchTargets.push({ url: u, categoryKey: categoryKey, categoryName: window.CATEGORY_NAMES[categoryKey] || "総合" });
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
        const sourceNode = node.querySelector("source");
        const rawSource = sourceNode ? sourceNode.textContent.trim() : "";

        let publisherName = rawSource || "その他";
        if (target.url.includes('yahoo.co.jp')) {
          publisherName = rawSource || 'Yahoo!ニュース';
        } else if (target.url.includes('google.com')) {
          publisherName = rawSource || 'Googleニュース';
        } else if (target.url.includes('nhk.or.jp')) {
          publisherName = 'NHK';
        } else if (target.url.includes('itmedia.co.jp')) {
          publisherName = 'ITmedia';
        }

        const linkUrl = extractLinkFromXmlNode(node);

        const rawPubDateStr = pubDateNode ? pubDateNode.textContent.trim() : "";
        const formattedPubDate = formatNewsPubDate(rawPubDateStr);

        return {
          title: titleNode ? titleNode.textContent : "",
          description: stripHtmlTags(descNode ? descNode.textContent : ""),
          link: linkUrl,
          pubDate: formattedPubDate,
          rawPubDate: rawPubDateStr,
          categoryName: target.categoryName,
          categoryKey: target.categoryKey,
          source: rawSource,
          publisher: publisherName
        };
      }).filter(item => {
        if (!item.title) return false;
        // 🛡️ 本文がSPA等で取得できないNHK等のドメインは記事一覧から完全除外
        if (item.link && (item.link.includes('nhk.or.jp') || item.link.includes('news.web.nhk'))) return false;
        // 🛡️ Google News RSS経由等で紛れ込むNHK記事を100%除外（source, publisher, titleすべて検査）
        if (item.source && /NHK/i.test(item.source)) return false;
        if (item.publisher && /NHK/i.test(item.publisher)) return false;
        if (item.title && /(?:[\s\-–—|｜]|^)NHK(?:ニュース|NEWS|NEWS\s*WEB)?/i.test(item.title)) return false;
        if (typeof window.isInvalidNewsVideoArticle === "function" && window.isInvalidNewsVideoArticle(item.title, item.description)) return false;
        return true;
      });
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);
  let allParsedItems = [];
  results.forEach(items => { allParsedItems = allParsedItems.concat(items); });

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
    // rawPubDate (RFC2822 / ISO8601) を最優先して正確なミリ秒判定、フォールバックで pubDate
    const raw = item.rawPubDate || item.pubDate;
    if (!raw) return true;
    let itemDate = new Date(raw).getTime();
    if (isNaN(itemDate) && item.pubDate) {
      // ハイフン区切り＋スペースの日時を ISO8601 形式に補正して再試行
      const isoLike = item.pubDate.replace(" ", "T");
      itemDate = new Date(isoLike).getTime();
    }
    if (isNaN(itemDate)) {
      console.warn(`[ニュース日時判定] 日付解析不能のため除外: 「${item.title}」 (${raw})`);
      return false; // 不正日付・判定不能は安全に除外
    }
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

  const extractTopicKeywords = (t) => {
    const norm = normalizeNewsTitle(t);
    const matches = norm.match(/([\u4E00-\u9FFF]{2,}|[\u30A1-\u30F6ー]{3,}|[a-zA-Z0-9]{3,})/g) || [];
    return new Set(matches);
  };

  const isTopicDuplicate = (itemTitle, existingTitles) => {
    const norm = normalizeNewsTitle(itemTitle);
    const keywords = extractTopicKeywords(norm);
    for (const ex of existingTitles) {
      const exNorm = normalizeNewsTitle(ex);
      if (calculateTitleSimilarity(norm, exNorm) >= 0.45) return true;
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

  // 🛡️ 記事一覧追加前のスクレイピング事前検証（本文が取得できない毎日新聞等の遮断サイト・有料記事を徹底排除）
  const candidatePool = [];
  CATEGORY_ORDER.forEach(catKey => {
    if (categorized[catKey]) {
      // 各カテゴリから十分な候補を検証対象として抽出
      candidatePool.push(...categorized[catKey].slice(0, Math.max(8, maxPerCategory * 3)));
    }
  });
  Object.keys(categorized).forEach(k => {
    if (!CATEGORY_ORDER.includes(k)) {
      candidatePool.push(...categorized[k].slice(0, Math.max(8, maxPerCategory * 3)));
    }
  });

  let scrapeableTitlesSet = new Set();
  try {
    console.log(`[ニュース取得] 🔍 候補記事 ${candidatePool.length} 件の本文スクレイピング可能性を事前検証中...`);
    const checkItems = candidatePool.map(it => ({ title: it.title, url: it.link || it.url || "" }));
    const res = await fetch("/api/news/filter_scrapeable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: checkItems })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.scrapeable_titles)) {
        scrapeableTitlesSet = new Set(data.scrapeable_titles);
        console.log(`[ニュース取得] ✅ スクレイピング検証完了: ${scrapeableTitlesSet.size}/${candidatePool.length} 件が本文取得可能と確認されました`);
        // 🎯 ミラーURL（Yahoo!ニュース等）が解決された記事のリンクを自動更新して救済
        if (data.results) {
          candidatePool.forEach(it => {
            const r = data.results[it.title];
            if (r && r.scrapeable && r.resolved_url) {
              if (it.link !== r.resolved_url) {
                console.log(`[ミラー救済適用] 🎯 「${it.title}」のURLをミラー版に更新: ${r.resolved_url}`);
                it.link = r.resolved_url;
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn("[ニュース取得] ⚠️ スクレイピング事前検証APIエラー (フォールバック):", err);
  }

  const isItemScrapeable = (item) => {
    // 検証結果がある場合は、ミラー探索を含めたスクレイピング成否判定に従う
    if (scrapeableTitlesSet.size > 0) {
      return scrapeableTitlesSet.has(item.title);
    }
    // API未取得時のフォールバック: 既知の遮断サイトを除外
    const u = (item.link || item.url || "").toLowerCase();
    if (u.includes("mainichi.jp") || u.includes("nikkei.com") || u.includes("asahi.com/articles")) {
      return false;
    }
    return true;
  };

  CATEGORY_ORDER.forEach(catKey => {
    if (categorized[catKey]) {
      let count = 0;
      for (const item of categorized[catKey]) {
        if (count >= maxPerCategory) break;
        // 本文スクレイピング不可の記事はスキップし、次の記事へ自動繰り上げ
        if (!isItemScrapeable(item)) {
          console.log(`[ニュース選定] 🚫 本文取得不可のため除外 (繰り上げ): 「${item.title}」`);
          continue;
        }
        if (!isTopicDuplicate(item.title, selectedTitles)) {
          finalItems.push(item);
          selectedTitles.push(item.title);
          count++;
        }
      }
      // もし上限に達しなかった場合でもスクレイピング可能な記事のみを探して補完
      if (count === 0 && categorized[catKey].length > 0) {
        const fallbackItem = categorized[catKey].find(it => isItemScrapeable(it) && !selectedTitles.includes(it.title));
        if (fallbackItem) {
          finalItems.push(fallbackItem);
          selectedTitles.push(fallbackItem.title);
        }
      }
    }
  });

  Object.keys(categorized).forEach(k => {
    if (!CATEGORY_ORDER.includes(k)) {
      for (const item of categorized[k]) {
        if (!isItemScrapeable(item)) continue;
        if (!isTopicDuplicate(item.title, selectedTitles)) {
          finalItems.push(item);
          selectedTitles.push(item.title);
        }
      }
    }
  });

  if (typeof window.sortNewsItemsByBroadcastOrder === "function") {
    finalItems = window.sortNewsItemsByBroadcastOrder(finalItems);
  }
  window.latestFetchedNews = finalItems;
  try {
    localStorage.setItem("latestFetchedNews", JSON.stringify(finalItems));
  } catch (e) { }

  console.log(`[ニュース取得] 取得完了: 合計 ${finalItems.length} 件のニュースを保持（放送順ソート済み）`);
  enrichCurrentNewsWithLinks();

  // 🚀 配信準備中からの常時直列先読みワーカーを自動キック
  if (typeof window.startBackgroundNewsPrefetcher === "function") {
    window.startBackgroundNewsPrefetcher();
  }
  return finalItems;
}

async function enrichCurrentNewsWithLinks() {
  if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) return;
  const missingTitles = window.latestFetchedNews
    .filter(it => !it.link || it.link.includes("news.google.com/rss/articles"))
    .map(it => it.title);

  if (missingTitles.length === 0) {
    if (typeof window.startBackgroundNewsPrefetcher === "function") {
      window.startBackgroundNewsPrefetcher();
    }
    return;
  }

  try {
    const res = await fetch("/api/get_article_urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: missingTitles })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.urls) {
        let updatedCount = 0;
        window.latestFetchedNews.forEach(item => {
          if (data.urls[item.title]) {
            item.link = data.urls[item.title];
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          console.log(`[ニュースURL補完] 🌐 ${updatedCount}件の元記事URLをバックグラウンド解決`);
        }
      }
    }
  } catch (e) { } finally {
    if (typeof window.startBackgroundNewsPrefetcher === "function") {
      window.startBackgroundNewsPrefetcher();
    }
  }
}

window.fetchNewsWithOptions = fetchNewsWithOptions;
window.smartDeduplicateNewsItems = smartDeduplicateNewsItems;
window.extractLinkFromXmlNode = extractLinkFromXmlNode;
window.enrichCurrentNewsWithLinks = enrichCurrentNewsWithLinks;
