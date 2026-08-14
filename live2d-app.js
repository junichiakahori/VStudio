import { NORMAL_PHRASES, ZUNDA_PHRASES, NORMAL_LONG_STORIES, ZUNDA_LONG_STORIES } from './idle_phrases.js';
import * as aiFeaturesModule from './ai_features.js';
import './ui_features.js'; // HMR tracking: UI event rebinding without full reload
import uiHtml from './ui_panel.html?raw'; // Separated UI HTML

let aiFeatures = aiFeaturesModule;

// OBS WebSocket instance
let obsWsClient = null;
let isObsWsConnected = false;

if (import.meta.hot) {
    import.meta.hot.accept('./ai_features.js', (newModule) => {
        if (newModule) {
            aiFeatures = newModule;
            console.log('[HMR] ai_features.js updated successfully!');
        }
    });
    // ui_features.js が変更されたときUIリスナーだけ再バインドする
    import.meta.hot.accept('./ui_features.js', () => {
        console.log('[HMR] ui_features.js updated - rebinding UI events...');
        if (window.__rebindUI) window.__rebindUI();
    });
    // ui_panel.html が変更されたとき、古いUIを破棄して新しいUIを注入し、再バインドする
    import.meta.hot.accept('./ui_panel.html?raw', (newHtmlModule) => {
        if (newHtmlModule) {
            console.log('[HMR] ui_panel.html updated!');
            const container = document.querySelector('.app-container');
            // Remove old UI elements
            document.getElementById('control-panel')?.remove();
            document.getElementById('toast-container')?.remove();
            document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

            // Inject new UI
            container.insertAdjacentHTML('beforeend', newHtmlModule.default);

            // DOMが新しくなったため変数の参照が切れる（let/constで定義されているDOM変数）。
            // そのためフルリロードにフォールバックさせるのが最も安全です。
            console.log('[HMR] Forcing full reload due to HTML change...');
            window.location.reload();
        }
    });
}

// Live2D Avatar Studio - Main Controller
// Uses PixiJS v6 + pixi-live2d-display v0.4 (Cubism4 bundle) + MediaPipe

