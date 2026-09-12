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

  const clockEl = window.streamClock || document.getElementById("stream-clock");
  if (clockEl) {
    let schedBadgeHtml = "";
    if (window.currentScheduledStartTimeDisplay) {
      schedBadgeHtml = `<div class="stream-clock-schedule">⏰ ${window.currentScheduledStartTimeDisplay}</div>`;
    }
    clockEl.innerHTML = `
      <div class="clock-date">${year}/${month}/${date} (${day})</div>
      <div class="clock-time">${h}:${m}:${s}</div>
      ${schedBadgeHtml}
    `;
  }

  // 1. タイマー指定の終了チェック（24時間耐久や日付跨ぎでも正確に動作）
  const hasAnnouncedEnd = Boolean(window.hasAnnouncedEnd);
  const streamEndTextInput = window.streamEndTextInput || document.getElementById("stream-end-text");
  const streamEndToggle = window.streamEndToggle || document.getElementById("stream-end-toggle");
  const streamEndTimeInput = window.streamEndTimeInput || document.getElementById("stream-end-time");

  if (window.streamEndTargetTimestamp && !hasAnnouncedEnd) {
    if (Date.now() >= window.streamEndTargetTimestamp) {
      window.hasAnnouncedEnd = true;
      const voiceText =
        streamEndTextInput && streamEndTextInput.value
          ? streamEndTextInput.value
          : "予定の配信時間が経過しました。本日の配信はここまでとなります。見に来てくれてありがとうございました！";

      if (typeof queueVoicevoxAudio === "function") {
        queueVoicevoxAudio(voiceText, false).catch((e) => console.warn(e));
      }

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
      window.hasAnnouncedEnd = true;

      const voiceText =
        streamEndTextInput && streamEndTextInput.value
          ? streamEndTextInput.value
          : "予定の時刻になりました。本日の配信はここまでとなります。見に来てくれてありがとうございました！";

      if (typeof queueVoicevoxAudio === "function") {
        queueVoicevoxAudio(voiceText, false).catch((e) => console.warn(e));
      }

      // APIで配信終了
      if (typeof window.executeStreamEndProcess === "function") {
        window.executeStreamEndProcess();
      }
    }
    // 翌日など再び時刻がずれたらフラグを戻す
    if (hasAnnouncedEnd && `${h}:${m}` !== streamEndTimeInput.value) {
      window.hasAnnouncedEnd = false;
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
    // 🚀 プロ仕様の配信開始シーケンス
    // 1. OBS配信開始合図（YouTube接続確立）
    // 2. 10秒待機（画面は配信準備中を維持）
    // 3. 配信準備中解除（※定型挨拶なし）
    // 4. BGM開始
    // 5. ニュースの挨拶〜最初のニュースへ進行
    function triggerScheduledBroadcastSequence() {
      console.log("[Local Schedule] ⏰ 配信開始シーケンス起動: 1. OBS配信開始合図を送信します。");

      // 1. OBS配信の自動開始（ON設定かつ接続時のみ）
      const isObsAutoStream = (function() {
        const el = document.getElementById("news-obs-auto-stream-toggle") || document.getElementById("obs-auto-start-toggle");
        if (el) return el.checked;
        const saved = localStorage.getItem("savedObsStreamAutoStart");
        if (saved !== null) return saved === "true";
        if (typeof window.isObsStreamAutoStart !== "undefined") return !!window.isObsStreamAutoStart;
        return false;
      })();

      if (isObsAutoStream && typeof window.ensureObsStreamingStarted === "function") {
        console.log("[Local Schedule] 📡 OBS配信連動がONのため、OBS配信開始合図を送信します。");
        window.ensureObsStreamingStarted().catch((e) => console.warn(e));
      } else {
        console.log(`[Local Schedule] ℹ️ OBS配信連動はOFFのため、OBS配信開始をスキップします (isObsAutoStream: ${isObsAutoStream})`);
      }

      // 画面は「配信準備中」を維持（未設定なら準備中にする）
      if (!window.isPreparing) {
        if (typeof window.setOverlayPreparing === "function") {
          window.setOverlayPreparing();
        } else {
          const prepBtn = document.getElementById("overlay-prep-btn");
          if (prepBtn) prepBtn.click();
        }
      }

      // ⏳ 2. 設定された待機秒数（デフォルト10秒）待機（OBSが配信サーバーと接続確立するまで「配信準備中」を維持）
      let waitSec = 10;
      try {
        const savedWait = localStorage.getItem("savedPrepareWaitSec");
        if (savedWait) waitSec = Math.max(3, parseInt(savedWait, 10));
      } catch (e) {}

      console.log(`[Local Schedule] ⏳ OBS配信確立のため ${waitSec} 秒待機中... (画面: 配信準備中)`);
      setTimeout(() => {
        console.log(`[Local Schedule] 🔓 ${waitSec} 秒経過: 配信準備中オーバーレイを解除し、BGMを開始します。`);

        // 配信準備中オーバーレイの解除（※デフォルトの挨拶は流さない）
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
        }

        // 3. BGM再生開始（executeOverlayClearProcessで既にフェードイン再生されていない場合のみ安全に開始）
        if (typeof bgmIsPlaying !== "undefined" && !bgmIsPlaying) {
          if (typeof fadeInBgm === "function") {
            console.log("[Local Schedule] 🎵 BGMフェードイン再生スタート");
            fadeInBgm(2000);
          } else {
            window.bgmPlayBtn = document.getElementById("bgm-play-btn");
            if (
              bgmPlayBtn &&
              typeof window.bgmBuffer !== "undefined" &&
              window.bgmBuffer
            ) {
              console.log("[Local Schedule] 🎵 BGM再生スタート");
              bgmPlayBtn.click();
            }
          }
        }

        // 4. BGM開始直後（約800ms後）にニュースの挨拶〜最初のニュースを開始！
        setTimeout(() => {
          window.isScheduledSequenceRunning = false;
          const activeTab = localStorage.getItem("activeTab");
          let mode = window.currentBroadcastMode;
          if (!mode) {
            if (activeTab === "tab-radio") mode = "radio";
            else if (activeTab === "tab-chat") mode = "chat";
            else mode = "news";
          }

          if (mode === "news") {
            console.log("[Local Schedule] 📰 ニュース番組を開始（挨拶〜最初のニュースへ）");
            if (typeof window.startNewsBroadcast === "function") {
              window.startNewsBroadcast(0);
            } else {
              const newsBtn = document.getElementById("news-broadcast-start-btn");
              if (newsBtn) newsBtn.click();
            }
          } else if (mode === "radio") {
            console.log("[Local Schedule] 📻 ラジオ番組を開始");
            const radioBtn = document.getElementById("radio-script-play-btn");
            if (radioBtn) radioBtn.click();
          } else {
            console.log("[Local Schedule] 💬 雑談配信を開始");
            if (typeof window.resetIdleTimer === "function") {
              window.resetIdleTimer();
            }
          }
        }, 800);
      }, waitSec * 1000);
    }

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

      // 既に指定日時を過ぎている場合は、何分過ぎていても配信開始シーケンスを実行！
      if (pastDiffMs > 0) {
        console.log("[Local Schedule] 指定日時を既に過ぎているため、配信開始シーケンスを実行します！");
        if (localScheduleCountdown) localScheduleCountdown.textContent = "00:00:00";
        if (statusBadge) {
          statusBadge.textContent = "🟢 開始中";
          statusBadge.style.background = "rgba(0, 255, 102, 0.18)";
          statusBadge.style.color = "#00ff66";
        }
        triggerScheduledBroadcastSequence();
        return;
      }

      // ⏳ 未来時刻待機: 配信開始前は画面を「配信準備中」にして待機
      if (typeof window.setOverlayPreparing === "function") {
        window.setOverlayPreparing();
      } else {
        const prepBtn = document.getElementById("overlay-prep-btn");
        if (prepBtn) prepBtn.click();
      }

      let lastHealthCheckTime = 0;

      const tickScheduleTimer = () => {
        const now = new Date();
        const diff = targetTime.getTime() - now.getTime();

        // 🛡️ 予約待機中のサーバー死活監視（30秒ごと）
        if (now.getTime() - lastHealthCheckTime >= 30000) {
          lastHealthCheckTime = now.getTime();
          fetch("/api/youtube/oauth_status").catch((e) => {
            console.warn("[予約待機監視] ⚠️ サーバー通信応答なし (Vite/API):", e);
            if (typeof window.showNotification === "function") {
              window.showNotification("⚠️ サーバー通信確認中: 接続が一時的に不安定です", "warning");
            }
          });
        }

        const schedTimeDisplay = targetTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

        if (diff <= 0) {
          if (localScheduleTimerId) {
            clearInterval(localScheduleTimerId);
            localScheduleTimerId = null;
          }
          window.currentScheduledStartTimeDisplay = null;
          if (localScheduleCountdown)
            localScheduleCountdown.textContent = "00:00:00";

          const overlaySchedCard = document.getElementById("overlay-schedule-card");
          if (overlaySchedCard) overlaySchedCard.style.display = "none";

          // 自動開始タイマー発火フラグを立ててトグルOFF時の誤爆解除を完全遮断
          window.isScheduledSequenceRunning = true;
          if (localScheduleToggle && localScheduleToggle.checked) {
            localScheduleToggle.checked = false;
            try {
              localStorage.setItem("savedWizardStartScheduleToggle", "false");
            } catch (e) {}
            if (toggleText) {
              toggleText.textContent = "OFF";
              toggleText.style.color = "var(--text-muted)";
            }
            if (statusBadge) {
              statusBadge.textContent = "🟢 開始中";
              statusBadge.style.background = "rgba(0, 255, 102, 0.18)";
              statusBadge.style.color = "#00ff66";
              statusBadge.style.border = "1px solid rgba(0, 255, 102, 0.4)";
            }
          }

          // 配信・番組開始時にコメント履歴とカウントをゼロクリア
          if (typeof window.clearAllComments === "function") {
            window.clearAllComments();
          }

          // 🚀 配信開始シーケンスを実行（OBS開始 ➔ 待機秒数 ➔ 準備中解除 ➔ BGM ➔ ニュース挨拶）
          triggerScheduledBroadcastSequence();
        } else {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          const countdownStr =
            String(h).padStart(2, "0") +
            ":" +
            String(m).padStart(2, "0") +
            ":" +
            String(s).padStart(2, "0");

          if (localScheduleCountdown) {
            localScheduleCountdown.textContent = countdownStr;
          }

          // 画面オーバーレイおよび時計バッジへのリアルタイム反映
          window.currentScheduledStartTimeDisplay = `${schedTimeDisplay} START (${countdownStr})`;

          const overlaySchedCard = document.getElementById("overlay-schedule-card");
          const overlaySchedVal = document.getElementById("overlay-schedule-val");
          const overlayCountdownVal = document.getElementById("overlay-countdown-val");

          if (overlaySchedVal) overlaySchedVal.textContent = schedTimeDisplay;
          if (overlayCountdownVal) overlayCountdownVal.textContent = countdownStr;
          if (window.isPreparing && overlaySchedCard) {
            overlaySchedCard.style.display = "flex";
          }
        }
      };

      // 🛡️ 初回即時実行（1秒の待機遅延なく画面へ直ちに反映）
      tickScheduleTimer();
      localScheduleTimerId = setInterval(tickScheduleTimer, 1000);
    } else {
      window.currentScheduledStartTimeDisplay = null;
      const overlaySchedCard = document.getElementById("overlay-schedule-card");
      if (overlaySchedCard) overlaySchedCard.style.display = "none";

      if (localScheduleCountdown)
        localScheduleCountdown.textContent = "--:--:--";
      // 手動で予約トグルをOFFにした場合のみ、準備中画面を解除（自動開始シーケンス中は誤爆解除させない）
      if (!window.isScheduledSequenceRunning && window.isPreparing && typeof window.executeOverlayClearProcess === "function") {
        window.executeOverlayClearProcess();
      }
    }
  }

  if (localScheduleToggle) {
    localScheduleToggle.addEventListener("change", () => {
      try {
        localStorage.setItem("savedWizardStartScheduleToggle", String(localScheduleToggle.checked));
      } catch (e) {}
      updateLocalScheduleTimer();
    });
  }
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
      if (mode === "news_end") {
        window.isAutoEndAfterNews = true;
        if (mainTimerRow) mainTimerRow.style.display = "none";
        if (mainTimeRow) mainTimeRow.style.display = "none";
        if (streamEndToggle) streamEndToggle.checked = false;
        window.clearStreamEndTimer();
      } else if (mode === "timer") {
        window.isAutoEndAfterNews = false;
        if (mainTimerRow) mainTimerRow.style.display = "flex";
        if (mainTimeRow) mainTimeRow.style.display = "none";
        if (streamEndToggle) streamEndToggle.checked = false;
        const dur = mainDurationSelect ? parseInt(mainDurationSelect.value, 10) : 1440;
        window.setStreamEndTimer(dur);
      } else if (mode === "time") {
        window.isAutoEndAfterNews = false;
        if (mainTimerRow) mainTimerRow.style.display = "none";
        if (mainTimeRow) mainTimeRow.style.display = "flex";
        if (streamEndToggle) streamEndToggle.checked = true;
        window.clearStreamEndTimer();
      } else {
        window.isAutoEndAfterNews = false;
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

    // 🚀 初期ロード時にも選択値から即座に isAutoEndAfterNews を初期化
    if (mainEndMode.value === "news_end") {
      window.isAutoEndAfterNews = true;
    }
  }

  // ⏱️ 配信準備中解除までの待機秒数（news-prepare-wait, local-schedule-wait）の同期と初期化
  function initPrepareWaitSliders() {
    const newsSlider = document.getElementById("news-prepare-wait");
    const newsVal = document.getElementById("news-prepare-wait-val");
    const localSlider = document.getElementById("local-schedule-wait");
    const localVal = document.getElementById("local-schedule-wait-val");

    let currentSec = 10;
    try {
      const saved = localStorage.getItem("savedPrepareWaitSec");
      if (saved) currentSec = Math.max(3, parseInt(saved, 10));
    } catch (e) { }

    function updateAll(val) {
      val = Math.max(3, Math.min(60, parseInt(val, 10) || 10));
      try {
        localStorage.setItem("savedPrepareWaitSec", val);
      } catch (e) { }
      if (newsSlider) newsSlider.value = val;
      if (newsVal) newsVal.textContent = val;
      if (localSlider) localSlider.value = val;
      if (localVal) localVal.textContent = val;
    }

    if (newsSlider) {
      newsSlider.addEventListener("input", (e) => updateAll(e.target.value));
    }
    if (localSlider) {
      localSlider.addEventListener("input", (e) => updateAll(e.target.value));
    }

    updateAll(currentSec);
  }

  initPrepareWaitSliders();
});
