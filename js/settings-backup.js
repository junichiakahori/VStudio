// Settings Backup and Restore Logic (localStorage management)

export function initSettingsBackup() {
  const exportBtn = document.getElementById("export-settings-btn");
  const importBtn = document.getElementById("import-settings-btn");
  const fileInput = document.getElementById("import-settings-file");

  if (!exportBtn || !importBtn || !fileInput) return;

  // Export Settings
  exportBtn.addEventListener("click", () => {
    try {
      const settings = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // キャッシュデータや背景画像(数MBになるためエラーの元)は除外する
        if (key.includes("hiragana_cache") || key.includes("voicevox_cache") || key.includes("news_cache") || key === "savedBackgroundImage") {
          continue;
        }
        settings[key] = localStorage.getItem(key);
      }

      const jsonStr = JSON.stringify(settings, null, 2);
      const filename = `live2d_settings_${new Date().toISOString().split('T')[0]}.json`;

      // If running inside VStudio Native Mac App with native bridge
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeHost) {
        window.webkit.messageHandlers.nativeHost.postMessage({
          action: "saveFile",
          filename: filename,
          content: jsonStr
        });
        return;
      }

      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert("設定ファイルのエクスポートが完了しました。");
    } catch (e) {
      console.error("Export failed:", e);
      alert("エクスポート中にエラーが発生しました。");
    }
  });

  // Import Settings (trigger file picker)
  importBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const settings = JSON.parse(event.target.result);
        if (typeof settings !== "object" || settings === null) {
          throw new Error("Invalid format");
        }

        // インポート前に、容量確保のため現在のブラウザ上の不要なキャッシュを削除する
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.includes("hiragana_cache") || key.includes("voicevox_cache") || key.includes("news_cache"))) {
            localStorage.removeItem(key);
          }
        }

        let importedCount = 0;
        for (const [key, value] of Object.entries(settings)) {
          // 既存のエクスポートファイルからインポートする際のエラー（容量制限）を防ぐため除外
          if (key.includes("hiragana_cache") || key.includes("voicevox_cache") || key.includes("news_cache") || key === "savedBackgroundImage") {
            continue;
          }
          if (typeof value === "string") {
            localStorage.setItem(key, value);
            importedCount++;
          }
        }

        alert(`${importedCount} 件の設定データをインポートしました。画面を再読み込みします。`);
        window.location.reload();
      } catch (err) {
        console.error("Import failed:", err);
        alert(`設定ファイルの読み込みに失敗しました (${err.name}: ${err.message})。容量制限エラーの場合は不要なデータを削除してください。`);
      }
      
      // Reset input so the same file can be selected again
      fileInput.value = "";
    };
    reader.readAsText(file);
  });
}

// Initialize when UI is ready
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("settings-backup", initSettingsBackup);
