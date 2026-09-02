// =====================================================================
// news-ui-board.js: ニュースボード・セットリストアジェンダ描画モジュール
// =====================================================================

(function() {
  const newsBoard = document.getElementById("news-board");
  const newsBoardCategory = document.getElementById("news-board-category");
  const newsBoardProgress = document.getElementById("news-board-progress");
  const newsArticleTitle = document.getElementById("news-article-title");
  const newsArticleDesc = document.getElementById("news-article-desc");
  const newsArticleDate = document.getElementById("news-article-date");
  const newsSetlistBoard = document.getElementById("news-setlist-board");
  const setlistItemsContainer = document.getElementById("setlist-items");
  const setlistBadge = document.getElementById("setlist-badge");

  function showNewsBoard(item, currentIdx, totalCount) {
    if (!newsBoard) return;
    if (newsBoardCategory) newsBoardCategory.textContent = item.categoryName || "最新ニュース";
    if (newsBoardProgress) {
      newsBoardProgress.style.display = "inline-block";
      newsBoardProgress.textContent = `${currentIdx} / ${totalCount}`;
    }
    if (newsArticleTitle) newsArticleTitle.textContent = item.title || "";
    if (newsArticleDesc) newsArticleDesc.textContent = item.description || item.snippet || "";
    if (newsArticleDate) {
      let dStr = item.pubDate || "";
      try {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          dStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        }
      } catch(e) {}
      newsArticleDate.textContent = dStr;
    }
    newsBoard.classList.add("active");
    newsBoard.style.display = "block";
  }

  function hideNewsBoard() {
    if (newsBoard) {
      newsBoard.classList.remove("active");
      newsBoard.style.display = "none";
    }
  }

  function initNewsSetlist(newsList) {
    if (!newsSetlistBoard || !setlistItemsContainer) return;
    setlistItemsContainer.innerHTML = "";
    
    // カテゴリごとの件数を集計
    const catCounts = {};
    newsList.forEach(it => {
      const cat = it.categoryName || "総合";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    Object.keys(catCounts).forEach(cat => {
      const row = document.createElement("div");
      row.className = "setlist-row";
      row.innerHTML = `<span class="setlist-cat-name">${cat}</span><span class="setlist-cat-count">${catCounts[cat]}件</span>`;
      setlistItemsContainer.appendChild(row);
    });

    if (setlistBadge) setlistBadge.textContent = `全${newsList.length}件`;
    newsSetlistBoard.style.display = "block";
  }

  function hideNewsSetlist() {
    if (newsSetlistBoard) newsSetlistBoard.style.display = "none";
  }

  window.newsUIBoard = {
    showNewsBoard,
    hideNewsBoard,
    initNewsSetlist,
    hideNewsSetlist
  };
})();
