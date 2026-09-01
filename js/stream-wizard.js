// =====================================================================
// 🚀 YouTube配信準備ウィザード (Stream Wizard) - 別ウィンドウ起動
// =====================================================================

window.streamWizardPopup = null;

// 🚀 ウィザードを別ウィンドウで開くグローバル関数
window.openWizardPopup = function () {
  try {
    if (window.streamWizardPopup) {
      try {
        if (!window.streamWizardPopup.closed) {
          window.streamWizardPopup.focus();
          return;
        }
      } catch (e) { }
    }

    // ウィンドウサイズと配置（画面中央付近に表示）
    const width = 760;
    const height = 660;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    const url = `/wizard.html?t=${Date.now()}`;

    window.streamWizardPopup = window.open(
      url,
      "StreamWizard",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );

    if (!window.streamWizardPopup) {
      alert("ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。");
    }
  } catch (err) {
    console.error("[StreamWizard] Failed to open popup:", err);
  }
};

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("stream-wizard", () => {
  const launchBtn = document.getElementById("stream-wizard-launch-btn");
  if (launchBtn) {
    launchBtn.onclick = () => {
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
