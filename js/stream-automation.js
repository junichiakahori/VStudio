const updateClock = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = dayNames[now.getDay()];

  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  streamClock.innerHTML = `
                <div class="clock-date">${year}/${month}/${date} (${day})</div>
                <div class="clock-time">${h}:${m}:${s}</div>
            `;

  // 1. タイマー指定の終了チェック（24時間耐久や日付跨ぎでも正確に動作）
  if (window.streamEndTargetTimestamp && !hasAnnouncedEnd) {
    if (Date.now() >= window.streamEndTargetTimestamp) {
      hasAnnouncedEnd = true;
      const voiceText =
        streamEndTextInput && streamEndTextInput.value
          ? streamEndTextInput.value
          : "予定の配信時間が経過しました。本日の配信はここまでとなります。見に来てくれてありがとうございました！";

      queueVoicevoxAudio(voiceText, false).catch((e) => console.warn(e));

      if (typeof window.executeStreamEndProcess === "function") {
        window.executeStreamEndProcess();
      }
    }
  }

  // 2. 配信終了時刻のチェック（トグルが有効かつ時刻指定時）
  if (
    streamEndToggle &&
    streamEndToggle.checked &&
    streamEndTimeInput &&
    streamEndTimeInput.value &&
    !window.streamEndTargetTimestamp
  ) {
    if (!hasAnnouncedEnd && `${h}:${m}` === streamEndTimeInput.value) {
      hasAnnouncedEnd = true;

      const voiceText =
        streamEndTextInput && streamEndTextInput.value
          ? streamEndTextInput.value
          : "予定の時刻になりました。本日の配信はここまでとなります。見に来てくれてありがとうございました！";

      queueVoicevoxAudio(voiceText, false).catch((e) => console.warn(e));

      // APIで配信終了
      if (typeof window.executeStreamEndProcess === "function") {
        window.executeStreamEndProcess();
      }
    }
    // 翌日など再び時刻がずれたらフラグを戻す
    if (hasAnnouncedEnd && `${h}:${m}` !== streamEndTimeInput.value) {
      hasAnnouncedEnd = false;
    }
  }
};

window.streamEndTargetTimestamp = null;
window.setStreamEndTimer = function (minutes) {
  if (!minutes || minutes <= 0) {
    window.streamEndTargetTimestamp = null;
    return;
  }
  window.streamEndTargetTimestamp = Date.now() + minutes * 60 * 1000;
  console.log(`[タイマー設定] ${minutes}分後 (${new Date(window.streamEndTargetTimestamp).toLocaleTimeString()}) に配信を終了します`);
};
window.clearStreamEndTimer = function () {
  window.streamEndTargetTimestamp = null;
};

