(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("stream-tools", () => {
  // =====================================================================
  // 配信情報・サムネ作成
  // =====================================================================
  window.streamTitleInput = document.getElementById("stream-title");
  window.streamDescInput = document.getElementById("stream-description");
  window.generateThumbBtn = document.getElementById("generate-thumb-btn");

  const slotMorningBtn = document.getElementById("stream-slot-morning-btn");
  const slotEveningBtn = document.getElementById("stream-slot-evening-btn");
  const slotTemplateBtn = document.getElementById("stream-title-template-btn");

  const currentHour = new Date().getHours();
  const autoDefaultSlot = currentHour >= 4 && currentHour < 12 ? "morning" : "evening";
  let activeStreamSlot = localStorage.getItem("savedStreamSlot") || autoDefaultSlot;
  window.activeStreamSlot = activeStreamSlot;

  const jpNames = { hiyori: "ひより", akari: "あかり", hijiki: "ひじき", tororo: "とろろ", wanko: "わんこ" };
  const getCharName = () => (typeof currentModelId !== "undefined" && jpNames[currentModelId] ? jpNames[currentModelId] : "VTuber");

  const defaultTemplates = {
    morning: {
      title: () => `【朝の生放送】今日の最新ニュース速報＆注目トピックまとめ！☀️【${getCharName()} / VTuber】`,
      desc: () => `出勤・通学前にサクッとチェック！今日の最新ニュースと注目トピックを元気にお届けします☀️\n\nお気軽にコメントしていってくださいにゃ！`
    },
    evening: {
      title: () => `【夜の生放送】今日1日の重要ニュースを総ざらい！今夜のまとめ生配信🌙【${getCharName()} / VTuber】`,
      desc: () => `今日1日お疲れ様でした！今日起きた重要ニュースや話題のトピックを総ざらいでお届けします🌙\n\n一日の終わりにゆっくり聴いていってくださいにゃ！`
    }
  };

  function updateSlotUI() {
    window.activeStreamSlot = activeStreamSlot;
    localStorage.setItem("savedStreamSlot", activeStreamSlot);

    if (slotMorningBtn && slotEveningBtn) {
      if (activeStreamSlot === "morning") {
        slotMorningBtn.style.background = "rgba(255,180,0,0.25)";
        slotMorningBtn.style.borderColor = "#ffb400";
        slotMorningBtn.style.color = "#ffb400";
        slotEveningBtn.style.background = "rgba(255,255,255,0.05)";
        slotEveningBtn.style.borderColor = "rgba(255,255,255,0.15)";
        slotEveningBtn.style.color = "var(--text-muted)";
      } else {
        slotMorningBtn.style.background = "rgba(255,255,255,0.05)";
        slotMorningBtn.style.borderColor = "rgba(255,255,255,0.15)";
        slotMorningBtn.style.color = "var(--text-muted)";
        slotEveningBtn.style.background = "rgba(108,92,231,0.25)";
        slotEveningBtn.style.borderColor = "#a29bfe";
        slotEveningBtn.style.color = "#a29bfe";
      }
    }
  }

  function loadSlotContent(slot) {
    activeStreamSlot = slot;
    updateSlotUI();

    const savedTitle = localStorage.getItem(`savedStreamTitle_${slot}`);
    const savedDesc = localStorage.getItem(`savedStreamDesc_${slot}`);

    if (streamTitleInput) {
      streamTitleInput.value = savedTitle !== null ? savedTitle : defaultTemplates[slot].title();
      localStorage.setItem(`savedStreamTitle_${slot}`, streamTitleInput.value);
      localStorage.setItem("savedStreamTitle", streamTitleInput.value);
    }
    if (streamDescInput) {
      streamDescInput.value = savedDesc !== null ? savedDesc : defaultTemplates[slot].desc();
      localStorage.setItem(`savedStreamDesc_${slot}`, streamDescInput.value);
      localStorage.setItem("savedStreamDesc", streamDescInput.value);
      window.ytDescTextarea = document.getElementById("yt-desc-textarea");
      if (ytDescTextarea) {
        ytDescTextarea.value = streamDescInput.value;
        window.charcount = document.getElementById("yt-desc-charcount");
        if (charcount) charcount.textContent = `${ytDescTextarea.value.length}文字`;
      }
    }
  }

  if (slotMorningBtn) {
    slotMorningBtn.addEventListener("click", () => {
      if (activeStreamSlot !== "morning") {
        // 保存してから切替
        if (streamTitleInput) localStorage.setItem(`savedStreamTitle_${activeStreamSlot}`, streamTitleInput.value);
        if (streamDescInput) localStorage.setItem(`savedStreamDesc_${activeStreamSlot}`, streamDescInput.value);
        loadSlotContent("morning");
      }
    });
  }

  if (slotEveningBtn) {
    slotEveningBtn.addEventListener("click", () => {
      if (activeStreamSlot !== "evening") {
        // 保存してから切替
        if (streamTitleInput) localStorage.setItem(`savedStreamTitle_${activeStreamSlot}`, streamTitleInput.value);
        if (streamDescInput) localStorage.setItem(`savedStreamDesc_${activeStreamSlot}`, streamDescInput.value);
        loadSlotContent("evening");
      }
    });
  }

  if (slotTemplateBtn) {
    slotTemplateBtn.addEventListener("click", () => {
      const template = defaultTemplates[activeStreamSlot];
      if (streamTitleInput) {
        streamTitleInput.value = template.title();
        localStorage.setItem(`savedStreamTitle_${activeStreamSlot}`, streamTitleInput.value);
        localStorage.setItem("savedStreamTitle", streamTitleInput.value);
      }
      if (streamDescInput) {
        streamDescInput.value = template.desc();
        localStorage.setItem(`savedStreamDesc_${activeStreamSlot}`, streamDescInput.value);
        localStorage.setItem("savedStreamDesc", streamDescInput.value);
        window.ytDescTextarea = document.getElementById("yt-desc-textarea");
        if (ytDescTextarea) {
          ytDescTextarea.value = streamDescInput.value;
          window.charcount = document.getElementById("yt-desc-charcount");
          if (charcount) charcount.textContent = `${ytDescTextarea.value.length}文字`;
        }
      }
      slotTemplateBtn.textContent = "✅ 定番タイトルを適用しました";
      setTimeout(() => (slotTemplateBtn.textContent = "⚡ 定番タイトルを適用"), 1500);
    });
  }

  if (streamTitleInput) {
    streamTitleInput.addEventListener("input", () => {
      localStorage.setItem(`savedStreamTitle_${activeStreamSlot}`, streamTitleInput.value);
      localStorage.setItem("savedStreamTitle", streamTitleInput.value);
    });
  }

  if (streamDescInput) {
    streamDescInput.addEventListener("input", () => {
      localStorage.setItem(`savedStreamDesc_${activeStreamSlot}`, streamDescInput.value);
      localStorage.setItem("savedStreamDesc", streamDescInput.value);
      window.ytDescTextarea = document.getElementById("yt-desc-textarea");
      if (ytDescTextarea) {
        ytDescTextarea.value = streamDescInput.value;
        window.charcount = document.getElementById("yt-desc-charcount");
        if (charcount)
          charcount.textContent = `${ytDescTextarea.value.length}文字`;
      }
    });
  }

  // 初期ロード
  loadSlotContent(activeStreamSlot);

  window.aiStreamSnsInput = document.getElementById("ai-stream-sns");
  if (aiStreamSnsInput) {
    const savedSns = localStorage.getItem("savedAiStreamSns");
    if (savedSns) aiStreamSnsInput.value = savedSns;
    aiStreamSnsInput.addEventListener("input", () => {
      localStorage.setItem("savedAiStreamSns", aiStreamSnsInput.value);
    });
  }

  window.aiStreamCreditsInput = document.getElementById("ai-stream-credits");
  if (aiStreamCreditsInput) {
    const savedCredits = localStorage.getItem("savedAiStreamCredits");
    if (savedCredits) aiStreamCreditsInput.value = savedCredits;
    aiStreamCreditsInput.addEventListener("input", () => {
      localStorage.setItem("savedAiStreamCredits", aiStreamCreditsInput.value);
    });
  }

  // =====================================================================
  // YouTube API 直接連携（パネル側）
  // =====================================================================
  const panelYtBadge = document.getElementById("panel-yt-oauth-badge");
  const panelFeedback = document.getElementById("panel-yt-api-feedback");
  const panelBtnCreate = document.getElementById("panel-btn-create-broadcast");
  const panelBtnUpdate = document.getElementById("panel-btn-update-broadcast");
  const panelBtnThumb = document.getElementById("panel-btn-upload-thumbnail");

  function showPanelYtFeedback(msg, isSuccess = true) {
    if (!panelFeedback) return;
    panelFeedback.style.display = "block";
    panelFeedback.textContent = msg;
    panelFeedback.style.background = isSuccess ? "rgba(0,230,118,0.2)" : "rgba(255,118,117,0.2)";
    panelFeedback.style.border = `1px solid ${isSuccess ? "#00e676" : "#ff7675"}`;
    panelFeedback.style.color = isSuccess ? "#00e676" : "#ff7675";
  }

  async function updatePanelYtStatus() {
    if (!panelYtBadge) return;
    try {
      const res = await fetch("http://localhost:8001/api/youtube/oauth_status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          panelYtBadge.textContent = `✅ 連携中 (${data.channel_title || "YouTube"})`;
          panelYtBadge.style.color = "#00e676";
          return true;
        } else {
          panelYtBadge.textContent = "⚠️ 未連携 (ウィザード等で認証可)";
          panelYtBadge.style.color = "#ffeaa7";
          return false;
        }
      }
    } catch (e) {
      panelYtBadge.textContent = "未確認";
      panelYtBadge.style.color = "var(--text-muted)";
    }
    return false;
  }

  updatePanelYtStatus();

  if (panelBtnCreate) {
    panelBtnCreate.addEventListener("click", async () => {
      const title = streamTitleInput ? streamTitleInput.value : "";
      const desc = streamDescInput ? streamDescInput.value : "";
      panelBtnCreate.disabled = true;
      panelBtnCreate.textContent = "⏳ 作成中...";
      showPanelYtFeedback("YouTube枠を作成中...", true);
      try {
        const res = await fetch("http://localhost:8001/api/youtube/create_broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: desc, privacyStatus: "unlisted" })
        });
        const data = await res.json();
        if (data.success && data.id) {
          showPanelYtFeedback(`✅ YouTube枠「${data.title}」を作成しました！(ID: ${data.id})`, true);
          const ytInput = document.getElementById("youtube-video-input");
          if (ytInput) {
            ytInput.value = data.id;
            localStorage.setItem("savedYoutubeVideoId", data.id);
          }
        } else {
          showPanelYtFeedback(`❌ 枠作成エラー: ${data.error || "未認証またはエラー"}`, false);
        }
      } catch (err) {
        showPanelYtFeedback(`❌ 通信エラー: ${err.message}`, false);
      } finally {
        panelBtnCreate.disabled = false;
        panelBtnCreate.textContent = "🔴 枠を新規作成";
      }
    });
  }

  if (panelBtnUpdate) {
    panelBtnUpdate.addEventListener("click", async () => {
      const ytInput = document.getElementById("youtube-video-input");
      const rawYt = ytInput ? ytInput.value.trim() : "";
      const match = rawYt.match(/(?:v=|\/live\/|\/watch\?v=|youtu\.be\/|^)([a-zA-Z0-9_-]{11})/);
      const videoId = match ? match[1] : rawYt;
      if (!videoId || videoId.length < 5 || videoId.startsWith("@")) {
        showPanelYtFeedback("⚠️ 更新対象の動画IDを「YouTube連携」枠に入力してください。", false);
        return;
      }
      const title = streamTitleInput ? streamTitleInput.value : "";
      const desc = streamDescInput ? streamDescInput.value : "";
      panelBtnUpdate.disabled = true;
      panelBtnUpdate.textContent = "⏳ 更新中...";
      try {
        const res = await fetch("http://localhost:8001/api/youtube/update_broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, title, description: desc })
        });
        const data = await res.json();
        if (data.success) {
          showPanelYtFeedback(`✅ YouTube枠 (${videoId}) の情報を更新しました！`, true);
        } else {
          showPanelYtFeedback(`❌ 更新エラー: ${data.error || "エラー"}`, false);
        }
      } catch (err) {
        showPanelYtFeedback(`❌ 通信エラー: ${err.message}`, false);
      } finally {
        panelBtnUpdate.disabled = false;
        panelBtnUpdate.textContent = "📝 枠情報を更新";
      }
    });
  }

  if (panelBtnThumb) {
    panelBtnThumb.addEventListener("click", async () => {
      const ytInput = document.getElementById("youtube-video-input");
      const rawYt = ytInput ? ytInput.value.trim() : "";
      const match = rawYt.match(/(?:v=|\/live\/|\/watch\?v=|youtu\.be\/|^)([a-zA-Z0-9_-]{11})/);
      const videoId = match ? match[1] : rawYt;
      if (!videoId || videoId.length < 5 || videoId.startsWith("@")) {
        showPanelYtFeedback("⚠️ 反映対象の動画IDを「YouTube連携」枠に入力してください。", false);
        return;
      }
      const canvas = document.getElementById("thumb-preview-canvas") || document.getElementById("thumb-canvas");
      if (!canvas) {
        showPanelYtFeedback("⚠️ サムネイルエディタでサムネイルを生成してください。", false);
        return;
      }
      const imageData = canvas.toDataURL("image/png");
      panelBtnThumb.disabled = true;
      panelBtnThumb.textContent = "⏳ 送信中...";
      try {
        const res = await fetch("http://localhost:8001/api/youtube/upload_thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, imageData })
        });
        const data = await res.json();
        if (data.success) {
          showPanelYtFeedback(`✅ サムネイルをYouTube枠 (${videoId}) に反映しました！`, true);
        } else {
          showPanelYtFeedback(`❌ サムネ反映エラー: ${data.error || "エラー"}`, false);
        }
      } catch (err) {
        showPanelYtFeedback(`❌ 通信エラー: ${err.message}`, false);
      } finally {
        panelBtnThumb.disabled = false;
        panelBtnThumb.textContent = "🖼️ サムネをYouTubeに送信";
      }
    });
  }

  // サムネイルエディタ
  window.openThumbEditorBtn = document.getElementById("open-thumb-editor-btn");
  window.thumbEditorModal = document.getElementById("thumbnail-editor-modal");
  window.thumbEditorCancelBtn = document.getElementById(
    "thumb-editor-cancel-btn",
  );
  window.thumbDownloadBtn = document.getElementById("thumb-download-btn");
  window.thumbPreviewCanvas = document.getElementById("thumb-preview-canvas");

  window.thumbSizeSelect = document.getElementById("thumb-size-select");
  window.thumbShowBg = document.getElementById("thumb-show-bg");
  window.thumbShowAvatar = document.getElementById("thumb-show-avatar");
  window.thumbShowTitle = document.getElementById("thumb-show-title");
  window.thumbShowDesc = document.getElementById("thumb-show-desc");
  window.thumbTitleColor = document.getElementById("thumb-title-color");
  window.thumbTitleStroke = document.getElementById("thumb-title-stroke");
  window.thumbTitleSize = document.getElementById("thumb-title-size");
  window.thumbTitleX = document.getElementById("thumb-title-x");
  window.thumbTitleY = document.getElementById("thumb-title-y");
  window.thumbDescColor = document.getElementById("thumb-desc-color");
  window.thumbDescStroke = document.getElementById("thumb-desc-stroke");
  window.thumbDescSize = document.getElementById("thumb-desc-size");
  window.thumbDescX = document.getElementById("thumb-desc-x");
  window.thumbDescY = document.getElementById("thumb-desc-y");

  window.thumbEditTitle = document.getElementById("thumb-edit-title");
  window.thumbEditDesc = document.getElementById("thumb-edit-desc");

  window.thumbAvatarScale = document.getElementById("thumb-avatar-scale");
  window.thumbAvatarX = document.getElementById("thumb-avatar-x");
  window.thumbAvatarY = document.getElementById("thumb-avatar-y");
  window.thumbRecaptureBtn = document.getElementById("thumb-recapture-btn");

  let cachedAvatarCanvas = null;

  const captureAvatarFrame = () => {
    if (pixiApp && pixiApp.view) {
      const view = pixiApp.view;
      if (!cachedAvatarCanvas) {
        cachedAvatarCanvas = document.createElement("canvas");
      }
      cachedAvatarCanvas.width = view.width;
      cachedAvatarCanvas.height = view.height;
      const ctx = cachedAvatarCanvas.getContext("2d");
      ctx.clearRect(0, 0, view.width, view.height);
      ctx.drawImage(view, 0, 0);
    }
  };

  if (thumbRecaptureBtn) {
    thumbRecaptureBtn.addEventListener("click", () => {
      captureAvatarFrame();
      drawThumbPreview();
    });
  }

  // AI背景生成
  let cachedAiBgImage = null; // AI生成した背景画像を保持

  window.thumbAiBgPromptEl = document.getElementById("thumb-ai-bg-prompt");
  window.thumbAiBgGenerateBtn = document.getElementById(
    "thumb-ai-bg-generate-btn",
  );
  window.thumbAiBgStatus = document.getElementById("thumb-ai-bg-status");

  if (thumbAiBgGenerateBtn) {
    thumbAiBgGenerateBtn.addEventListener("click", async () => {
      const apiKey = localStorage.getItem("savedAiApiKey");
      const provider = localStorage.getItem("savedAiProvider") || "gemini";
      // 強制的にImagenモデルを使用する
      const aiModel =
        provider === "openai" ? "dall-e-3" : "imagen-3.0-generate-002";

      if (!apiKey) {
        alert("AI設定タブでAPIキーを設定してください。");
        return;
      }

      const userPrompt = thumbAiBgPromptEl
        ? thumbAiBgPromptEl.value.trim()
        : "";
      const prompt =
        userPrompt ||
        "VTuber配信背景、アニメスタイル、ネオン照明のゲームルーム、明るくポップ、横長ワイド";

      thumbAiBgGenerateBtn.textContent = "⏳ 生成中...";
      thumbAiBgGenerateBtn.disabled = true;
      if (thumbAiBgStatus)
        thumbAiBgStatus.textContent =
          "AIが背景を描いています...（30秒ほどかかる場合があります）";

      try {
        let imageUrl = null;
        let imageBase64 = null;

        if (provider === "openai") {
          // DALL-E 3
          const sizeMode = thumbSizeSelect ? thumbSizeSelect.value : "youtube";
          const dalleSize =
            sizeMode === "tiktok"
              ? "1024x1792"
              : sizeMode === "square"
                ? "1024x1024"
                : "1792x1024";
          const res = await fetch(
            "https://api.openai.com/v1/images/generations",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt,
                n: 1,
                size: dalleSize,
                response_format: "url",
              }),
            },
          );
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error?.message || "DALL-E API Error");
          }
          const data = await res.json();
          imageUrl = data.data[0].url;
        } else {
          // Gemini 画像生成
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
              }),
            },
          );
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error?.message || "Gemini API Error");
          }
          const data = await res.json();
          console.log("Gemini Response:", data);

          const parts = data.candidates?.[0]?.content?.parts || [];
          // 画像データ（inlineDataまたはfileData）を探す
          const imgPart = parts.find((p) => p.inlineData || p.fileData);

          if (!imgPart) {
            // テキスト（プロンプト等）しか返ってこなかった場合のエラー案内
            const textPart = parts.find((p) => p.text);
            const textMsg = textPart ? textPart.text : "不明なレスポンス";
            throw new Error(
              "選択中のモデル（" +
                aiModel +
                "）は画像生成に対応していません。「imagen-3.0-generate-002」等の画像モデルを指定するか、OpenAI（DALL-E 3）をご利用ください。",
            );
          }

          const mime =
            imgPart.inlineData?.mimeType ||
            imgPart.fileData?.mimeType ||
            "image/png";
          const base64Data = imgPart.inlineData?.data || imgPart.fileData?.data;
          imageBase64 = `data:${mime};base64,${base64Data}`;
        }

        // 画像をキャッシュ
        const finalSrc = imageBase64 || imageUrl;
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            cachedAiBgImage = img;
            resolve();
          };
          img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
          img.src = finalSrc;
        });

        if (thumbAiBgStatus)
          thumbAiBgStatus.textContent = "✅ 生成完了！プレビューに反映しました";
        drawThumbPreview();
      } catch (err) {
        console.error("[AI BG]", err);
        if (thumbAiBgStatus)
          thumbAiBgStatus.textContent = `❌ エラー: ${err.message}`;
      } finally {
        thumbAiBgGenerateBtn.textContent = "✨ 背景をAI生成";
        thumbAiBgGenerateBtn.disabled = false;
      }
    });
  }

  const thumbSettings = [
    thumbSizeSelect,
    thumbShowBg,
    thumbShowAvatar,
    thumbShowTitle,
    thumbShowDesc,
    thumbTitleColor,
    thumbTitleStroke,
    thumbTitleSize,
    thumbTitleX,
    thumbTitleY,
    thumbDescColor,
    thumbDescStroke,
    thumbDescSize,
    thumbDescX,
    thumbDescY,
    thumbAvatarScale,
    thumbAvatarX,
    thumbAvatarY,
  ];

  // Load saved settings
  thumbSettings.forEach((el) => {
    if (!el) return;
    const saved = localStorage.getItem("savedThumb_" + el.id);
    if (saved !== null) {
      if (el.type === "checkbox") el.checked = saved === "true";
      else el.value = saved;
    }
    el.addEventListener("input", () => {
      if (el.type === "checkbox")
        localStorage.setItem("savedThumb_" + el.id, el.checked);
      else localStorage.setItem("savedThumb_" + el.id, el.value);
      drawThumbPreview();
    });
  });

  const drawThumbPreview = async () => {
    if (!thumbPreviewCanvas) return;
    const ctx = thumbPreviewCanvas.getContext("2d");

    let targetWidth = 1280;
    let targetHeight = 720;
    if (thumbSizeSelect.value === "tiktok") {
      targetWidth = 1080;
      targetHeight = 1920;
    } else if (thumbSizeSelect.value === "square") {
      targetWidth = 1080;
      targetHeight = 1080;
    }

    thumbPreviewCanvas.width = targetWidth;
    thumbPreviewCanvas.height = targetHeight;

    // 1. 背景描画
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (thumbShowBg.checked) {
      // AI生成背景画像を優先して使う
      if (cachedAiBgImage) {
        const scale = Math.max(
          targetWidth / cachedAiBgImage.width,
          targetHeight / cachedAiBgImage.height,
        );
        const x = (targetWidth - cachedAiBgImage.width * scale) / 2;
        const y = (targetHeight - cachedAiBgImage.height * scale) / 2;
        ctx.drawImage(
          cachedAiBgImage,
          x,
          y,
          cachedAiBgImage.width * scale,
          cachedAiBgImage.height * scale,
        );
      } else {
        window.bgDiv = document.getElementById("background-layer");
        const bgImageStyle = bgDiv
          ? getComputedStyle(bgDiv).backgroundImage
          : "none";
        if (bgImageStyle && bgImageStyle !== "none") {
          const urlMatch = bgImageStyle.match(/url\(['"]?(.*?)['"]?\)/);
          if (urlMatch && urlMatch[1]) {
            await new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const scale = Math.max(
                  targetWidth / img.width,
                  targetHeight / img.height,
                );
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

      const userScale = thumbAvatarScale
        ? parseFloat(thumbAvatarScale.value) / 100
        : 1;
      const alignX = thumbAvatarX ? parseFloat(thumbAvatarX.value) / 100 : 1;
      const alignY = thumbAvatarY ? parseFloat(thumbAvatarY.value) / 100 : 1;

      // ベースは高さいっぱいのスケール
      const baseScale = targetHeight / view.height;
      const finalScale = baseScale * userScale;

      const w = view.width * finalScale;
      const h = view.height * finalScale;

      const baseX = targetWidth * alignX;
      const baseY = targetHeight * alignY;

      const x = baseX - w * alignX;
      const y = baseY - h * alignY;

      ctx.drawImage(view, x, y, w, h);
    }

    // 3. テキスト描画
    const titleText = thumbEditTitle ? thumbEditTitle.value : "";
    const descText = thumbEditDesc ? thumbEditDesc.value : "";

    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    if (thumbShowTitle.checked && titleText) {
      const lines = titleText.split("\n");
      const baseX = targetWidth * (parseFloat(thumbTitleX.value) / 100);
      let baseY = targetHeight * (parseFloat(thumbTitleY.value) / 100);
      const tSize = thumbTitleSize ? parseFloat(thumbTitleSize.value) : 72;

      ctx.font = `bold ${tSize}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

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
      const descLines = descText.split("\n");
      const baseX = targetWidth * (parseFloat(thumbDescX.value) / 100);
      let baseY = targetHeight * (parseFloat(thumbDescY.value) / 100);
      const dSize = thumbDescSize ? parseFloat(thumbDescSize.value) : 40;

      ctx.font = `bold ${dSize}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

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

  window.openThumbnailEditorModal = function () {
    if (thumbEditorModal) thumbEditorModal.style.display = "flex";

    window.thumbFilenameInput = document.getElementById("thumb-filename-input");
    if (
      thumbFilenameInput &&
      (!thumbFilenameInput.value || thumbFilenameInput.value === "thumbnail")
    ) {
      const now = new Date();
      const yyyymmdd =
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");
      const title =
        streamTitleInput && streamTitleInput.value.trim()
          ? streamTitleInput.value.trim()
          : "サムネ";
      thumbFilenameInput.value = `${yyyymmdd}_${title}`;
    }

    if (thumbEditTitle && streamTitleInput && !thumbEditTitle.value) {
      thumbEditTitle.value = streamTitleInput.value;
    }

    captureAvatarFrame();
    drawThumbPreview();
  };

  window.generateThumbnailDataUrl = async function () {
    if (thumbEditTitle && streamTitleInput) {
      thumbEditTitle.value = streamTitleInput.value;
    }
    captureAvatarFrame();
    await drawThumbPreview();
    if (thumbPreviewCanvas && typeof thumbPreviewCanvas.toDataURL === "function") {
      return thumbPreviewCanvas.toDataURL("image/png");
    }
    return null;
  };

  if (openThumbEditorBtn) {
    openThumbEditorBtn.addEventListener("click", () => {
      window.openThumbnailEditorModal();
    });
  }

  if (thumbEditTitle) {
    const savedThumbTitle = localStorage.getItem("savedThumbTitle");
    if (savedThumbTitle !== null) {
      thumbEditTitle.value = savedThumbTitle;
    } else if (streamTitleInput) {
      thumbEditTitle.value = streamTitleInput.value;
    }
    thumbEditTitle.addEventListener("input", () => {
      localStorage.setItem("savedThumbTitle", thumbEditTitle.value);
      drawThumbPreview();
    });
  }

  if (thumbEditDesc) {
    const savedThumbDesc = localStorage.getItem("savedThumbDesc");
    if (savedThumbDesc !== null) {
      thumbEditDesc.value = savedThumbDesc;
    } else if (streamDescInput) {
      thumbEditDesc.value = streamDescInput.value;
    }
    thumbEditDesc.addEventListener("input", () => {
      localStorage.setItem("savedThumbDesc", thumbEditDesc.value);
      drawThumbPreview();
    });
  }

  if (thumbEditorCancelBtn) {
    thumbEditorCancelBtn.addEventListener("click", () => {
      if (thumbEditorModal) thumbEditorModal.style.display = "none";
    });
  }

  window.thumbFilenameInput = document.getElementById("thumb-filename-input");
  if (thumbFilenameInput) {
    const savedFilename = localStorage.getItem("savedThumbFilename");
    if (savedFilename !== null) {
      thumbFilenameInput.value = savedFilename;
    }
    thumbFilenameInput.addEventListener("input", () => {
      localStorage.setItem("savedThumbFilename", thumbFilenameInput.value);
    });
  }

  if (thumbDownloadBtn) {
    thumbDownloadBtn.addEventListener("click", async () => {
      if (!thumbPreviewCanvas) return;

      let baseName = "thumbnail";
      if (thumbFilenameInput && thumbFilenameInput.value.trim()) {
        baseName = thumbFilenameInput.value.trim();
      } else if (thumbEditTitle && thumbEditTitle.value.trim()) {
        baseName = thumbEditTitle.value.trim();
      } else if (streamTitleInput && streamTitleInput.value.trim()) {
        baseName = streamTitleInput.value.trim();
      }

      baseName = baseName
        .replace(/[\\/:*?"<>|#]/g, "_")
        .trim()
        .substring(0, 50);

      const dataUrl = thumbPreviewCanvas.toDataURL("image/png");
      const arr = dataUrl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const suggestedFilename = `${baseName}_thumb.png`;

      // 保存ダイアログを表示する新しいAPI（対応ブラウザのみ）
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: suggestedFilename,
            types: [
              {
                description: "PNG画像",
                accept: { "image/png": [".png"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return; // 保存成功時はここで処理終了
        } catch (err) {
          if (err.name === "AbortError") return; // キャンセルされた場合
          console.error("SaveFilePicker error:", err);
          // エラー時は従来のaタグダウンロードへフォールバック
        }
      }

      // フォールバック（従来のダウンロード方式）
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = suggestedFilename;
      link.href = url;
      link.style.display = "none";
      document.body.appendChild(link);

      const event = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      link.dispatchEvent(event);

      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }

  // =====================================================================
  // AI配信タイトル生成
  // =====================================================================
  window.aiStreamThemeInput = document.getElementById("ai-stream-theme");
  window.aiGenerateStreamBtn = document.getElementById(
    "ai-generate-stream-info-btn",
  );
  window.aiCandidatesModal = document.getElementById("ai-candidates-modal");
  window.aiCandidatesList = document.getElementById("ai-candidates-list");
  window.aiCandidatesCancelBtn = document.getElementById(
    "ai-candidates-cancel-btn",
  );

  if (aiCandidatesCancelBtn) {
    aiCandidatesCancelBtn.addEventListener("click", () => {
      aiCandidatesModal.style.display = "none";
    });
  }

  // =====================================================================
  // YouTube概要欄エディタ
  // =====================================================================
  window.ytDescModal = document.getElementById("yt-desc-modal");
  window.ytDescTextarea = document.getElementById("yt-desc-textarea");
  window.ytDescCharcount = document.getElementById("yt-desc-charcount");
  window.ytDescCancelBtn = document.getElementById("yt-desc-cancel-btn");
  window.ytDescCopyBtn = document.getElementById("yt-desc-copy-btn");
  window.editYtDescBtn = document.getElementById("edit-yt-desc-btn");
  window.copyYtDescBtn = document.getElementById("copy-yt-desc-btn");
  window.aiGenerateYtDescBtn = document.getElementById(
    "ai-generate-yt-desc-btn",
  );

  const updateYtDescCount = () => {
    if (ytDescCharcount && ytDescTextarea) {
      ytDescCharcount.textContent = `${ytDescTextarea.value.length}文字`;
    }
  };

  // ローカルストレージで保存・streamDescInputとの同期
  if (ytDescTextarea) {
    const saved = localStorage.getItem("savedStreamDesc"); // savedYtDescription から統一
    if (saved) ytDescTextarea.value = saved;

    ytDescTextarea.addEventListener("input", () => {
      localStorage.setItem("savedStreamDesc", ytDescTextarea.value);
      if (streamDescInput) streamDescInput.value = ytDescTextarea.value;
      updateYtDescCount();
    });
    updateYtDescCount();
  }

  // 編集ボタン → モーダルを開く
  if (editYtDescBtn && ytDescModal) {
    editYtDescBtn.addEventListener("click", () => {
      if (streamDescInput && ytDescTextarea) {
        // 開くときに最新の streamDescInput の値を反映
        ytDescTextarea.value = streamDescInput.value;
      }
      ytDescModal.style.display = "flex";
      updateYtDescCount();
    });
  }

  // パネル側のコピーボタン
  if (copyYtDescBtn && ytDescTextarea) {
    copyYtDescBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(ytDescTextarea.value).then(() => {
        copyYtDescBtn.textContent = "✅ コピー済";
        setTimeout(() => {
          copyYtDescBtn.textContent = "コピー";
        }, 2000);
      });
    });
  }

  // モーダル内コピーボタン
  if (ytDescCopyBtn && ytDescTextarea) {
    ytDescCopyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(ytDescTextarea.value).then(() => {
        ytDescCopyBtn.textContent = "✅ コピー済み";
        setTimeout(() => {
          ytDescCopyBtn.textContent = "📋 コピー";
        }, 2000);
      });
    });
  }

  // モーダルを閉じる
  if (ytDescCancelBtn) {
    ytDescCancelBtn.addEventListener("click", () => {
      ytDescModal.style.display = "none";
    });
  }

  // AI生成（概要欄向け詳細文）
  if (aiGenerateYtDescBtn) {
    aiGenerateYtDescBtn.addEventListener("click", async () => {
      const apiKey = localStorage.getItem("savedAiApiKey") || "";
      const provider = localStorage.getItem("savedAiProvider") || "gemini";
      const aiModel =
        localStorage.getItem("savedAiModel") ||
        (provider === "openai" ? "gpt-4o-mini" : (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash"));

      if (!apiKey && provider !== "ollama") {
        alert("AI設定タブでAPIキーを設定してください。");
        return;
      }

      const slot = window.activeStreamSlot || (new Date().getHours() >= 4 && new Date().getHours() < 12 ? "morning" : "evening");
      const slotDescContext = slot === "morning"
        ? "【配信時間帯】: 🌅 朝の生放送（出勤・通学前の爽やかな挨拶、今日一日の見通し、元気なトーン）"
        : "【配信時間帯】: 🌙 夜の生放送（お仕事お疲れ様の挨拶、今日一日の振り返り・総まとめ、落ち着いたトーン）";

      const title = streamTitleInput ? streamTitleInput.value.trim() : "";
      const shortDesc = streamDescInput ? streamDescInput.value.trim() : "";
      const theme = aiStreamThemeInput ? aiStreamThemeInput.value.trim() : "";

      const prompt = `あなたはプロのVTuber配信マネージャーです。
以下の配信情報をもとに、YouTubeの概要欄（説明欄）に書く長文テキストを1本だけ作成してください。

${slotDescContext}
配信タイトル: ${title || "（未設定）"}
配信テーマ: ${theme || shortDesc || "（未設定）"}

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

      aiGenerateYtDescBtn.textContent = "⏳ 生成中...";
      aiGenerateYtDescBtn.disabled = true;

      try {
        let result = "";
        if (provider === "ollama") {
          const res = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: aiModel, prompt: prompt, stream: false }),
          });
          if (!res.ok) throw new Error("Ollama API Error");
          const data = await res.json();
          result = data.response;
        } else if (provider === "openai") {
          const res = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
              }),
            },
          );
          if (!res.ok) throw new Error("OpenAI API Error");
          const data = await res.json();
          result = data.choices[0].message.content;
        } else {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 },
              }),
            },
          );
          if (!res.ok) throw new Error("Gemini API Error");
          const data = await res.json();
          result = data.candidates[0].content.parts[0].text;
        }

        if (ytDescTextarea) {
          ytDescTextarea.value = result;
          localStorage.setItem("savedYtDescription", result);
          updateYtDescCount();
        }
      } catch (err) {
        console.error(err);
        alert("AI生成に失敗しました。\n" + err.message);
      } finally {
        aiGenerateYtDescBtn.textContent = "✨ AI で概要欄を生成";
        aiGenerateYtDescBtn.disabled = false;
      }
    });
  }

  if (aiGenerateStreamBtn) {
    aiGenerateStreamBtn.addEventListener("click", async () => {
      const apiKey = localStorage.getItem("savedAiApiKey") || "";
      const provider = localStorage.getItem("savedAiProvider") || "gemini";
      const aiModel =
        localStorage.getItem("savedAiModel") ||
        (provider === "openai" ? "gpt-4o-mini" : (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash"));

      if (!apiKey && provider !== "ollama") {
        alert("AI設定タブでAPIキーを設定してください。");
        return;
      }

      const slot = window.activeStreamSlot || (new Date().getHours() >= 4 && new Date().getHours() < 12 ? "morning" : "evening");
      const slotTitleContext = slot === "morning"
        ? "【配信時間帯】: 🌅 朝の生放送（出勤・通学前に見たくなる爽やかなタイトル、今日一日の見通し。タイトル例: 【朝の生放送】〜☀️）"
        : "【配信時間帯】: 🌙 夜の生放送（今日一日の総まとめ、お仕事お疲れ様の癒やし。タイトル例: 【夜の生放送】〜🌙）";

      const theme = aiStreamThemeInput.value.trim() || "おまかせ（今日の配信）";
      const jpNames = {
        hiyori: "ひより",
        akari: "あかり",
        hijiki: "ひじき",
        tororo: "とろろ",
        wanko: "わんこ",
      };
      const charName = jpNames[currentModelId] || "VTuber";

      window.radioScriptTextarea = document.getElementById(
        "radio-script-textarea",
      );
      const scriptContent = radioScriptTextarea
        ? radioScriptTextarea.value.trim()
        : "";

      let themeContext = `以下のキーワードやテーマを元に、YouTube配信用の「配信タイトル」と「概要文」のセットを10通り作成してください。\n\nキーワード・テーマ: ${theme}`;

      if (scriptContent) {
        themeContext = `以下の「キーワード・テーマ」と、今回の配信で実際に話す「ラジオ台本」を元にして、この配信の内容が魅力的に伝わるYouTube配信用の「配信タイトル」と「概要文」のセットを10通り作成してください。\n台本の内容を踏まえた具体的なあらすじや見どころを概要文に盛り込んでください。\n\nキーワード・テーマ: ${theme}\n\n【今回のラジオ台本（参考）】\n${scriptContent}`;
      }

      window.userSns = document.getElementById("ai-stream-sns")?.value.trim();
      window.userCredits = document
        .getElementById("ai-stream-credits")
        ?.value.trim();

      const snsInstruction = userSns
        ? `3. X(Twitter)などのSNSへのリンク（以下のユーザー指定のリンクをそのまま使用してください）\n   ${userSns}`
        : `3. X(Twitter)などのSNSへのリンク（URLは https://twitter.com/${currentModelId}_vtuber のようなダミーを生成してください）`;

      const creditsInstruction = userCredits
        ? `5. 素材・モデルのクレジット表記（以下のユーザー指定の内容をそのまま使用してください）\n   ${userCredits}`
        : `5. 素材・モデルのクレジット表記（以下の内容を必ず含めてください）\n   - Live2Dモデル: 「${charName}」© Live2D Inc. (Live2D Creative Studio サンプルモデル)\n   - BGMやその他素材（ダミーで構いません）`;

      const prompt = `あなたはプロのVTuber配信マネージャーです。
${slotTitleContext}

${themeContext}

【概要文の要件】
他の人気VTuberがよくやっているように、以下の要素を盛り込んでリッチな概要文にしてください：
1. 配信のあらすじ・見どころ（元気な挨拶を含む）
2. 関連するハッシュタグ（あなたの名前「${charName}」を含めた配信用のオリジナルハッシュタグを2〜3個作成してください）
${snsInstruction}
4. 視聴者へのお願い・配信のルール（「話題に出ていない他の配信者の名前を出さない」「伝書鳩NG」「荒らしはブロック＆スルー」など）
${creditsInstruction}

必ず以下のJSONフォーマットのみを返してください（マークダウンやバッククォート、説明などは一切不要です）。
[
  { "title": "タイトル1", "description": "概要1" },
  { "title": "タイトル2", "description": "概要2" }
]`;

      aiGenerateStreamBtn.textContent = "✨ 生成中...";
      aiGenerateStreamBtn.disabled = true;

      try {
        let jsonText = "";
        if (provider === "ollama") {
          const res = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: aiModel, prompt: prompt, stream: false }),
          });
          if (!res.ok) throw new Error("Ollama API Error");
          const data = await res.json();
          jsonText = data.response;
        } else if (provider === "openai") {
          const res = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
              }),
            },
          );
          if (!res.ok) throw new Error("OpenAI API Error");
          const data = await res.json();
          jsonText = data.choices[0].message.content;
        } else {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 },
              }),
            },
          );
          if (!res.ok) throw new Error("Gemini API Error");
          const data = await res.json();
          jsonText = data.candidates[0].content.parts[0].text;
        }

        // JSONの抽出 (マークダウンがあった場合を考慮)
        if (jsonText.includes("```json")) {
          jsonText = jsonText.split("```json")[1].split("```")[0].trim();
        } else if (jsonText.includes("```")) {
          jsonText = jsonText.split("```")[1].split("```")[0].trim();
        }

        const candidates = JSON.parse(jsonText);

        // モーダルにレンダリング
        const modalTitle = aiCandidatesModal.querySelector("h3");
        if (modalTitle) modalTitle.textContent = "✨ AI生成の候補";

        aiCandidatesList.innerHTML = "";
        candidates.forEach((cand, i) => {
          const div = document.createElement("div");
          div.className = "ai-candidate-item";

          const title = document.createElement("h4");
          title.textContent = `${i + 1}. ${cand.title}`;

          const desc = document.createElement("p");
          desc.textContent = cand.description;

          const applyBtn = document.createElement("button");
          applyBtn.className = "apply-btn";
          applyBtn.textContent = "適用する";
          applyBtn.onclick = () => {
            if (streamTitleInput) streamTitleInput.value = cand.title;
            if (streamDescInput) {
              streamDescInput.value = cand.description;
              window.ytDescTextarea =
                document.getElementById("yt-desc-textarea");
              if (ytDescTextarea) {
                ytDescTextarea.value = cand.description;
                window.charcount = document.getElementById("yt-desc-charcount");
                if (charcount)
                  charcount.textContent = `${cand.description.length}文字`;
              }
            }
            localStorage.setItem("savedStreamTitle", cand.title);
            localStorage.setItem("savedStreamDesc", cand.description);
            aiCandidatesModal.style.display = "none";
          };

          div.appendChild(title);
          div.appendChild(desc);
          div.appendChild(applyBtn);
          aiCandidatesList.appendChild(div);
        });

        aiCandidatesModal.style.display = "flex";
      } catch (err) {
        console.error(err);
        alert("AI生成に失敗しました。\n" + err.message);
      } finally {
        aiGenerateStreamBtn.textContent = "✨ AI生成";
        aiGenerateStreamBtn.disabled = false;
      }
    });
  }

  window.aiGenerateThemeBtn = document.getElementById("ai-generate-theme-btn");
  if (aiGenerateThemeBtn) {
    aiGenerateThemeBtn.addEventListener("click", async () => {
      const apiKey = localStorage.getItem("savedAiApiKey");
      const provider = localStorage.getItem("savedAiProvider") || "gemini";
      const aiModel =
        localStorage.getItem("savedAiModel") ||
        (provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash");

      if (!apiKey) {
        alert("AI設定タブでAPIキーを設定してください。");
        return;
      }

      window.configDate =
        document.getElementById("radio-config-date")?.value || "";
      window.configTime =
        document.getElementById("radio-config-start-time")?.value || "";
      let contextStr = "";
      if (configDate || configTime) {
        contextStr = `\n【配信日時】\n${configDate} ${configTime}\n※この配信日時（季節、時期、時間帯など）にマッチしたタイムリーなお題もいくつか含めてください。\n`;
      }

      const prompt = `あなたはプロのラジオ番組の放送作家です。
VTuberが配信で語る「10分〜20分程度のフリートーク（雑談）」に向いている、面白くて話題が広がりやすいお題（テーマ）を10個提案してください。
日常のちょっとしたあるある、季節の話題、クスッと笑える失敗談、最近の個人的な発見など、リスナーも共感しやすいお題が最適です。${contextStr}
必ず以下のJSONフォーマットのみを返してください（マークダウンやバッククォート、説明などは一切不要です）。
[
  { "title": "お題の短いタイトル", "description": "そのお題でどんな話を展開できそうかの簡単な説明（1〜2文）" },
  { "title": "別のタイトル", "description": "別の説明" }
]`;

      aiGenerateThemeBtn.textContent = "✨ 生成中...";
      aiGenerateThemeBtn.disabled = true;

      try {
        let jsonText = "";
        if (provider === "openai") {
          const res = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8,
              }),
            },
          );
          if (!res.ok) throw new Error("OpenAI API Error");
          const data = await res.json();
          jsonText = data.choices[0].message.content;
        } else {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.8 },
              }),
            },
          );
          if (!res.ok) throw new Error("Gemini API Error");
          const data = await res.json();
          jsonText = data.candidates[0].content.parts[0].text;
        }

        if (jsonText.includes("```json")) {
          jsonText = jsonText.split("```json")[1].split("```")[0].trim();
        } else if (jsonText.includes("```")) {
          jsonText = jsonText.split("```")[1].split("```")[0].trim();
        }

        const candidates = JSON.parse(jsonText);

        window.aiCandidatesModal = document.getElementById(
          "ai-candidates-modal",
        );
        window.aiCandidatesList = document.getElementById("ai-candidates-list");

        if (!aiCandidatesModal || !aiCandidatesList) return;

        aiCandidatesList.innerHTML = "";
        candidates.forEach((cand, i) => {
          const div = document.createElement("div");
          div.className = "ai-candidate-item";

          const title = document.createElement("h4");
          title.textContent = `${i + 1}. ${cand.title}`;

          const desc = document.createElement("p");
          desc.textContent = cand.description;

          const applyBtn = document.createElement("button");
          applyBtn.className = "apply-btn";
          applyBtn.textContent = "適用する";
          applyBtn.onclick = () => {
            window.radioConfigTheme =
              document.getElementById("radio-config-theme");
            if (radioConfigTheme) {
              radioConfigTheme.value = cand.title;
              // 自動的にテーマ入力欄の変更イベントを発火（もし必要なら）
              radioConfigTheme.dispatchEvent(new Event("input"));
            }
            aiCandidatesModal.style.display = "none";
          };

          div.appendChild(title);
          div.appendChild(desc);
          div.appendChild(applyBtn);
          aiCandidatesList.appendChild(div);
        });

        // モーダルのタイトルをお題用に一時変更
        const modalTitle = aiCandidatesModal.querySelector("h3");
        if (modalTitle) modalTitle.textContent = "✨ フリートークのお題候補";

        aiCandidatesModal.style.display = "flex";
      } catch (err) {
        console.error(err);
        alert("AI生成に失敗しました。\\n" + err.message);
      } finally {
        aiGenerateThemeBtn.textContent = "✨ AIにおまかせ生成";
        aiGenerateThemeBtn.disabled = false;
      }
    });
  }
});
