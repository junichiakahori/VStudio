// =====================================================================
// news-config-manager.js: キャスター設定・時刻連動挨拶・プロンプト管理
// =====================================================================

(function() {
  function getTimeBasedGreeting(isZunda = false, title = "ニュース番組") {
    const hour = new Date().getHours();
    if (isZunda) {
      if (hour >= 5 && hour < 11) return `おはようございますなのだ！本日の${title}をお届けするのだ！`;
      if (hour >= 11 && hour < 17) return `こんにちはなのだ！最新の${title}をお伝えするのだ！`;
      return `こんばんはなのだ！今日の${title}をまとめてチェックするのだ！`;
    }
    const cleanTitle = title.replace(/^(最新の|本日の|今日の)/, "");
    if (hour >= 5 && hour < 11) return `おはようございます。本日の${cleanTitle}をお届けいたします。`;
    if (hour >= 11 && hour < 17) return `こんにちは。${title}をお伝えいたします。`;
    return `こんばんは。${title}をまとめてお伝えいたします。`;
  }

  function getTimeBasedClosing(isZunda = false) {
    const hour = new Date().getHours();
    if (isZunda) {
      if (hour >= 5 && hour < 11) return "以上、本日の最新ニュースをお届けしたのだ！それでは、今日も一日、元気に頑張るのだ！";
      if (hour >= 11 && hour < 17) return "以上、この時間の最新ニュースをお伝えしたのだ！午後も良い時間をお過ごしくださいなのだ！";
      return "以上、本日のニュースをお伝えしたのだ！明日も良い一日になりますように。おやすみなさいなのだ！";
    }
    if (hour >= 5 && hour < 11) return "以上、本日の最新ニュースをお届けいたしました。それでは、今日も素敵な一日をお過ごしください。";
    if (hour >= 11 && hour < 17) return "以上、この時間の最新ニュースをお伝えいたしました。それでは、引き続き良い時間をお過ごしください。";
    return "以上、本日のニュースをお伝えいたしました。それでは、明日も良い一日をお過ごしください。おやすみなさい。";
  }

  function getNewsConfig() {
    const title = document.getElementById("news-config-title")?.value || document.getElementById("news-program-title")?.value || "今日の最新ニュース";
    const op = document.getElementById("news-config-opening")?.value || document.getElementById("news-opening-text")?.value || getTimeBasedGreeting(false, title);
    const ed = document.getElementById("news-config-closing")?.value || document.getElementById("news-ending-text")?.value || getTimeBasedClosing(false);
    const useOpChime = document.getElementById("news-se-op-chime")?.checked ?? true;
    const useTransition = document.getElementById("news-se-transition")?.checked ?? true;
    const useEdChime = document.getElementById("news-se-ed-chime")?.checked ?? true;
    return { title, op, ed, useOpChime, useTransition, useEdChime };
  }

  window.newsConfigManager = {
    getTimeBasedGreeting,
    getTimeBasedClosing,
    getNewsConfig
  };
})();
