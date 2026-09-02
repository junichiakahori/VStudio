// ==============================================================================
// 💾 news-state-manager.js
// ニュース番組の進行状態・既読記事管理・LocalStorage永続化モジュール
// ==============================================================================

const STORAGE_KEY_BROADCAST_STATE = "vstudio_news_broadcast_state";
const STORAGE_KEY_READ_TITLES = "vstudio_read_news_titles";

window.newsBroadcastState = {
  isBroadcasting: false,
  isPaused: false,
  currentIndex: 0,
  totalCount: 0,
  currentCategoryKey: "cat_all",
  currentCategoryName: "全て",
  readArticles: [],
  startedAt: null,
  currentModelId: "tororo",
  timerInterval: null
};

// 既読ニュースのセット
window.readNewsTitles = new Set();

function loadReadNewsTitles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_READ_TITLES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        readNewsTitles = new Set(arr);
      }
    }
  } catch (e) {
    console.warn("[ニュース状態] 既読タイトルの復元に失敗:", e);
  }
  return readNewsTitles;
}

function saveReadNewsTitles() {
  try {
    const arr = Array.from(readNewsTitles);
    // 最大500件まで保持
    if (arr.length > 500) {
      arr.splice(0, arr.length - 500);
    }
    localStorage.setItem(STORAGE_KEY_READ_TITLES, JSON.stringify(arr));
  } catch (e) {
    console.warn("[ニュース状態] 既読タイトルの保存に失敗:", e);
  }
}

function markNewsTitleAsRead(title) {
  if (!title) return;
  readNewsTitles.add(title.trim());
  saveReadNewsTitles();
}

function isNewsTitleRead(title) {
  if (!title) return false;
  return readNewsTitles.has(title.trim());
}

function saveNewsBroadcastState() {
  try {
    const toSave = {
      isBroadcasting: newsBroadcastState.isBroadcasting,
      isPaused: newsBroadcastState.isPaused,
      currentIndex: newsBroadcastState.currentIndex,
      totalCount: newsBroadcastState.totalCount,
      currentCategoryKey: newsBroadcastState.currentCategoryKey,
      currentCategoryName: newsBroadcastState.currentCategoryName,
      readArticles: newsBroadcastState.readArticles,
      startedAt: newsBroadcastState.startedAt,
      currentModelId: newsBroadcastState.currentModelId
    };
    localStorage.setItem(STORAGE_KEY_BROADCAST_STATE, JSON.stringify(toSave));
  } catch (e) {
    console.warn("[ニュース状態] 配信状態の保存に失敗:", e);
  }
}

function loadNewsBroadcastState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BROADCAST_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(newsBroadcastState, parsed);
      return parsed;
    }
  } catch (e) {
    console.warn("[ニュース状態] 配信状態の復元に失敗:", e);
  }
  return null;
}

function clearNewsBroadcastState() {
  newsBroadcastState.isBroadcasting = false;
  newsBroadcastState.isPaused = false;
  newsBroadcastState.currentIndex = 0;
  newsBroadcastState.totalCount = 0;
  newsBroadcastState.readArticles = [];
  newsBroadcastState.startedAt = null;
  if (newsBroadcastState.timerInterval) {
    clearInterval(newsBroadcastState.timerInterval);
    newsBroadcastState.timerInterval = null;
  }
  try {
    localStorage.removeItem(STORAGE_KEY_BROADCAST_STATE);
  } catch (e) {}
}

// 初期化
loadReadNewsTitles();

// グローバル互換
if (typeof window !== "undefined") {
  window.newsBroadcastState = newsBroadcastState;
  window.readNewsTitles = readNewsTitles;
  window.loadReadNewsTitles = loadReadNewsTitles;
  window.saveReadNewsTitles = saveReadNewsTitles;
  window.markNewsTitleAsRead = markNewsTitleAsRead;
  window.isNewsTitleRead = isNewsTitleRead;
  window.saveNewsBroadcastState = saveNewsBroadcastState;
  window.loadNewsBroadcastState = loadNewsBroadcastState;
  window.clearNewsBroadcastState = clearNewsBroadcastState;
}
