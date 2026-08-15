import {
  NORMAL_PHRASES,
  ZUNDA_PHRASES,
  NORMAL_LONG_STORIES,
  ZUNDA_LONG_STORIES,
} from "./idle_phrases.js";
import * as aiFeaturesModule from "./ai_features.js";
import "./ui_features.js"; // HMR tracking: UI event rebinding without full reload
import uiHtml from "./ui_panel.html?raw"; // Separated UI HTML

window.aiFeatures = aiFeaturesModule;
window.NORMAL_PHRASES = NORMAL_PHRASES;
window.ZUNDA_PHRASES = ZUNDA_PHRASES;
window.NORMAL_LONG_STORIES = NORMAL_LONG_STORIES;
window.ZUNDA_LONG_STORIES = ZUNDA_LONG_STORIES;

// OBS WebSocket instance
window.obsWsClient = null;
window.isObsWsConnected = false;

if (import.meta.hot) {
  import.meta.hot.accept("./ai_features.js", (newModule) => {
    if (newModule) {
      aiFeatures = newModule;
      console.log("[HMR] ai_features.js updated successfully!");
    }
  });
  // ui_features.js が変更されたときUIリスナーだけ再バインドする
  import.meta.hot.accept("./ui_features.js", () => {
    console.log("[HMR] ui_features.js updated - rebinding UI events...");
    if (window.__rebindUI) window.__rebindUI();
  });
  // ui_panel.html が変更されたとき、古いUIを破棄して新しいUIを注入し、再バインドする
  import.meta.hot.accept("./ui_panel.html?raw", (newHtmlModule) => {
    if (newHtmlModule) {
      console.log("[HMR] ui_panel.html updated!");
      const container = document.querySelector(".app-container");
      // Remove old UI elements
      document.getElementById("control-panel")?.remove();
      document.getElementById("toast-container")?.remove();
      document.querySelectorAll(".modal-overlay").forEach((el) => el.remove());

      // Inject new UI
      container.insertAdjacentHTML("beforeend", newHtmlModule.default);

      // DOMが新しくなったため変数の参照が切れる（let/constで定義されているDOM変数）。
      // そのためフルリロードにフォールバックさせるのが最も安全です。
      console.log("[HMR] Forcing full reload due to HTML change...");
      window.location.reload();
    }
  });
}

// Live2D Avatar Studio - Main Controller
// Uses PixiJS v6 + pixi-live2d-display v0.4 (Cubism4 bundle) + MediaPipe

