// OBS WebSocket 自動連携
// =====================================================================
window.isObsWsConnected = false;

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("obs-websocket", () => {
  window.obsWsPortInput = document.getElementById("obs-ws-port");
  window.obsWsPasswordInput = document.getElementById("obs-ws-password");
  window.obsWsConnectBtn = document.getElementById("obs-ws-connect-btn");
  window.obsWsStatus = document.getElementById("obs-ws-status");

  async function toggleObsWsConnection(silent = false) {
    if (window.isObsWsConnected && window.obsWsClient) {
      // 切断処理
      try {
        await window.obsWsClient.disconnect();
      } catch (e) {}
      if (window.obsWsStatus) {
        window.obsWsStatus.textContent = "未接続";
        window.obsWsStatus.style.color = "#aaa";
      }
      if (window.obsWsConnectBtn) {
        window.obsWsConnectBtn.textContent = "接続する";
        window.obsWsConnectBtn.style.background = "var(--primary)";
      }
      window.isObsWsConnected = false;
      localStorage.setItem("obsWsAutoConnect", "false");
      return;
    }

    const port = window.obsWsPortInput
      ? window.obsWsPortInput.value.trim() || "4455"
      : "4455";
    
    let password = window.obsWsPasswordInput ? window.obsWsPasswordInput.value.trim() : "";
    if (!password) {
      password = localStorage.getItem("savedObsWsPassword") || "";
      if (window.obsWsPasswordInput) window.obsWsPasswordInput.value = password;
    }

    localStorage.setItem("savedObsWsPort", port);
    localStorage.setItem("savedObsWsPassword", password);

    if (typeof OBSWebSocket === "undefined") {
      if (window.obsWsStatus) {
        window.obsWsStatus.textContent = "ライブラリ読込エラー";
        window.obsWsStatus.style.color = "#ff4444";
      }
      return;
    }

    if (window.obsWsClient) {
      try {
        await window.obsWsClient.disconnect();
      } catch (e) {}
    }

    window.obsWsClient = new OBSWebSocket();

    window.obsWsClient.on("ConnectionClosed", () => {
      window.isObsWsConnected = false;
      if (window.obsWsStatus) {
        window.obsWsStatus.textContent = "切断されました";
        window.obsWsStatus.style.color = "#ff4444";
      }
      if (window.obsWsConnectBtn) {
        window.obsWsConnectBtn.textContent = "接続する";
        window.obsWsConnectBtn.style.background = "var(--primary)";
      }
    });

    window.obsWsClient.on("ConnectionError", (err) => {
      window.isObsWsConnected = false;
    });

    try {
      if (window.obsWsStatus) {
        window.obsWsStatus.textContent = "接続中...";
        window.obsWsStatus.style.color = "#ffaa00";
      }

      console.log(`[OBS] Connecting to OBS WS at ws://127.0.0.1:${port} ...`);
      await window.obsWsClient.connect(`ws://127.0.0.1:${port}`, password || undefined);

      window.isObsWsConnected = true;
      localStorage.setItem("obsWsAutoConnect", "true");
      if (window.obsWsStatus) {
        window.obsWsStatus.textContent = "接続済み";
        window.obsWsStatus.style.color = "#00ff88";
      }
      if (window.obsWsConnectBtn) {
        window.obsWsConnectBtn.textContent = "切断する";
        window.obsWsConnectBtn.style.background = "#ff4444";
      }
      console.log("[OBS] ✅ OBS WebSocket接続に成功しました！");
    } catch (error) {
      window.isObsWsConnected = false;
      if (window.obsWsStatus) {
        window.obsWsStatus.textContent = "接続失敗";
        window.obsWsStatus.style.color = "#ff4444";
      }
      console.warn("[OBS] OBS WebSocket接続エラー:", error && error.message ? error.message : error);
    }
  }

  window.toggleObsWsConnection = toggleObsWsConnection;

  if (window.obsWsConnectBtn) {
    window.obsWsConnectBtn.onclick = () => toggleObsWsConnection(false);
  }

  // 設定復元
  const savedObsWsPort = localStorage.getItem("savedObsWsPort");
  const savedObsWsPassword = localStorage.getItem("savedObsWsPassword");
  if (savedObsWsPort && window.obsWsPortInput) window.obsWsPortInput.value = savedObsWsPort;
  if (savedObsWsPassword && window.obsWsPasswordInput)
    window.obsWsPasswordInput.value = savedObsWsPassword;
});

// OBS配信開始確認と待機（二重呼び出し防止ロック付き）
let isStartingStreamInProgress = false;
let startStreamPromise = null;

window.ensureObsStreamingStarted = async function (onProgress = null) {
  if (typeof isObsWsConnected === "undefined" || !isObsWsConnected || typeof obsWsClient === "undefined" || !obsWsClient) {
    console.log("[OBS] OBS WebSocket未接続のため、配信状態チェックをスキップします。");
    return true;
  }

  if (isStartingStreamInProgress && startStreamPromise) {
    console.log("[OBS] 既にStartStream待機処理が実行中のため、既存の処理を待機します。");
    return await startStreamPromise;
  }

  isStartingStreamInProgress = true;
  startStreamPromise = (async () => {
    try {
      if (onProgress) onProgress("OBS配信ステータスを確認中...");
      const status = await obsWsClient.call("GetStreamStatus");
      if (status && status.outputActive) {
        console.log("[OBS] OBSは既に配信中です！");
        window.isObsStreaming = true;
        return true;
      }

      console.log("[OBS] OBSがまだ配信開始していないため、StartStreamコマンドを送信します...");
      if (onProgress) onProgress("OBS配信開始コマンドを送信中...");
      try {
        await obsWsClient.call("StartStream");
      } catch (startErr) {
        console.warn("[OBS] StartStream呼び出し警告:", startErr);
      }

      // 配信開始（outputActive === true）になるまで最大15秒待機
      if (onProgress) onProgress("OBSの配信接続完了を待機中...");
      const startTime = Date.now();
      while (Date.now() - startTime < 15000) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const curStatus = await obsWsClient.call("GetStreamStatus");
          if (curStatus && curStatus.outputActive) {
            console.log("[OBS] OBSの配信開始を確認しました！");
            window.isObsStreaming = true;
            // バッファ安定のため1.5秒待機
            await new Promise((r) => setTimeout(r, 1500));
            return true;
          }
        } catch (checkErr) { }
      }
      console.warn("[OBS] OBS配信開始のタイムアウト（そのまま進行します）");
      return false;
    } catch (e) {
      console.error("[OBS] 配信開始確認エラー:", e);
      return false;
    } finally {
      isStartingStreamInProgress = false;
      startStreamPromise = null;
    }
  })();

  return await startStreamPromise;
};
