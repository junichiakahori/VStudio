// =====================================================================
// wizard-finish.js: ウィザード完了処理・親画面同期・配信開始キック
// =====================================================================

(function() {
  function initWizardFinishHandler() {
    const finishBtn = document.getElementById("nav-finish-btn");
    if (!finishBtn) return;

    finishBtn.addEventListener("click", () => {
      console.log("[Wizard] 🚀 「配信準備完了」ボタンがクリックされました！");
      const openerWin = window.opener;

      try {
        if (openerWin && !openerWin.closed) {
          const titleVal = document.getElementById("wizard-suggested-title")?.value || document.getElementById("wizard-yt-title")?.value || "";
          const descVal = document.getElementById("wizard-suggested-desc")?.value || document.getElementById("wizard-yt-desc")?.value || "";
          const wizardActiveSlot = window.wizardActiveSlot || "morning";


          const mainTitle = openerWin.document.getElementById("stream-title");
          const mainDesc = openerWin.document.getElementById("stream-description");
          if (mainTitle && titleVal) mainTitle.value = titleVal;
          if (mainDesc && descVal) mainDesc.value = descVal;

          openerWin.activeStreamSlot = wizardActiveSlot;
          try {
            openerWin.localStorage.setItem(`savedStreamTitle_${wizardActiveSlot}`, titleVal);
            openerWin.localStorage.setItem(`savedStreamDesc_${wizardActiveSlot}`, descVal);
            openerWin.localStorage.setItem("savedStreamTitle", titleVal);
            openerWin.localStorage.setItem("savedStreamDesc", descVal);
            openerWin.localStorage.setItem("savedStreamSlot", wizardActiveSlot);
          } catch(storageErr) {}

          // メイン画面側のスロットボタンスタイルも同期
          const mainMorningBtn = openerWin.document.getElementById("stream-slot-morning-btn");
          const mainEveningBtn = openerWin.document.getElementById("stream-slot-evening-btn");
          if (mainMorningBtn && mainEveningBtn) {
            if (wizardActiveSlot === "morning") {
              mainMorningBtn.style.background = "rgba(255,180,0,0.25)";
              mainMorningBtn.style.borderColor = "#ffb400";
              mainMorningBtn.style.color = "#ffb400";
              mainEveningBtn.style.background = "rgba(255,255,255,0.05)";
              mainEveningBtn.style.borderColor = "rgba(255,255,255,0.15)";
              mainEveningBtn.style.color = "var(--text-muted)";
            } else {
              mainMorningBtn.style.background = "rgba(255,255,255,0.05)";
              mainMorningBtn.style.borderColor = "rgba(255,255,255,0.15)";
              mainMorningBtn.style.color = "var(--text-muted)";
              mainEveningBtn.style.background = "rgba(108,92,231,0.25)";
              mainEveningBtn.style.borderColor = "#a29bfe";
              mainEveningBtn.style.color = "#a29bfe";
            }
          }

          // 1. YouTube枠IDの適用とコメントサーバー接続
          const ytVal = document.getElementById("wizard-yt-input")?.value?.trim() || "";
          const mainYt = openerWin.document.getElementById("youtube-video-input");
          if (mainYt && ytVal) {
            mainYt.value = ytVal;
            openerWin.localStorage.setItem("savedYoutubeVideoId", ytVal);
          }

          // 2. 配信モードの適用と開始
          const selectedMode = window.selectedMode || "news";
          if (selectedMode === "chat") {
            const chatTab = openerWin.document.querySelector('.tab-btn[data-target="tab-chat"]');
            if (chatTab) chatTab.click();
            openerWin.isChatReadEnabled = true;
            const chatToggle = openerWin.document.getElementById("chat-enable-checkbox");
            if (chatToggle) chatToggle.checked = true;
          } else if (selectedMode === "radio") {
            const radioTab = openerWin.document.querySelector('.tab-btn[data-target="tab-radio"]');
            if (radioTab) radioTab.click();
          } else if (selectedMode === "news") {
            const newsTab = openerWin.document.querySelector('.tab-btn[data-target="tab-news"]');
            if (newsTab) newsTab.click();
          }

          // 3. 予約配信スケジュール設定
          const startToggleVal = document.getElementById("wizard-start-schedule-toggle")?.checked || false;
          const startTimeVal = document.getElementById("wizard-start-time")?.value || "";
          const endToggleVal = document.getElementById("wizard-auto-end-toggle")?.checked || false;
          const endTypeVal = document.getElementById("wizard-end-type-select")?.value || "time";
          const endTimeVal = document.getElementById("wizard-end-time")?.value || "";

          const mainStartToggle = openerWin.document.getElementById("start-schedule-toggle");
          const mainStartTime = openerWin.document.getElementById("start-schedule-time");
          const mainEndToggle = openerWin.document.getElementById("auto-end-toggle");
          const mainEndType = openerWin.document.getElementById("end-type-select");
          const mainEndTime = openerWin.document.getElementById("end-time");

          if (mainStartToggle) mainStartToggle.checked = startToggleVal;
          if (mainStartTime && startTimeVal) mainStartTime.value = startTimeVal;
          if (mainEndToggle) mainEndToggle.checked = endToggleVal;
          if (mainEndType) mainEndType.value = endTypeVal;
          if (mainEndTime && endTimeVal) mainEndTime.value = endTimeVal;

          // 4. OBS配信自動開始
          const obsStreamToggleVal = document.getElementById("wizard-obs-stream-toggle")?.checked || false;
          const mainObsToggle = openerWin.document.getElementById("obs-auto-start-toggle");
          if (mainObsToggle) mainObsToggle.checked = obsStreamToggleVal;

          console.log(`[Wizard] 🚀 親ウィンドウに設定を適用完了 (モード: ${selectedMode}, OBS自動開始: ${obsStreamToggleVal})`);

          // 🚀 配信開始の実行 (親画面にアクションを直接指示)
          if (selectedMode === "news") {
            if (!startToggleVal) {
              console.log("[Wizard] 🚀 親ウィンドウにてニュース番組を即時開始します");
              if (typeof openerWin.startNewsBroadcast === "function") {
                openerWin.startNewsBroadcast(0);
              } else {
                const newsStartBtn = openerWin.document.getElementById("news-broadcast-start-btn");
                if (newsStartBtn) newsStartBtn.click();
              }
            }
          } else if (selectedMode === "radio") {
            if (!startToggleVal) {
              console.log("[Wizard] 🚀 親ウィンドウにてラジオ番組を即時開始します");
              if (typeof openerWin.startRadioBroadcast === "function") {
                openerWin.startRadioBroadcast();
              } else {
                const radioStartBtn = openerWin.document.getElementById("radio-broadcast-start-btn");
                if (radioStartBtn) radioStartBtn.click();
              }
            }
          }
          openerWin.focus();
        }

        const startToggleVal = document.getElementById("wizard-start-schedule-toggle")?.checked || false;
        const startTimeVal = document.getElementById("wizard-start-time")?.value || "";

        if (startToggleVal && startTimeVal) {
          let displayTime = startTimeVal;
          try {
            const d = new Date(startTimeVal);
            if (!isNaN(d.getTime())) {
              displayTime = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            }
          } catch (e) {}
          if (openerWin && typeof openerWin.showNotification === "function") {
            openerWin.showNotification(`⏰ 配信予約完了！指定日時（${displayTime}）に自動開始します`);
          }
        } else {
          if (openerWin && typeof openerWin.showNotification === "function") {
            openerWin.showNotification("🚀 配信準備完了！設定が適用されました");
          }
        }
        window.close();
      } catch (finishErr) {
        console.error("[Wizard Finish Error]", finishErr);
        if (openerWin && typeof openerWin.showNotification === "function") {
          openerWin.showNotification("🚀 配信設定を適用しました");
        }
        window.close();
      }
    });

    window.addEventListener('beforeunload', () => {
      try {
        if (window.opener && window.opener.streamWizardPopup) {
          window.opener.streamWizardPopup = null;
        }
      } catch (e) {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWizardFinishHandler);
  } else {
    initWizardFinishHandler();
  }
})();
