// ==============================================================================
// 🌐 news-fetcher.js
// RSSニュースの取得・XMLパース・重複排除・URL逆引き補完モジュール
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

function smartDeduplicateNewsItems(items) {
  const seenTitles = new Set();
  const result = [];
  for (const item of items) {
    if (!item.title) continue;
    // タイトルの正規化比較（空白・記号除去）
    const norm = item.title.replace(/[\s　★【】「」『』・\(\)（）\-\|｜]+/g, "").slice(0, 18);
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm);
      result.push(item);
    }
  }
  return result;
}

async function fetchNewsWithOptions(categoryKey = "cat_all", maxPerCategory = Infinity, startDate = null, endDate = null) {
  let fetchTargets = [];
  let sourceName = "全て（全カテゴリを一括取得）";

  if (categoryKey === "cat_all") {
    for (const catKey of Object.keys(NEWS_CATEGORIES)) {
      NEWS_CATEGORIES[catKey].forEach(u => {
        fetchTargets.push({ url: u, categoryKey: catKey, categoryName: CATEGORY_NAMES[catKey] || "総合" });
      });
    }
  } else if (NEWS_CATEGORIES[categoryKey]) {
    sourceName = CATEGORY_NAMES[categoryKey] || categoryKey;
    NEWS_CATEGORIES[categoryKey].forEach(u => {
      fetchTargets.push({ url: u, categoryKey: categoryKey, categoryName: CATEGORY_NAMES[categoryKey] || "総合" });
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
        if (isInvalidNewsVideoArticle(item.title, item.description)) return false;
        return true;
      });
    } catch (e) {
      console.warn(`[ニュース取得] ${target.url} の取得に失敗:`, e.message);
      return [];
    }
  });

  const allCategoryResults = await Promise.all(fetchPromises);
  let allParsedItems = allCategoryResults.flat();

  // 日付フィルター
  if (startDate || endDate) {
    const sTime = startDate ? new Date(startDate).getTime() : -Infinity;
    const eTime = endDate ? new Date(endDate).getTime() : Infinity;
    allParsedItems = allParsedItems.filter(item => {
      if (!item.pubDate) return true;
      const t = new Date(item.pubDate).getTime();
      return isNaN(t) || (t >= sTime && t <= eTime);
    });
  }

  // カテゴリごとの件数制限 & 重複排除
  const finalItems = [];
  const catCountMap = {};

  for (const item of allParsedItems) {
    const cKey = item.categoryKey || "other";
    catCountMap[cKey] = catCountMap[cKey] || 0;
    if (catCountMap[cKey] < maxPerCategory) {
      finalItems.push(item);
      catCountMap[cKey]++;
    }
  }

  const uniqueNews = smartDeduplicateNewsItems(finalItems);
  window.latestFetchedNews = uniqueNews;

  console.log(`[ニュース取得] 取得完了: 合計 ${uniqueNews.length} 件のニュースを保持`);
  enrichCurrentNewsWithLinks();
  return uniqueNews;
}

async function enrichCurrentNewsWithLinks() {
  if (!window.latestFetchedNews || window.latestFetchedNews.length === 0) return;
  const missingTitles = window.latestFetchedNews
    .filter(it => !it.link || it.link.includes("news.google.com/rss/articles"))
    .map(it => it.title);

  if (missingTitles.length === 0) return;

  try {
    const res = await fetch("/api/news/batch_resolve_urls", {
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
  } catch (e) {
    // サイレントフォールバック
  }
}

// グローバル互換
if (typeof window !== "undefined") {
  window.NEWS_CATEGORIES = NEWS_CATEGORIES;
  window.CATEGORY_NAMES = CATEGORY_NAMES;
  window.extractLinkFromXmlNode = extractLinkFromXmlNode;
  window.smartDeduplicateNewsItems = smartDeduplicateNewsItems;
  window.fetchNewsWithOptions = fetchNewsWithOptions;
  window.enrichCurrentNewsWithLinks = enrichCurrentNewsWithLinks;
}
