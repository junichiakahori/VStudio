window.joinedUsers = new Set();
window.removeEmojis = function removeEmojis(text) {
  if (!text) return text;
  let clean = text.replace(
    /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g,
    "",
  );
  clean = clean.replace(/:[^:\s]+:/g, "");
  clean = clean.replace(/@/g, ""); // 読み上げ時の「アット」を省略するため @ を全削除
  return clean.trim();
};

// コメント履歴の保存と復元
window.commentHistory = [];
window.totalCommentsCount = 0;
window.clearAllComments = function clearAllComments() {
  window.commentHistory = [];
  window.totalCommentsCount = 0;
  localStorage.setItem("savedCommentHistory", JSON.stringify([]));
  localStorage.setItem("savedTotalCommentsCount", 0);
  window.el = document.getElementById("stat-comments");
  if (el) el.textContent = 0;

  // 統計情報もクリア
  window.statSubscribers = document.getElementById("stat-subscribers");
  if (statSubscribers) statSubscribers.textContent = "0";
  window.statViewers = document.getElementById("stat-viewers");
  if (statViewers) statViewers.textContent = "0";

  window.renderAllComments();
};

try {
  const saved = localStorage.getItem("savedCommentHistory");
  if (saved) {
    window.commentHistory = JSON.parse(saved);
  }
  const savedCount = localStorage.getItem("savedTotalCommentsCount");
  if (savedCount) {
    window.totalCommentsCount = parseInt(savedCount, 10);
  }
  if (window.totalCommentsCount < window.commentHistory.length) {
    window.totalCommentsCount = window.commentHistory.length;
  }
  window.el = document.getElementById("stat-comments");
  if (el) el.textContent = window.totalCommentsCount;
} catch (e) {
  console.warn("Failed to load comment history", e);
}

window.renderAllComments = function renderAllComments() {
  window.viewer = document.getElementById("comment-viewer");
  if (!viewer) return;
  viewer.innerHTML = "";
  // 履歴をそのままレンダリング (古い順、最新が下になるように)
  window.commentHistory.forEach((c) => {
    const el = document.createElement("div");
    el.className = `comment-item ${c.platform}-comment`;
    if (c.isGift) el.classList.add("gift-comment");

    const icon =
      c.platform === "youtube" ? "🔴" : c.platform === "tiktok" ? "🎵" : "💬";

    let avatarHtml = "";
    if (c.iconUrl) {
      avatarHtml = `<img src="${c.iconUrl}" class="comment-avatar" alt="${c.nickname}" crossorigin="anonymous">`;
    }
    el.innerHTML = `<div class="comment-author">${avatarHtml}<span>${icon} ${c.nickname}</span></div><div class="comment-text">${c.comment}</div>`;
    viewer.appendChild(el);
  });
  viewer.scrollTop = viewer.scrollHeight; // 一番下(最新)にスクロール
};

// リセットボタンの登録
window.clearCommentsBtn = document.getElementById("clear-comments-btn");
if (clearCommentsBtn) {
  clearCommentsBtn.addEventListener("click", () => {
    window.clearAllComments();
  });
}

// 初回レンダリング
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderAllComments);
} else {
  window.renderAllComments();
}
