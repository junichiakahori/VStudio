// js/thumbnail-editor.js: 独立ウィンドウ用 サムネイルエディタ専任モジュール

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("thumb-preview-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // DOM要素
  const sizeSelect = document.getElementById("thumb-size-select");
  const sizeBadge = document.getElementById("canvas-size-badge");
  const ratioText = document.getElementById("canvas-ratio-text");

  const showBg = document.getElementById("thumb-show-bg");
  const showAvatar = document.getElementById("thumb-show-avatar");
  const showTitle = document.getElementById("thumb-show-title");
  const showDesc = document.getElementById("thumb-show-desc");

  const aiBgPrompt = document.getElementById("thumb-ai-bg-prompt");
  const aiBgBtn = document.getElementById("thumb-ai-bg-generate-btn");
  const aiBgStatus = document.getElementById("thumb-ai-bg-status");

  const avatarScale = document.getElementById("thumb-avatar-scale");
  const avatarX = document.getElementById("thumb-avatar-x");
  const avatarY = document.getElementById("thumb-avatar-y");
  const recaptureBtn = document.getElementById("thumb-recapture-btn");

  const editTitle = document.getElementById("thumb-edit-title");
  const titleColor = document.getElementById("thumb-title-color");
  const titleStroke = document.getElementById("thumb-title-stroke");
  const titleSize = document.getElementById("thumb-title-size");
  const titleX = document.getElementById("thumb-title-x");
  const titleY = document.getElementById("thumb-title-y");

  const editDesc = document.getElementById("thumb-edit-desc");
  const descColor = document.getElementById("thumb-desc-color");
  const descStroke = document.getElementById("thumb-desc-stroke");
  const descSize = document.getElementById("thumb-desc-size");
  const descX = document.getElementById("thumb-desc-x");
  const descY = document.getElementById("thumb-desc-y");

  const filenameInput = document.getElementById("thumb-filename-input");
  const downloadBtn = document.getElementById("thumb-download-btn");
  const uploadYtBtn = document.getElementById("btn-upload-to-youtube");
  const feedbackEl = document.getElementById("yt-api-feedback");

  const syncBtn = document.getElementById("btn-sync-from-main");
  const closeBtn = document.getElementById("btn-close-window");

  // ラベル要素
  const lblAvatarScale = document.getElementById("label-avatar-scale");
  const lblAvatarX = document.getElementById("label-avatar-x");
  const lblAvatarY = document.getElementById("label-avatar-y");
  const lblTitleSize = document.getElementById("label-title-size");
  const lblTitleX = document.getElementById("label-title-x");
  const lblTitleY = document.getElementById("label-title-y");
  const lblDescSize = document.getElementById("label-desc-size");
  const lblDescX = document.getElementById("label-desc-x");
  const lblDescY = document.getElementById("label-desc-y");

  // キャッシュ画像
  let cachedAvatarCanvas = null;
  let cachedAiBgImage = null;

  // 親ウィンドウの参照
  const openerWin = window.opener && !window.opener.closed ? window.opener : null;

  // 1. 親ウィンドウまたはlocalStorageからの初期値同期
  function syncFromParent(force = false) {
    if (openerWin) {
      try {
        const pTitle = openerWin.document.getElementById("stream-title");
        if (pTitle && pTitle.value && (!editTitle.value || force)) {
          editTitle.value = pTitle.value;
        }
        const pDesc = openerWin.document.getElementById("stream-description");
        if (pDesc && pDesc.value && (!editDesc.value || force)) {
          editDesc.value = pDesc.value.split("\n")[0] || "";
        }
      } catch (e) {
        console.warn("[ThumbEditor] opener同期エラー:", e);
      }
    }

    if (!editTitle.value) {
      editTitle.value = localStorage.getItem("savedStreamTitle") || "【生放送】最新ニュース速報まとめ！☀️";
    }
    if (!editDesc.value) {
      editDesc.value = "今日の重要トピックをわかりやすく解説します！";
    }

    // デフォルトファイル名
    if (!filenameInput.value || force) {
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      filenameInput.value = `${ymd}_サムネイル`;
    }

    // アバターキャプチャ
    captureAvatarFromOpener();
  }

  // アバターのキャプチャ
  function captureAvatarFromOpener() {
    if (openerWin) {
      try {
        // 親ウィンドウのPixiJSビューを取得
        const pApp = openerWin.pixiApp;
        if (pApp && pApp.view) {
          const v = pApp.view;
          if (!cachedAvatarCanvas) cachedAvatarCanvas = document.createElement("canvas");
          cachedAvatarCanvas.width = v.width;
          cachedAvatarCanvas.height = v.height;
          const aCtx = cachedAvatarCanvas.getContext("2d");
          aCtx.clearRect(0, 0, v.width, v.height);
          aCtx.drawImage(v, 0, 0);

          try {
            const dataUrl = cachedAvatarCanvas.toDataURL("image/png");
            localStorage.setItem("savedThumb_avatarData", dataUrl);
          } catch (e) {}
          drawPreview();
          return;
        }
      } catch (e) {
        console.warn("[ThumbEditor] 親PixiJSキャプチャエラー:", e);
      }
    }

    // フォールバック: 保存済みアバター画像を復元
    const savedAvatarData = localStorage.getItem("savedThumb_avatarData");
    if (savedAvatarData && !cachedAvatarCanvas) {
      cachedAvatarCanvas = document.createElement("canvas");
      const img = new Image();
      img.onload = () => {
        cachedAvatarCanvas.width = img.width;
        cachedAvatarCanvas.height = img.height;
        const aCtx = cachedAvatarCanvas.getContext("2d");
        aCtx.drawImage(img, 0, 0);
        drawPreview();
      };
      img.src = savedAvatarData;
    }
  }

  // 保存済みAI背景画像の復元
  const savedAiBgData = localStorage.getItem("savedThumb_aiBgData");
  if (savedAiBgData) {
    const bgImg = new Image();
    bgImg.onload = () => {
      cachedAiBgImage = bgImg;
      drawPreview();
    };
    bgImg.src = savedAiBgData;
  }

  // 2. キャンバスサイズ変更
  function updateCanvasDimensions() {
    const mode = sizeSelect.value;
    if (mode === "tiktok") {
      canvas.width = 1080;
      canvas.height = 1920;
      sizeBadge.textContent = "1080 × 1920";
      ratioText.textContent = "アスペクト比 9:16 (縦型ショート)";
    } else if (mode === "square") {
      canvas.width = 1080;
      canvas.height = 1080;
      sizeBadge.textContent = "1080 × 1080";
      ratioText.textContent = "アスペクト比 1:1 (正方形)";
    } else {
      canvas.width = 1280;
      canvas.height = 720;
      sizeBadge.textContent = "1280 × 720";
      ratioText.textContent = "アスペクト比 16:9 (YouTube標準)";
    }
    drawPreview();
  }

  // 3. プレビュー描画メイン処理
  function drawPreview() {
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 1. 背景描画
    if (showBg.checked) {
      if (cachedAiBgImage && cachedAiBgImage.complete && cachedAiBgImage.naturalWidth > 0) {
        ctx.drawImage(cachedAiBgImage, 0, 0, W, H);
      } else {
        // グラデーション背景
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, "#090a14");
        grad.addColorStop(0.5, "#161b2e");
        grad.addColorStop(1, "#0d1b2a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // サイバーネオングリッド
        ctx.strokeStyle = "rgba(0, 210, 211, 0.12)";
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < W; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        for (let y = 0; y < H; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
    }

    // 2. アバター描画
    if (showAvatar.checked && cachedAvatarCanvas) {
      const scale = (parseInt(avatarScale.value, 10) || 100) / 100;
      const xPct = (parseInt(avatarX.value, 10) || 100) / 100;
      const yPct = (parseInt(avatarY.value, 10) || 100) / 100;

      const aW = cachedAvatarCanvas.width;
      const aH = cachedAvatarCanvas.height;

      // アスペクト比を保ちつつリサイズ
      const baseRatio = Math.min(W / aW, H / aH) * 1.35;
      const drawW = aW * baseRatio * scale;
      const drawH = aH * baseRatio * scale;

      const posX = W * xPct - drawW * 0.7;
      const posY = H * yPct - drawH * 0.9;

      ctx.save();
      // アバターにわずかなシャドウ
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(cachedAvatarCanvas, posX, posY, drawW, drawH);
      ctx.restore();
    }

    // 3. タイトル描画
    if (showTitle.checked && editTitle.value.trim()) {
      const tLines = editTitle.value.split("\n");
      const fSize = parseInt(titleSize.value, 10) || 72;
      const xPos = (W * (parseInt(titleX.value, 10) || 10)) / 100;
      let yPos = (H * (parseInt(titleY.value, 10) || 15)) / 100 + fSize;

      ctx.save();
      ctx.font = `bold ${fSize}px "M PLUS Rounded 1c", "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.fillStyle = titleColor.value;
      ctx.strokeStyle = titleStroke.value;
      ctx.lineWidth = Math.max(4, Math.floor(fSize * 0.16));
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 12;

      tLines.forEach((line) => {
        if (line.trim()) {
          ctx.strokeText(line, xPos, yPos);
          ctx.fillText(line, xPos, yPos);
        }
        yPos += fSize * 1.25;
      });
      ctx.restore();
    }

    // 4. サブテキスト（概要文）描画
    if (showDesc.checked && editDesc.value.trim()) {
      const dLines = editDesc.value.split("\n");
      const dSize = parseInt(descSize.value, 10) || 40;
      const dxPos = (W * (parseInt(descX.value, 10) || 10)) / 100;
      let dyPos = (H * (parseInt(descY.value, 10) || 80)) / 100 + dSize;

      ctx.save();
      ctx.font = `bold ${dSize}px "M PLUS Rounded 1c", "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.fillStyle = descColor.value;
      ctx.strokeStyle = descStroke.value;
      ctx.lineWidth = Math.max(3, Math.floor(dSize * 0.14));
      ctx.lineJoin = "round";

      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 8;

      dLines.forEach((line) => {
        if (line.trim()) {
          ctx.strokeText(line, dxPos, dyPos);
          ctx.fillText(line, dxPos, dyPos);
        }
        dyPos += dSize * 1.25;
      });
      ctx.restore();
    }

    // 🌟 自動永続化（親画面やYouTubeアップロードが即座に読めるよう保存）
    try {
      const currentDataUrl = canvas.toDataURL("image/png");
      localStorage.setItem("savedThumb_latestDataUrl", currentDataUrl);
    } catch (e) {}
  }

  // 4. スライダーラベル・値連動
  function setupInputs() {
    const bindRange = (input, label, unit = "", callback = drawPreview) => {
      input.addEventListener("input", () => {
        if (label) label.textContent = `${input.value}${unit}`;
        callback();
      });
    };

    bindRange(avatarScale, lblAvatarScale, "%");
    bindRange(avatarX, lblAvatarX, "%");
    bindRange(avatarY, lblAvatarY, "%");

    bindRange(titleSize, lblTitleSize, "px");
    bindRange(titleX, lblTitleX, "%");
    bindRange(titleY, lblTitleY, "%");

    bindRange(descSize, lblDescSize, "px");
    bindRange(descX, lblDescX, "%");
    bindRange(descY, lblDescY, "%");

    [showBg, showAvatar, showTitle, showDesc, titleColor, titleStroke, descColor, descStroke].forEach((el) => {
      el.addEventListener("change", drawPreview);
    });

    [editTitle, editDesc].forEach((el) => {
      el.addEventListener("input", drawPreview);
    });

    sizeSelect.addEventListener("change", updateCanvasDimensions);

    recaptureBtn.addEventListener("click", () => {
      captureAvatarFromOpener();
    });

    syncBtn.addEventListener("click", () => {
      syncFromParent(true);
    });

    closeBtn.addEventListener("click", () => {
      window.close();
    });

    // 5. 画像保存（ダウンロード）
    downloadBtn.addEventListener("click", () => {
      const fn = (filenameInput.value.trim() || "thumbnail") + ".png";
      const a = document.createElement("a");
      a.download = fn;
      a.href = canvas.toDataURL("image/png");
      a.click();
    });

    // 6. YouTube枠へ直接反映（API送信）
    uploadYtBtn.addEventListener("click", async () => {
      let videoId = "";
      if (openerWin) {
        try {
          videoId = openerWin.document.getElementById("youtube-video-input")?.value || "";
        } catch (e) {}
      }
      if (!videoId) {
        videoId = localStorage.getItem("savedYoutubeVideoId") || "";
      }

      if (!videoId) {
        showFeedback("⚠️ YouTube枠の動画IDが見つかりません。親画面で動画IDを入力してください。", false);
        return;
      }

      uploadYtBtn.disabled = true;
      uploadYtBtn.textContent = "⏳ 送信中...";
      showFeedback("🖼️ サムネイル画像をYouTubeに送信中...", true);

      try {
        const base64Data = canvas.toDataURL("image/png");
        const res = await fetch("/api/youtube/set_thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: videoId,
            image_base64: base64Data
          })
        });
        const data = await res.json();
        if (data.ok) {
          showFeedback(`✅ サムネイル画像をYouTube枠 (${videoId}) に反映完了しました！🎉`, true);
        } else {
          showFeedback(`❌ 反映エラー: ${data.error || "送信に失敗しました"}`, false);
        }
      } catch (e) {
        showFeedback(`❌ 通信エラー: ${e.message}`, false);
      } finally {
        uploadYtBtn.disabled = false;
        uploadYtBtn.textContent = "🚀 YouTube枠に送信";
      }
    });

    // 7. AI背景生成ボタン
    aiBgBtn.addEventListener("click", async () => {
      const prompt = aiBgPrompt.value.trim();
      if (!prompt) {
        aiBgStatus.textContent = "⚠️ プロンプトを入力してください";
        return;
      }

      aiBgBtn.disabled = true;
      aiBgBtn.textContent = "⏳ 背景生成中 (約10〜20秒)...";
      aiBgStatus.textContent = "🎨 AIがサムネイル背景を描画しています...";

      try {
        const res = await fetch("/api/generate_thumbnail_bg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt, width: canvas.width, height: canvas.height })
        });
        const data = await res.json();
        if (data.ok && data.image_url) {
          const img = new Image();
          img.onload = () => {
            cachedAiBgImage = img;
            localStorage.setItem("savedThumb_aiBgData", data.image_url);
            aiBgStatus.textContent = "✅ 背景生成が完了しました！";
            drawPreview();
          };
          img.src = data.image_url;
        } else {
          aiBgStatus.textContent = `❌ 生成失敗: ${data.error || "エラー"}`;
        }
      } catch (e) {
        aiBgStatus.textContent = `❌ 通信エラー: ${e.message}`;
      } finally {
        aiBgBtn.disabled = false;
        aiBgBtn.textContent = "✨ 背景をAI生成";
      }
    });
  }

  function showFeedback(msg, isSuccess) {
    feedbackEl.textContent = msg;
    feedbackEl.className = isSuccess ? "success" : "error";
    feedbackEl.style.display = "block";
  }

  // 初期化実行
  setupInputs();
  syncFromParent();
  updateCanvasDimensions();
});
