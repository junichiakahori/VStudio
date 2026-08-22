// =====================================================================
// VStudio Hot Reload & Hot Swap Engine
// 配信やアバター描画を中断（ブラウザ再読み込み）せずに最新コードを適用
// =====================================================================

(function () {
  window._uiLoadedHandlers = window._uiLoadedHandlers || new Map();
  window.onUILoaded = function (moduleId, handler) {
    window._uiLoadedHandlers.set(moduleId, handler);
  };

  const MANAGED_SCRIPTS = [
    "js/hot-reload.js",
    "js/audio-voicevox.js",
    "js/bgm-player.js",
    "js/ai-settings.js",
    "js/ui-tabs.js",
    "js/ui-state-autosave.js",
    "js/idle-speech.js",
    "js/chat-ui.js",
    "js/chat-client.js",
    "js/stream-automation.js",
    "js/news-mode.js",
    "js/radio-mode.js",
    "js/stream-tools.js",
    "js/stream-wizard.js",
    "js/obs-websocket.js",
    "js/screen-overlay.js",
    "js/tracking-camera.js",
    "js/avatar-features.js",
    "js/reaction-effects.js",
    "js/layout-manager.js"
  ];

  /**
   * トースト通知を表示
   */
  function showHotReloadToast(msg, isSuccess = true) {
    let toast = document.getElementById("hot-reload-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hot-reload-toast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(16, 24, 48, 0.92);
        border: 1px solid ${isSuccess ? "#00e676" : "#ff7675"};
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px ${isSuccess ? "rgba(0, 230, 118, 0.3)" : "rgba(255, 118, 117, 0.3)"};
        color: #fff;
        padding: 8px 18px;
        border-radius: 20px;
        font-size: 0.82rem;
        font-weight: 600;
        z-index: 999999;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.body.appendChild(toast);
    }
    toast.innerHTML = isSuccess ? `⚡ ${msg}` : `⚠️ ${msg}`;
    toast.style.borderColor = isSuccess ? "#00e676" : "#ff7675";
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(10px)";
    }, 2500);
  }

  /**
   * CSSを即時再適用
   */
  window.hotReloadCSS = function () {
    const links = document.querySelectorAll("link[rel='stylesheet']");
    const t = Date.now();
    links.forEach((link) => {
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin) {
        url.searchParams.set("v", t);
        link.href = url.toString();
      }
    });
    console.log("[HotReload] CSSを即時再適用しました");
  };

  /**
   * 指定または全スクリプトを動的ホットスワップ
   */
  window.hotReloadScripts = async function (scriptsToReload = MANAGED_SCRIPTS) {
    const targetList = Array.isArray(scriptsToReload) ? scriptsToReload : [scriptsToReload];
    const t = Date.now();
    let reloadedCount = 0;

    for (const src of targetList) {
      try {
        const cleanSrc = src.split("?")[0];
        const res = await fetch(`/${cleanSrc}?t=${t}`);
        if (res.ok) {
          const code = await res.text();
          // evalでグローバルスコープで再実行
          const fn = new Function(code);
          fn();
          reloadedCount++;
        }
      } catch (err) {
        console.warn(`[HotReload] ${src} のリロードに失敗:`, err);
      }
    }

    // UI初期化イベントの代わりに、登録されたモジュールハンドラを1回ずつ呼出（重複を完全排除）
    if (window._uiLoadedHandlers && window._uiLoadedHandlers.size > 0) {
      window._uiLoadedHandlers.forEach((fn, id) => {
        try {
          fn();
        } catch (e) {
          console.error(`[UILoaded Error: ${id}]`, e);
        }
      });
    }

    return reloadedCount;
  };

  /**
   * スクリプト + CSSを一括ホットリロード
   */
  window.hotReloadAll = async function (showToast = true) {
    try {
      window.hotReloadCSS();
      const count = await window.hotReloadScripts();
      if (showToast) {
        showHotReloadToast(`ホットリロード完了 (${count}モジュール更新・配信継続中)`);
      }
      console.log(`[HotReload] 全モジュール (${count}件) のホットスワップが完了しました`);
      return true;
    } catch (e) {
      console.error("[HotReload] エラー:", e);
      if (showToast) showHotReloadToast("ホットリロードに失敗しました", false);
      return false;
    }
  };

  // ショートカットキー: Shift + Alt + R または Shift + Ctrl + R でホットリロード
  window.addEventListener("keydown", (e) => {
    if (e.shiftKey && (e.altKey || e.ctrlKey) && (e.key === "R" || e.key === "r")) {
      e.preventDefault();
      window.hotReloadAll();
    }
  });

  // 定期的な自動ホットリロードシグナル確認（ローカル開発時の自動反映用）
  let lastSignalTime = 0;
  async function pollHotReloadSignal() {
    try {
      const res = await fetch("/hot_reload_signal", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.timestamp && data.timestamp > lastSignalTime) {
          if (lastSignalTime > 0) {
            console.log("[HotReload] サーバーシグナル検知: 自動ホットリロードを実行します");
            window.hotReloadAll(true);
          }
          lastSignalTime = data.timestamp;
        }
      }
    } catch (e) {}
  }

  // 3秒おきにサーバー更新シグナルを確認
  setInterval(pollHotReloadSignal, 3000);
})();