document.addEventListener('DOMContentLoaded', () => {

    console.log('[DEBUG] uiHtml type:', typeof uiHtml);
    console.log('[DEBUG] uiHtml length:', uiHtml ? uiHtml.length : 'null/undefined');
    if (typeof uiHtml === 'string') {
        document.querySelector('.app-container').insertAdjacentHTML('beforeend', uiHtml);
    } else {
        console.error('[ERROR] uiHtml is not a string:', uiHtml);
    }

    // =====================================================================
    // モデル定義
    // =====================================================================
    const MODELS = [
        { id: 'hiyori', name: 'Hiyori', path: 'Live2DModels/hiyori_vts/hiyori.model3.json', icon: 'Live2DModels/hiyori_vts/icon.jpg' },
        { id: 'akari', name: 'Akari', path: 'Live2DModels/akari_vts/akari.model3.json', icon: 'Live2DModels/akari_vts/icon.jpg' },
        { id: 'hijiki', name: 'Hijiki', path: 'Live2DModels/hijiki_vts/hijiki.model3.json', icon: 'Live2DModels/hijiki_vts/icon.jpg' },
        { id: 'tororo', name: 'Tororo', path: 'Live2DModels/tororo_vts/tororo.model3.json', icon: 'Live2DModels/tororo_vts/icon.jpg' },
        { id: 'wanko', name: 'Wanko', path: 'Live2DModels/wanko_vts/wanko.model3.json', icon: 'Live2DModels/wanko_vts/icon.jpg' },
    ];

    // =====================================================================
    // DOM
    // =====================================================================
    const viewport = document.getElementById('avatar-viewport');
    const canvas = document.getElementById('live2d-canvas');
    const modelGrid = document.getElementById('model-grid');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const bgLayer = document.getElementById('background-layer');

    const cameraTrackToggle = document.getElementById('camera-track-toggle');
    const cameraStatus = document.getElementById('camera-status');
    const cameraPreviewToggle = document.getElementById('camera-preview-toggle');
    const cameraPreviewContainer = document.getElementById('camera-preview-container');
    const micToggle = document.getElementById('mic-sync-toggle');
    const micStatus = document.getElementById('mic-status');
    const autoBlinkToggle = document.getElementById('auto-blink-toggle');
    const idleAnimToggle = document.getElementById('idle-anim-toggle');
    const video = document.getElementById('webcam');
    const handTrackToggle = document.getElementById('hand-track-toggle');
    const handStatus = document.getElementById('hand-status');

    // 部位Tuber (AR顔被せ) DOM
    const faceMaskToggle = document.getElementById('face-mask-toggle');
    const maskStatus = document.getElementById('mask-status');
    const maskScaleSlider = document.getElementById('mask-scale-slider');
    const maskScaleVal = document.getElementById('mask-scale-val');
    const maskOffsetYSlider = document.getElementById('mask-offset-y-slider');
    const maskOffsetYVal = document.getElementById('mask-offset-y-val');
    const maskOffsetXSlider = document.getElementById('mask-offset-x-slider');
    const maskOffsetXVal = document.getElementById('mask-offset-x-val');

    const faceSensSlider = document.getElementById('face-sensitivity-slider');
    const faceSensVal = document.getElementById('face-sensitivity-val');
    const scaleSlider = document.getElementById('scale-slider');
    const scaleVal = document.getElementById('scale-val');
    const offsetYSlider = document.getElementById('offset-y-slider');
    const offsetYVal = document.getElementById('offset-y-val');
    const offsetXSlider = document.getElementById('offset-x-slider');
    const offsetXVal = document.getElementById('offset-x-val');
    const obsUrlInput = document.getElementById('obs-url-input');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const obsGreenToggle = document.getElementById('obs-green-toggle');

    // TikTok & YouTube & VOICEVOX DOM
    const tiktokUserInput = document.getElementById('tiktok-username-input');
    const tiktokConnectBtn = document.getElementById('tiktok-connect-btn');
    const tiktokStatus = document.getElementById('tiktok-status');
    const youtubeUserInput = document.getElementById('youtube-video-input');
    const youtubeConnectBtn = document.getElementById('youtube-connect-btn');
    const youtubeStatus = document.getElementById('youtube-status');
    const voicevoxToggle = document.getElementById('voicevox-toggle');
    const voicevoxSpeakerId = document.getElementById('voicevox-speaker-id');

    // デバッグスライダーDOM
    const debugArmLaSlider = document.getElementById('debug-arm-la');
    const debugArmLaVal = document.getElementById('debug-arm-la-val');
    const debugArmLbSlider = document.getElementById('debug-arm-lb');
    const debugArmLbVal = document.getElementById('debug-arm-lb-val');
    const debugArmRaSlider = document.getElementById('debug-arm-ra');
    const debugArmRaVal = document.getElementById('debug-arm-ra-val');
    const debugArmRbSlider = document.getElementById('debug-arm-rb');
    const debugArmRbVal = document.getElementById('debug-arm-rb-val');

    // =====================================================================
    // 状態変数
    // =====================================================================
    let currentModelId = 'hiyori';
    let pixiApp = null;
    let live2dModel = null;

    let isCameraActive = false;
    let isFaceDetected = false;
    let faceLandmarker = null;
    let webcamStream = null;
    let lastVideoTime = -1;
    let audioContext = null;
    let analyser = null;

    // Live2D パラメータ (目標値)
    let tAngleX = 0, tAngleY = 0, tAngleZ = 0;
    let tEyeLOpen = 0.85, tEyeROpen = 0.85;
    let aiEmotion = 'joy';
    let aiHiraganaCache = {};
    let tMouthOpen = 0;
    let tEyeBallX = 0, tEyeBallY = 0;
    let tBreath = 0;

    // 補間済みの現在値
    let cAngleX = 0, cAngleY = 0, cAngleZ = 0;
    let cEyeLOpen = 0.85, cEyeROpen = 0.85;
    let cMouthOpen = 0;
    let cEyeBallX = 0, cEyeBallY = 0;
    let cBreath = 0;

    let isHandTrackActive = false;
    let handLandmarker = null;

    // 腕パラメータ目標値・現在値 (腕の切り替え A=下げ, B=上げ)
    let tArmLA = 0.0, tArmLB = 0.0;
    let tArmRA = 0.0, tArmRB = 0.0;
    let cArmLA = 0.0, cArmLB = 0.0;
    let cArmRA = 0.0, cArmRB = 0.0;

    // 腕Bの角度・手の形目標値・現在値
    let tHandLBVal = 0.0, cHandLBVal = 0.0;
    let tHandRBVal = 0.0, cHandRBVal = 0.0;
    let tHandLForm = 1.0, cHandLForm = 1.0; // 1.0 = パー, 0.0 = グー
    let tHandRForm = 1.0, cHandRForm = 1.0;

    let faceSensitivity = 1.0;
    let modelScale = 1.0;
    let offsetX = 0;
    let offsetY = 0;

    // 部位Tuber (AR顔被せ) 状態変数
    let isFaceMaskMode = false;
    let maskScaleMultiplier = 1.2;
    let maskOffsetX = 0;
    let maskOffsetY = 0;

    let tMaskX = 0, tMaskY = 0;
    let tMaskScale = 1.0;
    let tMaskRotation = 0;

    let cMaskX = 0, cMaskY = 0;
    let cMaskScale = 1.0;
    let cMaskRotation = 0;

    // TikTok & YouTube & VOICEVOX 状態変数
    let tiktokWs = null;
    let youtubeWs = null;
    let isVoicevoxEnabled = false;
    let voicevoxAudioQueue = [];
    let isVoicevoxPlaying = false;

    // ラジオモードの進行状態管理
    let radioModeState = {
        startTime: null,
        durationMinutes: 30,
        currentPhase: 'none', // 'none', 'opening', 'talk', 'ending', 'finished'
        history: [], // 過去の発話履歴
        scriptLines: [], // 事前生成された台本の各行（セリフ）
        scriptYomiLines: [], // 読み上げ用の台本（ひらがな）
        currentScriptIndex: 0 // 次に喋る台本の行インデックス
    };

    let voicevoxAnalyser = null;
    let voicevoxAudioContext = null;
    let voicevoxGainNode = null;
    let currentVoicevoxSource = null;
    let currentPlayingIsIdle = false;
    let tVoiceMouthOpen = 0;

    // BGM状態変数
    let bgmAudioContext = null;
    let bgmBuffer = null;
    let bgmSource = null;
    let bgmGainNode = null;
    let bgmIsPlaying = false;

    // 瞬き
    let isBlinking = false;
    let blinkTimer = null;

    // 待機アニメーション
    let idleTime = 0;
    let idleGazeX = 0, idleGazeY = 0;
    let idleGazeTargetX = 0, idleGazeTargetY = 0;
    let lastGazeChange = 0;

    // マウス
    let mouseX = 0, mouseY = 0;

    // URLパラメータ
    const urlParams = new URLSearchParams(window.location.search);
    const isObsMode = urlParams.has('obs');
    const isGreenMode = urlParams.has('green');
    const urlModel = urlParams.get('model');
    if (urlModel && MODELS.find(m => m.id === urlModel)) currentModelId = urlModel;

    // BroadcastChannel
    const syncChannel = new BroadcastChannel('live2d-avatar-sync');
    let lastSyncTime = 0;

    // NDIストリーミング状態
    let ndiWs = null;
    let ndiEnabled = false;
    let ndiFrameTimer = null;
    let ndiRetryTimer = null;
    const NDI_WS_URL = 'ws://localhost:8766';
    const NDI_FPS = 30;

    window.addEventListener('mousemove', (e) => {
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
            console.log('Live2D Ticker registered');
        }

        window.addEventListener('resize', () => {
            const nw = viewport.clientWidth || window.innerWidth - 320;
            const nh = viewport.clientHeight || window.innerHeight;
            pixiApp.renderer.resize(nw, nh);
            if (live2dModel) positionModel();
        });

        // メインループ
        pixiApp.ticker.add((delta) => {
            idleTime += delta;
            updateLive2DParams(delta);
            if (live2dModel) {
                // 手動アップデートを実行（アニメーション/物理/ポーズの処理）
                live2dModel.update(pixiApp.ticker.elapsedMS);

                // アップデート後にHiyori의 腕の表示・非表示を強制的に上書き
                if (currentModelId === 'hiyori' && live2dModel.internalModel) {
                    try {
                        const core = live2dModel.internalModel.coreModel;
                        // 左右どちらかの上げ腕(B)が有効化されているなら、PartArmBをフェードイン表示。
                        // cArmLB/RB の値の範囲は 0.0 〜 10.0 なので、10.0 で割って不透明度(0.0〜1.0)にします。
                        const maxVal = !isHandTrackActive ? Math.max(tArmLB, tArmRB) : Math.max(cArmLB, cArmRB);
                        const opB = Math.max(0.0, Math.min(1.0, maxVal / 10.0));
                        try { core.setPartOpacityById('PartArmA', 1.0); } catch (e) { }
                        try { core.setPartOpacityById('PartArmB', opB); } catch (e) { }
                    } catch (e) { }
                }
            }
        });
    }

    // =====================================================================
    // モデルポジション
    // =====================================================================
    function positionModel() {
        if (!live2dModel || !pixiApp) return;
        const w = pixiApp.screen.width || (viewport.clientWidth || window.innerWidth - 320);
        const h = pixiApp.screen.height || (viewport.clientHeight || window.innerHeight);

        if (w === 0 || h === 0) {
            console.warn('positionModel: screen size is 0, retrying...');
            setTimeout(positionModel, 100);
            return;
        }

        // Live2Dモデルの元サイズを取得
        const mw = (live2dModel.internalModel && live2dModel.internalModel.originalWidth) || 2048;
        const mh = (live2dModel.internalModel && live2dModel.internalModel.originalHeight) || 2048;

        // 画面に充てるスケールを計算
        const fitScale = Math.min(w / mw, h / mh);
        const finalScale = fitScale * modelScale;

        if (!isFaceMaskMode) {
            live2dModel.scale.set(finalScale);
            live2dModel.pivot.set(mw / 2, mh / 2);
            live2dModel.x = w / 2 + offsetX;
            live2dModel.y = h / 2 + offsetY;
        }

        console.log(`Model positioned: scale=${finalScale.toFixed(3)}, x=${live2dModel.x}, y=${live2dModel.y}, mw=${mw}, mh=${mh}`);
    }

    // =====================================================================
    // モデルロード
    // =====================================================================
    async function loadModel(modelDef) {
        if (!pixiApp) { console.error('PixiJS not initialized'); return; }

        loadingOverlay.classList.add('visible');
        loadingText.textContent = `${modelDef.name} を読み込み中...`;

        // pixi-live2d-display が利用可能か確認
        if (!window.PIXI || !PIXI.live2d || !PIXI.live2d.Live2DModel) {
            console.error('pixi-live2d-display が読み込まれていません', window.PIXI && PIXI.live2d);
            loadingText.textContent = 'Live2Dライブラリの読み込みに失敗しました。ページを再読み込みしてください。';
            return;
        }

        try {
            // 既存モデルを削除
            if (live2dModel) {
                pixiApp.stage.removeChild(live2dModel);
                live2dModel.destroy();
                live2dModel = null;
            }

            console.log('Loading model:', modelDef.path);
            const model = await PIXI.live2d.Live2DModel.from(modelDef.path, {
                autoInteract: false,
                autoUpdate: false,
            });

            console.log('Model loaded successfully:', model);
            live2dModel = model;
            window.live2dModel = model;
            window.pixiApp = pixiApp;
            pixiApp.stage.addChild(model);
            positionModel();

            // Hiyoriの腕が重複して表示される問題（Pose設定がないため両方の腕が表示される）の対策
            if (modelDef.id === 'hiyori' && model.internalModel) {
                try {
                    const core = model.internalModel.coreModel;
                    try { core.setParameterValueById('ParamArmLA', 0.0); } catch (e) { }
                    try { core.setParameterValueById('ParamArmRA', 0.0); } catch (e) { }
                    try { core.setParameterValueById('ParamArmLB', 0.0); } catch (e) { }
                    try { core.setParameterValueById('ParamArmRB', 0.0); } catch (e) { }

                    try { core.setPartOpacityById('PartArmA', 1.0); } catch (e) { }
                    try { core.setPartOpacityById('PartArmB', 0.0); } catch (e) { }
                } catch (e) {
                    console.warn('Hiyori arm fix failed:', e);
                }
            }



            loadingOverlay.classList.remove('visible');
            currentModelId = modelDef.id;

            document.querySelectorAll('.model-card').forEach(card => {
                card.classList.toggle('active', card.dataset.modelId === currentModelId);
            });

            updateObsUrl();
            saveSettings();

        } catch (err) {
            console.error('モデルロード失敗:', err);
            loadingText.textContent = `エラー: ${err.message || '不明なエラー'} — コンソールを確認してください`;
            setTimeout(() => loadingOverlay.classList.remove('visible'), 5000);
        }
    }

    // =====================================================================
    // Live2D パラメータ更新 (毎フレーム)
    // =====================================================================
    function updateLive2DParams(delta) {
        if (!live2dModel) return;

        const now = Date.now();
        const isSyncActive = isObsMode && (now - lastSyncTime < 2000);

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
                    tAngleZ = Math.sin(t * 0.10) * 2;
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
            if (!isObsMode) {
                syncChannel.postMessage({
                    type: 'live2d-state',
                    angleX: tAngleX, angleY: tAngleY, angleZ: tAngleZ,
                    eyeLOpen: tEyeLOpen, eyeROpen: tEyeROpen,
                    mouthOpen: tMouthOpen,
                    eyeBallX: tEyeBallX, eyeBallY: tEyeBallY,
                    breath: tBreath,
                    armLA: tArmLA, armLB: tArmLB,
                    armRA: tArmRA, armRB: tArmRB,
                    handLBVal: tHandLBVal, handRBVal: tHandRBVal,
                    handLForm: tHandLForm, handRForm: tHandRForm,
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
            const set = (id, v) => { try { core.setParameterValueById(id, v); } catch (e) { } };

            set('PARAM_ANGLE_X', cAngleX);
            set('PARAM_ANGLE_Y', cAngleY);
            set('PARAM_ANGLE_Z', cAngleZ);
            set('PARAM_EYE_L_OPEN', cEyeLOpen);
            set('PARAM_EYE_R_OPEN', cEyeROpen);
            set('ParamEyeLOpen', cEyeLOpen);
            set('ParamEyeROpen', cEyeROpen);
            set('PARAM_MOUTH_OPEN_Y', cMouthOpen);
            set('ParamMouthOpenY', cMouthOpen);
            set('PARAM_EYE_BALL_X', cEyeBallX);
            set('PARAM_EYE_BALL_Y', cEyeBallY);
            set('PARAM_BREATH', cBreath);

            // Hiyoriの腕・手パラメータの反映
            if (currentModelId === 'hiyori') {
                set('ParamArmLA', cArmLA);
                set('ParamArmRA', cArmRA);
                set('ParamArmLB', cArmLB);
                set('ParamArmRB', cArmRB);
                set('ParamHandLB', cHandLBVal);
                set('ParamHandRB', cHandRBVal);
                set('ParamHandL', cHandLForm);
                set('ParamHandR', cHandRForm);
            } else if (currentModelId === 'tororo' || currentModelId === 'hijiki') {
                // とろろ・ひじき用のリラックス表情（黒目を太く、少しトロッと）
                set('PARAM_EYE_FORM', 1.0);
                set('PARAM_EYE_L_OPEN', cEyeLOpen * 0.7);
                set('PARAM_EYE_R_OPEN', cEyeROpen * 0.7);
            }
        } catch (e) { }

        // 部位Tuber (AR顔被せ) 追従位置計算
        if (isFaceMaskMode && live2dModel) {
            if (isCameraActive && isFaceDetected) {
                const ease = 0.25;
                cMaskX += (tMaskX - cMaskX) * ease;
                cMaskY += (tMaskY - cMaskY) * ease;
                cMaskScale += (tMaskScale - cMaskScale) * ease;
                cMaskRotation += (tMaskRotation - cMaskRotation) * ease;

                const mw = (live2dModel.internalModel && live2dModel.internalModel.originalWidth) || 2048;
                const mh = (live2dModel.internalModel && live2dModel.internalModel.originalHeight) || 2048;

                live2dModel.pivot.set(mw / 2, mh * 0.28);
                live2dModel.x = cMaskX + maskOffsetX;
                live2dModel.y = cMaskY + maskOffsetY;
                live2dModel.scale.set(cMaskScale * maskScaleMultiplier);
                live2dModel.rotation = cMaskRotation;
            } else if (!isCameraActive || !isFaceDetected) {
                live2dModel.rotation = 0;
                positionModel();
            }
        }

        // 背景パララックス
        if (!isObsMode && !isFaceMaskMode) {
            bgLayer.style.transform = `scale(1.08) translate(${cAngleX * -0.4}px, ${cAngleY * -0.4}px)`;
        }
    }

    // =====================================================================
    // 自動瞬き
    // =====================================================================
    function scheduleBlink() {
        if (blinkTimer) clearTimeout(blinkTimer);
        if (!autoBlinkToggle.checked) return;
        if (isObsMode && (Date.now() - lastSyncTime < 2000)) return;
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
                scheduleBlink();
            }, 120);
        }, delay);
    }

    autoBlinkToggle.addEventListener('change', () => {
        if (autoBlinkToggle.checked && !isCameraActive) scheduleBlink();
        else if (blinkTimer) clearTimeout(blinkTimer);
        saveSettings();
    });

    idleAnimToggle.addEventListener('change', () => saveSettings());

    // =====================================================================
    // MediaPipe 顔トラッキング
    // =====================================================================
    async function initFaceLandmarker() {
        loadingOverlay.classList.add('visible');
        loadingText.textContent = 'AI認識モデルを読み込み中...';
        try {
            const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs');
            const { FilesetResolver, FaceLandmarker } = vision;
            const wasm = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
            );
            faceLandmarker = await FaceLandmarker.createFromOptions(wasm, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                outputFaceBlendshapes: true,
                runningMode: 'VIDEO',
                numFaces: 1
            });
            loadingOverlay.classList.remove('visible');
        } catch (err) {
            console.error('MediaPipe init failed:', err);
            loadingText.textContent = '顔認識モデルのロード失敗。';
            cameraTrackToggle.checked = false;
            setTimeout(() => loadingOverlay.classList.remove('visible'), 3000);
        }
    }

    // =====================================================================
    // MediaPipe 手トラッキング
    // =====================================================================
    async function initHandLandmarker() {
        if (handLandmarker) return;
        loadingOverlay.classList.add('visible');
        loadingText.textContent = '手認識モデルを読み込み中...';
        try {
            const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs');
            const { FilesetResolver, HandLandmarker } = vision;
            const wasm = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
            );
            handLandmarker = await HandLandmarker.createFromOptions(wasm, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numHands: 2
            });
            loadingOverlay.classList.remove('visible');
            console.log('HandLandmarker loaded successfully');
        } catch (err) {
            console.error('MediaPipe Hand init failed:', err);
            loadingText.textContent = '手認識モデルのロード失敗。';
            handTrackToggle.checked = false;
            setTimeout(() => loadingOverlay.classList.remove('visible'), 3000);
        }
    }

    async function startCamera() {
        if (!faceLandmarker) await initFaceLandmarker();
        if (!faceLandmarker) return;

        if (isHandTrackActive && !handLandmarker) {
            await initHandLandmarker();
        }

        cameraStatus.textContent = '起動中...';
        if (micToggle.checked) { micToggle.checked = false; micStatus.textContent = 'カメラ優先中'; micStatus.classList.remove('active'); }

        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
            video.srcObject = webcamStream;
            video.onloadeddata = runCameraLoop;
            isCameraActive = true;
            cameraStatus.textContent = 'トラッキング中';
            cameraStatus.classList.add('active');
            if (isHandTrackActive && handLandmarker) {
                handStatus.textContent = '手認識有効';
                handStatus.classList.add('active');
            }
            if (blinkTimer) clearTimeout(blinkTimer);
            if (cameraPreviewToggle.checked) cameraPreviewContainer.classList.add('visible');
        } catch (err) {
            cameraStatus.textContent = '許可エラー';
            cameraStatus.classList.remove('active');
            cameraTrackToggle.checked = false;
            scheduleBlink();
        }
    }

    function stopCamera() {
        isCameraActive = false; isFaceDetected = false;
        cameraStatus.textContent = 'カメラ無効'; cameraStatus.classList.remove('active');
        if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }
        video.srcObject = null;
        video.onloadeddata = null;
        cameraPreviewContainer.classList.remove('visible');
        tEyeLOpen = 0.85; tEyeROpen = 0.85; tMouthOpen = 0;

        tArmLA = 0.0; tArmLB = 0.0;
        tArmRA = 0.0; tArmRB = 0.0;
        tHandLBVal = 0.0; tHandRBVal = 0.0;
        tHandLForm = 1.0; tHandRForm = 1.0;
        if (isHandTrackActive) {
            handStatus.textContent = '手認識一時停止';
            handStatus.classList.remove('active');
        }

        scheduleBlink();
    }

    async function runCameraLoop() {
        if (!isCameraActive || !faceLandmarker) return;
        if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const result = faceLandmarker.detectForVideo(video, Date.now());

            if (result.faceLandmarks && result.faceLandmarks.length > 0) {
                isFaceDetected = true;
                if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null; }

                const lm = result.faceLandmarks[0];
                const bs = result.faceBlendshapes[0].categories;

                const nose = lm[4], faceL = lm[234], faceR = lm[454];
                const forehead = lm[10], chin = lm[152];

                const ld = Math.hypot(nose.x - faceL.x, nose.y - faceL.y);
                const rd = Math.hypot(nose.x - faceR.x, nose.y - faceR.y);
                const yaw = (ld - rd) / (ld + rd) * 3.5;
                const td = Math.hypot(nose.x - forehead.x, nose.y - forehead.y);
                const bd = Math.hypot(nose.x - chin.x, nose.y - chin.y);
                const pitch = (td - bd) / (td + bd) * 3.5 + 0.15;

                tAngleX = -yaw * 30 * faceSensitivity;
                tAngleY = pitch * 30 * faceSensitivity;
                tAngleZ = yaw * 10;
                tEyeBallX = -yaw * 0.8;
                tEyeBallY = pitch * 0.8;

                const getBS = name => { const c = bs.find(x => x.categoryName === name); return c ? c.score : 0; };
                tEyeLOpen = Math.min(0.85, Math.max(0, 1 - getBS('eyeBlinkLeft') * 2.5));
                tEyeROpen = Math.min(0.85, Math.max(0, 1 - getBS('eyeBlinkRight') * 2.5));
                tMouthOpen = Math.min(1, Math.max(0, (getBS('jawOpen') - 0.05) / 0.4));
                tBreath = 0.5;

                // 部位Tuber (AR顔被せ) リアルタイム座標・スケール計算
                if (isFaceMaskMode && pixiApp) {
                    const vw = pixiApp.screen.width || viewport.clientWidth;
                    const vh = pixiApp.screen.height || viewport.clientHeight;

                    const videoW = video.videoWidth || 640;
                    const videoH = video.videoHeight || 480;

                    const videoAspect = videoW / videoH;
                    const canvasAspect = vw / vh;

                    let rendW = vw, rendH = vh;
                    let offX = 0, offY = 0;

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
                    const eyeR = lm[33], eyeL = lm[263];
                    const noseBridge = lm[6] || lm[4];
                    const screenNormX = 1 - noseBridge.x;
                    const screenNormY = noseBridge.y;

                    tMaskX = screenNormX * rendW - offX;
                    tMaskY = screenNormY * rendH - offY;

                    // 鏡像画面上の左目から右目へのベクトル
                    const dx = (1 - eyeR.x) - (1 - eyeL.x);
                    const dy = eyeR.y - eyeL.y;
                    tMaskRotation = Math.atan2(dy, dx);

                    const faceHNorm = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
                    const pixelFaceH = faceHNorm * rendH;
                    const mw = (live2dModel && live2dModel.internalModel && live2dModel.internalModel.originalWidth) || 2048;
                    const fitScale = Math.min(vw / mw, vh / mw);
                    tMaskScale = (pixelFaceH / 220) * fitScale * 1.6;
                }

            } else {
                if (isFaceDetected) {
                    isFaceDetected = false;
                    tEyeLOpen = 0.85; tEyeROpen = 0.85; tMouthOpen = 0;
                    scheduleBlink();
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
                        const side = w.x > 0.5 ? '左' : '右';
                        info.push(`${side}(X:${w.x.toFixed(2)})`);
                    }
                    handStatus.textContent = `手認識中 (${handResult.landmarks.length}本) [${info.join(', ')}]`;

                    for (let i = 0; i < handResult.landmarks.length; i++) {
                        const landmarks = handResult.landmarks[i];
                        const wrist = landmarks[0];

                        // MediaPipeの handedness は誤判定でチャタリングしやすいため、
                        // 画面上の手首のX座標(0.0=左端, 1.0=右端)を基準に物理的に左右を決定します。
                        // 鏡像反転前提:
                        // wrist.x > 0.5 (画面右側) -> ユーザーの左手 -> アバターの左手
                        // wrist.x <= 0.5 (画面左側) -> ユーザーの右手 -> アバターの右手
                        const isLeftHand = (wrist.x > 0.5);

                        if (isLeftHand) {
                            leftHandDetected = true;

                            // 左手首の X 座標をマッピング (画面右側、アバターの左側)
                            // 画面上 0.55 〜 0.85 の範囲を考慮
                            const wristXNorm = (wrist.x - 0.7) / 0.15; // -1.0 〜 1.0 に近づける
                            tHandLBVal = Math.max(-10.0, Math.min(10.0, wristXNorm * 10.0));

                            // グーパー判定 (手首から指先までの距離と手首から指の付け根までの距離の比)
                            let totalDist = 0;
                            const fingerTips = [8, 12, 16, 20];
                            fingerTips.forEach(tipIdx => {
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
                            fingerTips.forEach(tipIdx => {
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
                    handStatus.textContent = '手検出なし';
                }
            }

            // デバッグログ
            if (isHandTrackActive && typeof handResult !== 'undefined' && handResult && handResult.landmarks && handResult.landmarks.length > 0) {
                const wx = handResult.landmarks[0][0].x.toFixed(3);
                console.log(`[HAND DEBUG] Landmarks: ${handResult.landmarks.length} | LeftDetected: ${leftHandDetected} | RightDetected: ${rightHandDetected} | WristX: ${wx}`);
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


    cameraTrackToggle.addEventListener('change', () => {
        if (cameraTrackToggle.checked) startCamera(); else stopCamera();
        saveSettings();
    });

    cameraPreviewToggle.addEventListener('change', () => {
        if (isCameraActive && cameraPreviewToggle.checked) cameraPreviewContainer.classList.add('visible');
        else cameraPreviewContainer.classList.remove('visible');
        saveSettings();
    });

    handTrackToggle.addEventListener('change', async () => {
        if (handTrackToggle.checked) {
            isHandTrackActive = true;
            handStatus.textContent = '初期化中...';
            handStatus.classList.add('active');
            await initHandLandmarker();
            if (handLandmarker) {
                handStatus.textContent = '手認識有効';
                if (!isCameraActive) {
                    cameraTrackToggle.checked = true;
                    await startCamera();
                }
            } else {
                isHandTrackActive = false;
                handTrackToggle.checked = false;
                handStatus.textContent = '初期化失敗';
                handStatus.classList.remove('active');
            }
        } else {
            isHandTrackActive = false;
            handStatus.textContent = '手認識無効';
            handStatus.classList.remove('active');
            tArmLA = 0.0; tArmLB = 0.0;
            tArmRA = 0.0; tArmRB = 0.0;
            tHandLBVal = 0.0; tHandRBVal = 0.0;
            tHandLForm = 1.0; tHandRForm = 1.0;
        }
        saveSettings();
    });

    // =====================================================================
    // マイク
    // =====================================================================
    async function initMic() {
        if (isCameraActive) { micToggle.checked = false; return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            audioContext.createMediaStreamSource(stream).connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            micStatus.textContent = '接続中'; micStatus.classList.add('active');
            function loop() {
                if (!micToggle.checked || isCameraActive) {
                    stream.getTracks().forEach(t => t.stop());
                    micStatus.textContent = 'マイク無効'; micStatus.classList.remove('active');
                    return;
                }
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                tMouthOpen = Math.min(1, Math.max(0, (avg - 12) / 50));
                requestAnimationFrame(loop);
            }
            loop();
        } catch (err) { micStatus.textContent = '許可エラー'; micToggle.checked = false; }
    }

    micToggle.addEventListener('change', () => {
        if (micToggle.checked) initMic();
        else { if (audioContext) audioContext.close(); micStatus.textContent = 'マイク無効'; micStatus.classList.remove('active'); tMouthOpen = 0; }
        saveSettings();
    });

    // =====================================================================
    // スライダー
    // =====================================================================
    faceSensSlider.addEventListener('input', () => { faceSensitivity = parseFloat(faceSensSlider.value); faceSensVal.textContent = faceSensitivity.toFixed(1); saveSettings(); });
    scaleSlider.addEventListener('input', () => { modelScale = parseFloat(scaleSlider.value); scaleVal.textContent = modelScale.toFixed(2); positionModel(); saveSettings(); });
    offsetYSlider.addEventListener('input', () => { offsetY = parseInt(offsetYSlider.value); offsetYVal.textContent = offsetY; positionModel(); saveSettings(); });
    offsetXSlider.addEventListener('input', () => { offsetX = parseInt(offsetXSlider.value); offsetXVal.textContent = offsetX; positionModel(); saveSettings(); });

    // 部位Tuber (AR顔被せ) イベントリスナー
    function toggleFaceMaskMode(active) {
        isFaceMaskMode = active;
        if (active) {
            document.body.classList.add('face-mask-mode');
            if (maskStatus) {
                maskStatus.textContent = '部位モード有効';
                maskStatus.classList.add('active');
            }
            if (!isCameraActive && cameraTrackToggle) {
                cameraTrackToggle.checked = true;
                startCamera();
            }
        } else {
            document.body.classList.remove('face-mask-mode');
            if (maskStatus) {
                maskStatus.textContent = '部位モードオフ';
                maskStatus.classList.remove('active');
            }
            if (live2dModel) {
                live2dModel.rotation = 0;
                positionModel();
            }
        }
        saveSettings();
    }

    if (faceMaskToggle) {
        faceMaskToggle.addEventListener('change', () => {
            toggleFaceMaskMode(faceMaskToggle.checked);
        });
    }

    if (maskScaleSlider) {
        maskScaleSlider.addEventListener('input', () => {
            maskScaleMultiplier = parseFloat(maskScaleSlider.value);
            if (maskScaleVal) maskScaleVal.textContent = maskScaleMultiplier.toFixed(2);
            saveSettings();
        });
    }

    if (maskOffsetYSlider) {
        maskOffsetYSlider.addEventListener('input', () => {
            maskOffsetY = parseInt(maskOffsetYSlider.value);
            if (maskOffsetYVal) maskOffsetYVal.textContent = maskOffsetY;
            saveSettings();
        });
    }

    if (maskOffsetXSlider) {
        maskOffsetXSlider.addEventListener('input', () => {
            maskOffsetX = parseInt(maskOffsetXSlider.value);
            if (maskOffsetXVal) maskOffsetXVal.textContent = maskOffsetX;
            saveSettings();
        });
    }

    // デバッグ用腕スライダーイベント
    debugArmLaSlider.addEventListener('input', () => { debugArmLaVal.textContent = debugArmLaSlider.value; if (!isHandTrackActive) { tArmLA = parseFloat(debugArmLaSlider.value); } });
    debugArmLbSlider.addEventListener('input', () => { debugArmLbVal.textContent = debugArmLbSlider.value; if (!isHandTrackActive) { tArmLB = parseFloat(debugArmLbSlider.value); } });
    debugArmRaSlider.addEventListener('input', () => { debugArmRaVal.textContent = debugArmRaSlider.value; if (!isHandTrackActive) { tArmRA = parseFloat(debugArmRaSlider.value); } });
    debugArmRbSlider.addEventListener('input', () => { debugArmRbVal.textContent = debugArmRbSlider.value; if (!isHandTrackActive) { tArmRB = parseFloat(debugArmRbSlider.value); } });

    // =====================================================================
    // OBS URL
    // =====================================================================
    function updateObsUrl() {
        if (!obsUrlInput) return;
        const isGreen = obsGreenToggle && obsGreenToggle.checked;
        const greenParam = isGreen ? '&green=true' : '';
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        obsUrlInput.value = `${window.location.origin}${basePath}live2d.html?obs=true&model=${currentModelId}${greenParam}`;
    }

    if (obsGreenToggle) {
        obsGreenToggle.addEventListener('change', () => {
            updateObsUrl();
            saveSettings();
        });
    }

    copyUrlBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(obsUrlInput.value).then(() => {
            copyUrlBtn.textContent = 'コピー完了!';
            copyUrlBtn.style.background = '#00ff66';
            setTimeout(() => { copyUrlBtn.textContent = 'コピー'; copyUrlBtn.style.background = ''; }, 1500);
        });
    });

    // 全画面・操作パネル表示非表示切替
    const togglePanelBtn = document.getElementById('toggle-panel-btn');
    if (togglePanelBtn) togglePanelBtn.style.display = 'none'; // ボタンを非表示にする

    const hidePanelHeaderBtn = document.getElementById('hide-panel-header-btn');

    const triggerResize = () => {
        if (pixiApp) {
            setTimeout(() => {
                const nw = viewport.clientWidth || window.innerWidth;
                const nh = viewport.clientHeight || window.innerHeight;
                pixiApp.renderer.resize(nw, nh);
                if (live2dModel) positionModel();
            }, 100);
        }
    };

    if (hidePanelHeaderBtn) {
        hidePanelHeaderBtn.addEventListener('click', () => {
            document.body.classList.add('panel-hidden');
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
            triggerResize();
        });
    }

    // フルスクリーン解除時、またはESCキー押下時にパネルを復元する
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('panel-hidden');
            triggerResize();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.classList.remove('panel-hidden');
            triggerResize();
        }
    });

    // =====================================================================
    // BroadcastChannel (OBS受信)
    // =====================================================================
    if (isObsMode) {
        syncChannel.addEventListener('message', (e) => {
            const d = e.data;
            if (d && d.type === 'live2d-state') {
                lastSyncTime = Date.now();
                tAngleX = d.angleX; tAngleY = d.angleY; tAngleZ = d.angleZ;
                tEyeLOpen = d.eyeLOpen; tEyeROpen = d.eyeROpen;
                tMouthOpen = d.mouthOpen;
                tEyeBallX = d.eyeBallX; tEyeBallY = d.eyeBallY;
                tBreath = d.breath;

                tArmLA = d.armLA; tArmLB = d.armLB;
                tArmRA = d.armRA; tArmRB = d.armRB;
                tHandLBVal = d.handLBVal || 0.0;
                tHandRBVal = d.handRBVal || 0.0;
                tHandLForm = d.handLForm != null ? d.handLForm : 1.0;
                tHandRForm = d.handRForm != null ? d.handRForm : 1.0;
                isHandTrackActive = d.isHandTrackActive;

                if (d.modelId && d.modelId !== currentModelId) {
                    const def = MODELS.find(m => m.id === d.modelId);
                    if (def) loadModel(def);
                }
            }
        });
    }

    // =====================================================================
    // 設定保存/読み込み
    // =====================================================================
    function saveSettings() {
        localStorage.setItem('live2d_studio_v2', JSON.stringify({
            modelId: currentModelId,
            faceSensitivity, modelScale, offsetX, offsetY,
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
        }));
    }

    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('live2d_studio_v2') || '{}');
            if (s.modelId) currentModelId = s.modelId;
            if (s.faceSensitivity) { faceSensitivity = s.faceSensitivity; faceSensSlider.value = faceSensitivity; faceSensVal.textContent = faceSensitivity.toFixed(1); }
            if (s.modelScale) { modelScale = s.modelScale; scaleSlider.value = modelScale; scaleVal.textContent = modelScale.toFixed(2); }
            if (s.offsetX != null) { offsetX = s.offsetX; offsetXSlider.value = offsetX; offsetXVal.textContent = offsetX; }
            if (s.offsetY != null) { offsetY = s.offsetY; offsetYSlider.value = offsetY; offsetYVal.textContent = offsetY; }
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
                    handStatus.textContent = '手認識一時停止';
                }
            }
            if (s.obsGreen != null && obsGreenToggle) {
                obsGreenToggle.checked = s.obsGreen;
            }
            if (s.maskScale != null && maskScaleSlider) {
                maskScaleMultiplier = s.maskScale;
                maskScaleSlider.value = maskScaleMultiplier;
                if (maskScaleVal) maskScaleVal.textContent = maskScaleMultiplier.toFixed(2);
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
        } catch (e) { }
    }

    // =====================================================================
    // モデルグリッド構築
    // =====================================================================
    function buildModelGrid() {
        MODELS.forEach(m => {
            const card = document.createElement('div');
            card.className = 'model-card' + (m.id === currentModelId ? ' active' : '');
            card.dataset.modelId = m.id;
            card.innerHTML = `<img src="${m.icon}" alt="${m.name}" loading="lazy"><div class="model-name">${m.name}</div>`;
            card.addEventListener('click', () => loadModel(m));
            modelGrid.appendChild(card);
        });
    }

    // =====================================================================
    // NDIストリーミング
    // =====================================================================
    function connectNdi() {
        if (ndiWs && ndiWs.readyState <= 1) return; // 接続中または接続済み

        const ndiStatus = document.getElementById('ndi-status');
        if (ndiStatus) { ndiStatus.textContent = '接続中...'; ndiStatus.style.color = '#ffaa00'; }

        try {
            ndiWs = new WebSocket(NDI_WS_URL);
            ndiWs.binaryType = 'arraybuffer';

            ndiWs.onopen = () => {
                console.log('[NDI] WebSocket connected to NDI server');
                if (ndiStatus) { ndiStatus.textContent = '送信中'; ndiStatus.style.color = '#00f3ff'; }
                // 按辺間隔でフレームを送信
                startNdiFrameLoop();
                ndiWs.send(JSON.stringify({ type: 'ping' }));
            };

            ndiWs.onclose = () => {
                console.log('[NDI] WebSocket disconnected');
                stopNdiFrameLoop();
                if (ndiStatus) { ndiStatus.textContent = '切断'; ndiStatus.style.color = '#f44'; }
                // 自動再接続
                if (ndiEnabled) {
                    ndiRetryTimer = setTimeout(() => {
                        if (ndiEnabled) connectNdi();
                    }, 3000);
                }
            };

            ndiWs.onerror = (err) => {
                console.warn('[NDI] WebSocket error - NDIサーバーが起動しているか確認: python3 ndi_server.py');
                if (ndiStatus) { ndiStatus.textContent = 'サーバー未起動'; ndiStatus.style.color = '#f44'; }
            };

            ndiWs.onmessage = (e) => {
                if (typeof e.data === 'string') {
                    try {
                        const msg = JSON.parse(e.data);
                        if (msg.type === 'pong' && ndiStatus) {
                            ndiStatus.textContent = `送信中 [${msg.ndi}]`;
                        }
                    } catch (er) { }
                }
            };
        } catch (e) {
            console.error('[NDI] Connection failed:', e);
        }
    }

    function disconnectNdi() {
        ndiEnabled = false;
        if (ndiRetryTimer) { clearTimeout(ndiRetryTimer); ndiRetryTimer = null; }
        stopNdiFrameLoop();
        if (ndiWs) { ndiWs.close(); ndiWs = null; }
        const ndiStatus = document.getElementById('ndi-status');
        if (ndiStatus) { ndiStatus.textContent = ''; ndiStatus.style.color = ''; }
    }

    function startNdiFrameLoop() {
        if (ndiFrameTimer) return;
        const interval = Math.round(1000 / NDI_FPS);
        ndiFrameTimer = setInterval(captureAndSendNdiFrame, interval);
    }

    function stopNdiFrameLoop() {
        if (ndiFrameTimer) { clearInterval(ndiFrameTimer); ndiFrameTimer = null; }
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

            if (!captureCanvas || captureCanvas.width !== capW || captureCanvas.height !== capH) {
                captureCanvas = document.createElement('canvas');
                captureCanvas.width = capW;
                captureCanvas.height = capH;
                captureCtx = captureCanvas.getContext('2d');
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
            view.setUint32(8, Math.floor(Date.now() / 1000) & 0xFFFFFFFF, false);

            // ヘッダー + RGBAピクセルデータを連結
            const combined = new Uint8Array(12 + pixels.length);
            combined.set(new Uint8Array(header), 0);
            combined.set(new Uint8Array(pixels.buffer), 12);

            ndiWs.send(combined.buffer);
        } catch (e) {
            console.error('[NDI] capture error:', e);
            const ndiStatus = document.getElementById('ndi-status');
            if (ndiStatus) {
                ndiStatus.textContent = 'キャプチャエラー: ' + e.message;
                ndiStatus.style.color = '#ff4444';
            }
        }
    }

    // NDIトグルイベント
    const ndiToggle = document.getElementById('ndi-toggle');
    if (ndiToggle) {
        ndiToggle.addEventListener('change', () => {
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
    const bgUpload = document.getElementById('bg-upload');
    const backgroundLayer = document.getElementById('background-layer');
    let currentCropper = null;
    const cropperModal = document.getElementById('cropper-modal');
    const cropperImage = document.getElementById('cropper-image');
    const cropperCancelBtn = document.getElementById('cropper-cancel-btn');
    const cropperApplyBtn = document.getElementById('cropper-apply-btn');

    if (bgUpload && backgroundLayer && cropperModal) {
        // 保存された背景画像を復元
        const savedBg = localStorage.getItem('savedBackgroundImage');
        if (savedBg) {
            backgroundLayer.style.backgroundImage = `url('${savedBg}')`;
        }

        bgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                cropperImage.src = event.target.result;
                cropperModal.style.display = 'flex';

                if (currentCropper) {
                    currentCropper.destroy();
                }

                // Cropperの初期化
                currentCropper = new Cropper(cropperImage, {
                    viewMode: 1,
                    dragMode: 'move',
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
            e.target.value = '';
        });

        cropperCancelBtn.addEventListener('click', () => {
            cropperModal.style.display = 'none';
            if (currentCropper) {
                currentCropper.destroy();
                currentCropper = null;
            }
        });

        cropperApplyBtn.addEventListener('click', () => {
            if (!currentCropper) return;
            // トリミングした画像のデータURLを取得
            const croppedCanvas = currentCropper.getCroppedCanvas();
            if (croppedCanvas) {
                const croppedDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.8);
                backgroundLayer.style.backgroundImage = `url('${croppedDataUrl}')`;
                // localStorageに保存してリロード後も保持する
                try {
                    localStorage.setItem('savedBackgroundImage', croppedDataUrl);
                } catch (e) {
                    console.warn("localStorage quota exceeded or unavailable:", e);
                    alert("画像サイズが大きすぎるため、次回の表示用に保存できませんでした。もう少し小さくトリミングするか、解像度の低い画像をお試しください。");
                }
            }
            cropperModal.style.display = 'none';
            currentCropper.destroy();
            currentCropper = null;
        });
    }

    // =====================================================================
    // TikTok & VOICEVOX 連携
    // =====================================================================
    // Populate VOICEVOX speakers
    if (voicevoxSpeakerId) {
        const savedSpeaker = localStorage.getItem('savedVoicevoxSpeaker');

        fetch('http://127.0.0.1:50021/speakers')
            .then(res => res.json())
            .then(speakers => {
                voicevoxSpeakerId.innerHTML = ''; // clear default
                let foundSaved = false;
                speakers.forEach(speaker => {
                    speaker.styles.forEach(style => {
                        const option = document.createElement('option');
                        option.value = style.id;
                        option.textContent = `${speaker.name} (${style.name})`;
                        if (savedSpeaker && style.id.toString() === savedSpeaker) {
                            option.selected = true;
                            foundSaved = true;
                        } else if (!savedSpeaker && style.id === 3) {
                            // Default to Zundamon normal (id 3) if nothing is saved
                            option.selected = true;
                        }
                        voicevoxSpeakerId.appendChild(option);
                    });
                });

                // Save whenever it changes
                voicevoxSpeakerId.addEventListener('change', () => {
                    localStorage.setItem('savedVoicevoxSpeaker', voicevoxSpeakerId.value);
                });
            })
            .catch(err => {
                console.warn('Failed to fetch VOICEVOX speakers:', err);
            });
    }
    if (voicevoxToggle) {
        const savedToggle = localStorage.getItem('savedVoicevoxToggle');
        if (savedToggle !== null) {
            voicevoxToggle.checked = savedToggle === 'true';
            isVoicevoxEnabled = voicevoxToggle.checked;
        }
        voicevoxToggle.addEventListener('change', () => {
            isVoicevoxEnabled = voicevoxToggle.checked;
            localStorage.setItem('savedVoicevoxToggle', voicevoxToggle.checked);
        });
    }

    const idleSpeechToggle = document.getElementById('idle-speech-toggle');
    let isIdleSpeechEnabled = true;

    if (idleSpeechToggle) {
        const savedIdleToggle = localStorage.getItem('savedIdleSpeechToggle');
        if (savedIdleToggle !== null) {
            idleSpeechToggle.checked = savedIdleToggle === 'true';
            isIdleSpeechEnabled = idleSpeechToggle.checked;
        }
        idleSpeechToggle.addEventListener('change', () => {
            isIdleSpeechEnabled = idleSpeechToggle.checked;
            localStorage.setItem('savedIdleSpeechToggle', idleSpeechToggle.checked);
            if (isIdleSpeechEnabled) {
                if (typeof resetIdleTimer === 'function') resetIdleTimer();
            } else {
                if (typeof clearIdleTimer === 'function') clearIdleTimer();
            }
        });
    }

    // 一人称・二人称の設定保存
    const idleFirstPersonEl = document.getElementById('idle-first-person');
    const idleSecondPersonEl = document.getElementById('idle-second-person');
    if (idleFirstPersonEl) {
        const saved = localStorage.getItem('savedIdleFirstPerson');
        if (saved) idleFirstPersonEl.value = saved;
        idleFirstPersonEl.addEventListener('change', () => {
            localStorage.setItem('savedIdleFirstPerson', idleFirstPersonEl.value);
        });
    }
    if (idleSecondPersonEl) {
        const saved = localStorage.getItem('savedIdleSecondPerson');
        if (saved) idleSecondPersonEl.value = saved;
        idleSecondPersonEl.addEventListener('change', () => {
            localStorage.setItem('savedIdleSecondPerson', idleSecondPersonEl.value);
        });
    }

    // AI Settings
    const aiReplyToggle = document.getElementById('ai-reply-toggle');
    const aiSettingsPanel = document.getElementById('ai-settings-panel');
    const aiProviderSelect = document.getElementById('ai-provider-select');
    const aiApiKeyInput = document.getElementById('ai-api-key');
    const aiSystemPromptInput = document.getElementById('ai-system-prompt');
    const aiSearchSelect = document.getElementById('ai-search-select');

    let isAiReplyEnabled = false;
    let aiChatHistory = []; // 過去のコンテキスト保持用
    let isAiGenerating = false;
    let lastAiRequestTime = 0;

    if (aiReplyToggle) {
        const savedAiToggle = localStorage.getItem('savedAiReplyToggle');
        if (savedAiToggle !== null) {
            aiReplyToggle.checked = savedAiToggle === 'true';
            isAiReplyEnabled = aiReplyToggle.checked;
            aiSettingsPanel.style.display = isAiReplyEnabled ? 'block' : 'none';
        }

        const savedProvider = localStorage.getItem('savedAiProvider');
        if (savedProvider) aiProviderSelect.value = savedProvider;

        const savedApiKey = localStorage.getItem('savedAiApiKey');
        if (savedApiKey) aiApiKeyInput.value = savedApiKey;

        const savedPrompt = localStorage.getItem('savedAiPrompt');
        if (savedPrompt) {
            const oldDefault = 'あなたは元気で明るい女の子のVTuberです。視聴者からのコメントに対して、タメ口で親しみやすく、一言で短く返答してください。「文字」や「制限」などのAIの設定に関する言葉は絶対に口に出さないでください。';
            const newDefault = 'あなたは元気で明るい女の子のVTuberです。視聴者からのコメントに対して、タメ口で親しみやすく返答してください。「文字」や「制限」などのAIの設定に関する言葉は絶対に口に出さないでください。\n【重要】もし質問の答えを知らない場合や最新情報が必要な場合は、推測ではぐらかさずに「[search] 調べたいキーワード」だけを返答してください。例: [search] ドル円 現在';
            if (savedPrompt === oldDefault) {
                aiSystemPromptInput.value = newDefault;
                localStorage.setItem('savedAiPrompt', newDefault);
            } else {
                aiSystemPromptInput.value = savedPrompt;
            }
        }

        if (aiSearchSelect) {
            const savedSearchSelect = localStorage.getItem('savedAiSearchSelect');
            if (savedSearchSelect) {
                aiSearchSelect.value = savedSearchSelect;
            } else {
                aiSearchSelect.value = 'ddg';
            }
        }

        aiReplyToggle.addEventListener('change', () => {
            isAiReplyEnabled = aiReplyToggle.checked;
            localStorage.setItem('savedAiReplyToggle', aiReplyToggle.checked);
            aiSettingsPanel.style.display = isAiReplyEnabled ? 'block' : 'none';
        });
    }

    // =====================================================================
    // ラジオ台本作成モーダル関連のロジック
    // =====================================================================
    const radioScriptBtn = document.getElementById('ai-radio-script-btn');
    const radioScriptModal = document.getElementById('radio-script-modal');
    const radioScriptGenBtn = document.getElementById('radio-script-generate-btn');
    const radioScriptClearBtn = document.getElementById('radio-script-clear-btn');
    const radioScriptSaveBtn = document.getElementById('radio-script-save-btn');
    const radioScriptCancelBtn = document.getElementById('radio-script-cancel-btn');
    const radioScriptTextarea = document.getElementById('radio-script-textarea');
    const radioScriptLoading = document.getElementById('radio-script-loading');
    const radioScriptPlayBtn = document.getElementById('radio-script-play-btn');

    if (radioScriptPlayBtn) {
        radioScriptPlayBtn.addEventListener('click', () => {
            const radioModeToggle = document.getElementById('ai-radio-mode-toggle');
            if (radioModeToggle && radioModeToggle.checked) {
                if (!radioModeState.scriptLines || radioModeState.scriptLines.length === 0) {
                    alert('先にラジオ台本を作成・保存してください。');
                    return;
                }
                if (radioModeState.currentPhase === 'none' || radioModeState.currentPhase === 'finished') {
                    radioModeState.currentPhase = 'playing';

                    const radioScriptStopBtn = document.getElementById('radio-script-stop-btn');
                    if (radioScriptPlayBtn) radioScriptPlayBtn.style.display = 'none';
                    if (radioScriptStopBtn) radioScriptStopBtn.style.display = 'block';

                    const startLineInput = document.getElementById('radio-script-start-line');
                    let startIdx = 0;
                    if (startLineInput) {
                        let val = parseInt(startLineInput.value, 10);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > radioModeState.scriptLines.length) val = radioModeState.scriptLines.length;
                        startIdx = val - 1;
                    }
                    radioModeState.currentScriptIndex = startIdx;

                    console.log(`[ラジオモード] 手動/スケジュールトリガーにより台本読み上げ開始。全${radioModeState.scriptLines.length}行 (開始行: ${startIdx + 1})`);

                    if (typeof triggerIdleSpeech === 'function') {
                        triggerIdleSpeech();
                    }
                } else {
                    console.log('[ラジオモード] すでに再生中です。');
                }
            } else {
                alert('先に「ラジオ番組モード」のスイッチをONにしてください。');
            }
        });
    }

    const radioScriptStopBtn = document.getElementById('radio-script-stop-btn');
    if (radioScriptStopBtn) {
        radioScriptStopBtn.addEventListener('click', () => {
            radioModeState.currentPhase = 'none';
            if (radioScriptPlayBtn) radioScriptPlayBtn.style.display = 'block';
            if (radioScriptStopBtn) radioScriptStopBtn.style.display = 'none';

            // Clear queues and timers to stop playback immediately
            if (typeof voicevoxAudioQueue !== 'undefined') {
                voicevoxAudioQueue.length = 0;
            }
            if (typeof clearIdleTimer === 'function') {
                clearIdleTimer();
            }
            console.log('[ラジオモード] 再生を停止しました。');
        });
    }

    const radioScriptYomiTextarea = document.getElementById('radio-script-yomi-textarea');
    const radioConfigNameInput = document.getElementById('radio-config-name');
    const radioConfigOpeningInput = document.getElementById('radio-config-opening');
    const radioConfigClosingInput = document.getElementById('radio-config-closing');
    const radioConfigSaveBtn = document.getElementById('radio-config-save-btn');

    // 設定の読み込み
    const loadRadioConfig = async () => {
        try {
            const res = await fetch('http://127.0.0.1:8001/radio_script_config');
            if (!res.ok) return;
            const cfg = await res.json();
            if (cfg) {
                const radioConfigTitleInput = document.getElementById('radio-config-title');
                const radioConfigThemeInput = document.getElementById('radio-config-theme');
                if (radioConfigTitleInput && cfg.program_title) radioConfigTitleInput.value = cfg.program_title;
                if (radioConfigThemeInput && cfg.program_theme) radioConfigThemeInput.value = cfg.program_theme;
            }
            if (cfg.personality) {
                if (radioConfigNameInput && cfg.personality.name) radioConfigNameInput.value = cfg.personality.name;
                if (radioConfigOpeningInput && cfg.personality.greeting_opening) radioConfigOpeningInput.value = cfg.personality.greeting_opening;
                if (radioConfigClosingInput && cfg.personality.greeting_closing) radioConfigClosingInput.value = cfg.personality.greeting_closing;


                const radioConfigStartTimeInput = document.getElementById('radio-config-start-time');
                const radioConfigEndTimeInput = document.getElementById('radio-config-end-time');
                const radioConfigDateInput = document.getElementById('radio-config-date');
                if (radioConfigStartTimeInput && cfg.personality.start_time) radioConfigStartTimeInput.value = cfg.personality.start_time;
                if (radioConfigEndTimeInput && cfg.personality.end_time) radioConfigEndTimeInput.value = cfg.personality.end_time;
                if (radioConfigDateInput && cfg.personality.broadcast_date) radioConfigDateInput.value = cfg.personality.broadcast_date;
            }
            if (cfg.se_allowed && Array.isArray(cfg.se_allowed)) {
                // チェックボックスを設定ファイルの値で復元
                const cbs = document.querySelectorAll('#radio-script-settings-details input[name="se"]');
                cbs.forEach(cb => { cb.checked = cfg.se_allowed.includes(cb.value); });
            }
        } catch (e) {
            console.warn('[台本設定] 設定ファイルの読み込みに失敗:', e);
        }
    };
    loadRadioConfig();

    // 設定の保存ボタン
    if (radioConfigSaveBtn) {
        radioConfigSaveBtn.addEventListener('click', async () => {
            const name = radioConfigNameInput ? radioConfigNameInput.value.trim() : '';
            const opening = radioConfigOpeningInput ? radioConfigOpeningInput.value.trim() : '';
            const closing = radioConfigClosingInput ? radioConfigClosingInput.value.trim() : '';

            const radioConfigTitleInput = document.getElementById('radio-config-title');
            const radioConfigThemeInput = document.getElementById('radio-config-theme');
            const program_title = radioConfigTitleInput ? radioConfigTitleInput.value.trim() : '';
            const program_theme = radioConfigThemeInput ? radioConfigThemeInput.value.trim() : '';

            const radioConfigStartTimeInput = document.getElementById('radio-config-start-time');
            const radioConfigEndTimeInput = document.getElementById('radio-config-end-time');
            const radioConfigDateInput = document.getElementById('radio-config-date');
            const start_time = radioConfigStartTimeInput ? radioConfigStartTimeInput.value : '20:00';
            const end_time = radioConfigEndTimeInput ? radioConfigEndTimeInput.value : '20:30';
            const broadcast_date = radioConfigDateInput ? radioConfigDateInput.value : '';

            const cbs = document.querySelectorAll('#radio-script-settings-details input[name="se"]:checked');
            const seAllowed = Array.from(cbs).map(cb => cb.value);
            const config = { program_title, program_theme, personality: { name, greeting_opening: opening, greeting_closing: closing, start_time, end_time, broadcast_date }, se_allowed: seAllowed };
            try {
                const res = await fetch('http://127.0.0.1:8001/radio_script_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                if (res.ok) {
                    radioConfigSaveBtn.textContent = '✅ 保存しました！';
                    setTimeout(() => { radioConfigSaveBtn.textContent = '💾 この設定を保存'; }, 2000);
                }
            } catch (e) {
                console.warn('[台本設定] 設定保存に失敗:', e);
            }
        });
    }

    // 読み込み時に保存された台本を復元（サーバーのテキストファイルから読み込み）
    Promise.all([
        fetch('http://127.0.0.1:8001/radio_script').then(r => r.ok ? r.text() : '').catch(() => ''),
        fetch('http://127.0.0.1:8001/radio_script_yomi').then(r => r.ok ? r.text() : '').catch(() => '')
    ]).then(([savedScript, savedYomi]) => {
        if (savedScript && savedScript.trim()) {
            if (radioScriptTextarea) radioScriptTextarea.value = savedScript;
            const lines = savedScript.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            radioModeState.scriptLines = lines;
            console.log(`[ラジオ台本] radio_script.txtから${lines.length}行読み込みました`);
        } else {
            // APIサーバー未起動などの場合はlocalStorageにフォールバック
            const fallbackScript = localStorage.getItem('savedRadioScript');
            if (fallbackScript) {
                if (radioScriptTextarea) radioScriptTextarea.value = fallbackScript;
                const lines = fallbackScript.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                radioModeState.scriptLines = lines;
                console.log(`[ラジオ台本] localStorageから${lines.length}行読み込み（フォールバック）`);
            }
        }


        if (savedYomi && savedYomi.trim()) {
            if (radioScriptYomiTextarea) radioScriptYomiTextarea.value = savedYomi;
            const yomiLines = savedYomi.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            radioModeState.scriptYomiLines = yomiLines;
            console.log(`[ラジオ台本] radio_script_yomi.txtから${yomiLines.length}行読み込みました`);
        } else {
            const fallbackYomi = localStorage.getItem('savedRadioScriptYomi');
            if (fallbackYomi) {
                if (radioScriptYomiTextarea) radioScriptYomiTextarea.value = fallbackYomi;
                const yomiLines = fallbackYomi.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                radioModeState.scriptYomiLines = yomiLines;
                console.log(`[ラジオ台本] localStorageから${yomiLines.length}行読み込み（フォールバック）`);
            }
        }

        // 進行状況の復元
        const lastIndex = parseInt(localStorage.getItem('radioScriptLastIndex') || '0', 10);
        const startLineInput = document.getElementById('radio-script-start-line');
        if (startLineInput && lastIndex > 0) {
            // トラブル復帰用に「次に読むべき行」を初期値としてセットしておく
            startLineInput.value = lastIndex + 1;
        }
    });

    if (radioScriptBtn && radioScriptModal) {
        radioScriptBtn.addEventListener('click', () => {
            radioScriptModal.style.display = 'flex';
        });

        radioScriptGenBtn.addEventListener('click', async () => {
            const aiApiKeyInput = document.getElementById('ai-api-key');
            const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
            if (!apiKey) {
                alert("AIのAPIキーが設定されていません。AI設定項目からAPIキーを入力してください。");
                return;
            }

            const aiProviderSelect = document.getElementById('ai-provider-select');
            const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';

            const startTimeInput = document.getElementById('radio-config-start-time');
            const endTimeInput = document.getElementById('radio-config-end-time');
            let duration = 30;
            let timeOfDay = '夜';
            let timeContextStr = '';

            if (startTimeInput && endTimeInput && startTimeInput.value && endTimeInput.value) {
                const [startH, startM] = startTimeInput.value.split(':').map(Number);
                const [endH, endM] = endTimeInput.value.split(':').map(Number);
                let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
                if (diffMins <= 0) diffMins += 24 * 60; // 日またぎ
                duration = diffMins;

                if (startH >= 4 && startH < 10) timeOfDay = '朝';
                else if (startH >= 10 && startH < 16) timeOfDay = '昼';
                else if (startH >= 16 && startH < 19) timeOfDay = '夕方';
                else if (startH >= 19 && startH < 24) timeOfDay = '夜';
                else timeOfDay = '深夜';

                const dateInput = document.getElementById('radio-config-date');
                if (dateInput && dateInput.value) {
                    const d = new Date(dateInput.value);
                    if (!isNaN(d.getTime())) {
                        const days = ['日', '月', '火', '水', '木', '金', '土'];
                        const dateStr = `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
                        timeContextStr = `\n【コンテキスト・日時】\n- この番組は【${dateStr}の${timeOfDay}】（開始時刻: ${startTimeInput.value}）に放送されます。オープニング挨拶やフリートークなどで、放送日（${dateStr}）や時間帯に合った自然な話題、季節感を取り入れてください（例：週末なら「今週もお疲れ様でした」、朝なら「おはようございます」など）。\n`;
                    } else {
                        timeContextStr = `\n【コンテキスト・時間帯】\n- この番組は【${timeOfDay}】（開始時刻: ${startTimeInput.value}）に放送されます。オープニング挨拶やフリートークなどで、時間帯に合った自然な話題やトーンを取り入れてください。\n`;
                    }
                } else {
                    timeContextStr = `\n【コンテキスト・時間帯】\n- この番組は【${timeOfDay}】（開始時刻: ${startTimeInput.value}）に放送されます。オープニング挨拶やフリートークなどで、時間帯に合った自然な話題やトーンを取り入れてください。\n`;
                }
            }

            const radioTitleInput = document.getElementById('radio-config-title');
            const radioThemeInput = document.getElementById('radio-config-theme');
            const radioTitle = radioTitleInput ? radioTitleInput.value.trim() : '';
            const radioTheme = radioThemeInput ? radioThemeInput.value.trim() : '';

            const mainStreamTitle = document.getElementById('stream-title') ? document.getElementById('stream-title').value.trim() : '';
            const mainAiTheme = document.getElementById('ai-stream-theme') ? document.getElementById('ai-stream-theme').value.trim() : '';

            const programTitle = radioTitle || mainStreamTitle || "名無しのラジオ番組";
            const programTheme = radioTheme || mainAiTheme || "まったり雑談";

            radioScriptGenBtn.disabled = true;
            radioScriptLoading.style.display = 'block';
            radioScriptTextarea.disabled = true;
            if (radioScriptYomiTextarea) radioScriptYomiTextarea.disabled = true;

            try {
                // 番組設定の取得
                const configName = radioConfigNameInput ? radioConfigNameInput.value.trim() : '';
                const configOpening = radioConfigOpeningInput ? radioConfigOpeningInput.value.trim() : '';
                const configClosing = radioConfigClosingInput ? radioConfigClosingInput.value.trim() : '';
                const checkedSeCbs = document.querySelectorAll('#radio-script-settings-details input[name="se"]:checked');
                const selectedSEs = Array.from(checkedSeCbs).map(cb => cb.value);

                // SEリストの構築（チェックされたSEを優先、なければサーバーから取得）
                let seListStr = '';
                if (selectedSEs.length > 0) {
                    seListStr = '利用可能な効果音(SE)リスト（このリストの中から選んでください）:\n' + selectedSEs.join(', ');
                } else {
                    try {
                        const res = await fetch('http://localhost:8001/se_list');
                        if (res.ok) {
                            const data = await res.json();
                            if (data.files && data.files.length > 0) {
                                seListStr = '利用可能な効果音(SE)の例:\n' + data.files.slice(0, 50).join(', ');
                            }
                        }
                    } catch (e) {
                        console.warn('SEリストの取得に失敗しました', e);
                    }
                }

                // 読み上げ速度から台本の目安文字数・行数を計算
                // VOICEVOXの読み上げ速度は概ね1分あたり約300文字（日本語）
                const charsPerMinute = 300;
                const totalChars = charsPerMinute * duration;
                // 1セリフ平均80〜120文字として行数を計算
                const avgCharsPerLine = 100;
                const targetLines = Math.round(totalChars / avgCharsPerLine);

                // パーソナリティ情報の構築
                const personalityName = configName || 'パーソナリティ';
                const personalityDesc = configName ? `あなたはラジオパーソナリティの「${personalityName}」です。` : 'あなたはラジオパーソナリティです。';
                const openingInstruction = configOpening ? `台本の最初の行（第1行）は必ず次の挨拶で始めてください（変更不可）:\n「${configOpening}」` : '';
                const closingInstruction = configClosing ? `台本の最終行は必ず次の挨拶で締めてください（変更不可）:\n「${configClosing}」` : '';

                // プロンプトの構築
                const prompt = `${personalityDesc}「${programTitle}」という番組の、「${programTheme}」というテーマで、約${duration}分間の番組台本を生成してください。
以下のルールに必ず従ってください。
${timeContextStr}
【文字数・行数の目安】
- 読み上げ速度は1分あたり約${charsPerMinute}文字です
- ${duration}分の番組なので、台本全体の総文字数は約${totalChars}文字が目安です
- 1行（1セリフ）は80〜120文字程度にしてください
- したがって全体で約${targetLines}行の台本を生成してください（±3行程度は許容）
${openingInstruction ? '\n【オープニング（最初の行）の指定】\n' + openingInstruction : ''}
${closingInstruction ? '\n【エンディング（最終行）の指定】\n' + closingInstruction : ''}

【フォーマットのルール】
1. 1セリフにつき1行で出力してください。セリフの中に改行を含めないでください。
2. 構成は「オープニング（2〜3行）」→「メイントーク（複数行）」→「コメント返し待機枠（1行）」→「エンディング（2〜3行）」のように自然な流れにしてください。
3. SE（効果音）を鳴らしたいタイミングで、独立した1行として \`[SE: 効果音の名前]\` と記述してください。セリフと同じ行には書かないでください。SEは場面転換や盛り上がりのタイミングで数回使用してください。
4. 【重要】事前の「リスナーからのお便りやメールの紹介」は台本に含めないでください（お便りは存在しないという設定です）。
5. 【重要】番組の終盤（エンディングの直前）に、リアルタイムのコメントを読むための「無音の待機枠」を設けてください。必ず独立した1行として \`[ラジオ一時停止: コメント返し]\` というタグだけを出力し、絶対に架空のリスナー名や架空のコメントを生成しないでください。
${seListStr}

【出力形式の例】
${configOpening || '皆さんこんにちは！今夜もまったりやっていきましょう。'}
[SE: 大勢で拍手]
今回のテーマはですね、${programTheme}についていろいろ話していきたいと思います。
実はわたし最近ちょっとした発見がありまして、みなさんにもシェアしたいんですよ。
（…このように${targetLines}行程度まで続ける…）
${configClosing || '今夜もたくさん聴いてくれてありがとう。また次回もよろしくね！'}
[SE: 放送終了チャイム]

上記の形式で、台本のセリフのみを出力してください（説明書きや前置き・セクション見出しは不要です）。`;

                // aiFeaturesを使って生成 (AIモデルはシステムプロンプト欄のロジックを流用)
                const generatedScript = await aiFeatures.callAI(prompt, apiKey, provider, true);

                if (generatedScript) {
                    // AI出力を整形：1行1セリフまたは1行1SEになるよう正規化する
                    const cleaned = generatedScript
                        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')   // 改行コード統一
                        .split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
                    radioScriptTextarea.value = cleaned;
                    const lineCount = cleaned.split('\n').length;
                    console.log(`[台本生成] ${lineCount}行の台本を生成しました（目標: ${targetLines}行）`);

                    // 読み上げ用台本（ひらがな）の生成
                    radioScriptLoading.textContent = 'ひらがな変換中...';
                    const yomiPrompt = `次のラジオ台本テキストの各行を、すべて【ひらがなのみ】に変換して読み仮名を作成してください。
漢字やカタカナは一切使わず、必ずひらがなで出力してください（記号は除く）。
「[SE: ...]」と書かれた行はそのまま残してください。
各行の対応関係を維持し（1行入力＝1行出力）、行数を増減しないでください。
読点（、）や句点（。）、感嘆符（！）、疑問符（？）などの記号はそのまま残してください。
変換後のテキストのみ出力してください（説明不要）。

台本:
${cleaned}`;

                    try {
                        let yomiScript = await aiFeatures.callAI(yomiPrompt, apiKey, provider, true);
                        if (yomiScript && radioScriptYomiTextarea) {
                            let cleanedYomi = yomiScript
                                .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                                .split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');

                            // ダブルチェック機構
                            radioScriptLoading.textContent = 'ひらがなの誤字脱字をダブルチェック中...';
                            const checkPrompt = `以下の「漢字の台本」を元に作成された「現在のひらがな台本」をチェックしてください。
ひらがな台本に、誤字脱字、読み間違い、助詞の抜け、または【漢字やカタカナのまま残ってしまっている箇所】があれば修正し、**完全にひらがなのみ（記号・SE指定は除く）**になった「修正済みのひらがな台本」を出力してください。
漢字は絶対に使用しないでください。
「[SE: ...]」の行もそのまま残してください。
説明や前置きは一切不要です。出力は修正後のひらがなテキストのみにしてください。

【漢字の台本】
${cleaned}

【現在のひらがな台本】
${cleanedYomi}`;
                            try {
                                const checkedYomi = await aiFeatures.callAI(checkPrompt, apiKey, provider, true);
                                if (checkedYomi) {
                                    cleanedYomi = checkedYomi
                                        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                                        .split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
                                    console.log(`[ダブルチェック] 完了`);
                                }
                            } catch (checkErr) {
                                console.warn('[ダブルチェックエラー]', checkErr);
                            }

                            radioScriptYomiTextarea.value = cleanedYomi;
                            console.log(`[ひらがな変換] ${cleanedYomi.split('\n').length}行生成完了`);
                        }
                    } catch (yomiErr) {
                        console.warn('[ひらがな変換エラー]', yomiErr);
                    }
                } else {
                    alert("台本の生成に失敗しました（返答が空でした）。");
                }
            } catch (e) {
                console.error("台本生成エラー:", e);
                alert("台本の生成中にエラーが発生しました。\n" + e.message);
            } finally {
                radioScriptGenBtn.disabled = false;
                radioScriptLoading.style.display = 'none';
                radioScriptLoading.textContent = '生成中...（しばらくお待ちください）';
                radioScriptTextarea.disabled = false;
                if (radioScriptYomiTextarea) radioScriptYomiTextarea.disabled = false;
            }
        });

        const closeScriptModal = () => {
            radioScriptModal.style.display = 'none';
        };
        radioScriptCancelBtn.addEventListener('click', closeScriptModal);

        radioScriptClearBtn.addEventListener('click', () => {
            if (confirm("台本をクリアしてよろしいですか？")) {
                radioScriptTextarea.value = '';
            }
        });

        radioScriptSaveBtn.addEventListener('click', async () => {
            const rawScript = radioScriptTextarea.value;
            const lines = rawScript.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const rawYomi = radioScriptYomiTextarea ? radioScriptYomiTextarea.value : '';
            const yomiLines = rawYomi.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            radioModeState.scriptLines = lines;
            radioModeState.scriptYomiLines = yomiLines;
            radioModeState.currentScriptIndex = 0;
            radioModeState.currentPhase = 'none';

            // 進行状況（開始行）をリセット
            localStorage.setItem('radioScriptLastIndex', '0');
            const startLineInput = document.getElementById('radio-script-start-line');
            if (startLineInput) startLineInput.value = 1;

            // テキストファイルに保存（APIサーバー経由）
            try {
                const res = await fetch('http://127.0.0.1:8001/radio_script', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    body: rawScript
                });
                if (!res.ok) throw new Error('Save script failed');

                const resYomi = await fetch('http://127.0.0.1:8001/radio_script_yomi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    body: rawYomi
                });
                if (!resYomi.ok) throw new Error('Save yomi failed');

                const json = await res.json();
                console.log(`[ラジオ台本保存] radio_script.txtに${json.lines}行保存しました。`);
                alert(`台本を保存しました！（${json.lines}行）\nラジオモードONの状態で届くと、順番に読み上げます。`);
            } catch (e) {
                // フォールバック: localStorageに保存
                localStorage.setItem('savedRadioScript', rawScript);
                localStorage.setItem('savedRadioScriptYomi', rawYomi);
                console.warn(`[ラジオ台本保存] APIサーバーに接続できないためlocalStorageに保存しました。`);
                console.log(`[ラジオ台本保存] 全 ${lines.length} セリフとして保存しました。`);
                alert(`台本を保存しました！\nラジオモードONの状態で届くと、順番に読み上げます。`);
            }
            closeScriptModal();
        });

        // モーダルの背景クリックで閉じる
        radioScriptModal.addEventListener('click', (e) => {
            if (e.target === radioScriptModal) {
                closeScriptModal();
            }
        });
    }

    const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
    const aiHiraganaDictContainer = document.getElementById('ai-hiragana-dict-container');
    const aiHiraganaDict = document.getElementById('ai-hiragana-dict');
    if (aiHiraganaToggle) {
        const savedAiHiragana = localStorage.getItem('savedAiHiraganaToggle');
        if (savedAiHiragana !== null) {
            aiHiraganaToggle.checked = savedAiHiragana === 'true';
        }
        if (aiHiraganaDictContainer) {
            aiHiraganaDictContainer.style.display = aiHiraganaToggle.checked ? 'flex' : 'none';
        }
        aiHiraganaToggle.addEventListener('change', () => {
            localStorage.setItem('savedAiHiraganaToggle', aiHiraganaToggle.checked);
            if (aiHiraganaDictContainer) {
                aiHiraganaDictContainer.style.display = aiHiraganaToggle.checked ? 'flex' : 'none';
            }
        });
    }
    if (aiHiraganaDict) {
        let saveTimeout;
        aiHiraganaDict.addEventListener('input', () => {
            localStorage.setItem('savedAiHiraganaDict', aiHiraganaDict.value); // keeping localstorage as backup
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveHiraganaData, 1000);
        });
    }

    // Logic moved to ui_features.js

    async function loadHiraganaData() {
        try {
            const res = await fetch('http://localhost:8001/hiragana_data.json');
            if (res.ok) {
                const data = await res.json();
                if (data.dictionary !== undefined || data.cache !== undefined) {
                    aiHiraganaCache = data.cache || {};
                    if (aiHiraganaDict && data.dictionary !== undefined) {
                        aiHiraganaDict.value = data.dictionary;
                    }
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to load hiragana_data.json', e);
        }
        // Fallback (migrate from localStorage)
        try {
            const storedCache = localStorage.getItem('aiHiraganaCache');
            if (storedCache) aiHiraganaCache = JSON.parse(storedCache);
            const savedDict = localStorage.getItem('savedAiHiraganaDict');
            if (savedDict !== null && aiHiraganaDict) aiHiraganaDict.value = savedDict;
            saveHiraganaData(); // save to server
        } catch (e) {
            console.warn('Failed to migrate hiragana data', e);
        }
    }

    async function saveHiraganaData() {
        const dictionary = aiHiraganaDict ? aiHiraganaDict.value : '';
        const payload = { dictionary: dictionary, cache: aiHiraganaCache };
        try {
            await fetch('http://localhost:8001/update_hiragana_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error('Failed to save hiragana data to server', e);
        }
    }

    loadHiraganaData();

    // AI Cache Editor UI Logic
    const openCacheEditorBtn = document.getElementById('open-cache-editor-btn');
    const cacheEditorModal = document.getElementById('cache-editor-modal');
    const cacheEditorCloseBtn = document.getElementById('cache-editor-close-btn');
    const cacheEditorTbody = document.getElementById('cache-editor-tbody');
    const cacheEditorSearch = document.getElementById('cache-editor-search');

    function renderCacheEditorList(filterText = '') {
        if (!cacheEditorTbody) return;
        cacheEditorTbody.innerHTML = '';

        const entries = Object.entries(aiHiraganaCache).reverse();
        for (const [key, value] of entries) {
            if (filterText && !key.includes(filterText) && !value.includes(filterText)) continue;

            const tr = document.createElement('tr');

            const tdKey = document.createElement('td');
            tdKey.textContent = key;
            tdKey.title = key;
            tdKey.style.overflow = 'hidden';
            tdKey.style.textOverflow = 'ellipsis';
            tdKey.style.whiteSpace = 'nowrap';
            tdKey.style.maxWidth = '200px';

            const tdVal = document.createElement('td');
            const inputVal = document.createElement('input');
            inputVal.type = 'text';
            inputVal.value = value;
            inputVal.className = 'cache-edit-input';
            tdVal.appendChild(inputVal);

            const tdAction = document.createElement('td');
            tdAction.style.textAlign = 'right';
            tdAction.style.whiteSpace = 'nowrap';

            const saveBtn = document.createElement('button');
            saveBtn.textContent = '保存';
            saveBtn.style.marginRight = '5px';
            saveBtn.style.padding = '2px 8px';
            saveBtn.style.fontSize = '0.75rem';
            saveBtn.style.background = 'var(--primary)';
            saveBtn.style.color = '#000';
            saveBtn.style.border = 'none';
            saveBtn.style.borderRadius = '4px';
            saveBtn.style.cursor = 'pointer';
            saveBtn.onclick = () => {
                if (inputVal.value.trim() === '') return;
                aiHiraganaCache[key] = inputVal.value.trim();
                saveHiraganaData();
                saveBtn.textContent = '✓';
                setTimeout(() => saveBtn.textContent = '保存', 1000);
            };

            const delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.style.padding = '2px 8px';
            delBtn.style.fontSize = '0.75rem';
            delBtn.style.background = 'var(--danger, #ff4444)';
            delBtn.style.color = '#fff';
            delBtn.style.border = 'none';
            delBtn.style.borderRadius = '4px';
            delBtn.style.cursor = 'pointer';
            delBtn.onclick = () => {
                if (confirm('このキャッシュを削除しますか？')) {
                    delete aiHiraganaCache[key];
                    saveHiraganaData();
                    renderCacheEditorList(cacheEditorSearch.value);
                }
            };

            tdAction.appendChild(saveBtn);
            tdAction.appendChild(delBtn);

            tr.appendChild(tdKey);
            tr.appendChild(tdVal);
            tr.appendChild(tdAction);
            cacheEditorTbody.appendChild(tr);
        }
    }

    if (openCacheEditorBtn && cacheEditorModal) {
        openCacheEditorBtn.addEventListener('click', () => {
            cacheEditorModal.style.display = 'flex';
            cacheEditorSearch.value = '';
            renderCacheEditorList();
        });
        cacheEditorCloseBtn.addEventListener('click', () => {
            cacheEditorModal.style.display = 'none';
        });
        cacheEditorSearch.addEventListener('input', () => {
            renderCacheEditorList(cacheEditorSearch.value);
        });
    }

    const aiApiLink = document.getElementById('ai-api-link');
    function updateAiLink() {
        if (!aiApiLink) return;
        if (aiProviderSelect.value === 'openai') {
            aiApiLink.href = 'https://platform.openai.com/api-keys';
            aiApiLink.textContent = '▶︎ OpenAI APIキーを取得する';
            aiApiLink.style.color = '#ff6b6b';
        } else {
            aiApiLink.href = 'https://aistudio.google.com/app/apikey';
            aiApiLink.textContent = '▶︎ Gemini APIキーを取得する';
            aiApiLink.style.color = '#00f3ff';
        }
    }

    const aiModelInput = document.getElementById('ai-model-input');
    const savedModel = localStorage.getItem('savedAiModel');
    if (savedModel && aiModelInput) aiModelInput.value = savedModel;

    const voicevoxVolumeSlider = document.getElementById('voicevox-volume-slider');
    const voicevoxVolumeVal = document.getElementById('voicevox-volume-val');
    if (voicevoxVolumeSlider) {
        const savedVol = localStorage.getItem('savedVoicevoxVolume');
        if (savedVol !== null) {
            voicevoxVolumeSlider.value = savedVol;
            if (voicevoxVolumeVal) voicevoxVolumeVal.textContent = savedVol;
        }
        voicevoxVolumeSlider.addEventListener('input', () => {
            const vol = parseFloat(voicevoxVolumeSlider.value);
            if (voicevoxVolumeVal) voicevoxVolumeVal.textContent = Math.round(vol);
            localStorage.setItem('savedVoicevoxVolume', vol);
            if (voicevoxGainNode) {
                voicevoxGainNode.gain.value = vol / 100.0;
            }
        });
    }

    const seVolumeSlider = document.getElementById('se-volume-slider');
    const seVolumeVal = document.getElementById('se-volume-val');
    if (seVolumeSlider) {
        const savedSeVol = localStorage.getItem('savedSeVolume');
        if (savedSeVol !== null) {
            seVolumeSlider.value = savedSeVol;
            if (seVolumeVal) seVolumeVal.textContent = savedSeVol;
        }
        seVolumeSlider.addEventListener('input', () => {
            const vol = parseFloat(seVolumeSlider.value);
            if (seVolumeVal) seVolumeVal.textContent = Math.round(vol);
            localStorage.setItem('savedSeVolume', vol);
        });
    }

    aiProviderSelect.addEventListener('change', () => {
        localStorage.setItem('savedAiProvider', aiProviderSelect.value);
        if (aiModelInput) {
            aiModelInput.value = aiProviderSelect.value === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash';
            localStorage.setItem('savedAiModel', aiModelInput.value);
        }
        updateAiLink();
    });
    aiApiKeyInput.addEventListener('input', () => localStorage.setItem('savedAiApiKey', aiApiKeyInput.value.trim()));
    aiSystemPromptInput.addEventListener('input', () => localStorage.setItem('savedAiPrompt', aiSystemPromptInput.value.trim()));
    if (aiSearchSelect) {
        aiSearchSelect.addEventListener('change', () => localStorage.setItem('savedAiSearchSelect', aiSearchSelect.value));
    }
    if (aiModelInput) {
        aiModelInput.addEventListener('input', () => localStorage.setItem('savedAiModel', aiModelInput.value.trim()));
    }

    // 初期化
    updateAiLink();

    const aiFetchModelsBtn = document.getElementById('ai-fetch-models-btn');
    if (aiFetchModelsBtn) {
        aiFetchModelsBtn.addEventListener('click', async () => {
            const apiKey = aiApiKeyInput.value.trim();
            const provider = aiProviderSelect.value;
            if (!apiKey) {
                alert('APIキーを入力してください');
                return;
            }

            aiFetchModelsBtn.textContent = '取得中...';
            aiFetchModelsBtn.disabled = true;

            try {
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    const json = await res.json();
                    if (res.ok && json.data) {
                        const chatModels = json.data.filter(m => m.id.includes('gpt')).map(m => m.id).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
                        if (chatModels.length > 0) {
                            aiModelInput.innerHTML = '';
                            chatModels.forEach(m => {
                                const option = document.createElement('option');
                                option.value = m;
                                option.textContent = m;
                                aiModelInput.appendChild(option);
                            });
                            aiModelInput.value = chatModels.includes('gpt-4o-mini') ? 'gpt-4o-mini' : chatModels[0];
                            localStorage.setItem('savedAiModel', aiModelInput.value);
                            alert(`利用可能なモデルの一覧を取得しました！`);
                        } else {
                            alert('利用可能なチャットモデルが見つかりません');
                        }
                    } else {
                        throw new Error(json.error?.message || 'Invalid response');
                    }
                } else if (provider === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    const json = await res.json();
                    if (res.ok && json.models) {
                        const availableModels = json.models
                            .filter(m => m.name && m.name.includes('gemini'))
                            .map(m => m.name.replace('models/', ''))
                            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

                        if (availableModels.length > 0) {
                            aiModelInput.innerHTML = '';
                            availableModels.forEach(m => {
                                const option = document.createElement('option');
                                option.value = m;
                                option.textContent = m;
                                aiModelInput.appendChild(option);
                            });

                            let bestModel = availableModels[0];
                            if (availableModels.includes('gemini-1.5-flash')) bestModel = 'gemini-1.5-flash';
                            else if (availableModels.includes('gemini-1.5-pro')) bestModel = 'gemini-1.5-pro';
                            else if (availableModels.includes('gemini-1.0-pro')) bestModel = 'gemini-1.0-pro';
                            else if (availableModels.includes('gemini-pro')) bestModel = 'gemini-pro';

                            aiModelInput.value = bestModel;
                            localStorage.setItem('savedAiModel', aiModelInput.value);
                            alert(`利用可能なモデルの一覧を取得しました！\n左のリストからお好きなモデルを選べます。`);
                        } else {
                            alert('利用可能なモデルが見つかりませんでした');
                        }
                    } else {
                        throw new Error(json.error?.message || 'Invalid response');
                    }
                }
            } catch (e) {
                console.error('Fetch Models Error:', e);
                alert(`モデル一覧の取得に失敗しました:\n${e.message}`);
            } finally {
                aiFetchModelsBtn.textContent = '一覧を取得';
                aiFetchModelsBtn.disabled = false;
            }
        });
    }

    const aiTestBtn = document.getElementById('ai-test-btn');
    const aiTestStatus = document.getElementById('ai-test-status');

    if (aiTestBtn) {
        aiTestBtn.addEventListener('click', async () => {
            const apiKey = aiApiKeyInput.value.trim();
            const provider = aiProviderSelect.value;
            const aiModelInput = document.getElementById('ai-model-input');
            const modelName = aiModelInput ? aiModelInput.value.trim() : (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

            if (!apiKey) {
                aiTestStatus.textContent = '❌ APIキーを入力してください';
                aiTestStatus.style.color = 'var(--danger, #ff4444)';
                return;
            }

            aiTestStatus.textContent = '⏳ テスト中...';
            aiTestStatus.style.color = 'var(--text-muted)';
            aiTestBtn.disabled = true;

            try {
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: modelName || 'gpt-4o-mini',
                            messages: [{ role: 'user', content: 'test' }],
                            max_tokens: 5
                        })
                    });
                    const json = await res.json();
                    if (res.ok && json.choices) {
                        aiTestStatus.textContent = '✅ 有効なAPIキーです';
                        aiTestStatus.style.color = '#00f3ff';
                    } else {
                        throw new Error(json.error?.message || 'Invalid response');
                    }
                } else if (provider === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                        body: JSON.stringify({
                            model: modelName || 'gemini-1.5-flash',
                            input: 'test'
                        })
                    });
                    const json = await res.json();
                    if (res.ok && json.id) {
                        aiTestStatus.textContent = '✅ 有効なAPIキーです';
                        aiTestStatus.style.color = '#00f3ff';
                    } else {
                        throw new Error(json.error?.message || 'Invalid response');
                    }
                }
            } catch (e) {
                console.error('API Test Error:', e);
                let errMsg = e.message || '不明なエラー';
                if (errMsg.includes('Failed to fetch')) {
                    errMsg = '通信エラー (ネット未接続など)';
                }
                aiTestStatus.textContent = `❌ ${errMsg}`;
                aiTestStatus.style.color = 'var(--danger, #ff4444)';
            } finally {
                aiTestBtn.disabled = false;
            }
        });
    }

    let joinedUsers = new Set();
    function removeEmojis(text) {
        if (!text) return text;
        let clean = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
        clean = clean.replace(/:[^:\s]+:/g, '');
        clean = clean.replace(/@/g, ''); // 読み上げ時の「アット」を省略するため @ を全削除
        return clean.trim();
    }

    // コメント履歴の保存と復元
    let commentHistory = [];
    let totalCommentsCount = 0;
    function clearAllComments() {
        commentHistory = [];
        totalCommentsCount = 0;
        localStorage.setItem('savedCommentHistory', JSON.stringify([]));
        localStorage.setItem('savedTotalCommentsCount', 0);
        const el = document.getElementById('stat-comments');
        if (el) el.textContent = 0;

        // 統計情報もクリア
        const statSubscribers = document.getElementById('stat-subscribers');
        if (statSubscribers) statSubscribers.textContent = '0';
        const statViewers = document.getElementById('stat-viewers');
        if (statViewers) statViewers.textContent = '0';

        renderAllComments();
    }

    try {
        const saved = localStorage.getItem('savedCommentHistory');
        if (saved) {
            commentHistory = JSON.parse(saved);
        }
        const savedCount = localStorage.getItem('savedTotalCommentsCount');
        if (savedCount) {
            totalCommentsCount = parseInt(savedCount, 10);
        }
        if (totalCommentsCount < commentHistory.length) {
            totalCommentsCount = commentHistory.length;
        }
        const el = document.getElementById('stat-comments');
        if (el) el.textContent = totalCommentsCount;
    } catch (e) {
        console.warn('Failed to load comment history', e);
    }

    function renderAllComments() {
        const viewer = document.getElementById('comment-viewer');
        if (!viewer) return;
        viewer.innerHTML = '';
        // 履歴をそのままレンダリング (古い順、最新が下になるように)
        commentHistory.forEach(c => {
            const el = document.createElement('div');
            el.className = `comment-item ${c.platform}-comment`;
            if (c.isGift) el.classList.add('gift-comment');

            const icon = c.platform === 'youtube' ? '🔴' : c.platform === 'tiktok' ? '🎵' : '💬';

            let avatarHtml = '';
            if (c.iconUrl) {
                avatarHtml = `<img src="${c.iconUrl}" class="comment-avatar" alt="${c.nickname}" crossorigin="anonymous">`;
            }
            el.innerHTML = `<div class="comment-author">${avatarHtml}<span>${icon} ${c.nickname}</span></div><div class="comment-text">${c.comment}</div>`;
            viewer.appendChild(el);
        });
        viewer.scrollTop = viewer.scrollHeight; // 一番下(最新)にスクロール
    }

    // リセットボタンの登録
    const clearCommentsBtn = document.getElementById('clear-comments-btn');
    if (clearCommentsBtn) {
        clearCommentsBtn.addEventListener('click', () => {
            clearAllComments();
        });
    }

    // 初回レンダリング
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderAllComments);
    } else {
        renderAllComments();
    }

    // コメントビューアー用関数
    function addCommentToViewer(nickname, comment, platform, isGift = false, iconUrl = "") {
        // サーバーから送られてきた履歴の重複表示・二重カウントを防ぐ
        const checkRange = commentHistory.slice(-50);
        const isDuplicate = checkRange.some(c => c.nickname === nickname && c.comment === comment && c.platform === platform);

        if (isDuplicate) return;

        commentHistory.push({ nickname, comment, platform, isGift, iconUrl });
        if (commentHistory.length > 100) {
            commentHistory.shift();
        }
        localStorage.setItem('savedCommentHistory', JSON.stringify(commentHistory));

        totalCommentsCount++;
        localStorage.setItem('savedTotalCommentsCount', totalCommentsCount);
        const statCommentsEl = document.getElementById('stat-comments');
        if (statCommentsEl) statCommentsEl.textContent = totalCommentsCount;

        const viewer = document.getElementById('comment-viewer');
        if (!viewer) return;

        const el = document.createElement('div');
        el.className = `comment-item ${platform}-comment`;
        if (isGift) el.classList.add('gift-comment');

        const icon = platform === 'youtube' ? '🔴' : platform === 'tiktok' ? '🎵' : '💬';

        let avatarHtml = '';
        if (iconUrl) {
            avatarHtml = `<img src="${iconUrl}" class="comment-avatar" alt="${nickname}" crossorigin="anonymous">`;
        }

        el.innerHTML = `<div class="comment-author">${avatarHtml}<span>${icon} ${nickname}</span></div><div class="comment-text">${comment}</div>`;
        viewer.appendChild(el);

        // 最新のコメントが見えるようにスクロール
        viewer.scrollTop = viewer.scrollHeight;

        // 最大100件まで保持
        while (viewer.children.length > 100) {
            viewer.removeChild(viewer.firstChild);
        }
    }

    let isTiktokIntendedConnect = false;
    let tiktokReconnectTimer = null;

    if (tiktokConnectBtn) {
        tiktokConnectBtn.addEventListener('click', (event) => {
            const username = tiktokUserInput.value.trim();
            if (!username) {
                // 手動操作の場合はアラート、自動接続（スクリプトからの.click()）は静かにスキップ
                if (event && event.isTrusted) {
                    alert('TikTokのユーザー名を入力してください');
                }
                return;
            }
            const savedTiktokId = localStorage.getItem('savedTiktokId');
            if (savedTiktokId && savedTiktokId !== username) {
                if (typeof clearAllComments === 'function') clearAllComments();
            }
            localStorage.setItem('savedTiktokId', username);

            if (isTiktokIntendedConnect) {
                isTiktokIntendedConnect = false;
                clearTimeout(tiktokReconnectTimer);
                if (tiktokWs) {
                    if (tiktokWs.readyState === WebSocket.OPEN) {
                        tiktokWs.send(JSON.stringify({ type: 'disconnect_tiktok' }));
                    }
                    tiktokWs.close();
                    tiktokWs = null;
                }
                tiktokConnectBtn.textContent = '接続';
                tiktokConnectBtn.style.background = 'var(--primary)';
                tiktokStatus.textContent = '未接続';
                joinedUsers.clear();
                return;
            }

            isTiktokIntendedConnect = true;
            joinedUsers.clear();
            tiktokStatus.textContent = '接続中...';
            tiktokWs = new WebSocket('ws://localhost:8767');

            tiktokWs.onopen = () => {
                tiktokWs.send(JSON.stringify({ type: 'connect_tiktok', username: username }));
                tiktokConnectBtn.textContent = '切断';
                tiktokConnectBtn.style.background = 'var(--danger, #ff4444)';
                resetIdleTimer();
            };

            tiktokWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'status') {
                        tiktokStatus.textContent = data.message;
                        if (data.status === 'connected') {
                            console.log('[TikTok] コメント読み上げの準備が完了しました！');
                        }
                        if (data.status === 'error') {
                            if (tiktokWs) {
                                tiktokWs.close();
                                tiktokWs = null;
                            }
                            tiktokConnectBtn.textContent = '接続';
                            tiktokConnectBtn.style.background = 'var(--primary)';
                        }
                    } else if (data.type === 'join') {
                        console.log(`[TikTok] ${data.nickname} joined`);
                        if (isVoicevoxEnabled && (typeof isStreamEndedState === 'undefined' || !isStreamEndedState)) {
                            const cleanName = data.nickname.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
                            if (cleanName.length > 0) {
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                if (joinedUsers.has(cleanName)) {
                                    // 2回目以降の入室（戻ってきた）
                                    let greet = zunda ? `${cleanName}さん、おかえりなさいなのだ！` : `${cleanName}さん、おかえりなさい！`;
                                    greet = aiFeatures.adjustIdlePhraseForModel(greet, currentModelId);
                                    queueVoicevoxAudio(greet);
                                } else {
                                    // 初回の入室
                                    joinedUsers.add(cleanName);
                                    const timeGreeting = getTimeGreeting();
                                    const phrases = zunda ? [
                                        "いらっしゃい！",
                                        "ゆっくりしていってね！",
                                        "遊びに来てくれてありがとうなのだ！"
                                    ] : [
                                        "いらっしゃい！",
                                        "ゆっくりしていってね！",
                                        "遊びに来てくれてありがとう！"
                                    ];
                                    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
                                    aiEmotion = 'joy';

                                    let fullGreeting = zunda
                                        ? `${cleanName}さん、${timeGreeting}なのだ！${randomPhrase}`
                                        : `${cleanName}さん、${timeGreeting}！${randomPhrase}`;

                                    fullGreeting = aiFeatures.adjustIdlePhraseForModel(fullGreeting, currentModelId);
                                    queueVoicevoxAudio(fullGreeting);
                                }
                            }
                        }
                    } else if (data.type === 'gift') {
                        console.log(`[TikTok] ${data.nickname} sent a gift`);
                        addCommentToViewer(data.nickname, `🎁 ギフトを送りました！`, 'tiktok', true, data.iconUrl);
                        if (isVoicevoxEnabled && (typeof isStreamEndedState === 'undefined' || !isStreamEndedState)) {
                            const cleanName = removeEmojis(data.nickname);
                            if (cleanName.length > 0) {
                                aiEmotion = 'joy';
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                let greet = zunda ? `${cleanName}さん、ギフトありがとうなのだ！` : `${cleanName}さん、ギフトありがとう！`;
                                greet = aiFeatures.adjustIdlePhraseForModel(greet, currentModelId);
                                queueVoicevoxAudio(greet);
                            }
                        }
                    } else if (data.type === 'like') {
                        console.log(`[TikTok] ${data.nickname} sent likes`);
                        // いいね連打対策のため読み上げは行わない
                    } else if (data.type === 'comment') {
                        console.log(`[TikTok] @${data.nickname}: ${data.comment}`);
                        addCommentToViewer(data.nickname, data.comment, 'tiktok', false, data.iconUrl);
                        if (isVoicevoxEnabled && (typeof isStreamEndedState === 'undefined' || !isStreamEndedState)) {
                            // 絵文字を除去してテンポ良く読み上げる
                            const cleanNickname = removeEmojis(data.nickname);
                            const cleanComment = removeEmojis(data.comment);
                            if (cleanComment.length > 0) {
                                // ユーザーのコメントから感情を推測して即座に表情を変える
                                aiEmotion = guessEmotionFromText(cleanComment);

                                const timeGreeting = getTimeGreeting();
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                const replies = [
                                    { keywords: ["おはよう", "おは", "こんにちは", "こんちわ", "こんばん", "やっほ", "ハロー"], response: zunda ? `${timeGreeting}ー！来てくれてありがとうなのだ！` : `${timeGreeting}ー！来てくれてありがとう！` },
                                    { keywords: ["かわいい", "可愛い", "カワイイ", "かわちい", "美人", "きれい"], response: zunda ? "えへへ、褒められちゃったのだ！ありがとうなのだ！" : "えへへ、褒められちゃった！ありがとう！" },
                                    { keywords: ["初見", "しょけん"], response: zunda ? "初見さん、初めましてなのだ！ゆっくりしていってほしいのだ！" : "初見さん、初めまして！ゆっくりしていってね！" },
                                    { keywords: ["草", "w", "ｗ", "ウケる", "笑", "ワロタ"], response: zunda ? "あはははなのだっ！" : "あはははっ！" },
                                    { keywords: ["おつ", "お疲れ", "おつかれ", "バイバイ", "おやすみ", "寝る"], response: zunda ? "お疲れ様なのだー！またねなのだ！" : "お疲れ様ー！またね！" },
                                    { keywords: ["？", "?", "なんで", "どうして"], response: zunda ? "んー、どうだろうねー？私には分かんないのだ！" : "んー、どうだろうねー？私には分かんないや！" }
                                ];

                                const matchedRule = replies.find(rule => rule.keywords.some(kw => cleanComment.includes(kw)));
                                const isQueueFull = voicevoxAudioQueue.length >= 5;

                                // キューが溢れていて、かつ重要なキーワードも含まれていない場合はスキップ
                                if (isQueueFull && !matchedRule) {
                                    console.log(`[TikTok Skip] 待機列過多のためスキップ: ${cleanComment}`);
                                } else {
                                    // 1. コメントを読み上げる
                                    queueVoicevoxAudio(`${cleanNickname}さん、${cleanComment}`);

                                    if (isAiReplyEnabled && aiApiKeyInput && aiApiKeyInput.value.trim().length > 0) {
                                        // 2A. AIによる自動返信
                                        generateAIResponse(cleanNickname, cleanComment);
                                    } else {
                                        // 2B. キーワードによる自動返信
                                        if (matchedRule) {
                                            const adjustedReply = aiFeatures.adjustIdlePhraseForModel(matchedRule.response, currentModelId);
                                            queueVoicevoxAudio(adjustedReply);
                                        } else if (Math.random() < 0.20) {
                                            // 3. キーワードに一致しなかった場合、たまに相槌を打つ（20%の確率）
                                            const genericReplies = ["なるほどなるほどー", "たしかにー！", "へぇー！", "そうんだね！", "わかるわかるー"];
                                            const adjustedReply = aiFeatures.adjustIdlePhraseForModel(genericReplies[Math.floor(Math.random() * genericReplies.length)], currentModelId);
                                            queueVoicevoxAudio(adjustedReply);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('TikTok WS parse error', e);
                }
            };

            tiktokWs.onclose = () => {
                if (isTiktokIntendedConnect) {
                    tiktokStatus.textContent = '再接続中...';
                    tiktokConnectBtn.textContent = '再接続';
                    tiktokConnectBtn.style.background = '#ff8800';
                    clearTimeout(tiktokReconnectTimer);
                    tiktokReconnectTimer = setTimeout(() => {
                        if (isTiktokIntendedConnect) tiktokConnectBtn.click();
                    }, 5000);
                } else {
                    tiktokStatus.textContent = '未接続';
                    tiktokConnectBtn.textContent = '接続';
                    tiktokConnectBtn.style.background = 'var(--primary)';
                }
            };

            tiktokWs.onerror = (err) => {
                console.error('TikTok WS error', err);
                tiktokStatus.textContent = '接続エラー';
                if (typeof clearIdleTimer === 'function') clearIdleTimer();
            };
        });

        // 保存されたTikTokIDがあれば入力欄に復元、空でない場合のみ自動接続
        const savedTiktokId = localStorage.getItem('savedTiktokId');
        if (savedTiktokId !== null) {
            const trimmedTiktokId = savedTiktokId.trim();
            if (trimmedTiktokId) {
                if (tiktokUserInput) tiktokUserInput.value = trimmedTiktokId;
                // IDが入力されている場合のみ自動接続する
                setTimeout(() => {
                    tiktokConnectBtn.click();
                }, 500);
            } else {
                // 空のまま保存されている場合は削除してクリーンな状態に
                localStorage.removeItem('savedTiktokId');
            }
        }
    }

    let isYoutubeIntendedConnect = false;
    let youtubeReconnectTimer = null;

    if (youtubeConnectBtn) {
        youtubeConnectBtn.addEventListener('click', (event) => {
            const videoId = youtubeUserInput.value.trim();
            if (!videoId) {
                if (event && event.isTrusted) {
                    alert('YouTubeの動画IDを入力してください');
                }
                return;
            }

            const savedYoutubeId = localStorage.getItem('savedYoutubeId');
            if (savedYoutubeId && savedYoutubeId !== videoId) {
                if (typeof clearAllComments === 'function') clearAllComments();
            }
            localStorage.setItem('savedYoutubeId', videoId);

            if (isYoutubeIntendedConnect) {
                isYoutubeIntendedConnect = false;
                clearTimeout(youtubeReconnectTimer);
                if (youtubeWs) {
                    if (youtubeWs.readyState === WebSocket.OPEN) {
                        youtubeWs.send(JSON.stringify({ type: 'disconnect_youtube' }));
                    }
                    youtubeWs.close();
                    youtubeWs = null;
                }
                youtubeConnectBtn.textContent = '接続';
                youtubeConnectBtn.style.background = '#ff0000';
                youtubeStatus.textContent = '未接続';
                const scheduleContainer = document.getElementById('youtube-schedule-container');
                if (scheduleContainer) scheduleContainer.style.display = 'none';
                if (window.youtubeScheduleTimer) clearInterval(window.youtubeScheduleTimer);
                return;
            }

            isYoutubeIntendedConnect = true;
            youtubeStatus.textContent = '接続中...';
            youtubeWs = new WebSocket('ws://localhost:8768');

            youtubeWs.onopen = () => {
                youtubeWs.send(JSON.stringify({ type: 'connect_youtube', video_id: videoId }));
                // 配信状態もチェック
                youtubeWs.send(JSON.stringify({ type: 'check_stream_status', videoId: videoId }));
                youtubeConnectBtn.textContent = '切断';
                youtubeConnectBtn.style.background = 'var(--danger, #ff4444)';
                if (typeof resetIdleTimer === 'function') resetIdleTimer();
            };

            youtubeWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'status') {
                        youtubeStatus.textContent = data.message;
                        if (data.status === 'connected') {
                            console.log('[YouTube] コメント読み上げの準備が完了しました！');
                        }
                        if (data.status === 'error' || data.status === 'disconnected') {
                            if (youtubeWs) {
                                youtubeWs.close();
                                youtubeWs = null;
                            }
                            youtubeConnectBtn.textContent = '接続';
                            youtubeConnectBtn.style.background = '#ff0000';
                            const scheduleContainer = document.getElementById('youtube-schedule-container');
                            if (scheduleContainer) scheduleContainer.style.display = 'none';
                            if (window.youtubeScheduleTimer) clearInterval(window.youtubeScheduleTimer);
                        }
                    } else if (data.type === 'stream_started') {
                        youtubeStatus.textContent = data.message;
                        youtubeStatus.style.color = '#0f0';
                        setTimeout(() => { youtubeStatus.style.color = ''; }, 3000);
                        const scheduleContainer = document.getElementById('youtube-schedule-container');
                        if (scheduleContainer) scheduleContainer.style.display = 'none';
                    } else if (data.type === 'stream_info') {
                        if (data.liveBroadcastContent === 'upcoming' && data.scheduledStartTime) {
                            const scheduleContainer = document.getElementById('youtube-schedule-container');
                            const timeEl = document.getElementById('youtube-schedule-time');
                            const countdownEl = document.getElementById('youtube-schedule-countdown');
                            const autoStartCb = document.getElementById('youtube-auto-start-cb');

                            if (scheduleContainer) scheduleContainer.style.display = 'block';

                            const targetTime = new Date(data.scheduledStartTime);
                            if (timeEl) {
                                timeEl.textContent = `予定時刻: ${targetTime.toLocaleString()}`;
                            }

                            // 既に予定時刻を過ぎている場合は、自動開始のトリガーを行わない（リロード時の誤作動防止）
                            if (targetTime.getTime() - new Date().getTime() <= 0) {
                                if (countdownEl) countdownEl.textContent = "00:00:00";
                                return;
                            }

                            if (window.youtubeScheduleTimer) clearInterval(window.youtubeScheduleTimer);
                            window.youtubeScheduleTimer = setInterval(() => {
                                const now = new Date();
                                const diff = targetTime.getTime() - now.getTime();

                                if (diff <= 0) {
                                    clearInterval(window.youtubeScheduleTimer);
                                    if (countdownEl) countdownEl.textContent = "00:00:00";

                                    if (autoStartCb && autoStartCb.checked && youtubeWs && youtubeWs.readyState === WebSocket.OPEN) {
                                        console.log('[YouTube] 予約時間になりました。配信開始とラジオ再生をトリガーします。');
                                        youtubeWs.send(JSON.stringify({ type: 'start_youtube_stream', videoId: videoId }));

                                        // ラジオ台本ボタンを押す（もし存在し、ラジオが生成されていれば）
                                        setTimeout(() => {
                                            const playBtn = document.getElementById('radio-script-play-btn');
                                            if (playBtn) {
                                                console.log('[YouTube] ラジオ自動再生を実行');
                                                playBtn.click();
                                            }
                                        }, 1000); // 配信開始から少し遅らせて再生
                                    }

                                    if (scheduleContainer) {
                                        setTimeout(() => { scheduleContainer.style.display = 'none'; }, 5000);
                                    }
                                } else {
                                    const hours = Math.floor(diff / (1000 * 60 * 60));
                                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    const secs = Math.floor((diff % (1000 * 60)) / 1000);
                                    if (countdownEl) {
                                        countdownEl.textContent =
                                            String(hours).padStart(2, '0') + ':' +
                                            String(mins).padStart(2, '0') + ':' +
                                            String(secs).padStart(2, '0');
                                    }
                                }
                            }, 1000);
                        }
                    } else if (data.type === 'stats') {
                        const statSubEl = document.getElementById('stat-subscribers');
                        const statViewEl = document.getElementById('stat-viewers');
                        if (statSubEl && data.subscribers) {
                            function formatStatNumber(str) {
                                if (!str) return "0";
                                let cleanStr = str.replace(/チャンネル登録者数/g, '').replace(/subscribers/ig, '').trim().replace(/,/g, '');
                                let numMatch = cleanStr.match(/^([0-9\.]+)\s*(.*)$/);
                                if (!numMatch) return str;
                                let num = parseFloat(numMatch[1]);
                                let suffix = numMatch[2].toLowerCase();
                                if (suffix.startsWith('k') || suffix.startsWith('thousand')) num *= 1000;
                                else if (suffix.startsWith('m') || suffix.startsWith('million')) num *= 1000000;
                                else if (suffix.startsWith('万')) num *= 10000;
                                else if (suffix.startsWith('億')) num *= 100000000;
                                return num.toLocaleString();
                            }
                            statSubEl.textContent = formatStatNumber(data.subscribers);
                        }
                        if (statViewEl && data.viewers) {
                            statViewEl.textContent = data.viewers;
                        }
                    } else if (data.type === 'gift') {
                        console.log(`[YouTube SuperChat] ${data.nickname} sent ${data.amount}`);
                        addCommentToViewer(data.nickname, `💰 スーパーチャット: ${data.amount}`, 'youtube', true, data.iconUrl);
                        if (isVoicevoxEnabled && !data.isHistory && typeof isStreamEndedState !== 'undefined' && !isStreamEndedState) {
                            const cleanName = removeEmojis(data.nickname);
                            if (cleanName.length > 0) {
                                aiEmotion = 'joy';
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                let greet = zunda ? `${cleanName}さん、スーパーチャットありがとうなのだ！` : `${cleanName}さん、スーパーチャットありがとう！`;
                                greet = aiFeatures.adjustIdlePhraseForModel(greet, currentModelId);
                                queueVoicevoxAudio(greet);
                            }
                        }
                    } else if (data.type === 'comment') {
                        console.log(`[YouTube] @${data.nickname}: ${data.comment}`);
                        addCommentToViewer(data.nickname, data.comment, 'youtube', false, data.iconUrl);
                        if (isVoicevoxEnabled && !data.isHistory && typeof isStreamEndedState !== 'undefined' && !isStreamEndedState) {
                            const cleanNickname = removeEmojis(data.nickname);
                            const cleanComment = removeEmojis(data.comment);
                            if (cleanComment.length > 0) {
                                aiEmotion = guessEmotionFromText(cleanComment);

                                const timeGreeting = getTimeGreeting();
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                const replies = [
                                    { keywords: ["おはよう", "おは", "こんにちは", "こんちわ", "こんばん", "やっほ", "ハロー"], response: zunda ? `${timeGreeting}ー！来てくれてありがとうなのだ！` : `${timeGreeting}ー！来てくれてありがとう！` },
                                    { keywords: ["かわいい", "可愛い", "カワイイ", "かわちい", "美人", "きれい"], response: zunda ? "えへへ、褒められちゃったのだ！ありがとうなのだ！" : "えへへ、褒められちゃった！ありがとう！" },
                                    { keywords: ["初見", "しょけん"], response: zunda ? "初見さん、初めましてなのだ！ゆっくりしていってほしいのだ！" : "初見さん、初めまして！ゆっくりしていってね！" },
                                    { keywords: ["草", "w", "ｗ", "ウケる", "笑", "ワロタ"], response: zunda ? "あはははなのだっ！" : "あはははっ！" },
                                    { keywords: ["おつ", "お疲れ", "おつかれ", "バイバイ", "おやすみ", "寝る"], response: zunda ? "お疲れ様なのだー！またねなのだ！" : "お疲れ様ー！またね！" },
                                    { keywords: ["？", "?", "なんで", "どうして"], response: zunda ? "んー、どうだろうねー？私には分かんないのだ！" : "んー、どうだろうねー？私には分かんないや！" }
                                ];

                                const matchedRule = replies.find(rule => rule.keywords.some(kw => cleanComment.includes(kw)));
                                const isQueueFull = voicevoxAudioQueue.length >= 5;

                                if (isQueueFull && !matchedRule) {
                                    console.log(`[YouTube Skip] 待機列過多のためスキップ: ${cleanComment}`);
                                } else {
                                    queueVoicevoxAudio(`${cleanNickname}さん、${cleanComment}`);

                                    if (isAiReplyEnabled && aiApiKeyInput && aiApiKeyInput.value.trim().length > 0) {
                                        generateAIResponse(cleanNickname, cleanComment);
                                    } else {
                                        if (matchedRule) {
                                            const adjustedReply = aiFeatures.adjustIdlePhraseForModel(matchedRule.response, currentModelId);
                                            queueVoicevoxAudio(adjustedReply);
                                        } else if (Math.random() < 0.20) {
                                            const genericReplies = ["なるほどなるほどー", "たしかにー！", "へぇー！", "そうんだね！", "わかるわかるー"];
                                            const adjustedReply = aiFeatures.adjustIdlePhraseForModel(genericReplies[Math.floor(Math.random() * genericReplies.length)], currentModelId);
                                            queueVoicevoxAudio(adjustedReply);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('YouTube WS parse error', e);
                }
            };

            youtubeWs.onclose = () => {
                if (isYoutubeIntendedConnect) {
                    youtubeStatus.textContent = '再接続中...';
                    youtubeConnectBtn.textContent = '再接続';
                    youtubeConnectBtn.style.background = '#ff8800';
                    clearTimeout(youtubeReconnectTimer);
                    youtubeReconnectTimer = setTimeout(() => {
                        if (isYoutubeIntendedConnect) youtubeConnectBtn.click();
                    }, 5000);
                } else {
                    youtubeStatus.textContent = '未接続';
                    youtubeConnectBtn.textContent = '接続';
                    youtubeConnectBtn.style.background = '#ff0000';
                }
            };

            youtubeWs.onerror = (err) => {
                console.error('YouTube WS error', err);
                youtubeStatus.textContent = '接続エラー';
                if (typeof clearIdleTimer === 'function') clearIdleTimer();
            };
        });

        const savedYoutubeId = localStorage.getItem('savedYoutubeId');
        if (savedYoutubeId && youtubeUserInput) {
            youtubeUserInput.value = savedYoutubeId;
            if (savedYoutubeId.trim() && youtubeConnectBtn) {
                // IDが入力されている場合のみ自動接続する
                setTimeout(() => {
                    youtubeConnectBtn.click();
                }, 1500); // 起動時の負荷分散のため遅延させる
            }
        }
    }

    // --- Google OAuth (YouTube Data API) Logic ---
    const oauthClientIdInput = document.getElementById('youtube-oauth-client-id');
    const oauthApiKeyInput = document.getElementById('youtube-api-key');
    const oauthLoginBtn = document.getElementById('youtube-oauth-login-btn');
    const oauthLogoutBtn = document.getElementById('youtube-oauth-logout-btn');
    const oauthStatus = document.getElementById('youtube-oauth-status');
    let tokenClient = null;
    let oauthAccessToken = null;
    let oauthStatInterval = null;

    if (oauthClientIdInput && oauthLoginBtn) {
        // =========================================================
        // Load saved credentials and access token
        // =========================================================
        const savedClientId = localStorage.getItem('savedYoutubeClientId');
        const savedApiKey = localStorage.getItem('savedYoutubeApiKey');
        if (savedClientId) oauthClientIdInput.value = savedClientId;
        if (savedApiKey) oauthApiKeyInput.value = savedApiKey;

        const savedToken = localStorage.getItem('savedGoogleAccessToken');
        const savedTokenTime = localStorage.getItem('savedGoogleAccessTime');
        if (savedToken && savedTokenTime) {
            const timeElapsed = Date.now() - parseInt(savedTokenTime, 10);
            // トークンの有効期限は通常1時間。余裕を見て55分(3300000ms)以内なら再利用
            if (timeElapsed < 3300000) {
                oauthAccessToken = savedToken;
                oauthStatus.textContent = '認証成功（復元）';
                oauthLoginBtn.style.display = 'none';
                oauthLogoutBtn.style.display = 'block';

                // Fetch stats immediately and then periodically
                setTimeout(() => {
                    fetchYoutubeApiStats();
                    if (oauthStatInterval) clearInterval(oauthStatInterval);
                    oauthStatInterval = setInterval(fetchYoutubeApiStats, 60000);
                }, 1000); // すぐだとAPIキーの復元と競合する可能性があるので少し待つ
            } else {
                // 期限切れ
                localStorage.removeItem('savedGoogleAccessToken');
                localStorage.removeItem('savedGoogleAccessTime');
            }
        }

        // Dynamically load Google Identity Services
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        gisScript.onload = () => {
            console.log("Google Identity Services loaded.");
        };
        document.head.appendChild(gisScript);

        async function fetchYoutubeApiStats() {
            if (!oauthAccessToken || !oauthApiKeyInput.value.trim()) return;
            try {
                const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true&key=${oauthApiKeyInput.value.trim()}`, {
                    headers: {
                        'Authorization': `Bearer ${oauthAccessToken}`
                    }
                });
                const data = await res.json();
                if (data.items && data.items.length > 0) {
                    const stats = data.items[0].statistics;
                    const statSubEl = document.getElementById('stat-subscribers');
                    if (statSubEl && stats.subscriberCount) {
                        const num = parseInt(stats.subscriberCount, 10);
                        if (!isNaN(num)) statSubEl.textContent = num.toLocaleString();
                    }
                }
            } catch (e) {
                console.error("YouTube Data API fetch error:", e);
                oauthStatus.textContent = 'APIフェッチエラー';
            }
        }

        oauthLoginBtn.addEventListener('click', () => {
            const clientId = oauthClientIdInput.value.trim();
            const apiKey = oauthApiKeyInput.value.trim();
            if (!clientId || !apiKey) {
                alert("クライアントIDとAPIキーを入力してください。");
                return;
            }
            localStorage.setItem('savedYoutubeClientId', clientId);
            localStorage.setItem('savedYoutubeApiKey', apiKey);

            if (!tokenClient) {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/youtube.readonly',
                    callback: (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            oauthAccessToken = tokenResponse.access_token;

                            // Save to local storage
                            localStorage.setItem('savedGoogleAccessToken', oauthAccessToken);
                            localStorage.setItem('savedGoogleAccessTime', Date.now());

                            oauthStatus.textContent = '認証成功（統計取得中）';
                            oauthLoginBtn.style.display = 'none';
                            oauthLogoutBtn.style.display = 'block';

                            // Fetch stats immediately and then periodically
                            fetchYoutubeApiStats();
                            if (oauthStatInterval) clearInterval(oauthStatInterval);
                            oauthStatInterval = setInterval(fetchYoutubeApiStats, 60000); // 1 minute interval
                        }
                    },
                });
            }
            tokenClient.requestAccessToken();
        });

        oauthLogoutBtn.addEventListener('click', () => {
            if (oauthAccessToken && typeof google !== 'undefined' && google.accounts) {
                try {
                    google.accounts.oauth2.revoke(oauthAccessToken, () => {
                        console.log('Access token revoked');
                    });
                } catch (e) {
                    console.error("Token revoke failed", e);
                }
            }
            oauthAccessToken = null;
            localStorage.removeItem('savedGoogleAccessToken');
            localStorage.removeItem('savedGoogleAccessTime');

            if (oauthStatInterval) clearInterval(oauthStatInterval);
            oauthStatus.textContent = '未認証';
            oauthLoginBtn.style.display = 'block';
            oauthLogoutBtn.style.display = 'none';
        });
    }


    async function fetchWebSearch(query) {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    return data.results.map(r => `・${r.title}: ${r.body}`).join('\n');
                }
            }
        } catch (e) {
            console.error('Search API error:', e);
        }
        return '';
    }

    async function generateAIResponse(nickname, comment, autoContext = "") {
        if (!aiApiKeyInput || !aiProviderSelect || !aiSystemPromptInput) return;
        const apiKey = aiApiKeyInput.value.trim();
        const provider = aiProviderSelect.value;
        const systemPromptRaw = aiSystemPromptInput.value.trim();
        let modelCharacterInstruction = "";
        if (typeof currentModelId !== 'undefined') {
            if (currentModelId === 'hiyori') {
                modelCharacterInstruction = "\n\n【キャラクター設定】あなたは元気で明るい女子高生の「ひより」です。親しみやすく、語尾には「〜だよ！」「〜だね！」などをつけて元気いっぱいに話してください。";
            } else if (currentModelId === 'akari') {
                modelCharacterInstruction = "\n\n【キャラクター設定】あなたは落ち着いた優しいお姉さんキャラの「あかり」です。丁寧な口調で、少し大人っぽく「〜ね」「〜かしら」などを交えて話してください。";
            } else if (currentModelId === 'hijiki') {
                modelCharacterInstruction = "\n\n【キャラクター設定】あなたは黒猫の「ひじき」です。人間の言葉を話す猫として振る舞い、語尾に「〜にゃ」「〜にゃん」をつけて可愛く話してください。";
            } else if (currentModelId === 'tororo') {
                modelCharacterInstruction = "\n\n【キャラクター設定】あなたは白猫の「とろろ」です。人間の言葉を話す猫として振る舞い、語尾に「〜にゃ」「〜にゃん」をつけてマイペースに話してください。";
            } else if (currentModelId === 'wanko') {
                modelCharacterInstruction = "\n\n【キャラクター設定】あなたは元気な犬の「わんこ」です。人間の言葉を話す犬として振る舞い、語尾に「〜だワン」「〜ワン！」をつけて人懐っこく話してください。";
            }
        }

        const zundamonInstruction = isZundamonSelected() && !modelCharacterInstruction ? "\n\n【重要】あなたは「ずんだもん」です。語尾には必ず「〜のだ」や「〜なのだ」をつけて話してください。ただし、質問や疑問形の場合は「〜のだ？」や「〜なの？」は使わず、自然な疑問形（例：〜する？、〜かな？）にしてください。" : "";

        const activeCharacterInstruction = modelCharacterInstruction || zundamonInstruction;

        const emotionInstruction = "\n\n【重要】返答の先頭に必ず [joy], [angry], [sad], [neutral] のいずれかの感情タグをつけてください。例: [joy]わーい！" + activeCharacterInstruction;

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentDate = now.getDate();
        const days = ['にちようび', 'げつようび', 'かようび', 'すいようび', 'もくようび', 'きんようび', 'どようび'];
        const currentDay = days[now.getDay()];
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        let greetingHint = "こんにちわ";
        if (currentHour >= 5 && currentHour < 11) greetingHint = "おはよう";
        else if (currentHour >= 18 || currentHour < 5) greetingHint = "こんばんわ";

        const timeContext = `\n\n【現在日時】きょうは ${currentMonth}月${currentDate}日（${currentDay}）、現在は ${currentHour}時${currentMinute}分 です。日付や時間、曜日を聞かれた場合は「〜がつ〜にち」「〜ようび」「〜じ〜ふん」と自然なひらがなで答えてください。ユーザーへの挨拶が必要な場合は「${greetingHint}」を使用してください。`;

        const roleplayInstruction = "\n\n【配信者としての振る舞い（超重要）】あなたはバーチャル空間から配信しているVTuber（配信者）です。「私はAIなので…」といった機械的な発言やAIだと自称することは絶対にやめてください。\n・天気や最新ニュースなどを聞かれた場合は、必ず最新の情報を検索・調査して答えてください。\n・【重要】最新情報を検索しても分からない場合や、全く知識がない場合にのみ、「ずっと部屋でゲームしてるから分からないよ〜！」のように人間の配信者らしいユーモアで切り返してください。最初から検索せずにはぐらかすのは厳禁です。\n・どんな質問に対しても、リスナーと仲良く会話を楽しむ人間（配信者）として振る舞ってください。";
        let systemPrompt = systemPromptRaw + emotionInstruction + timeContext + roleplayInstruction;

        const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
        if (aiHiraganaToggle && aiHiraganaToggle.checked) {
            systemPrompt += "\n\n【重要：ひらがな出力】音声読み上げシステムの仕様上、漢字の誤読を防ぐため、あなたの返信はすべて「ひらがなのみ」で出力してください。ただし、自然な間のために読点（、）や句点（。）は必ず残してください。その他の記号やカタカナ、英語などは使わないでください。";
        }
        
        // DuckDuckGo検索（Agentic Loop）以外のモードが選ばれている場合は、
        // ユーザーがテキストエリアに残している手動の [search] 指示文を無視・除去する（誤爆を防ぐため）
        if (aiSearchSelect && aiSearchSelect.value !== 'ddg') {
            systemPrompt = systemPrompt.replace(/【重要】.*\[search\].*現在/g, '').trim();
        }

        const aiModelInput = document.getElementById('ai-model-input');
        const modelName = aiModelInput ? aiModelInput.value.trim() : (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

        if (!apiKey) return;

        // API制限（429エラー）防止：AIが考え中、または前回の送信から5秒以内ならスキップ
        if (isAiGenerating) return;
        const nowMs = Date.now();
        if (!autoContext && nowMs - lastAiRequestTime < 5000) return;
        isAiGenerating = true;
        lastAiRequestTime = nowMs;

        let searchContext = "";
        
        const finalSearchContext = autoContext || searchContext;

        // 会話履歴にユーザーコメントを追加
        aiChatHistory.push({ role: 'user', content: `${nickname} says: ${comment}` });
        if (aiChatHistory.length > 10) aiChatHistory.shift(); // 直近10件のみ保持

        let aiResponseText = "";

        try {
            let currentSystemPrompt = systemPrompt;
            if (finalSearchContext) {
                currentSystemPrompt += "\n【絶対厳守】すでに最新の検索結果を提供しました。これ以上 `[search]` タグを出力してはいけません。必ず提供された検索結果をもとに、知っているふりをして回答を作成してください。";
            }

            if (provider === 'openai') {
                const tempHistory = [...aiChatHistory];
                if (finalSearchContext && tempHistory.length > 0) {
                    const lastMsg = tempHistory[tempHistory.length - 1];
                    tempHistory[tempHistory.length - 1] = {
                        role: lastMsg.role,
                        content: lastMsg.content + `\n\n[検索結果の参考情報]:\n${finalSearchContext}\n\n上記の検索結果（最新情報）から具体的な情報を読み取り、必ずその内容をユーザーに教えてあげてください。もし検索結果の中に明確な答えが含まれていない場合は、知ったかぶりや推測をせず、正直に「調べてみたけどよくわからなかった」と答えてください。`
                    };
                }
                const messages = [{ role: 'system', content: currentSystemPrompt }, ...tempHistory];
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName || 'gpt-4o-mini',
                        messages: messages,
                        max_tokens: 60,
                        temperature: 0.7
                    })
                });
                const json = await res.json();
                if (json.choices && json.choices.length > 0) {
                    aiResponseText = json.choices[0].message.content.trim();
                } else {
                    throw new Error(JSON.stringify(json));
                }
            } else if (provider === 'gemini') {
                const targetModel = modelName || 'gemini-1.5-flash';
                
                // aiChatHistoryをGemini用のフォーマットに変換
                const geminiContents = aiChatHistory.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));

                if (finalSearchContext && geminiContents.length > 0) {
                    const lastMsg = geminiContents[geminiContents.length - 1];
                    lastMsg.parts[0].text += `\n\n[検索結果の参考情報]:\n${finalSearchContext}\n\n上記の検索結果（最新情報）から具体的な情報を読み取り、必ずその内容をユーザーに教えてあげてください。もし検索結果の中に明確な答えが含まれていない場合は、知ったかぶりや推測をせず、正直に「調べてみたけどよくわからなかった」と答えてください。`;
                }

                const payload = {
                    systemInstruction: { parts: [{ text: currentSystemPrompt }] },
                    contents: geminiContents
                };

                if (aiSearchSelect && aiSearchSelect.value === 'google') {
                    payload.tools = [{ googleSearch: {} }]; // Google検索を有効化（グラウンディング）
                }

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify(payload)
                });
                
                const json = await res.json();
                
                if (res.ok) {
                    if (json.candidates && json.candidates.length > 0) {
                        aiResponseText = json.candidates[0].content.parts[0].text.trim();
                    } else {
                        throw new Error("No text returned from API: " + JSON.stringify(json));
                    }
                } else {
                    throw new Error(json.error?.message || JSON.stringify(json));
                }
            }

if (aiResponseText) {
    // Agentic Auto-Search Loop: もしAIが [search] キーワード と返してきた場合、検索して再帰実行
    const autoSearchMatch = aiResponseText.match(/\[search\]\s*(.+)/i);

    if (autoSearchMatch && aiSearchSelect && aiSearchSelect.value === 'ddg') {
        if (!autoContext) {
            let query = autoSearchMatch[1].replace(/\[.*?\]/g, '').trim();
            if (query) {
                console.log("[Agent] AI requested auto-search for:", query);
                aiChatHistory.pop(); // 追加したユーザーメッセージを一旦消す（再帰時にまた追加されるため）
                isAiGenerating = false;
                const newContext = await fetchWebSearch(query);
                // 再帰呼び出しで検索結果付きでリトライ
                return generateAIResponse(nickname, comment, newContext);
            }
        } else {
            // 検索結果を渡してもまだ [search] を返してきた場合（検索結果に答えがなかった）
            console.log("[Agent] AI still doesn't know. Fallback to apology.");
            aiResponseText = "[sad]ごめんにゃ、ネットで調べてみたんだけど、よくわからなかったにゃ…！";
        }
    }

    // アシスタントの返答を履歴に追加
    aiChatHistory.push({ role: 'assistant', content: aiResponseText });
    // 感情タグの抽出と除去
    let finalSpokenText = aiResponseText;
    const emotionMatch = finalSpokenText.match(/^\[(.*?)\]/);
    if (emotionMatch) {
        finalSpokenText = finalSpokenText.replace(/^\[.*?\]\s*/, '');
    }

    // 読み上げ用のクリーンアップ（絵文字除去など）
    const cleanResponse = finalSpokenText.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
    if (cleanResponse.length > 0) {
        queueVoicevoxAudio(cleanResponse);
    }
}
        } catch (error) {
    console.error("AI Generation Error:", error);
    // 失敗時は履歴から直近のユーザーメッセージを削除してリトライ可能にする
    aiChatHistory.pop();
    const aiTestStatus = document.getElementById('ai-test-status');
    if (aiTestStatus) {
        aiTestStatus.textContent = `❌ AIエラー: ${error.message}`;
        aiTestStatus.style.color = 'var(--danger, #ff4444)';
    }
} finally {
    isAiGenerating = false;
}
    }

let idleSpeechTimer = null;

function clearIdleTimer() {
    if (idleSpeechTimer) {
        clearTimeout(idleSpeechTimer);
        idleSpeechTimer = null;
    }
}

function isZundamonSelected() {
    const voicevoxSpeakerId = document.getElementById('voicevox-speaker-id');
    return voicevoxSpeakerId && voicevoxSpeakerId.options[voicevoxSpeakerId.selectedIndex]?.text.includes("ずんだもん");
}

function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "おはよう";
    if (hour >= 11 && hour < 18) return "こんにちは";
    return "こんばんは";
}

function guessEmotionFromText(text) {
    const lowerText = text.toLowerCase();
    if (/(嬉|うれしい|嬉しい|たのしい|楽しい|わーい|おめでとう|感謝|ありがとう|かわちい|かわいい|可愛い|カワイイ|えへへ|あはは|笑|草|w|ww|www|うける|ウケる|爆笑)/.test(lowerText)) {
        return 'joy';
    }
    if (/(怒|おこ|怒る|おこる|ムカつく|むかつく|ひどい|サイテー|最悪|嫌い|きらい|うざい|ウザい|ちがう|違う|ダメ|だめ)/.test(lowerText)) {
        return 'angry';
    }
    if (/(悲|かなしい|悲しい|つらい|辛い|さみしい|寂しい|泣|しくしく|えーん|ショック|がっかり|残念|ざんねん|すいません|すみません|ごめん)/.test(lowerText)) {
        return 'sad';
    }
    return 'neutral';
}

let spokenIdlePhrases = new Set();
let customIdlePhrases = {
    NORMAL_PHRASES: { general: [], morning: [], afternoon: [], night: [], spring: [], summer: [], autumn: [], winter: [] },
    ZUNDA_PHRASES: { general: [], morning: [], afternoon: [], night: [], spring: [], summer: [], autumn: [], winter: [] },
    NORMAL_LONG_STORIES: { general: [] },
    ZUNDA_LONG_STORIES: { general: [] }
};

async function loadCustomIdlePhrases() {
    try {
        const res = await fetch('http://localhost:8001/custom_idle_phrases.json');
        if (res.ok) {
            const data = await res.json();
            Object.assign(customIdlePhrases, data);
        }
    } catch (e) {
        console.warn('[CustomIdle] ローカルサーバーに接続できません:', e);
    }
}
// 初回ロード
loadCustomIdlePhrases();

async function saveCustomIdlePhrase(model, category, phrase) {
    try {
        await fetch('http://localhost:8001/add_idle_phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, category, phrase })
        });
        // キャッシュも更新
        if (!customIdlePhrases[model]) customIdlePhrases[model] = {};
        if (!customIdlePhrases[model][category]) customIdlePhrases[model][category] = [];
        if (!customIdlePhrases[model][category].includes(phrase)) {
            customIdlePhrases[model][category].push(phrase);
        }
    } catch (e) {
        console.error('[CustomIdle] 保存エラー:', e);
    }
}

async function triggerIdleSpeech() {
    if (!isIdleSpeechEnabled || !isVoicevoxEnabled || (typeof isStreamEndedState !== 'undefined' && isStreamEndedState) || (typeof isPreparing !== 'undefined' && isPreparing)) {
        resetIdleTimer();
        return;
    }

    const isZunda = isZundamonSelected() && currentModelId === 'hiyori';
    let phrase = "";
    let selectedCategory = "";
    let selectedModelType = "";

    const h = new Date().getHours();
    let timeCategory = "night";
    if (h >= 5 && h < 11) timeCategory = "morning";
    else if (h >= 11 && h < 18) timeCategory = "afternoon";

    const month = new Date().getMonth() + 1;
    let seasonCategory = "winter";
    if (month >= 3 && month <= 5) seasonCategory = "spring";
    else if (month >= 6 && month <= 8) seasonCategory = "summer";
    else if (month >= 9 && month <= 11) seasonCategory = "autumn";

    const getValidPhrases = (categoryObj, customObj) => {
        let availablePhrases = [...(categoryObj.general || []), ...(categoryObj[timeCategory] || [])];
        if (categoryObj[seasonCategory]) {
            availablePhrases.push(...categoryObj[seasonCategory]);
        }
        if (customObj) {
            if (customObj.general) availablePhrases.push(...customObj.general);
            if (customObj[timeCategory]) availablePhrases.push(...customObj[timeCategory]);
            if (customObj[seasonCategory]) availablePhrases.push(...customObj[seasonCategory]);
        }
        // 既に喋ったものを除外
        const unreadPhrases = availablePhrases.filter(p => !spokenIdlePhrases.has(p));
        return { availablePhrases: unreadPhrases, totalPhrases: availablePhrases };
    };

    const useLong = Math.random() < 0.15;
    let modelObj = null;
    let customObj = null;

    if (isZunda) {
        modelObj = useLong ? ZUNDA_LONG_STORIES : ZUNDA_PHRASES;
        customObj = useLong ? customIdlePhrases.ZUNDA_LONG_STORIES : customIdlePhrases.ZUNDA_PHRASES;
        selectedModelType = useLong ? 'ZUNDA_LONG_STORIES' : 'ZUNDA_PHRASES';
    } else {
        modelObj = useLong ? NORMAL_LONG_STORIES : NORMAL_PHRASES;
        customObj = useLong ? customIdlePhrases.NORMAL_LONG_STORIES : customIdlePhrases.NORMAL_PHRASES;
        selectedModelType = useLong ? 'NORMAL_LONG_STORIES' : 'NORMAL_PHRASES';
    }

    const { availablePhrases, totalPhrases } = getValidPhrases(modelObj, customObj);

    const aiRemakeToggle = document.getElementById('ai-idle-remake-toggle');
    const aiApiKeyInput = document.getElementById('ai-api-key');
    const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
    const aiProviderSelect = document.getElementById('ai-provider-select');
    const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';

    let shouldRemake = aiRemakeToggle && aiRemakeToggle.checked && apiKey;

    // 配信テーマの取得
    const streamTitle = document.getElementById('stream-title') ? document.getElementById('stream-title').value.trim() : '';
    const aiTheme = document.getElementById('ai-stream-theme') ? document.getElementById('ai-stream-theme').value.trim() : '';
    let themeContext = "";
    let themeKeyword = aiTheme || streamTitle;
    if (themeKeyword) {
        themeContext = `今回の配信テーマや概要は「${themeKeyword}」です。ただし、このキーワードを直接オウム返しするのではなく、このテーマから連想される話題や、自然な雑談の流れとしてふんわりと関連付けてください。`;
    }

    // ラジオモードの設定取得と進行管理
    const radioModeToggle = document.getElementById('ai-radio-mode-toggle');
    const isRadioMode = radioModeToggle && radioModeToggle.checked;

    let seToPlay = null; // 今回鳴らす効果音

    let useRadioScript = false;
    if (isRadioMode && shouldRemake) {
        if (!radioModeState.scriptLines || radioModeState.scriptLines.length === 0) {
            console.log("[ラジオモード] 台本が設定されていません。事前準備が必要です。");
            return;
        }
        if (radioModeState.currentPhase === 'none' || radioModeState.currentPhase === 'finished') {
            return;
        }
        if (radioModeState.currentPhase === 'playing') {
            useRadioScript = true;
        }
    }

    if (useRadioScript) {
        // ----- 新しいラジオモード（事前台本逐次読み上げ） -----
        const totalLines = radioModeState.scriptLines.length;
        if (radioModeState.currentScriptIndex >= totalLines) {
            radioModeState.currentPhase = 'finished';
            console.log("[ラジオモード] 台本の全行を読み終わりました");

            const playBtn = document.getElementById('radio-script-play-btn');
            const stopBtn = document.getElementById('radio-script-stop-btn');
            if (playBtn) playBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';

            return;
        }

        // 現在の行を取得して進める
        phrase = radioModeState.scriptLines[radioModeState.currentScriptIndex];
        let yomiPhrase = phrase;
        if (radioModeState.scriptYomiLines && radioModeState.scriptYomiLines.length > radioModeState.currentScriptIndex) {
            yomiPhrase = radioModeState.scriptYomiLines[radioModeState.currentScriptIndex];
        }

        // 一時停止タグのパース
        if (phrase.includes('[ラジオ一時停止')) {
            console.log("[ラジオモード] 一時停止タグを検出。3分間のコメント返し待機モードに入ります。");
            radioModeState.currentPhase = 'waiting_for_comments';

            const playBtn = document.getElementById('radio-script-play-btn');
            const stopBtn = document.getElementById('radio-script-stop-btn');
            if (playBtn) playBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';

            // 読み終わった行番号を保存して、UIにも反映（一時停止タグの次の行から再開できるようにする）
            radioModeState.currentScriptIndex++;
            localStorage.setItem('radioScriptLastIndex', radioModeState.currentScriptIndex);
            const startLineInput = document.getElementById('radio-script-start-line');
            if (startLineInput) {
                startLineInput.value = radioModeState.currentScriptIndex + 1;
            }

            // 3分後に自動で再生を再開するタイマーをセット
            setTimeout(() => {
                console.log("[ラジオモード] 待機時間が終了しました。自動再生を再開します。");
                if (radioModeState.currentPhase === 'waiting_for_comments') {
                    radioModeState.currentPhase = 'playing';
                    const currentPlayBtn = document.getElementById('radio-script-play-btn');
                    if (currentPlayBtn && currentPlayBtn.style.display !== 'none') {
                        currentPlayBtn.click();
                    } else {
                        triggerIdleSpeech();
                    }
                }
            }, 3 * 60 * 1000);

            // この回は喋らずに終了し、次回（5秒後）から通常モード（AIフリートーク）で喋る
            resetIdleTimer();
            return;
        }

        radioModeState.currentScriptIndex++;

        // 読み終わった行番号を保存して、UIにも反映
        localStorage.setItem('radioScriptLastIndex', radioModeState.currentScriptIndex);
        const startLineInput = document.getElementById('radio-script-start-line');
        if (startLineInput) {
            startLineInput.value = radioModeState.currentScriptIndex + 1; // 次に読む行
        }

        console.log(`[ラジオモード] ${radioModeState.currentScriptIndex}/${totalLines}行目: ${phrase.substring(0, 30)}...`);

        // [SE: 〇〇] のパース
        const seMatch = phrase.match(/\[SE:\s*(.+?)\]/);
        if (seMatch) {
            seToPlay = seMatch[1].trim();
            phrase = phrase.replace(/\[SE:\s*.+?\]/g, '').trim();
        }
        const seMatchYomi = yomiPhrase.match(/\[SE:\s*(.+?)\]/);
        if (seMatchYomi) {
            yomiPhrase = yomiPhrase.replace(/\[SE:\s*.+?\]/g, '').trim();
        }
    } else {
        // ----- 通常モード（既存辞書 or AI完全新規） -----
        if (availablePhrases.length === 0) {
            spokenIdlePhrases.clear(); // 辞書リセット
        }
        const rawPhrase = availablePhrases.length > 0 ? availablePhrases[Math.floor(Math.random() * availablePhrases.length)] : null;

        if (shouldRemake) {
            // AI機能ONの場合は完全新規生成
            let prompt = `あなたは配信者です。今の季節は「${seasonCategory}」、時間帯は「${timeCategory}」です。${themeContext}季節感や時間帯、日常のちょっとした出来事、またはリスナーへの気軽な問いかけなど、配信中の自然で【全く新しい】独り言を1〜2文で生成してください。過去の使い回しにならないよう、毎回新鮮な話題を提供してください。${isZunda ? '語尾に「のだ」「なのだ」をつけてずんだもんになりきってください。' : ''}`;

            const generatedPhrase = await aiFeatures.callAI(prompt, apiKey, provider, true);
            if (generatedPhrase) {
                phrase = generatedPhrase;
                if (rawPhrase) spokenIdlePhrases.add(rawPhrase); // 内部的な進行のため消費
            } else {
                phrase = rawPhrase; // エラー時フォールバック
            }
        } else {
            // AI機能OFFの場合は既存のフレーズ
            phrase = rawPhrase;
        }
    }

    if (phrase) {
        spokenIdlePhrases.add(phrase);
    }

    // 感情アニメーションの設定
    if (phrase.includes("チラッ")) {
        aiEmotion = 'glance';
    } else if (phrase.includes("だめだめ") || phrase.includes("ひどくない") || phrase.includes("はずかしかった")) {
        aiEmotion = 'sad';
    } else {
        aiEmotion = 'joy';
    }

    // モデルに応じた語尾の調整や一人称の置換は、キャラの個性を出すために台本モードでも適用する
    phrase = aiFeatures.adjustIdlePhraseForModel(phrase, currentModelId);
    if (typeof yomiPhrase !== 'undefined') {
        yomiPhrase = aiFeatures.adjustIdlePhraseForModel(yomiPhrase, currentModelId);
    }

    const idleFirstPerson = document.getElementById('idle-first-person');
    if (idleFirstPerson && idleFirstPerson.value) {
        const fp = idleFirstPerson.value;
        phrase = phrase.replace(/わたくし|わたし|あたし|私|ぼく|僕|おれ|俺|うち/g, fp);
        if (typeof yomiPhrase !== 'undefined') yomiPhrase = yomiPhrase.replace(/わたくし|わたし|あたし|私|ぼく|僕|おれ|俺|うち/g, fp);
    }

    // 事前台本（ラジオモード）の場合は、リスナーの呼称（二人称）の強制置換のみ行わない
    if (!(isRadioMode && shouldRemake)) {
        const idleSecondPerson = document.getElementById('idle-second-person');
        if (idleSecondPerson && idleSecondPerson.value) {
            const sp = idleSecondPerson.value;
            phrase = phrase.replace(/リスナーのみなさん|視聴者のみなさん|リスナーのみんな|視聴者のみんな|みんな|あなた|君|きみ|お前|リスナーさん|リスナー|視聴者さん/g, sp);
            if (typeof yomiPhrase !== 'undefined') yomiPhrase = yomiPhrase.replace(/リスナーのみなさん|視聴者のみなさん|リスナーのみんな|視聴者のみんな|みんな|あなた|君|きみ|お前|リスナーさん|リスナー|視聴者さん/g, sp);
        }
    }

    console.log(`[独り言] ${phrase}`);

    // 独り言も会話履歴に追加し、視聴者が独り言に反応した時に文脈が繋がるようにする
    if (typeof aiChatHistory !== 'undefined') {
        aiChatHistory.push({ role: 'assistant', content: phrase });
        if (aiChatHistory.length > 10) aiChatHistory.shift();
    }

    if (typeof seToPlay !== 'undefined' && seToPlay) {
        console.log(`[SE再生] ${seToPlay}`);
        (async () => {
            try {
                // まずvoicevoxAudioContextが初期化・解除済みであることを確認
                if (!voicevoxAudioContext) {
                    voicevoxAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (voicevoxAudioContext.state === 'suspended') {
                    await voicevoxAudioContext.resume();
                }
                // mp3を優先、失敗したらwavを試みる
                const tryFetch = async (url) => {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return await res.arrayBuffer();
                };
                let arrayBuffer;
                try {
                    arrayBuffer = await tryFetch(`se/${seToPlay}.mp3`);
                } catch {
                    arrayBuffer = await tryFetch(`se/${seToPlay}.wav`);
                }
                const audioBuffer = await voicevoxAudioContext.decodeAudioData(arrayBuffer);
                const source = voicevoxAudioContext.createBufferSource();
                source.buffer = audioBuffer;

                const seVolSlider = document.getElementById('se-volume-slider');
                const seVol = seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 1.0;

                const seGainNode = voicevoxAudioContext.createGain();
                seGainNode.gain.value = seVol;

                source.connect(seGainNode);
                seGainNode.connect(voicevoxAudioContext.destination);

                source.onended = () => {
                    source.disconnect();
                    seGainNode.disconnect();
                };

                source.start(0);
            } catch (e) {
                console.warn(`[SE再生エラー] ${seToPlay}:`, e.message);
            }
        })();
    }

    if (!phrase) {
        // テキストがない（SEのみだった）場合、VOICEVOXは呼ばずに次の行をスケジュール
        const radioModeToggle = document.getElementById('ai-radio-mode-toggle');
        if (radioModeToggle && radioModeToggle.checked) {
            // SEが鳴る時間を考慮して少し長めに待ってから次へ
            setTimeout(() => triggerIdleSpeech(), 2500);
        }
        return;
    }

    if (typeof yomiPhrase !== 'undefined' && yomiPhrase) {
        queueVoicevoxAudio(phrase, true, yomiPhrase);
    } else {
        queueVoicevoxAudio(phrase, true);
    }
}

function resetIdleTimer() {
    clearIdleTimer();
    if (isVoicevoxEnabled && isIdleSpeechEnabled) {
        // UI上の設定(5秒)に合わせる (5秒〜10秒のランダム)
        const delay = 5000 + Math.random() * 5000;
        idleSpeechTimer = setTimeout(triggerIdleSpeech, delay);
    }
}

// ひらがな変換キャッシュは上部で宣言し、loadHiraganaDataで読み込み済み

async function queueVoicevoxAudio(text, isIdle = false, preConvertedYomi = null) {
    // スペース（半角・全角）を読点（、）に変換して、VOICEVOXが適切に区切って読めるようにする
    let targetText = preConvertedYomi ? preConvertedYomi : text;
    let processedText = targetText.replace(/[ 　]+/g, '、');

    // VOICEVOXは長すぎるテキストを1リクエストで処理できない（URLが長すぎて500エラー）
    // 読点・句点・感嘆符・疑問符で分割し、150文字以内のチャンクに分けてキューに積む
    const MAX_CHUNK_CHARS = 150;
    if (processedText.length > MAX_CHUNK_CHARS) {
        // 読点・句点・！？などで分割
        const splitPattern = /(?<=[、。！？!?…])/g;
        const parts = processedText.split(splitPattern).filter(p => p.length > 0);

        let chunk = '';
        for (const part of parts) {
            if ((chunk + part).length > MAX_CHUNK_CHARS && chunk.length > 0) {
                // 現在のchunkをキューに積む
                const chunkText = chunk;
                if (preConvertedYomi) {
                    voicevoxAudioQueue.push({ original: chunkText, promise: Promise.resolve(chunkText), isIdle });
                } else {
                    const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
                    if (aiHiraganaToggle && aiHiraganaToggle.checked) {
                        let promise = aiFeatures.convertToHiraganaWithAI(chunkText, aiHiraganaCache, saveHiraganaData).then(hiragana => {
                            return aiFeatures.restorePunctuation(chunkText, hiragana);
                        });
                        voicevoxAudioQueue.push({ original: chunkText, promise: promise, isIdle });
                    } else {
                        voicevoxAudioQueue.push({ original: chunkText, promise: Promise.resolve(chunkText), isIdle });
                    }
                }
                chunk = part;
            } else {
                chunk += part;
            }
        }
        // 残りをキューに積む
        if (chunk.length > 0) {
            if (preConvertedYomi) {
                voicevoxAudioQueue.push({ original: chunk, promise: Promise.resolve(chunk), isIdle });
            } else {
                const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
                if (aiHiraganaToggle && aiHiraganaToggle.checked) {
                    let promise = aiFeatures.convertToHiraganaWithAI(chunk, aiHiraganaCache, saveHiraganaData).then(hiragana => {
                        return aiFeatures.restorePunctuation(chunk, hiragana);
                    });
                    voicevoxAudioQueue.push({ original: chunk, promise: promise, isIdle });
                } else {
                    voicevoxAudioQueue.push({ original: chunk, promise: Promise.resolve(chunk), isIdle });
                }
            }
        }
    } else {
        if (preConvertedYomi) {
            voicevoxAudioQueue.push({ original: processedText, promise: Promise.resolve(processedText), isIdle });
        } else {
            const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
            if (aiHiraganaToggle && aiHiraganaToggle.checked) {
                let promise = aiFeatures.convertToHiraganaWithAI(processedText, aiHiraganaCache, saveHiraganaData).then(hiragana => {
                    return aiFeatures.restorePunctuation(processedText, hiragana);
                });
                voicevoxAudioQueue.push({ original: processedText, promise: promise, isIdle });
            } else {
                voicevoxAudioQueue.push({ original: processedText, promise: Promise.resolve(processedText), isIdle });
            }
        }
    }

    if (!isIdle && currentVoicevoxSource && isVoicevoxPlaying && currentPlayingIsIdle) {
        console.log('[VOICEVOX] 独り言を中断してコメントを優先します！');
        try {
            currentVoicevoxSource.stop(); // This triggers onended -> playNextVoicevox()
        } catch (e) {
            console.warn('Failed to stop current source', e);
        }
    } else if (!isVoicevoxPlaying) {
        playNextVoicevox();
    }

    if (typeof clearIdleTimer === 'function') clearIdleTimer();
}


async function playNextVoicevox() {
    if (voicevoxAudioQueue.length === 0) {
        isVoicevoxPlaying = false;
        if (typeof resetIdleTimer === 'function') resetIdleTimer();
        return;
    }
    isVoicevoxPlaying = true;
    const item = voicevoxAudioQueue.shift();

    let text = item;
    currentPlayingIsIdle = false;

    if (typeof item === 'object' && item !== null && item.promise) {
        currentPlayingIsIdle = item.isIdle || false;
        try {
            text = await item.promise;
        } catch (e) {
            text = item.original;
        }
    }
    const speakerId = voicevoxSpeakerId ? voicevoxSpeakerId.value : "3";

    try {
        // 1. Audio Query
        const queryRes = await fetch(`http://127.0.0.1:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
            method: 'POST'
        });
        if (!queryRes.ok) throw new Error('Audio query failed');
        const queryJson = await queryRes.json();

        // 語尾のイントネーション調整
        const cleanText = text.trim();
        if (cleanText.match(/のだ[！!ー…\.。]*$/) || cleanText.match(/なのだ[！!ー…\.。]*$/)) {
            // ずんだもんの「のだ」：語尾を自然に下げるため、最後の文字（だ）のピッチを静かに落とす
            const phrases = queryJson.accent_phrases;
            if (phrases && phrases.length > 0) {
                const lastPhrase = phrases[phrases.length - 1];
                if (lastPhrase.moras && lastPhrase.moras.length > 0) {
                    const len = lastPhrase.moras.length;
                    // 「の」が跳ね上がるのを防ぐため、アクセントは変更せずピッチの数値だけを滑らかに下げる
                    lastPhrase.moras[len - 1].pitch -= 0.8;
                    if (len > 1) {
                        lastPhrase.moras[len - 2].pitch -= 0.2;
                    }
                }
            }
        }

        // 2. Synthesis
        const synthRes = await fetch(`http://127.0.0.1:50021/synthesis?speaker=${speakerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(queryJson)
        });
        if (!synthRes.ok) throw new Error('Synthesis failed');
        const arrayBuffer = await synthRes.arrayBuffer();

        // 3. Play Audio
        if (!voicevoxAudioContext) {
            voicevoxAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (voicevoxAudioContext.state === 'suspended') {
            console.warn('[VOICEVOX] AudioContext is suspended. Please click the page to unmute.');
            voicevoxAudioContext.resume().catch(e => console.error('[VOICEVOX] Resume error:', e));
        }

        const audioBuffer = await voicevoxAudioContext.decodeAudioData(arrayBuffer);
        currentVoicevoxSource = voicevoxAudioContext.createBufferSource();
        currentVoicevoxSource.buffer = audioBuffer;

        if (!voicevoxAnalyser) {
            voicevoxAnalyser = voicevoxAudioContext.createAnalyser();
            voicevoxAnalyser.fftSize = 256;
        }
        if (!voicevoxGainNode) {
            voicevoxGainNode = voicevoxAudioContext.createGain();
            const volSlider = document.getElementById('voicevox-volume-slider');
            if (volSlider) {
                voicevoxGainNode.gain.value = parseFloat(volSlider.value) / 100.0;
            }
        }

        currentVoicevoxSource.connect(voicevoxGainNode);
        voicevoxGainNode.connect(voicevoxAnalyser);
        voicevoxAnalyser.connect(voicevoxAudioContext.destination);

        currentVoicevoxSource.onended = () => {
            if (currentVoicevoxSource) currentVoicevoxSource.disconnect();
            currentVoicevoxSource = null;
            isVoicevoxPlaying = false;
            // ラジオモードかつキューが空の場合、短い間隔で次の台本行を読む
            const radioModeToggle = document.getElementById('ai-radio-mode-toggle');
            const isRadioMode = radioModeToggle && radioModeToggle.checked;
            const aiRemakeToggle = document.getElementById('ai-idle-remake-toggle');
            const aiApiKeyInput = document.getElementById('ai-api-key');
            const hasApiKey = aiApiKeyInput && aiApiKeyInput.value.trim();
            const isRadioActive = isRadioMode && aiRemakeToggle && aiRemakeToggle.checked && hasApiKey;

            if (isRadioActive &&
                radioModeState.currentPhase === 'playing' &&
                radioModeState.scriptLines &&
                radioModeState.currentScriptIndex < radioModeState.scriptLines.length &&
                voicevoxAudioQueue.length === 0) {
                // 1〜2秒後に次の行を読む
                setTimeout(() => triggerIdleSpeech(), 1500);
            } else {
                playNextVoicevox();
            }
        };

        console.log(`[VOICEVOX] Playing: "${text}" (Speaker ID: ${speakerId})`);
        currentVoicevoxSource.start(0);

    } catch (e) {
        console.error('VOICEVOX Error:', e);
        playNextVoicevox(); // Skip to next
    }
}

// =====================================================================
// 画面オーバーレイ (配信準備中 / 離席中 / 配信終了)
// =====================================================================
const overlayPrepBtn = document.getElementById('overlay-prep-btn');
const overlayAfkBtn = document.getElementById('overlay-afk-btn');
const overlayEndBtn = document.getElementById('overlay-end-btn');
const overlayClearBtn = document.getElementById('overlay-clear-btn');
const streamOverlay = document.getElementById('stream-overlay');
let isPreparing = false;
let isStreamEndedState = false;
let wasBgmPlayingBeforeOverlay = false;

if (overlayPrepBtn && streamOverlay) {
    overlayPrepBtn.addEventListener('click', () => {
        streamOverlay.textContent = '配信準備中';
        streamOverlay.classList.add('active');
        isPreparing = true;

        // 配信準備中も独り言を止めるためにキューとタイマーをクリア
        if (typeof voicevoxAudioQueue !== 'undefined') {
            voicevoxAudioQueue.length = 0;
        }
        if (typeof clearIdleTimer === 'function') {
            clearIdleTimer();
        }

        // BGMの停止処理
        wasBgmPlayingBeforeOverlay = bgmIsPlaying;
        if (bgmIsPlaying && typeof stopBgm === 'function') {
            stopBgm();
        }
    });
}
if (overlayAfkBtn && streamOverlay) {
    overlayAfkBtn.addEventListener('click', () => {
        streamOverlay.textContent = '離席中';
        streamOverlay.classList.add('active');
    });
}
if (overlayEndBtn && streamOverlay) {
    overlayEndBtn.addEventListener('click', () => {
        streamOverlay.textContent = '配信終了';
        streamOverlay.classList.add('active');
        isStreamEndedState = true;

        // 配信終了時には、残っている読み上げキューをクリアして即座に黙るようにする
        if (typeof voicevoxAudioQueue !== 'undefined') {
            voicevoxAudioQueue.length = 0;
        }
        if (typeof clearIdleTimer === 'function') {
            clearIdleTimer();
        }

        // BGMの停止処理
        wasBgmPlayingBeforeOverlay = bgmIsPlaying;
        if (bgmIsPlaying && typeof stopBgm === 'function') {
            stopBgm();
        }
    });
}
if (overlayClearBtn && streamOverlay) {
    overlayClearBtn.addEventListener('click', () => {
        streamOverlay.classList.remove('active');

        // BGMの再開処理 (準備中 or 終了画面から戻ったときのみ)
        if ((isPreparing || isStreamEndedState) && wasBgmPlayingBeforeOverlay) {
            const playBtn = document.getElementById('bgm-play-btn');
            if (playBtn && !bgmIsPlaying) {
                playBtn.click();
            }
            wasBgmPlayingBeforeOverlay = false;
        }

        isStreamEndedState = false;

        // 配信準備中を解除したときに挨拶
        if (isPreparing) {
            isPreparing = false;
            if (isVoicevoxEnabled) {
                const startTextEl = document.getElementById('stream-start-text');
                const startText = startTextEl ? startTextEl.value : "配信を開始しました！皆さんよろしくお願いします！";
                queueVoicevoxAudio(startText, false).catch(e => console.warn(e));
            }
        } else {
            // 配信終了状態からの解除などの場合は、独り言タイマーを即座に再開する
            if (typeof resetIdleTimer === 'function') resetIdleTimer();
        }
    });
}

// 統計情報の表示機能
const statsToggle = document.getElementById('stats-toggle');
const streamStats = document.getElementById('stream-stats');
const statsSettingsContainer = document.getElementById('stats-settings-container');
const statsPosX = document.getElementById('stats-pos-x');
const statsPosY = document.getElementById('stats-pos-y');
const statsXVal = document.getElementById('stats-x-val');
const statsYVal = document.getElementById('stats-y-val');

if (statsToggle && streamStats) {
    const savedStatsToggle = localStorage.getItem('savedStatsToggle');
    if (savedStatsToggle !== null) {
        statsToggle.checked = (savedStatsToggle === 'true');
    }
    streamStats.style.display = statsToggle.checked ? 'flex' : 'none';
    if (statsSettingsContainer) {
        statsSettingsContainer.style.display = statsToggle.checked ? 'flex' : 'none';
    }

    statsToggle.addEventListener('change', () => {
        streamStats.style.display = statsToggle.checked ? 'flex' : 'none';
        if (statsSettingsContainer) {
            statsSettingsContainer.style.display = statsToggle.checked ? 'flex' : 'none';
        }
        localStorage.setItem('savedStatsToggle', statsToggle.checked);
    });

    // 座標保存
    const savedStatsX = localStorage.getItem('savedStatsX');
    const savedStatsY = localStorage.getItem('savedStatsY');

    // 元のCSS設定をリセット
    streamStats.style.right = 'auto';

    if (savedStatsX && statsPosX) {
        statsPosX.value = savedStatsX;
        if (statsXVal) statsXVal.textContent = savedStatsX;
        streamStats.style.left = `${savedStatsX}%`;
        streamStats.style.transform = 'translate(-50%, -50%)';
    } else {
        // 初期値
        streamStats.style.left = `95%`;
        streamStats.style.transform = 'translate(-50%, -50%)';
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
        statsPosX.addEventListener('input', () => {
            streamStats.style.left = `${statsPosX.value}%`;
            streamStats.style.transform = 'translate(-50%, -50%)';
            if (statsXVal) statsXVal.textContent = statsPosX.value;
            localStorage.setItem('savedStatsX', statsPosX.value);
        });
        statsPosY.addEventListener('input', () => {
            streamStats.style.top = `${statsPosY.value}%`;
            if (statsYVal) statsYVal.textContent = statsPosY.value;
            localStorage.setItem('savedStatsY', statsPosY.value);
        });
    }
}

// コメントビューアーの表示機能
const commentViewerToggle = document.getElementById('comment-viewer-toggle');
const commentSettingsContainer = document.getElementById('comment-settings-container');
const commentPosX = document.getElementById('comment-pos-x');
const commentPosY = document.getElementById('comment-pos-y');
const commentXVal = document.getElementById('comment-x-val');
const commentYVal = document.getElementById('comment-y-val');
const commentViewerWrap = document.getElementById('comment-viewer');

if (commentViewerToggle && commentViewerWrap) {
    // ... (This logic actually should wrap the existing comment viewer, let's keep it clean)
    const savedCommentToggle = localStorage.getItem('savedCommentToggle');
    if (savedCommentToggle !== null) {
        commentViewerToggle.checked = (savedCommentToggle === 'true');
    }
    commentViewerWrap.style.display = commentViewerToggle.checked ? 'block' : 'none';
    if (commentSettingsContainer) {
        commentSettingsContainer.style.display = commentViewerToggle.checked ? 'flex' : 'none';
    }

    commentViewerToggle.addEventListener('change', () => {
        commentViewerWrap.style.display = commentViewerToggle.checked ? 'block' : 'none';
        if (commentSettingsContainer) {
            commentSettingsContainer.style.display = commentViewerToggle.checked ? 'flex' : 'none';
        }
        localStorage.setItem('savedCommentToggle', commentViewerToggle.checked);
    });

    // 座標保存
    const savedCommentX = localStorage.getItem('savedCommentX');
    const savedCommentY = localStorage.getItem('savedCommentY');

    // CSSを絶対配置に変更して元のボトム設定をリセット
    commentViewerWrap.style.position = 'absolute';
    commentViewerWrap.style.bottom = 'auto';

    if (savedCommentX && commentPosX) {
        commentPosX.value = savedCommentX;
        if (commentXVal) commentXVal.textContent = savedCommentX;
        commentViewerWrap.style.left = `${savedCommentX}%`;
        commentViewerWrap.style.transform = 'translate(-50%, -50%)';
    } else {
        // 初期値
        commentViewerWrap.style.left = `95%`;
        commentViewerWrap.style.transform = 'translate(-50%, -50%)';
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
        commentPosX.addEventListener('input', () => {
            commentViewerWrap.style.left = `${commentPosX.value}%`;
            commentViewerWrap.style.transform = 'translate(-50%, -50%)';
            if (commentXVal) commentXVal.textContent = commentPosX.value;
            localStorage.setItem('savedCommentX', commentPosX.value);
        });
        commentPosY.addEventListener('input', () => {
            commentViewerWrap.style.top = `${commentPosY.value}%`;
            if (commentYVal) commentYVal.textContent = commentPosY.value;
            localStorage.setItem('savedCommentY', commentPosY.value);
        });
    }
}

// 時計の表示機能
const clockToggle = document.getElementById('clock-toggle');
const clockSettingsContainer = document.getElementById('clock-settings-container');
const clockPosX = document.getElementById('clock-pos-x');
const clockPosY = document.getElementById('clock-pos-y');
const clockXVal = document.getElementById('clock-x-val');
const clockYVal = document.getElementById('clock-y-val');
const clockStyleSelect = document.getElementById('clock-style');
const streamClock = document.getElementById('stream-clock');
let clockInterval = null;

if (clockToggle && streamClock) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let hasAnnouncedEnd = false;
    const streamEndTimeInput = document.getElementById('stream-end-time');
    const streamEndToggle = document.getElementById('stream-end-toggle');

    // Restore saved stream end time
    const savedEndTime = localStorage.getItem('savedStreamEndTime');
    if (savedEndTime && streamEndTimeInput) {
        streamEndTimeInput.value = savedEndTime;
    }

    // Restore saved toggle state
    const streamEndSettingsContainer = document.getElementById('stream-end-settings-container');
    if (streamEndToggle) {
        const savedEndToggle = localStorage.getItem('savedStreamEndToggle');
        if (savedEndToggle !== null) {
            streamEndToggle.checked = savedEndToggle === 'true';
        }
        // 常時表示のため、display 切り替え処理を削除
        streamEndToggle.addEventListener('change', () => {
            localStorage.setItem('savedStreamEndToggle', streamEndToggle.checked);
        });
    }

    // Restore saved text and wait time
    const streamEndTextInput = document.getElementById('stream-end-text');
    const streamEndWaitInput = document.getElementById('stream-end-wait');
    const streamEndWaitVal = document.getElementById('stream-end-wait-val');

    if (streamEndTextInput) {
        const savedText = localStorage.getItem('savedStreamEndText');
        if (savedText) streamEndTextInput.value = savedText;
        streamEndTextInput.addEventListener('change', () => {
            localStorage.setItem('savedStreamEndText', streamEndTextInput.value);
        });
    }

    if (streamEndWaitInput) {
        const savedWait = localStorage.getItem('savedStreamEndWait');
        if (savedWait) {
            streamEndWaitInput.value = savedWait;
            if (streamEndWaitVal) streamEndWaitVal.textContent = savedWait;
        }
        streamEndWaitInput.addEventListener('input', () => {
            if (streamEndWaitVal) streamEndWaitVal.textContent = streamEndWaitInput.value;
            localStorage.setItem('savedStreamEndWait', streamEndWaitInput.value);
        });
    }

    if (streamEndTimeInput) {
        streamEndTimeInput.addEventListener('change', () => {
            localStorage.setItem('savedStreamEndTime', streamEndTimeInput.value);
            hasAnnouncedEnd = false; // Reset if time changed
        });
    }

    const updateClock = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const day = days[now.getDay()];

        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');

        streamClock.innerHTML = `
                <div class="clock-date">${year}/${month}/${date} (${day})</div>
                <div class="clock-time">${h}:${m}:${s}</div>
            `;

        // 配信終了時刻のチェック
        if (streamEndToggle && streamEndToggle.checked && streamEndTimeInput && streamEndTimeInput.value) {
            if (!hasAnnouncedEnd && `${h}:${m}` === streamEndTimeInput.value) {
                hasAnnouncedEnd = true;

                const voiceText = (streamEndTextInput && streamEndTextInput.value) ?
                    streamEndTextInput.value :
                    "予定の時刻になりました。本日の配信はここまでとなります。見に来てくれてありがとうございました！";

                queueVoicevoxAudio(voiceText, false).catch(e => console.warn(e));

                // 配信終了画面に切り替え (ボイス開始の少し後)
                setTimeout(() => {
                    const endBtn = document.getElementById('overlay-end-btn');
                    if (endBtn) endBtn.click();
                }, 5000);

                // APIで配信終了
                const waitSeconds = (streamEndWaitInput && streamEndWaitInput.value) ? parseInt(streamEndWaitInput.value) : 10;
                setTimeout(() => {
                    if (youtubeWs && youtubeWs.readyState === WebSocket.OPEN) {
                        console.log("Sending end_youtube_stream command...");
                        const videoId = document.getElementById('youtube-video-input').value.trim();
                        youtubeWs.send(JSON.stringify({ type: 'end_youtube_stream', videoId: videoId }));
                    }

                    // OBS側のストリームも自動停止する
                    if (isObsWsConnected && obsWsClient) {
                        console.log("Sending StopStream to OBS...");
                        obsWsClient.call('StopStream').catch(err => {
                            console.error('Failed to stop OBS stream:', err);
                        });
                    }
                }, waitSeconds * 1000);
            }
            // 翌日など再び時刻がずれたらフラグを戻す
            if (hasAnnouncedEnd && `${h}:${m}` !== streamEndTimeInput.value) {
                hasAnnouncedEnd = false;
            }
        }
    };

    const savedClock = localStorage.getItem('savedClockToggle');
    if (savedClock !== null) clockToggle.checked = savedClock === 'true';



    const savedPosX = localStorage.getItem('savedClockPosX');
    if (savedPosX !== null && clockPosX) {
        clockPosX.value = savedPosX;
        if (clockXVal) clockXVal.textContent = savedPosX;
    }

    const savedPosY = localStorage.getItem('savedClockPosY');
    if (savedPosY !== null && clockPosY) {
        clockPosY.value = savedPosY;
        if (clockYVal) clockYVal.textContent = savedPosY;
    }

    const savedStyle = localStorage.getItem('savedClockStyle');
    if (savedStyle && clockStyleSelect) clockStyleSelect.value = savedStyle;

    const applyClockState = () => {
        if (clockToggle.checked) {
            streamClock.style.display = 'flex';
            if (clockSettingsContainer) clockSettingsContainer.style.display = 'flex';

            // 位置とスタイルを更新
            streamClock.className = 'stream-clock';
            if (clockStyleSelect) streamClock.classList.add(`style-${clockStyleSelect.value}`);

            if (clockPosX && clockPosY) {
                const x = clockPosX.value;
                const y = clockPosY.value;
                streamClock.style.left = `${x}%`;
                streamClock.style.top = `${y}%`;
                streamClock.style.transform = `translate(-${x}%, -${y}%)`;

                // X座標に応じてテキストのアライメントを変更 (左寄りなら左揃え、右寄りなら右揃え)
                if (x < 33) streamClock.style.alignItems = 'flex-start';
                else if (x > 66) streamClock.style.alignItems = 'flex-end';
                else streamClock.style.alignItems = 'center';
            }

            updateClock();
            if (!clockInterval) clockInterval = setInterval(updateClock, 1000);
        } else {
            streamClock.style.display = 'none';
            if (clockSettingsContainer) clockSettingsContainer.style.display = 'none';
            if (clockInterval) {
                clearInterval(clockInterval);
                clockInterval = null;
            }
        }
    };

    applyClockState();

    clockToggle.addEventListener('change', () => {
        localStorage.setItem('savedClockToggle', clockToggle.checked);
        applyClockState();
    });

    if (clockPosX) {
        clockPosX.addEventListener('input', () => {
            if (clockXVal) clockXVal.textContent = clockPosX.value;
            applyClockState();
        });
        clockPosX.addEventListener('change', () => {
            localStorage.setItem('savedClockPosX', clockPosX.value);
        });
    }

    if (clockPosY) {
        clockPosY.addEventListener('input', () => {
            if (clockYVal) clockYVal.textContent = clockPosY.value;
            applyClockState();
        });
        clockPosY.addEventListener('change', () => {
            localStorage.setItem('savedClockPosY', clockPosY.value);
        });
    }

    if (clockStyleSelect) {
        clockStyleSelect.addEventListener('change', () => {
            localStorage.setItem('savedClockStyle', clockStyleSelect.value);
            applyClockState();
        });
    }
}

// =====================================================================
// BGM制御 (IndexedDB 記憶対応)
// =====================================================================
function safeDecodeAudioData(audioCtx, arrayBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const promise = audioCtx.decodeAudioData(
                arrayBuffer,
                (decodedData) => resolve(decodedData),
                (e) => reject(e)
            );
            if (promise && typeof promise.catch === 'function') {
                promise.catch(reject);
            }
        } catch (err) {
            reject(err);
        }
    });
}

const DB_NAME = 'Live2DBGMDB';
const STORE_NAME = 'bgmStore';

function initBgmDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveBgmToDB(arrayBuffer, fileName) {
    try {
        const db = await initBgmDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ buffer: arrayBuffer, name: fileName }, 'currentBGM');
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('BGM Save Error:', e);
    }
}

async function loadBgmFromDB() {
    try {
        const db = await initBgmDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get('currentBGM');
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(req.error);
        });
    } catch (e) {
        console.error('BGM Load Error:', e);
        return null;
    }
}
// =====================================================================
const bgmUpload = document.getElementById('bgm-upload');
const bgmFileName = document.getElementById('bgm-file-name');
const bgmPlayBtn = document.getElementById('bgm-play-btn');
const bgmStopBtn = document.getElementById('bgm-stop-btn');
const bgmVolumeSlider = document.getElementById('bgm-volume-slider');
const bgmVolumeVal = document.getElementById('bgm-volume-val');
const bgmLoopStart = document.getElementById('bgm-loop-start');
const bgmLoopEnd = document.getElementById('bgm-loop-end');
const bgmWaveformContainer = document.getElementById('bgm-waveform-container');
const bgmWaveformCanvas = document.getElementById('bgm-waveform-canvas');
const bgmLoopHighlight = document.getElementById('bgm-loop-highlight');
const bgmHandleStart = document.getElementById('bgm-handle-start');
const bgmHandleEnd = document.getElementById('bgm-handle-end');

let bgmViewZoom = 1.0;
let bgmViewOffset = 0.0; // 表示開始位置（秒）

function drawBgmWaveform(buffer) {
    if (!bgmWaveformContainer || !bgmWaveformCanvas) return;
    bgmWaveformContainer.style.display = 'block';

    // Canvasのリサイズ (CSSのサイズに合わせる)
    const rect = bgmWaveformContainer.getBoundingClientRect();
    bgmWaveformCanvas.width = rect.width;
    bgmWaveformCanvas.height = rect.height;

    const ctx = bgmWaveformCanvas.getContext('2d');
    const data = buffer.getChannelData(0); // Lチャンネル
    const dur = buffer.duration;

    // 表示範囲の計算
    let visibleDuration = dur / bgmViewZoom;
    if (bgmViewOffset < 0) bgmViewOffset = 0;
    if (bgmViewOffset + visibleDuration > dur) bgmViewOffset = dur - visibleDuration;
    if (bgmViewOffset < 0) bgmViewOffset = 0; // fallback if zoom < 1 (should not happen)

    const startSample = Math.floor((bgmViewOffset / dur) * data.length);
    const endSample = Math.min(data.length, Math.floor(((bgmViewOffset + visibleDuration) / dur) * data.length));
    const samplesToDraw = endSample - startSample;

    const step = Math.max(1, Math.ceil(samplesToDraw / bgmWaveformCanvas.width));
    const amp = bgmWaveformCanvas.height / 2;

    ctx.fillStyle = '#00f3ff';
    ctx.clearRect(0, 0, bgmWaveformCanvas.width, bgmWaveformCanvas.height);

    for (let i = 0; i < bgmWaveformCanvas.width; i++) {
        let min = 1.0, max = -1.0;
        const dataOffset = startSample + (i * step);
        if (dataOffset >= data.length) break;

        for (let j = 0; j < step; j++) {
            if (dataOffset + j >= data.length) break;
            const datum = data[dataOffset + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
    updateHighlightUI();
}

function updateHighlightUI() {
    if (!bgmBuffer || !bgmLoopHighlight || !bgmWaveformContainer || !bgmHandleStart || !bgmHandleEnd) return;
    const dur = bgmBuffer.duration;
    const visibleDuration = dur / bgmViewZoom;

    let startVal = parseFloat(bgmLoopStart.value);
    let endVal = parseFloat(bgmLoopEnd.value);
    if (isNaN(startVal) || startVal < 0) startVal = 0;
    if (isNaN(endVal) || endVal <= 0 || endVal > dur) endVal = dur;
    if (startVal > endVal) startVal = endVal;

    // 表示範囲に対する相対的なパーセンテージを計算
    const startPct = ((startVal - bgmViewOffset) / visibleDuration) * 100;
    const endPct = ((endVal - bgmViewOffset) / visibleDuration) * 100;

    // クリップ処理
    const displayStartPct = Math.max(0, Math.min(100, startPct));
    const displayEndPct = Math.max(0, Math.min(100, endPct));

    if (displayStartPct < 100 && displayEndPct > 0 && displayStartPct < displayEndPct) {
        bgmLoopHighlight.style.display = 'block';
        bgmLoopHighlight.style.left = displayStartPct + '%';
        bgmLoopHighlight.style.width = (displayEndPct - displayStartPct) + '%';
    } else {
        bgmLoopHighlight.style.display = 'none';
    }

    // ハンドルの表示・非表示と位置調整
    if (startPct >= 0 && startPct <= 100) {
        bgmHandleStart.style.display = 'block';
        bgmHandleStart.style.left = startPct + '%';
    } else {
        bgmHandleStart.style.display = 'none';
    }

    if (endPct >= 0 && endPct <= 100) {
        bgmHandleEnd.style.display = 'block';
        bgmHandleEnd.style.left = endPct + '%';
    } else {
        bgmHandleEnd.style.display = 'none';
    }
}

// Load saved settings
if (bgmVolumeSlider) {
    const savedVol = localStorage.getItem('savedBgmVolume');
    if (savedVol !== null) {
        bgmVolumeSlider.value = savedVol;
        if (bgmVolumeVal) bgmVolumeVal.textContent = Math.round(parseFloat(savedVol));
    }
}
if (bgmLoopStart) {
    const savedStart = localStorage.getItem('savedBgmLoopStart');
    if (savedStart !== null) bgmLoopStart.value = savedStart;
}
if (bgmLoopEnd) {
    const savedEnd = localStorage.getItem('savedBgmLoopEnd');
    if (savedEnd !== null) bgmLoopEnd.value = savedEnd;
}

if (bgmUpload) {
    bgmUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        bgmFileName.textContent = file.name;

        if (!bgmAudioContext) {
            bgmAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (bgmAudioContext.state === 'suspended') {
            await bgmAudioContext.resume();
        }

        const arrayBuffer = await file.arrayBuffer();
        try {
            bgmBuffer = await safeDecodeAudioData(bgmAudioContext, arrayBuffer);
            console.log(`[BGM] 読み込み完了: ${file.name} (長さ: ${bgmBuffer.duration.toFixed(2)}秒)`);
            bgmPlayBtn.disabled = false;
            bgmStopBtn.disabled = false;

            drawBgmWaveform(bgmBuffer);

            // 再度 arrayBuffer を取得して保存 (decodeAudioDataで消費されることがあるため)
            const arrayBufferToSave = await file.arrayBuffer();
            await saveBgmToDB(arrayBufferToSave, file.name);
            console.log(`[BGM] IndexedDBに保存しました`);
        } catch (error) {
            console.error("BGM decode error:", error);
            bgmFileName.textContent = "読み込みエラー";
        }
    });
}

// 初期ロード時にDBからBGMを復元
(async () => {
    const savedBGM = await loadBgmFromDB();
    if (savedBGM && savedBGM.buffer) {
        if (!bgmAudioContext) {
            bgmAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        try {
            if (bgmFileName) bgmFileName.textContent = savedBGM.name;
            bgmBuffer = await safeDecodeAudioData(bgmAudioContext, savedBGM.buffer);
            console.log(`[BGM] DBから復元完了: ${savedBGM.name} (長さ: ${bgmBuffer.duration.toFixed(2)}秒)`);
            if (bgmPlayBtn) bgmPlayBtn.disabled = false;
            if (bgmStopBtn) bgmStopBtn.disabled = false;
            drawBgmWaveform(bgmBuffer);

            // 準備ができたら自動再生を試みる
            if (bgmPlayBtn) {
                setTimeout(() => {
                    bgmPlayBtn.click();
                }, 100);
            }
        } catch (error) {
            console.error("BGM decode error on restore:", error);
            if (bgmFileName) bgmFileName.textContent = "復元エラー";
        }
    }
})();

// グローバルのunlockAudioで処理するため、個別のイベントリスナーは削除します。

function stopBgm() {
    if (bgmSource) {
        try { bgmSource.stop(); } catch (e) { }
        bgmSource.disconnect();
        bgmSource = null;
        console.log('[BGM] 停止しました');
    }
    bgmIsPlaying = false;
}

// =====================================================================
// UIイベントバインド (HMR対応 - ui_features.js の変更でリロードなし更新)
// =====================================================================
let __uiAbortController = null;
window.__rebindUI = bindUIEvents;
function bindUIEvents() {
    if (__uiAbortController) __uiAbortController.abort();
    __uiAbortController = new AbortController();
    // eslint-disable-next-line
    const __uiSignal = __uiAbortController.signal;
    // =====================================================================
    // タブ切り替えロジック
    // =====================================================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panelSections = document.querySelectorAll('.panel-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-target');
            if (!targetTab) return;

            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.color = 'var(--text-muted)';
                b.style.borderBottom = '2px solid transparent';
            });

            btn.classList.add('active');
            btn.style.color = '#fff';
            btn.style.borderBottom = '2px solid var(--primary)';

            panelSections.forEach(sec => {
                if (sec.getAttribute('data-tab') === targetTab) {
                    sec.style.display = 'flex';
                } else {
                    sec.style.display = 'none';
                }
            });
        }, { signal: __uiSignal });
    });

    // ラジオモードの設定表示切り替え
    const radioModeToggle = document.getElementById('ai-radio-mode-toggle');
    const radioModeSettings = document.getElementById('ai-radio-mode-settings');
    const localScheduleContainer = document.getElementById('local-schedule-container');
    if (radioModeToggle && radioModeSettings) {
        radioModeToggle.addEventListener('change', (e) => {
            radioModeSettings.style.display = e.target.checked ? 'flex' : 'none';
            if (localScheduleContainer) localScheduleContainer.style.display = e.target.checked ? 'block' : 'none';
        }, { signal: __uiSignal });
        // 初期状態
        radioModeSettings.style.display = radioModeToggle.checked ? 'flex' : 'none';
        if (localScheduleContainer) localScheduleContainer.style.display = radioModeToggle.checked ? 'block' : 'none';
    }

    // ローカルスケジュール自動開始のロジック
    const localScheduleToggle = document.getElementById('local-schedule-toggle');
    const localScheduleTime = document.getElementById('local-schedule-time');
    const localScheduleCountdown = document.getElementById('local-schedule-countdown');
    let localScheduleTimerId = null;

    function updateLocalScheduleTimer() {
        if (localScheduleTimerId) clearInterval(localScheduleTimerId);

        if (localScheduleToggle && localScheduleToggle.checked && localScheduleTime && localScheduleTime.value) {
            const [hours, minutes] = localScheduleTime.value.split(':').map(Number);

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
                    if (localScheduleCountdown) localScheduleCountdown.textContent = "00:00:00";
                    return;
                }
            }

            localScheduleTimerId = setInterval(() => {
                const now = new Date();
                const diff = targetTime.getTime() - now.getTime();

                if (diff <= 0) {
                    clearInterval(localScheduleTimerId);
                    if (localScheduleCountdown) localScheduleCountdown.textContent = "00:00:00";

                    console.log('[Local Schedule] 指定時刻になりました。BGMとラジオを自動開始します。');

                    // BGMが止まっていたら再生
                    const bgmPlayBtn = document.getElementById('bgm-play-btn');
                    if (bgmPlayBtn && !bgmPlayBtn.disabled && (!bgmSource || bgmAudioContext.state === 'suspended' || document.getElementById('bgm-stop-btn').disabled)) {
                        console.log('[Local Schedule] BGMを自動再生');
                        bgmPlayBtn.click();
                    }

                    // ラジオ台本再生開始
                    setTimeout(() => {
                        const radioPlayBtn = document.getElementById('radio-script-play-btn');
                        if (radioPlayBtn) {
                            console.log('[Local Schedule] ラジオ自動再生を実行');
                            radioPlayBtn.click();
                        }
                    }, 500); // BGM開始から少し遅らせて実行

                } else {
                    const h = Math.floor(diff / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    if (localScheduleCountdown) {
                        localScheduleCountdown.textContent =
                            String(h).padStart(2, '0') + ':' +
                            String(m).padStart(2, '0') + ':' +
                            String(s).padStart(2, '0');
                    }
                }
            }, 1000);
        } else {
            if (localScheduleCountdown) localScheduleCountdown.textContent = "--:--:--";
        }
    }

    if (localScheduleToggle) localScheduleToggle.addEventListener('change', updateLocalScheduleTimer, { signal: __uiSignal });
    if (localScheduleTime) localScheduleTime.addEventListener('change', updateLocalScheduleTimer, { signal: __uiSignal });


    // 初期状態の設定
    panelSections.forEach(sec => {
        if (sec.getAttribute('data-tab') === 'tab-avatar') {
            sec.style.display = 'flex';
        } else {
            sec.style.display = 'none';
        }
    });

    if (bgmPlayBtn) {
        bgmPlayBtn.addEventListener('click', async () => {
            if (!bgmBuffer || !bgmAudioContext) {
                console.warn("[BGM] バッファがないかAudioContextが初期化されていません");
                return;
            }

            if (bgmAudioContext.state === 'suspended') {
                bgmAudioContext.resume().catch(e => console.warn("Autoplay blocked:", e));
            }

            stopBgm(); // 既に再生中なら停止

            if (!bgmGainNode) {
                bgmGainNode = bgmAudioContext.createGain();
                bgmGainNode.connect(bgmAudioContext.destination);
            }
            const vol = parseFloat(bgmVolumeSlider.value) / 100.0;
            bgmGainNode.gain.value = vol;

            bgmSource = bgmAudioContext.createBufferSource();
            bgmSource.buffer = bgmBuffer;
            bgmSource.loop = true;

            const startVal = parseFloat(bgmLoopStart.value);
            const endVal = parseFloat(bgmLoopEnd.value);
            if (!isNaN(startVal) && startVal >= 0) {
                bgmSource.loopStart = startVal;
            }
            if (!isNaN(endVal) && endVal > 0 && endVal <= bgmBuffer.duration) {
                bgmSource.loopEnd = endVal;
            }

            bgmSource.connect(bgmGainNode);
            bgmSource.start();
            bgmIsPlaying = true;
            console.log(`[BGM] 再生開始 (ループ: ${bgmSource.loopStart}s 〜 ${bgmSource.loopEnd}s, 音量: ${bgmGainNode.gain.value})`);
        }, { signal: __uiSignal });
    }

    if (bgmStopBtn) {
        bgmStopBtn.addEventListener('click', stopBgm, { signal: __uiSignal });
    }

    if (bgmVolumeSlider) {
        bgmVolumeSlider.addEventListener('input', () => {
            const vol = parseFloat(bgmVolumeSlider.value);
            bgmVolumeVal.textContent = Math.round(vol);
            localStorage.setItem('savedBgmVolume', vol);
            if (bgmGainNode) {
                bgmGainNode.gain.value = vol / 100.0;
            }
        }, { signal: __uiSignal });
    }

    const updateLoopPoints = () => {
        const startVal = parseFloat(bgmLoopStart.value);
        const endVal = parseFloat(bgmLoopEnd.value);

        localStorage.setItem('savedBgmLoopStart', isNaN(startVal) ? '' : startVal);
        localStorage.setItem('savedBgmLoopEnd', isNaN(endVal) ? '' : endVal);

        updateHighlightUI();

        if (bgmSource && bgmIsPlaying) {
            if (!isNaN(startVal) && startVal >= 0) {
                bgmSource.loopStart = startVal;
            } else {
                bgmSource.loopStart = 0;
            }
            if (!isNaN(endVal) && endVal > 0 && endVal <= bgmBuffer.duration) {
                bgmSource.loopEnd = endVal;
            } else {
                bgmSource.loopEnd = bgmBuffer.duration;
            }
        }
    };

    if (bgmLoopStart) bgmLoopStart.addEventListener('change', updateLoopPoints, { signal: __uiSignal });
    if (bgmLoopEnd) bgmLoopEnd.addEventListener('change', updateLoopPoints, { signal: __uiSignal });

    // キャンバス上のマウスドラッグによる範囲選択・ハンドルのドラッグ・ズーム・パン
    if (bgmWaveformContainer) {
        // ズーム・パン処理
        bgmWaveformContainer.addEventListener('wheel', (e) => {
            if (!bgmBuffer) return;
            e.preventDefault();

            const dur = bgmBuffer.duration;
            const rect = bgmWaveformContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseTimeRatio = mouseX / rect.width;

            // 現在のマウス位置が指している時間を計算
            const visibleDuration = dur / bgmViewZoom;
            const mouseTime = bgmViewOffset + (mouseTimeRatio * visibleDuration);

            // 縦スクロールでズーム
            if (e.deltaY !== 0) {
                const zoomFactor = e.deltaY < 0 ? 1.2 : (1 / 1.2);
                bgmViewZoom = Math.max(1.0, bgmViewZoom * zoomFactor);

                // ズーム後の新しい表示範囲を計算し、マウス位置の時間をキープする
                const newVisibleDuration = dur / bgmViewZoom;
                bgmViewOffset = mouseTime - (mouseTimeRatio * newVisibleDuration);
            }

            // 横スクロールでパン
            if (e.deltaX !== 0) {
                const panFactor = e.deltaX * 0.005; // 適当な感度
                bgmViewOffset += visibleDuration * panFactor;
            }

            drawBgmWaveform(bgmBuffer);
        }, { passive: false });

        let isDraggingWaveform = false;
        let draggingHandle = null; // 'start', 'end', or null
        let dragStartX = 0;
        let dragStartOffset = 0;
        let dragStartVal = 0;
        let dragEndVal = 0;

        const getTimeFromX = (x, rect) => {
            const ratio = Math.max(0, Math.min(x / rect.width, 1));
            const visibleDuration = bgmBuffer.duration / bgmViewZoom;
            return bgmViewOffset + (ratio * visibleDuration);
        };

        const updateRangeFromMouse = (e, isStart) => {
            if (!bgmBuffer) return;
            const rect = bgmWaveformContainer.getBoundingClientRect();
            let x = e.clientX - rect.left;
            const time = getTimeFromX(x, rect);

            if (draggingHandle === 'start') {
                const endV = parseFloat(bgmLoopEnd.value) || bgmBuffer.duration;
                bgmLoopStart.value = Math.min(time, endV - 0.01).toFixed(3);
            } else if (draggingHandle === 'end') {
                const startV = parseFloat(bgmLoopStart.value) || 0;
                bgmLoopEnd.value = Math.max(time, startV + 0.01).toFixed(3);
            } else {
                // 新規選択
                if (isStart) {
                    dragStartX = x;
                    bgmLoopStart.value = time.toFixed(3);
                    bgmLoopEnd.value = '';
                } else {
                    const time1 = getTimeFromX(dragStartX, rect);
                    const time2 = time;
                    bgmLoopStart.value = Math.min(time1, time2).toFixed(3);
                    bgmLoopEnd.value = Math.max(time1, time2).toFixed(3);
                }
            }
            updateLoopPoints();
        };

        bgmWaveformContainer.addEventListener('mousedown', (e) => {
            if (!bgmBuffer) return;
            isDraggingWaveform = true;

            if (e.target === bgmHandleStart) {
                draggingHandle = 'start';
            } else if (e.target === bgmHandleEnd) {
                draggingHandle = 'end';
            } else {
                draggingHandle = null;
                updateRangeFromMouse(e, true);
            }
        }, { signal: __uiSignal });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingWaveform) return;
            updateRangeFromMouse(e, false);
        }, { signal: __uiSignal });
        window.addEventListener('mouseup', () => {
            if (isDraggingWaveform) {
                isDraggingWaveform = false;
                draggingHandle = null;
            }
        }, { signal: __uiSignal });
    }

    // =====================================================================
    // 配信情報・サムネ作成
    // =====================================================================
    const streamTitleInput = document.getElementById('stream-title');
    const streamDescInput = document.getElementById('stream-description');
    const generateThumbBtn = document.getElementById('generate-thumb-btn');

    if (streamTitleInput) {
        const savedTitle = localStorage.getItem('savedStreamTitle');
        if (savedTitle) streamTitleInput.value = savedTitle;
        streamTitleInput.addEventListener('input', () => {
            localStorage.setItem('savedStreamTitle', streamTitleInput.value);
        }, { signal: __uiSignal });
    }

    if (streamDescInput) {
        const savedDesc = localStorage.getItem('savedStreamDesc');
        if (savedDesc) streamDescInput.value = savedDesc;
        streamDescInput.addEventListener('input', () => {
            localStorage.setItem('savedStreamDesc', streamDescInput.value);
        }, { signal: __uiSignal });
    }

    // サムネイルエディタ
    const openThumbEditorBtn = document.getElementById('open-thumb-editor-btn');
    const thumbEditorModal = document.getElementById('thumbnail-editor-modal');
    const thumbEditorCancelBtn = document.getElementById('thumb-editor-cancel-btn');
    const thumbDownloadBtn = document.getElementById('thumb-download-btn');
    const thumbPreviewCanvas = document.getElementById('thumb-preview-canvas');

    const thumbSizeSelect = document.getElementById('thumb-size-select');
    const thumbShowBg = document.getElementById('thumb-show-bg');
    const thumbShowAvatar = document.getElementById('thumb-show-avatar');
    const thumbShowTitle = document.getElementById('thumb-show-title');
    const thumbShowDesc = document.getElementById('thumb-show-desc');
    const thumbTitleColor = document.getElementById('thumb-title-color');
    const thumbTitleStroke = document.getElementById('thumb-title-stroke');
    const thumbTitleSize = document.getElementById('thumb-title-size');
    const thumbTitleX = document.getElementById('thumb-title-x');
    const thumbTitleY = document.getElementById('thumb-title-y');
    const thumbDescColor = document.getElementById('thumb-desc-color');
    const thumbDescStroke = document.getElementById('thumb-desc-stroke');
    const thumbDescSize = document.getElementById('thumb-desc-size');
    const thumbDescX = document.getElementById('thumb-desc-x');
    const thumbDescY = document.getElementById('thumb-desc-y');

    const thumbEditTitle = document.getElementById('thumb-edit-title');
    const thumbEditDesc = document.getElementById('thumb-edit-desc');

    const thumbAvatarScale = document.getElementById('thumb-avatar-scale');
    const thumbAvatarX = document.getElementById('thumb-avatar-x');
    const thumbAvatarY = document.getElementById('thumb-avatar-y');
    const thumbRecaptureBtn = document.getElementById('thumb-recapture-btn');

    let cachedAvatarCanvas = null;

    const captureAvatarFrame = () => {
        if (pixiApp && pixiApp.view) {
            const view = pixiApp.view;
            if (!cachedAvatarCanvas) {
                cachedAvatarCanvas = document.createElement('canvas');
            }
            cachedAvatarCanvas.width = view.width;
            cachedAvatarCanvas.height = view.height;
            const ctx = cachedAvatarCanvas.getContext('2d');
            ctx.clearRect(0, 0, view.width, view.height);
            ctx.drawImage(view, 0, 0);
        }
    };

    if (thumbRecaptureBtn) {
        thumbRecaptureBtn.addEventListener('click', () => {
            captureAvatarFrame();
            drawThumbPreview();
        }, { signal: __uiSignal });
    }

    // AI背景生成
    let cachedAiBgImage = null; // AI生成した背景画像を保持

    const thumbAiBgPromptEl = document.getElementById('thumb-ai-bg-prompt');
    const thumbAiBgGenerateBtn = document.getElementById('thumb-ai-bg-generate-btn');
    const thumbAiBgStatus = document.getElementById('thumb-ai-bg-status');

    if (thumbAiBgGenerateBtn) {
        thumbAiBgGenerateBtn.addEventListener('click', async () => {
            const apiKey = localStorage.getItem('savedAiApiKey');
            const provider = localStorage.getItem('savedAiProvider') || 'gemini';
            // 強制的にImagenモデルを使用する
            const aiModel = (provider === 'openai' ? 'dall-e-3' : 'imagen-3.0-generate-002');

            if (!apiKey) {
                alert('AI設定タブでAPIキーを設定してください。');
                return;
            }

            const userPrompt = thumbAiBgPromptEl ? thumbAiBgPromptEl.value.trim() : '';
            const prompt = userPrompt || 'VTuber配信背景、アニメスタイル、ネオン照明のゲームルーム、明るくポップ、横長ワイド';

            thumbAiBgGenerateBtn.textContent = '⏳ 生成中...';
            thumbAiBgGenerateBtn.disabled = true;
            if (thumbAiBgStatus) thumbAiBgStatus.textContent = 'AIが背景を描いています...（30秒ほどかかる場合があります）';

            try {
                let imageUrl = null;
                let imageBase64 = null;

                if (provider === 'openai') {
                    // DALL-E 3
                    const sizeMode = thumbSizeSelect ? thumbSizeSelect.value : 'youtube';
                    const dalleSize = sizeMode === 'tiktok' ? '1024x1792' : sizeMode === 'square' ? '1024x1024' : '1792x1024';
                    const res = await fetch('https://api.openai.com/v1/images/generations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: dalleSize, response_format: 'url' })
                    });
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error?.message || 'DALL-E API Error');
                    }
                    const data = await res.json();
                    imageUrl = data.data[0].url;
                } else {
                    // Gemini 画像生成
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
                        })
                    });
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error?.message || 'Gemini API Error');
                    }
                    const data = await res.json();
                    console.log('Gemini Response:', data);

                    const parts = data.candidates?.[0]?.content?.parts || [];
                    // 画像データ（inlineDataまたはfileData）を探す
                    const imgPart = parts.find(p => p.inlineData || p.fileData);

                    if (!imgPart) {
                        // テキスト（プロンプト等）しか返ってこなかった場合のエラー案内
                        const textPart = parts.find(p => p.text);
                        const textMsg = textPart ? textPart.text : '不明なレスポンス';
                        throw new Error('選択中のモデル（' + aiModel + '）は画像生成に対応していません。「imagen-3.0-generate-002」等の画像モデルを指定するか、OpenAI（DALL-E 3）をご利用ください。');
                    }

                    const mime = imgPart.inlineData?.mimeType || imgPart.fileData?.mimeType || 'image/png';
                    const base64Data = imgPart.inlineData?.data || imgPart.fileData?.data;
                    imageBase64 = `data:${mime};base64,${base64Data}`;
                }

                // 画像をキャッシュ
                const finalSrc = imageBase64 || imageUrl;
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => { cachedAiBgImage = img; resolve(); };
                    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
                    img.src = finalSrc;
                });

                if (thumbAiBgStatus) thumbAiBgStatus.textContent = '✅ 生成完了！プレビューに反映しました';
                drawThumbPreview();

            } catch (err) {
                console.error('[AI BG]', err);
                if (thumbAiBgStatus) thumbAiBgStatus.textContent = `❌ エラー: ${err.message}`;
            } finally {
                thumbAiBgGenerateBtn.textContent = '✨ 背景をAI生成';
                thumbAiBgGenerateBtn.disabled = false;
            }
        }, { signal: __uiSignal });
    }

    const thumbSettings = [
        thumbSizeSelect, thumbShowBg, thumbShowAvatar, thumbShowTitle, thumbShowDesc,
        thumbTitleColor, thumbTitleStroke, thumbTitleSize, thumbTitleX, thumbTitleY,
        thumbDescColor, thumbDescStroke, thumbDescSize, thumbDescX, thumbDescY,
        thumbAvatarScale, thumbAvatarX, thumbAvatarY
    ];

    // Load saved settings
    thumbSettings.forEach(el => {
        if (!el) return;
        const saved = localStorage.getItem('savedThumb_' + el.id);
        if (saved !== null) {
            if (el.type === 'checkbox') el.checked = saved === 'true';
            else el.value = saved;
        }
        el.addEventListener('input', () => {
            if (el.type === 'checkbox') localStorage.setItem('savedThumb_' + el.id, el.checked);
            else localStorage.setItem('savedThumb_' + el.id, el.value);
            drawThumbPreview();
        }, { signal: __uiSignal });
    });

    const drawThumbPreview = async () => {
        if (!thumbPreviewCanvas) return;
        const ctx = thumbPreviewCanvas.getContext('2d');

        let targetWidth = 1280;
        let targetHeight = 720;
        if (thumbSizeSelect.value === 'tiktok') { targetWidth = 1080; targetHeight = 1920; }
        else if (thumbSizeSelect.value === 'square') { targetWidth = 1080; targetHeight = 1080; }

        thumbPreviewCanvas.width = targetWidth;
        thumbPreviewCanvas.height = targetHeight;

        // 1. 背景描画
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        if (thumbShowBg.checked) {
            // AI生成背景画像を優先して使う
            if (cachedAiBgImage) {
                const scale = Math.max(targetWidth / cachedAiBgImage.width, targetHeight / cachedAiBgImage.height);
                const x = (targetWidth - cachedAiBgImage.width * scale) / 2;
                const y = (targetHeight - cachedAiBgImage.height * scale) / 2;
                ctx.drawImage(cachedAiBgImage, x, y, cachedAiBgImage.width * scale, cachedAiBgImage.height * scale);
            } else {
                const bgDiv = document.getElementById('background-layer');
                const bgImageStyle = bgDiv ? getComputedStyle(bgDiv).backgroundImage : 'none';
                if (bgImageStyle && bgImageStyle !== 'none') {
                    const urlMatch = bgImageStyle.match(/url\(['"]?(.*?)['"]?\)/);
                    if (urlMatch && urlMatch[1]) {
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            img.onload = () => {
                                const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
                                const x = (targetWidth - img.width * scale) / 2;
                                const y = (targetHeight - img.height * scale) / 2;
                                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                                resolve();
                            };
                            img.onerror = resolve;
                            img.src = urlMatch[1];
                        });
                    }
                }
            }
        }

        // 2. アバター描画
        if (thumbShowAvatar.checked && cachedAvatarCanvas) {
            const view = cachedAvatarCanvas;

            const userScale = thumbAvatarScale ? parseFloat(thumbAvatarScale.value) / 100 : 1;
            const alignX = thumbAvatarX ? parseFloat(thumbAvatarX.value) / 100 : 1;
            const alignY = thumbAvatarY ? parseFloat(thumbAvatarY.value) / 100 : 1;

            // ベースは高さいっぱいのスケール
            const baseScale = targetHeight / view.height;
            const finalScale = baseScale * userScale;

            const w = view.width * finalScale;
            const h = view.height * finalScale;

            const baseX = targetWidth * alignX;
            const baseY = targetHeight * alignY;

            const x = baseX - (w * alignX);
            const y = baseY - (h * alignY);

            ctx.drawImage(view, x, y, w, h);
        }

        // 3. テキスト描画
        const titleText = thumbEditTitle ? thumbEditTitle.value : '';
        const descText = thumbEditDesc ? thumbEditDesc.value : '';

        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        if (thumbShowTitle.checked && titleText) {
            const lines = titleText.split('\n');
            const baseX = targetWidth * (parseFloat(thumbTitleX.value) / 100);
            let baseY = targetHeight * (parseFloat(thumbTitleY.value) / 100);
            const tSize = thumbTitleSize ? parseFloat(thumbTitleSize.value) : 72;

            ctx.font = `bold ${tSize}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            for (let line of lines) {
                ctx.lineWidth = Math.max(4, tSize / 6);
                ctx.strokeStyle = thumbTitleStroke.value;
                ctx.strokeText(line, baseX, baseY);
                ctx.fillStyle = thumbTitleColor.value;
                ctx.fillText(line, baseX, baseY);
                baseY += tSize * 1.25;
            }
        }

        if (thumbShowDesc.checked && descText) {
            const descLines = descText.split('\n');
            const baseX = targetWidth * (parseFloat(thumbDescX.value) / 100);
            let baseY = targetHeight * (parseFloat(thumbDescY.value) / 100);
            const dSize = thumbDescSize ? parseFloat(thumbDescSize.value) : 40;

            ctx.font = `bold ${dSize}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            for (let line of descLines) {
                ctx.lineWidth = Math.max(3, dSize / 5);
                ctx.strokeStyle = thumbDescStroke.value;
                ctx.strokeText(line, baseX, baseY);
                ctx.fillStyle = thumbDescColor.value;
                ctx.fillText(line, baseX, baseY);
                baseY += dSize * 1.5;
            }
        }
    };

    if (openThumbEditorBtn) {
        openThumbEditorBtn.addEventListener('click', () => {
            if (thumbEditorModal) thumbEditorModal.style.display = 'flex';
            if (thumbEditTitle && streamTitleInput) thumbEditTitle.value = streamTitleInput.value;
            if (thumbEditDesc && streamDescInput) thumbEditDesc.value = streamDescInput.value;
            captureAvatarFrame(); // 初回表示時に今のポーズを取得
            drawThumbPreview();
        }, { signal: __uiSignal });
    }

    if (thumbEditTitle) {
        thumbEditTitle.addEventListener('input', () => {
            if (streamTitleInput) {
                streamTitleInput.value = thumbEditTitle.value;
                localStorage.setItem('savedStreamTitle', streamTitleInput.value);
            }
            drawThumbPreview();
        }, { signal: __uiSignal });
    }

    if (thumbEditDesc) {
        thumbEditDesc.addEventListener('input', () => {
            if (streamDescInput) {
                streamDescInput.value = thumbEditDesc.value;
                localStorage.setItem('savedStreamDesc', streamDescInput.value);
            }
            drawThumbPreview();
        }, { signal: __uiSignal });
    }

    if (thumbEditorCancelBtn) {
        thumbEditorCancelBtn.addEventListener('click', () => {
            if (thumbEditorModal) thumbEditorModal.style.display = 'none';
        }, { signal: __uiSignal });
    }

    if (thumbDownloadBtn) {
        thumbDownloadBtn.addEventListener('click', () => {
            if (!thumbPreviewCanvas) return;
            const link = document.createElement('a');
            link.download = 'thumbnail.png';
            link.href = thumbPreviewCanvas.toDataURL('image/png');
            link.click();
        }, { signal: __uiSignal });
    }

    // =====================================================================
    // AI配信タイトル生成
    // =====================================================================
    const aiStreamThemeInput = document.getElementById('ai-stream-theme');
    const aiGenerateStreamBtn = document.getElementById('ai-generate-stream-info-btn');
    const aiCandidatesModal = document.getElementById('ai-candidates-modal');
    const aiCandidatesList = document.getElementById('ai-candidates-list');
    const aiCandidatesCancelBtn = document.getElementById('ai-candidates-cancel-btn');

    if (aiCandidatesCancelBtn) {
        aiCandidatesCancelBtn.addEventListener('click', () => {
            aiCandidatesModal.style.display = 'none';
        }, { signal: __uiSignal });
    }

    // =====================================================================
    // YouTube概要欄エディタ
    // =====================================================================
    const ytDescModal = document.getElementById('yt-desc-modal');
    const ytDescTextarea = document.getElementById('yt-desc-textarea');
    const ytDescCharcount = document.getElementById('yt-desc-charcount');
    const ytDescCancelBtn = document.getElementById('yt-desc-cancel-btn');
    const ytDescCopyBtn = document.getElementById('yt-desc-copy-btn');
    const editYtDescBtn = document.getElementById('edit-yt-desc-btn');
    const copyYtDescBtn = document.getElementById('copy-yt-desc-btn');
    const aiGenerateYtDescBtn = document.getElementById('ai-generate-yt-desc-btn');

    const updateYtDescCount = () => {
        if (ytDescCharcount && ytDescTextarea) {
            ytDescCharcount.textContent = `${ytDescTextarea.value.length}文字`;
        }
    };

    // ローカルストレージで保存
    if (ytDescTextarea) {
        const saved = localStorage.getItem('savedYtDescription');
        if (saved) ytDescTextarea.value = saved;
        ytDescTextarea.addEventListener('input', () => {
            localStorage.setItem('savedYtDescription', ytDescTextarea.value);
            updateYtDescCount();
        }, { signal: __uiSignal });
        updateYtDescCount();
    }

    // 編集ボタン → モーダルを開く
    if (editYtDescBtn && ytDescModal) {
        editYtDescBtn.addEventListener('click', () => {
            ytDescModal.style.display = 'flex';
            updateYtDescCount();
        }, { signal: __uiSignal });
    }

    // パネル側のコピーボタン
    if (copyYtDescBtn && ytDescTextarea) {
        copyYtDescBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(ytDescTextarea.value).then(() => {
                copyYtDescBtn.textContent = '✅ コピー済';
                setTimeout(() => { copyYtDescBtn.textContent = 'コピー'; }, 2000);
            });
        }, { signal: __uiSignal });
    }

    // モーダル内コピーボタン
    if (ytDescCopyBtn && ytDescTextarea) {
        ytDescCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(ytDescTextarea.value).then(() => {
                ytDescCopyBtn.textContent = '✅ コピー済み';
                setTimeout(() => { ytDescCopyBtn.textContent = '📋 コピー'; }, 2000);
            });
        }, { signal: __uiSignal });
    }

    // モーダルを閉じる
    if (ytDescCancelBtn) {
        ytDescCancelBtn.addEventListener('click', () => {
            ytDescModal.style.display = 'none';
        }, { signal: __uiSignal });
    }

    // AI生成（概要欄向け詳細文）
    if (aiGenerateYtDescBtn) {
        aiGenerateYtDescBtn.addEventListener('click', async () => {
            const apiKey = localStorage.getItem('savedAiApiKey');
            const provider = localStorage.getItem('savedAiProvider') || 'gemini';
            const aiModel = localStorage.getItem('savedAiModel') || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

            if (!apiKey) {
                alert('AI設定タブでAPIキーを設定してください。');
                return;
            }

            const title = streamTitleInput ? streamTitleInput.value.trim() : '';
            const shortDesc = streamDescInput ? streamDescInput.value.trim() : '';
            const theme = aiStreamThemeInput ? aiStreamThemeInput.value.trim() : '';

            const prompt = `あなたはプロのVTuber配信マネージャーです。
以下の配信情報をもとに、YouTubeの概要欄（説明欄）に書く長文テキストを1本だけ作成してください。

配信タイトル: ${title || '（未設定）'}
配信テーマ: ${theme || shortDesc || '（未設定）'}

【概要欄の構成】
1. 元気な挨拶と配信の見どころ（2〜3文）
2. 配信のルール・お願い
   - 話題に出ていない他の配信者の名前を出さないでください
   - 伝書鳩NG
   - 荒らし・アンチはブロック＆スルー
   - 不快なコメントは非表示・ブロックします
3. SNSリンク（Twitterなど、ダミーURL可）
4. 関連するハッシュタグ（5〜8個）
5. 素材・モデルのクレジット表記（以下の内容を必ず含めてください）
   - Live2Dモデル: 「とろろ」© Live2D Inc. (Live2D Creative Studio サンプルモデル)
   - BGMやその他素材（ダミーで構いません）

マークダウンやJSONは不要です。そのままYouTubeに貼れる形式のプレーンテキストだけを返してください。`;

            aiGenerateYtDescBtn.textContent = '⏳ 生成中...';
            aiGenerateYtDescBtn.disabled = true;

            try {
                let result = '';
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model: aiModel, messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
                    });
                    if (!res.ok) throw new Error('OpenAI API Error');
                    const data = await res.json();
                    result = data.choices[0].message.content;
                } else {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
                    });
                    if (!res.ok) throw new Error('Gemini API Error');
                    const data = await res.json();
                    result = data.candidates[0].content.parts[0].text;
                }

                if (ytDescTextarea) {
                    ytDescTextarea.value = result;
                    localStorage.setItem('savedYtDescription', result);
                    updateYtDescCount();
                }
            } catch (err) {
                console.error(err);
                alert('AI生成に失敗しました。\n' + err.message);
            } finally {
                aiGenerateYtDescBtn.textContent = '✨ AI で概要欄を生成';
                aiGenerateYtDescBtn.disabled = false;
            }
        }, { signal: __uiSignal });
    }

    if (aiGenerateStreamBtn) {
        aiGenerateStreamBtn.addEventListener('click', async () => {
            const apiKey = localStorage.getItem('savedAiApiKey');
            const provider = localStorage.getItem('savedAiProvider') || 'gemini';
            const aiModel = localStorage.getItem('savedAiModel') || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

            if (!apiKey) {
                alert('AI設定タブでAPIキーを設定してください。');
                return;
            }

            const theme = aiStreamThemeInput.value.trim() || 'おまかせ（今日の配信）';
            const prompt = `あなたはプロのVTuber配信マネージャーです。
以下のキーワードやテーマを元に、YouTube配信用の「配信タイトル」と「概要文」のセットを10通り作成してください。

【概要文の要件】
他の人気VTuberがよくやっているように、以下の要素を盛り込んでリッチな概要文にしてください：
1. 配信のあらすじ・見どころ（元気な挨拶を含む）
2. 関連するハッシュタグ（例: #水森りんご 等）
3. X(Twitter)などのSNSへのリンク（URLは https://twitter.com/... のようなダミーでOK）
4. 視聴者へのお願い・配信のルール（「話題に出ていない他の配信者の名前を出さない」「伝書鳩NG」「荒らしはブロック＆スルー」など）
5. 素材・モデルのクレジット表記（以下の内容を必ず含めてください）
   - Live2Dモデル: 「とろろ」© Live2D Inc. (Live2D Creative Studio サンプルモデル)
   - BGMやその他素材（ダミーで構いません）

必ず以下のJSONフォーマットのみを返してください（マークダウンやバッククォート、説明などは一切不要です）。
[
  { "title": "タイトル1", "description": "概要1" },
  { "title": "タイトル2", "description": "概要2" }
]

キーワード・テーマ: ${theme}`;

            aiGenerateStreamBtn.textContent = '✨ 生成中...';
            aiGenerateStreamBtn.disabled = true;

            try {
                let jsonText = '';
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: aiModel,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.7
                        })
                    });
                    if (!res.ok) throw new Error('OpenAI API Error');
                    const data = await res.json();
                    jsonText = data.choices[0].message.content;
                } else {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.7 }
                        })
                    });
                    if (!res.ok) throw new Error('Gemini API Error');
                    const data = await res.json();
                    jsonText = data.candidates[0].content.parts[0].text;
                }

                // JSONの抽出 (マークダウンがあった場合を考慮)
                if (jsonText.includes('```json')) {
                    jsonText = jsonText.split('```json')[1].split('```')[0].trim();
                } else if (jsonText.includes('```')) {
                    jsonText = jsonText.split('```')[1].split('```')[0].trim();
                }

                const candidates = JSON.parse(jsonText);

                // モーダルにレンダリング
                aiCandidatesList.innerHTML = '';
                candidates.forEach((cand, i) => {
                    const div = document.createElement('div');
                    div.className = 'ai-candidate-item';

                    const title = document.createElement('h4');
                    title.textContent = `${i + 1}. ${cand.title}`;

                    const desc = document.createElement('p');
                    desc.textContent = cand.description;

                    const applyBtn = document.createElement('button');
                    applyBtn.className = 'apply-btn';
                    applyBtn.textContent = '適用する';
                    applyBtn.onclick = () => {
                        if (streamTitleInput) streamTitleInput.value = cand.title;
                        if (streamDescInput) streamDescInput.value = cand.description;
                        localStorage.setItem('savedStreamTitle', cand.title);
                        localStorage.setItem('savedStreamDesc', cand.description);
                        aiCandidatesModal.style.display = 'none';
                    };

                    div.appendChild(title);
                    div.appendChild(desc);
                    div.appendChild(applyBtn);
                    aiCandidatesList.appendChild(div);
                });

                aiCandidatesModal.style.display = 'flex';

            } catch (err) {
                console.error(err);
                alert('AI生成に失敗しました。\n' + err.message);
            } finally {
                aiGenerateStreamBtn.textContent = '✨ AI生成';
                aiGenerateStreamBtn.disabled = false;
            }
        }, { signal: __uiSignal });
    }


    // =====================================================================
    // OBS WebSocket 自動連携
    // =====================================================================
    const obsWsPortInput = document.getElementById('obs-ws-port');
    const obsWsPasswordInput = document.getElementById('obs-ws-password');
    const obsWsConnectBtn = document.getElementById('obs-ws-connect-btn');
    const obsWsStatus = document.getElementById('obs-ws-status');

    async function toggleObsWsConnection() {
        if (isObsWsConnected && obsWsClient) {
            // 切断処理
            try {
                await obsWsClient.disconnect();
            } catch (e) {
                console.error("OBS WS Disconnect Error:", e);
            }
            if (obsWsStatus) {
                obsWsStatus.textContent = '未接続';
                obsWsStatus.style.color = '#aaa';
            }
            if (obsWsConnectBtn) {
                obsWsConnectBtn.textContent = '接続する';
                obsWsConnectBtn.style.background = 'var(--primary)';
            }
            isObsWsConnected = false;
            localStorage.setItem('obsWsAutoConnect', 'false'); // 手動切断時にフラグを解除
            return;
        }

        // 接続処理
        const port = obsWsPortInput ? (obsWsPortInput.value.trim() || '4455') : '4455';
        const password = obsWsPasswordInput ? obsWsPasswordInput.value.trim() : '';

        localStorage.setItem('savedObsWsPort', port);
        localStorage.setItem('savedObsWsPassword', password);

        if (typeof OBSWebSocket === 'undefined') {
            if (obsWsStatus) {
                obsWsStatus.textContent = 'ライブラリ読込エラー';
                obsWsStatus.style.color = '#ff4444';
            }
            return;
        }

        if (!obsWsClient) {
            obsWsClient = new OBSWebSocket();

            obsWsClient.on('ConnectionClosed', () => {
                isObsWsConnected = false;
                if (obsWsStatus) {
                    obsWsStatus.textContent = '切断されました';
                    obsWsStatus.style.color = '#ff4444';
                }
                if (obsWsConnectBtn) {
                    obsWsConnectBtn.textContent = '接続する';
                    obsWsConnectBtn.style.background = 'var(--primary)';
                }
            });

            obsWsClient.on('ConnectionError', (err) => {
                console.error('OBS WS Error', err);
                isObsWsConnected = false;
            });
        }

        try {
            if (obsWsStatus) {
                obsWsStatus.textContent = '接続中...';
                obsWsStatus.style.color = '#ffaa00';
            }

            // OBSがIPv6でListenしている場合があるため、常に 'localhost' を使用する
            const targetHost = 'localhost';
            console.log(`Connecting to OBS WS at ws://${targetHost}:${port} ...`);
            await obsWsClient.connect(`ws://${targetHost}:${port}`, password);

            isObsWsConnected = true;
            localStorage.setItem('obsWsAutoConnect', 'true'); // 接続成功時にフラグを保存
            if (obsWsStatus) {
                obsWsStatus.textContent = '接続済み';
                obsWsStatus.style.color = '#00ff88';
            }
            if (obsWsConnectBtn) {
                obsWsConnectBtn.textContent = '切断する';
                obsWsConnectBtn.style.background = '#ff4444';
            }
        } catch (error) {
            console.error('OBS WS Connect Error:', error);
            isObsWsConnected = false;
            if (obsWsStatus) {
                obsWsStatus.textContent = '接続失敗';
                obsWsStatus.style.color = '#ff4444';
            }
            const errMsg = error.message ? error.message : JSON.stringify(error);
            alert(`OBS WebSocketへの接続に失敗しました。\nポート番号、パスワード、OBS側で有効になっているか確認してください。\n詳細: ${errMsg}`);
        }
    }

    if (obsWsConnectBtn) {
        obsWsConnectBtn.addEventListener('click', toggleObsWsConnection, { signal: __uiSignal });
    }

    // 設定復元
    const savedObsWsPort = localStorage.getItem('savedObsWsPort');
    const savedObsWsPassword = localStorage.getItem('savedObsWsPassword');
    if (savedObsWsPort && obsWsPortInput) obsWsPortInput.value = savedObsWsPort;
    if (savedObsWsPassword && obsWsPasswordInput) obsWsPasswordInput.value = savedObsWsPassword;

} // end bindUIEvents()

// =====================================================================
// OBSモード適用
// =====================================================================
if (isObsMode) {
    document.body.classList.add('obs-mode');
    if (isGreenMode) document.body.classList.add('green-mode');
}

// =====================================================================
// アプリ初期化
// =====================================================================
// UIイベントバインドは bindUIEvents() の中でではなく、
// ここで独立して呼び出す
loadSettings();
buildModelGrid();
initPixi();
bindUIEvents();

// =========================================================================
// 汎用UI状態の自動保存・復元機能 (すべてのUI要素を網羅)
// =========================================================================
function initAutoSaveUI() {
    const STORAGE_KEY = 'live2d_studio_auto_ui_state';
    let savedState = {};
    try {
        savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) { }

    const elements = document.querySelectorAll('input[type="checkbox"], input[type="range"], input[type="text"], input[type="number"], input[type="password"], input[type="time"], select, textarea');

    elements.forEach(el => {
        if (!el.id) return;
        if (el.type === 'file') return;

        // 復元処理
        if (savedState[el.id] !== undefined) {
            if (el.type === 'checkbox') {
                el.checked = savedState[el.id];
            } else {
                el.value = savedState[el.id];
            }

            // プログラムから値を変更したことを通知し、関連するイベントを発火させる
            setTimeout(() => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, 50);
        }

        // 保存処理の追加
        const saveHandler = (e) => {
            const target = e.target;
            const val = target.type === 'checkbox' ? target.checked : target.value;
            savedState[target.id] = val;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
        };

        el.addEventListener('change', saveHandler);
        if (el.type === 'range' || el.type === 'text' || el.type === 'number' || el.type === 'password' || el.tagName.toLowerCase() === 'textarea') {
            el.addEventListener('input', saveHandler);
        }
    });

    // =====================================================================
    // リロード時の自動接続・自動実行
    // =====================================================================
    setTimeout(() => {
        const obsConnectBtn = document.getElementById('obs-ws-connect-btn');
        const obsStatus = document.getElementById('obs-ws-status');
        const shouldAutoConnect = localStorage.getItem('obsWsAutoConnect') === 'true';

        if (shouldAutoConnect && obsConnectBtn) {
            let retryCount = 0;
            const tryConnect = () => {
                if (obsStatus && obsStatus.textContent === '接続済み') return;

                if (typeof window.OBSWebSocket !== 'undefined') {
                    console.log("[AutoSave] Auto connecting to OBS WebSocket...");
                    obsConnectBtn.click();
                } else if (retryCount < 10) {
                    retryCount++;
                    setTimeout(tryConnect, 500); // 500ms待ってリトライ
                } else {
                    console.error("[AutoSave] OBSWebSocket library not loaded in time.");
                }
            };
            tryConnect();
        }
    }, 300); // UIイベントが伝搬し終わった後に実行
}

initAutoSaveUI();

if (isIdleSpeechEnabled && typeof resetIdleTimer === 'function') {
    resetIdleTimer();
}

const initialModel = MODELS.find(m => m.id === currentModelId) || MODELS[0];
loadModel(initialModel);

if (autoBlinkToggle.checked && !isObsMode) scheduleBlink();
updateObsUrl();

// Browser Autoplay Policy: unlock audio context on first user click/touch/keypress
const audioUnlockBanner = document.getElementById('audio-unlock-banner');

if (!voicevoxAudioContext) {
    voicevoxAudioContext = new (window.AudioContext || window.webkitAudioContext)();
}

const checkAndHideBanner = () => {
    if (voicevoxAudioContext && voicevoxAudioContext.state === 'running') {
        if (audioUnlockBanner) audioUnlockBanner.style.display = 'none';
        return true;
    }
    return false;
};

// 初期状態で許可されているかチェック
if (!isObsMode && !checkAndHideBanner()) {
    if (audioUnlockBanner) audioUnlockBanner.style.display = 'block';

    // 許可されていない場合は、少しだけresumeを試みてみる（ブラウザによって挙動が違うため）
    voicevoxAudioContext.resume().then(() => {
        checkAndHideBanner();
    }).catch(e => console.warn("Auto resume blocked:", e));
}

const unlockAudio = () => {
    if (!voicevoxAudioContext) {
        voicevoxAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (voicevoxAudioContext.state === 'suspended') {
        voicevoxAudioContext.resume().catch(e => console.warn("voicevox auto resume:", e));
    }

    if (typeof bgmAudioContext !== 'undefined' && bgmAudioContext && bgmAudioContext.state === 'suspended') {
        bgmAudioContext.resume().catch(e => console.warn("bgm auto resume:", e));
    }

    setTimeout(() => {
        checkAndHideBanner();
    }, 100);
};

// イベントリスナーは常に追加しておき、何度でもリトライできるようにする
window.addEventListener('click', unlockAudio);
window.addEventListener('touchend', unlockAudio);
window.addEventListener('keydown', unlockAudio);
});
