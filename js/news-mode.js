console.log("[news-mode.js] 🌟 スクリプトファイルが正常に実行開始されました (v20.0)");
// 安全な遅延バインド
window.startNewsBroadcast = async function(startIndex = 0, items = null, isFromNewsList = false) {
  if (typeof window._executeNewsBroadcast === "function") {
    return await window._executeNewsBroadcast(startIndex, items, isFromNewsList);
  }
};

// ニュース番組進行ステート (グローバル共有)
window.newsBroadcastState = window.newsBroadcastState || {
  isRunning: false,
  currentIndex: 0,
  totalCount: 0,
  lastCategory: "",
  isFromNewsList: false
};


// =====================================================================
// 専任モジュール(js/news/)へのブリッジ・委譲ヘルパー関数
// =====================================================================
function playSE(name, vol = null) {
  if (window.newsAudioPlayer && typeof window.newsAudioPlayer.playSE === "function") {
    return window.newsAudioPlayer.playSE(name, vol);
  }
  return Promise.resolve();
}

function initNewsSetlist(sortedNews) {
  if (window.newsUIBoard && typeof window.newsUIBoard.initNewsSetlist === "function") {
    window.newsUIBoard.initNewsSetlist(sortedNews);
  }
}

function showNewsBoard(item, currentIdx, totalCount) {
  if (window.newsUIBoard && typeof window.newsUIBoard.showNewsBoard === "function") {
    window.newsUIBoard.showNewsBoard(item, currentIdx, totalCount);
  }
}

function hideNewsBoard() {
  if (window.newsUIBoard && typeof window.newsUIBoard.hideNewsBoard === "function") {
    window.newsUIBoard.hideNewsBoard();
  }
}

function hideNewsSetlist() {
  if (window.newsUIBoard && typeof window.newsUIBoard.hideNewsSetlist === "function") {
    window.newsUIBoard.hideNewsSetlist();
  }
}


