(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("screen-overlay", () => {
  // =====================================================================
  // 画面オーバーレイ (配信準備中 / 離席中 / 配信終了)
  // =====================================================================
  window.overlayPrepBtn = document.getElementById("overlay-prep-btn");
  window.overlayAfkBtn = document.getElementById("overlay-afk-btn");
  window.overlayEndBtn = document.getElementById("overlay-end-btn");
  window.overlayClearBtn = document.getElementById("overlay-clear-btn");
  window.streamOverlay = document.getElementById("stream-overlay");
  window.isPreparing = false;
  window.isStreamEndedState = false;
  window.wasBgmPlayingBeforeOverlay = false;

  if (overlayPrepBtn && streamOverlay) {
    overlayPrepBtn.addEventListener("click", () => {
      streamOverlay.textContent = "配信準備中";
      streamOverlay.classList.add("active");
      isPreparing = true;

      // 配信準備中も独り言を止めるためにキューとタイマーをクリア
      if (typeof voicevoxAudioQueue !== "undefined") {
        voicevoxAudioQueue.length = 0;
      }
      if (typeof clearIdleTimer === "function") {
        clearIdleTimer();
      }

      // BGMの滑らかなフェードアウト停止処理
      wasBgmPlayingBeforeOverlay = (typeof bgmIsPlaying !== "undefined" ? bgmIsPlaying : false);
      if (wasBgmPlayingBeforeOverlay && typeof fadeOutBgm === "function") {
        fadeOutBgm(1800);
      } else if (wasBgmPlayingBeforeOverlay && typeof stopBgm === "function") {
        stopBgm();
      }
    });
  }
  if (overlayAfkBtn && streamOverlay) {
    overlayAfkBtn.addEventListener("click", () => {
      streamOverlay.textContent = "離席中";
      streamOverlay.classList.add("active");
    });
  }
  if (overlayEndBtn && streamOverlay) {
    overlayEndBtn.addEventListener("click", () => {
      streamOverlay.textContent = "配信終了";
      streamOverlay.classList.add("active");
      isStreamEndedState = true;

      // 配信終了時には、残っている読み上げキューをクリアして即座に黙るようにする
      if (typeof voicevoxAudioQueue !== "undefined") {
        voicevoxAudioQueue.length = 0;
      }
      if (typeof clearIdleTimer === "function") {
        clearIdleTimer();
      }
      if (typeof chatQueue !== "undefined") {
        chatQueue.length = 0;
      }

      // 手動で終了ボタンを押した場合のみBGMを停止（自動終了プロセス中は20秒待機後にBGMを停止するため維持）
      if (!window.isStreamEndProcessRunning) {
        wasBgmPlayingBeforeOverlay = (typeof bgmIsPlaying !== "undefined" ? bgmIsPlaying : false);
        if (wasBgmPlayingBeforeOverlay && typeof fadeOutBgm === "function") {
          fadeOutBgm(2000);
        } else if (wasBgmPlayingBeforeOverlay && typeof stopBgm === "function") {
          stopBgm();
        }
      }

      // API自動終了中ではない手動操作の場合、コメント取得も即座に切断する
      if (!window.isStreamEndProcessRunning) {
        if (
          typeof isYoutubeIntendedConnect !== "undefined" &&
          isYoutubeIntendedConnect
        ) {
          window.ytBtn = document.getElementById("youtube-connect-btn");
          if (ytBtn) ytBtn.click();
        }
        if (
          typeof isTiktokIntendedConnect !== "undefined" &&
          isTiktokIntendedConnect
        ) {
          window.ttBtn = document.getElementById("tiktok-connect-btn");
          if (ttBtn) ttBtn.click();
        }
      }
    });
  }
  window.executeOverlayClearProcess = function () {
    if (!streamOverlay) return;
    streamOverlay.classList.remove("active");

    // BGMの滑らかなフェードイン再開処理 (準備中 or 終了画面から戻ったときのみ)
    if ((isPreparing || isStreamEndedState) && wasBgmPlayingBeforeOverlay) {
      if (typeof fadeInBgm === "function") {
        fadeInBgm(2000);
      } else {
        window.playBtn = document.getElementById("bgm-play-btn");
        if (playBtn && !bgmIsPlaying) playBtn.click();
      }
      wasBgmPlayingBeforeOverlay = false;
    }

    isStreamEndedState = false;
    window.isStreamEndProcessRunning = false;

    // 配信準備中を解除したときに挨拶
    if (isPreparing) {
      isPreparing = false;
      if (typeof isVoicevoxEnabled !== "undefined" && isVoicevoxEnabled) {
        window.startTextEl = document.getElementById("stream-start-text");
        const startText = startTextEl
          ? startTextEl.value
          : "配信を開始しました！皆さんよろしくお願いします！";
        if (typeof queueVoicevoxAudio === "function") {
          queueVoicevoxAudio(startText, false).catch((e) => console.warn(e));
        }
      }
    } else {
      // 配信終了状態からの解除などの場合は、独り言タイマーを即座に再開する
      if (typeof resetIdleTimer === "function") resetIdleTimer();
    }
  };

  if (overlayClearBtn && streamOverlay) {
    overlayClearBtn.addEventListener("click", () => {
      window.executeOverlayClearProcess();
    });
  }

  // 統計情報の表示機能
  window.statsToggle = document.getElementById("stats-toggle");
  window.streamStats = document.getElementById("stream-stats");
  window.statsSettingsContainer = document.getElementById(
    "stats-settings-container",
  );
  window.statsPosX = document.getElementById("stats-pos-x");
  window.statsPosY = document.getElementById("stats-pos-y");
  window.statsXVal = document.getElementById("stats-x-val");
  window.statsYVal = document.getElementById("stats-y-val");

  if (statsToggle && streamStats) {
    const savedStatsToggle = localStorage.getItem("savedStatsToggle");
    if (savedStatsToggle !== null) {
      statsToggle.checked = savedStatsToggle === "true";
    }
    streamStats.style.display = statsToggle.checked ? "flex" : "none";
    if (statsSettingsContainer) {
      statsSettingsContainer.style.display = statsToggle.checked
        ? "flex"
        : "none";
    }

    statsToggle.addEventListener("change", () => {
      streamStats.style.display = statsToggle.checked ? "flex" : "none";
      if (statsSettingsContainer) {
        statsSettingsContainer.style.display = statsToggle.checked
          ? "flex"
          : "none";
      }
      localStorage.setItem("savedStatsToggle", statsToggle.checked);
    });


  }

  // コメントビューアーの表示機能
  window.commentViewerToggle = document.getElementById("comment-viewer-toggle");
  window.commentSettingsContainer = document.getElementById(
    "comment-settings-container",
  );
  window.commentPosX = document.getElementById("comment-pos-x");
  window.commentPosY = document.getElementById("comment-pos-y");
  window.commentXVal = document.getElementById("comment-x-val");
  window.commentYVal = document.getElementById("comment-y-val");
  window.commentViewerWrap = document.getElementById("comment-viewer");

  if (commentViewerToggle && commentViewerWrap) {
    // ... (This logic actually should wrap the existing comment viewer, let's keep it clean)
    const savedCommentToggle = localStorage.getItem("savedCommentToggle");
    if (savedCommentToggle !== null) {
      commentViewerToggle.checked = savedCommentToggle === "true";
    }
    commentViewerWrap.style.display = commentViewerToggle.checked
      ? "block"
      : "none";
    if (commentSettingsContainer) {
      commentSettingsContainer.style.display = commentViewerToggle.checked
        ? "flex"
        : "none";
    }

    commentViewerToggle.addEventListener("change", () => {
      commentViewerWrap.style.display = commentViewerToggle.checked
        ? "block"
        : "none";
      if (commentSettingsContainer) {
        commentSettingsContainer.style.display = commentViewerToggle.checked
          ? "flex"
          : "none";
      }
      localStorage.setItem("savedCommentToggle", commentViewerToggle.checked);
    });

    // コメントビューアーの高さ調整
    const heightSlider = document.getElementById("comment-viewer-height-slider");
    const heightValSpan = document.getElementById("comment-viewer-height-val");
    const savedHeight = localStorage.getItem("commentViewerMaxHeight") || "260";

    const applyCommentHeight = (h) => {
      commentViewerWrap.style.maxHeight = `${h}px`;
      if (heightSlider) heightSlider.value = h;
      if (heightValSpan) heightValSpan.textContent = h;
      localStorage.setItem("commentViewerMaxHeight", h);
    };

    applyCommentHeight(savedHeight);

    if (heightSlider) {
      heightSlider.addEventListener("input", (e) => {
        applyCommentHeight(e.target.value);
      });
    }


  }

  // 時計の表示機能
  window.clockToggle = document.getElementById("clock-toggle");
  window.clockSettingsContainer = document.getElementById(
    "clock-settings-container",
  );
  window.clockPosX = document.getElementById("clock-pos-x");
  window.clockPosY = document.getElementById("clock-pos-y");
  window.clockXVal = document.getElementById("clock-x-val");
  window.clockYVal = document.getElementById("clock-y-val");
  window.clockStyleSelect = document.getElementById("clock-style");
  window.streamClock = document.getElementById("stream-clock");
  window.clockInterval = null;

  if (clockToggle && streamClock) {
    window.days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    window.hasAnnouncedEnd = false;
    window.streamEndTimeInput = document.getElementById("stream-end-time");
    window.streamEndToggle = document.getElementById("stream-end-toggle");

    // Restore saved stream end time
    const savedEndTime = localStorage.getItem("savedStreamEndTime");
    if (savedEndTime && streamEndTimeInput) {
      streamEndTimeInput.value = savedEndTime;
    }

    // Restore saved toggle state
    window.streamEndSettingsContainer = document.getElementById(
      "stream-end-settings-container",
    );
    if (streamEndToggle) {
      const savedEndToggle = localStorage.getItem("savedStreamEndToggle");
      if (savedEndToggle !== null) {
        streamEndToggle.checked = savedEndToggle === "true";
      }
      // 常時表示のため、display 切り替え処理を削除
      streamEndToggle.addEventListener("change", () => {
        localStorage.setItem("savedStreamEndToggle", streamEndToggle.checked);
      });
    }

    // Restore saved text and wait time
    window.streamEndTextInput = document.getElementById("stream-end-text");
    window.streamEndWaitInput = document.getElementById("stream-end-wait");
    window.streamEndWaitVal = document.getElementById("stream-end-wait-val");

    if (streamEndTextInput) {
      const savedText = localStorage.getItem("savedStreamEndText");
      if (savedText) streamEndTextInput.value = savedText;
      streamEndTextInput.addEventListener("change", () => {
        localStorage.setItem("savedStreamEndText", streamEndTextInput.value);
      });
    }

    if (streamEndWaitInput) {
      const savedWait = localStorage.getItem("savedStreamEndWait");
      if (savedWait) {
        streamEndWaitInput.value = savedWait;
        if (streamEndWaitVal) streamEndWaitVal.textContent = savedWait;
      }
      streamEndWaitInput.addEventListener("input", () => {
        if (streamEndWaitVal)
          streamEndWaitVal.textContent = streamEndWaitInput.value;
        localStorage.setItem("savedStreamEndWait", streamEndWaitInput.value);
      });
    }

    if (streamEndTimeInput) {
      streamEndTimeInput.addEventListener("change", () => {
        localStorage.setItem("savedStreamEndTime", streamEndTimeInput.value);
        hasAnnouncedEnd = false; // Reset if time changed
      });
    }

    const savedClock = localStorage.getItem("savedClockToggle");
    if (savedClock !== null) clockToggle.checked = savedClock === "true";



    const savedStyle = localStorage.getItem("savedClockStyle");
    if (savedStyle && clockStyleSelect) clockStyleSelect.value = savedStyle;

    const applyClockState = () => {
      if (clockToggle.checked) {
        streamClock.style.display = "flex";
        if (clockSettingsContainer)
          clockSettingsContainer.style.display = "flex";

        // 位置とスタイルを更新
        streamClock.className = "stream-clock";
        if (clockStyleSelect)
          streamClock.classList.add(`style-${clockStyleSelect.value}`);

        if (clockPosX && clockPosY) {
          // X座標に応じてテキストのアライメントを変更 (左寄りなら左揃え、右寄りなら右揃え)
          // Since sliders are gone, we just default to center or use draggable position heuristics later.
          streamClock.style.alignItems = "center";
        }
        updateClock();
        if (!clockInterval) clockInterval = setInterval(updateClock, 1000);
      } else {
        streamClock.style.display = "none";
        if (clockSettingsContainer)
          clockSettingsContainer.style.display = "none";
        if (clockInterval) {
          clearInterval(clockInterval);
          clockInterval = null;
        }
      }
    };

    applyClockState();

    clockToggle.addEventListener("change", () => {
      localStorage.setItem("savedClockToggle", clockToggle.checked);
      applyClockState();
    });



    if (clockStyleSelect) {
      clockStyleSelect.addEventListener("change", () => {
        localStorage.setItem("savedClockStyle", clockStyleSelect.value);
        applyClockState();
      });
    }
  }
});
