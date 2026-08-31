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
  window.newsCommentQueue = [];
  localStorage.setItem("savedCommentHistory", JSON.stringify([]));
  localStorage.setItem("savedTotalCommentsCount", 0);
  window.el = document.getElementById("stat-comments");
  if (el) el.textContent = 0;

  // 統計情報もクリア
  window.statSubscribers = document.getElementById("stat-subscribers");
  if (statSubscribers) statSubscribers.textContent = "0";
  window.statViewers = document.getElementById("stat-viewers");
  if (statViewers) statViewers.textContent = "0";
  window.statLikes = document.getElementById("stat-likes");
  if (statLikes) statLikes.textContent = "0";

  window.renderAllComments();
  console.log("[コメント] 🗑️ 画面上のコメントと統計を全消去しました");
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

// =====================================================================
// アコーディオン開閉（折りたたみ/展開 & 状態記憶）
// =====================================================================
window.initAccordionSections = function initAccordionSections() {
  const sections = document.querySelectorAll(".panel-section");
  sections.forEach((sec, idx) => {
    const h3 = sec.querySelector("h3");
    if (!h3) return;

    // セクションIDを決定 (IDまたはタイトルから安全に生成)
    const titleText = h3.textContent.replace(/[^\w\s\u3000-\u30FF\u4E00-\u9FA0]+/g, '').trim();
    const secId = sec.id || `sec_${sec.dataset.tab || 'tab'}_${idx}_${titleText}`;

    // 既に矢印がなければ追加
    if (!h3.querySelector(".accordion-arrow")) {
      const originalHtml = h3.innerHTML;
      h3.innerHTML = `<div class="accordion-title">${originalHtml}</div><span class="accordion-arrow">▼</span>`;
    }

    // 保存された状態を復元 (デフォルトは展開)
    const isSavedCollapsed = localStorage.getItem(`accordion_${secId}`);
    if (isSavedCollapsed === "true") {
      sec.classList.add("collapsed");
    } else {
      sec.classList.remove("collapsed");
    }

    // クリックイベント（重複バインド防止）
    if (!h3._accordionBound) {
      h3._accordionBound = true;
      h3.addEventListener("click", (e) => {
        // ボタンや入力欄、セレクトボックスのクリックは無視
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return;
        sec.classList.toggle("collapsed");
        const collapsed = sec.classList.contains("collapsed");
        localStorage.setItem(`accordion_${secId}`, collapsed ? "true" : "false");
      });
    }
  });
};

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("chat-ui", () => {
  if (typeof initAccordionSections === "function") {
    initAccordionSections();
  }
});
