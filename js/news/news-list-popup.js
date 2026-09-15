// =====================================================================
// news-list-popup.js: 別窓ニュース一覧・既読クリア・個別再生ポップアップ
// =====================================================================

(function() {
  window.newsListWindow = null;

  window.openNewsListPopup = function () {
    console.log("[ニュース一覧] 📰 記事一覧ポップアップを開きます");
    try {
      // 🖥️ Local API サーバー経由で macOS の Accessibility (AXRaise) をキックして OS レベルで最前面化
      const apiPort = (window.location && window.location.port === "8444") ? "8002" : "8001";
      fetch(`http://127.0.0.1:${apiPort}/api/window/focus?type=news_list`).catch(() => {});

      // ネイティブアプリ（macOS Dedicated App）へ最前面化を通知
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeHost) {
        try {
          window.webkit.messageHandlers.nativeHost.postMessage({ action: "focusWindow", type: "news_list" });
        } catch (e) { }
      }

      if (window.newsListWindow) {
        try {
          if (!window.newsListWindow.closed) {
            // ブラウザ側でも既存ターゲット名で呼び出して前面化を促進
            const existing = window.open("", "VStudioNewsListWindow");
            if (existing) {
              existing.focus();
            }
            window.newsListWindow.focus();
            if (typeof window.newsListWindow.renderNewsList === "function") {
              window.newsListWindow.renderNewsList();
            } else {
              window.newsListWindow.location.reload();
            }
            return;
          }
        } catch (e) {
          window.newsListWindow = null;
        }
      }

      const width = 850;
      const height = 650;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);
      const url = `/news_list.html?t=${Date.now()}`;

      window.newsListWindow = window.open(
        url,
        "VStudioNewsListWindow",
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
      );

      if (!window.newsListWindow) {
        window.newsListWindow = window.open(url, "VStudioNewsListWindow");
      }
    } catch (err) {
      console.error("[ニュース一覧] Failed to open popup:", err);
      window.newsListWindow = null;
    }
  };

  // ── ニュース原稿キャッシュビューア（専用ポップアップ） ──
  window.newsCacheWindow = null;
  window.openNewsCachePopup = function () {
    console.log("[ニュースキャッシュ] 🗄️ キャッシュビューアポップアップを開きます");
    try {
      if (window.newsCacheWindow && !window.newsCacheWindow.closed) {
        window.newsCacheWindow.focus();
        if (typeof window.newsCacheWindow.loadAvailableDates === "function") {
          window.newsCacheWindow.loadAvailableDates();
        }
        return;
      }

      const width = 960;
      const height = 750;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);
      const url = `/news_cache_viewer.html?t=${Date.now()}`;

      window.newsCacheWindow = window.open(
        url,
        "VStudioNewsCacheWindow",
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
      );

      if (!window.newsCacheWindow) {
        window.newsCacheWindow = window.open(url, "VStudioNewsCacheWindow");
      }
    } catch (err) {
      console.error("[ニュースキャッシュ] Failed to open popup:", err);
      window.newsCacheWindow = null;
    }
  };

  window.updateNewsListPopup = function () {
    if (window.newsListWindow && !window.newsListWindow.closed) {
      try {
        if (typeof window.newsListWindow.renderNewsList === "function") {
          window.newsListWindow.renderNewsList();
        }
      } catch (e) { }
    }
  };

  window.clearNewsReadFlags = function (silent = false) {
    if (window.readNewsTitles) {
      window.readNewsTitles.clear();
    }
    try {
      localStorage.removeItem("newsReadTitles");
    } catch (e) { }
    window.updateNewsListPopup();
    if (!silent) {
      if (typeof window.showNotification === "function") {
        window.showNotification("🗑️ 既読フラグをすべてクリアしました");
      }
    }
  };

  window.startNewsFromTitle = async function (targetTitle) {
    if (!targetTitle || !window.latestFetchedNews) return;
    const idx = window.latestFetchedNews.findIndex(it => it.title === targetTitle);
    if (idx !== -1 && typeof window.startNewsBroadcast === "function") {
      window.startNewsBroadcast(idx, window.latestFetchedNews, true);
    }
  };

  function initNewsListUI() {
    // 1. ヘッダー「📰 記事一覧」ボタン
    const headerBtn = document.getElementById("header-news-list-btn");
    if (headerBtn) {
      headerBtn.onclick = (e) => {
        e.preventDefault();
        window.openNewsListPopup();
      };
    }

    // 2. ニュース設定内「📋 取得したニュース一覧を確認」ボタン
    const listBtn = document.getElementById("news-list-btn");
    if (listBtn) {
      listBtn.onclick = (e) => {
        e.preventDefault();
        window.openNewsListPopup();
      };
    }

    // 3. ニュース設定内「🗑️ 既読フラグをクリア」ボタン
    const clearBtn = document.getElementById("news-clear-read-btn");
    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.preventDefault();
        window.clearNewsReadFlags();
      };
    }
  }

  // DOMContentLoaded および uiLoaded (動的UIパネル読み込み) での確実なバインド
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNewsListUI);
  } else {
    initNewsListUI();
  }
  window.addEventListener("uiLoaded", initNewsListUI);

  // 'n' / 'N' キーボードショートカット
  window.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      window.openNewsListPopup();
    }
  });
})();
