// =====================================================================
// wizard-youtube-api.js: YouTube OAuth連携・配信枠作成/更新・サムネイル送信
// =====================================================================

(function() {
  window.wizardActiveSlot = "morning"; // 'morning' | 'evening'

  let titlePatternIndex = 0;

  const GREETING_DEFAULTS = {
    morning: "おはとろ〜！バーチャルキャスターのとろろがお送りする朝の最新ニュース生配信！\n出勤・通学前にサクッと今日の重要トピックをチェックしちゃいましょう☀️",
    evening: "こんとろ〜！バーチャルキャスターのとろろがお送りする夜の総まとめニュース生配信！\n一日の終わりに今日の重要トピックをまるごとおさらいしちゃいます🌙",
    radio: "みなさん、ラジオ配信へようこそ！AIパーソナリティの「とろろ」です！📻\nリラックスしながら楽しんでいってくださいね。",
    chat: "みなさん、雑談配信へようこそ！AI VTuberの「とろろ」です！✨\nコメントでたくさんお話ししましょう！"
  };

  function getTitleInputElement() {
    return document.getElementById("wizard-suggested-title") || document.getElementById("wizard-yt-title");
  }

  function getDescInputElement() {
    return document.getElementById("wizard-suggested-desc") || document.getElementById("wizard-yt-desc");
  }

  function showYtApiFeedback(msg, isSuccess = true, isWarning = false) {
    const el = document.getElementById("yt-api-feedback-msg") || document.getElementById("yt-api-feedback");
    if (!el) {
      if (typeof window.showWizardToast === "function") {
        window.showWizardToast(msg, isSuccess);
      }
      return;
    }
    el.style.display = "block";
    el.textContent = msg;
    if (isWarning) {
      el.style.background = "rgba(255, 180, 0, 0.15)";
      el.style.border = "1px solid #ffb400";
      el.style.color = "#ffeaa7";
    } else if (isSuccess) {
      el.style.background = "rgba(0, 230, 118, 0.15)";
      el.style.border = "1px solid #00e676";
      el.style.color = "#b8e994";
    } else {
      el.style.background = "rgba(255, 118, 117, 0.15)";
      el.style.border = "1px solid #ff7675";
      el.style.color = "#ff7675";
    }
  }
  window.showYtApiFeedback = showYtApiFeedback;

  function generateStreamReservationMetadata(forceUpdate = false, cyclePattern = false) {
    const titleInput = getTitleInputElement();
    const descInput = getDescInputElement();
    if (!titleInput || !descInput) return;

    if (cyclePattern) {
      titlePatternIndex++;
    }

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
      const totalNewsCount = newsItems.length > 0 ? newsItems.length : 250;

      // いつもの定番タイトルパターン（サイコロで切り替え可能）
      const morningPatterns = [
        `【${dateStr} 朝の最新ニュース速報】出勤・通学前にサクッとチェック！☀️【AITuber生放送】`,
        `【${dateStr} 朝の生放送】今日の最新ニュース速報＆注目トピックまとめ！☀️【${charName} / AITuber】`,
        `【${dateStr} 朝ニュース】今日の重要トピックをサクッとおさらい！☀️【AITuber ${charName}】`
      ];

      const eveningPatterns = [
        `【${dateStr} 夜の最新ニュース総ざらい】今日1日の重要トピックまとめ！🌙【AITuber生放送】`,
        `【${dateStr} 夜の生放送】今日1日の重要ニュースを総ざらい！今夜のまとめ生配信🌙【${charName} / AITuber】`,
        `【${dateStr} 夜ニュース】一日の終わりに今日の重要トピック総まとめ！🌙【AITuber ${charName}】`
      ];

      const patterns = isMorning ? morningPatterns : eveningPatterns;
      defaultTitle = patterns[titlePatternIndex % patterns.length];

      let greetingTemplate = (isMorning
        ? (localStorage.getItem("savedGreeting_news_morning") || GREETING_DEFAULTS.morning)
        : (localStorage.getItem("savedGreeting_news_evening") || GREETING_DEFAULTS.evening)).trim();

      const headerLabel = isMorning ? "本日の注目ニュース：" : "今回の振り返り項目：";

      // 挨拶文内に見出しが含まれていない場合のみ見出しを追加（2重防止）
      if (!greetingTemplate.includes("注目ニュース") && !greetingTemplate.includes("振り返り項目")) {
        greetingTemplate += `\n\n${headerLabel}`;
      }

      let newsListLines = "";
      if (newsItems.length > 0) {
        const topNews = newsItems.slice(0, 15).map(item => {
          const media = item.mediaName ? ` - ${item.mediaName}` : "";
          return `・${item.title}${media}`;
        });
        newsListLines = `${topNews.join("\n")}\n...他 全${totalNewsCount}件`;
      } else {
        newsListLines = `・最新の重要ニューストピックスをピックアップ\n...他 多数`;
      }

      defaultDesc = `${greetingTemplate}
${newsListLines}

忙しいあなたも、これを見れば今日のニュースがバッチリわかる！今日も楽しくおしゃべりしながら見ていってね！

◆オリジナルハッシュタグ
#${charName}ニュース #${charName}生放送 #今日の気になる

◆X（旧Twitter）はこちら！
https://x.com/drone_akahori

◆クレジット表記
・Live2Dモデル: 「${charName}」© Live2D Inc. (Live2D Creative Studio サンプルモデル)
・VOICE：VOICEVOX ずんだもん
・BGM：ドローン赤堀 - Nukadaki
・配信背景：喫茶あかほり ミクスタカフェ

◆配信のルール・お願い
・話題に出ていない他の配信者さんの名前を出すのは控えてね！
・他の配信者さんの枠で${charName}の名前を出す「伝書鳩行為」もNGだよ！
・荒らしやスパムを見かけても、反応せずにブロック＆スルーのご協力をお願いします。
みんなで楽しく居心地の良い配信にしようね！チャンネル登録と高評価もよろしくお願いします！`;

    } else if (window.selectedMode === "radio") {
      defaultTitle = `【作業用ラジオ】${dateStr} まったりAIラジオ配信【AITuber ${charName}】`;
      const greetingTemplate = localStorage.getItem("savedGreeting_radio") || GREETING_DEFAULTS.radio;
      defaultDesc = `${greetingTemplate}\n\n作業やお休みの前のお供にどうぞ！\n#AITuber #ラジオ #作業用BGM`;
    } else {
      defaultTitle = `【雑談生放送】${dateStr} AIとおしゃべりしよう！【AITuber ${charName}】`;
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
    // 1. 配信者ID / チャンネル名 (ハンドル) の復元
    const channelInput = document.getElementById("wizard-yt-channel");
    if (channelInput && !channelInput.value) {
      const savedChan = (window.openerWin && window.openerWin.localStorage.getItem("savedYoutubeChannel")) ||
                        localStorage.getItem("savedYoutubeChannel") ||
                        (window.openerWin && window.openerWin.localStorage.getItem("savedYoutubeId")) ||
                        localStorage.getItem("savedYoutubeId") ||
                        "@drone.akahori";
      if (savedChan.startsWith("@") || (savedChan.length !== 11 && !savedChan.includes("watch?v="))) {
        channelInput.value = savedChan;
      } else {
        channelInput.value = "@drone.akahori";
      }
    }

    // 2. 個別の配信枠・動画ID (Video ID) の復元
    const ytInput = document.getElementById("wizard-yt-input");
    if (ytInput && !ytInput.value) {
      const savedVid = (window.openerWin && window.openerWin.localStorage.getItem("savedYoutubeVideoId")) ||
                       localStorage.getItem("savedYoutubeVideoId") || "";
      const mainYt = window.openerWin?.document?.getElementById("youtube-video-input");
      const mainVal = (mainYt?.value || "").trim();

      if (savedVid && savedVid.length === 11 && !savedVid.startsWith("@")) {
        ytInput.value = savedVid;
      } else if (mainVal && mainVal.length === 11 && !mainVal.startsWith("@")) {
        ytInput.value = mainVal;
      } else if (mainVal.includes("watch?v=")) {
        const m = mainVal.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (m) ytInput.value = m[1];
      }
      updateYtInputDot();
    }

    const obsToggle = document.getElementById("wizard-obs-stream-toggle");
    if (obsToggle && window.openerWin) {
      const mainObsToggle = window.openerWin.document.getElementById("news-obs-auto-stream-toggle") || window.openerWin.document.getElementById("obs-auto-start-toggle");
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

    if (!window.wizardActiveSlot) {
      const currentHour = new Date().getHours();
      const autoSlot = (currentHour >= 4 && currentHour < 12) ? "morning" : "evening";
      const activeSlot = (window.openerWin && window.openerWin.activeStreamSlot) ? window.openerWin.activeStreamSlot : autoSlot;
      window.wizardActiveSlot = activeSlot;
    }
    const activeSlot = window.wizardActiveSlot;
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

    const titleInput = getTitleInputElement();
    const descInput = getDescInputElement();
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
    const statusBadge = document.getElementById("yt-oauth-badge") || document.getElementById("yt-auth-status-badge");
    const channelNameEl = document.getElementById("yt-auth-channel-name");
    const authBtn = document.getElementById("btn-yt-oauth-login") || document.getElementById("wizard-btn-yt-auth");
    if (!statusBadge) return;

    try {
      const res = await fetch("/api/youtube/oauth_status", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated) {
        statusBadge.textContent = `🟢 連携済み${data.channel_title ? ' (' + data.channel_title + ')' : ''}`;
        statusBadge.style.color = "#00e676";
        if (channelNameEl && data.channel_title) {
          channelNameEl.textContent = `(${data.channel_title})`;
          channelNameEl.style.display = "inline";
        }
        if (authBtn) {
          authBtn.textContent = "🔑 再連携 (別アカウント)";
          authBtn.style.display = "inline-block";
          authBtn.style.background = "rgba(255,255,255,0.08)";
        }
      } else if (data.quota_exceeded) {
        statusBadge.textContent = "🟡 クォータ上限待機中 (自動回復)";
        statusBadge.style.color = "#ffeaa7";
        if (channelNameEl) channelNameEl.style.display = "none";
        if (authBtn) authBtn.style.display = "none";
      } else {
        statusBadge.textContent = "🔴 未連携";
        statusBadge.style.color = "#ff7675";
        if (channelNameEl) channelNameEl.style.display = "none";
        if (authBtn) {
          authBtn.textContent = "🔑 Google連携";
          authBtn.style.display = "inline-block";
          authBtn.style.background = "#ff4444";
        }
      }
    } catch (e) {
      statusBadge.textContent = "⚪ サーバー未接続";
      statusBadge.style.color = "var(--text-muted)";
    }
  }
  window.checkYtApiAuthStatus = checkYtApiAuthStatus;

  // 配信枠一覧から選択モーダル ロジック
  let cachedBroadcasts = [];
  let activeBroadcastFilter = "all";

  function updateYtInputDot() {
    const ytInput = document.getElementById("wizard-yt-input");
    const dot = document.getElementById("wizard-yt-input-dot");
    if (!dot) return;
    const val = (ytInput?.value || "").trim();
    if (val.length >= 11) {
      dot.textContent = "🟢";
    } else {
      dot.textContent = "🔴";
    }
  }
  window.updateYtInputDot = updateYtInputDot;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

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
      if (!res.ok) {
        throw new Error(`サーバー応答エラー (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        cachedBroadcasts = data.items;
        renderBroadcastList();
      } else {
        listContainer.innerHTML = `<div style="color:#ff7675; font-size:0.8rem; text-align:center; padding:20px;">⚠️ 取得エラー: ${escapeHtml(data.error || "未認証です。「🔑 Google連携」を行ってください。")}</div>`;
      }
    } catch (err) {
      listContainer.innerHTML = `<div style="color:#ff7675; font-size:0.8rem; text-align:center; padding:20px;">❌ 通信エラー: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderBroadcastList() {
    const listContainer = document.getElementById("broadcast-picker-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    const filtered = cachedBroadcasts.filter(item => {
      if (activeBroadcastFilter === "all") return true;
      if (activeBroadcastFilter === "upcoming") {
        return ["ready", "created", "upcoming"].includes(item.lifeCycleStatus);
      }
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

      const thumbUrl = item.thumbnail || item.thumbnails?.medium?.url || item.thumbnails?.default?.url || "";
      const thumbHtml = thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" style="width:96px; height:54px; object-fit:cover; border-radius:4px; flex-shrink:0;">` : '<div style="width:96px; height:54px; background:#222; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#666; flex-shrink:0;">No Image</div>';

      let statusBadge = "";
      if (item.lifeCycleStatus === "ready" || item.lifeCycleStatus === "created" || item.lifeCycleStatus === "upcoming") {
        statusBadge = '<span style="background:rgba(0,210,211,0.2); color:#00ffff; font-size:0.65rem; padding:2px 6px; border-radius:4px;">📅 予約枠</span>';
      } else if (item.lifeCycleStatus === "live") {
        statusBadge = '<span style="background:rgba(255,71,87,0.2); color:#ff4757; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:bold;">🔴 配信中</span>';
      } else {
        statusBadge = `<span style="background:rgba(255,255,255,0.1); color:#aaa; font-size:0.65rem; padding:2px 6px; border-radius:4px;">${escapeHtml(item.lifeCycleStatus || "")}</span>`;
      }

      let schedTimeStr = item.scheduledStartTime ? (typeof window.formatScheduleDateTime === "function" ? window.formatScheduleDateTime(item.scheduledStartTime) : item.scheduledStartTime) : "日時未定";
      const safeTitle = escapeHtml(item.title || "無題の配信");
      const safeId = escapeHtml(item.id || "");

      card.innerHTML = `
        ${thumbHtml}
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            ${statusBadge}
            <span style="font-size:0.7rem; color:var(--text-muted);">⏰ ${escapeHtml(schedTimeStr)}</span>
          </div>
          <div style="font-weight:bold; font-size:0.85rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safeTitle}">${safeTitle}</div>
          <div style="font-size:0.7rem; color:#888; font-family:monospace; margin-top:2px;">ID: ${safeId}</div>
        </div>
        <button type="button" style="background:linear-gradient(135deg, #0984e3, #00cec9); border:none; color:#fff; font-size:0.75rem; font-weight:bold; padding:6px 12px; border-radius:6px; cursor:pointer; flex-shrink:0;">この枠を選択</button>
      `;

      card.addEventListener("click", () => {
        const ytInput = document.getElementById("wizard-yt-input");
        const titleInput = getTitleInputElement();
        const descInput = getDescInputElement();
        if (ytInput) {
          ytInput.value = item.id;
          updateYtInputDot();
        }
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

    // スロット切り替えボタン (朝・夜)
    document.getElementById("wizard-slot-morning-btn")?.addEventListener("click", () => {
      window.wizardActiveSlot = "morning";
      localStorage.setItem("savedStreamSlot", "morning");
      if (window.openerWin) window.openerWin.activeStreamSlot = "morning";
      generateStreamReservationMetadata(true);
      updateStep4Inputs();
    });
    document.getElementById("wizard-slot-evening-btn")?.addEventListener("click", () => {
      window.wizardActiveSlot = "evening";
      localStorage.setItem("savedStreamSlot", "evening");
      if (window.openerWin) window.openerWin.activeStreamSlot = "evening";
      generateStreamReservationMetadata(true);
      updateStep4Inputs();
    });

    // 枠一覧選択モーダル開閉 & フィルター
    const openPickerBtn = document.getElementById("wizard-yt-select-modal-btn") || document.getElementById("wizard-btn-open-picker");
    openPickerBtn?.addEventListener("click", () => {
      window.openBroadcastPickerModal();
    });
    document.getElementById("btn-close-broadcast-picker")?.addEventListener("click", () => {
      window.closeBroadcastPickerModal();
    });
    document.getElementById("btn-refresh-broadcasts")?.addEventListener("click", () => {
      loadAndRenderBroadcasts();
    });
    document.getElementById("btn-refresh-broadcast-picker")?.addEventListener("click", () => {
      loadAndRenderBroadcasts();
    });

    const filterAllBtn = document.getElementById("filter-all-broadcasts");
    const filterUpBtn = document.getElementById("filter-upcoming-broadcasts");
    if (filterAllBtn && filterUpBtn) {
      filterAllBtn.addEventListener("click", () => {
        filterAllBtn.style.background = "rgba(0,210,211,0.2)";
        filterAllBtn.style.border = "1px solid #00d2d3";
        filterAllBtn.style.color = "#00d2d3";
        filterUpBtn.style.background = "rgba(255,255,255,0.05)";
        filterUpBtn.style.border = "1px solid rgba(255,255,255,0.2)";
        filterUpBtn.style.color = "#aaa";
        activeBroadcastFilter = "all";
        renderBroadcastList();
      });
      filterUpBtn.addEventListener("click", () => {
        filterUpBtn.style.background = "rgba(0,210,211,0.2)";
        filterUpBtn.style.border = "1px solid #00d2d3";
        filterUpBtn.style.color = "#00d2d3";
        filterAllBtn.style.background = "rgba(255,255,255,0.05)";
        filterAllBtn.style.border = "1px solid rgba(255,255,255,0.2)";
        filterAllBtn.style.color = "#aaa";
        activeBroadcastFilter = "upcoming";
        renderBroadcastList();
      });
    }

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

    // チャンネル名の入力監視 & 保存
    const channelInputEl = document.getElementById("wizard-yt-channel");
    channelInputEl?.addEventListener("input", () => {
      const val = channelInputEl.value.trim();
      if (val) {
        localStorage.setItem("savedYoutubeChannel", val);
        if (window.openerWin) window.openerWin.localStorage.setItem("savedYoutubeChannel", val);
      }
    });

    // 枠IDの入力監視
    const ytInputEl = document.getElementById("wizard-yt-input");
    ytInputEl?.addEventListener("input", () => {
      updateYtInputDot();
    });
    updateYtInputDot();

    // Google連携
    const authBtn = document.getElementById("btn-yt-oauth-login") || document.getElementById("wizard-btn-yt-auth");
    authBtn?.addEventListener("click", async () => {
      showYtApiFeedback("🌐 ブラウザでGoogleログイン・アクセス許可を行ってください...", true, true);
      try {
        const res = await fetch("/api/youtube/start_oauth", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          showYtApiFeedback(`✅ Google連携が完了しました！${data.channel_title ? '（チャンネル: ' + data.channel_title + '）' : ''}`, true);
          checkYtApiAuthStatus();
        } else {
          showYtApiFeedback(`❌ 連携に失敗しました: ${data.error || "ユーザーキャンセルまたはエラー"}`, false);
        }
      } catch (err) {
        showYtApiFeedback(`❌ 連携通信エラー: ${err.message}`, false);
      }
    });

    // 枠自動作成
    const createBtn = document.getElementById("btn-api-create-broadcast") || document.getElementById("wizard-btn-yt-create");
    createBtn?.addEventListener("click", async () => {
      const titleInput = getTitleInputElement();
      const descInput = getDescInputElement();
      const title = titleInput?.value?.trim() || "";
      const desc = descInput?.value || "";
      const scheduledTime = typeof window.getWizardScheduledStartTime === "function" ? window.getWizardScheduledStartTime() : "";
      const privacySelect = document.getElementById("wizard-privacy-status") || document.getElementById("wizard-yt-privacy");
      const privacy = privacySelect?.value || "public";
      const madeForKids = document.getElementById("wizard-yt-kids")?.checked || false;

      if (!title) {
        showYtApiFeedback("⚠️ 配信タイトルを入力してください。", false);
        return;
      }

      createBtn.disabled = true;
      const origText = createBtn.textContent;
      createBtn.textContent = "⏳ 枠を作成中...";
      showYtApiFeedback("🚀 YouTube上に新規配信予約枠を作成中...", true, true);

      try {
        const authCheck = await fetch("/api/youtube/oauth_status");
        const authData = await authCheck.json();
        if (!authData.authenticated) {
          showYtApiFeedback("⚠️ 先に「🔑 Google連携」ボタンを押してログインしてください。", false);
          createBtn.disabled = false;
          createBtn.textContent = origText;
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
          showYtApiFeedback(`✅ YouTube枠「${data.title || title}」を自動作成しました！ (ID: ${data.id})`, true);

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
        createBtn.disabled = false;
        createBtn.textContent = origText;
      }
    });

    // 枠情報更新
    const updateBtn = document.getElementById("btn-api-update-broadcast") || document.getElementById("wizard-btn-yt-update");
    updateBtn?.addEventListener("click", async () => {
      const videoId = document.getElementById("wizard-yt-input")?.value?.trim() || "";
      const titleInput = getTitleInputElement();
      const descInput = getDescInputElement();
      const title = titleInput?.value?.trim() || "";
      const desc = descInput?.value || "";
      const scheduledTime = typeof window.getWizardScheduledStartTime === "function" ? window.getWizardScheduledStartTime() : "";
      const privacySelect = document.getElementById("wizard-privacy-status") || document.getElementById("wizard-yt-privacy");
      const privacy = privacySelect?.value || "public";
      const madeForKids = document.getElementById("wizard-yt-kids")?.checked || false;

      if (!videoId) {
        showYtApiFeedback("⚠️ 更新対象のYouTube動画IDを入力するか、「枠を自動作成」してください。", false);
        return;
      }
      if (!title) {
        showYtApiFeedback("⚠️ 配信タイトルを入力してください。", false);
        return;
      }

      updateBtn.disabled = true;
      const origText = updateBtn.textContent;
      updateBtn.textContent = "⏳ 更新中...";
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
        updateBtn.disabled = false;
        updateBtn.textContent = origText;
      }
    });

    // サムネイル送信
    const thumbBtn = document.getElementById("btn-api-upload-thumbnail") || document.getElementById("wizard-btn-yt-thumb");
    thumbBtn?.addEventListener("click", async () => {
      const videoId = document.getElementById("wizard-yt-input")?.value?.trim() || "";
      if (!videoId) {
        showYtApiFeedback("⚠️ サムネイル反映対象のYouTube動画IDを入力するか、「枠を自動作成」してください。", false);
        return;
      }

      thumbBtn.disabled = true;
      const origText = thumbBtn.textContent;
      thumbBtn.textContent = "⏳ サムネイル送信中...";

      let base64 = "";
      try {
        // 1. 親画面のサムネイルプレビューCanvas
        if (window.openerWin && window.openerWin.document) {
          const thumbCanvas = window.openerWin.document.getElementById("thumb-preview-canvas") ||
                              window.openerWin.document.getElementById("news-thumb-canvas");
          if (thumbCanvas && typeof thumbCanvas.toDataURL === "function") {
            base64 = thumbCanvas.toDataURL("image/png");
          }
        }
        // 2. localStorage に保存されている最新サムネイル画像
        if (!base64 || base64.length < 100) {
          base64 = (window.openerWin && window.openerWin.localStorage.getItem("savedThumb_latestDataUrl")) ||
                   localStorage.getItem("savedThumb_latestDataUrl") || "";
        }
        // 3. サムネイルジェネレータ
        if (!base64 && window.openerWin && window.openerWin.newsThumbnailGenerator && typeof window.openerWin.newsThumbnailGenerator.generateThumbnailBase64 === "function") {
          base64 = await window.openerWin.newsThumbnailGenerator.generateThumbnailBase64();
        }
      } catch(e) {}

      if (!base64) {
        showYtApiFeedback("⚠️ サムネイル画像がまだ作成されていません。「🎨 サムネイルを編集」ボタンを押してサムネイルを作成してください。", false);
        thumbBtn.disabled = false;
        thumbBtn.textContent = origText;
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
        thumbBtn.disabled = false;
        thumbBtn.textContent = origText;
      }
    });

    // サムネイルエディタモーダルを開く
    const editThumbBtn = document.getElementById("btn-wizard-open-thumb-editor") || document.getElementById("wizard-btn-edit-thumb");
    editThumbBtn?.addEventListener("click", () => {
      const titleVal = getTitleInputElement()?.value || "";
      if (window.openerWin) {
        // 親画面の配信タイトル入力欄にタイトルを同期
        const mainTitleInput = window.openerWin.document.getElementById("stream-title");
        if (mainTitleInput && titleVal) {
          mainTitleInput.value = titleVal;
        }
        if (typeof window.openerWin.openThumbnailEditorModal === "function") {
          window.openerWin.openThumbnailEditorModal();
          window.openerWin.focus();
          showYtApiFeedback("🎨 メイン画面でサムネイルエディタを開きました！", true);
        } else if (typeof window.openerWin.openNewsThumbnailModal === "function") {
          window.openerWin.openNewsThumbnailModal();
          window.openerWin.focus();
          showYtApiFeedback("🎨 メイン画面でサムネイルエディタを開きました！", true);
        } else {
          showYtApiFeedback("⚠️ メイン画面でサムネイルエディタが見つかりませんでした。", false);
        }
      } else {
        showYtApiFeedback("⚠️ 親ウィンドウ（スタジオ画面）との通信が切断されています。", false);
      }
    });

    // メタデータ再生成ボタン
    document.getElementById("btn-regen-title")?.addEventListener("click", () => {
      generateStreamReservationMetadata(true, true);
      if (typeof window.showWizardToast === "function") {
        window.showWizardToast("🎲 配信タイトルを再生成しました", true);
      }
    });
    document.getElementById("btn-regen-desc")?.addEventListener("click", () => {
      generateStreamReservationMetadata(true);
      if (typeof window.showWizardToast === "function") {
        window.showWizardToast("🔄 説明欄を再生成しました", true);
      }
    });

    // コピー系ボタン
    document.getElementById("btn-copy-title")?.addEventListener("click", () => {
      const val = getTitleInputElement()?.value || "";
      if (val) {
        navigator.clipboard.writeText(val);
        if (typeof window.showWizardToast === "function") window.showWizardToast("📋 タイトルをコピーしました", true);
      }
    });
    document.getElementById("btn-copy-desc")?.addEventListener("click", () => {
      const val = getDescInputElement()?.value || "";
      if (val) {
        navigator.clipboard.writeText(val);
        if (typeof window.showWizardToast === "function") window.showWizardToast("📋 説明欄をコピーしました", true);
      }
    });
    document.getElementById("btn-copy-all-obs-info")?.addEventListener("click", () => {
      const title = getTitleInputElement()?.value || "";
      const desc = getDescInputElement()?.value || "";
      const allText = `【配信タイトル】\n${title}\n\n【配信説明欄】\n${desc}`;
      navigator.clipboard.writeText(allText);
      if (typeof window.showWizardToast === "function") window.showWizardToast("📋 タイトル・説明欄をまとめてコピーしました！", true);
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
          if (ytInput) {
            ytInput.value = data.video_id;
            updateYtInputDot();
          }
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

    // 枠確認ボタン
    document.getElementById("wizard-yt-check-btn")?.addEventListener("click", async () => {
      const ytInput = document.getElementById("wizard-yt-input");
      const val = ytInput?.value?.trim() || "";
      if (!val) {
        if (typeof window.showWizardToast === "function") window.showWizardToast("⚠️ YouTube枠IDを入力してください", false);
        return;
      }
      try {
        const res = await fetch("/get_youtube_video_info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: val })
        });
        const data = await res.json();
        if (data.title) {
          const card = document.getElementById("wizard-yt-info-card");
          const titleEl = document.getElementById("wizard-yt-title");
          const thumbEl = document.getElementById("wizard-yt-thumb-preview");
          if (card) card.style.display = "block";
          if (titleEl) titleEl.textContent = data.title;
          if (thumbEl && data.thumbnail_url) {
            thumbEl.src = data.thumbnail_url;
            thumbEl.style.display = "block";
          }
          if (typeof window.showWizardToast === "function") window.showWizardToast(`✅ 枠情報を取得しました: ${data.title}`, true);
        } else {
          if (typeof window.showWizardToast === "function") window.showWizardToast("⚠️ 枠情報の取得に失敗しました", false);
        }
      } catch(e) {
        if (typeof window.showWizardToast === "function") window.showWizardToast(`❌ 通信エラー: ${e.message}`, false);
      }
    });

    // 初期認証状態チェック
    checkYtApiAuthStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initYouTubeAPIHandlers);
  } else {
    initYouTubeAPIHandlers();
  }
})();
