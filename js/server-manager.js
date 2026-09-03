// Server Manager Logic - Enhanced with Rich Tactile Feedback & Real-time Tracking

const API_BASE = "/_api/servers";
let logIntervals = {};
let pendingActions = {}; // serverName -> { targetAction, startTime, timeoutId, pollIntervalId }

const SERVER_DISPLAY_NAMES = {
  local_api_server: "Local API (8001)",
  youtube_comment_server: "YouTube コメント (8768)",
  tiktok_comment_server: "TikTok コメント (8767)"
};

// ── スマートトースト通知ヘルパー ──
function showServerToast(message, type = "info") {
  // 既存の showNotification / showToast / showWizardToast があれば活用
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }
  if (typeof window.showWizardToast === "function") {
    window.showWizardToast(message);
    return;
  }

  // フォールバック: 画面上部にフロートするリッチなトースト通知
  let container = document.getElementById("vstudio-server-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "vstudio-server-toast-container";
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const bgColors = {
    success: "linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))",
    error: "linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))",
    warning: "linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))",
    info: "linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(29, 78, 216, 0.95))"
  };

  toast.style.cssText = `
    background: ${bgColors[type] || bgColors.info};
    color: #ffffff;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 9px 14px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 10px rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
  `;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0) scale(1)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px) scale(0.95)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3200);
}

