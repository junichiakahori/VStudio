// =====================================================================
// 🚀 YouTube配信準備ウィザード (Stream Wizard) - 別ウィンドウ起動
// =====================================================================

window.streamWizardPopup = null;

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("stream-wizard", () => {
  const launchBtn = document.getElementById("stream-wizard-launch-btn");

  if (launchBtn) {
    launchBtn.onclick = () => {
      // 既に開いていればフォーカス
      if (window.streamWizardPopup && !window.streamWizardPopup.closed) {
        window.streamWizardPopup.focus();
        return;
      }

      // ウィンドウサイズと配置（画面中央付近に表示）
      const width = 760;
      const height = 660;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);

      window.streamWizardPopup = window.open(
        "wizard.html",
        "StreamWizard",
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
      );

      if (!window.streamWizardPopup) {
        alert("ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。");
      }
    };
  }
});
