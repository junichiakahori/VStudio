window.updateObsUrl = function updateObsUrl() {
  if (!obsUrlInput) return;
  const isGreen = obsGreenToggle && obsGreenToggle.checked;
  const greenParam = isGreen ? "&green=true" : "";
  const basePath = window.location.pathname.substring(
    0,
    window.location.pathname.lastIndexOf("/") + 1,
  );
  obsUrlInput.value = `${window.location.origin}${basePath}live2d.html?obs=true&model=${currentModelId}${greenParam}`;
};
window.buildModelGrid = function buildModelGrid() {
  MODELS.forEach((m) => {
    const card = document.createElement("div");
    card.className = "model-card" + (m.id === currentModelId ? " active" : "");
    card.dataset.modelId = m.id;
    card.innerHTML = `<img src="${m.icon}" alt="${m.name}" loading="lazy"><div class="model-name">${m.name}</div>`;
    card.addEventListener("click", () => window.loadModel(m));
    modelGrid.appendChild(card);
  });
};
window.saveSettings = function saveSettings() {
  localStorage.setItem(
    "live2d_studio_v2",
    JSON.stringify({
      modelId: currentModelId,
      faceSensitivity,
      modelScale,
      offsetX,
      offsetY,
      cameraTrack: cameraTrackToggle.checked,
      autoBlink: autoBlinkToggle.checked,
      idleAnim: idleAnimToggle.checked,
      cameraPreview: cameraPreviewToggle.checked,
      micSync: micToggle.checked,
      handTrack: handTrackToggle.checked,
      obsGreen: obsGreenToggle ? obsGreenToggle.checked : false,
      faceMask: faceMaskToggle ? faceMaskToggle.checked : false,
      maskScale: maskScaleMultiplier,
      maskOffsetX: maskOffsetX,
      maskOffsetY: maskOffsetY,
    }),
  );
};
window.loadSettings = function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("live2d_studio_v2") || "{}");
    if (s.modelId) currentModelId = s.modelId;
    if (s.faceSensitivity) {
      faceSensitivity = s.faceSensitivity;
      faceSensSlider.value = faceSensitivity;
      faceSensVal.textContent = faceSensitivity.toFixed(1);
    }
    if (s.modelScale) {
      modelScale = s.modelScale;
      scaleSlider.value = modelScale;
      scaleVal.textContent = modelScale.toFixed(2);
    }
    if (s.offsetX != null) {
      offsetX = s.offsetX;
      offsetXSlider.value = offsetX;
      offsetXVal.textContent = offsetX;
    }
    if (s.offsetY != null) {
      offsetY = s.offsetY;
      offsetYSlider.value = offsetY;
      offsetYVal.textContent = offsetY;
    }
    if (s.autoBlink != null) autoBlinkToggle.checked = s.autoBlink;
    if (s.idleAnim != null) idleAnimToggle.checked = s.idleAnim;
    if (s.cameraPreview != null) cameraPreviewToggle.checked = s.cameraPreview;
    if (s.micSync != null) micToggle.checked = s.micSync;
    if (s.cameraTrack != null) {
      cameraTrackToggle.checked = s.cameraTrack;
      if (s.cameraTrack) {
        setTimeout(() => startCamera(), 500);
      }
    }
    if (s.handTrack != null) {
      handTrackToggle.checked = s.handTrack;
      isHandTrackActive = s.handTrack;
      if (s.handTrack) {
        handStatus.textContent = "手認識一時停止";
      }
    }
    if (s.obsGreen != null && obsGreenToggle) {
      obsGreenToggle.checked = s.obsGreen;
    }
    if (s.maskScale != null && maskScaleSlider) {
      maskScaleMultiplier = s.maskScale;
      maskScaleSlider.value = maskScaleMultiplier;
      if (maskScaleVal)
        maskScaleVal.textContent = maskScaleMultiplier.toFixed(2);
    }
    if (s.maskOffsetY != null && maskOffsetYSlider) {
      maskOffsetY = s.maskOffsetY;
      maskOffsetYSlider.value = maskOffsetY;
      if (maskOffsetYVal) maskOffsetYVal.textContent = maskOffsetY;
    }
    if (s.maskOffsetX != null && maskOffsetXSlider) {
      maskOffsetX = s.maskOffsetX;
      maskOffsetXSlider.value = maskOffsetX;
      if (maskOffsetXVal) maskOffsetXVal.textContent = maskOffsetX;
    }
    if (s.faceMask != null && faceMaskToggle) {
      faceMaskToggle.checked = s.faceMask;
      if (s.faceMask) {
        setTimeout(() => toggleFaceMaskMode(true), 500);
      }
    }
  } catch (e) {}
};
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("avatar-features", () => {
  // =====================================================================
  // スライダー
  // =====================================================================
  faceSensSlider.addEventListener("input", () => {
    faceSensitivity = parseFloat(faceSensSlider.value);
    faceSensVal.textContent = faceSensitivity.toFixed(1);
    window.saveSettings();
  });
  scaleSlider.addEventListener("input", () => {
    modelScale = parseFloat(scaleSlider.value);
    scaleVal.textContent = modelScale.toFixed(2);
    window.positionModel();
    window.saveSettings();
  });
  offsetYSlider.addEventListener("input", () => {
    offsetY = parseInt(offsetYSlider.value);
    offsetYVal.textContent = offsetY;
    window.positionModel();
    window.saveSettings();
  });
  offsetXSlider.addEventListener("input", () => {
    offsetX = parseInt(offsetXSlider.value);
    offsetXVal.textContent = offsetX;
    window.positionModel();
    window.saveSettings();
  });

  // 部位Tuber (AR顔被せ) イベントリスナー
  function toggleFaceMaskMode(active) {
    isFaceMaskMode = active;
    if (active) {
      document.body.classList.add("face-mask-mode");
      if (maskStatus) {
        maskStatus.textContent = "部位モード有効";
        maskStatus.classList.add("active");
      }
      if (!isCameraActive && cameraTrackToggle) {
        cameraTrackToggle.checked = true;
        startCamera();
      }
    } else {
      document.body.classList.remove("face-mask-mode");
      if (maskStatus) {
        maskStatus.textContent = "部位モードオフ";
        maskStatus.classList.remove("active");
      }
      if (live2dModel) {
        live2dModel.rotation = 0;
        window.positionModel();
      }
    }
    window.saveSettings();
  }

  if (faceMaskToggle) {
    faceMaskToggle.addEventListener("change", () => {
      toggleFaceMaskMode(faceMaskToggle.checked);
    });
  }

  if (maskScaleSlider) {
    maskScaleSlider.addEventListener("input", () => {
      maskScaleMultiplier = parseFloat(maskScaleSlider.value);
      if (maskScaleVal)
        maskScaleVal.textContent = maskScaleMultiplier.toFixed(2);
      window.saveSettings();
    });
  }

  if (maskOffsetYSlider) {
    maskOffsetYSlider.addEventListener("input", () => {
      maskOffsetY = parseInt(maskOffsetYSlider.value);
      if (maskOffsetYVal) maskOffsetYVal.textContent = maskOffsetY;
      window.saveSettings();
    });
  }

  if (maskOffsetXSlider) {
    maskOffsetXSlider.addEventListener("input", () => {
      maskOffsetX = parseInt(maskOffsetXSlider.value);
      if (maskOffsetXVal) maskOffsetXVal.textContent = maskOffsetX;
      window.saveSettings();
    });
  }

  // デバッグ用腕スライダーイベント
  debugArmLaSlider.addEventListener("input", () => {
    debugArmLaVal.textContent = debugArmLaSlider.value;
    if (!isHandTrackActive) {
      tArmLA = parseFloat(debugArmLaSlider.value);
    }
  });
  debugArmLbSlider.addEventListener("input", () => {
    debugArmLbVal.textContent = debugArmLbSlider.value;
    if (!isHandTrackActive) {
      tArmLB = parseFloat(debugArmLbSlider.value);
    }
  });
  debugArmRaSlider.addEventListener("input", () => {
    debugArmRaVal.textContent = debugArmRaSlider.value;
    if (!isHandTrackActive) {
      tArmRA = parseFloat(debugArmRaSlider.value);
    }
  });
  debugArmRbSlider.addEventListener("input", () => {
    debugArmRbVal.textContent = debugArmRbSlider.value;
    if (!isHandTrackActive) {
      tArmRB = parseFloat(debugArmRbSlider.value);
    }
  });

  // =====================================================================
  // OBS URL
  // =====================================================================

  if (obsGreenToggle) {
    obsGreenToggle.addEventListener("change", () => {
      window.updateObsUrl();
      window.saveSettings();
    });
  }

  copyUrlBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(obsUrlInput.value).then(() => {
      copyUrlBtn.textContent = "コピー完了!";
      copyUrlBtn.style.background = "#00ff66";
      setTimeout(() => {
        copyUrlBtn.textContent = "コピー";
        copyUrlBtn.style.background = "";
      }, 1500);
    });
  });

  // 全画面・操作パネル表示非表示切替
  window.togglePanelBtn = document.getElementById("toggle-panel-btn");
  if (togglePanelBtn) togglePanelBtn.style.display = "none"; // ボタンを非表示にする

  window.hidePanelHeaderBtn = document.getElementById("hide-panel-header-btn");

  const triggerResize = () => {
    if (pixiApp) {
      setTimeout(() => {
        const nw = viewport.clientWidth || window.innerWidth;
        const nh = viewport.clientHeight || window.innerHeight;
        pixiApp.renderer.resize(nw, nh);
        if (live2dModel) window.positionModel();
      }, 100);
    }
  };

  if (hidePanelHeaderBtn) {
    hidePanelHeaderBtn.addEventListener("click", () => {
      document.body.classList.add("panel-hidden");
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      triggerResize();
    });
  }

  // フルスクリーン解除時、またはESCキー押下時にパネルを復元する
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove("panel-hidden");
      triggerResize();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.body.classList.remove("panel-hidden");
      triggerResize();
    }
  });

  // =====================================================================
  // BroadcastChannel (OBS受信)
  // =====================================================================
  if (window.isObsMode) {
    window.syncChannel.addEventListener("message", (e) => {
      const d = e.data;
      if (d && d.type === "live2d-state") {
        lastSyncTime = Date.now();
        tAngleX = d.angleX;
        tAngleY = d.angleY;
        tAngleZ = d.angleZ;
        tEyeLOpen = d.eyeLOpen;
        tEyeROpen = d.eyeROpen;
        tMouthOpen = d.mouthOpen;
        tEyeBallX = d.eyeBallX;
        tEyeBallY = d.eyeBallY;
        tBreath = d.breath;

        tArmLA = d.armLA;
        tArmLB = d.armLB;
        tArmRA = d.armRA;
        tArmRB = d.armRB;
        tHandLBVal = d.handLBVal || 0.0;
        tHandRBVal = d.handRBVal || 0.0;
        tHandLForm = d.handLForm != null ? d.handLForm : 1.0;
        tHandRForm = d.handRForm != null ? d.handRForm : 1.0;
        isHandTrackActive = d.isHandTrackActive;

        if (d.modelId && d.modelId !== currentModelId) {
          const def = MODELS.find((m) => m.id === d.modelId);
          if (def) window.loadModel(def);
        }
      }
    });
  }

  // =====================================================================
  // 設定保存/読み込み
  // =====================================================================

  // =====================================================================
  // モデルグリッド構築
  // =====================================================================

  // =====================================================================
  // NDIストリーミング
  // =====================================================================
  function connectNdi() {
    if (ndiWs && ndiWs.readyState <= 1) return; // 接続中または接続済み

    window.ndiStatus = document.getElementById("ndi-status");
    if (ndiStatus) {
      ndiStatus.textContent = "接続中...";
      ndiStatus.style.color = "#ffaa00";
    }

    try {
      ndiWs = new WebSocket(NDI_WS_URL);
      ndiWs.binaryType = "arraybuffer";

      ndiWs.onopen = () => {
        console.log("[NDI] WebSocket connected to NDI server");
        if (ndiStatus) {
          ndiStatus.textContent = "送信中";
          ndiStatus.style.color = "#00f3ff";
        }
        // 按辺間隔でフレームを送信
        startNdiFrameLoop();
        ndiWs.send(JSON.stringify({ type: "ping" }));
      };

      ndiWs.onclose = () => {
        console.log("[NDI] WebSocket disconnected");
        stopNdiFrameLoop();
        if (ndiStatus) {
          ndiStatus.textContent = "切断";
          ndiStatus.style.color = "#f44";
        }
        // 自動再接続
        if (ndiEnabled) {
          ndiRetryTimer = setTimeout(() => {
            if (ndiEnabled) connectNdi();
          }, 3000);
        }
      };

      ndiWs.onerror = (err) => {
        console.warn(
          "[NDI] WebSocket error - NDIサーバーが起動しているか確認: python3 ndi_server.py",
        );
        if (ndiStatus) {
          ndiStatus.textContent = "サーバー未起動";
          ndiStatus.style.color = "#f44";
        }
      };

      ndiWs.onmessage = (e) => {
        if (typeof e.data === "string") {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "pong" && ndiStatus) {
              ndiStatus.textContent = `送信中 [${msg.ndi}]`;
            }
          } catch (er) {}
        }
      };
    } catch (e) {
      console.error("[NDI] Connection failed:", e);
    }
  }

  function disconnectNdi() {
    ndiEnabled = false;
    if (ndiRetryTimer) {
      clearTimeout(ndiRetryTimer);
      ndiRetryTimer = null;
    }
    stopNdiFrameLoop();
    if (ndiWs) {
      ndiWs.close();
      ndiWs = null;
    }
    window.ndiStatus = document.getElementById("ndi-status");
    if (ndiStatus) {
      ndiStatus.textContent = "";
      ndiStatus.style.color = "";
    }
  }

  function startNdiFrameLoop() {
    if (ndiFrameTimer) return;
    const interval = Math.round(1000 / NDI_FPS);
    ndiFrameTimer = setInterval(captureAndSendNdiFrame, interval);
  }

  function stopNdiFrameLoop() {
    if (ndiFrameTimer) {
      clearInterval(ndiFrameTimer);
      ndiFrameTimer = null;
    }
  }

  let captureCanvas = null;
  let captureCtx = null;

  function captureAndSendNdiFrame() {
    if (!ndiWs || ndiWs.readyState !== WebSocket.OPEN) return;
    if (!pixiApp) return;

    try {
      const renderer = pixiApp.renderer;
      const w = renderer.width;
      const h = renderer.height;

      // NDIの負荷を下げるため、最大解像度を640pxにリサイズしてキャプチャします
      // これにより転送量が激減し、遅延がほぼ無くなります
      const maxDim = 640;
      let capW = w;
      let capH = h;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          capW = maxDim;
          capH = Math.round((h * maxDim) / w);
        } else {
          capH = maxDim;
          capW = Math.round((w * maxDim) / h);
        }
      }
      // 4の倍数に丸める (NDIのアライメント要件)
      capW = Math.floor(capW / 4) * 4;
      capH = Math.floor(capH / 4) * 4;

      if (capW <= 0 || capH <= 0) return;

      if (
        !captureCanvas ||
        captureCanvas.width !== capW ||
        captureCanvas.height !== capH
      ) {
        captureCanvas = document.createElement("canvas");
        captureCanvas.width = capW;
        captureCanvas.height = capH;
        captureCtx = captureCanvas.getContext("2d");
      }

      // WebGLキャンバスから2Dキャンバスに上下反転して描画（WebGLの上下逆座標を確実に補正）
      captureCtx.clearRect(0, 0, capW, capH);
      captureCtx.save();
      captureCtx.translate(0, capH);
      captureCtx.scale(1, -1);
      captureCtx.drawImage(canvas, 0, 0, capW, capH);
      captureCtx.restore();

      // 2Dコンテキストからピクセルデータを高速抽出 (RGBA)
      const imgData = captureCtx.getImageData(0, 0, capW, capH);
      const pixels = imgData.data; // Uint8ClampedArray

      // ヘッダー: width(4bytes) + height(4bytes) + timestamp(4bytes)
      const header = new ArrayBuffer(12);
      const view = new DataView(header);
      view.setUint32(0, capW, false);
      view.setUint32(4, capH, false);
      view.setUint32(8, Math.floor(Date.now() / 1000) & 0xffffffff, false);

      // ヘッダー + RGBAピクセルデータを連結
      const combined = new Uint8Array(12 + pixels.length);
      combined.set(new Uint8Array(header), 0);
      combined.set(new Uint8Array(pixels.buffer), 12);

      ndiWs.send(combined.buffer);
    } catch (e) {
      console.error("[NDI] capture error:", e);
      window.ndiStatus = document.getElementById("ndi-status");
      if (ndiStatus) {
        ndiStatus.textContent = "キャプチャエラー: " + e.message;
        ndiStatus.style.color = "#ff4444";
      }
    }
  }

  // NDIトグルイベント
  window.ndiToggle = document.getElementById("ndi-toggle");
  if (ndiToggle) {
    ndiToggle.addEventListener("change", () => {
      if (ndiToggle.checked) {
        ndiEnabled = true;
        connectNdi();
      } else {
        disconnectNdi();
      }
    });
  }

  // =====================================================================
  // 背景画像のアップロード
  // =====================================================================
  window.bgUpload = document.getElementById("bg-upload");
  window.backgroundLayer = document.getElementById("background-layer");
  let currentCropper = null;
  window.cropperModal = document.getElementById("cropper-modal");
  window.cropperImage = document.getElementById("cropper-image");
  window.cropperCancelBtn = document.getElementById("cropper-cancel-btn");
  window.cropperApplyBtn = document.getElementById("cropper-apply-btn");

  if (bgUpload && backgroundLayer && cropperModal) {
    // 保存された背景画像を復元
    const savedBg = localStorage.getItem("savedBackgroundImage");
    if (savedBg) {
      backgroundLayer.style.backgroundImage = `url('${savedBg}')`;
    }

    bgUpload.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        cropperImage.src = event.target.result;
        cropperModal.style.display = "flex";

        if (currentCropper) {
          currentCropper.destroy();
        }

        // Cropperの初期化
        currentCropper = new Cropper(cropperImage, {
          viewMode: 1,
          dragMode: "move",
          autoCropArea: 1,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
        });
      };
      reader.readAsDataURL(file);
      // 同じファイルを再度選べるようにリセット
      e.target.value = "";
    });

    cropperCancelBtn.addEventListener("click", () => {
      cropperModal.style.display = "none";
      if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
      }
    });

    cropperApplyBtn.addEventListener("click", () => {
      if (!currentCropper) return;
      // トリミングした画像のデータURLを取得
      const croppedCanvas = currentCropper.getCroppedCanvas();
      if (croppedCanvas) {
        const croppedDataUrl = croppedCanvas.toDataURL("image/jpeg", 0.8);
        backgroundLayer.style.backgroundImage = `url('${croppedDataUrl}')`;
        // localStorageに保存してリロード後も保持する
        try {
          localStorage.setItem("savedBackgroundImage", croppedDataUrl);
        } catch (e) {
          console.warn("localStorage quota exceeded or unavailable:", e);
          alert(
            "画像サイズが大きすぎるため、次回の表示用に保存できませんでした。もう少し小さくトリミングするか、解像度の低い画像をお試しください。",
          );
        }
      }
      cropperModal.style.display = "none";
      currentCropper.destroy();
      currentCropper = null;
    });
  }
});
