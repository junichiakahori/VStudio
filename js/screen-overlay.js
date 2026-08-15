window.addEventListener("uiLoaded", () => {
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

      // BGMの停止処理
      wasBgmPlayingBeforeOverlay = bgmIsPlaying;
      if (bgmIsPlaying && typeof stopBgm === "function") {
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

      // BGMの停止処理
      wasBgmPlayingBeforeOverlay = bgmIsPlaying;
      if (bgmIsPlaying && typeof stopBgm === "function") {
        stopBgm();
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

    // BGMの再開処理 (準備中 or 終了画面から戻ったときのみ)
    if ((isPreparing || isStreamEndedState) && wasBgmPlayingBeforeOverlay) {
      window.playBtn = document.getElementById("bgm-play-btn");
      if (playBtn && !bgmIsPlaying) {
        playBtn.click();
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

    // 座標保存
    const savedStatsX = localStorage.getItem("savedStatsX");
    const savedStatsY = localStorage.getItem("savedStatsY");

    // 元のCSS設定をリセット
    streamStats.style.right = "auto";

    if (savedStatsX && statsPosX) {
      statsPosX.value = savedStatsX;
      if (statsXVal) statsXVal.textContent = savedStatsX;
      streamStats.style.left = `${savedStatsX}%`;
      streamStats.style.transform = "translate(-50%, -50%)";
    } else {
      // 初期値
      streamStats.style.left = `95%`;
      streamStats.style.transform = "translate(-50%, -50%)";
    }
    if (savedStatsY && statsPosY) {
      statsPosY.value = savedStatsY;
      if (statsYVal) statsYVal.textContent = savedStatsY;
      streamStats.style.top = `${savedStatsY}%`;
    } else {
      // 初期値
      streamStats.style.top = `15%`;
    }

    if (statsPosX && statsPosY) {
      statsPosX.addEventListener("input", () => {
        streamStats.style.left = `${statsPosX.value}%`;
        streamStats.style.transform = "translate(-50%, -50%)";
        if (statsXVal) statsXVal.textContent = statsPosX.value;
        localStorage.setItem("savedStatsX", statsPosX.value);
      });
      statsPosY.addEventListener("input", () => {
        streamStats.style.top = `${statsPosY.value}%`;
        if (statsYVal) statsYVal.textContent = statsPosY.value;
        localStorage.setItem("savedStatsY", statsPosY.value);
      });
    }
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

    // 座標保存
    const savedCommentX = localStorage.getItem("savedCommentX");
    const savedCommentY = localStorage.getItem("savedCommentY");

    // CSSを絶対配置に変更して元のボトム設定をリセット
    commentViewerWrap.style.position = "absolute";
    commentViewerWrap.style.bottom = "auto";

    if (savedCommentX && commentPosX) {
      commentPosX.value = savedCommentX;
      if (commentXVal) commentXVal.textContent = savedCommentX;
      commentViewerWrap.style.left = `${savedCommentX}%`;
      commentViewerWrap.style.transform = "translate(-50%, -50%)";
    } else {
      // 初期値
      commentViewerWrap.style.left = `95%`;
      commentViewerWrap.style.transform = "translate(-50%, -50%)";
    }
    if (savedCommentY && commentPosY) {
      commentPosY.value = savedCommentY;
      if (commentYVal) commentYVal.textContent = savedCommentY;
      commentViewerWrap.style.top = `${savedCommentY}%`;
    } else {
      // 初期値
      commentViewerWrap.style.top = `30%`;
    }

    if (commentPosX && commentPosY) {
      commentPosX.addEventListener("input", () => {
        commentViewerWrap.style.left = `${commentPosX.value}%`;
        commentViewerWrap.style.transform = "translate(-50%, -50%)";
        if (commentXVal) commentXVal.textContent = commentPosX.value;
        localStorage.setItem("savedCommentX", commentPosX.value);
      });
      commentPosY.addEventListener("input", () => {
        commentViewerWrap.style.top = `${commentPosY.value}%`;
        if (commentYVal) commentYVal.textContent = commentPosY.value;
        localStorage.setItem("savedCommentY", commentPosY.value);
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

    const savedPosX = localStorage.getItem("savedClockPosX");
    if (savedPosX !== null && clockPosX) {
      clockPosX.value = savedPosX;
      if (clockXVal) clockXVal.textContent = savedPosX;
    }

    const savedPosY = localStorage.getItem("savedClockPosY");
    if (savedPosY !== null && clockPosY) {
      clockPosY.value = savedPosY;
      if (clockYVal) clockYVal.textContent = savedPosY;
    }

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
          const x = clockPosX.value;
          const y = clockPosY.value;
          streamClock.style.left = `${x}%`;
          streamClock.style.top = `${y}%`;
          streamClock.style.transform = `translate(-${x}%, -${y}%)`;

          // X座標に応じてテキストのアライメントを変更 (左寄りなら左揃え、右寄りなら右揃え)
          if (x < 33) streamClock.style.alignItems = "flex-start";
          else if (x > 66) streamClock.style.alignItems = "flex-end";
          else streamClock.style.alignItems = "center";
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

    if (clockPosX) {
      clockPosX.addEventListener("input", () => {
        if (clockXVal) clockXVal.textContent = clockPosX.value;
        applyClockState();
      });
      clockPosX.addEventListener("change", () => {
        localStorage.setItem("savedClockPosX", clockPosX.value);
      });
    }

    if (clockPosY) {
      clockPosY.addEventListener("input", () => {
        if (clockYVal) clockYVal.textContent = clockPosY.value;
        applyClockState();
      });
      clockPosY.addEventListener("change", () => {
        localStorage.setItem("savedClockPosY", clockPosY.value);
      });
    }

    if (clockStyleSelect) {
      clockStyleSelect.addEventListener("change", () => {
        localStorage.setItem("savedClockStyle", clockStyleSelect.value);
        applyClockState();
      });
    }
  }
});
