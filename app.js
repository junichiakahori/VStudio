// 簡易2.5Dアバター制御スクリプト (MediaPipe フェイストラッキング対応版)

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const viewport = document.getElementById('avatar-viewport');
    const container = document.getElementById('avatar-container');
    const bgLayer = document.getElementById('background-layer');
    const avatarBase = document.getElementById('avatar-base');
    const leftEye = document.getElementById('left-eye');
    const rightEye = document.getElementById('right-eye');
    const mouthInner = document.querySelector('.mouth-inner');
    const mouthLip = document.querySelector('.mouth-lip');
    const sourceCanvas = document.getElementById('source-canvas');

    // カメラ関連DOM
    const video = document.getElementById('webcam');
    const cameraPreviewContainer = document.getElementById('camera-preview-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // UIコントロール要素
    const avatarSelect = document.getElementById('avatar-select');
    const cameraTrackToggle = document.getElementById('camera-track-toggle');
    const cameraStatus = document.getElementById('camera-status');
    const cameraPreviewToggle = document.getElementById('camera-preview-toggle');
    const micToggle = document.getElementById('mic-sync-toggle');
    const micStatus = document.getElementById('mic-status');
    const autoBlinkToggle = document.getElementById('auto-blink-toggle');
    const showEyesToggle = document.getElementById('show-eyes-toggle');
    const showMouthToggle = document.getElementById('show-mouth-toggle');
    const debugToggle = document.getElementById('debug-toggle');
    const parallaxSlider = document.getElementById('parallax-slider');
    const parallaxVal = document.getElementById('parallax-val');

    // スライダー群と表示バリュー
    const sliders = {
        'eye-y': { el: document.getElementById('eye-y-slider'), valEl: document.getElementById('eye-y-val'), unit: '%', cssVar: '--eye-y' },
        'eye-spacing': { el: document.getElementById('eye-spacing-slider'), valEl: document.getElementById('eye-spacing-val'), unit: '%', cssVar: '--eye-spacing' },
        'eye-size': { el: document.getElementById('eye-size-slider'), valEl: document.getElementById('eye-size-val'), unit: '%', cssVar: '--eye-size' },
        'mouth-y': { el: document.getElementById('mouth-y-slider'), valEl: document.getElementById('mouth-y-val'), unit: '%', cssVar: '--mouth-y' },
        'mouth-size': { el: document.getElementById('mouth-size-slider'), valEl: document.getElementById('mouth-size-val'), unit: '%', cssVar: '--mouth-size' }
    };

    const resetBtn = document.getElementById('reset-settings-btn');
    const chromaThresholdSlider = document.getElementById('chroma-threshold-slider');
    const chromaThresholdVal = document.getElementById('chroma-threshold-val');

    // OBS URLコピー関連
    const obsUrlInput = document.getElementById('obs-url-input');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const greenUrlInput = document.getElementById('green-url-input');
    const copyGreenBtn = document.getElementById('copy-green-btn');

    // 内部状態変数
    let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let parallaxIntensity = 15;
    let chromaThreshold = 240;
    let currentAvatar = 'girl'; // 'girl' or 'teacher'
    
    // OBS配信設定
    let isObsMode = false;
    let isGreenMode = false;
    
    // オーディオ状態
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    
    // カメラとMediaPipe状態
    let faceLandmarker = null;
    let webcamStream = null;
    let lastVideoTime = -1;
    let isCameraActive = false;
    let isFaceDetected = false;
    
    // 自動瞬き状態
    let isBlinking = false;
    let blinkTimer = null;

    // リモート同期用状態
    const syncChannel = new BroadcastChannel('avatar-sync');
    let lastReceivedSyncTime = 0;
    let wasSyncActive = false;
    let currentMouthVolume = 0;

    // デフォルト値の定義
    const defaultSettings = {
        'girl': {
            'eye-y': 25.5,
            'eye-spacing': 5.5,
            'eye-size': 4.5,
            'mouth-y': 31.2,
            'mouth-size': 3.5
        },
        'teacher': {
            'eye-y': 22.0,
            'eye-spacing': 3.5,
            'eye-size': 3.0,
            'mouth-y': 26.5,
            'mouth-size': 2.0
        },
        'parallax': 15,
        'auto-blink': true,
        'mic-sync': false,
        'camera-track': false,
        'camera-preview': false,
        'show-eyes': true,
        'show-mouth': true,
        'chroma-threshold': 240,
        'avatar': 'girl'
    };

    // 1. 画像アセットの白背景を透過する処理
    function processAvatarImage(threshold = 245) {
        const img = new Image();
        // 選択されたアバター画像パスを動的に指定
        img.src = currentAvatar === 'teacher' ? 'assets/teacher.png' : 'assets/girl.png';
        img.onload = () => {
            const ctx = sourceCanvas.getContext('2d');
            sourceCanvas.width = img.naturalWidth;
            sourceCanvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
            const data = imgData.data;

            // 白背景の透過処理（しきい値から255にかけてアルファ値を滑らかに下げる）
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];

                // 輝度（白さ）の平均値
                const brightness = (r + g + b) / 3;
                if (brightness >= threshold) {
                    const diff = brightness - threshold;
                    const range = 255 - threshold;
                    const alphaFactor = range > 0 ? (1 - diff / range) : 0;
                    
                    data[i+3] = Math.round(data[i+3] * alphaFactor);
                }
            }

            ctx.putImageData(imgData, 0, 0);
            avatarBase.style.backgroundImage = `url('${sourceCanvas.toDataURL()}')`;
        };
    }

    let lastMouseMoveTime = Date.now();
    let idleGaze = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // 2. パララックス（マウス追従）ロジック
    window.addEventListener('mousemove', (e) => {
        lastMouseMoveTime = Date.now();
        // カメラトラッキング中はマウス入力を無視する
        if (isCameraActive) return;

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        mouse.targetX = (e.clientX - cx) / cx;
        mouse.targetY = (e.clientY - cy) / cy;
    });

    window.addEventListener('touchmove', (e) => {
        lastMouseMoveTime = Date.now();
        if (isCameraActive) return;
        if (e.touches.length > 0) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            mouse.targetX = (e.touches[0].clientX - cx) / cx;
            mouse.targetY = (e.touches[0].clientY - cy) / cy;
        }
    });

    // アニメーションループ (補間をかけて滑らかに動かす)
    function updateCoordinates() {
        const now = Date.now();
        const isSyncActive = isObsMode && (now - lastReceivedSyncTime < 2000);
        
        if (isSyncActive) {
            // リモート同期が有効な場合は待機モーションを上書きしない
        } else {
            // カメラが非アクティブ、またはカメラがアクティブでも顔が検出されていない場合で、かつマウス操作が3秒以上ない、またはOBSモードの場合は自動待機モーションを適用
            const noActiveTracking = !isCameraActive || !isFaceDetected;
            if (noActiveTracking && ((now - lastMouseMoveTime > 3000) || isObsMode)) {
                // 呼吸のシミュレーション（ゆっくり上下に揺れる）
                const breathingX = Math.sin(now * 0.001) * 0.03;
                const breathingY = (Math.cos(now * 0.0015) * 0.02) + 0.02; // 微小な上下動

                // ランダムに視線/首の向きを変える（ときどき周りを見渡す）
                if (Math.random() < 0.003) {
                    idleGaze.targetX = (Math.random() - 0.5) * 0.3;
                    idleGaze.targetY = (Math.random() - 0.5) * 0.2;
                }
                // 視線移動に補間をかける
                idleGaze.x += (idleGaze.targetX - idleGaze.x) * 0.02;
                idleGaze.y += (idleGaze.targetY - idleGaze.y) * 0.02;

                mouse.targetX = breathingX + idleGaze.x;
                mouse.targetY = breathingY + idleGaze.y;
            }
        }

        const ease = 0.08;
        mouse.x += (mouse.targetX - mouse.x) * ease;
        mouse.y += (mouse.targetY - mouse.y) * ease;

        // パララックス強度を適用してCSS変数に反映
        // intensity=15 を基準に移動幅をスケール
        const factor = parallaxIntensity / 15;
        document.documentElement.style.setProperty('--mx', (mouse.x * factor).toFixed(4));
        document.documentElement.style.setProperty('--my', (mouse.y * factor).toFixed(4));

        // 送信側の場合は現在の状態をブロードキャストする
        if (!isObsMode && syncChannel) {
            syncChannel.postMessage({
                type: 'avatar-state',
                targetX: mouse.targetX,
                targetY: mouse.targetY,
                blinkLeft: leftEye.classList.contains('blinking'),
                blinkRight: rightEye.classList.contains('blinking'),
                mouthVolume: currentMouthVolume,
                currentAvatar: currentAvatar,
                settings: {
                    'eye-y': sliders['eye-y'].el.value,
                    'eye-spacing': sliders['eye-spacing'].el.value,
                    'eye-size': sliders['eye-size'].el.value,
                    'mouth-y': sliders['mouth-y'].el.value,
                    'mouth-size': sliders['mouth-size'].el.value,
                    'show-eyes': showEyesToggle.checked,
                    'show-mouth': showMouthToggle.checked,
                    'chroma-threshold': chromaThresholdSlider.value,
                    'parallax': parallaxSlider.value
                }
            });
        }

        // リモート同期が終了した瞬間に口と目を閉じる
        if (!isSyncActive && isObsMode && wasSyncActive) {
            updateMouthShape(0);
            leftEye.classList.remove('blinking');
            rightEye.classList.remove('blinking');
        }
        wasSyncActive = isSyncActive;

        requestAnimationFrame(updateCoordinates);
    }
    requestAnimationFrame(updateCoordinates);

    // 3. 自動目パチ（瞬き）アニメーション (カメラOFF、またはカメラ起動中でも顔未検出時に機能)
    function blink() {
        const now = Date.now();
        const isSyncActive = isObsMode && (now - lastReceivedSyncTime < 2000);
        if (isBlinking || !autoBlinkToggle.checked || (isCameraActive && isFaceDetected) || isSyncActive) return;
        isBlinking = true;

        leftEye.classList.add('blinking');
        rightEye.classList.add('blinking');

        setTimeout(() => {
            leftEye.classList.remove('blinking');
            rightEye.classList.remove('blinking');
            isBlinking = false;
            scheduleNextBlink();
        }, 110);
    }

    function scheduleNextBlink() {
        if (blinkTimer) clearTimeout(blinkTimer);
        const now = Date.now();
        const isSyncActive = isObsMode && (now - lastReceivedSyncTime < 2000);
        if ((isCameraActive && isFaceDetected) || isSyncActive) return;
        const nextTime = 2000 + Math.random() * 4000;
        blinkTimer = setTimeout(blink, nextTime);
    }

    // 4. 口の開閉パスの変更処理
    // volume (0: 閉じている 〜 1: 全開)
    function updateMouthShape(volume) {
        const v = Math.min(Math.max(volume, 0), 1);
        currentMouthVolume = v;
        
        // 閉じ口(直線)から開き口(縦長楕円)への変形
        const topY = 50 - (v * 28);
        const bottomY = 50 + (v * 38);
        
        const innerPath = `M 10 50 Q 50 ${bottomY} 90 50 Q 50 ${topY} 10 50 Z`;
        const lipPath = `M 10 50 Q 50 ${50 + (v * 12)} 90 50`;

        mouthInner.setAttribute('d', innerPath);
        mouthLip.setAttribute('d', lipPath);
    }

    // 5. マイク入力連動
    async function initMicrophone() {
        try {
            // カメラトラッキング中はマイク口パクは自動的に無効化する
            if (isCameraActive) {
                micToggle.checked = false;
                micStatus.textContent = "カメラ優先中";
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            microphone.connect(analyser);
            micStatus.textContent = "接続中";
            micStatus.classList.add('active');

            function processAudio() {
                if (!micToggle.checked || isCameraActive) {
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                    micStatus.textContent = "マイク無効";
                    micStatus.classList.remove('active');
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                let values = 0;
                for (let i = 0; i < bufferLength; i++) {
                    values += dataArray[i];
                }
                const average = values / bufferLength;
                const volume = Math.min(Math.max((average - 12) / 50, 0), 1);
                updateMouthShape(volume);

                requestAnimationFrame(processAudio);
            }
            processAudio();

        } catch (err) {
            console.error('マイクの取得に失敗しました:', err);
            micStatus.textContent = "許可エラー";
            micStatus.classList.remove('active');
            micToggle.checked = false;
        }
    }

    micToggle.addEventListener('change', () => {
        if (micToggle.checked) {
            initMicrophone();
        } else {
            if (audioContext) audioContext.close();
            micStatus.textContent = "マイク無効";
            micStatus.classList.remove('active');
            updateMouthShape(0);
        }
        saveSettings();
    });

    // 6. MediaPipe Face Landmarker の統合
    async function initFaceLandmarker() {
        if (faceLandmarker) return;

        loadingOverlay.classList.add('visible');
        loadingText.textContent = "AI認識モデルを読み込み中...";

        try {
            // 動的インポートによりMediaPipeをロード
            const vision = await import(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs"
            );
            
            const FilesetResolver = vision.FilesetResolver;
            const FaceLandmarker = vision.FaceLandmarker;

            const visionInstance = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
            );
            
            faceLandmarker = await FaceLandmarker.createFromOptions(visionInstance, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            
            loadingOverlay.classList.remove('visible');
        } catch (err) {
            console.error("MediaPipeの初期化に失敗しました:", err);
            loadingText.textContent = "モデルの読み込みに失敗しました。再読み込みしてください。";
            cameraTrackToggle.checked = false;
            cameraStatus.textContent = "エラー";
            setTimeout(() => loadingOverlay.classList.remove('visible'), 3000);
        }
    }

    // カメラの起動とトラッキングループ
    async function startCameraTracking() {
        await initFaceLandmarker();
        if (!faceLandmarker) return;

        cameraStatus.textContent = "起動中...";

        // マイク口パクがオンなら一時オフにする
        if (micToggle.checked) {
            micToggle.checked = false;
            if (audioContext) audioContext.close();
            micStatus.textContent = "カメラ優先中";
            micStatus.classList.remove('active');
        }

        try {
            const constraints = {
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false
            };
            webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = webcamStream;
            video.addEventListener('loadeddata', predictWebcamLoop);

            isCameraActive = true;
            cameraStatus.textContent = "トラッキング中";
            cameraStatus.classList.add('active');
            
            // プレビューの表示状態をトグルに合わせる
            updateCameraPreviewVisibility();

        } catch (err) {
            console.error("カメラの起動に失敗しました:", err);
            cameraStatus.textContent = "許可エラー";
            cameraStatus.classList.remove('active');
            cameraTrackToggle.checked = false;
            
            // 自動瞬きをフォールバック起動
            if (autoBlinkToggle.checked) {
                scheduleNextBlink();
            }
        }
    }

    function stopCameraTracking() {
        isCameraActive = false;
        cameraStatus.textContent = "カメラ無効";
        cameraStatus.classList.remove('active');

        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        video.srcObject = null;
        
        // パララックス位置をリセット
        mouse.targetX = 0;
        mouse.targetY = 0;

        // 表情をリセット
        leftEye.classList.remove('blinking');
        rightEye.classList.remove('blinking');
        updateMouthShape(0);

        // プレビューを非表示
        cameraPreviewContainer.classList.remove('visible');

        // 自動瞬きを再開
        if (autoBlinkToggle.checked) {
            scheduleNextBlink();
        }
    }

    // カメラ検出ループ
    async function predictWebcamLoop() {
        if (!isCameraActive || !faceLandmarker) return;

        let nowInMs = Date.now();
        if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            
            const startTimeMs = performance.now();
            const detections = faceLandmarker.detectForVideo(video, nowInMs);

            if (detections.faceLandmarks && detections.faceLandmarks.length > 0) {
                // 顔を検出した場合
                if (!isFaceDetected) {
                    isFaceDetected = true;
                    if (blinkTimer) {
                        clearTimeout(blinkTimer);
                        blinkTimer = null;
                    }
                }

                const landmarks = detections.faceLandmarks[0];
                const blendshapes = detections.faceBlendshapes[0].categories;

                // 1. 顔の傾き（ヨウ / ピッチ）の計算
                // 鼻の先端 (Landmark 4)
                const nose = landmarks[4];
                // 顔の左端 (Landmark 234) と右端 (Landmark 454)
                const faceLeft = landmarks[234];
                const faceRight = landmarks[454];
                // 額 (Landmark 10) と顎 (Landmark 152)
                const forehead = landmarks[10];
                const chin = landmarks[152];

                // 左右の首振り (Yaw): 鼻が顔の左右端に対してどれだけ中央からずれているか
                const leftDist = Math.hypot(nose.x - faceLeft.x, nose.y - faceLeft.y);
                const rightDist = Math.hypot(nose.x - faceRight.x, nose.y - faceRight.y);
                // -1.0 〜 1.0 にマッピング
                const yaw = (leftDist - rightDist) / (leftDist + rightDist) * 3.5;

                // 上下の首振り (Pitch): 鼻が額と顎に対してどれだけ中央からずれているか
                const topDist = Math.hypot(nose.x - forehead.x, nose.y - forehead.y);
                const bottomDist = Math.hypot(nose.x - chin.x, nose.y - chin.y);
                // -1.0 〜 1.0 にマッピング (下方向の調整のため係数を乗算)
                const pitch = (topDist - bottomDist) / (topDist + bottomDist) * 3.5 + 0.15;

                // ターゲット座標を更新
                mouse.targetX = -yaw; // カメラ反転用
                mouse.targetY = pitch;

                // 2. 左右独立の瞬き同期 (ウィンク対応)
                // blendshapes から瞬きスコアを取得 (通常 0:全開 〜 1:全閉)
                const blinkLeftScore = getBlendshapeValue(blendshapes, 'eyeBlinkLeft');
                const blinkRightScore = getBlendshapeValue(blendshapes, 'eyeBlinkRight');

                // 閾値を超えたら瞬き状態にする (0.45 程度)
                const blinkThreshold = 0.45;
                if (blinkLeftScore > blinkThreshold) {
                    leftEye.classList.add('blinking');
                } else {
                    leftEye.classList.remove('blinking');
                }

                if (blinkRightScore > blinkThreshold) {
                    rightEye.classList.add('blinking');
                } else {
                    rightEye.classList.remove('blinking');
                }

                // 3. 口パク同期
                // jawOpen (顎の開き) を取得
                const jawOpenScore = getBlendshapeValue(blendshapes, 'jawOpen');
                // 0.05〜0.45の範囲を0.0〜1.0にスケール
                const mouthVolume = Math.min(Math.max((jawOpenScore - 0.05) / 0.4, 0), 1);
                updateMouthShape(mouthVolume);
            } else {
                // 顔を見失った場合
                if (isFaceDetected) {
                    isFaceDetected = false;
                    // 表情をリセット
                    leftEye.classList.remove('blinking');
                    rightEye.classList.remove('blinking');
                    updateMouthShape(0);
                    // 自動瞬きを再開
                    if (autoBlinkToggle.checked) {
                        scheduleNextBlink();
                    }
                }
            }
        }

        // ループを回す
        requestAnimationFrame(predictWebcamLoop);
    }

    // ブレンドシェイプの特定カテゴリの数値を取得するヘルパー
    function getBlendshapeValue(blendshapes, name) {
        const category = blendshapes.find(c => c.categoryName === name);
        return category ? category.score : 0;
    }

    // プレビューの表示状態の更新
    function updateCameraPreviewVisibility() {
        if (isCameraActive && cameraPreviewToggle.checked) {
            cameraPreviewContainer.classList.add('visible');
        } else {
            cameraPreviewContainer.classList.remove('visible');
        }
    }

    cameraTrackToggle.addEventListener('change', () => {
        if (cameraTrackToggle.checked) {
            startCameraTracking();
        } else {
            stopCameraTracking();
        }
        saveSettings();
    });

    cameraPreviewToggle.addEventListener('change', () => {
        updateCameraPreviewVisibility();
        saveSettings();
    });

    // 7. 設定の反映と保存
    function setSliderValue(key, value) {
        const slider = sliders[key];
        slider.el.value = value;
        slider.valEl.textContent = value + slider.unit;
        document.documentElement.style.setProperty(slider.cssVar, value + slider.unit);
    }

    Object.keys(sliders).forEach(key => {
        const slider = sliders[key];
        slider.el.addEventListener('input', (e) => {
            const val = e.target.value;
            slider.valEl.textContent = val + slider.unit;
            document.documentElement.style.setProperty(slider.cssVar, val + slider.unit);
            saveSettings();
        });
    });

    parallaxSlider.addEventListener('input', (e) => {
        parallaxIntensity = e.target.value;
        parallaxVal.textContent = parallaxIntensity;
        saveSettings();
    });

    autoBlinkToggle.addEventListener('change', () => {
        if (autoBlinkToggle.checked && !isCameraActive) {
            scheduleNextBlink();
        } else {
            if (blinkTimer) clearTimeout(blinkTimer);
        }
        saveSettings();
    });

    debugToggle.addEventListener('change', () => {
        if (debugToggle.checked) {
            document.body.classList.add('debug-mode');
        } else {
            document.body.classList.remove('debug-mode');
        }
    });

    // 表示トグルのチェンジイベント
    showEyesToggle.addEventListener('change', () => {
        document.body.classList.toggle('hide-eyes', !showEyesToggle.checked);
        saveSettings();
    });

    showMouthToggle.addEventListener('change', () => {
        document.body.classList.toggle('hide-mouth', !showMouthToggle.checked);
        saveSettings();
    });

    function saveSettings() {
        let settings = {};
        const saved = localStorage.getItem('web25d_avatar_settings');
        if (saved) {
            try {
                settings = JSON.parse(saved);
            } catch (e) {}
        }
        
        if (!settings.girl) settings.girl = {};
        if (!settings.teacher) settings.teacher = {};
        
        settings[currentAvatar] = {
            'eye-y': sliders['eye-y'].el.value,
            'eye-spacing': sliders['eye-spacing'].el.value,
            'eye-size': sliders['eye-size'].el.value,
            'mouth-y': sliders['mouth-y'].el.value,
            'mouth-size': sliders['mouth-size'].el.value
        };
        
        settings['parallax'] = parallaxSlider.value;
        settings['auto-blink'] = autoBlinkToggle.checked;
        settings['mic-sync'] = micToggle.checked;
        settings['camera-track'] = cameraTrackToggle.checked;
        settings['camera-preview'] = cameraPreviewToggle.checked;
        settings['show-eyes'] = showEyesToggle.checked;
        settings['show-mouth'] = showMouthToggle.checked;
        settings['chroma-threshold'] = chromaThresholdSlider.value;
        settings['avatar'] = currentAvatar;
        
        localStorage.setItem('web25d_avatar_settings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('web25d_avatar_settings');
        let settings = {};
        if (saved) {
            try {
                settings = JSON.parse(saved);
            } catch (e) {
                console.error("設定のロードに失敗しました:", e);
            }
        }
        
        currentAvatar = settings['avatar'] || defaultSettings['avatar'];
        
        const urlParams = new URLSearchParams(window.location.search);
        const paramAvatar = urlParams.get('avatar');
        if (paramAvatar === 'girl' || paramAvatar === 'teacher') {
            currentAvatar = paramAvatar;
        }
        avatarSelect.value = currentAvatar;
        
        const avatarSettings = settings[currentAvatar] || {};
        const avatarDefaults = defaultSettings[currentAvatar];
        
        setSliderValue('eye-y', avatarSettings['eye-y'] || avatarDefaults['eye-y']);
        setSliderValue('eye-spacing', avatarSettings['eye-spacing'] || avatarDefaults['eye-spacing']);
        setSliderValue('eye-size', avatarSettings['eye-size'] || avatarDefaults['eye-size']);
        setSliderValue('mouth-y', avatarSettings['mouth-y'] || avatarDefaults['mouth-y']);
        setSliderValue('mouth-size', avatarSettings['mouth-size'] || avatarDefaults['mouth-size']);
        
        parallaxIntensity = settings['parallax'] !== undefined ? settings['parallax'] : defaultSettings['parallax'];
        parallaxSlider.value = parallaxIntensity;
        parallaxVal.textContent = parallaxIntensity;
        
        chromaThreshold = settings['chroma-threshold'] !== undefined ? parseInt(settings['chroma-threshold']) : defaultSettings['chroma-threshold'];
        const paramThreshold = urlParams.get('threshold');
        if (paramThreshold !== null) {
            const parsed = parseInt(paramThreshold);
            if (!isNaN(parsed) && parsed >= 200 && parsed <= 255) {
                chromaThreshold = parsed;
            }
        }
        if (chromaThresholdSlider) {
            chromaThresholdSlider.value = chromaThreshold;
            chromaThresholdVal.textContent = chromaThreshold;
        }

        autoBlinkToggle.checked = settings['auto-blink'] !== undefined ? settings['auto-blink'] : defaultSettings['auto-blink'];
        cameraPreviewToggle.checked = settings['camera-preview'] !== undefined ? settings['camera-preview'] : defaultSettings['camera-preview'];
        
        showEyesToggle.checked = settings['show-eyes'] !== undefined ? settings['show-eyes'] : defaultSettings['show-eyes'];
        showMouthToggle.checked = settings['show-mouth'] !== undefined ? settings['show-mouth'] : defaultSettings['show-mouth'];
        
        document.body.classList.toggle('hide-eyes', !showEyesToggle.checked);
        document.body.classList.toggle('hide-mouth', !showMouthToggle.checked);

        // カメラ自動連動
        cameraTrackToggle.checked = settings['camera-track'] || false;
        if (isObsMode) {
            cameraTrackToggle.checked = false; // OBS内では直接カメラを起動しない
        }
        
        if (cameraTrackToggle.checked && !isObsMode) {
            startCameraTracking();
        } else {
            if (!isObsMode) {
                micToggle.checked = settings['mic-sync'] || false;
                if (micToggle.checked) {
                    initMicrophone();
                }
            }
        }
    }

    function loadDefaults() {
        const avatarDefaults = defaultSettings[currentAvatar];
        
        setSliderValue('eye-y', avatarDefaults['eye-y']);
        setSliderValue('eye-spacing', avatarDefaults['eye-spacing']);
        setSliderValue('eye-size', avatarDefaults['eye-size']);
        setSliderValue('mouth-y', avatarDefaults['mouth-y']);
        setSliderValue('mouth-size', avatarDefaults['mouth-size']);
        
        parallaxIntensity = defaultSettings['parallax'];
        parallaxSlider.value = parallaxIntensity;
        parallaxVal.textContent = parallaxIntensity;
        
        chromaThreshold = defaultSettings['chroma-threshold'];
        if (chromaThresholdSlider) {
            chromaThresholdSlider.value = chromaThreshold;
            chromaThresholdVal.textContent = chromaThreshold;
        }
        
        autoBlinkToggle.checked = defaultSettings['auto-blink'];
        micToggle.checked = defaultSettings['mic-sync'];
        cameraTrackToggle.checked = defaultSettings['camera-track'];
        cameraPreviewToggle.checked = defaultSettings['camera-preview'];
        
        showEyesToggle.checked = defaultSettings['show-eyes'];
        showMouthToggle.checked = defaultSettings['show-mouth'];
        document.body.classList.remove('hide-eyes', 'hide-mouth');
        
        updateMouthShape(0);
    }

    resetBtn.addEventListener('click', () => {
        loadDefaults();
        saveSettings();
        processAvatarImage(chromaThreshold);
        updateUrls();
        if (debugToggle.checked) {
            debugToggle.checked = false;
            document.body.classList.remove('debug-mode');
        }
        if (isCameraActive) {
            stopCameraTracking();
        }
    });

    chromaThresholdSlider.addEventListener('input', (e) => {
        chromaThreshold = parseInt(e.target.value);
        chromaThresholdVal.textContent = chromaThreshold;
        processAvatarImage(chromaThreshold);
        updateUrls();
        saveSettings();
    });

    avatarSelect.addEventListener('change', () => {
        currentAvatar = avatarSelect.value;
        
        // アバター個別の設定値をロードして反映
        const saved = localStorage.getItem('web25d_avatar_settings');
        let settings = {};
        if (saved) {
            try { settings = JSON.parse(saved); } catch (e) {}
        }
        const avatarSettings = settings[currentAvatar] || {};
        const avatarDefaults = defaultSettings[currentAvatar];
        
        setSliderValue('eye-y', avatarSettings['eye-y'] || avatarDefaults['eye-y']);
        setSliderValue('eye-spacing', avatarSettings['eye-spacing'] || avatarDefaults['eye-spacing']);
        setSliderValue('eye-size', avatarSettings['eye-size'] || avatarDefaults['eye-size']);
        setSliderValue('mouth-y', avatarSettings['mouth-y'] || avatarDefaults['mouth-y']);
        setSliderValue('mouth-size', avatarSettings['mouth-size'] || avatarDefaults['mouth-size']);
        
        processAvatarImage(chromaThreshold);
        updateUrls();
        saveSettings();
    });

    // URLの更新処理
    function updateUrls() {
        const thresholdVal = chromaThresholdSlider ? chromaThresholdSlider.value : chromaThreshold;
        let suffix = '&avatar=' + currentAvatar + '&threshold=' + thresholdVal;
        
        // 目・口オーバーレイが非表示設定の場合はパラメータに記録
        if (showEyesToggle && !showEyesToggle.checked) suffix += '&show-eyes=false';
        if (showMouthToggle && !showMouthToggle.checked) suffix += '&show-mouth=false';
        
        if (obsUrlInput) {
            obsUrlInput.value = window.location.origin + window.location.pathname + '?obs=true' + suffix;
        }
        if (greenUrlInput) {
            greenUrlInput.value = window.location.origin + window.location.pathname + '?obs=true&green=true' + suffix;
        }
    }

    // OBS配信用URLのセットアップとコピー機能
    if (obsUrlInput && copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => {
            obsUrlInput.select();
            navigator.clipboard.writeText(obsUrlInput.value)
                .then(() => {
                    copyUrlBtn.textContent = 'コピー完了';
                    copyUrlBtn.style.background = '#00ff66';
                    setTimeout(() => {
                        copyUrlBtn.textContent = 'コピー';
                        copyUrlBtn.style.background = '';
                    }, 1500);
                })
                .catch(err => {
                    console.error('URLのコピーに失敗しました:', err);
                });
        });
    }

    // グリーンバックURLのセットアップとコピー機能
    if (greenUrlInput && copyGreenBtn) {
        copyGreenBtn.addEventListener('click', () => {
            greenUrlInput.select();
            navigator.clipboard.writeText(greenUrlInput.value)
                .then(() => {
                    copyGreenBtn.textContent = 'コピー完了';
                    copyGreenBtn.style.background = '#00ff66';
                    setTimeout(() => {
                        copyGreenBtn.textContent = 'コピー';
                        copyGreenBtn.style.background = '';
                    }, 1500);
                })
                .catch(err => {
                    console.error('URLのコピーに失敗しました:', err);
                });
        });
    }

    // 8. アプリの初期化
    loadSettings();

    // OBS配信モードのチェックと適用（URLパラメータの解析）
    const urlParams = new URLSearchParams(window.location.search);
    isObsMode = urlParams.has('obs') || urlParams.get('mode') === 'obs';
    isGreenMode = urlParams.has('green') || urlParams.get('bg') === 'green';
    const paramAvatar = urlParams.get('avatar');
    const paramThreshold = urlParams.get('threshold');
    const paramShowEyes = urlParams.get('show-eyes');
    const paramShowMouth = urlParams.get('show-mouth');

    // URLパラメータによるアバター指定のオーバーライド
    if (paramAvatar === 'girl' || paramAvatar === 'teacher') {
        currentAvatar = paramAvatar;
        avatarSelect.value = currentAvatar;
    }

    // URLパラメータによるしきい値のオーバーライド
    if (paramThreshold !== null) {
        const parsed = parseInt(paramThreshold);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 255) {
            chromaThreshold = parsed;
            if (chromaThresholdSlider) {
                chromaThresholdSlider.value = chromaThreshold;
                chromaThresholdVal.textContent = chromaThreshold;
            }
        }
    }

    // URLパラメータによるパーツ重ね合わせ表示制御のオーバーライド
    if (paramShowEyes === 'false') {
        showEyesToggle.checked = false;
        document.body.classList.add('hide-eyes');
    } else if (paramShowEyes === 'true') {
        showEyesToggle.checked = true;
        document.body.classList.remove('hide-eyes');
    }

    if (paramShowMouth === 'false') {
        showMouthToggle.checked = false;
        document.body.classList.add('hide-mouth');
    } else if (paramShowMouth === 'true') {
        showMouthToggle.checked = true;
        document.body.classList.remove('hide-mouth');
    }

    updateUrls();
    processAvatarImage(chromaThreshold);
    
    if (isObsMode) {
        document.body.classList.add('obs-mode');
        if (isGreenMode) {
            document.body.classList.add('green-mode');
        }
        
        // OBSモードではカメラトラッキングやマイク入力を直接行わず、BroadcastChannel経由のリモート同期を受信します。
        if (syncChannel) {
            syncChannel.addEventListener('message', (event) => {
                const data = event.data;
                if (data && data.type === 'avatar-state') {
                    lastReceivedSyncTime = Date.now();

                    // ターゲット座標の更新
                    mouse.targetX = data.targetX;
                    mouse.targetY = data.targetY;

                    // 瞬き状態の更新
                    if (data.blinkLeft) {
                        leftEye.classList.add('blinking');
                    } else {
                        leftEye.classList.remove('blinking');
                    }
                    if (data.blinkRight) {
                        rightEye.classList.add('blinking');
                    } else {
                        rightEye.classList.remove('blinking');
                    }

                    // 口パク状態の更新
                    updateMouthShape(data.mouthVolume);

                    // 現在のアバターが異なる場合は切り替える
                    if (currentAvatar !== data.currentAvatar) {
                        currentAvatar = data.currentAvatar;
                        if (avatarSelect) avatarSelect.value = currentAvatar;
                        processAvatarImage(chromaThreshold);
                    }

                    // アバターの微調整値（スライダー値）とパーツ非表示設定をリアルタイムに同期
                    if (data.settings) {
                        document.documentElement.style.setProperty('--eye-y', data.settings['eye-y'] + '%');
                        document.documentElement.style.setProperty('--eye-spacing', data.settings['eye-spacing'] + '%');
                        document.documentElement.style.setProperty('--eye-size', data.settings['eye-size'] + '%');
                        document.documentElement.style.setProperty('--mouth-y', data.settings['mouth-y'] + '%');
                        document.documentElement.style.setProperty('--mouth-size', data.settings['mouth-size'] + '%');
                        
                        document.body.classList.toggle('hide-eyes', !data.settings['show-eyes']);
                        document.body.classList.toggle('hide-mouth', !data.settings['show-mouth']);

                        const newThreshold = parseInt(data.settings['chroma-threshold']);
                        if (chromaThreshold !== newThreshold) {
                            chromaThreshold = newThreshold;
                            processAvatarImage(chromaThreshold);
                        }

                        parallaxIntensity = parseFloat(data.settings['parallax']);
                    }
                }
            });
        }
    }

    // カメラがオフまたは起動に失敗した場合でも自動目パチのループを開始
    if (autoBlinkToggle.checked && !isCameraActive) {
        scheduleNextBlink();
    }
});
