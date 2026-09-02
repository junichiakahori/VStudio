// ==============================================================================
// 🌐 news-fetcher.js
// RSSニュースの取得・XMLパース・高精度スマート重複排除・URL逆引き補完モジュール
// (本番ネイティブアプリ実績 100% 同期完全版)
// ==============================================================================

window.NEWS_CATEGORIES = window.NEWS_CATEGORIES || {
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

function normalizeNewsTitle(title) {
  if (!title) return "";
  let clean = title.replace(/\s*-\s*[^-]+$/, "");
  clean = clean.replace(/（[^）]+）|\([^\)]+\)|【[^】]+】|「[^」]+」|『[^』]+』|［[^］]+］|\[[^\]]+\]/g, "");
  clean = clean.replace(/[\s　]+/g, " ").trim();
  return clean.toLowerCase();
}

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

function stripHtmlTags(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || "").trim();
}

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
        const realSource = sourceNode ? sourceNode.textContent.trim() : "";
        let publisherName = "その他";
        if (target.url.includes('yahoo.co.jp')) publisherName = 'Yahoo!';
        else if (target.url.includes('google.com')) publisherName = 'Google';
        else if (target.url.includes('nhk.or.jp')) publisherName = 'NHK';
        else if (target.url.includes('itmedia.co.jp')) publisherName = 'ITmedia';

        const linkUrl = extractLinkFromXmlNode(node);

        return {
          title: titleNode ? titleNode.textContent.trim() : "",
          description: stripHtmlTags(descNode ? descNode.textContent : ""),
          source: realSource,
          link: linkUrl,
          pubDate: pubDateNode ? pubDateNode.textContent : "",
          categoryName: target.categoryName,
          categoryKey: target.categoryKey,
          publisher: publisherName
        };
      }).filter(item => {
        if (!item.title) return false;
        if (typeof window.isInvalidNewsVideoArticle === "function" && window.isInvalidNewsVideoArticle(item.title, item.description)) return false;
        return true;
      });
    } catch (e) {
      console.warn(`[ニュース取得] ${target.url} の取得に失敗:`, e.message);
      return [];
    }
  });

  const allCategoryResults = await Promise.all(fetchPromises);
  const allParsedItems = allCategoryResults.flat();
  const uniqueItems = smartDeduplicateNewsItems(allParsedItems);

  // 日時フィルタリング（本番ネイティブアプリ完全一致ロジック）
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

  CATEGORY_ORDER.forEach(catKey => {
    if (categorized[catKey]) {
      let count = 0;
      for (const item of categorized[catKey]) {
        if (count >= maxPerCategory) break;
        if (!isTopicDuplicate(item.title, selectedTitles)) {
          finalItems.push(item);
          selectedTitles.push(item.title);
          count++;
        }
      }
      if (count === 0 && categorized[catKey].length > 0) {
        finalItems.push(categorized[catKey][0]);
        selectedTitles.push(categorized[catKey][0].title);
      }
    }
  });

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

  console.log(`[ニュース取得] 取得完了: 合計 ${finalItems.length} 件のニュースを保持`);
  enrichCurrentNewsWithLinks();
  return finalItems;
}

async function enrichCurrentNewsWithLinks() {
  if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) return;
  const missingTitles = window.latestFetchedNews
    .filter(it => !it.link || it.link.includes("news.google.com/rss/articles"))
    .map(it => it.title);

  if (missingTitles.length === 0) return;

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
  } catch (e) { }
}

window.fetchNewsWithOptions = fetchNewsWithOptions;
window.smartDeduplicateNewsItems = smartDeduplicateNewsItems;
window.extractLinkFromXmlNode = extractLinkFromXmlNode;
window.enrichCurrentNewsWithLinks = enrichCurrentNewsWithLinks;
