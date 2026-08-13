// Live2D Avatar Studio - Main Controller
// Uses PixiJS v6 + pixi-live2d-display v0.4 (Cubism4 bundle) + MediaPipe

document.addEventListener('DOMContentLoaded', () => {

    // =====================================================================
    // モデル定義
    // =====================================================================
    const MODELS = [
        { id: 'hiyori', name: 'Hiyori', path: 'Live2DModels/hiyori_vts/hiyori.model3.json', icon: 'Live2DModels/hiyori_vts/icon.jpg' },
        { id: 'akari',  name: 'Akari',  path: 'Live2DModels/akari_vts/akari.model3.json',   icon: 'Live2DModels/akari_vts/icon.jpg' },
        { id: 'hijiki', name: 'Hijiki', path: 'Live2DModels/hijiki_vts/hijiki.model3.json', icon: 'Live2DModels/hijiki_vts/icon.jpg' },
        { id: 'tororo', name: 'Tororo', path: 'Live2DModels/tororo_vts/tororo.model3.json', icon: 'Live2DModels/tororo_vts/icon.jpg' },
        { id: 'wanko',  name: 'Wanko',  path: 'Live2DModels/wanko_vts/wanko.model3.json',  icon: 'Live2DModels/wanko_vts/icon.jpg' },
    ];

    // =====================================================================
    // DOM
    // =====================================================================
    const viewport      = document.getElementById('avatar-viewport');
    const canvas        = document.getElementById('live2d-canvas');
    const modelGrid     = document.getElementById('model-grid');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText   = document.getElementById('loading-text');
    const bgLayer       = document.getElementById('background-layer');

    const cameraTrackToggle      = document.getElementById('camera-track-toggle');
    const cameraStatus           = document.getElementById('camera-status');
    const cameraPreviewToggle    = document.getElementById('camera-preview-toggle');
    const cameraPreviewContainer = document.getElementById('camera-preview-container');
    const micToggle              = document.getElementById('mic-sync-toggle');
    const micStatus              = document.getElementById('mic-status');
    const autoBlinkToggle        = document.getElementById('auto-blink-toggle');
    const idleAnimToggle         = document.getElementById('idle-anim-toggle');
    const video                  = document.getElementById('webcam');
    const handTrackToggle        = document.getElementById('hand-track-toggle');
    const handStatus             = document.getElementById('hand-status');

    // 部位Tuber (AR顔被せ) DOM
    const faceMaskToggle    = document.getElementById('face-mask-toggle');
    const maskStatus        = document.getElementById('mask-status');
    const maskScaleSlider   = document.getElementById('mask-scale-slider');
    const maskScaleVal      = document.getElementById('mask-scale-val');
    const maskOffsetYSlider = document.getElementById('mask-offset-y-slider');
    const maskOffsetYVal    = document.getElementById('mask-offset-y-val');
    const maskOffsetXSlider = document.getElementById('mask-offset-x-slider');
    const maskOffsetXVal    = document.getElementById('mask-offset-x-val');

    const faceSensSlider = document.getElementById('face-sensitivity-slider');
    const faceSensVal    = document.getElementById('face-sensitivity-val');
    const scaleSlider    = document.getElementById('scale-slider');
    const scaleVal       = document.getElementById('scale-val');
    const offsetYSlider  = document.getElementById('offset-y-slider');
    const offsetYVal     = document.getElementById('offset-y-val');
    const offsetXSlider  = document.getElementById('offset-x-slider');
    const offsetXVal     = document.getElementById('offset-x-val');
    const obsUrlInput    = document.getElementById('obs-url-input');
    const copyUrlBtn     = document.getElementById('copy-url-btn');
    const obsGreenToggle = document.getElementById('obs-green-toggle');

    // TikTok & YouTube & VOICEVOX DOM
    const tiktokUserInput    = document.getElementById('tiktok-username-input');
    const tiktokConnectBtn   = document.getElementById('tiktok-connect-btn');
    const tiktokStatus       = document.getElementById('tiktok-status');
    const youtubeUserInput   = document.getElementById('youtube-video-input');
    const youtubeConnectBtn  = document.getElementById('youtube-connect-btn');
    const youtubeStatus      = document.getElementById('youtube-status');
    const voicevoxToggle     = document.getElementById('voicevox-toggle');
    const voicevoxSpeakerId  = document.getElementById('voicevox-speaker-id');

    // デバッグスライダーDOM
    const debugArmLaSlider = document.getElementById('debug-arm-la');
    const debugArmLaVal    = document.getElementById('debug-arm-la-val');
    const debugArmLbSlider = document.getElementById('debug-arm-lb');
    const debugArmLbVal    = document.getElementById('debug-arm-lb-val');
    const debugArmRaSlider = document.getElementById('debug-arm-ra');
    const debugArmRaVal    = document.getElementById('debug-arm-ra-val');
    const debugArmRbSlider = document.getElementById('debug-arm-rb');
    const debugArmRbVal    = document.getElementById('debug-arm-rb-val');

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
    const urlParams   = new URLSearchParams(window.location.search);
    const isObsMode   = urlParams.has('obs');
    const isGreenMode = urlParams.has('green');
    const urlModel    = urlParams.get('model');
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
        mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    // =====================================================================
    // PixiJS 初期化
    // =====================================================================
    function initPixi() {
        const w = viewport.clientWidth  || window.innerWidth  - 320;
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
            const nw = viewport.clientWidth  || window.innerWidth  - 320;
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
                        try { core.setPartOpacityById('PartArmA', 1.0); } catch(e){}
                        try { core.setPartOpacityById('PartArmB', opB); } catch(e){}
                    } catch(e){}
                }
            }
        });
    }

    // =====================================================================
    // モデルポジション
    // =====================================================================
    function positionModel() {
        if (!live2dModel || !pixiApp) return;
        const w = pixiApp.screen.width  || (viewport.clientWidth  || window.innerWidth  - 320);
        const h = pixiApp.screen.height || (viewport.clientHeight || window.innerHeight);

        if (w === 0 || h === 0) {
            console.warn('positionModel: screen size is 0, retrying...');
            setTimeout(positionModel, 100);
            return;
        }

        // Live2Dモデルの元サイズを取得
        const mw = (live2dModel.internalModel && live2dModel.internalModel.originalWidth)  || 2048;
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
                    try { core.setParameterValueById('ParamArmLA', 0.0); } catch(e){}
                    try { core.setParameterValueById('ParamArmRA', 0.0); } catch(e){}
                    try { core.setParameterValueById('ParamArmLB', 0.0); } catch(e){}
                    try { core.setParameterValueById('ParamArmRB', 0.0); } catch(e){}

                    try { core.setPartOpacityById('PartArmA', 1.0); } catch(e){}
                    try { core.setPartOpacityById('PartArmB', 0.0); } catch(e){}
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
                    tBreath  = (Math.sin(t * 0.2) + 1) * 0.5;
                    tAngleX  = idleGazeX + Math.sin(t * 0.08) * 3;
                    tAngleY  = idleGazeY + Math.cos(t * 0.12) * 2;
                    tAngleZ  = Math.sin(t * 0.10) * 2;
                    tEyeBallX = idleGazeX / 30;
                    tEyeBallY = idleGazeY / 20;
                } else {
                    // マウス追従
                    tAngleX   = mouseX  * 30 * faceSensitivity;
                    tAngleY   = -mouseY * 20 * faceSensitivity;
                    tAngleZ   = -mouseX * 5;
                    tEyeBallX = mouseX  * 0.8;
                    tEyeBallY = mouseY  * 0.8;
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
        cAngleX    += (tAngleX    - cAngleX)    * ease;
        cAngleY    += (tAngleY    - cAngleY)    * ease;
        cAngleZ    += (tAngleZ    - cAngleZ)    * ease;
        cEyeLOpen  += (tEyeLOpen  - cEyeLOpen)  * 0.2;
        cEyeROpen  += (tEyeROpen  - cEyeROpen)  * 0.2;

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

        cEyeBallX  += (tEyeBallX  - cEyeBallX)  * 0.1;
        cEyeBallY  += (tEyeBallY  - cEyeBallY)  * 0.1;
        cBreath    += (tBreath    - cBreath)    * 0.05;

        // 腕のイージング補間 (手動デバッグスライダー操作時は直接代入)
        if (!isHandTrackActive) {
            cArmLA = tArmLA;
            cArmLB = tArmLB;
            cArmRA = tArmRA;
            cArmRB = tArmRB;
        } else {
            cArmLA     += (tArmLA     - cArmLA)     * 0.15;
            cArmLB     += (tArmLB     - cArmLB)     * 0.15;
            cArmRA     += (tArmRA     - cArmRA)     * 0.15;
            cArmRB     += (tArmRB     - cArmRB)     * 0.15;
        }

        // 手の形・腕角度のイージング補間
        cHandLBVal += (tHandLBVal - cHandLBVal) * 0.15;
        cHandRBVal += (tHandRBVal - cHandRBVal) * 0.15;
        cHandLForm += (tHandLForm - cHandLForm) * 0.15;
        cHandRForm += (tHandRForm - cHandRForm) * 0.15;

        // Live2D coreModel にパラメータを書き込む
        try {
            const core = live2dModel.internalModel.coreModel;
            const set  = (id, v) => { try { core.setParameterValueById(id, v); } catch(e){} };

            set('PARAM_ANGLE_X',    cAngleX);
            set('PARAM_ANGLE_Y',    cAngleY);
            set('PARAM_ANGLE_Z',    cAngleZ);
            set('PARAM_EYE_L_OPEN', cEyeLOpen);
            set('PARAM_EYE_R_OPEN', cEyeROpen);
            set('ParamEyeLOpen',    cEyeLOpen);
            set('ParamEyeROpen',    cEyeROpen);
            set('PARAM_MOUTH_OPEN_Y', cMouthOpen);
            set('ParamMouthOpenY',    cMouthOpen);
            set('PARAM_EYE_BALL_X', cEyeBallX);
            set('PARAM_EYE_BALL_Y', cEyeBallY);
            set('PARAM_BREATH',     cBreath);

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
        } catch(e) {}

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

                tAngleX   = -yaw   * 30 * faceSensitivity;
                tAngleY   =  pitch * 30 * faceSensitivity;
                tAngleZ   =  yaw   * 10;
                tEyeBallX = -yaw   * 0.8;
                tEyeBallY =  pitch * 0.8;

                const getBS = name => { const c = bs.find(x => x.categoryName === name); return c ? c.score : 0; };
                tEyeLOpen   = Math.min(0.85, Math.max(0, 1 - getBS('eyeBlinkLeft')  * 2.5));
                tEyeROpen   = Math.min(0.85, Math.max(0, 1 - getBS('eyeBlinkRight') * 2.5));
                tMouthOpen  = Math.min(1, Math.max(0, (getBS('jawOpen') - 0.05) / 0.4));
                tBreath     = 0.5;

                // 部位Tuber (AR顔被せ) リアルタイム座標・スケール計算
                if (isFaceMaskMode && pixiApp) {
                    const vw = pixiApp.screen.width  || viewport.clientWidth;
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
    scaleSlider.addEventListener('input',    () => { modelScale = parseFloat(scaleSlider.value); scaleVal.textContent = modelScale.toFixed(2); positionModel(); saveSettings(); });
    offsetYSlider.addEventListener('input',  () => { offsetY = parseInt(offsetYSlider.value); offsetYVal.textContent = offsetY; positionModel(); saveSettings(); });
    offsetXSlider.addEventListener('input',  () => { offsetX = parseInt(offsetXSlider.value); offsetXVal.textContent = offsetX; positionModel(); saveSettings(); });

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
    const togglePanelBtn     = document.getElementById('toggle-panel-btn');
    const togglePanelText    = document.getElementById('toggle-panel-text');
    const hidePanelHeaderBtn = document.getElementById('hide-panel-header-btn');

    if (hidePanelHeaderBtn && togglePanelBtn) {
        hidePanelHeaderBtn.addEventListener('click', () => {
            togglePanelBtn.click();
        });
    }

    if (togglePanelBtn) {
        togglePanelBtn.addEventListener('click', () => {
            const isHidden = document.body.classList.toggle('panel-hidden');
            const iconSpan = togglePanelBtn.querySelector('.btn-icon');
            if (isHidden) {
                if (iconSpan) iconSpan.textContent = '⚙️';
                if (togglePanelText) togglePanelText.textContent = '設定';
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
            } else {
                if (iconSpan) iconSpan.textContent = '👁️';
                if (togglePanelText) togglePanelText.textContent = '全画面';
                if (document.exitFullscreen && document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
            }
            if (pixiApp) {
                setTimeout(() => {
                    const nw = viewport.clientWidth  || window.innerWidth;
                    const nh = viewport.clientHeight || window.innerHeight;
                    pixiApp.renderer.resize(nw, nh);
                    if (live2dModel) positionModel();
                }, 100);
            }
        });
    }

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
            if (s.modelScale)      { modelScale = s.modelScale; scaleSlider.value = modelScale; scaleVal.textContent = modelScale.toFixed(2); }
            if (s.offsetX != null) { offsetX = s.offsetX; offsetXSlider.value = offsetX; offsetXVal.textContent = offsetX; }
            if (s.offsetY != null) { offsetY = s.offsetY; offsetYSlider.value = offsetY; offsetYVal.textContent = offsetY; }
            if (s.autoBlink != null)    autoBlinkToggle.checked    = s.autoBlink;
            if (s.idleAnim != null)     idleAnimToggle.checked     = s.idleAnim;
            if (s.cameraPreview != null) cameraPreviewToggle.checked = s.cameraPreview;
            if (s.micSync != null)      micToggle.checked          = s.micSync;
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
        } catch(e) {}
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
                    } catch(er) {}
                }
            };
        } catch(e) {
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
            const view   = new DataView(header);
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
        
        const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
        if (aiHiraganaToggle) {
            const savedAiHiragana = localStorage.getItem('savedAiHiraganaToggle');
            if (savedAiHiragana !== null) {
                aiHiraganaToggle.checked = savedAiHiragana === 'true';
            }
            aiHiraganaToggle.addEventListener('change', () => {
                localStorage.setItem('savedAiHiraganaToggle', aiHiraganaToggle.checked);
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
    }

    let joinedUsers = new Set();
    function removeEmojis(text) {
        if (!text) return text;
        let clean = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
        clean = clean.replace(/:[^:\s]+:/g, '');
        return clean.trim();
    }

    // コメントビューアー用関数
    function addCommentToViewer(nickname, comment, platform, isGift = false) {
        const viewer = document.getElementById('comment-viewer');
        if (!viewer) return;
        
        const el = document.createElement('div');
        el.className = `comment-item ${platform}-comment`;
        if (isGift) el.classList.add('gift-comment');
        
        const icon = platform === 'youtube' ? '🔴' : platform === 'tiktok' ? '🎵' : '💬';
        
        el.innerHTML = `<div class="comment-author">${icon} ${nickname}</div><div class="comment-text">${comment}</div>`;
        viewer.appendChild(el);
        
        // 最新のコメントが見えるようにスクロール
        viewer.scrollTop = viewer.scrollHeight;
        
        // 最大100件まで保持
        while (viewer.children.length > 100) {
            viewer.removeChild(viewer.firstChild);
        }
    }

    if (tiktokConnectBtn) {
        tiktokConnectBtn.addEventListener('click', () => {
            const username = tiktokUserInput.value.trim();
            if (!username) {
                alert('TikTokのユーザー名を入力してください');
                return;
            }
            localStorage.setItem('savedTiktokId', username);

            if (tiktokWs && tiktokWs.readyState === WebSocket.OPEN) {
                tiktokWs.send(JSON.stringify({ type: 'disconnect_tiktok' }));
                tiktokWs.close();
                tiktokWs = null;
                tiktokConnectBtn.textContent = '接続';
                tiktokConnectBtn.style.background = 'var(--primary)';
                tiktokStatus.textContent = '未接続';
                joinedUsers.clear();
                return;
            }

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
                        if (isVoicevoxEnabled) {
                            const cleanName = data.nickname.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
                            if (cleanName.length > 0) {
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                if (joinedUsers.has(cleanName)) {
                                    // 2回目以降の入室（戻ってきた）
                                    let greet = zunda ? `${cleanName}さん、おかえりなさいなのだ！` : `${cleanName}さん、おかえりなさい！`;
                                    greet = adjustIdlePhraseForModel(greet, currentModelId);
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
                                        
                                    fullGreeting = adjustIdlePhraseForModel(fullGreeting, currentModelId);
                                    queueVoicevoxAudio(fullGreeting);
                                }
                            }
                        }
                    } else if (data.type === 'gift') {
                        console.log(`[TikTok] ${data.nickname} sent a gift`);
                        addCommentToViewer(data.nickname, `🎁 ギフトを送りました！`, 'tiktok', true);
                        if (isVoicevoxEnabled) {
                            const cleanName = removeEmojis(data.nickname);
                            if (cleanName.length > 0) {
                                aiEmotion = 'joy';
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                let greet = zunda ? `${cleanName}さん、ギフトありがとうなのだ！` : `${cleanName}さん、ギフトありがとう！`;
                                greet = adjustIdlePhraseForModel(greet, currentModelId);
                                queueVoicevoxAudio(greet);
                            }
                        }
                    } else if (data.type === 'like') {
                        console.log(`[TikTok] ${data.nickname} sent likes`);
                        // いいね連打対策のため読み上げは行わない
                    } else if (data.type === 'comment') {
                        console.log(`[TikTok] @${data.nickname}: ${data.comment}`);
                        addCommentToViewer(data.nickname, data.comment, 'tiktok', false);
                        if (isVoicevoxEnabled) {
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
                                            const adjustedReply = adjustIdlePhraseForModel(matchedRule.response, currentModelId);
                                            queueVoicevoxAudio(adjustedReply);
                                        } else if (Math.random() < 0.20) {
                                            // 3. キーワードに一致しなかった場合、たまに相槌を打つ（20%の確率）
                                            const genericReplies = ["なるほどなるほどー", "たしかにー！", "へぇー！", "そうんだね！", "わかるわかるー"];
                                            const adjustedReply = adjustIdlePhraseForModel(genericReplies[Math.floor(Math.random() * genericReplies.length)], currentModelId);
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
                tiktokStatus.textContent = '未接続';
                tiktokConnectBtn.textContent = '接続';
                tiktokConnectBtn.style.background = 'var(--primary)';
            };

            tiktokWs.onerror = (err) => {
                console.error('TikTok WS error', err);
                tiktokStatus.textContent = '接続エラー';
                if (typeof clearIdleTimer === 'function') clearIdleTimer();
            };
        });

        // 保存されたIDがあれば自動接続
        const savedTiktokId = localStorage.getItem('savedTiktokId');
        if (savedTiktokId && tiktokUserInput) {
            tiktokUserInput.value = savedTiktokId;
            // 少し待ってから自動接続（UIの初期化完了を待つ）
            setTimeout(() => {
                tiktokConnectBtn.click();
            }, 500);
        }
    }

    if (youtubeConnectBtn) {
        youtubeConnectBtn.addEventListener('click', () => {
            const videoId = youtubeUserInput.value.trim();
            if (!videoId) {
                alert('YouTubeの動画IDを入力してください');
                return;
            }
            localStorage.setItem('savedYoutubeId', videoId);

            if (youtubeWs && youtubeWs.readyState === WebSocket.OPEN) {
                youtubeWs.send(JSON.stringify({ type: 'disconnect_youtube' }));
                youtubeWs.close();
                youtubeWs = null;
                youtubeConnectBtn.textContent = '接続';
                youtubeConnectBtn.style.background = '#ff0000';
                youtubeStatus.textContent = '未接続';
                return;
            }

            youtubeStatus.textContent = '接続中...';
            youtubeWs = new WebSocket('ws://localhost:8768');

            youtubeWs.onopen = () => {
                youtubeWs.send(JSON.stringify({ type: 'connect_youtube', video_id: videoId }));
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
                        }
                    } else if (data.type === 'gift') {
                        console.log(`[YouTube SuperChat] ${data.nickname} sent ${data.amount}`);
                        addCommentToViewer(data.nickname, `💰 スーパーチャット: ${data.amount}`, 'youtube', true);
                        if (isVoicevoxEnabled) {
                            const cleanName = removeEmojis(data.nickname);
                            if (cleanName.length > 0) {
                                aiEmotion = 'joy';
                                const zunda = isZundamonSelected() && currentModelId === 'hiyori';
                                let greet = zunda ? `${cleanName}さん、スーパーチャットありがとうなのだ！` : `${cleanName}さん、スーパーチャットありがとう！`;
                                greet = adjustIdlePhraseForModel(greet, currentModelId);
                                queueVoicevoxAudio(greet);
                            }
                        }
                    } else if (data.type === 'comment') {
                        console.log(`[YouTube] @${data.nickname}: ${data.comment}`);
                        addCommentToViewer(data.nickname, data.comment, 'youtube', false);
                        if (isVoicevoxEnabled) {
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
                                            const adjustedReply = adjustIdlePhraseForModel(matchedRule.response, currentModelId);
                                            queueVoicevoxAudio(adjustedReply);
                                        } else if (Math.random() < 0.20) {
                                            const genericReplies = ["なるほどなるほどー", "たしかにー！", "へぇー！", "そうんだね！", "わかるわかるー"];
                                            const adjustedReply = adjustIdlePhraseForModel(genericReplies[Math.floor(Math.random() * genericReplies.length)], currentModelId);
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
                youtubeStatus.textContent = '未接続';
                youtubeConnectBtn.textContent = '接続';
                youtubeConnectBtn.style.background = '#ff0000';
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
        }
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

    function adjustIdlePhraseForModel(phrase, modelId) {
        if (modelId === 'hiyori') {
            return phrase;
        }
        
        if (modelId === 'akari') {
            let newPhrase = phrase;
            newPhrase = newPhrase.replace(/あたし/g, 'わたし');
            newPhrase = newPhrase.replace(/だよ/g, 'ね');
            newPhrase = newPhrase.replace(/だよね/g, 'でしょ');
            newPhrase = newPhrase.replace(/だぞ/g, 'ですよ');
            newPhrase = newPhrase.replace(/だよー/g, 'ですよ〜');
            newPhrase = newPhrase.replace(/かね/g, 'かしら');
            newPhrase = newPhrase.replace(/かな？/g, 'かしら？');
            newPhrase = newPhrase.replace(/ない？/g, 'ないかしら？');
            newPhrase = newPhrase.replace(/の？/g, 'のね？');
            newPhrase = newPhrase.replace(/じゃん/g, 'ですわ');
            return newPhrase;
        }
        
        if (modelId === 'hijiki' || modelId === 'tororo') {
            let newPhrase = phrase;
            newPhrase = newPhrase.replace(/わたし/g, 'ぼく');
            newPhrase = newPhrase.replace(/あたし/g, 'ぼく');
            newPhrase = newPhrase.replace(/ねえねえ/g, 'にゃーにゃー');
            newPhrase = newPhrase.replace(/ねえ/g, 'にゃー');
            newPhrase = newPhrase.replace(/だよ/g, 'にゃ');
            newPhrase = newPhrase.replace(/だよね/g, 'にゃね');
            newPhrase = newPhrase.replace(/だぞ/g, 'にゃぞ');
            newPhrase = newPhrase.replace(/だよー/g, 'にゃー');
            
            // 文末や句読点の手前の「ね」「な」のみ置換
            newPhrase = newPhrase.replace(/ねー(?=[。！!？\?、,…\s]|$)/g, 'にゃー');
            newPhrase = newPhrase.replace(/ね(?=[。！!？\?、,…\s]|$)/g, 'にゃ');
            newPhrase = newPhrase.replace(/なー(?=[。！!？\?、,…\s]|$)/g, 'にゃー');
            newPhrase = newPhrase.replace(/な(?=[。！!？\?、,…\s]|$)/g, 'にゃ');
            
            newPhrase = newPhrase.replace(/([。！!？\?]|ー+)?$/g, (match) => {
                if (!match) return 'にゃ';
                if (match.includes('！') || match.includes('!')) return 'にゃ！';
                if (match.includes('？') || match.includes('?')) return 'にゃ？';
                return 'にゃ' + match;
            });
            return newPhrase;
        }
        
        if (modelId === 'wanko') {
            let newPhrase = phrase;
            newPhrase = newPhrase.replace(/わたし/g, 'ぼく');
            newPhrase = newPhrase.replace(/あたし/g, 'ぼく');
            newPhrase = newPhrase.replace(/ねえねえ/g, 'わんわん');
            newPhrase = newPhrase.replace(/ねえ/g, 'ワン');
            newPhrase = newPhrase.replace(/だよ/g, 'だワン');
            newPhrase = newPhrase.replace(/だよね/g, 'ワンね');
            newPhrase = newPhrase.replace(/だぞ/g, 'ワンぞ');
            newPhrase = newPhrase.replace(/だよー/g, 'ワンー');
            
            // 文末や句読点の手前の「ね」「な」のみ置換
            newPhrase = newPhrase.replace(/ねー(?=[。！!？\?、,…\s]|$)/g, 'ワンー');
            newPhrase = newPhrase.replace(/ね(?=[。！!？\?、,…\s]|$)/g, 'ワン');
            newPhrase = newPhrase.replace(/なー(?=[。！!？\?、,…\s]|$)/g, 'ワンー');
            newPhrase = newPhrase.replace(/な(?=[。！!？\?、,…\s]|$)/g, 'ワン');
            
            newPhrase = newPhrase.replace(/([。！!？\?]|ー+)?$/g, (match) => {
                if (!match) return 'ワン';
                if (match.includes('！') || match.includes('!')) return 'ワン！';
                if (match.includes('？') || match.includes('?')) return 'ワン？';
                return 'ワン' + match;
            });
            return newPhrase;
        }
        
        return phrase;
    }

    function resetIdleTimer() {
        clearIdleTimer();
        
        if (isVoicevoxEnabled && isIdleSpeechEnabled) {
            idleSpeechTimer = setTimeout(() => {
                if (!isVoicevoxPlaying && voicevoxAudioQueue.length === 0 && isVoicevoxEnabled && isIdleSpeechEnabled) {
                    const isZunda = isZundamonSelected() && currentModelId === 'hiyori';
                    let phrase = "";
                    const getValidPhrase = (categoryObj) => {
                        const h = new Date().getHours();
                        let timeCategory = "night";
                        if (h >= 5 && h < 11) timeCategory = "morning";
                        else if (h >= 11 && h < 18) timeCategory = "afternoon";
                        
                        const month = new Date().getMonth() + 1;
                        let seasonCategory = "winter";
                        if (month >= 3 && month <= 5) seasonCategory = "spring";
                        else if (month >= 6 && month <= 8) seasonCategory = "summer";
                        else if (month >= 9 && month <= 11) seasonCategory = "autumn";
                        
                        const availablePhrases = [...categoryObj.general, ...categoryObj[timeCategory]];
                        if (categoryObj[seasonCategory]) {
                            availablePhrases.push(...categoryObj[seasonCategory]);
                        }
                        return availablePhrases[Math.floor(Math.random() * availablePhrases.length)];
                    };

                    if (isZunda) {
                        phrase = Math.random() < 0.15 ? getValidPhrase(ZUNDA_LONG_STORIES) : getValidPhrase(ZUNDA_PHRASES);
                    } else {
                        phrase = Math.random() < 0.15 ? getValidPhrase(NORMAL_LONG_STORIES) : getValidPhrase(NORMAL_PHRASES);
                    }

                    // 感情アニメーションの設定
                    if (phrase.includes("チラッ")) {
                        aiEmotion = 'glance';
                    } else if (phrase.includes("だめだめ") || phrase.includes("ひどくない") || phrase.includes("はずかしかった")) {
                        aiEmotion = 'sad';
                    } else {
                        aiEmotion = 'joy';
                    }

                    // モデルに応じた語尾の調整
                    phrase = adjustIdlePhraseForModel(phrase, currentModelId);
                    
                    console.log(`[独り言] ${phrase}`);
                    
                    // 独り言も会話履歴に追加し、視聴者が独り言に反応した時に文脈が繋がるようにする
                    if (typeof aiChatHistory !== 'undefined') {
                        aiChatHistory.push({ role: 'assistant', content: phrase });
                        if (aiChatHistory.length > 10) aiChatHistory.shift();
                    }

                    queueVoicevoxAudio(phrase);
                }
            }, 5000);
        }
    }

    async function convertToHiraganaWithAI(text) {
        if (!text) return text;
        const aiApiKeyInput = document.getElementById('ai-api-key');
        const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
        if (!apiKey) return text;

        const aiProviderSelect = document.getElementById('ai-provider-select');
        const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';
        
        try {
            if (provider === 'gemini') {
                const aiModelInput = document.getElementById('ai-model-input');
                const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'gemini-1.5-flash';
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: "あなたは読み仮名変換アシスタントです。ユーザーが入力したテキストの漢字をひらがなに変換し、全体をひらがなとカタカナのみの文章として出力してください。元のひらがなやカタカナの部分は不自然に変更・省略しないでください（例: 「そこの君の」→「そこのきみの」）。読点（、）や句点（。）などの句読点は音声の自然な間のために必ず残してください。また、日付や時間など、意味の区切りが良いところには積極的に読点（、）を補って、音声合成が自然な息継ぎをできるようにしてください（例：「8月13日木曜日の9時53分」→「はちがつじゅうさんにち、もくようびの、くじごじゅうさんふん」）。その他の余計な記号や文章は一切含めないでください。" }] },
                        contents: [{ role: 'user', parts: [{ text: text }] }]
                    })
                });
                const json = await res.json();
                if (res.ok && json.candidates && json.candidates.length > 0) {
                    return json.candidates[0].content.parts[0].text.trim().replace(/\s+/g, '');
                }
            } else if (provider === 'openai') {
                const aiModelInput = document.getElementById('ai-model-input');
                const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'gpt-4o-mini';
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: [
                            { role: 'system', content: "あなたは読み仮名変換アシスタントです。ユーザーが入力したテキストの漢字をひらがなに変換し、全体をひらがなとカタカナのみの文章として出力してください。元のひらがなやカタカナの部分は不自然に変更・省略しないでください（例: 「そこの君の」→「そこのきみの」）。読点（、）や句点（。）などの句読点は音声の自然な間のために必ず残してください。また、日付や時間など、意味の区切りが良いところには積極的に読点（、）を補って、音声合成が自然な息継ぎをできるようにしてください（例：「8月13日木曜日の9時53分」→「はちがつじゅうさんにち、もくようびの、くじごじゅうさんふん」）。その他の余計な記号や文章は一切含めないでください。" },
                            { role: 'user', content: text }
                        ],
                        max_tokens: 60,
                        temperature: 0.0
                    })
                });
                const json = await res.json();
                if (res.ok && json.choices && json.choices.length > 0) {
                    return json.choices[0].message.content.trim().replace(/\s+/g, '');
                }
            }
        } catch (e) {
            console.error("AI Hiragana Conversion Error:", e);
        }
        return text;
    }

    async function queueVoicevoxAudio(text, isIdle = false) {
        // スペース（半角・全角）を読点（、）に変換して、VOICEVOXが適切に区切って読めるようにする
        const processedText = text.replace(/[ 　]+/g, '、');
        
        const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
        if (aiHiraganaToggle && aiHiraganaToggle.checked) {
            voicevoxAudioQueue.push({ original: processedText, promise: convertToHiraganaWithAI(processedText), isIdle });
        } else {
            voicevoxAudioQueue.push({ original: processedText, promise: Promise.resolve(processedText), isIdle });
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
                currentVoicevoxSource = null;
                playNextVoicevox();
            };
 
            console.log(`[VOICEVOX] Playing: "${text}" (Speaker ID: ${speakerId})`);
            currentVoicevoxSource.start(0);
 
        } catch (e) {
            console.error('VOICEVOX Error:', e);
            playNextVoicevox(); // Skip to next
        }
    }

    // =====================================================================
    // 画面オーバーレイ (配信準備中 / 離席中)
    // =====================================================================
    const overlayPrepBtn = document.getElementById('overlay-prep-btn');
    const overlayAfkBtn = document.getElementById('overlay-afk-btn');
    const overlayClearBtn = document.getElementById('overlay-clear-btn');
    const streamOverlay = document.getElementById('stream-overlay');

    if (overlayPrepBtn && streamOverlay) {
        overlayPrepBtn.addEventListener('click', () => {
            streamOverlay.textContent = '配信準備中';
            streamOverlay.classList.add('active');
        });
    }
    if (overlayAfkBtn && streamOverlay) {
        overlayAfkBtn.addEventListener('click', () => {
            streamOverlay.textContent = '離席中';
            streamOverlay.classList.add('active');
        });
    }
    if (overlayClearBtn && streamOverlay) {
        overlayClearBtn.addEventListener('click', () => {
            streamOverlay.classList.remove('active');
        });
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
                req.onerror = (e) => reject(e.target.error);
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
            } catch (error) {
                console.error("BGM decode error on restore:", error);
                if (bgmFileName) bgmFileName.textContent = "復元エラー";
            }
        }
    })();

    function stopBgm() {
        if (bgmSource) {
            try { bgmSource.stop(); } catch (e) {}
            bgmSource.disconnect();
            bgmSource = null;
            console.log('[BGM] 停止しました');
        }
        bgmIsPlaying = false;
    }

    if (bgmPlayBtn) {
        bgmPlayBtn.addEventListener('click', async () => {
            if (!bgmBuffer || !bgmAudioContext) {
                console.warn("[BGM] バッファがないかAudioContextが初期化されていません");
                return;
            }
            
            if (bgmAudioContext.state === 'suspended') {
                await bgmAudioContext.resume();
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
        });
    }

    if (bgmStopBtn) {
        bgmStopBtn.addEventListener('click', stopBgm);
    }

    if (bgmVolumeSlider) {
        bgmVolumeSlider.addEventListener('input', () => {
            const vol = parseFloat(bgmVolumeSlider.value);
            bgmVolumeVal.textContent = Math.round(vol);
            localStorage.setItem('savedBgmVolume', vol);
            if (bgmGainNode) {
                bgmGainNode.gain.value = vol / 100.0;
            }
        });
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

    if (bgmLoopStart) bgmLoopStart.addEventListener('change', updateLoopPoints);
    if (bgmLoopEnd) bgmLoopEnd.addEventListener('change', updateLoopPoints);

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
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingWaveform) return;
            updateRangeFromMouse(e, false);
        });
        window.addEventListener('mouseup', () => {
            if (isDraggingWaveform) {
                isDraggingWaveform = false;
                draggingHandle = null;
            }
        });
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
        });
    }

    if (streamDescInput) {
        const savedDesc = localStorage.getItem('savedStreamDesc');
        if (savedDesc) streamDescInput.value = savedDesc;
        streamDescInput.addEventListener('input', () => {
            localStorage.setItem('savedStreamDesc', streamDescInput.value);
        });
    }

    if (generateThumbBtn) {
        generateThumbBtn.addEventListener('click', () => {
            // 1280x720のCanvasを作成
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 1280;
            thumbCanvas.height = 720;
            const ctx = thumbCanvas.getContext('2d');

            // 1. 背景の描画
            const drawBackground = () => {
                return new Promise((resolve) => {
                    const bgDiv = document.getElementById('background-layer');
                    const bgImageStyle = bgDiv ? getComputedStyle(bgDiv).backgroundImage : 'none';
                    if (bgImageStyle && bgImageStyle !== 'none') {
                        // url("...") からURLを抽出
                        const urlMatch = bgImageStyle.match(/url\(['"]?(.*?)['"]?\)/);
                        if (urlMatch && urlMatch[1]) {
                            const img = new Image();
                            img.crossOrigin = 'anonymous'; // 必要に応じて
                            img.onload = () => {
                                // アスペクト比を保ってcover
                                const scale = Math.max(1280 / img.width, 720 / img.height);
                                const x = (1280 - img.width * scale) / 2;
                                const y = (720 - img.height * scale) / 2;
                                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                                resolve();
                            };
                            img.onerror = () => {
                                // エラー時は単色塗りつぶし
                                ctx.fillStyle = '#1a1a2e';
                                ctx.fillRect(0, 0, 1280, 720);
                                resolve();
                            };
                            img.src = urlMatch[1];
                            return;
                        }
                    }
                    // 画像がない場合
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(0, 0, 1280, 720);
                    resolve();
                });
            };

            // 2. アバターとテキストを描画する処理
            const drawContent = () => {
                // Live2Dの描画 (右側に寄せて大きく表示)
                if (pixiApp && pixiApp.view) {
                    const view = pixiApp.view;
                    // アバターのCanvasを縦720pxに合わせてスケール
                    const scale = 720 / view.height;
                    const w = view.width * scale;
                    const h = 720;
                    const x = 1280 - w; // 右寄せ
                    const y = 0;
                    ctx.drawImage(view, x, y, w, h);
                }

                // テキスト描画 (左側)
                const titleText = streamTitleInput ? streamTitleInput.value : '';
                const descText = streamDescInput ? streamDescInput.value : '';

                // 文字の縁取り設定
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;

                // タイトル描画 (折り返し対応・簡易版)
                if (titleText) {
                    ctx.font = 'bold 72px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    const lines = titleText.split('\n'); // ユーザーの改行を尊重
                    let textY = 100;
                    
                    for (let line of lines) {
                        ctx.lineWidth = 12;
                        ctx.strokeStyle = '#000000';
                        ctx.strokeText(line, 80, textY);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(line, 80, textY);
                        textY += 90;
                    }

                    // 概要描画
                    if (descText) {
                        ctx.font = 'bold 40px sans-serif';
                        const descLines = descText.split('\n');
                        textY += 40; // タイトルとの間隔
                        for (let line of descLines) {
                            ctx.lineWidth = 8;
                            ctx.strokeStyle = '#000000';
                            ctx.strokeText(line, 80, textY);
                            ctx.fillStyle = '#f0f0f0';
                            ctx.fillText(line, 80, textY);
                            textY += 60;
                        }
                    }
                }

                // 画像のダウンロード
                const link = document.createElement('a');
                link.download = 'thumbnail.png';
                link.href = thumbCanvas.toDataURL('image/png');
                link.click();
            };

            // 背景描画完了後にコンテンツを描画
            drawBackground().then(drawContent);
        });
    }

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
    loadSettings();
    buildModelGrid();
    initPixi();

    if (isIdleSpeechEnabled && typeof resetIdleTimer === 'function') {
        resetIdleTimer();
    }

    const initialModel = MODELS.find(m => m.id === currentModelId) || MODELS[0];
    loadModel(initialModel);

    if (autoBlinkToggle.checked && !isObsMode) scheduleBlink();
    updateObsUrl();

    // Browser Autoplay Policy: unlock audio context on first user click/touch/keypress
    const audioUnlockBanner = document.getElementById('audio-unlock-banner');
    if (audioUnlockBanner && !isObsMode) {
        audioUnlockBanner.style.display = 'block';
    }

    const unlockAudio = () => {
        if (!voicevoxAudioContext) {
            voicevoxAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (voicevoxAudioContext.state === 'suspended') {
            voicevoxAudioContext.resume().then(() => {
                console.log('[VOICEVOX] AudioContext successfully resumed/unlocked via user interaction! State:', voicevoxAudioContext.state);
                if (audioUnlockBanner) audioUnlockBanner.style.display = 'none';
            }).catch(e => {
                console.error('[VOICEVOX] Failed to resume AudioContext on gesture:', e);
            });
        } else {
            if (audioUnlockBanner) audioUnlockBanner.style.display = 'none';
        }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchend', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
});
