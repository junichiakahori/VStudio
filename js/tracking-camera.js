window.initFaceLandmarker = async function initFaceLandmarker() {
  loadingOverlay.classList.add("visible");
  loadingText.textContent = "AI認識モデルを読み込み中...";
  try {
    const vision =
      await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs");
    const { FilesetResolver, FaceLandmarker } = vision;
    const wasm = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm",
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    loadingOverlay.classList.remove("visible");
  } catch (err) {
    console.error("MediaPipe init failed:", err);
    loadingText.textContent = "顔認識モデルのロード失敗。";
    cameraTrackToggle.checked = false;
    setTimeout(() => loadingOverlay.classList.remove("visible"), 3000);
  }
};
window.initHandLandmarker = async function initHandLandmarker() {
  if (handLandmarker) return;
  loadingOverlay.classList.add("visible");
  loadingText.textContent = "手認識モデルを読み込み中...";
  try {
    const vision =
      await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs");
    const { FilesetResolver, HandLandmarker } = vision;
    const wasm = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm",
    );
    handLandmarker = await HandLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    loadingOverlay.classList.remove("visible");
    console.log("HandLandmarker loaded successfully");
  } catch (err) {
    console.error("MediaPipe Hand init failed:", err);
    loadingText.textContent = "手認識モデルのロード失敗。";
    handTrackToggle.checked = false;
    setTimeout(() => loadingOverlay.classList.remove("visible"), 3000);
  }
};
window.initMic = async function initMic() {
  if (isCameraActive) {
    micToggle.checked = false;
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    micStatus.textContent = "接続中";
    micStatus.classList.add("active");
    function loop() {
      if (!micToggle.checked || isCameraActive) {
        stream.getTracks().forEach((t) => t.stop());
        micStatus.textContent = "マイク無効";
        micStatus.classList.remove("active");
        return;
      }
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      tMouthOpen = Math.min(1, Math.max(0, (avg - 12) / 50));
      requestAnimationFrame(loop);
    }
    loop();
  } catch (err) {
    micStatus.textContent = "許可エラー";
    micToggle.checked = false;
  }
};
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("tracking-camera", () => {
  // =====================================================================
  // MediaPipe 顔トラッキング
  // =====================================================================

  // =====================================================================
  // MediaPipe 手トラッキング
  // =====================================================================

  async function startCamera() {
    if (!faceLandmarker) await window.initFaceLandmarker();
    if (!faceLandmarker) return;

    if (isHandTrackActive && !handLandmarker) {
      await window.initHandLandmarker();
    }

    cameraStatus.textContent = "起動中...";
    if (micToggle.checked) {
      micToggle.checked = false;
      micStatus.textContent = "カメラ優先中";
      micStatus.classList.remove("active");
    }

    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      video.srcObject = webcamStream;
      video.onloadeddata = runCameraLoop;
      isCameraActive = true;
      cameraStatus.textContent = "トラッキング中";
      cameraStatus.classList.add("active");
      if (isHandTrackActive && handLandmarker) {
        handStatus.textContent = "手認識有効";
        handStatus.classList.add("active");
      }
      if (blinkTimer) clearTimeout(blinkTimer);
      if (cameraPreviewToggle.checked)
        cameraPreviewContainer.classList.add("visible");
    } catch (err) {
      cameraStatus.textContent = "許可エラー";
      cameraStatus.classList.remove("active");
      cameraTrackToggle.checked = false;
      window.scheduleBlink();
    }
  }

  function stopCamera() {
    isCameraActive = false;
    isFaceDetected = false;
    cameraStatus.textContent = "カメラ無効";
    cameraStatus.classList.remove("active");
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      webcamStream = null;
    }
    video.srcObject = null;
    video.onloadeddata = null;
    cameraPreviewContainer.classList.remove("visible");
    tEyeLOpen = 0.85;
    tEyeROpen = 0.85;
    tMouthOpen = 0;

    tArmLA = 0.0;
    tArmLB = 0.0;
    tArmRA = 0.0;
    tArmRB = 0.0;
    tHandLBVal = 0.0;
    tHandRBVal = 0.0;
    tHandLForm = 1.0;
    tHandRForm = 1.0;
    if (isHandTrackActive) {
      handStatus.textContent = "手認識一時停止";
      handStatus.classList.remove("active");
    }

    window.scheduleBlink();
  }

  async function runCameraLoop() {
    if (!isCameraActive || !faceLandmarker) return;
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = faceLandmarker.detectForVideo(video, Date.now());

      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        isFaceDetected = true;
        if (blinkTimer) {
          clearTimeout(blinkTimer);
          blinkTimer = null;
        }

        const lm = result.faceLandmarks[0];
        const bs = result.faceBlendshapes[0].categories;

        const nose = lm[4],
          faceL = lm[234],
          faceR = lm[454];
        const forehead = lm[10],
          chin = lm[152];

        const ld = Math.hypot(nose.x - faceL.x, nose.y - faceL.y);
        const rd = Math.hypot(nose.x - faceR.x, nose.y - faceR.y);
        const yaw = ((ld - rd) / (ld + rd)) * 3.5;
        const td = Math.hypot(nose.x - forehead.x, nose.y - forehead.y);
        const bd = Math.hypot(nose.x - chin.x, nose.y - chin.y);
        const pitch = ((td - bd) / (td + bd)) * 3.5 + 0.15;

        tAngleX = -yaw * 30 * faceSensitivity;
        tAngleY = pitch * 30 * faceSensitivity;
        tAngleZ = yaw * 10;
        tEyeBallX = -yaw * 0.8;
        tEyeBallY = pitch * 0.8;

        const getBS = (name) => {
          const c = bs.find((x) => x.categoryName === name);
          return c ? c.score : 0;
        };
        tEyeLOpen = Math.min(
          0.85,
          Math.max(0, 1 - getBS("eyeBlinkLeft") * 2.5),
        );
        tEyeROpen = Math.min(
          0.85,
          Math.max(0, 1 - getBS("eyeBlinkRight") * 2.5),
        );
        tMouthOpen = Math.min(1, Math.max(0, (getBS("jawOpen") - 0.05) / 0.4));
        tBreath = 0.5;

        // 部位Tuber (AR顔被せ) リアルタイム座標・スケール計算
        if (isFaceMaskMode && pixiApp) {
          const vw = pixiApp.screen.width || viewport.clientWidth;
          const vh = pixiApp.screen.height || viewport.clientHeight;

          const videoW = video.videoWidth || 640;
          const videoH = video.videoHeight || 480;

          const videoAspect = videoW / videoH;
          const canvasAspect = vw / vh;

          let rendW = vw,
            rendH = vh;
          let offX = 0,
            offY = 0;

          if (canvasAspect > videoAspect) {
            rendW = vw;
            rendH = vw / videoAspect;
            offY = (rendH - vh) / 2;
          } else {
            rendH = vh;
            rendW = vh * videoAspect;
            offX = (rendW - vw) / 2;
          }

          // MediaPipe: lm[33]は本人の右目, lm[263]は本人の左目
          const eyeR = lm[33],
            eyeL = lm[263];
          const noseBridge = lm[6] || lm[4];
          const screenNormX = 1 - noseBridge.x;
          const screenNormY = noseBridge.y;

          tMaskX = screenNormX * rendW - offX;
          tMaskY = screenNormY * rendH - offY;

          // 鏡像画面上の左目から右目へのベクトル
          const dx = 1 - eyeR.x - (1 - eyeL.x);
          const dy = eyeR.y - eyeL.y;
          tMaskRotation = Math.atan2(dy, dx);

          const faceHNorm = Math.hypot(
            chin.x - forehead.x,
            chin.y - forehead.y,
          );
          const pixelFaceH = faceHNorm * rendH;
          const mw =
            (live2dModel &&
              live2dModel.internalModel &&
              live2dModel.internalModel.originalWidth) ||
            2048;
          const fitScale = Math.min(vw / mw, vh / mw);
          tMaskScale = (pixelFaceH / 220) * fitScale * 1.6;
        }
      } else {
        if (isFaceDetected) {
          isFaceDetected = false;
          tEyeLOpen = 0.85;
          tEyeROpen = 0.85;
          tMouthOpen = 0;
          window.scheduleBlink();
        }
      }

      // =====================================================================
      // ハンドトラッキング処理
      // =====================================================================
      let leftHandDetected = false;
      let rightHandDetected = false;

      if (isHandTrackActive && handLandmarker) {
        const handResult = handLandmarker.detectForVideo(video, Date.now());

        if (handResult.landmarks && handResult.landmarks.length > 0) {
          const info = [];
          for (let j = 0; j < handResult.landmarks.length; j++) {
            const w = handResult.landmarks[j][0];
            const side = w.x > 0.5 ? "左" : "右";
            info.push(`${side}(X:${w.x.toFixed(2)})`);
          }
          handStatus.textContent = `手認識中 (${handResult.landmarks.length}本) [${info.join(", ")}]`;

          for (let i = 0; i < handResult.landmarks.length; i++) {
            const landmarks = handResult.landmarks[i];
            const wrist = landmarks[0];

            // MediaPipeの handedness は誤判定でチャタリングしやすいため、
            // 画面上の手首のX座標(0.0=左端, 1.0=右端)を基準に物理的に左右を決定します。
            // 鏡像反転前提:
            // wrist.x > 0.5 (画面右側) -> ユーザーの左手 -> アバターの左手
            // wrist.x <= 0.5 (画面左側) -> ユーザーの右手 -> アバターの右手
            const isLeftHand = wrist.x > 0.5;

            if (isLeftHand) {
              leftHandDetected = true;

              // 左手首の X 座標をマッピング (画面右側、アバターの左側)
              // 画面上 0.55 〜 0.85 の範囲を考慮
              const wristXNorm = (wrist.x - 0.7) / 0.15; // -1.0 〜 1.0 に近づける
              tHandLBVal = Math.max(-10.0, Math.min(10.0, wristXNorm * 10.0));

              // グーパー判定 (手首から指先までの距離と手首から指の付け根までの距離の比)
              let totalDist = 0;
              const fingerTips = [8, 12, 16, 20];
              fingerTips.forEach((tipIdx) => {
                const tip = landmarks[tipIdx];
                totalDist += Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
              });
              const avgDist = totalDist / fingerTips.length;

              const mcp = landmarks[5];
              const baseDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
              const ratio = avgDist / (baseDist || 0.1);

              // 1.15(グー) 〜 1.6(パー) を 0.0 〜 1.0 にマッピング
              const formVal = (ratio - 1.15) / 0.45;
              tHandLForm = Math.max(0.0, Math.min(1.0, formVal));
            } else {
              rightHandDetected = true;
              const wrist = landmarks[0];

              // 右手首の X 座標をマッピング (画面左側、アバターの右側)
              // 画面上 0.15 〜 0.45 の範囲を考慮 (X座標が小さくなるほど外側)
              const wristXNorm = -(wrist.x - 0.3) / 0.15;
              tHandRBVal = Math.max(-10.0, Math.min(10.0, wristXNorm * 10.0));

              // グーパー判定
              let totalDist = 0;
              const fingerTips = [8, 12, 16, 20];
              fingerTips.forEach((tipIdx) => {
                const tip = landmarks[tipIdx];
                totalDist += Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
              });
              const avgDist = totalDist / fingerTips.length;

              const mcp = landmarks[5];
              const baseDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
              const ratio = avgDist / (baseDist || 0.1);

              const formVal = (ratio - 1.15) / 0.45;
              tHandRForm = Math.max(0.0, Math.min(1.0, formVal));
            }
          }
        } else {
          handStatus.textContent = "手検出なし";
        }
      }

      // デバッグログ
      if (
        isHandTrackActive &&
        typeof handResult !== "undefined" &&
        handResult &&
        handResult.landmarks &&
        handResult.landmarks.length > 0
      ) {
        const wx = handResult.landmarks[0][0].x.toFixed(3);
        console.log(
          `[HAND DEBUG] Landmarks: ${handResult.landmarks.length} | LeftDetected: ${leftHandDetected} | RightDetected: ${rightHandDetected} | WristX: ${wx}`,
        );
      }

      // 検出状態の目標値への反映
      if (isHandTrackActive) {
        if (leftHandDetected) {
          tArmLA = -10.0;
          tArmLB = 10.0;
        } else {
          tArmLA = 0.0;
          tArmLB = 0.0;
          tHandLBVal = 0.0;
          tHandLForm = 1.0;
        }
        if (rightHandDetected) {
          tArmRA = -10.0;
          tArmRB = 10.0;
        } else {
          tArmRA = 0.0;
          tArmRB = 0.0;
          tHandRBVal = 0.0;
          tHandRForm = 1.0;
        }
      }
    }
    requestAnimationFrame(runCameraLoop);
  }

  cameraTrackToggle.addEventListener("change", () => {
    if (cameraTrackToggle.checked) startCamera();
    else stopCamera();
    window.saveSettings();
  });

  cameraPreviewToggle.addEventListener("change", () => {
    if (isCameraActive && cameraPreviewToggle.checked)
      cameraPreviewContainer.classList.add("visible");
    else cameraPreviewContainer.classList.remove("visible");
    window.saveSettings();
  });

  handTrackToggle.addEventListener("change", async () => {
    if (handTrackToggle.checked) {
      isHandTrackActive = true;
      handStatus.textContent = "初期化中...";
      handStatus.classList.add("active");
      await window.initHandLandmarker();
      if (handLandmarker) {
        handStatus.textContent = "手認識有効";
        if (!isCameraActive) {
          cameraTrackToggle.checked = true;
          await startCamera();
        }
      } else {
        isHandTrackActive = false;
        handTrackToggle.checked = false;
        handStatus.textContent = "初期化失敗";
        handStatus.classList.remove("active");
      }
    } else {
      isHandTrackActive = false;
      handStatus.textContent = "手認識無効";
      handStatus.classList.remove("active");
      tArmLA = 0.0;
      tArmLB = 0.0;
      tArmRA = 0.0;
      tArmRB = 0.0;
      tHandLBVal = 0.0;
      tHandRBVal = 0.0;
      tHandLForm = 1.0;
      tHandRForm = 1.0;
    }
    window.saveSettings();
  });

  // =====================================================================
  // マイク
  // =====================================================================

  micToggle.addEventListener("change", () => {
    if (micToggle.checked) window.initMic();
    else {
      if (audioContext) audioContext.close();
      micStatus.textContent = "マイク無効";
      micStatus.classList.remove("active");
      tMouthOpen = 0;
    }
    window.saveSettings();
  });
});