window.updateClock = updateClock;
window.executeStreamEndProcess = function () {
  if (window.isStreamEndProcessRunning) return;
  window.isStreamEndProcessRunning = true;

  // 待機時間（秒数）の取得
  const waitInput = document.getElementById("stream-end-wait");
  const waitSec = waitInput ? parseInt(waitInput.value, 10) : 10;

  console.log(`[システム] 配信終了プロセスを開始します（直ちに配信終了画面へ切り替え、余韻: ${waitSec}秒）`);

  window.isStreamEndedState = true;
  if (typeof clearIdleTimer === "function") clearIdleTimer();

  // 自動開始タイマー・自動終了タイマーを確実にOFFにする（次回意図しない自動起動を防止）
  const localSchedToggle = document.getElementById("local-schedule-toggle");
  if (localSchedToggle && localSchedToggle.checked) {
    localSchedToggle.checked = false;
    localSchedToggle.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const autoEndToggle = document.getElementById("stream-end-toggle");
  if (autoEndToggle && autoEndToggle.checked) {
    autoEndToggle.checked = false;
    autoEndToggle.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 1. 直ちに配信終了画面（オーバーレイ）へ切り替え
  const endBtn = document.getElementById("overlay-end-btn");
  if (endBtn) {
    endBtn.click();
  }

  // ニュースボード（テロップ）を非表示
  const newsBoardEl = document.getElementById("news-board");
  if (newsBoardEl) {
    newsBoardEl.classList.remove("active");
  }

  // 配信終了処理に入ったら、未読コメントを破棄してこれ以上読まないようにする
  if (typeof chatQueue !== "undefined") {
    chatQueue.length = 0; // 配列を空にする
    console.log("[システム] コメントキューをクリアしました");
  }

  // 2. 配信終了画面とBGMを流したまま、waitSec 秒間（余韻）待機
  setTimeout(() => {
    console.log("[システム] 配信終了画面の余韻待機時間が完了しました。BGMを停止しインフラを切断します");

    // BGMを停止
    const bgmStopBtn = document.getElementById("bgm-stop-btn");
    if (bgmStopBtn && !bgmStopBtn.disabled) {
      bgmStopBtn.click();
    }

    // BGMやVoicevoxが完全に停止するのを待つポーリング
    const checkInterval = setInterval(() => {
      // voicevoxAudioQueue が空で、かつ isVoicevoxPlaying が false なら完了とみなす
      const voicevoxDone =
        (typeof voicevoxAudioQueue !== "undefined"
          ? voicevoxAudioQueue.length === 0
          : true) &&
        (typeof isVoicevoxPlaying !== "undefined" ? !isVoicevoxPlaying : true);

      // BGMの停止確認
      const bgmDone = typeof bgmIsPlaying !== "undefined" ? !bgmIsPlaying : true;

      if (voicevoxDone && bgmDone) {
        clearInterval(checkInterval);
        console.log(
          "[システム] ボイスとBGMの停止を確認しました。配信インフラを切断します...",
        );

      if (
        typeof youtubeWs !== "undefined" &&
        youtubeWs &&
        youtubeWs.readyState === 1
      ) {
        // WebSocket.OPEN
        console.log("Sending end_youtube_stream command...");
        const videoInput = document.getElementById("youtube-video-input");
        const videoId = videoInput ? videoInput.value.trim() : "";
        youtubeWs.send(
          JSON.stringify({ type: "end_youtube_stream", videoId: videoId }),
        );

        // コメント取得も自動で切断する
        setTimeout(() => {
          console.log("Disconnecting YouTube comment polling...");
          if (
            typeof isYoutubeIntendedConnect !== "undefined" &&
            isYoutubeIntendedConnect
          ) {
            const ytBtn = document.getElementById("youtube-connect-btn");
            if (ytBtn) ytBtn.click();
          }
        }, 1000);
      }

      // TikTokコメント取得も自動で切断する
      if (
        typeof tiktokWs !== "undefined" &&
        tiktokWs &&
        tiktokWs.readyState === 1
      ) {
        setTimeout(() => {
          console.log("Disconnecting TikTok comment polling...");
          if (
            typeof isTiktokIntendedConnect !== "undefined" &&
            isTiktokIntendedConnect
          ) {
            const ttBtn = document.getElementById("tiktok-connect-btn");
            if (ttBtn) ttBtn.click();
          }
        }, 1000);
      }

      if (typeof window.ensureObsStreamingStopped === "function") {
        window.ensureObsStreamingStopped();
      } else if (
        typeof isObsWsConnected !== "undefined" &&
        isObsWsConnected &&
        typeof obsWsClient !== "undefined" &&
        obsWsClient
      ) {
        console.log("Sending StopStream to OBS...");
        obsWsClient.call("StopStream").catch((err) => {
          console.error("Failed to stop OBS stream:", err);
        });
      }
    }
  }, 500); // 0.5秒ごとにチェック
  }, waitSec * 1000);
};

window.executeStreamEndProcess = executeStreamEndProcess;

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("stream-automation", () => {
  window.localScheduleToggle = document.getElementById("local-schedule-toggle");
  window.localScheduleTime = document.getElementById("local-schedule-time");
  window.localScheduleCountdown = document.getElementById(
    "local-schedule-countdown",
  );
  let localScheduleTimerId = null;

  function updateLocalScheduleTimer() {
    if (localScheduleTimerId) clearInterval(localScheduleTimerId);

    const container = document.getElementById("local-schedule-container");
    const statusBadge = document.getElementById("local-schedule-status-badge");
    const toggleText = document.getElementById("local-schedule-toggle-text");

    const isEnabled = Boolean(localScheduleToggle && localScheduleToggle.checked);

    if (toggleText) {
      toggleText.textContent = isEnabled ? "ON" : "OFF";
      toggleText.style.color = isEnabled ? "#00ff66" : "var(--text-muted)";
    }

    if (statusBadge) {
      if (isEnabled) {
        statusBadge.textContent = "🟢 待機中";
        statusBadge.style.background = "rgba(0, 255, 102, 0.18)";
        statusBadge.style.color = "#00ff66";
        statusBadge.style.border = "1px solid rgba(0, 255, 102, 0.4)";
      } else {
        statusBadge.textContent = "⚪ 停止中";
        statusBadge.style.background = "rgba(255, 255, 255, 0.08)";
        statusBadge.style.color = "#888";
        statusBadge.style.border = "1px solid rgba(255, 255, 255, 0.15)";
      }
    }

    if (container) {
      if (isEnabled) {
        container.style.background = "rgba(0, 255, 255, 0.08)";
        container.style.border = "1px solid rgba(0, 255, 255, 0.5)";
        container.style.boxShadow = "0 0 10px rgba(0, 255, 255, 0.15)";
      } else {
        container.style.background = "rgba(255, 255, 255, 0.02)";
        container.style.border = "1px solid rgba(255, 255, 255, 0.12)";
        container.style.boxShadow = "none";
      }
    }

    if (localScheduleCountdown) {
      localScheduleCountdown.style.color = isEnabled ? "#00ff66" : "#666";
    }

    if (
      isEnabled &&
      localScheduleTime &&
      localScheduleTime.value
    ) {
      let targetTime;
      if (localScheduleTime.value.includes("T")) {
        targetTime = new Date(localScheduleTime.value);
      } else {
        const [hours, minutes] = localScheduleTime.value.split(":").map(Number);
        targetTime = new Date();
        targetTime.setHours(hours, minutes, 0, 0);
      }

      const nowSetup = new Date();
      const pastDiffMs = nowSetup.getTime() - targetTime.getTime();

      // 既に指定日時を過ぎている場合は、何分過ぎていても直ちに配信を開始する！
      if (pastDiffMs > 0) {
        console.log("[Local Schedule] 指定日時を既に過ぎているため、直ちに配信を開始します！");
        if (localScheduleCountdown) localScheduleCountdown.textContent = "00:00:00";
        if (statusBadge) {
          statusBadge.textContent = "🟢 開始中";
          statusBadge.style.background = "rgba(0, 255, 102, 0.18)";
          statusBadge.style.color = "#00ff66";
        }
        
        // 配信開始プロセスを直ちに実行
        setTimeout(() => {
          if (typeof window.ensureObsStreamingStarted === "function") {
            window.ensureObsStreamingStarted().catch((e) => console.warn(e));
          }
          if (typeof window.executeOverlayClearProcess === "function") {
            window.executeOverlayClearProcess();
          }
          const prepToggle = document.getElementById("preparing-mode-toggle");
          if (prepToggle && prepToggle.checked) {
            prepToggle.checked = false;
            prepToggle.dispatchEvent(new Event("change"));
          }
          window.bgmPlayBtn = document.getElementById("bgm-play-btn");
          if (bgmPlayBtn && typeof window.bgmBuffer !== "undefined" && window.bgmBuffer) {
            bgmPlayBtn.click();
          }
          setTimeout(() => {
            const mode = window.currentBroadcastMode || "news";
            if (mode === "news") {
              if (typeof window.startNewsBroadcast === "function") window.startNewsBroadcast();
            } else if (mode === "radio") {
              const radioBtn = document.getElementById("radio-script-play-btn");
              if (radioBtn) radioBtn.click();
            } else {
              const startVoice = "定刻を過ぎておりますので、本日の配信を直ちにスタートします！";
              if (typeof window.queueVoicevoxAudio === "function") {
                window.queueVoicevoxAudio(startVoice, true).catch((e) => console.warn(e));
              }
            }
          }, 600);
        }, 300);
        return;
      }

      localScheduleTimerId = setInterval(() => {
        const now = new Date();
        const diff = targetTime.getTime() - now.getTime();

        if (diff <= 0) {
          clearInterval(localScheduleTimerId);
          if (localScheduleCountdown)
            localScheduleCountdown.textContent = "00:00:00";

          console.log(
            "[Local Schedule] 指定時刻になりました。OBS配信と番組を自動開始します。",
          );

          // 自動開始タイマーが発火したら直ちにOFFにする
          if (localScheduleToggle && localScheduleToggle.checked) {
            localScheduleToggle.checked = false;
            localScheduleToggle.dispatchEvent(new Event("change", { bubbles: true }));
          }

          // 配信・番組開始時にコメント履歴とカウントをゼロクリア
          if (typeof window.clearAllComments === "function") {
            window.clearAllComments();
          }

          // 1. OBS配信の自動開始（接続時）
          if (typeof window.ensureObsStreamingStarted === "function") {
            window.ensureObsStreamingStarted().catch((e) => console.warn(e));
          }

          // 2. 配信準備中オーバーレイの解除
          if (typeof window.executeOverlayClearProcess === "function") {
            window.executeOverlayClearProcess();
          } else {
            window.streamOverlayEl = document.getElementById("stream-overlay");
            if (streamOverlayEl) streamOverlayEl.classList.remove("active");
            if (typeof isPreparing !== "undefined") isPreparing = false;
          }

          const prepToggle = document.getElementById("preparing-mode-toggle");
          if (prepToggle && prepToggle.checked) {
            prepToggle.checked = false;
            prepToggle.dispatchEvent(new Event("change"));
          }

          // 3. BGMを最初から再生（既に再生中でも再スタート）
          window.bgmPlayBtn = document.getElementById("bgm-play-btn");
          if (
            bgmPlayBtn &&
            typeof window.bgmBuffer !== "undefined" &&
            window.bgmBuffer
          ) {
            console.log("[Local Schedule] BGMを最初から再生");
            bgmPlayBtn.click();
          }

          // 4. 配信モードに応じた番組開始
          setTimeout(() => {
            const mode = window.currentBroadcastMode || "news";
            if (mode === "news") {
              console.log("[Local Schedule] ニュース番組を自動開始します");
              if (typeof window.startNewsBroadcast === "function") {
                window.startNewsBroadcast();
              } else {
                const newsBtn = document.getElementById("news-broadcast-start-btn");
                if (newsBtn) newsBtn.click();
              }
            } else if (mode === "radio") {
              console.log("[Local Schedule] ラジオ自動再生を実行");
              const radioBtn = document.getElementById("radio-script-play-btn");
              if (radioBtn) radioBtn.click();
            } else {
              console.log("[Local Schedule] 雑談配信を開始します");
              const charId = window.currentModelId || "";
              const startVoice = charId.includes("zunda")
                ? "定刻になったのだ！配信スタートなのだ！"
                : "定刻になりましたので、本日の配信をスタートします！";
              if (typeof window.queueVoicevoxAudio === "function") {
                window.queueVoicevoxAudio(startVoice, true).catch((e) => console.warn(e));
              }
              if (typeof window.resetIdleTimer === "function") {
                window.resetIdleTimer();
              }
            }
          }, 600); // BGM開始から少し遅らせて実行
        } else {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          if (localScheduleCountdown) {
            localScheduleCountdown.textContent =
              String(h).padStart(2, "0") +
              ":" +
              String(m).padStart(2, "0") +
              ":" +
              String(s).padStart(2, "0");
          }
        }
      }, 1000);
    } else {
      if (localScheduleCountdown)
        localScheduleCountdown.textContent = "--:--:--";
    }
  }

  if (localScheduleToggle)
    localScheduleToggle.addEventListener("change", updateLocalScheduleTimer);
  if (localScheduleTime)
    localScheduleTime.addEventListener("change", updateLocalScheduleTimer);

  // 初期描画時にも見た目を適用
  updateLocalScheduleTimer();

  // スタジオ側の終了方法モード切り替え
  const mainEndMode = document.getElementById("main-stream-end-mode");
  const mainTimerRow = document.getElementById("main-stream-timer-row");
  const mainTimeRow = document.getElementById("main-stream-time-row");
  const mainDurationSelect = document.getElementById("main-stream-duration-select");
  const streamEndToggle = document.getElementById("stream-end-toggle");

  if (mainEndMode) {
    mainEndMode.addEventListener("change", () => {
      const mode = mainEndMode.value;
      if (mode === "timer") {
        if (mainTimerRow) mainTimerRow.style.display = "flex";
        if (mainTimeRow) mainTimeRow.style.display = "none";
        if (streamEndToggle) streamEndToggle.checked = false;
        const dur = mainDurationSelect ? parseInt(mainDurationSelect.value, 10) : 1440;
        window.setStreamEndTimer(dur);
      } else if (mode === "time") {
        if (mainTimerRow) mainTimerRow.style.display = "none";
        if (mainTimeRow) mainTimeRow.style.display = "flex";
        if (streamEndToggle) streamEndToggle.checked = true;
        window.clearStreamEndTimer();
      } else {
        if (mainTimerRow) mainTimerRow.style.display = "none";
        if (mainTimeRow) mainTimeRow.style.display = "none";
        if (streamEndToggle) streamEndToggle.checked = false;
        window.clearStreamEndTimer();
      }
    });

    if (mainDurationSelect) {
      mainDurationSelect.addEventListener("change", () => {
        if (mainEndMode.value === "timer") {
          const dur = parseInt(mainDurationSelect.value, 10);
          window.setStreamEndTimer(dur);
        }
      });
    }
  }
});
