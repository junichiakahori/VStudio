(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("ui-tabs", () => {
  // =====================================================================
  // タブ切り替えロジック
  // =====================================================================
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panelSections = document.querySelectorAll(".panel-section");

  const savedTab = localStorage.getItem("activeTab") || "tab-avatar";

  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      const targetTab = btn.getAttribute("data-target");
      if (!targetTab) return;

      localStorage.setItem("activeTab", targetTab);

      tabBtns.forEach((b) => {
        b.classList.remove("active");
      });

      btn.classList.add("active");

      panelSections.forEach((sec) => {
        if (sec.getAttribute("data-tab") === targetTab) {
          sec.style.display = "flex";
        } else {
          sec.style.display = "none";
        }
      });
    };
  });

  // 初期状態の設定
  let initialBtnFound = false;
  tabBtns.forEach((btn) => {
    if (btn.getAttribute("data-target") === savedTab) {
      btn.click();
      initialBtnFound = true;
    }
  });
  if (!initialBtnFound && tabBtns.length > 0) {
    tabBtns[0].click();
  }

  // スクロール位置の保存と復元（タブの下のスクロールコンテナを対象）
  const scrollContainer = document.getElementById("panel-scroll-container") || document.getElementById("control-panel");
  if (scrollContainer) {
    const savedScroll = localStorage.getItem("controlPanelScrollY");
    if (savedScroll !== null) {
      setTimeout(() => {
        scrollContainer.scrollTop = parseInt(savedScroll, 10);
      }, 150); 
    }

    scrollContainer.addEventListener("scroll", () => {
      localStorage.setItem("controlPanelScrollY", scrollContainer.scrollTop);
    });
  }

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
