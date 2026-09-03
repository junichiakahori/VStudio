// =====================================================================
// wizard-news-settings.js: ニュース取得・日付範囲設定・時間帯別挨拶設定
// =====================================================================

(function() {
  const formatDT = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mm}`;
  };

  const initHourSelects = () => {
    const sHour = document.getElementById("wizard-start-hour");
    const eHour = document.getElementById("wizard-end-hour");
    if (sHour && sHour.options.length === 0) {
      for (let i = 0; i < 24; i++) {
        const val = String(i).padStart(2, "0");
        sHour.innerHTML += `<option value="${val}">${val}時</option>`;
      }
    }
    if (eHour && eHour.options.length === 0) {
      for (let i = 0; i < 24; i++) {
        const val = String(i).padStart(2, "0");
        eHour.innerHTML += `<option value="${val}">${val}時</option>`;
      }
    }
  };

  const syncWizardInputsFromHidden = () => {
    initHourSelects();
    const startHidden = document.getElementById("wizard-news-date-start");
    const endHidden = document.getElementById("wizard-news-date-end");
    const sDate = document.getElementById("wizard-start-date");
    const sHour = document.getElementById("wizard-start-hour");
    const eDate = document.getElementById("wizard-end-date");
    const eHour = document.getElementById("wizard-end-hour");

    if (startHidden && startHidden.value) {
      const parts = startHidden.value.split("T");
      if (sDate && parts[0]) sDate.value = parts[0];
      if (sHour && parts[1]) sHour.value = parts[1].slice(0, 2);
    }
    if (endHidden && endHidden.value) {
      const parts = endHidden.value.split("T");
      if (eDate && parts[0]) eDate.value = parts[0];
      if (eHour && parts[1]) eHour.value = parts[1].slice(0, 2);
    }
  };

  const syncWizardHiddenFromInputs = () => {
    const startHidden = document.getElementById("wizard-news-date-start");
    const endHidden = document.getElementById("wizard-news-date-end");
    const sDate = document.getElementById("wizard-start-date");
    const sHour = document.getElementById("wizard-start-hour");
    const eDate = document.getElementById("wizard-end-date");
    const eHour = document.getElementById("wizard-end-hour");

    if (startHidden && sDate && sHour) {
      startHidden.value = sDate.value ? `${sDate.value}T${sHour.value || "00"}:00` : "";
    }
    if (endHidden && eDate && eHour) {
      endHidden.value = eDate.value ? `${eDate.value}T${eHour.value || "23"}:59` : "";
    }
  };

  window.stepWizardDate = function(type, hoursDiff) {
    syncWizardHiddenFromInputs();
    const hidden = document.getElementById(type === "start" ? "wizard-news-date-start" : "wizard-news-date-end");
    if (!hidden) return;
    let current = hidden.value ? new Date(hidden.value) : new Date();
    if (isNaN(current.getTime())) current = new Date();
    current.setTime(current.getTime() + hoursDiff * 60 * 60 * 1000);
    hidden.value = formatDT(current);
    syncWizardInputsFromHidden();
  };

  window.setWizardNow = function() {
    const endHidden = document.getElementById("wizard-news-date-end");
    if (endHidden) {
      endHidden.value = formatDT(new Date());
      syncWizardInputsFromHidden();
    }
  };

  const applyWizardQuickRange = (rangeKey = "12h") => {
    const now = new Date();
    const btn6 = document.getElementById("btn-quick-6h");
    const btn12 = document.getElementById("btn-quick-12h");
    const btn24 = document.getElementById("btn-quick-24h");
    const btnToday = document.getElementById("btn-quick-today");
    const btnAll = document.getElementById("btn-quick-all");
    const allBtns = [btn6, btn12, btn24, btnToday, btnAll].filter(Boolean);

    allBtns.forEach(btn => {
      btn.style.background = "rgba(255,255,255,0.08)";
      btn.style.borderColor = "rgba(255,255,255,0.15)";
      btn.style.color = "#fff";
      btn.style.fontWeight = "normal";
    });

    const startInput = document.getElementById("wizard-news-date-start");
    const endInput = document.getElementById("wizard-news-date-end");

    if (rangeKey === "6h") {
      const past = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      if (startInput) startInput.value = formatDT(past);
      if (endInput) endInput.value = formatDT(now);
      if (btn6) {
        btn6.style.background = "rgba(0, 210, 211, 0.25)";
        btn6.style.borderColor = "#00d2d3";
        btn6.style.color = "#00ffff";
        btn6.style.fontWeight = "bold";
      }
    } else if (rangeKey === "12h") {
      const past = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      if (startInput) startInput.value = formatDT(past);
      if (endInput) endInput.value = formatDT(now);
      if (btn12) {
        btn12.style.background = "rgba(0, 210, 211, 0.25)";
        btn12.style.borderColor = "#00d2d3";
        btn12.style.color = "#00ffff";
        btn12.style.fontWeight = "bold";
      }
    } else if (rangeKey === "24h") {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (startInput) startInput.value = formatDT(past);
      if (endInput) endInput.value = formatDT(now);
      if (btn24) {
        btn24.style.background = "rgba(0, 210, 211, 0.25)";
        btn24.style.borderColor = "#00d2d3";
        btn24.style.color = "#00ffff";
        btn24.style.fontWeight = "bold";
      }
    } else if (rangeKey === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      if (startInput) startInput.value = formatDT(start);
      if (endInput) endInput.value = formatDT(end);
      if (btnToday) {
        btnToday.style.background = "rgba(0, 210, 211, 0.25)";
        btnToday.style.borderColor = "#00d2d3";
        btnToday.style.color = "#00ffff";
        btnToday.style.fontWeight = "bold";
      }
    } else if (rangeKey === "all") {
      if (startInput) startInput.value = "";
      if (endInput) endInput.value = "";
      if (btnAll) {
        btnAll.style.background = "rgba(0, 210, 211, 0.25)";
        btnAll.style.borderColor = "#00d2d3";
        btnAll.style.color = "#00ffff";
        btnAll.style.fontWeight = "bold";
      }
    }

    syncWizardInputsFromHidden();
    localStorage.setItem("savedNewsQuickRange", rangeKey);
  };
  window.applyWizardQuickRange = applyWizardQuickRange;

  function renderWizardNewsList() {
    const listEl = document.getElementById("wizard-news-preview-list");
    const countEl = document.getElementById("news-item-count");
    if (!listEl || !window.openerWin) return;

    const newsItems = window.openerWin.latestFetchedNews || [];
    if (countEl) {
      countEl.textContent = newsItems.length > 0 ? `✅ ${newsItems.length}件 取得済み` : "⚠️ 0件 (ニュースを取得してください)";
      countEl.style.color = newsItems.length > 0 ? "#00e676" : "#ff7675";
    }

    if (newsItems.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 15px; color: #ff7675; font-size: 0.8rem;">
          ニュース記事がまだ取得されていません。<br>
          「⬇️ ニュースを再取得」ボタンを押してください。
        </div>`;
      return;
    }

    const readTitles = window.openerWin.readNewsTitles || new Set();

    listEl.innerHTML = "";
    newsItems.forEach((item, idx) => {
      const isRead = readTitles.has(item.title);
      const itemDiv = document.createElement("div");
      itemDiv.style.display = "flex";
      itemDiv.style.alignItems = "center";
      itemDiv.style.justifyContent = "space-between";
      itemDiv.style.gap = "8px";
      itemDiv.style.padding = "6px 8px";
      itemDiv.style.background = isRead ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)";
      itemDiv.style.borderRadius = "4px";
      itemDiv.style.borderLeft = isRead ? "3px solid #666" : "3px solid #00d2d3";
      itemDiv.style.fontSize = "0.78rem";

      const leftSpan = document.createElement("div");
      leftSpan.style.display = "flex";
      leftSpan.style.alignItems = "center";
      leftSpan.style.gap = "6px";
      leftSpan.style.overflow = "hidden";

      const catBadge = document.createElement("span");
      catBadge.style.background = "#00d2d3";
      catBadge.style.color = "#000";
      catBadge.style.fontWeight = "bold";
      catBadge.style.fontSize = "0.65rem";
      catBadge.style.padding = "1px 5px";
      catBadge.style.borderRadius = "3px";
      catBadge.style.whiteSpace = "nowrap";
      catBadge.textContent = item.categoryName || "総合";

      const titleSpan = document.createElement("span");
      titleSpan.style.color = isRead ? "var(--text-muted)" : "#fff";
      titleSpan.style.overflow = "hidden";
      titleSpan.style.textOverflow = "ellipsis";
      titleSpan.style.whiteSpace = "nowrap";
      titleSpan.textContent = `${idx + 1}. ${item.title}`;

      leftSpan.appendChild(catBadge);
      leftSpan.appendChild(titleSpan);

      const statusSpan = document.createElement("span");
      statusSpan.style.fontSize = "0.7rem";
      statusSpan.style.color = isRead ? "#888" : "#00e676";
      statusSpan.style.whiteSpace = "nowrap";
      statusSpan.textContent = isRead ? "既読" : "未読";

      itemDiv.appendChild(leftSpan);
      itemDiv.appendChild(statusSpan);
      listEl.appendChild(itemDiv);
    });
  }
  window.renderWizardNewsList = renderWizardNewsList;

  function updateStep3Content() {
    document.getElementById("content-chat").style.display = window.selectedMode === "chat" ? "flex" : "none";
    document.getElementById("content-radio").style.display = window.selectedMode === "radio" ? "flex" : "none";
    document.getElementById("content-news").style.display = window.selectedMode === "news" ? "flex" : "none";

    if (window.openerWin) {
      if (window.selectedMode === "radio" && window.openerWin.radioModeState) {
        const count = window.openerWin.radioModeState.scriptLines ? window.openerWin.radioModeState.scriptLines.length : 0;
        const el = document.getElementById("radio-script-status");
        if (el) {
          el.textContent = count > 0 ? `✅ ${count}行 準備完了` : "⚠️ 0行 (未準備)";
          el.style.color = count > 0 ? "#00e676" : "#ff9900";
        }
      }
      if (window.selectedMode === "news") {
        const startInput = document.getElementById("wizard-news-date-start");
        const endInput = document.getElementById("wizard-news-date-end");
        const mainStart = window.openerWin.document.getElementById("news-date-start");
        const mainEnd = window.openerWin.document.getElementById("news-date-end");

        if (startInput && !startInput.value) {
          if (mainStart && mainStart.value) {
            startInput.value = mainStart.value;
          } else {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            startInput.value = formatDT(d);
          }
        }
        if (endInput && !endInput.value) {
          if (mainEnd && mainEnd.value) {
            endInput.value = mainEnd.value;
          } else {
            const d = new Date();
            d.setHours(23, 59, 0, 0);
            endInput.value = formatDT(d);
          }
        }

        renderWizardNewsList();
      }
    }
  }
  window.updateStep3Content = updateStep3Content;

  // ⚙️ ニュース番組設定モーダル制御 (朝・昼・夜 時間帯別一括設定対応)
  function initWizardNewsSettingsModal() {
    const modal = document.getElementById("wizard-news-settings-modal");
    const openBtn = document.getElementById("open-news-settings-btn");
    const closeBtn = document.getElementById("close-wizard-news-settings-btn");
    const cancelBtn = document.getElementById("cancel-wizard-news-settings-btn");
    const saveBtn = document.getElementById("save-wizard-news-settings-btn");

    const inTitle = document.getElementById("wns-title");
    const inOp = document.getElementById("wns-op");
    const inEd = document.getElementById("wns-ed");
    const inSeOp = document.getElementById("wns-se-op");
    const inSeTrans = document.getElementById("wns-se-trans");
    const inSeEd = document.getElementById("wns-se-ed");
    const slotTabs = document.querySelectorAll(".wns-slot-tab");
    const resetCurrentSlotBtn = document.getElementById("wns-reset-current-slot-btn");

    let currentSlot = "morning";
    let slotData = {
      morning: { op: "", ed: "" },
      day: { op: "", ed: "" },
      night: { op: "", ed: "" }
    };

    function getActiveCharacterModel() {
      if (window.openerWin && window.openerWin.currentModelId) return window.openerWin.currentModelId;
      try {
        return localStorage.getItem("live2d_current_model") || "tororo";
      } catch(e) {
        return "tororo";
      }
    }

    function getCurrentTimeSlot() {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) return "morning";
      if (hour >= 11 && hour < 17) return "day";
      return "night";
    }

    function getDefaultGreetingForSlot(slot, type) {
      const modelId = getActiveCharacterModel();
      const titleVal = (inTitle && inTitle.value.trim()) ? inTitle.value.trim() : (localStorage.getItem("savedNewsProgTitle") || "ニュース");
      const cleanTitle = titleVal.replace(/^(最新の|本日の|今日の)/, "");

      if (modelId === "tororo" || modelId === "hijiki") {
        const name = modelId === "hijiki" ? "ひじき" : "とろろ";
        if (type === "op") {
          if (slot === "morning") return `おはようございますにゃ！AITuberの「${name}」が本日の${cleanTitle}をお伝えしますにゃ。`;
          if (slot === "day") return `こんにちはにゃ！AITuberの「${name}」が本日の${cleanTitle}をお伝えしますにゃ。`;
          return `こんばんはにゃ！AITuberの「${name}」が今日の${cleanTitle}をお伝えしますにゃ。`;
        } else {
          if (slot === "morning") return `本日のニュースは以上になりますにゃ。AITuberの「${name}」がお伝えしました。今日も素敵な一日をお過ごしくださいにゃ！`;
          if (slot === "day") return `本日のニュースは以上になりますにゃ。AITuberの「${name}」がお伝えしました。午後も良い時間をお過ごしくださいにゃ！`;
          return `本日のニュースは以上になりますにゃ。AITuberの「${name}」がお伝えしました。明日も良い一日をお過ごしくださいにゃ！おやすみなさいにゃ。`;
        }
      }

      if (modelId.includes("zunda") || modelId === "zundamon") {
        if (type === "op") {
          if (slot === "morning") return `おはようございますなのだ！本日の${cleanTitle}をお届けするのだ！`;
          if (slot === "day") return `こんにちはなのだ！最新の${cleanTitle}をお伝えするのだ！`;
          return `こんばんはなのだ！今日の${cleanTitle}をまとめてチェックするのだ！`;
        } else {
          if (slot === "morning") return "以上、本日の最新ニュースをお届けしたのだ！今日も一日、元気に頑張るのだ！";
          if (slot === "day") return "以上、この時間の最新ニュースをお伝えしたのだ！午後も良い時間をお過ごしくださいなのだ！";
          return "以上、本日のニュースをお伝えしたのだ！明日も良い一日になりますように。おやすみなさいなのだ！";
        }
      }

      if (type === "op") {
        if (slot === "morning") return `おはようございます。本日の${cleanTitle}をお届けいたします。`;
        if (slot === "day") return `こんにちは。${cleanTitle}をお伝えいたします。`;
        return `こんばんは。今日の${cleanTitle}をまとめてお伝えいたします。`;
      } else {
        if (slot === "morning") return "以上、本日の最新ニュースをお届けいたしました。それでは、今日も素敵な一日をお過ごしください。";
        if (slot === "day") return "以上、この時間の最新ニュースをお伝えいたしました。それでは、引き続き良い時間をお過ごしください。";
        return "以上、本日のニュースをお伝えいたしました。それでは、明日も良い一日をお過ごしください。おやすみなさい。";
      }
    }

    function updateSlotTabUI() {
      const nowSlot = getCurrentTimeSlot();
      slotTabs.forEach(tab => {
        const slot = tab.getAttribute("data-slot");
        const isSelected = (slot === currentSlot);
        const isNow = (slot === nowSlot);

        tab.style.background = isSelected ? "rgba(0,210,211,0.25)" : "rgba(255,255,255,0.05)";
        tab.style.borderColor = isSelected ? "#00d2d3" : "rgba(255,255,255,0.1)";
        tab.style.color = isSelected ? "#00ffff" : "#aaa";
        tab.style.fontWeight = isSelected ? "bold" : "normal";

        let label = slot === "morning" ? "🌅 朝 (5〜11時)" : (slot === "day" ? "☀️ 昼 (11〜17時)" : "🌙 夜 (17〜5時)");
        if (isNow) label += " 🟢";
        tab.textContent = label;
      });
    }

    function switchSlot(targetSlot) {
      if (inOp && inEd) {
        slotData[currentSlot] = {
          op: inOp.value.trim(),
          ed: inEd.value.trim()
        };
      }
      currentSlot = targetSlot;
      updateSlotTabUI();
      if (inOp && inEd) {
        inOp.value = slotData[currentSlot].op || getDefaultGreetingForSlot(currentSlot, "op");
        inEd.value = slotData[currentSlot].ed || getDefaultGreetingForSlot(currentSlot, "ed");
      }
    }

    slotTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const slot = tab.getAttribute("data-slot");
        if (slot) switchSlot(slot);
      });
    });

    if (resetCurrentSlotBtn) {
      resetCurrentSlotBtn.onclick = (e) => {
        e.preventDefault();
        if (inOp && inEd) {
          inOp.value = getDefaultGreetingForSlot(currentSlot, "op");
          inEd.value = getDefaultGreetingForSlot(currentSlot, "ed");
          slotData[currentSlot] = { op: inOp.value, ed: inEd.value };
        }
        resetCurrentSlotBtn.textContent = "✅ 初期値に戻しました";
        setTimeout(() => { resetCurrentSlotBtn.textContent = "🔄 この時間帯を初期値に戻す"; }, 1500);
      };
    }

    function loadWizardNewsConfig() {
      try {
        let autoState = {};
        try {
          autoState = JSON.parse(localStorage.getItem("live2d_studio_auto_ui_state") || "{}");
        } catch(e) {}

        const savedTitle = localStorage.getItem("savedNewsProgTitle") || autoState["news-config-title"] || "とろろニュース";
        if (inTitle) inTitle.value = savedTitle;

        let savedSlots = null;
        try {
          savedSlots = JSON.parse(localStorage.getItem("savedNewsTimeGreetings") || "null");
        } catch(e) {}

        ["morning", "day", "night"].forEach(slot => {
          slotData[slot] = {
            op: (savedSlots && savedSlots[slot] && savedSlots[slot].op) ? savedSlots[slot].op : getDefaultGreetingForSlot(slot, "op"),
            ed: (savedSlots && savedSlots[slot] && savedSlots[slot].ed) ? savedSlots[slot].ed : getDefaultGreetingForSlot(slot, "ed")
          };
        });

        const legacyOp = localStorage.getItem("savedNewsOpGreeting");
        const legacyEd = localStorage.getItem("savedNewsEdGreeting");
        const nowSlot = getCurrentTimeSlot();
        if (legacyOp && !savedSlots) slotData[nowSlot].op = legacyOp;
        if (legacyEd && !savedSlots) slotData[nowSlot].ed = legacyEd;

        const savedSeOp = localStorage.getItem("savedNewsSeOp") ?? autoState["news-se-op-chime"] ?? true;
        const savedSeTrans = localStorage.getItem("savedNewsSeTrans") ?? autoState["news-se-transition"] ?? true;
        const savedSeEd = localStorage.getItem("savedNewsSeEd") ?? autoState["news-se-ed-chime"] ?? true;

        if (inSeOp) inSeOp.checked = String(savedSeOp) !== "false";
        if (inSeTrans) inSeTrans.checked = String(savedSeTrans) !== "false";
        if (inSeEd) inSeEd.checked = String(savedSeEd) !== "false";

        currentSlot = nowSlot;
        updateSlotTabUI();
        if (inOp && inEd) {
          inOp.value = slotData[currentSlot].op;
          inEd.value = slotData[currentSlot].ed;
        }

        console.log(`[Wizard] 📂 番組設定読み込み完了 (全時間帯セット完了 / 現在スロット: ${currentSlot})`);
      } catch(e) {
        console.error("[Wizard] ❌ 設定読み込みエラー:", e);
      }
    }

    if (openBtn) {
      openBtn.onclick = (e) => {
        e.preventDefault();
        console.log("[Wizard] ⚙️ 番組設定ボタンがクリックされました！モーダルを表示します");
        loadWizardNewsConfig();
        if (modal) {
          modal.style.display = "flex";
        }
      };
    }
    if (closeBtn && modal) closeBtn.onclick = () => { modal.style.display = "none"; };
    if (cancelBtn && modal) cancelBtn.onclick = () => { modal.style.display = "none"; };

    if (saveBtn && modal) {
      saveBtn.onclick = () => {
        const titleVal = inTitle ? inTitle.value.trim() : "";
        if (inOp && inEd) {
          slotData[currentSlot] = {
            op: inOp.value.trim(),
            ed: inEd.value.trim()
          };
        }
        const seOpVal = inSeOp ? inSeOp.checked : true;
        const seTransVal = inSeTrans ? inSeTrans.checked : true;
        const seEdVal = inSeEd ? inSeEd.checked : true;

        if (inTitle) localStorage.setItem("savedNewsProgTitle", titleVal);
        localStorage.setItem("savedNewsTimeGreetings", JSON.stringify(slotData));

        const nowSlot = getCurrentTimeSlot();
        const activeOp = slotData[nowSlot].op;
        const activeEd = slotData[nowSlot].ed;
        localStorage.setItem("savedNewsOpGreeting", activeOp);
        localStorage.setItem("savedNewsEdGreeting", activeEd);

        if (inSeOp) localStorage.setItem("savedNewsSeOp", seOpVal);
        if (inSeTrans) localStorage.setItem("savedNewsSeTrans", seTransVal);
        if (inSeEd) localStorage.setItem("savedNewsSeEd", seEdVal);

        try {
          const autoState = JSON.parse(localStorage.getItem("live2d_studio_auto_ui_state") || "{}");
          autoState["news-config-title"] = titleVal;
          autoState["news-config-opening"] = activeOp;
          autoState["news-config-closing"] = activeEd;
          autoState["news-se-op-chime"] = seOpVal;
          autoState["news-se-transition"] = seTransVal;
          autoState["news-se-ed-chime"] = seEdVal;
          localStorage.setItem("live2d_studio_auto_ui_state", JSON.stringify(autoState));
        } catch(e) {}

        console.log(`[Wizard] 💾 全時間帯の挨拶設定を保存完了！`);

        if (window.openerWin) {
          const pTitle = window.openerWin.document.getElementById("news-config-title");
          const pOp = window.openerWin.document.getElementById("news-config-opening");
          const pEd = window.openerWin.document.getElementById("news-config-closing");
          const pSeOp = window.openerWin.document.getElementById("news-se-op-chime");
          const pSeTrans = window.openerWin.document.getElementById("news-se-transition");
          const pSeEd = window.openerWin.document.getElementById("news-se-ed-chime");
          if (pTitle) pTitle.value = titleVal;
          if (pOp) pOp.value = activeOp;
          if (pEd) pEd.value = activeEd;
          if (pSeOp) pSeOp.checked = seOpVal;
          if (pSeTrans) pSeTrans.checked = seTransVal;
          if (pSeEd) pSeEd.checked = seEdVal;
        }

        modal.style.display = "none";
        if (typeof window.showWizardToast === "function") {
          window.showWizardToast("✅ 朝・昼・夜の全挨拶設定を保存しました！配信時刻に応じて自動切替されます", true, 3500);
        }
      };
    }
  }

  function initNewsSettingsUI() {
    document.getElementById("wizard-start-date")?.addEventListener("change", syncWizardHiddenFromInputs);
    document.getElementById("wizard-start-hour")?.addEventListener("change", syncWizardHiddenFromInputs);
    document.getElementById("wizard-end-date")?.addEventListener("change", syncWizardHiddenFromInputs);
    document.getElementById("wizard-end-hour")?.addEventListener("change", syncWizardHiddenFromInputs);

    document.getElementById("btn-quick-6h")?.addEventListener("click", () => applyWizardQuickRange("6h"));
    document.getElementById("btn-quick-12h")?.addEventListener("click", () => applyWizardQuickRange("12h"));
    document.getElementById("btn-quick-24h")?.addEventListener("click", () => applyWizardQuickRange("24h"));
    document.getElementById("btn-quick-today")?.addEventListener("click", () => applyWizardQuickRange("today"));
    document.getElementById("btn-quick-all")?.addEventListener("click", () => applyWizardQuickRange("all"));

    const savedRange = localStorage.getItem("savedNewsQuickRange") || "12h";
    applyWizardQuickRange(savedRange);

    const catSelect = document.getElementById("wizard-news-category-select");
    const countSelect = document.getElementById("wizard-news-count-select");
    const savedCategory = localStorage.getItem("savedNewsCategory") || "cat_all";
    const savedCount = localStorage.getItem("savedNewsCountSelect") || "3";

    if (catSelect) {
      catSelect.value = savedCategory;
      catSelect.addEventListener("change", (e) => {
        localStorage.setItem("savedNewsCategory", e.target.value);
      });
    }
    if (countSelect) {
      countSelect.value = savedCount;
      countSelect.addEventListener("change", (e) => {
        localStorage.setItem("savedNewsCountSelect", e.target.value);
      });
    }

    // ニュース取得ボタン
    document.getElementById("wizard-fetch-news-btn")?.addEventListener("click", async () => {
      if (!window.openerWin) return;
      const btn = document.getElementById("wizard-fetch-news-btn");
      if (catSelect) localStorage.setItem("savedNewsCategory", catSelect.value);
      if (countSelect) localStorage.setItem("savedNewsCountSelect", countSelect.value);
      const startDate = document.getElementById("wizard-news-date-start")?.value || null;
      const endDate = document.getElementById("wizard-news-date-end")?.value || null;

      const selectedCat = catSelect ? catSelect.value : "cat_all";
      const maxCount = countSelect ? parseInt(countSelect.value, 10) : 3;

      if (window.openerWin) {
        const mainCat = window.openerWin.document.getElementById("news-rss-select");
        if (mainCat && catSelect) mainCat.value = catSelect.value;
        const mainCount = window.openerWin.document.getElementById("news-item-count-select");
        if (mainCount && countSelect) mainCount.value = countSelect.value;
        const mainStart = window.openerWin.document.getElementById("news-date-start");
        if (mainStart && startDate) mainStart.value = startDate;
        const mainEnd = window.openerWin.document.getElementById("news-date-end");
        if (mainEnd && endDate) mainEnd.value = endDate;
      }

      btn.disabled = true;
      btn.textContent = "⏳ 取得中...";
      
      try {
        if (typeof window.openerWin.fetchNewsWithOptions === "function") {
          await window.openerWin.fetchNewsWithOptions(selectedCat, maxCount, startDate, endDate);
        } else {
          const fetchBtn = window.openerWin.document.getElementById("news-fetch-only-btn");
          if (fetchBtn) fetchBtn.click();
          await new Promise(r => setTimeout(r, 2500));
        }
        renderWizardNewsList();
        if (typeof window.generateStreamReservationMetadata === "function") {
          window.generateStreamReservationMetadata(false);
        }
      } catch (e) {
        console.error("ニュース取得エラー:", e);
      } finally {
        btn.disabled = false;
        btn.textContent = "⬇️ ニュース取得";
      }
    });

    // 既読フラグクリアボタン
    document.getElementById("wizard-clear-read-btn")?.addEventListener("click", () => {
      if (window.openerWin && typeof window.openerWin.clearNewsReadFlags === "function") {
        window.openerWin.clearNewsReadFlags(false);
        renderWizardNewsList();
      } else {
        localStorage.removeItem("newsReadTitles");
        renderWizardNewsList();
        if (typeof window.showWizardToast === "function") {
          window.showWizardToast("✅ 既読フラグをすべてクリアしました！", true);
        }
      }
    });

    // ニュース一覧別窓ポップアップ
    document.getElementById("open-news-list-popup-btn")?.addEventListener("click", () => {
      const width = 850;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        "/views/news_list.html",
        "VStudioNewsListWindow",
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
      );
    });

    initWizardNewsSettingsModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNewsSettingsUI);
  } else {
    initNewsSettingsUI();
  }
})();