document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] uiHtml type:", typeof uiHtml);
  console.log(
    "[DEBUG] uiHtml length:",
    uiHtml ? uiHtml.length : "null/undefined",
  );
  if (typeof uiHtml === "string") {
    document
      .querySelector(".app-container")
      .insertAdjacentHTML("beforeend", uiHtml);
  } else {
    console.error("[ERROR] uiHtml is not a string:", uiHtml);
  }

  // =====================================================================
  // モデル定義
  // =====================================================================
  window.MODELS = [
    {
      id: "hiyori",
      name: "Hiyori",
      path: "Live2DModels/hiyori_vts/hiyori.model3.json",
      icon: "Live2DModels/hiyori_vts/icon.jpg",
    },
    {
      id: "akari",
      name: "Akari",
      path: "Live2DModels/akari_vts/akari.model3.json",
      icon: "Live2DModels/akari_vts/icon.jpg",
    },
    {
      id: "hijiki",
      name: "Hijiki",
      path: "Live2DModels/hijiki_vts/hijiki.model3.json",
      icon: "Live2DModels/hijiki_vts/icon.jpg",
    },
    {
      id: "tororo",
      name: "Tororo",
      path: "Live2DModels/tororo_vts/tororo.model3.json",
      icon: "Live2DModels/tororo_vts/icon.jpg",
    },
    {
      id: "wanko",
      name: "Wanko",
      path: "Live2DModels/wanko_vts/wanko.model3.json",
      icon: "Live2DModels/wanko_vts/icon.jpg",
    },
  ];

  // =====================================================================
  // DOM
  // =====================================================================
  window.viewport = document.getElementById("avatar-viewport");
  window.canvas = document.getElementById("live2d-canvas");
  window.modelGrid = document.getElementById("model-grid");
  window.loadingOverlay = document.getElementById("loading-overlay");
  window.loadingText = document.getElementById("loading-text");
  window.bgLayer = document.getElementById("background-layer");

  window.cameraTrackToggle = document.getElementById("camera-track-toggle");
  window.cameraStatus = document.getElementById("camera-status");
  window.cameraPreviewToggle = document.getElementById("camera-preview-toggle");
  window.cameraPreviewContainer = document.getElementById(
    "camera-preview-container",
  );
  window.micToggle = document.getElementById("mic-sync-toggle");
  window.micStatus = document.getElementById("mic-status");
  window.autoBlinkToggle = document.getElementById("auto-blink-toggle");
  window.idleAnimToggle = document.getElementById("idle-anim-toggle");
  window.video = document.getElementById("webcam");
  window.handTrackToggle = document.getElementById("hand-track-toggle");
  window.handStatus = document.getElementById("hand-status");

  // 部位Tuber (AR顔被せ) DOM
  window.faceMaskToggle = document.getElementById("face-mask-toggle");
  window.maskStatus = document.getElementById("mask-status");
  window.maskScaleSlider = document.getElementById("mask-scale-slider");
  window.maskScaleVal = document.getElementById("mask-scale-val");
  window.maskOffsetYSlider = document.getElementById("mask-offset-y-slider");
  window.maskOffsetYVal = document.getElementById("mask-offset-y-val");
  window.maskOffsetXSlider = document.getElementById("mask-offset-x-slider");
  window.maskOffsetXVal = document.getElementById("mask-offset-x-val");

  window.faceSensSlider = document.getElementById("face-sensitivity-slider");
  window.faceSensVal = document.getElementById("face-sensitivity-val");
  window.scaleSlider = document.getElementById("scale-slider");
  window.scaleVal = document.getElementById("scale-val");
  window.offsetYSlider = document.getElementById("offset-y-slider");
  window.offsetYVal = document.getElementById("offset-y-val");
  window.offsetXSlider = document.getElementById("offset-x-slider");
  window.offsetXVal = document.getElementById("offset-x-val");
  window.obsUrlInput = document.getElementById("obs-url-input");
  window.copyUrlBtn = document.getElementById("copy-url-btn");
  window.obsGreenToggle = document.getElementById("obs-green-toggle");

  // TikTok & YouTube & VOICEVOX DOM
  window.tiktokUserInput = document.getElementById("tiktok-username-input");
  window.tiktokConnectBtn = document.getElementById("tiktok-connect-btn");
  window.tiktokStatus = document.getElementById("tiktok-status");
  window.youtubeUserInput = document.getElementById("youtube-video-input");
  window.youtubeConnectBtn = document.getElementById("youtube-connect-btn");
  window.youtubeStatus = document.getElementById("youtube-status");
  window.voicevoxToggle = document.getElementById("voicevox-toggle");
  window.voicevoxSpeakerId = document.getElementById("voicevox-speaker-id");

  // デバッグスライダーDOM
  window.debugArmLaSlider = document.getElementById("debug-arm-la");
  window.debugArmLaVal = document.getElementById("debug-arm-la-val");
  window.debugArmLbSlider = document.getElementById("debug-arm-lb");
  window.debugArmLbVal = document.getElementById("debug-arm-lb-val");
  window.debugArmRaSlider = document.getElementById("debug-arm-ra");
  window.debugArmRaVal = document.getElementById("debug-arm-ra-val");
  window.debugArmRbSlider = document.getElementById("debug-arm-rb");
  window.debugArmRbVal = document.getElementById("debug-arm-rb-val");

  // =====================================================================
  // 状態変数
  // =====================================================================
  window.currentModelId = "hiyori";
  window.pixiApp = null;
  window.live2dModel = null;

  window.isCameraActive = false;
  window.isFaceDetected = false;
  window.faceLandmarker = null;
  window.webcamStream = null;
  window.lastVideoTime = -1;
  window.audioContext = null;
  window.analyser = null;

  // Live2D パラメータ (目標値)
  window.tAngleX = 0;
  window.tAngleY = 0;
  window.tAngleZ = 0;
  window.tEyeLOpen = 0.85;
  window.tEyeROpen = 0.85;
  window.aiEmotion = "joy";
  window.aiHiraganaCache = {};
  window.tMouthOpen = 0;
  window.tEyeBallX = 0;
  window.tEyeBallY = 0;
  window.tBreath = 0;

  // 補間済みの現在値
  window.cAngleX = 0;
  window.cAngleY = 0;
  window.cAngleZ = 0;
  window.cEyeLOpen = 0.85;
  window.cEyeROpen = 0.85;
  window.cMouthOpen = 0;
  window.cEyeBallX = 0;
  window.cEyeBallY = 0;
  window.cBreath = 0;

  window.isHandTrackActive = false;
  window.handLandmarker = null;

  // 腕パラメータ目標値・現在値 (腕の切り替え A=下げ, B=上げ)
  window.tArmLA = 0.0;
  window.tArmLB = 0.0;
  window.tArmRA = 0.0;
  window.tArmRB = 0.0;
  window.cArmLA = 0.0;
  window.cArmLB = 0.0;
  window.cArmRA = 0.0;
  window.cArmRB = 0.0;

  // 腕Bの角度・手の形目標値・現在値
  window.tHandLBVal = 0.0;
  window.cHandLBVal = 0.0;
  window.tHandRBVal = 0.0;
  window.cHandRBVal = 0.0;
  window.tHandLForm = 1.0;
  window.cHandLForm = 1.0; // 1.0 = パー, 0.0 = グー
  window.tHandRForm = 1.0;
  window.cHandRForm = 1.0;

  window.faceSensitivity = 1.0;
  window.modelScale = 1.0;
  window.offsetX = 0;
  window.offsetY = 0;

  // 部位Tuber (AR顔被せ) 状態変数
  window.isFaceMaskMode = false;
  window.maskScaleMultiplier = 1.2;
  window.maskOffsetX = 0;
  window.maskOffsetY = 0;

  window.tMaskX = 0;
  window.tMaskY = 0;
  window.tMaskScale = 1.0;
  window.tMaskRotation = 0;

  window.cMaskX = 0;
  window.cMaskY = 0;
  window.cMaskScale = 1.0;
  window.cMaskRotation = 0;

  // TikTok & YouTube & VOICEVOX 状態変数
  window.tiktokWs = null;
  window.youtubeWs = null;
  window.isVoicevoxEnabled = false;
  window.voicevoxAudioQueue = [];
  window.isVoicevoxPlaying = false;
  window.radioCommentQueue = [];

  // ラジオモードの進行状態管理
  window.radioModeState = {
    startTime: null,
    durationMinutes: 30,
    currentPhase: "none", // 'none', 'opening', 'talk', 'ending', 'finished'
    history: [], // 過去の発話履歴
    scriptLines: [], // 事前生成された台本の各行（セリフ）
    scriptYomiLines: [], // 読み上げ用の台本（ひらがな）
    currentScriptIndex: 0, // 次に喋る台本の行インデックス
  };

  window.voicevoxAnalyser = null;
  window.voicevoxAudioContext = null;
  window.voicevoxGainNode = null;
  window.currentVoicevoxSource = null;
  window.currentPlayingIsIdle = false;
  let tVoiceMouthOpen = 0;

  // BGM状態変数
  window.bgmAudioContext = null;
  window.bgmBuffer = null;
  window.bgmSource = null;
  window.bgmGainNode = null;
  window.bgmIsPlaying = false;

  // 瞬き
  let isBlinking = false;
  let blinkTimer = null;

  // 待機アニメーション
  let idleTime = 0;
  let idleGazeX = 0,
    idleGazeY = 0;
  let idleGazeTargetX = 0,
    idleGazeTargetY = 0;
  let lastGazeChange = 0;

  // マウス
  let mouseX = 0,
    mouseY = 0;

  // URLパラメータ
  const urlParams = new URLSearchParams(window.location.search);
  window.isObsMode = urlParams.has("obs");
  window.isGreenMode = urlParams.has("green");
  const urlModel = urlParams.get("model");
  if (urlModel && MODELS.find((m) => m.id === urlModel))
    currentModelId = urlModel;

  // BroadcastChannel
  window.syncChannel = new BroadcastChannel("live2d-avatar-sync");
  let lastSyncTime = 0;

  // NDIストリーミング状態
  let ndiWs = null;
  let ndiEnabled = false;
  let ndiFrameTimer = null;
  let ndiRetryTimer = null;
  const NDI_WS_URL = "ws://localhost:8766";
  const NDI_FPS = 30;

  window.addEventListener("mousemove", (e) => {
    if (isCameraActive) return;
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // =====================================================================
  // PixiJS 初期化
  // =====================================================================
  function initPixi() {
    const w = viewport.clientWidth || window.innerWidth - 320;
    const h = viewport.clientHeight || window.innerHeight;

    pixiApp = new PIXI.Application({
      view: canvas,
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preserveDrawingBuffer: true,
    });

    // pixi-live2d-displayにPixiJS Tickerを登録（アニメーションに必要）
    if (window.PIXI && PIXI.live2d && PIXI.live2d.Live2DModel) {
      PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
      console.log("Live2D Ticker registered");
    }

    window.addEventListener("resize", () => {
      const nw = viewport.clientWidth || window.innerWidth - 320;
      const nh = viewport.clientHeight || window.innerHeight;
      pixiApp.renderer.resize(nw, nh);
      if (live2dModel) window.positionModel();
    });

    // メインループ
    pixiApp.ticker.add((delta) => {
      idleTime += delta;
      updateLive2DParams(delta);
      if (live2dModel) {
        // 手動アップデートを実行（アニメーション/物理/ポーズの処理）
        live2dModel.update(pixiApp.ticker.elapsedMS);

        // アップデート後にHiyori의 腕の表示・非表示を強制的に上書き
        if (currentModelId === "hiyori" && live2dModel.internalModel) {
          try {
            const core = live2dModel.internalModel.coreModel;
            // 左右どちらかの上げ腕(B)が有効化されているなら、PartArmBをフェードイン表示。
            // cArmLB/RB の値の範囲は 0.0 〜 10.0 なので、10.0 で割って不透明度(0.0〜1.0)にします。
            const maxVal = !isHandTrackActive
              ? Math.max(tArmLB, tArmRB)
              : Math.max(cArmLB, cArmRB);
            const opB = Math.max(0.0, Math.min(1.0, maxVal / 10.0));
            try {
              core.setPartOpacityById("PartArmA", 1.0);
            } catch (e) {}
            try {
              core.setPartOpacityById("PartArmB", opB);
            } catch (e) {}
          } catch (e) {}
        }
      }
    });
  }

  // =====================================================================
  // モデルポジション
  // =====================================================================
  window.positionModel = function positionModel() {
    if (!live2dModel || !pixiApp) return;
    const w =
      pixiApp.screen.width || viewport.clientWidth || window.innerWidth - 320;
    const h =
      pixiApp.screen.height || viewport.clientHeight || window.innerHeight;

    if (w === 0 || h === 0) {
      console.warn("positionModel: screen size is 0, retrying...");
      setTimeout(positionModel, 100);
      return;
    }

    // Live2Dモデルの元サイズを取得
    const mw =
      (live2dModel.internalModel && live2dModel.internalModel.originalWidth) ||
      2048;
    const mh =
      (live2dModel.internalModel && live2dModel.internalModel.originalHeight) ||
      2048;

    // 画面に充てるスケールを計算
    const fitScale = Math.min(w / mw, h / mh);
    const finalScale = fitScale * modelScale;

    if (!isFaceMaskMode) {
      live2dModel.scale.set(finalScale);
      live2dModel.pivot.set(mw / 2, mh / 2);
      live2dModel.x = w / 2 + offsetX;
      live2dModel.y = h / 2 + offsetY;
    }

    console.log(
      `Model positioned: scale=${finalScale.toFixed(3)}, x=${live2dModel.x}, y=${live2dModel.y}, mw=${mw}, mh=${mh}`,
    );
  };

  // =====================================================================
  // モデルロード
  // =====================================================================
  window.loadModel = async function loadModel(modelDef) {
    if (!pixiApp) {
      console.error("PixiJS not initialized");
      return;
    }

    loadingOverlay.classList.add("visible");
    loadingText.textContent = `${modelDef.name} を読み込み中...`;

    // pixi-live2d-display が利用可能か確認
    if (!window.PIXI || !PIXI.live2d || !PIXI.live2d.Live2DModel) {
      console.error(
        "pixi-live2d-display が読み込まれていません",
        window.PIXI && PIXI.live2d,
      );
      loadingText.textContent =
        "Live2Dライブラリの読み込みに失敗しました。ページを再読み込みしてください。";
      return;
    }

    try {
      // 既存モデルを削除
      if (live2dModel) {
        pixiApp.stage.removeChild(live2dModel);
        live2dModel.destroy();
        live2dModel = null;
      }

      console.log("Loading model:", modelDef.path);
      const model = await PIXI.live2d.Live2DModel.from(modelDef.path, {
        autoInteract: false,
        autoUpdate: false,
      });

      console.log("Model loaded successfully:", model);
      live2dModel = model;
      window.live2dModel = model;
      window.pixiApp = pixiApp;
      pixiApp.stage.addChild(model);
      window.positionModel();

      // Hiyoriの腕が重複して表示される問題（Pose設定がないため両方の腕が表示される）の対策
      if (modelDef.id === "hiyori" && model.internalModel) {
        try {
          const core = model.internalModel.coreModel;
          try {
            core.setParameterValueById("ParamArmLA", 0.0);
          } catch (e) {}
          try {
            core.setParameterValueById("ParamArmRA", 0.0);
          } catch (e) {}
          try {
            core.setParameterValueById("ParamArmLB", 0.0);
          } catch (e) {}
          try {
            core.setParameterValueById("ParamArmRB", 0.0);
          } catch (e) {}

          try {
            core.setPartOpacityById("PartArmA", 1.0);
          } catch (e) {}
          try {
            core.setPartOpacityById("PartArmB", 0.0);
          } catch (e) {}
        } catch (e) {
          console.warn("Hiyori arm fix failed:", e);
        }
      }

      loadingOverlay.classList.remove("visible");
      currentModelId = modelDef.id;

      document.querySelectorAll(".model-card").forEach((card) => {
        card.classList.toggle(
          "active",
          card.dataset.modelId === currentModelId,
        );
      });

      window.updateObsUrl();
      window.saveSettings();
    } catch (err) {
      console.error("モデルロード失敗:", err);
      loadingText.textContent = `エラー: ${err.message || "不明なエラー"} — コンソールを確認してください`;
      setTimeout(() => loadingOverlay.classList.remove("visible"), 5000);
    }
  };

  // =====================================================================
  // Live2D パラメータ更新 (毎フレーム)
  // =====================================================================
  function updateLive2DParams(delta) {
    if (!live2dModel) return;

    const now = Date.now();
    const isSyncActive = window.isObsMode && now - lastSyncTime < 2000;

    if (!isSyncActive) {
      if (!isCameraActive || !isFaceDetected) {
        if (idleAnimToggle.checked) {
          // 待機アニメーション
          if (now - lastGazeChange > 3000 + Math.random() * 4000) {
            idleGazeTargetX = (Math.random() - 0.5) * 14;
            idleGazeTargetY = (Math.random() - 0.5) * 8;
            lastGazeChange = now;
          }
          idleGazeX += (idleGazeTargetX - idleGazeX) * 0.03;
          idleGazeY += (idleGazeTargetY - idleGazeY) * 0.03;

          const t = idleTime * 0.01;
          tBreath = (Math.sin(t * 0.2) + 1) * 0.5;
          tAngleX = idleGazeX + Math.sin(t * 0.08) * 3;
          tAngleY = idleGazeY + Math.cos(t * 0.12) * 2;
          tAngleZ = Math.sin(t * 0.1) * 2;
          tEyeBallX = idleGazeX / 30;
          tEyeBallY = idleGazeY / 20;
        } else {
          // マウス追従
          tAngleX = mouseX * 30 * faceSensitivity;
          tAngleY = -mouseY * 20 * faceSensitivity;
          tAngleZ = -mouseX * 5;
          tEyeBallX = mouseX * 0.8;
          tEyeBallY = mouseY * 0.8;
        }
      }

      // BroadcastChannel 送信（コントロール側のみ）
      if (!window.isObsMode) {
        window.syncChannel.postMessage({
          type: "live2d-state",
          angleX: tAngleX,
          angleY: tAngleY,
          angleZ: tAngleZ,
          eyeLOpen: tEyeLOpen,
          eyeROpen: tEyeROpen,
          mouthOpen: tMouthOpen,
          eyeBallX: tEyeBallX,
          eyeBallY: tEyeBallY,
          breath: tBreath,
          armLA: tArmLA,
          armLB: tArmLB,
          armRA: tArmRA,
          armRB: tArmRB,
          handLBVal: tHandLBVal,
          handRBVal: tHandRBVal,
          handLForm: tHandLForm,
          handRForm: tHandRForm,
          isHandTrackActive: isHandTrackActive,
          modelId: currentModelId,
        });
      }
    }

    // イージング補間
    const ease = 0.12;
    cAngleX += (tAngleX - cAngleX) * ease;
    cAngleY += (tAngleY - cAngleY) * ease;
    cAngleZ += (tAngleZ - cAngleZ) * ease;
    cEyeLOpen += (tEyeLOpen - cEyeLOpen) * 0.2;
    cEyeROpen += (tEyeROpen - cEyeROpen) * 0.2;

    if (isVoicevoxPlaying && voicevoxAnalyser) {
      const dataArray = new Uint8Array(voicevoxAnalyser.frequencyBinCount);
      voicevoxAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      let avg = sum / dataArray.length;
      tVoiceMouthOpen = Math.min(1.0, avg / 60.0);
    } else {
      tVoiceMouthOpen = 0;
    }
    let finalMouthOpen = Math.max(tMouthOpen, tVoiceMouthOpen);
    cMouthOpen += (finalMouthOpen - cMouthOpen) * 0.15;

    cEyeBallX += (tEyeBallX - cEyeBallX) * 0.1;
    cEyeBallY += (tEyeBallY - cEyeBallY) * 0.1;
    cBreath += (tBreath - cBreath) * 0.05;

    // 腕のイージング補間 (手動デバッグスライダー操作時は直接代入)
    if (!isHandTrackActive) {
      cArmLA = tArmLA;
      cArmLB = tArmLB;
      cArmRA = tArmRA;
      cArmRB = tArmRB;
    } else {
      cArmLA += (tArmLA - cArmLA) * 0.15;
      cArmLB += (tArmLB - cArmLB) * 0.15;
      cArmRA += (tArmRA - cArmRA) * 0.15;
      cArmRB += (tArmRB - cArmRB) * 0.15;
    }

    // 手の形・腕角度のイージング補間
    cHandLBVal += (tHandLBVal - cHandLBVal) * 0.15;
    cHandRBVal += (tHandRBVal - cHandRBVal) * 0.15;
    cHandLForm += (tHandLForm - cHandLForm) * 0.15;
    cHandRForm += (tHandRForm - cHandRForm) * 0.15;

    // Live2D coreModel にパラメータを書き込む
    try {
      const core = live2dModel.internalModel.coreModel;
      const set = (id, v) => {
        try {
          core.setParameterValueById(id, v);
        } catch (e) {}
      };

      set("PARAM_ANGLE_X", cAngleX);
      set("PARAM_ANGLE_Y", cAngleY);
      set("PARAM_ANGLE_Z", cAngleZ);
      set("PARAM_EYE_L_OPEN", cEyeLOpen);
      set("PARAM_EYE_R_OPEN", cEyeROpen);
      set("ParamEyeLOpen", cEyeLOpen);
      set("ParamEyeROpen", cEyeROpen);
      set("PARAM_MOUTH_OPEN_Y", cMouthOpen);
      set("ParamMouthOpenY", cMouthOpen);
      set("PARAM_EYE_BALL_X", cEyeBallX);
      set("PARAM_EYE_BALL_Y", cEyeBallY);
      set("PARAM_BREATH", cBreath);

      // Hiyoriの腕・手パラメータの反映
      if (currentModelId === "hiyori") {
        set("ParamArmLA", cArmLA);
        set("ParamArmRA", cArmRA);
        set("ParamArmLB", cArmLB);
        set("ParamArmRB", cArmRB);
        set("ParamHandLB", cHandLBVal);
        set("ParamHandRB", cHandRBVal);
        set("ParamHandL", cHandLForm);
        set("ParamHandR", cHandRForm);
      } else if (currentModelId === "tororo" || currentModelId === "hijiki") {
        // とろろ・ひじき用のリラックス表情（黒目を太く、少しトロッと）
        set("PARAM_EYE_FORM", 1.0);
        set("PARAM_EYE_L_OPEN", cEyeLOpen * 0.7);
        set("PARAM_EYE_R_OPEN", cEyeROpen * 0.7);
      }
    } catch (e) {}

    // 部位Tuber (AR顔被せ) 追従位置計算
    if (isFaceMaskMode && live2dModel) {
      if (isCameraActive && isFaceDetected) {
        const ease = 0.25;
        cMaskX += (tMaskX - cMaskX) * ease;
        cMaskY += (tMaskY - cMaskY) * ease;
        cMaskScale += (tMaskScale - cMaskScale) * ease;
        cMaskRotation += (tMaskRotation - cMaskRotation) * ease;

        const mw =
          (live2dModel.internalModel &&
            live2dModel.internalModel.originalWidth) ||
          2048;
        const mh =
          (live2dModel.internalModel &&
            live2dModel.internalModel.originalHeight) ||
          2048;

        live2dModel.pivot.set(mw / 2, mh * 0.28);
        live2dModel.x = cMaskX + maskOffsetX;
        live2dModel.y = cMaskY + maskOffsetY;
        live2dModel.scale.set(cMaskScale * maskScaleMultiplier);
        live2dModel.rotation = cMaskRotation;
      } else if (!isCameraActive || !isFaceDetected) {
        live2dModel.rotation = 0;
        window.positionModel();
      }
    }

    // 背景パララックス
    if (!window.isObsMode && !isFaceMaskMode) {
      bgLayer.style.transform = `scale(1.08) translate(${cAngleX * -0.4}px, ${cAngleY * -0.4}px)`;
    }
  }

  // =====================================================================
  // 自動瞬き
  // =====================================================================
  window.scheduleBlink = function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    if (!autoBlinkToggle.checked) return;
    if (window.isObsMode && Date.now() - lastSyncTime < 2000) return;
    if (isCameraActive && isFaceDetected) return;

    const delay = 2000 + Math.random() * 4000;
    blinkTimer = setTimeout(() => {
      if (!autoBlinkToggle.checked || isBlinking) return;
      isBlinking = true;
      tEyeLOpen = 0;
      tEyeROpen = 0;
      setTimeout(() => {
        isBlinking = false;
        tEyeLOpen = 0.85;
        tEyeROpen = 0.85;
        window.scheduleBlink();
      }, 120);
    }, delay);
  };

  autoBlinkToggle.addEventListener("change", () => {
    if (autoBlinkToggle.checked && !isCameraActive) window.scheduleBlink();
    else if (blinkTimer) clearTimeout(blinkTimer);
    window.saveSettings();
  });

  idleAnimToggle.addEventListener("change", () => window.saveSettings());

  // コメントビューアー用関数

  // =====================================================================

  // =====================================================================
  // OBSモード適用
  // =====================================================================
  if (window.isObsMode) {
    document.body.classList.add("obs-mode");
    if (window.isGreenMode) document.body.classList.add("green-mode");
  }

  // =====================================================================
  // アプリ初期化
  // =====================================================================
  // UIイベントバインドは bindUIEvents() の中でではなく、
  // ここで独立して呼び出す
  window.loadSettings();
  window.buildModelGrid();
  initPixi();

  if (window.isIdleSpeechEnabled && typeof resetIdleTimer === "function") {
    resetIdleTimer();
  }

  const initialModel = MODELS.find((m) => m.id === currentModelId) || MODELS[0];
  window.loadModel(initialModel);

  if (autoBlinkToggle.checked && !window.isObsMode) window.scheduleBlink();
  window.updateObsUrl();

  // Browser Autoplay Policy: unlock audio context on first user click/touch/keypress
  window.audioUnlockBanner = document.getElementById("audio-unlock-banner");

  if (!voicevoxAudioContext) {
    voicevoxAudioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }

  const checkAndHideBanner = () => {
    if (voicevoxAudioContext && voicevoxAudioContext.state === "running") {
      if (audioUnlockBanner) audioUnlockBanner.style.display = "none";
      return true;
    }
    return false;
  };

  // 初期状態で許可されているかチェック
  if (!window.isObsMode && !checkAndHideBanner()) {
    if (audioUnlockBanner) audioUnlockBanner.style.display = "block";

    // 許可されていない場合は、少しだけresumeを試みてみる（ブラウザによって挙動が違うため）
    voicevoxAudioContext
      .resume()
      .then(() => {
        checkAndHideBanner();
      })
      .catch((e) => console.warn("Auto resume blocked:", e));
  }

  const unlockAudio = () => {
    if (!voicevoxAudioContext) {
      voicevoxAudioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    if (voicevoxAudioContext.state === "suspended") {
      voicevoxAudioContext
        .resume()
        .catch((e) => console.warn("voicevox auto resume:", e));
    }

    if (
      typeof window.bgmAudioContext !== "undefined" &&
      window.bgmAudioContext &&
      window.bgmAudioContext.state === "suspended"
    ) {
      window.bgmAudioContext
        .resume()
        .catch((e) => console.warn("bgm auto resume:", e));
    }

    setTimeout(() => {
      checkAndHideBanner();
    }, 100);
  };

  // ==========================================
  // ニュース番組モード (News Program Mode)
  // ==========================================
  window.newsFetchBtn = document.getElementById("news-fetch-btn");
  window.newsContinuousToggle = document.getElementById(
    "news-continuous-toggle",
  );
  window.newsRssUrlInput = document.getElementById("news-rss-url");
  window.newsBoard = document.getElementById("news-board");
  window.newsArticleTitle = document.getElementById("news-article-title");
  window.newsArticleDesc = document.getElementById("news-article-desc");
  window.newsArticleDate = document.getElementById("news-article-date");

  window.isContinuousNewsMode = false;
  window.continuousNewsItems = [];
  window.isReadingNews = false;

  // イベントリスナーは常に追加しておき、何度でもリトライできるようにする
  window.addEventListener("click", unlockAudio);
  window.addEventListener("touchend", unlockAudio);
  window.addEventListener("keydown", unlockAudio);

  window.dispatchEvent(new Event("uiLoaded"));
});
