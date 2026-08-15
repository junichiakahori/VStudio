window.addEventListener("uiLoaded", () => {
  // =====================================================================
  // タブ切り替えロジック
  // =====================================================================
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panelSections = document.querySelectorAll(".panel-section");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-target");
      if (!targetTab) return;

      tabBtns.forEach((b) => {
        b.classList.remove("active");
        b.style.color = "var(--text-muted)";
        b.style.borderBottom = "2px solid transparent";
      });

      btn.classList.add("active");
      btn.style.color = "#fff";
      btn.style.borderBottom = "2px solid var(--primary)";

      panelSections.forEach((sec) => {
        if (sec.getAttribute("data-tab") === targetTab) {
          sec.style.display = "flex";
        } else {
          sec.style.display = "none";
        }
      });
    });
  });

  // 初期状態の設定
  panelSections.forEach((sec) => {
    if (sec.getAttribute("data-tab") === "tab-avatar") {
      sec.style.display = "flex";
    } else {
      sec.style.display = "none";
    }
  });

  // ラジオモードの設定表示切り替え
  window.radioModeToggle = document.getElementById("ai-radio-mode-toggle");
  window.radioModeSettings = document.getElementById("ai-radio-mode-settings");
  window.localScheduleContainer = document.getElementById(
    "local-schedule-container",
  );
  if (window.radioModeToggle && window.radioModeSettings) {
    window.radioModeToggle.addEventListener("change", (e) => {
      window.radioModeSettings.style.display = e.target.checked
        ? "flex"
        : "none";
      if (window.localScheduleContainer)
        window.localScheduleContainer.style.display = e.target.checked
          ? "block"
          : "none";
    });
    // 初期状態
    window.radioModeSettings.style.display = window.radioModeToggle.checked
      ? "flex"
      : "none";
    if (window.localScheduleContainer)
      window.localScheduleContainer.style.display = window.radioModeToggle
        .checked
        ? "block"
        : "none";
  }
});
