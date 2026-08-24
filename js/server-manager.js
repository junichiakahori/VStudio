// Server Manager Logic

const API_BASE = "/_api/servers";
let logIntervals = {};

export async function checkServerStatus() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) return;
    const status = await res.json();
    
    updateUI(status);
  } catch (err) {
    // 画面リロード時やバックエンド起動中の通信エラーは静かに無視
  }
}

export async function sendServerAction(serverName, action) {
  console.log(`[ServerManager] ユーザー操作: ${serverName} の ${action} リクエストを送信します...`);
  try {
    const res = await fetch(`${API_BASE}/${serverName}/${action}`, {
      method: "POST"
    });
    if (res.ok) {
      console.log(`[ServerManager] ✅ ${serverName} の ${action} に成功しました`);
      setTimeout(checkServerStatus, 500); // Check status again after a short delay
    } else {
      console.error(`[ServerManager] ❌ ${serverName} の ${action} に失敗しました: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`[ServerManager] ❌ ${serverName} の ${action} リクエスト送信中にエラーが発生しました:`, err);
  }
}

async function fetchLogs(serverName) {
  try {
    const res = await fetch(`${API_BASE}/${serverName}/logs`);
    if (!res.ok) return;
    const data = await res.json();
    const logContainer = document.getElementById(`sm-log-${serverName}`);
    if (logContainer && data.logs) {
      // Only update if scrolled to bottom to allow manual scrolling
      const isScrolledToBottom = logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 10;
      
      logContainer.textContent = data.logs.join('\n');
      
      if (isScrolledToBottom) {
        logContainer.scrollTop = logContainer.scrollHeight;
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

    if (isRunning) {
      indicator.style.background = "#0f0";
      indicator.style.boxShadow = "0 0 5px #0f0";
      
      btn.textContent = "停止";
      btn.style.color = "#f00";
      btn.style.border = "1px solid #f00";
      btn.style.background = "rgba(255,0,0,0.2)";
      btn.dataset.action = "stop";
    } else {
      indicator.style.background = "#ff4444";
      indicator.style.boxShadow = "0 0 5px #ff4444";
      
      btn.textContent = "起動";
      btn.style.color = "#0f0";
      btn.style.border = "1px solid #0f0";
      btn.style.background = "rgba(0,255,0,0.2)";
      btn.dataset.action = "start";
    }
  });
}

// Initialize event listeners when UI loads
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("server-manager", () => {
  const buttons = document.querySelectorAll(".sm-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const serverName = btn.dataset.server;
      const action = btn.dataset.action; // start or stop
      
      // Provide immediate visual feedback
      btn.textContent = "処理中...";
      btn.style.color = "#ffaa00";
      btn.style.border = "1px solid #ffaa00";
      btn.style.background = "rgba(255,170,0,0.2)";
      
      sendServerAction(serverName, action);
    });
  });

  const logButtons = document.querySelectorAll(".sm-log-btn");
  logButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const serverName = btn.dataset.server;
      const logContainer = document.getElementById(`sm-log-${serverName}`);
      
      if (logContainer.style.display === "none") {
        logContainer.style.display = "block";
        btn.textContent = "ログ隠す";
        fetchLogs(serverName); // immediate fetch
        logIntervals[serverName] = setInterval(() => fetchLogs(serverName), 1000);
      } else {
        logContainer.style.display = "none";
        btn.textContent = "ログ表示";
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
