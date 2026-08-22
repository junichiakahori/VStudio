window.addEventListener("uiLoaded", () => {
  if (window.__autoSaveUIInitialized) return;
  window.__autoSaveUIInitialized = true;

  // =========================================================================
  // 汎用UI状態の自動保存・復元機能 (すべてのUI要素を網羅)
  // =========================================================================
  function initAutoSaveUI() {
    const STORAGE_KEY = "live2d_studio_auto_ui_state";
    let savedState = {};
    try {
      savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {}

    const elements = document.querySelectorAll(
      'input[type="checkbox"], input[type="range"], input[type="text"], input[type="number"], input[type="password"], input[type="time"], select, textarea',
    );

    elements.forEach((el) => {
      if (!el.id) return;
      if (el.type === "file") return;

      // 復元処理
      if (savedState[el.id] !== undefined) {
        if (el.type === "checkbox") {
          el.checked = savedState[el.id];
        } else {
          el.value = savedState[el.id];
        }

        // プログラムから値を変更したことを通知し、関連するイベントを発火させる
        setTimeout(() => {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, 50);
      }

      // 保存処理の追加
      const saveHandler = (e) => {
        const target = e.target;
        const val = target.type === "checkbox" ? target.checked : target.value;
        savedState[target.id] = val;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
      };

      el.addEventListener("change", saveHandler);
      if (
        el.type === "range" ||
        el.type === "text" ||
        el.type === "number" ||
        el.type === "password" ||
        el.tagName.toLowerCase() === "textarea"
      ) {
        el.addEventListener("input", saveHandler);
      }
    });

    // =====================================================================
    // リロード時の自動接続 (サイレント実行)
    // =====================================================================
    setTimeout(() => {
      const shouldAutoConnect =
        localStorage.getItem("obsWsAutoConnect") === "true";

      if (shouldAutoConnect && typeof window.toggleObsWsConnection === "function") {
        const obsStatus = document.getElementById("obs-ws-status");
        if (obsStatus && obsStatus.textContent === "接続済み") return;
        window.toggleObsWsConnection(true); // silent
      }
    }, 500);
  }

  initAutoSaveUI();
});
