const updateClock = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const day = days[now.getDay()];

  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  streamClock.innerHTML = `
                <div class="clock-date">${year}/${month}/${date} (${day})</div>
                <div class="clock-time">${h}:${m}:${s}</div>
            `;

  // 配信終了時刻のチェック
  if (
    streamEndToggle &&
    streamEndToggle.checked &&
    streamEndTimeInput &&
    streamEndTimeInput.value
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

window.updateClock = updateClock;
window.executeStreamEndProcess = function () {
  if (window.isStreamEndProcessRunning) return;
  window.isStreamEndProcessRunning = true;

  console.log("[システム] APIとOBS連携による配信終了プロセスを実行します");

  // 配信終了処理に入ったら、未読コメントを破棄してこれ以上読まないようにする
  if (typeof chatQueue !== "undefined") {
    chatQueue.length = 0; // 配列を空にする
    console.log("[システム] コメントキューをクリアしました");
  }

  // 配信終了画面（オーバーレイ）に自動で切り替え
  const endBtn = document.getElementById("overlay-end-btn");
  if (endBtn) {
    console.log("[システム] 配信終了画面に切り替えます");
    endBtn.click();
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

      if (
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
};

window.executeStreamEndProcess = executeStreamEndProcess;

window.addEventListener("uiLoaded", () => {
  window.localScheduleToggle = document.getElementById("local-schedule-toggle");
  window.localScheduleTime = document.getElementById("local-schedule-time");
  window.localScheduleCountdown = document.getElementById(
    "local-schedule-countdown",
  );
  let localScheduleTimerId = null;

  function updateLocalScheduleTimer() {
    if (localScheduleTimerId) clearInterval(localScheduleTimerId);

    if (
      localScheduleToggle &&
      localScheduleToggle.checked &&
      localScheduleTime &&
      localScheduleTime.value
    ) {
      const [hours, minutes] = localScheduleTime.value.split(":").map(Number);

      let targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);

      const nowSetup = new Date();
      // 既に時間を過ぎている場合
      if (targetTime.getTime() - nowSetup.getTime() <= 0) {
        // 12時間以上過去の設定なら明日の設定とみなす
        if (nowSetup.getTime() - targetTime.getTime() > 12 * 60 * 60 * 1000) {
          targetTime.setDate(targetTime.getDate() + 1);
        } else {
          // 数分〜数時間前などであれば「既に過ぎている」とみなして何もしない
          if (localScheduleCountdown)
            localScheduleCountdown.textContent = "00:00:00";
          return;
        }
      }

      localScheduleTimerId = setInterval(() => {
        const now = new Date();
        const diff = targetTime.getTime() - now.getTime();

        if (diff <= 0) {
          clearInterval(localScheduleTimerId);
          if (localScheduleCountdown)
            localScheduleCountdown.textContent = "00:00:00";

          console.log(
            "[Local Schedule] 指定時刻になりました。BGMとラジオを自動開始します。",
          );

          // オーバーレイの解除
          if (typeof window.executeOverlayClearProcess === "function") {
            window.executeOverlayClearProcess();
          } else {
            window.streamOverlayEl = document.getElementById("stream-overlay");
            if (streamOverlayEl) streamOverlayEl.classList.remove("active");
            if (typeof isPreparing !== "undefined") isPreparing = false;
          }

          // BGMを最初から再生（既に再生中でも再スタート）
          window.bgmPlayBtn = document.getElementById("bgm-play-btn");
          if (
            bgmPlayBtn &&
            typeof window.bgmBuffer !== "undefined" &&
            window.bgmBuffer
          ) {
            console.log("[Local Schedule] BGMを最初から再生");
            bgmPlayBtn.click();
          }

          // ラジオ台本再生開始
          setTimeout(() => {
            window.radioPlayBtn = document.getElementById(
              "radio-script-play-btn",
            );
            if (radioPlayBtn) {
              console.log("[Local Schedule] ラジオ自動再生を実行");
              radioPlayBtn.click();
            }
          }, 500); // BGM開始から少し遅らせて実行
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
});
