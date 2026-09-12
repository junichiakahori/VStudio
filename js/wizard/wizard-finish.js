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
      if (openerWin && openerWin.console && typeof openerWin.console.log === "function") {
        openerWin.console.log("[Wizard] 🚀 「配信準備完了」ボタンがクリックされました！");
      }

      try {
        if (openerWin && !openerWin.closed) {
          const titleVal = document.getElementById("wizard-suggested-title")?.value || document.getElementById("wizard-yt-title")?.value || "";
          const descVal = document.getElementById("wizard-suggested-desc")?.value || document.getElementById("wizard-yt-desc")?.value || "";
          const currentHour = new Date().getHours();
          const autoSlot = (currentHour >= 4 && currentHour < 12) ? "morning" : "evening";
          const wizardActiveSlot = window.wizardActiveSlot || autoSlot;


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
          let startTimeVal = (typeof window.getWizardScheduledStartTime === "function")
            ? window.getWizardScheduledStartTime()
            : (document.getElementById("wizard-start-time")?.value || "");
          try {
            localStorage.setItem("savedWizardStartScheduleToggle", String(startToggleVal));
            if (openerWin && openerWin.localStorage) {
              openerWin.localStorage.setItem("savedWizardStartScheduleToggle", String(startToggleVal));
            }
          } catch (e) {}
          const endToggleVal = document.getElementById("wizard-auto-end-toggle")?.checked || false;
          const endTypeVal = document.getElementById("wizard-end-type-select")?.value || "time";
          const endTimeVal = document.getElementById("wizard-end-time")?.value || "";

          const mainStartToggle = openerWin.document.getElementById("local-schedule-toggle");
          const mainStartTime = openerWin.document.getElementById("local-schedule-time");
          const mainEndToggle = openerWin.document.getElementById("stream-end-toggle");
          const mainEndType = openerWin.document.getElementById("main-stream-end-mode");
          const mainEndTime = openerWin.document.getElementById("stream-end-time");

          // 📅 過去時刻判定（指定日時を既に過ぎている場合は直ちに開始）
          let isPastScheduledTime = false;
          if (startToggleVal && startTimeVal) {
            try {
              let targetDate = null;
              if (startTimeVal.includes("T")) {
                targetDate = new Date(startTimeVal);
              } else if (startTimeVal.includes(":")) {
                const [h, m] = startTimeVal.split(":").map(Number);
                targetDate = new Date();
                targetDate.setHours(h, m, 0, 0);
              }
              if (targetDate && !isNaN(targetDate.getTime()) && Date.now() >= targetDate.getTime()) {
                isPastScheduledTime = true;
              }
            } catch (e) {}
          }

          const shouldStartImmediately = !startToggleVal || isPastScheduledTime;

          // 🛡️ 先に時刻を親画面へ確実に反映させてからトグルを発火（未設定でのタイマースキップ事故を恒久防止）
          if (mainStartTime && startTimeVal) {
            mainStartTime.value = startTimeVal;
            try { mainStartTime.dispatchEvent(new openerWin.Event("change")); } catch (e) {}
          }
          if (mainStartToggle) {
            // 即時開始時はスケジュール監視による多重キックを防ぐためOFF、未来時刻待機時のみON
            mainStartToggle.checked = shouldStartImmediately ? false : startToggleVal;
            try { mainStartToggle.dispatchEvent(new openerWin.Event("change")); } catch (e) {}
          }
          if (mainEndToggle) {
            mainEndToggle.checked = endToggleVal;
            try { mainEndToggle.dispatchEvent(new openerWin.Event("change")); } catch (e) {}
          }
          if (mainEndType) mainEndType.value = endTypeVal;
          if (mainEndTime && endTimeVal) mainEndTime.value = endTimeVal;

          // 3.5 配信準備中解除までの待機秒数
          const waitVal = document.getElementById("wizard-prepare-wait")?.value || "10";
          try {
            openerWin.localStorage.setItem("savedPrepareWaitSec", waitVal);
            const mainNewsWait = openerWin.document.getElementById("news-prepare-wait");
            if (mainNewsWait) {
              mainNewsWait.value = waitVal;
              mainNewsWait.dispatchEvent(new openerWin.Event("input"));
            }
          } catch (e) {}

          // 4. OBS配信自動開始
          const obsStreamToggleVal = document.getElementById("wizard-obs-stream-toggle")?.checked ?? false;
          try {
            localStorage.setItem("savedObsStreamAutoStart", obsStreamToggleVal ? "true" : "false");
            if (openerWin.localStorage) {
              openerWin.localStorage.setItem("savedObsStreamAutoStart", obsStreamToggleVal ? "true" : "false");
            }
            openerWin.isObsStreamAutoStart = obsStreamToggleVal;
          } catch (e) {}

          const mainObsToggle = openerWin.document.getElementById("news-obs-auto-stream-toggle") || openerWin.document.getElementById("obs-auto-start-toggle");
          if (mainObsToggle) {
            mainObsToggle.checked = obsStreamToggleVal;
            try { mainObsToggle.dispatchEvent(new openerWin.Event("change")); } catch (e) {}
          }

          const applyMsg = `[Wizard] 🚀 親ウィンドウに設定を適用完了 (モード: ${selectedMode}, OBS自動開始: ${obsStreamToggleVal}, 予約ON: ${startToggleVal}, 過去時刻判定: ${isPastScheduledTime})`;
          console.log(applyMsg);
          if (openerWin.console && typeof openerWin.console.log === "function") {
            openerWin.console.log(applyMsg);
          }

          // 🚀 配信開始の実行 (親画面にアクションを直接指示)
          if (shouldStartImmediately) {
            if (selectedMode === "news") {
              const startMsg = "[Wizard] 🚀 親ウィンドウにてニュース番組を即時開始します";
              console.log(startMsg);
              if (openerWin.console && typeof openerWin.console.log === "function") openerWin.console.log(startMsg);
              if (typeof openerWin.startNewsBroadcast === "function") {
                openerWin.startNewsBroadcast(0);
              } else {
                const newsStartBtn = openerWin.document.getElementById("news-broadcast-start-btn");
                if (newsStartBtn) newsStartBtn.click();
              }
            } else if (selectedMode === "radio") {
              const startMsg = "[Wizard] 🚀 親ウィンドウにてラジオ番組を即時開始します";
              console.log(startMsg);
              if (openerWin.console && typeof openerWin.console.log === "function") openerWin.console.log(startMsg);
              if (typeof openerWin.startRadioBroadcast === "function") {
                openerWin.startRadioBroadcast();
              } else {
                const radioStartBtn = openerWin.document.getElementById("radio-broadcast-start-btn") || openerWin.document.getElementById("radio-script-play-btn");
                if (radioStartBtn) radioStartBtn.click();
              }
            }
          } else {
            // ⏳ 未来の開始時刻まで待機: 配信開始前は親ウィンドウを「配信準備中」にして待機
            const waitMsg = "[Wizard] ⏳ 予約開始時刻まで待機します。親画面を「配信準備中」オーバーレイ状態に設定しました。";
            console.log(waitMsg);
            if (openerWin.console && typeof openerWin.console.log === "function") openerWin.console.log(waitMsg);
            if (typeof openerWin.setOverlayPreparing === "function") {
              openerWin.setOverlayPreparing();
            } else {
              const prepBtn = openerWin.document.getElementById("overlay-prep-btn");
              if (prepBtn) {
                prepBtn.click();
              } else {
                const streamOverlay = openerWin.document.getElementById("stream-overlay");
                if (streamOverlay) {
                  streamOverlay.textContent = "配信準備中";
                  streamOverlay.classList.add("active");
                }
                openerWin.isPreparing = true;
              }
            }
          }
          openerWin.focus();
        }

        const startToggleVal = document.getElementById("wizard-start-schedule-toggle")?.checked || false;
        const startTimeVal = document.getElementById("wizard-start-time")?.value || "";

        let isPastTime = false;
        if (startToggleVal && startTimeVal) {
          try {
            let targetDate = null;
            if (startTimeVal.includes("T")) {
              targetDate = new Date(startTimeVal);
            } else if (startTimeVal.includes(":")) {
              const [h, m] = startTimeVal.split(":").map(Number);
              targetDate = new Date();
              targetDate.setHours(h, m, 0, 0);
            }
            if (targetDate && !isNaN(targetDate.getTime()) && Date.now() >= targetDate.getTime()) {
              isPastTime = true;
            }
          } catch (e) {}
        }

        if (startToggleVal && startTimeVal && !isPastTime) {
          let displayTime = startTimeVal;
          try {
            const d = new Date(startTimeVal);
            if (!isNaN(d.getTime())) {
              displayTime = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            }
          } catch (e) {}
          if (openerWin && typeof openerWin.showNotification === "function") {
            openerWin.showNotification(`⏰ 配信予約完了！開始時刻まで「配信準備中」で待機し、定刻（${displayTime}）に自動開始します`);
          }
        } else if (isPastTime) {
          if (openerWin && typeof openerWin.showNotification === "function") {
            openerWin.showNotification("🚀 予定時刻を過ぎているため、直ちに配信を開始します！");
          }
        } else {
          if (openerWin && typeof openerWin.showNotification === "function") {
            openerWin.showNotification("🚀 配信準備完了！設定が適用されました");
          }
        }
        setTimeout(() => {
          try { window.close(); } catch(e) {}
        }, 120);
      } catch (finishErr) {
        console.error("[Wizard Finish Error]", finishErr);
        if (openerWin && typeof openerWin.showNotification === "function") {
          openerWin.showNotification("🚀 配信設定を適用しました");
        }
        setTimeout(() => {
          try { window.close(); } catch(e) {}
        }, 120);
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
