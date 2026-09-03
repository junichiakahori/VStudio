// =====================================================================
// wizard-youtube-api.js: YouTube OAuth連携・配信枠作成/更新・サムネイル送信
// =====================================================================

(function() {
  window.wizardActiveSlot = "morning"; // 'morning' | 'evening'

  const GREETING_DEFAULTS = {
    morning: "おはようございます！AIキャスターの「とろろ」がお届けする朝のニュース配信へようこそ！☀️\n今日も最新の注目トピックスをわかりやすくお伝えします。",
    evening: "こんばんは！AIキャスターの「とろろ」がお届けする夜のニュースまとめ配信へようこそ！🌙\n今日一日の重要な動きや話題のニュースをぎゅっと凝縮してお届けします。",
    radio: "みなさん、ラジオ配信へようこそ！AIパーソナリティの「とろろ」です！📻\nリラックスしながら楽しんでいってくださいね。",
    chat: "みなさん、雑談配信へようこそ！AI VTuberの「とろろ」です！✨\nコメントでたくさんお話ししましょう！"
  };

  function showYtApiFeedback(msg, isSuccess = true, isWarning = false) {
    const el = document.getElementById("yt-api-feedback");
    if (!el) return;
    el.style.display = "block";
    el.textContent = msg;
    if (isWarning) {
      el.style.background = "rgba(255, 180, 0, 0.15)";
      el.style.borderColor = "#ffb400";
      el.style.color = "#ffeaa7";
    } else if (isSuccess) {
      el.style.background = "rgba(0, 230, 118, 0.15)";
      el.style.borderColor = "#00e676";
      el.style.color = "#b8e994";
    } else {
      el.style.background = "rgba(255, 118, 117, 0.15)";
      el.style.borderColor = "#ff7675";
      el.style.color = "#ff7675";
    }
  }
  window.showYtApiFeedback = showYtApiFeedback;

  function generateStreamReservationMetadata(forceUpdate = false) {
    const titleInput = document.getElementById("wizard-yt-title");
    const descInput = document.getElementById("wizard-yt-desc");
    if (!titleInput || !descInput) return;

    const scheduledTime = typeof window.getWizardScheduledStartTime === "function" ? window.getWizardScheduledStartTime() : "";
    let targetDate = new Date();
    if (scheduledTime) {
      const parsed = new Date(scheduledTime);
      if (!isNaN(parsed.getTime())) targetDate = parsed;
    }

    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();
    const isMorning = (window.wizardActiveSlot === "morning");
    const dateStr = `${m}/${d}`;

    const charName = (window.openerWin && window.openerWin.currentModelId && window.openerWin.currentModelId.includes("zunda")) ? "ずんだもん" : "とろろ";

    let defaultTitle = "";
    let defaultDesc = "";

    if (window.selectedMode === "news") {
      const newsItems = (window.openerWin && window.openerWin.latestFetchedNews) ? window.openerWin.latestFetchedNews : [];
      let headlineStr = "";
      if (newsItems.length > 0) {
        const topHeadlines = newsItems.slice(0, 3).map(n => n.title.replace(/【.*?】/g, "").trim()).filter(Boolean);
        if (topHeadlines.length > 0) {
          headlineStr = ` | ${topHeadlines.join(" / ")}`;
        }
      }

      if (isMorning) {
        defaultTitle = `【朝ニュース】${dateStr} 最新ニュースダイジェスト【AITuber ${charName}】${headlineStr}`;
      } else {
        defaultTitle = `【夜ニュース】${dateStr} 今日の重要ニュースまとめ【AITuber ${charName}】${headlineStr}`;
      }

      const greetingTemplate = isMorning
        ? (localStorage.getItem("savedGreeting_news_morning") || GREETING_DEFAULTS.morning)
        : (localStorage.getItem("savedGreeting_news_evening") || GREETING_DEFAULTS.evening);

      let newsListSection = "";
      if (newsItems.length > 0) {
        const lines = newsItems.map((item, idx) => {
          const cat = item.categoryName ? `[${item.categoryName}] ` : "";
          const link = item.link ? `\n   🔗 ${item.link}` : "";
          return `📌 ${idx + 1}. ${cat}${item.title}${link}`;
        });
        newsListSection = `\n━━━━━━━━━━━━━━━━━━━━\n📰 本日の配信ラインナップ\n━━━━━━━━━━━━━━━━━━━━\n${lines.join("\n\n")}\n`;
      } else {
        newsListSection = `\n━━━━━━━━━━━━━━━━━━━━\n📰 本日の配信ラインナップ\n━━━━━━━━━━━━━━━━━━━━\n※ 配信開始までに最新ニュースを自動編成してお届けします。\n`;
      }

      defaultDesc = `${greetingTemplate}\n${newsListSection}
━━━━━━━━━━━━━━━━━━━━
⏰ タイムスケジュール
━━━━━━━━━━━━━━━━━━━━
・オープニング挨拶
・最新トピックス紹介
・エンディング・次回予告

━━━━━━━━━━━━━━━━━━━━
💡 この配信について
━━━━━━━━━━━━━━━━━━━━
完全自律型 AI VTuber によるライブ配信システム「VStudio」から自動配信しています。
最新のLLM・音声合成技術を駆使して、リアルタイムな情報をお届けします。

#AITuber #ニュース #VTuber #Live2D #AIニュース`;

    } else if (window.selectedMode === "radio") {
      defaultTitle = `【作業用ラジオ】${dateStr} まったりAIラジオ配信【AITuber ${charName}】`;
      const greetingTemplate = localStorage.getItem("savedGreeting_radio") || GREETING_DEFAULTS.radio;
      defaultDesc = `${greetingTemplate}\n\n作業やお休みの前のお供にどうぞ！\n#AITuber #ラジオ #作業用BGM`;
    } else {
      defaultTitle = `【雑談配信】${dateStr} AIとおしゃべりしよう！【AITuber ${charName}】`;
      const greetingTemplate = localStorage.getItem("savedGreeting_chat") || GREETING_DEFAULTS.chat;
      defaultDesc = `${greetingTemplate}\n\nコメントどしどしお待ちしています！\n#AITuber #雑談 #Live2D`;
    }

    if (forceUpdate || !titleInput.value) {
      titleInput.value = defaultTitle;
    }
    if (forceUpdate || !descInput.value) {
      descInput.value = defaultDesc;
    }
  }
  window.generateStreamReservationMetadata = generateStreamReservationMetadata;
  window.updateSuggestedMetadata = generateStreamReservationMetadata;

  function updateStep4Inputs() {
    const ytInput = document.getElementById("wizard-yt-input");
    if (ytInput && !ytInput.value && window.openerWin) {
      const mainYt = window.openerWin.document.getElementById("youtube-video-input");
      if (mainYt && mainYt.value) ytInput.value = mainYt.value;
    }

    const obsToggle = document.getElementById("wizard-obs-stream-toggle");
    if (obsToggle && window.openerWin) {
      const mainObsToggle = window.openerWin.document.getElementById("obs-auto-start-toggle");
      if (mainObsToggle) obsToggle.checked = mainObsToggle.checked;
    }

    const schedToggle = document.getElementById("wizard-start-schedule-toggle");
    if (schedToggle && window.openerWin) {
      const mainSchedToggle = window.openerWin.document.getElementById("start-schedule-toggle");
      if (mainSchedToggle) schedToggle.checked = mainSchedToggle.checked;
    }

    const schedTime = document.getElementById("wizard-start-time");
    if (schedTime && !schedTime.value && window.openerWin) {
      const mainSchedTime = window.openerWin.document.getElementById("start-schedule-time");
      if (mainSchedTime && mainSchedTime.value) schedTime.value = mainSchedTime.value;
    }

    const activeSlot = (window.openerWin && window.openerWin.activeStreamSlot) ? window.openerWin.activeStreamSlot : (localStorage.getItem("savedStreamSlot") || "morning");
    window.wizardActiveSlot = activeSlot;
    const morningBtn = document.getElementById("wizard-slot-morning-btn");
    const eveningBtn = document.getElementById("wizard-slot-evening-btn");

    if (morningBtn && eveningBtn) {
      if (activeSlot === "morning") {
        morningBtn.style.background = "rgba(255,180,0,0.25)";
        morningBtn.style.borderColor = "#ffb400";
        morningBtn.style.color = "#ffb400";
        eveningBtn.style.background = "rgba(255,255,255,0.05)";
        eveningBtn.style.borderColor = "rgba(255,255,255,0.15)";
        eveningBtn.style.color = "var(--text-muted)";
      } else {
        morningBtn.style.background = "rgba(255,255,255,0.05)";
        morningBtn.style.borderColor = "rgba(255,255,255,0.15)";
        morningBtn.style.color = "var(--text-muted)";
        eveningBtn.style.background = "rgba(108,92,231,0.25)";
        eveningBtn.style.borderColor = "#a29bfe";
        eveningBtn.style.color = "#a29bfe";
      }
    }

    const titleInput = document.getElementById("wizard-yt-title");
    const descInput = document.getElementById("wizard-yt-desc");
    if (titleInput && descInput) {
      const savedTitle = (window.openerWin && window.openerWin.localStorage.getItem(`savedStreamTitle_${activeSlot}`)) || localStorage.getItem(`savedStreamTitle_${activeSlot}`);
      const savedDesc = (window.openerWin && window.openerWin.localStorage.getItem(`savedStreamDesc_${activeSlot}`)) || localStorage.getItem(`savedStreamDesc_${activeSlot}`);
      if (savedTitle) titleInput.value = savedTitle;
      if (savedDesc) descInput.value = savedDesc;
      if (!titleInput.value || !descInput.value) {
        generateStreamReservationMetadata(false);
      }
    }

    checkYtApiAuthStatus();
  }
  window.updateStep4Inputs = updateStep4Inputs;

  async function checkYtApiAuthStatus() {
    const statusBadge = document.getElementById("yt-auth-status-badge");
    const channelNameEl = document.getElementById("yt-auth-channel-name");
    const authBtn = document.getElementById("wizard-btn-yt-auth");
    if (!statusBadge) return;

    try {
      const res = await fetch("/api/youtube/auth_status", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated) {
        statusBadge.textContent = "🟢 連携済み";
        statusBadge.style.color = "#00e676";
        if (channelNameEl && data.channel_title) {
          channelNameEl.textContent = `(${data.channel_title})`;
          channelNameEl.style.display = "inline";
        }
        if (authBtn) {
          authBtn.textContent = "🔑 再連携 (別アカウント)";
          authBtn.style.background = "rgba(255,255,255,0.08)";
        }
      } else {
        statusBadge.textContent = "🔴 未連携";
        statusBadge.style.color = "#ff7675";
        if (channelNameEl) channelNameEl.style.display = "none";
        if (authBtn) {
          authBtn.textContent = "🔑 Google連携してログイン";
          authBtn.style.background = "linear-gradient(135deg, #e17055, #d63031)";
        }
      }
    } catch (e) {
      statusBadge.textContent = "⚪ サーバー未接続";
      statusBadge.style.color = "var(--text-muted)";
    }
  }

  // 配信枠一覧から選択モーダル ロジック
  let cachedBroadcasts = [];
  let activeBroadcastFilter = "all";

  window.openBroadcastPickerModal = function() {
    const m = document.getElementById("modal-broadcast-picker");
    if (m) m.style.display = "flex";
    loadAndRenderBroadcasts();
  };

  window.closeBroadcastPickerModal = function() {
    const m = document.getElementById("modal-broadcast-picker");
    if (m) m.style.display = "none";
  };

  async function loadAndRenderBroadcasts() {
    const listContainer = document.getElementById("broadcast-picker-list");
    if (!listContainer) return;
    listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:20px;">⏳ 配信枠一覧を取得中...</div>';
    try {
      const res = await fetch("/api/youtube/list_broadcasts", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        cachedBroadcasts = data.items;
        renderBroadcastList();
      } else {
        listContainer.innerHTML = `<div style="color:#ff7675; font-size:0.8rem; text-align:center; padding:20px;">⚠️ 取得エラー: ${data.error || "未認証です。「🔑 Google連携」を行ってください。"}</div>`;
      }
    } catch (err) {
      listContainer.innerHTML = `<div style="color:#ff7675; font-size:0.8rem; text-align:center; padding:20px;">❌ 通信エラー: ${err.message}</div>`;
    }
  }

  function renderBroadcastList() {
    const listContainer = document.getElementById("broadcast-picker-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    const filtered = cachedBroadcasts.filter(item => {
      if (activeBroadcastFilter === "all") return true;
      return item.lifeCycleStatus === activeBroadcastFilter;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:20px;">該当する配信枠がありません。</div>';
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement("div");
      card.style.cssText = "background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px; display:flex; gap:12px; align-items:center; cursor:pointer; transition:all 0.2s;";
      card.onmouseenter = () => { card.style.background = "rgba(0,210,211,0.1)"; card.style.borderColor = "#00d2d3"; };
      card.onmouseleave = () => { card.style.background = "rgba(255,255,255,0.04)"; card.style.borderColor = "rgba(255,255,255,0.1)"; };

      const thumbUrl = item.thumbnails?.medium?.url || item.thumbnails?.default?.url || "";
      const thumbHtml = thumbUrl ? `<img src="${thumbUrl}" style="width:96px; height:54px; object-fit:cover; border-radius:4px; flex-shrink:0;">` : '<div style="width:96px; height:54px; background:#222; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#666; flex-shrink:0;">No Image</div>';

      let statusBadge = "";
      if (item.lifeCycleStatus === "ready" || item.lifeCycleStatus === "created") {
        statusBadge = '<span style="background:rgba(0,210,211,0.2); color:#00ffff; font-size:0.65rem; padding:2px 6px; border-radius:4px;">📅 予約枠</span>';
      } else if (item.lifeCycleStatus === "live") {
        statusBadge = '<span style="background:rgba(255,71,87,0.2); color:#ff4757; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:bold;">🔴 配信中</span>';
      } else {
        statusBadge = `<span style="background:rgba(255,255,255,0.1); color:#aaa; font-size:0.65rem; padding:2px 6px; border-radius:4px;">${item.lifeCycleStatus}</span>`;
      }

      let schedTimeStr = item.scheduledStartTime ? (typeof window.formatScheduleDateTime === "function" ? window.formatScheduleDateTime(item.scheduledStartTime) : item.scheduledStartTime) : "日時未定";

      card.innerHTML = `
        ${thumbHtml}
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            ${statusBadge}
            <span style="font-size:0.7rem; color:var(--text-muted);">⏰ ${schedTimeStr}</span>
          </div>
          <div style="font-weight:bold; font-size:0.85rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.title}">${item.title}</div>
          <div style="font-size:0.7rem; color:#888; font-family:monospace; margin-top:2px;">ID: ${item.id}</div>
        </div>
        <button style="background:linear-gradient(135deg, #0984e3, #00cec9); border:none; color:#fff; font-size:0.75rem; font-weight:bold; padding:6px 12px; border-radius:6px; cursor:pointer; flex-shrink:0;">この枠を選択</button>
      `;

      card.addEventListener("click", () => {
        const ytInput = document.getElementById("wizard-yt-input");
        const titleInput = document.getElementById("wizard-yt-title");
        const descInput = document.getElementById("wizard-yt-desc");
        if (ytInput) ytInput.value = item.id;
        if (titleInput && item.title) titleInput.value = item.title;
        if (descInput && item.description) descInput.value = item.description;

        if (item.scheduledStartTime) {
          const d = new Date(item.scheduledStartTime);
          if (!isNaN(d.getTime()) && typeof window.setWizardStartTimeDate === "function") {
            window.setWizardStartTimeDate(d);
          }
        }

        window.closeBroadcastPickerModal();
        showYtApiFeedback(`✅ 既存枠「${item.title}」を読み込みました！ (ID: ${item.id})`, true);
      });

      listContainer.appendChild(card);
    });
  }

  function initYouTubeAPIHandlers() {
    // 冒頭挨拶テンプレート モーダル制御
    function openGreetingModal() {
      const m = document.getElementById("modal-greeting-template");
      if (!m) return;
      const tplM = document.getElementById("tpl-greeting-morning");
      const tplE = document.getElementById("tpl-greeting-evening");
      const tplR = document.getElementById("tpl-greeting-radio");
      const tplC = document.getElementById("tpl-greeting-chat");

      if (tplM) tplM.value = localStorage.getItem("savedGreeting_news_morning") || GREETING_DEFAULTS.morning;
      if (tplE) tplE.value = localStorage.getItem("savedGreeting_news_evening") || GREETING_DEFAULTS.evening;
      if (tplR) tplR.value = localStorage.getItem("savedGreeting_radio") || GREETING_DEFAULTS.radio;
      if (tplC) tplC.value = localStorage.getItem("savedGreeting_chat") || GREETING_DEFAULTS.chat;

      m.style.display = "flex";
    }

    function closeGreetingModal() {
      const m = document.getElementById("modal-greeting-template");
      if (m) m.style.display = "none";
    }

    document.getElementById("btn-open-greeting-modal")?.addEventListener("click", openGreetingModal);
    document.getElementById("btn-close-greeting-modal")?.addEventListener("click", closeGreetingModal);
    document.getElementById("btn-cancel-greeting-template")?.addEventListener("click", closeGreetingModal);
    document.getElementById("modal-greeting-template")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-greeting-template") closeGreetingModal();
    });

    document.getElementById("btn-reset-greeting-template")?.addEventListener("click", () => {
      const tplM = document.getElementById("tpl-greeting-morning");
      const tplE = document.getElementById("tpl-greeting-evening");
      const tplR = document.getElementById("tpl-greeting-radio");
      const tplC = document.getElementById("tpl-greeting-chat");

      if (tplM) tplM.value = GREETING_DEFAULTS.morning;
      if (tplE) tplE.value = GREETING_DEFAULTS.evening;
      if (tplR) tplR.value = GREETING_DEFAULTS.radio;
      if (tplC) tplC.value = GREETING_DEFAULTS.chat;
      if (typeof window.showWizardToast === "function") {
        window.showWizardToast("🔄 冒頭挨拶テンプレートを初期値に戻しました", true);
      }
    });

    document.getElementById("btn-save-greeting-template")?.addEventListener("click", () => {
      const tplM = document.getElementById("tpl-greeting-morning")?.value;
      const tplE = document.getElementById("tpl-greeting-evening")?.value;
      const tplR = document.getElementById("tpl-greeting-radio")?.value;
      const tplC = document.getElementById("tpl-greeting-chat")?.value;

      if (tplM !== undefined) localStorage.setItem("savedGreeting_news_morning", tplM);
      if (tplE !== undefined) localStorage.setItem("savedGreeting_news_evening", tplE);
      if (tplR !== undefined) localStorage.setItem("savedGreeting_radio", tplR);
      if (tplC !== undefined) localStorage.setItem("savedGreeting_chat", tplC);

      closeGreetingModal();
      generateStreamReservationMetadata(true);
      showYtApiFeedback("✅ 冒頭挨拶テンプレートを保存し、説明欄を更新しました！", true);
    });

    // スロット切り替えボタン
    document.getElementById("wizard-slot-morning-btn")?.addEventListener("click", () => {
      window.wizardActiveSlot = "morning";
      updateStep4Inputs();
    });
    document.getElementById("wizard-slot-evening-btn")?.addEventListener("click", () => {
      window.wizardActiveSlot = "evening";
      updateStep4Inputs();
    });

    // 枠一覧選択モーダル開閉
    document.getElementById("wizard-btn-open-picker")?.addEventListener("click", () => {
      window.openBroadcastPickerModal();
    });
    document.getElementById("btn-close-broadcast-picker")?.addEventListener("click", () => {
      window.closeBroadcastPickerModal();
    });
    document.getElementById("btn-refresh-broadcast-picker")?.addEventListener("click", () => {
      loadAndRenderBroadcasts();
    });
    document.querySelectorAll(".broadcast-filter-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".broadcast-filter-tab").forEach(t => {
          t.style.background = "rgba(255,255,255,0.05)";
          t.style.borderColor = "rgba(255,255,255,0.15)";
          t.style.color = "var(--text-muted)";
        });
        tab.style.background = "rgba(0,210,211,0.25)";
        tab.style.borderColor = "#00d2d3";
        tab.style.color = "#00d2d3";
        activeBroadcastFilter = tab.getAttribute("data-filter") || "all";
        renderBroadcastList();
      });
    });

    // Google連携
    document.getElementById("wizard-btn-yt-auth")?.addEventListener("click", async () => {
      showYtApiFeedback("🌐 ブラウザでGoogleログイン・アクセス許可を行ってください...", true, true);
      try {
        const res = await fetch("/api/youtube/auth", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          showYtApiFeedback(`✅ Google連携が完了しました！（チャンネル: ${data.channel_title}）`, true);
          checkYtApiAuthStatus();
        } else {
          showYtApiFeedback(`❌ 連携に失敗しました: ${data.error || "ユーザーキャンセルまたはエラー"}`, false);
        }
      } catch (err) {
        showYtApiFeedback(`❌ 連携通信エラー: ${err.message}`, false);
      }
    });

    // 枠自動作成
    document.getElementById("wizard-btn-yt-create")?.addEventListener("click", async () => {
      const title = document.getElementById("wizard-yt-title")?.value?.trim() || "";
      const desc = document.getElementById("wizard-yt-desc")?.value || "";
      const scheduledTime = typeof window.getWizardScheduledStartTime === "function" ? window.getWizardScheduledStartTime() : "";
      const privacy = document.getElementById("wizard-yt-privacy")?.value || "public";
      const madeForKids = document.getElementById("wizard-yt-kids")?.checked || false;

      if (!title) {
        showYtApiFeedback("⚠️ 配信タイトルを入力してください。", false);
        return;
      }

      const btn = document.getElementById("wizard-btn-yt-create");
      btn.disabled = true;
      btn.textContent = "⏳ 枠を作成中...";
      showYtApiFeedback("🚀 YouTube上に新規配信予約枠を作成中...", true, true);

      try {
        const authCheck = await fetch("/api/youtube/auth_status");
        const authData = await authCheck.json();
        if (!authData.authenticated) {
          showYtApiFeedback("⚠️ 先に「🔑 Google連携」ボタンを押してログインしてください。", false);
          btn.disabled = false;
          btn.textContent = "🚀 枠を新規作成";
          return;
        }

        const res = await fetch("/api/youtube/create_broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            description: desc,
            scheduled_start_time: scheduledTime,
            privacy_status: privacy,
            made_for_kids: madeForKids
          })
        });
        const data = await res.json();
        if (data.success && data.id) {
          const ytInput = document.getElementById("wizard-yt-input");
          if (ytInput) ytInput.value = data.id;
          showYtApiFeedback(`✅ YouTube枠「${data.title}」を自動作成しました！ (ID: ${data.id})`, true);

          try {
            const thumbCanvas = (window.openerWin && window.openerWin.document) ? window.openerWin.document.getElementById("news-thumb-canvas") : null;
            if (thumbCanvas) {
              const base64 = thumbCanvas.toDataURL("image/png");
              await fetch("/api/youtube/set_thumbnail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ video_id: data.id, image_base64: base64 })
              });
            }
          } catch(e) {}
        } else {
          showYtApiFeedback(`❌ 枠作成エラー: ${data.error || "不明なエラー"}`, false);
        }
      } catch (err) {
        showYtApiFeedback(`❌ 通信エラー: ${err.message}`, false);
      } finally {
        btn.disabled = false;
        btn.textContent = "🚀 枠を新規作成";
      }
    });

    // 枠情報更新
    document.getElementById("wizard-btn-yt-update")?.addEventListener("click", async () => {
      const videoId = document.getElementById("wizard-yt-input")?.value?.trim() || "";
      const title = document.getElementById("wizard-yt-title")?.value?.trim() || "";
      const desc = document.getElementById("wizard-yt-desc")?.value || "";
      const scheduledTime = typeof window.getWizardScheduledStartTime === "function" ? window.getWizardScheduledStartTime() : "";
      const privacy = document.getElementById("wizard-yt-privacy")?.value || "public";
      const madeForKids = document.getElementById("wizard-yt-kids")?.checked || false;

      if (!videoId) {
        showYtApiFeedback("⚠️ 更新対象のYouTube動画IDを入力するか、「枠を自動作成」してください。", false);
        return;
      }
      if (!title) {
        showYtApiFeedback("⚠️ 配信タイトルを入力してください。", false);
        return;
      }

      const btn = document.getElementById("wizard-btn-yt-update");
      btn.disabled = true;
      btn.textContent = "⏳ 更新中...";
      showYtApiFeedback("📝 YouTubeの配信枠情報を更新中...", true, true);

      try {
        const res = await fetch("/api/youtube/update_broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: videoId,
            title: title,
            description: desc,
            scheduled_start_time: scheduledTime,
            privacy_status: privacy,
            made_for_kids: madeForKids
          })
        });
        const data = await res.json();
        if (data.success) {
          showYtApiFeedback(`✅ YouTube枠 (${videoId}) のタイトル・説明文・配信予定時刻を更新しました！`, true);
        } else {
          showYtApiFeedback(`❌ 更新エラー: ${data.error || "不明なエラー"}`, false);
        }
      } catch (err) {
        showYtApiFeedback(`❌ 通信エラー: ${err.message}`, false);
      } finally {
        btn.disabled = false;
        btn.textContent = "📝 既存枠を更新";
      }
    });

    // サムネイル送信
    document.getElementById("wizard-btn-yt-thumb")?.addEventListener("click", async () => {
      const videoId = document.getElementById("wizard-yt-input")?.value?.trim() || "";
      if (!videoId) {
        showYtApiFeedback("⚠️ サムネイル反映対象のYouTube動画IDを入力するか、「枠を自動作成」してください。", false);
        return;
      }

      const btn = document.getElementById("wizard-btn-yt-thumb");
      btn.disabled = true;
      btn.textContent = "⏳ サムネイル送信中...";

      let base64 = "";
      try {
        if (window.openerWin && window.openerWin.newsThumbnailGenerator && typeof window.openerWin.newsThumbnailGenerator.generateThumbnailBase64 === "function") {
          base64 = await window.openerWin.newsThumbnailGenerator.generateThumbnailBase64();
        }
        if (!base64 && window.openerWin && window.openerWin.document) {
          const thumbCanvas = window.openerWin.document.getElementById("news-thumb-canvas");
          if (thumbCanvas) base64 = thumbCanvas.toDataURL("image/png");
        }
      } catch(e) {}

      if (!base64) {
        showYtApiFeedback("⚠️ サムネイル画像を自動生成できませんでした。「🎨 サムネイルを編集」ボタンを押してご確認ください。", false);
        btn.disabled = false;
        btn.textContent = "🖼️ サムネイル反映";
        return;
      }

      showYtApiFeedback("🖼️ サムネイル画像をYouTubeに送信中...", true, true);
      try {
        const res = await fetch("/api/youtube/set_thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: videoId, image_base64: base64 })
        });
        const data = await res.json();
        if (data.success) {
          showYtApiFeedback(`✅ サムネイル画像をYouTube枠 (${videoId}) に反映完了しました！🎉`, true);
        } else {
          showYtApiFeedback(`❌ サムネイル反映エラー: ${data.error || "不明なエラー"}`, false);
        }
      } catch (err) {
        showYtApiFeedback(`❌ 通信エラー: ${err.message}`, false);
      } finally {
        btn.disabled = false;
        btn.textContent = "🖼️ サムネイル反映";
      }
    });

    // サムネイルエディタモーダルを開く
    document.getElementById("wizard-btn-edit-thumb")?.addEventListener("click", () => {
      if (window.openerWin && typeof window.openerWin.openNewsThumbnailModal === "function") {
        window.openerWin.openNewsThumbnailModal();
        window.openerWin.focus();
      }
    });

    // メタデータ再生成ボタン
    document.getElementById("wizard-btn-yt-meta-suggest")?.addEventListener("click", () => {
      generateStreamReservationMetadata(true);
    });

    // チャンネルからライブ枠検知
    document.getElementById("wizard-yt-detect-live-btn")?.addEventListener("click", async () => {
      const channelVal = document.getElementById("wizard-yt-channel")?.value.trim() || "";
      if (!channelVal) {
        if (typeof window.showWizardToast === "function") {
          window.showWizardToast("⚠️ 配信者ID / チャンネル名（例: @drone.akahori）を入力してください", false);
        }
        return;
      }
      const btn = document.getElementById("wizard-yt-detect-live-btn");
      const origText = btn.textContent;
      btn.textContent = "🔍 枠検出中...";
      btn.disabled = true;

      try {
        const res = await fetch(`/api/youtube/detect_live?channel=${encodeURIComponent(channelVal)}`, { cache: "no-store" });
        const data = await res.json();
        if (data.success && data.video_id) {
          const ytInput = document.getElementById("wizard-yt-input");
          if (ytInput) ytInput.value = data.video_id;
          const statusEl = document.getElementById("wizard-yt-live-status");
          if (statusEl) {
            statusEl.textContent = `🟢 検出成功: ${data.title || data.video_id}`;
            statusEl.style.color = "#00e676";
          }
          if (typeof window.showWizardToast === "function") {
            window.showWizardToast(`✅ ライブ枠を検出しました！ (ID: ${data.video_id})`, true);
          }
        } else {
          const statusEl = document.getElementById("wizard-yt-live-status");
          if (statusEl) {
            statusEl.textContent = `⚠️ ${data.message || "現在配信中/予約中の枠が見つかりませんでした"}`;
            statusEl.style.color = "#ffeaa7";
          }
        }
      } catch (err) {
        const statusEl = document.getElementById("wizard-yt-live-status");
        if (statusEl) {
          statusEl.textContent = `❌ エラー: ${err.message}`;
          statusEl.style.color = "#ff7675";
        }
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initYouTubeAPIHandlers);
  } else {
    initYouTubeAPIHandlers();
  }
})();
