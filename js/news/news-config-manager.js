// =====================================================================
// news-config-manager.js: キャスター設定・時刻連動挨拶・プロンプト管理
// =====================================================================

(function() {
  function getActiveModelId(explicitModelId = null) {
    if (explicitModelId) return explicitModelId;
    if (window.currentModelId) return window.currentModelId;
    if (window.opener && window.opener.currentModelId) return window.opener.currentModelId;
    try {
      return localStorage.getItem("live2d_current_model") || "tororo";
    } catch(e) {
      return "tororo";
    }
  }

  function getTimeSlotKey(hour = null) {
    const h = (hour !== null) ? hour : new Date().getHours();
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    return "night";
  }

  function getCustomTimeGreetings() {
    try {
      const saved = localStorage.getItem("savedNewsTimeGreetings");
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return null;
  }

  function getTimeBasedGreeting(modelIdOrIsZunda = null, title = "ニュース", timeSlot = null) {
    const customGreetings = getCustomTimeGreetings();
    const slot = timeSlot || getTimeSlotKey();

    if (customGreetings && customGreetings[slot] && customGreetings[slot].op && customGreetings[slot].op.trim()) {
      return customGreetings[slot].op.trim();
    }

    let modelId = "tororo";
    if (typeof modelIdOrIsZunda === "boolean") {
      modelId = modelIdOrIsZunda ? "zundamon" : "standard";
    } else if (typeof modelIdOrIsZunda === "string") {
      modelId = modelIdOrIsZunda;
    } else {
      modelId = getActiveModelId();
    }

    const cleanTitle = (title || "ニュース").replace(/^(最新の|本日の|今日の)/, "");

    // 猫系キャラクター (とろろ / ひじき)
    if (modelId === "tororo" || modelId === "hijiki") {
      const name = modelId === "hijiki" ? "ひじき" : "とろろ";
      if (slot === "morning") {
        return `おはようございますにゃ！AITuberの「${name}」が本日の${cleanTitle}をお伝えしますにゃ。`;
      }
      if (slot === "day") {
        return `こんにちはにゃ！AITuberの「${name}」が本日の${cleanTitle}をお伝えしますにゃ。`;
      }
      return `こんばんはにゃ！AITuberの「${name}」が今日の${cleanTitle}をお伝えしますにゃ。`;
    }

    // ずんだもん
    if (modelId.includes("zunda") || modelId === "zundamon") {
      if (slot === "morning") return `おはようございますなのだ！本日の${cleanTitle}をお届けするのだ！`;
      if (slot === "day") return `こんにちはなのだ！最新の${cleanTitle}をお伝えするのだ！`;
      return `こんばんはなのだ！今日の${cleanTitle}をまとめてチェックするのだ！`;
    }

    // 標準・その他キャスター
    if (slot === "morning") return `おはようございます。本日の${cleanTitle}をお届けいたします。`;
    if (slot === "day") return `こんにちは。${cleanTitle}をお伝えいたします。`;
    return `こんばんは。今日の${cleanTitle}をまとめてお伝えいたします。`;
  }

  function getTimeBasedClosing(modelIdOrIsZunda = null, timeSlot = null) {
    const customGreetings = getCustomTimeGreetings();
    const slot = timeSlot || getTimeSlotKey();

    if (customGreetings && customGreetings[slot] && customGreetings[slot].ed && customGreetings[slot].ed.trim()) {
      return customGreetings[slot].ed.trim();
    }

    let modelId = "tororo";
    if (typeof modelIdOrIsZunda === "boolean") {
      modelId = modelIdOrIsZunda ? "zundamon" : "standard";
    } else if (typeof modelIdOrIsZunda === "string") {
      modelId = modelIdOrIsZunda;
    } else {
      modelId = getActiveModelId();
    }

    // 猫系キャラクター (とろろ / ひじき)
    if (modelId === "tororo" || modelId === "hijiki") {
      const name = modelId === "hijiki" ? "ひじき" : "とろろ";
      if (slot === "morning") {
        return `本日のニュースは以上になりますにゃ。AITuberの「${name}」がお伝えしました。今日も素敵な一日をお過ごしくださいにゃ！`;
      }
      if (slot === "day") {
        return `本日のニュースは以上になりますにゃ。AITuberの「${name}」がお伝えしました。午後も良い時間をお過ごしくださいにゃ！`;
      }
      return `本日のニュースは以上になりますにゃ。AITuberの「${name}」がお伝えしました。明日も良い一日をお過ごしくださいにゃ！おやすみなさいにゃ。`;
    }

    // ずんだもん
    if (modelId.includes("zunda") || modelId === "zundamon") {
      if (slot === "morning") return "以上、本日の最新ニュースをお届けしたのだ！今日も一日、元気に頑張るのだ！";
      if (slot === "day") return "以上、この時間の最新ニュースをお伝えしたのだ！午後も良い時間をお過ごしくださいなのだ！";
      return "以上、本日のニュースをお伝えしたのだ！明日も良い一日になりますように。おやすみなさいなのだ！";
    }

    // 標準・その他キャスター
    if (slot === "morning") return "以上、本日の最新ニュースをお届けいたしました。それでは、今日も素敵な一日をお過ごしください。";
    if (slot === "day") return "以上、この時間の最新ニュースをお伝えいたしました。それでは、引き続き良い時間をお過ごしください。";
    return "以上、本日のニュースをお伝えいたしました。それでは、明日も良い一日をお過ごしください。おやすみなさい。";
  }

  function getNewsConfig() {
    const modelId = getActiveModelId();
    const title = document.getElementById("news-config-title")?.value || document.getElementById("news-program-title")?.value || "今日の最新ニュース";
    const opVal = document.getElementById("news-config-opening")?.value || document.getElementById("news-opening-text")?.value;
    const edVal = document.getElementById("news-config-closing")?.value || document.getElementById("news-ending-text")?.value;
    const op = (opVal && opVal.trim()) ? opVal.trim() : getTimeBasedGreeting(modelId, title);
    const ed = (edVal && edVal.trim()) ? edVal.trim() : getTimeBasedClosing(modelId);
    const useOpChime = document.getElementById("news-se-op-chime")?.checked ?? true;
    const useTransition = document.getElementById("news-se-transition")?.checked ?? true;
    const useEdChime = document.getElementById("news-se-ed-chime")?.checked ?? true;
    return { title, op, ed, useOpChime, useTransition, useEdChime };
  }

  window.newsConfigManager = {
    getActiveModelId,
    getTimeSlotKey,
    getCustomTimeGreetings,
    getTimeBasedGreeting,
    getTimeBasedClosing,
    getNewsConfig
  };
})();

