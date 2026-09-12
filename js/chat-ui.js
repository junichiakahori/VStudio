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
  window.statTotalViews = document.getElementById("stat-total-views");
  if (statTotalViews) statTotalViews.textContent = "0";
  window.statLikes = document.getElementById("stat-likes");
  if (statLikes) statLikes.textContent = "0";

  window.renderAllComments();
  console.log("[コメント] 🗑️ 画面上のコメントと統計を全消去しました");
};

window.renderAllComments = function renderAllComments() {
  const viewer = document.getElementById("comment-viewer");
  if (!viewer) return;
  viewer.innerHTML = "";
  if (!Array.isArray(window.commentHistory)) return;

  // 履歴をそのままレンダリング (古い順、最新が下になるように)
  window.commentHistory.forEach((c) => {
    const el = document.createElement("div");
    el.className = `comment-item ${c.platform}-comment`;
    if (c.isGift) el.classList.add("gift-comment");

    const icon =
      c.platform === "youtube" ? "🔴" : c.platform === "tiktok" ? "🎵" : "💬";

    let avatarHtml = "";
    if (c.iconUrl) {
      let safeIconUrl = c.iconUrl.startsWith("//") ? `https:${c.iconUrl}` : c.iconUrl;
      avatarHtml = `<img src="${safeIconUrl}" class="comment-avatar" alt="${c.nickname}" referrerpolicy="no-referrer" onerror="this.style.display='none'">`;
    }
    el.innerHTML = `<div class="comment-author">${avatarHtml}<span>${icon} ${c.nickname}</span></div><div class="comment-text">${c.comment}</div>`;
    viewer.appendChild(el);
  });
  viewer.scrollTop = viewer.scrollHeight; // 一番下(最新)にスクロール
};

// 📺 リロード後も動画IDが変わらない限りコメント履歴を画面に復元する関数
window.restoreCommentsIfSameVideo = function restoreCommentsIfSameVideo() {
  try {
    const currentVid = localStorage.getItem("savedYoutubeVideoId") || localStorage.getItem("savedYoutubeId") || "";
    const savedCommentVid = localStorage.getItem("savedCommentVideoId") || "";

    // 動画IDが明確に別のものに変わっていた場合のみ古いコメントをクリア
    if (savedCommentVid && currentVid && savedCommentVid !== currentVid) {
      console.log(`[コメント復元] 📺 配信枠が変更されています (${savedCommentVid} -> ${currentVid}) ➔ 過去コメントをクリア`);
      window.clearAllComments();
      return;
    }

    // 同一動画IDまたは継続中の場合はコメント履歴を復元
    const saved = localStorage.getItem("savedCommentHistory");
    if (saved) {
      try {
        window.commentHistory = JSON.parse(saved);
      } catch (err) {
        window.commentHistory = [];
      }
    }
    const savedCount = localStorage.getItem("savedTotalCommentsCount");
    if (savedCount) {
      window.totalCommentsCount = parseInt(savedCount, 10) || 0;
    }
    if (window.totalCommentsCount < window.commentHistory.length) {
      window.totalCommentsCount = window.commentHistory.length;
    }
    const statEl = document.getElementById("stat-comments");
    if (statEl) statEl.textContent = window.totalCommentsCount;

    // 画面の #comment-viewer に復元レンダリング
    if (window.commentHistory && window.commentHistory.length > 0) {
      window.renderAllComments();
      console.log(`[コメント復元] ✅ リロード前のコメント ${window.commentHistory.length} 件を画面に復元しました (動画ID: ${currentVid || savedCommentVid || '共通'})`);
    }
  } catch (e) {
    console.warn("[コメント復元] 復元例外:", e);
  }
};

// 初回ロード（DOM準備完了およびuiLoadedイベントで確実に復元）
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", window.restoreCommentsIfSameVideo);
} else {
  window.restoreCommentsIfSameVideo();
}
if (typeof window.addEventListener === "function") {
  window.addEventListener("uiLoaded", window.restoreCommentsIfSameVideo);
}

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