export async function checkServerStatus() {
  try {
    const res = await fetch(`${API_BASE}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const status = await res.json();
    updateUI(status);
  } catch (err) {
    // 画面リロード時やバックエンド起動中の通信エラーは静かに無視
  }
}

export async function sendServerAction(serverName, action) {
  const displayName = SERVER_DISPLAY_NAMES[serverName] || serverName;
  const isStarting = action === "start";

  console.log(`[ServerManager] ユーザー操作: ${displayName} の ${action} リクエストを送信します...`);
  showServerToast(isStarting ? `🚀 ${displayName} の起動を開始しました...` : `⏹️ ${displayName} を停止しています...`, "info");

  try {
    const res = await fetch(`${API_BASE}/${serverName}/${action}`, {
      method: "POST"
    });

    if (!res.ok) {
      console.error(`[ServerManager] ❌ ${displayName} の ${action} に失敗しました: HTTP ${res.status}`);
      showServerToast(`❌ ${displayName} の操作に失敗しました (HTTP ${res.status})`, "error");
      checkServerStatus();
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data.status === "already_running") {
      showServerToast(`ℹ️ ${displayName} は既に稼働中です`, "info");
      checkServerStatus();
      return;
    }

    // ── 高速スマート追跡ポーリング（状態変化を即座にキャッチ） ──
    const targetRunning = isStarting;
    let attempts = 0;
    const maxAttempts = 8;

    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const checkRes = await fetch(`${API_BASE}?t=${Date.now()}`, { cache: "no-store" });
        if (checkRes.ok) {
          const status = await checkRes.json();
          updateUI(status);

          // 目的の状態に到達したか判定
          if (status[serverName] === targetRunning) {
            clearInterval(pollInterval);
            if (targetRunning) {
              showServerToast(`✅ ${displayName} が正常に起動しました！`, "success");
            } else {
              showServerToast(`⏹️ ${displayName} を停止しました`, "success");
            }
            return;
          }
        }
      } catch (e) { }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        checkServerStatus();
        if (targetRunning) {
          showServerToast(`⚠️ ${displayName} の起動完了を確認できませんでした。ログを確認してください`, "warning");
        }
      }
    }, 600);

  } catch (err) {
    console.error(`[ServerManager] ❌ ${displayName} の ${action} リクエスト送信中にエラーが発生しました:`, err);
    showServerToast(`❌ 通信エラーが発生しました`, "error");
    checkServerStatus();
  }
}

async function fetchLogs(serverName) {
  try {
    const res = await fetch(`${API_BASE}/${serverName}/logs?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const logContainer = document.getElementById(`sm-log-${serverName}`);
    if (logContainer) {
      const logs = data.logs || [];
      if (logs.length === 0) {
        logContainer.textContent = "（現在ログデータはありません。サーバー稼働ログファイルを出力待機中...）";
        logContainer.style.color = "#888";
      } else {
        const isScrolledToBottom = logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 20;
        logContainer.textContent = logs.join("\n");
        logContainer.style.color = "#4ade80";

        if (isScrolledToBottom) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }
    }
  } catch (err) {
    console.error(`Failed to fetch logs for ${serverName}`, err);
  }
}

function updateUI(status) {
  Object.keys(status).forEach(serverName => {
    const isRunning = status[serverName];
    const container = document.getElementById(`sm-${serverName}`);
    if (!container) return;

    const indicator = container.querySelector(".sm-indicator");
    const btn = container.querySelector(".sm-btn");
    const badge = container.querySelector(".sm-status-badge");

    // ボタンが現在「処理中」でない場合のみ更新
    if (btn && !btn.dataset.busy) {
      btn.disabled = false;
      if (isRunning) {
        btn.textContent = "⏹️ 停止";
        btn.style.color = "#ff6b6b";
        btn.style.borderColor = "#ff4444";
        btn.style.background = "rgba(239, 68, 68, 0.18)";
        btn.dataset.action = "stop";
      } else {
        btn.textContent = "▶️ 起動";
        btn.style.color = "#4ade80";
        btn.style.borderColor = "#22c55e";
        btn.style.background = "rgba(34, 197, 94, 0.18)";
        btn.dataset.action = "start";
      }
    }

    if (indicator) {
      if (isRunning) {
        indicator.style.background = "#10b981";
        indicator.style.boxShadow = "0 0 8px #10b981, 0 0 2px #fff";
      } else {
        indicator.style.background = "#ef4444";
        indicator.style.boxShadow = "0 0 5px #ef4444";
      }
    }

    if (badge) {
      if (isRunning) {
        badge.textContent = "稼働中";
        badge.style.color = "#10b981";
        badge.style.background = "rgba(16, 185, 129, 0.15)";
        badge.style.borderColor = "rgba(16, 185, 129, 0.4)";
      } else {
        badge.textContent = "停止中";
        badge.style.color = "#94a3b8";
        badge.style.background = "rgba(148, 163, 184, 0.1)";
        badge.style.borderColor = "rgba(148, 163, 184, 0.25)";
      }
    }
  });
}

// Initialize event listeners when UI loads
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("server-manager", () => {
  const buttons = document.querySelectorAll(".sm-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled || btn.dataset.busy === "1") return;

      const serverName = btn.dataset.server;
      const action = btn.dataset.action; // start or stop

      // 即時視覚フィードバック
      btn.dataset.busy = "1";
      btn.disabled = true;
      btn.textContent = action === "start" ? "⏳ 起動中..." : "⏳ 停止中...";
      btn.style.color = "#fbbf24";
      btn.style.borderColor = "#f59e0b";
      btn.style.background = "rgba(245, 158, 11, 0.25)";

      try {
        await sendServerAction(serverName, action);
      } finally {
        setTimeout(() => {
          btn.dataset.busy = "";
          btn.disabled = false;
        }, 1200);
      }
    });
  });

  const logButtons = document.querySelectorAll(".sm-log-btn");
  logButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const serverName = btn.dataset.server;
      const logContainer = document.getElementById(`sm-log-${serverName}`);
      if (!logContainer) return;

      const isHidden = logContainer.style.display === "none" || !logContainer.style.display;

      if (isHidden) {
        logContainer.style.display = "block";
        logContainer.textContent = "（ログを読み込み中...）";
        logContainer.style.color = "#94a3b8";
        
        btn.textContent = "✖ ログを閉じる";
        btn.style.background = "rgba(59, 130, 246, 0.3)";
        btn.style.borderColor = "#60a5fa";
        btn.style.color = "#93c5fd";

        fetchLogs(serverName); // immediate fetch
        if (logIntervals[serverName]) clearInterval(logIntervals[serverName]);
        logIntervals[serverName] = setInterval(() => fetchLogs(serverName), 1200);
      } else {
        logContainer.style.display = "none";
        btn.textContent = "📋 ログ表示";
        btn.style.background = "rgba(255, 255, 255, 0.08)";
        btn.style.borderColor = "#64748b";
        btn.style.color = "#e2e8f0";

        if (logIntervals[serverName]) {
          clearInterval(logIntervals[serverName]);
          delete logIntervals[serverName];
        }
      }
    });
  });

  // Initial check
  checkServerStatus();

  // Poll every 5 seconds to keep status updated
  setInterval(checkServerStatus, 5000);
});
