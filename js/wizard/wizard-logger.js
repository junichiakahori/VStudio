// =====================================================================
// wizard-logger.js: ログ転送・グローバル例外捕捉・非同期トースト通知エンジン
// =====================================================================

(function() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  // 🚨 ウィザード用 グローバル例外・構文エラー完全捕捉エンジン
  window.onerror = function(msg, url, lineNo, columnNo, error) {
    const file = url ? url.split('/').pop() : 'wizard.html';
    const errStr = `[グローバル例外] 💥 ${file}:${lineNo}:${columnNo} -> ${msg}`;
    origError.call(console, errStr);
    forwardLog("error", [errStr]);
    return false;
  };

  window.onunhandledrejection = function(event) {
    const reason = event.reason ? (event.reason.stack || event.reason.message || event.reason) : 'unknown rejection';
    origError.call(console, reason);
    forwardLog("error", [`[未処理Promise拒否] 💥 ${reason}`]);
  };

  function getWizardScriptVersion(fileName) {
    try {
      const scripts = document.querySelectorAll("script[src]");
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute("src") || "";
        if (src.includes(fileName)) {
          const vMatch = src.match(/\?v=([a-zA-Z0-9_\.\-]+)/);
          if (vMatch) return `?v=${vMatch[1]}`;
        }
      }
      if (fileName.includes("wizard.html")) {
        const vMatch = window.location.href.match(/\?v=([a-zA-Z0-9_\.\-]+)/);
        if (vMatch) return `?v=${vMatch[1]}`;
      }
    } catch(e) {}
    return "";
  }

  function getWizardCallerSource() {
    try {
      const stack = (new Error()).stack || "";
      const lines = stack.split("\n");
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.includes("forwardLog") || line.includes("getWizardCallerSource")) continue;
        const match = line.match(/([a-zA-Z0-9_\-]+\.(?:js|html))(?::(\d+))?/);
        if (match) {
          const fileName = match[1];
          const lineNo = match[2] ? `:${match[2]}` : "";
          const ver = getWizardScriptVersion(fileName);
          return `[${fileName}${ver}${lineNo}]`;
        }
      }
    } catch (e) {}
    return "[wizard.html]";
  }

  function forwardLog(type, args) {
    try {
      const caller = getWizardCallerSource();
      const msg = Array.from(args).map(a => {
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
        if (typeof a === "object" && a !== null) {
          try {
            const str = JSON.stringify(a);
            return str === "{}" ? (a.message || a.toString()) : str;
          } catch(e) { return String(a); }
        }
        return String(a);
      }).join(" ");
      // ポート番号(8443:本番ネイティブ / 8444:開発Safari)およびWKWebView nativeHostで完全判定
      let clientType = "web";
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeHost) {
        clientType = "native";
      } else if (window.location.port === "8443") {
        clientType = "native";
      } else if (window.location.port === "8444") {
        clientType = "web";
      }

      const clientTag = (clientType === "native") ? "[🖥️ NATIVE]" : "[🧭 SAFARI]";
      
      const now = new Date();
      const pad = (n, z = 2) => String(n).padStart(z, "0");
      const timeStr = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}]`;

      fetch("/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `${timeStr} ${clientTag} ${caller} [${type.toUpperCase()}] ${msg}`, client: clientType })
      }).catch(() => {});
    } catch(e) {}
  }



  console.log = function(...args) { origLog.apply(console, args); forwardLog("log", args); };
  console.warn = function(...args) { origWarn.apply(console, args); forwardLog("warn", args); };
  console.error = function(...args) { origError.apply(console, args); forwardLog("error", args); };

  // 🍞 非同期トースト通知エンジン (ブロッキングダイアログ完全廃止)
  function showWizardToast(msg, isSuccess = true, duration = 3000) {
    try {
      let container = document.getElementById("wizard-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "wizard-toast-container";
        container.style.cssText = "position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:999999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none;";
        document.body.appendChild(container);
      }
      const toast = document.createElement("div");
      toast.style.cssText = `background: ${isSuccess ? "linear-gradient(135deg, rgba(20,24,36,0.95), rgba(13,16,23,0.95))" : "linear-gradient(135deg, rgba(40,15,20,0.95), rgba(25,10,12,0.95))"}; border: 1px solid ${isSuccess ? "#00d2d3" : "#ff7675"}; color: ${isSuccess ? "#00ffff" : "#ff7675"}; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; box-shadow: 0 8px 30px rgba(0,0,0,0.8), 0 0 15px ${isSuccess ? "rgba(0,210,211,0.4)" : "rgba(255,118,117,0.4)"}; pointer-events:auto; display:flex; align-items:center; gap:8px; animation: toastFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);`;
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => { toast.remove(); }, 300);
      }, duration);
    } catch(e) {
      console.log("[Toast]", msg);
    }
  }

  // 🚨 alert / confirm の呼び出しをトースト・安全動作へリダイレクト
  window.showWizardToast = showWizardToast;
  window.alert = function(msg) {
    showWizardToast(String(msg || ""), true, 3500);
  };
  window.confirm = function() {
    return true;
  };
})();