// 🚫 動画視聴前提のダイジェスト記事（Pickup NEWS等）や無意味なサイトヘッダーを除外する判定 (ユニバーサル互換)
function isInvalidNewsVideoArticle(arg1, arg2) {
  let title = "";
  let desc = "";
  if (typeof arg1 === "object" && arg1 !== null) {
    title = (arg1.title || "").trim();
    desc = (arg1.description || "").trim();
  } else {
    title = (typeof arg1 === "string" ? arg1 : "").trim();
    desc = (typeof arg2 === "string" ? arg2 : "").trim();
  }
  if (!title) return true;

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
window.isInvalidNewsVideoArticle = isInvalidNewsVideoArticle;
window.readNewsTitles = new Set(JSON.parse(localStorage.getItem("newsReadTitles") || "[]")); // 既読ニュースのタイトルを保持するセット
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
// openNewsListPopup, updateNewsListPopup, clearNewsReadFlags は js/news/news-list-popup.js に完全移管済み
function getNewsConfig() {
  if (window.newsConfigManager && typeof window.newsConfigManager.getNewsConfig === "function") {
    return window.newsConfigManager.getNewsConfig();
  }
  const title = document.getElementById("news-program-title")?.value || "今日の最新ニュース";
  const op = document.getElementById("news-opening-text")?.value || "本日の最新ニュースをお届けいたします。";
  const ed = document.getElementById("news-ending-text")?.value || "以上、本日のニュースでした。";
  return { title, op, ed, useOpChime: true, useTransition: true, useEdChime: true };
}
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

  async function _executeNewsBroadcast(startIndex = 0, items = null, isFromNewsList = false) {
    console.log(`[ニュース番組] 🚀 [STEP 1] startNewsBroadcast 呼び出し検知 (startIndex: ${startIndex}, isFromNewsList: ${isFromNewsList})`);
    try {
      if (newsBroadcastState.isRunning) {
        console.log(`[ニュース番組] 🚀 [STEP 1.1] 既存番組を安全に切り替えます (再開位置: #${startIndex + 1})`);
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
        console.log("[ニュース番組] 🚀 [STEP 2.0] ニュース未取得のため自動取得をトリガーします...");
        if (progressEl) { progressEl.style.display = "block"; progressEl.textContent = "⬇️ ニュースを取得中..."; }
        const fetchOnlyBtn = document.getElementById("news-fetch-only-btn");
        if (fetchOnlyBtn) fetchOnlyBtn.click();
        await new Promise(r => setTimeout(r, 3000));
      }

      const allNews = window.latestFetchedNews || [];
      console.log(`[ニュース番組] 🚀 [STEP 2.1] 保持ニュース記事の確認: 合計 ${allNews.length} 件`);
      if (allNews.length === 0) {
        console.warn("[ニュース番組] ⚠️ [STEP 2.2] ニュース記事が0件のため番組を開始できません");
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
        return dateA - dateB;
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
      console.log("[ニュース番組] 🚀 [STEP 2.3] セットリストボード初期化描画");
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

      // OBS配信状態の確認
      const obsStreamToggle = document.getElementById("news-obs-auto-stream-toggle");
      const isObsStreamEnabled = obsStreamToggle ? obsStreamToggle.checked : false;
      const isDevSafari = (window.location.port === "8444");

      console.log(`[ニュース番組] 🚀 [STEP 3] OBS連携チェック (isObsStreamEnabled: ${isObsStreamEnabled}, isDevSafari: ${isDevSafari})`);
      if (!isMidwayStart && isObsStreamEnabled && !isDevSafari && typeof window.ensureObsStreamingStarted === "function") {
        if (progressEl) progressEl.textContent = "📡 OBS配信接続を確認中...";
        await window.ensureObsStreamingStarted((msg) => {
          if (progressEl) progressEl.textContent = `📡 ${msg}`;
        });
      }

      // YouTube接続の自動確認
      if (typeof window.startYoutubeConnection === "function") {
        const isConnected = window.youtubeWs && window.youtubeWs.readyState === WebSocket.OPEN;
        if (!isConnected) {
          const savedYt = localStorage.getItem("savedYoutubeVideoId") || localStorage.getItem("savedYoutubeChannel") || "@drone.akahori";
          if (savedYt) {
            console.log(`[ニュース番組] YouTubeコメント＆統計サーバーへ接続: ${savedYt}`);
            window.startYoutubeConnection(savedYt);
          }
        }
      }

      if (!newsBroadcastState.isRunning) {
        console.warn("[ニュース番組] ⚠️ 番組フラグが停止状態のため中断します");
        return;
      }

      const config = getNewsConfig();
      console.log("[ニュース番組] 📰 ==========================================");
      console.log("[ニュース番組] 🚀 【ニュース番組 放送開始サマリー】");
      console.log(`[ニュース番組] 📌 読み上げ対象: 全 ${sortedNews.length} 件 (開始位置: #${startIndex + 1})`);
      console.log(`[ニュース番組] 🎬 OP挨拶: "${config.op}" (チャイム: ${config.useOpChime ? '鳴らす' : 'なし'})`);
      console.log(`[ニュース番組] 🏁 ED挨拶: "${config.ed}" (チャイム: ${config.useEdChime ? '鳴らす' : 'なし'})`);
      console.log(`[ニュース番組] 🔄 カテゴリ切り替えSE: ${config.useTransition ? '有効' : '無効'}`);
      console.log("[ニュース番組] 📰 ==========================================");

      console.log(`[ニュース番組] 🚀 [STEP 4] 設定取得完了: タイトル="${config.title}", OP="${config.op}", チャイム=${config.useOpChime}`);

      preloadedNewsMap.clear();
      if (startIndex < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex], startIndex === 0, false);
      if (startIndex + 1 < sortedNews.length) triggerNewsPrefetch(sortedNews[startIndex + 1], false, (sortedNews[startIndex + 1].categoryKey || "") !== (sortedNews[startIndex].categoryKey || ""));

      // OP挨拶（途中再開でない場合のみ再生）
      if (startIndex === 0) {
        if (progressEl) progressEl.textContent = "🎬 オープニング再生中...";
        console.log("[ニュース番組] 🚀 [STEP 5] オープニングチャイム再生中...");
        if (config.useOpChime) { 
          await playSE("放送開始チャイム"); 
          await new Promise(r => setTimeout(r, 600)); 
        }
        console.log(`[ニュース番組] 🚀 [STEP 6] オープニング音声キュー投入: "${config.op}"`);
        await queueVoicevoxAudio(config.op, true, config.op);
        console.log("[ニュース番組] 🚀 [STEP 7] オープニング音声終了待機中 (waitForVoicevoxFinish)...");
        await waitForVoicevoxFinish();
        console.log("[ニュース番組] 🚀 [STEP 8] オープニング挨拶完了！記事ループへ入ります");
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

        if (isCategoryChanged && config.useTransition) {
          console.log(`[ニュース番組] 🚀 [STEP 9] カテゴリ切り替え検知: [${item.categoryName || item.categoryKey}] シーン切り替えSE再生`);
          await playSE("シーン切り替え1");
          await new Promise(r => setTimeout(r, 600));
        }

        console.log(`[ニュース番組] 🚀 [STEP 10] 記事 #${i + 1}/${sortedNews.length} 「${item.title}」の読み上げを開始します`);
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
        return;
      }

      // ED挨拶
      console.log("[ニュース番組] 🚀 [STEP 11] 全記事読み上げ完了！エンディング挨拶へ移行します");
      if (progressEl) progressEl.textContent = "🏁 エンディング再生中...";
      if (config.useTransition) {
        await playSE("ロールの閉め");
        await new Promise(r => setTimeout(r, 500));
      }
      await queueVoicevoxAudio(config.ed, true, config.ed);
      await waitForVoicevoxFinish();
      if (config.useEdChime) {
        await playSE("放送終了チャイム");
        await new Promise(r => setTimeout(r, 600));
      }

      console.log("[ニュース番組] 🎉 番組がすべて正常に完了しました！");
      stopNewsBroadcast();

    } catch (broadcastErr) {
      console.error("[ニュース番組] ❌ startNewsBroadcast 内で致命的例外が発生しました:", broadcastErr);
    }
  }

  window._executeNewsBroadcast = _executeNewsBroadcast;
  window.startNewsBroadcast = _executeNewsBroadcast;
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
    console.log("[ニュース番組] ⏹ 番組を停止しました。");
  }

  // =====================================================================
  // ニュース番組 ボタンイベント初期化
  // =====================================================================
  function initNewsModeButtons() {
    const startBtn = document.getElementById("news-broadcast-start-btn");
    const stopBtn = document.getElementById("news-broadcast-stop-btn");
    if (startBtn) {
      startBtn.onclick = () => {
        const startIdxInput = document.getElementById("news-broadcast-start-index");
        const idx = startIdxInput ? (parseInt(startIdxInput.value, 10) || 1) - 1 : 0;
        console.log(`[ニュース番組] 🚀 スタートボタンがクリックされました (開始位置: #${idx + 1})`);
        startNewsBroadcast(idx);
      };
      console.log("[ニュース番組] ✅ news-broadcast-start-btn にクリックイベントをバインド完了");
    }
    if (stopBtn) {
      stopBtn.onclick = () => {
        console.log("[ニュース番組] ⏹ ストップボタンがクリックされました");
        stopNewsBroadcast();
      };
    }
  }

  const registerNewsUI = window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn));
  registerNewsUI("news-mode", () => {
    initNewsModeButtons();
  });
  if (document.getElementById("news-broadcast-start-btn")) {
    initNewsModeButtons();
  }

  window.stopNewsBroadcast = stopNewsBroadcast;
  window.newsBroadcastState = newsBroadcastState;

  

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

  // =====================================================================
  // ウィザードや子ウィンドウからのポート別開始シグナル監視 (Storage Event)
  // =====================================================================
  window.addEventListener("storage", (e) => {
    const port = window.location.port || "8443";
    if (e.key === `startNewsRequest_${port}` && e.newValue) {
      console.log(`[ニュース番組] 📡 Storageシグナル受信 (startNewsRequest_${port}) -> 番組を開始します`);
      if (typeof window.startNewsBroadcast === "function") {
        window.startNewsBroadcast(0);
      }
    }
  });


  // ペンディングされた開始要求を即座に消費
  if (window._pendingNewsBroadcast) {
    const p = window._pendingNewsBroadcast;
    window._pendingNewsBroadcast = null;
    console.log(`[ニュース番組] 🚀 ロード待機キューから番組を即時自動開始します (startIndex: ${p.startIndex})`);
    _executeNewsBroadcast(p.startIndex, p.items, p.isFromNewsList);
  }
