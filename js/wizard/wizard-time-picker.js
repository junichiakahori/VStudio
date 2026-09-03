// =====================================================================
// wizard-time-picker.js: 時計ダイヤル式ピッカー・配信予定時刻制御
// =====================================================================

(function() {
  let pickerState = {
    isTomorrow: false,
    hour: 3,
    min: 16,
    mode: "hour", // 'hour' | 'min'
    isDragging: false
  };

  function getWizardStartTimeDate() {
    const input = document.getElementById("wizard-start-time");
    if (input && input.value) {
      const d = new Date(input.value);
      if (!isNaN(d.getTime())) return d;
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now;
  }
  window.getWizardStartTimeDate = getWizardStartTimeDate;

  function setWizardStartTimeDate(dateObj) {
    const input = document.getElementById("wizard-start-time");
    if (!input) return;
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const h = String(dateObj.getHours()).padStart(2, "0");
    const m = String(dateObj.getMinutes()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}T${h}:${m}`;
    input.value = iso;
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));
    updateWizardClockDisplay();
  }
  window.setWizardStartTimeDate = setWizardStartTimeDate;

  function getWizardScheduledStartTime() {
    const input = document.getElementById("wizard-start-time");
    if (input && input.value) {
      return input.value;
    }
    try {
      const d = getWizardStartTimeDate();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}T${h}:${m}`;
    } catch(e) {
      return "";
    }
  }
  window.getWizardScheduledStartTime = getWizardScheduledStartTime;

  function updateWizardClockDisplay() {
    const d = getWizardStartTimeDate();
    const now = new Date();
    const isTomorrow = d.getDate() !== now.getDate() || d.getMonth() !== now.getMonth();
    
    const todayBtn = document.getElementById("wizard-date-today-btn");
    const tomorrowBtn = document.getElementById("wizard-date-tomorrow-btn");
    if (todayBtn && tomorrowBtn) {
      if (isTomorrow) {
        todayBtn.style.background = "transparent";
        todayBtn.style.color = "var(--text-muted)";
        tomorrowBtn.style.background = "#00d2d3";
        tomorrowBtn.style.color = "#000";
      } else {
        todayBtn.style.background = "#00d2d3";
        todayBtn.style.color = "#000";
        tomorrowBtn.style.background = "transparent";
        tomorrowBtn.style.color = "var(--text-muted)";
      }
    }

    const textEl = document.getElementById("wizard-clock-display-text");
    if (textEl) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      textEl.textContent = `${hh}:${mm}`;
    }

    const schedEl = document.getElementById("wizard-yt-schedule");
    if (schedEl && typeof window.formatScheduleDateTime === "function") {
      schedEl.textContent = `⏰ 配信予定: ${window.formatScheduleDateTime(d)}`;
      schedEl.style.color = "#00d2d3";
    }
  }
  window.updateWizardClockDisplay = updateWizardClockDisplay;

  // 時計ダイヤル描画
  function updatePickerDayUI() {
    const pDayToday = document.getElementById("picker-day-today");
    const pDayTomorrow = document.getElementById("picker-day-tomorrow");
    if (pDayToday && pDayTomorrow) {
      if (pickerState.isTomorrow) {
        pDayToday.style.background = "transparent";
        pDayToday.style.color = "#888";
        pDayTomorrow.style.background = "#00d2d3";
        pDayTomorrow.style.color = "#000";
      } else {
        pDayToday.style.background = "#00d2d3";
        pDayToday.style.color = "#000";
        pDayTomorrow.style.background = "transparent";
        pDayTomorrow.style.color = "#888";
      }
    }
  }

  function renderClockNumbers() {
    const container = document.getElementById("clock-numbers-container");
    if (!container) return;
    container.innerHTML = "";

    const radiusOuter = 90;
    const radiusInner = 58;
    const cx = 115;
    const cy = 115;

    if (pickerState.mode === "hour") {
      const outerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      const innerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

      outerHours.forEach((val, idx) => {
        const angle = idx * 30 * (Math.PI / 180);
        const x = cx + radiusOuter * Math.sin(angle) - 13;
        const y = cy - radiusOuter * Math.cos(angle) - 13;
        const numDiv = document.createElement("div");
        numDiv.style.position = "absolute";
        numDiv.style.left = `${x}px`;
        numDiv.style.top = `${y}px`;
        numDiv.style.width = "26px";
        numDiv.style.height = "26px";
        numDiv.style.borderRadius = "50%";
        numDiv.style.display = "flex";
        numDiv.style.justifyContent = "center";
        numDiv.style.alignItems = "center";
        numDiv.style.fontSize = "0.75rem";
        numDiv.style.fontWeight = val === pickerState.hour ? "bold" : "normal";
        numDiv.style.color = val === pickerState.hour ? "#00d2d3" : "#fff";
        numDiv.textContent = String(val).padStart(2, "0");
        container.appendChild(numDiv);
      });

      innerHours.forEach((val, idx) => {
        const angle = idx * 30 * (Math.PI / 180);
        const x = cx + radiusInner * Math.sin(angle) - 11;
        const y = cy - radiusInner * Math.cos(angle) - 11;
        const numDiv = document.createElement("div");
        numDiv.style.position = "absolute";
        numDiv.style.left = `${x}px`;
        numDiv.style.top = `${y}px`;
        numDiv.style.width = "22px";
        numDiv.style.height = "22px";
        numDiv.style.borderRadius = "50%";
        numDiv.style.display = "flex";
        numDiv.style.justifyContent = "center";
        numDiv.style.alignItems = "center";
        numDiv.style.fontSize = "0.68rem";
        numDiv.style.fontWeight = val === pickerState.hour ? "bold" : "normal";
        numDiv.style.color = val === pickerState.hour ? "#00d2d3" : "var(--text-muted)";
        numDiv.textContent = String(val);
        container.appendChild(numDiv);
      });
    } else {
      for (let m = 0; m < 60; m += 5) {
        const angle = (m / 60) * 360 * (Math.PI / 180);
        const x = cx + radiusOuter * Math.sin(angle) - 13;
        const y = cy - radiusOuter * Math.cos(angle) - 13;
        const numDiv = document.createElement("div");
        numDiv.style.position = "absolute";
        numDiv.style.left = `${x}px`;
        numDiv.style.top = `${y}px`;
        numDiv.style.width = "26px";
        numDiv.style.height = "26px";
        numDiv.style.borderRadius = "50%";
        numDiv.style.display = "flex";
        numDiv.style.justifyContent = "center";
        numDiv.style.alignItems = "center";
        numDiv.style.fontSize = "0.78rem";
        numDiv.style.fontWeight = m === pickerState.min ? "bold" : "normal";
        numDiv.style.color = m === pickerState.min ? "#00d2d3" : "#fff";
        numDiv.textContent = String(m).padStart(2, "0");
        container.appendChild(numDiv);
      }
    }
  }

  function updateClockPointer() {
    const hand = document.getElementById("clock-pointer-hand");
    if (!hand) return;

    let angleDeg = 0;
    let handHeight = 82;

    if (pickerState.mode === "hour") {
      const h = pickerState.hour;
      const isOuter = (h === 0 || h >= 13);
      const step = h % 12;
      angleDeg = step * 30;
      handHeight = isOuter ? 90 : 58;
    } else {
      angleDeg = (pickerState.min / 60) * 360;
      handHeight = 90;
    }

    hand.style.height = `${handHeight}px`;
    hand.style.transform = `translateX(-50%) rotate(${angleDeg}deg)`;
  }

  function renderClockPickerUI() {
    updatePickerDayUI();
    const pTabHour = document.getElementById("picker-tab-hour");
    const pTabMin = document.getElementById("picker-tab-min");
    const pHint = document.getElementById("picker-mode-hint");

    const hh = String(pickerState.hour).padStart(2, "0");
    const mm = String(pickerState.min).padStart(2, "0");
    if (pTabHour) pTabHour.textContent = hh;
    if (pTabMin) pTabMin.textContent = mm;

    if (pickerState.mode === "hour") {
      if (pTabHour) {
        pTabHour.style.background = "rgba(0,210,211,0.25)";
        pTabHour.style.borderColor = "#00d2d3";
        pTabHour.style.color = "#00d2d3";
      }
      if (pTabMin) {
        pTabMin.style.background = "rgba(255,255,255,0.06)";
        pTabMin.style.borderColor = "rgba(255,255,255,0.15)";
        pTabMin.style.color = "var(--text-muted)";
      }
      if (pHint) pHint.textContent = "文字盤をタップして「時 (00〜23)」を選択";
    } else {
      if (pTabMin) {
        pTabMin.style.background = "rgba(0,210,211,0.25)";
        pTabMin.style.borderColor = "#00d2d3";
        pTabMin.style.color = "#00d2d3";
      }
      if (pTabHour) {
        pTabHour.style.background = "rgba(255,255,255,0.06)";
        pTabHour.style.borderColor = "rgba(255,255,255,0.15)";
        pTabHour.style.color = "var(--text-muted)";
      }
      if (pHint) pHint.textContent = "文字盤をタップまたはなぞって「分 (1分単位)」を選択";
    }

    renderClockNumbers();
    updateClockPointer();
  }

  function stepPickerMin(diff) {
    let m = pickerState.min + diff;
    let h = pickerState.hour;
    while (m < 0) {
      m += 60;
      h = (h - 1 + 24) % 24;
    }
    while (m >= 60) {
      m -= 60;
      h = (h + 1) % 24;
    }
    pickerState.min = m;
    pickerState.hour = h;
    renderClockPickerUI();
  }

  function handleDialInteraction(e) {
    const dial = document.getElementById("clock-dial-face");
    if (!dial) return;
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let angleRad = Math.atan2(dx, -dy);
    if (angleRad < 0) angleRad += 2 * Math.PI;
    const angleDeg = angleRad * (180 / Math.PI);

    if (pickerState.mode === "hour") {
      let step12 = Math.round(angleDeg / 30) % 12;
      const isInner = dist < 74;
      if (isInner) {
        pickerState.hour = step12 === 0 ? 12 : step12;
      } else {
        pickerState.hour = step12 === 0 ? 0 : step12 + 12;
      }
      renderClockPickerUI();
    } else {
      let m = Math.round((angleDeg / 360) * 60) % 60;
      pickerState.min = m;
      renderClockPickerUI();
    }
  }

  function initTimePickerUI() {
    updateWizardClockDisplay();

    // 今日 / 明日 ボタン
    document.getElementById("wizard-date-today-btn")?.addEventListener("click", () => {
      const d = getWizardStartTimeDate();
      const now = new Date();
      d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      setWizardStartTimeDate(d);
    });

    document.getElementById("wizard-date-tomorrow-btn")?.addEventListener("click", () => {
      const d = getWizardStartTimeDate();
      const now = new Date();
      now.setDate(now.getDate() + 1);
      d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      setWizardStartTimeDate(d);
    });

    // 微調整ボタン
    document.querySelectorAll(".wizard-step-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const step = parseInt(btn.getAttribute("data-step-min"), 10) || 0;
        const d = getWizardStartTimeDate();
        d.setMinutes(d.getMinutes() + step);
        setWizardStartTimeDate(d);
      });
    });

    // モーダル開閉
    const modalClock = document.getElementById("modal-clock-picker");
    const openClockModalBtn = document.getElementById("wizard-clock-display-btn");
    const cancelClockModalBtn = document.getElementById("picker-btn-cancel");
    const okClockModalBtn = document.getElementById("picker-btn-ok");

    function openClockPickerModal() {
      const d = getWizardStartTimeDate();
      const now = new Date();
      pickerState.isTomorrow = d.getDate() !== now.getDate() || d.getMonth() !== now.getMonth();
      pickerState.hour = d.getHours();
      pickerState.min = d.getMinutes();
      pickerState.mode = "hour";
      renderClockPickerUI();
      if (modalClock) modalClock.style.display = "flex";
    }

    function closeClockPickerModal() {
      if (modalClock) modalClock.style.display = "none";
    }

    openClockModalBtn?.addEventListener("click", openClockPickerModal);
    cancelClockModalBtn?.addEventListener("click", closeClockPickerModal);

    okClockModalBtn?.addEventListener("click", () => {
      const now = new Date();
      if (pickerState.isTomorrow) {
        now.setDate(now.getDate() + 1);
      }
      now.setHours(pickerState.hour, pickerState.min, 0, 0);
      setWizardStartTimeDate(now);
      closeClockPickerModal();
    });

    // モーダル内 今日/明日
    document.getElementById("picker-day-today")?.addEventListener("click", () => {
      pickerState.isTomorrow = false;
      updatePickerDayUI();
    });
    document.getElementById("picker-day-tomorrow")?.addEventListener("click", () => {
      pickerState.isTomorrow = true;
      updatePickerDayUI();
    });

    // 時 / 分 タブ
    document.getElementById("picker-tab-hour")?.addEventListener("click", () => {
      pickerState.mode = "hour";
      renderClockPickerUI();
    });
    document.getElementById("picker-tab-min")?.addEventListener("click", () => {
      pickerState.mode = "min";
      renderClockPickerUI();
    });

    // ステッパー
    document.getElementById("picker-step-minus5")?.addEventListener("click", () => stepPickerMin(-5));
    document.getElementById("picker-step-minus1")?.addEventListener("click", () => stepPickerMin(-1));
    document.getElementById("picker-step-plus1")?.addEventListener("click", () => stepPickerMin(1));
    document.getElementById("picker-step-plus5")?.addEventListener("click", () => stepPickerMin(5));

    // 文字盤ドラッグ操作
    const dial = document.getElementById("clock-dial-face");
    if (dial) {
      dial.addEventListener("mousedown", (e) => {
        pickerState.isDragging = true;
        handleDialInteraction(e);
      });
      window.addEventListener("mousemove", (e) => {
        if (pickerState.isDragging) handleDialInteraction(e);
      });
      window.addEventListener("mouseup", () => {
        if (pickerState.isDragging) {
          pickerState.isDragging = false;
          if (pickerState.mode === "hour") {
            pickerState.mode = "min";
            renderClockPickerUI();
          }
        }
      });

      dial.addEventListener("touchstart", (e) => {
        pickerState.isDragging = true;
        handleDialInteraction(e);
      }, { passive: false });
      window.addEventListener("touchmove", (e) => {
        if (pickerState.isDragging) {
          e.preventDefault();
          handleDialInteraction(e);
        }
      }, { passive: false });
      window.addEventListener("touchend", () => {
        if (pickerState.isDragging) {
          pickerState.isDragging = false;
          if (pickerState.mode === "hour") {
            pickerState.mode = "min";
            renderClockPickerUI();
          }
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTimePickerUI);
  } else {
    initTimePickerUI();
  }
})();
