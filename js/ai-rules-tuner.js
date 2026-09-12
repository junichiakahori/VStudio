/**
 * ai-rules-tuner.js
 * 配信画面（UIパネル）から読み上げルール（tts_rules.json）を
 * 自然言語で即座に安全更新するクライアントエンジン
 */

(function () {
  "use strict";

  function initAIRulesTuner() {
    const inputEl = document.getElementById("ai-rule-tuner-input");
    const submitBtn = document.getElementById("ai-rule-tuner-submit-btn");
    const statusEl = document.getElementById("ai-rule-tuner-status");

    if (!inputEl || !submitBtn) return;

    let isSubmitting = false;

    function showStatus(text, isSuccess) {
      if (!statusEl) return;
      statusEl.style.display = "block";
      statusEl.textContent = text;
      if (isSuccess) {
        statusEl.style.background = "rgba(0, 230, 118, 0.15)";
        statusEl.style.color = "#00e676";
        statusEl.style.border = "1px solid rgba(0, 230, 118, 0.3)";
      } else {
        statusEl.style.background = "rgba(255, 71, 87, 0.15)";
        statusEl.style.color = "#ff4757";
        statusEl.style.border = "1px solid rgba(255, 71, 87, 0.3)";
      }
    }

    async function handleTuneSubmit() {
      if (isSubmitting) return;
      const instruction = inputEl.value.trim();
      if (!instruction) {
        showStatus("⚠️ 指示文を入力してください（例: Aimer は エメ）", false);
        return;
      }

      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.7";
      submitBtn.innerHTML = `<span>⏳</span><span>AI解析・ルール反映中...</span>`;
      showStatus("🤖 AIがルールを解析・登録中...", true);

      try {
        const port = window.location.port === "8444" ? "8002" : "8001";
        const apiUrl = `http://127.0.0.1:${port}/api/tune-tts-rule`;

        const resp = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: instruction })
        });

        const data = await resp.json();

        if (data && data.success) {
          showStatus(`✅ 登録完了: 「${data.word}」➔「${data.reading}」`, true);
          inputEl.value = "";

          // 非同期トースト通知（Live2DStudio共通）
          if (typeof window.showNotification === "function") {
            window.showNotification(`📖 読みルールを更新しました: ${data.word} ➔ ${data.reading}`, "success");
          } else if (typeof window.showWizardToast === "function") {
            window.showWizardToast(`📖 読みルールを更新しました: ${data.word} ➔ ${data.reading}`);
          }
        } else {
          const err = data?.error || "ルールの解析に失敗しました。";
          showStatus(`❌ ${err}`, false);
        }
      } catch (err) {
        console.error("[AIRulesTuner] API Request Failed:", err);
        showStatus(`❌ 通信エラー: APIサーバー（ポート8001）を確認してください。`, false);
      } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.innerHTML = `<span>⚡</span><span>AIでルールに即時反映</span>`;
      }
    }

    submitBtn.addEventListener("click", handleTuneSubmit);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        handleTuneSubmit();
      }
    });

    console.log("[AIRulesTuner] 🤖 AI読み上げチューナー初期化完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAIRulesTuner);
  } else {
    initAIRulesTuner();
  }

  // 画面動的切り替えやUIロードイベントへの登録
  if (typeof window.onUILoaded === "function") {
    window.onUILoaded("ai-rules-tuner", initAIRulesTuner);
  }
})();
