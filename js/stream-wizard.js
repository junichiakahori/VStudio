// =====================================================================
// 🚀 YouTube配信準備ウィザード (Stream Wizard) - 別ウィンドウ起動
// =====================================================================

window.streamWizardPopup = null;

// 🚀 ウィザードを別ウィンドウで開くグローバル関数
window.openWizardPopup = function () {
  try {
    // 🖥️ Local API サーバー経由で macOS の Accessibility (AXRaise) をキックして OS レベルで最前面化
    const apiPort = (window.location && window.location.port === "8444") ? "8002" : "8001";
    fetch(`http://127.0.0.1:${apiPort}/api/window/focus?type=wizard`).catch(() => {});

    // ネイティブアプリ（macOS Dedicated App）へ最前面化を通知
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeHost) {
      try {
        window.webkit.messageHandlers.nativeHost.postMessage({ action: "focusWindow", type: "wizard" });
      } catch (e) { }
    }

    // 既存ポップアップが本当に生きているか検証
    if (window.streamWizardPopup) {
      try {
        if (!window.streamWizardPopup.closed) {
          // ブラウザ側でも既存ターゲット名で呼び出して前面化を促進
          const existing = window.open("", "VStudioWizardWindow");
          if (existing) {
            existing.focus();
          }
          window.streamWizardPopup.focus();
          return;
        }
      } catch (e) {
        // クロスオリジンまたは破棄済みの場合は参照クリアして再生成へ進む
        window.streamWizardPopup = null;
      }
    }

    // ウィンドウサイズと配置（画面中央付近に表示）
    const width = 760;
    const height = 660;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    const url = `/wizard.html?t=${Date.now()}`;

    // ターゲット名を固有名 "VStudioWizardWindow" に指定して前面化トラッキングを有効化
    window.streamWizardPopup = window.open(
      url,
      "VStudioWizardWindow",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );

    if (!window.streamWizardPopup) {
      // フォールバック: 再度リセットして直接オープン
      window.streamWizardPopup = window.open(url, "VStudioWizardWindow");
    }
  } catch (err) {
    console.error("[StreamWizard] Failed to open popup:", err);
    window.streamWizardPopup = null;
  }
};

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("stream-wizard", () => {
  const launchBtn = document.getElementById("stream-wizard-launch-btn");
  if (launchBtn) {
    launchBtn.onclick = (e) => {
      e.preventDefault();
      window.openWizardPopup();
    };
  }

  // ⌨️ キーボードショートカット: 'W' キー または 'Alt+W' でウィザードを開く
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) return;

    if (e.code === "KeyW" || e.key === "w" || e.key === "W" || (e.altKey && (e.code === "KeyW" || e.key === "w" || e.key === "W"))) {
      if (e.isComposing) return;
      e.preventDefault();
      window.openWizardPopup();
    }
  });
});
