window.addEventListener("uiLoaded", () => {
  // OBS WebSocket 自動連携
  // =====================================================================
  window.obsWsPortInput = document.getElementById("obs-ws-port");
  window.obsWsPasswordInput = document.getElementById("obs-ws-password");
  window.obsWsConnectBtn = document.getElementById("obs-ws-connect-btn");
  window.obsWsStatus = document.getElementById("obs-ws-status");

  async function toggleObsWsConnection() {
    if (isObsWsConnected && obsWsClient) {
      // 切断処理
      try {
        await obsWsClient.disconnect();
      } catch (e) {
        console.error("OBS WS Disconnect Error:", e);
      }
      if (obsWsStatus) {
        obsWsStatus.textContent = "未接続";
        obsWsStatus.style.color = "#aaa";
      }
      if (obsWsConnectBtn) {
        obsWsConnectBtn.textContent = "接続する";
        obsWsConnectBtn.style.background = "var(--primary)";
      }
      isObsWsConnected = false;
      localStorage.setItem("obsWsAutoConnect", "false"); // 手動切断時にフラグを解除
      return;
    }

    // 接続処理
    const port = obsWsPortInput
      ? obsWsPortInput.value.trim() || "4455"
      : "4455";
    const password = obsWsPasswordInput ? obsWsPasswordInput.value.trim() : "";

    localStorage.setItem("savedObsWsPort", port);
    localStorage.setItem("savedObsWsPassword", password);

    if (typeof OBSWebSocket === "undefined") {
      if (obsWsStatus) {
        obsWsStatus.textContent = "ライブラリ読込エラー";
        obsWsStatus.style.color = "#ff4444";
      }
      return;
    }

    if (!obsWsClient) {
      obsWsClient = new OBSWebSocket();

      obsWsClient.on("ConnectionClosed", () => {
        isObsWsConnected = false;
        if (obsWsStatus) {
          obsWsStatus.textContent = "切断されました";
          obsWsStatus.style.color = "#ff4444";
        }
        if (obsWsConnectBtn) {
          obsWsConnectBtn.textContent = "接続する";
          obsWsConnectBtn.style.background = "var(--primary)";
        }
      });

      obsWsClient.on("ConnectionError", (err) => {
        console.error("OBS WS Error", err);
        isObsWsConnected = false;
      });
    }

    try {
      if (obsWsStatus) {
        obsWsStatus.textContent = "接続中...";
        obsWsStatus.style.color = "#ffaa00";
      }

      // OBSがIPv6でListenしている場合があるため、常に 'localhost' を使用する
      const targetHost = "localhost";
      console.log(`Connecting to OBS WS at ws://${targetHost}:${port} ...`);
      await obsWsClient.connect(`ws://${targetHost}:${port}`, password);

      isObsWsConnected = true;
      localStorage.setItem("obsWsAutoConnect", "true"); // 接続成功時にフラグを保存
      if (obsWsStatus) {
        obsWsStatus.textContent = "接続済み";
        obsWsStatus.style.color = "#00ff88";
      }
      if (obsWsConnectBtn) {
        obsWsConnectBtn.textContent = "切断する";
        obsWsConnectBtn.style.background = "#ff4444";
      }
    } catch (error) {
      console.error("OBS WS Connect Error:", error);
      isObsWsConnected = false;
      if (obsWsStatus) {
        obsWsStatus.textContent = "接続失敗";
        obsWsStatus.style.color = "#ff4444";
      }
      const errMsg = error.message ? error.message : JSON.stringify(error);
      alert(
        `OBS WebSocketへの接続に失敗しました。\nポート番号、パスワード、OBS側で有効になっているか確認してください。\n詳細: ${errMsg}`,
      );
    }
  }

  if (obsWsConnectBtn) {
    obsWsConnectBtn.addEventListener("click", toggleObsWsConnection);
  }

  // 設定復元
  const savedObsWsPort = localStorage.getItem("savedObsWsPort");
  const savedObsWsPassword = localStorage.getItem("savedObsWsPassword");
  if (savedObsWsPort && obsWsPortInput) obsWsPortInput.value = savedObsWsPort;
  if (savedObsWsPassword && obsWsPasswordInput)
    obsWsPasswordInput.value = savedObsWsPassword;
});
