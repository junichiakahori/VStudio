// =====================================================================
// news-list-popup.js: 別窓ニュース一覧・既読クリア・個別再生ポップアップ
// =====================================================================

(function() {
  window.openNewsListPopup = function () {
    const width = 850;
    const height = 650;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.newsListWindow = window.open(
      "/views/news_list.html",
      "VStudioNewsListWindow",
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
    if (window.newsListWindow) {
      window.newsListWindow.focus();
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
      alert("既読フラグをすべてクリアしました。");
    }
  };

  window.startNewsFromTitle = async function (targetTitle) {
    if (!targetTitle || !window.latestFetchedNews) return;
    const idx = window.latestFetchedNews.findIndex(it => it.title === targetTitle);
    if (idx !== -1 && typeof window.startNewsBroadcast === "function") {
      window.startNewsBroadcast(idx, window.latestFetchedNews, true);
    }
  };
})();
