// =====================================================================
// wizard-core.js: ウィザード進行制御・システム健全性チェック・音声試聴
// =====================================================================

(function() {
  window.currentStep = 1;
  window.selectedMode = "news"; // 'chat' | 'radio' | 'news'
  window.openerWin = window.opener;

  // 🗓️ 配信予定日時のスマートフォーマッター (例: 9/1(火) 18:00)
  function formatScheduleDateTime(val) {
    if (!val) return "";
    let d = null;
    if (val instanceof Date) {
      d = val;
    } else {
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        d = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      } else {
        d = new Date(val);
      }
    }
    if (!d || isNaN(d.getTime())) return String(val);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const w = weekdays[d.getDay()];
    return `${mm}/${dd}(${w}) ${hh}:${mi}`;
  }
  window.formatScheduleDateTime = formatScheduleDateTime;

  // モードカードUI更新
  function updateModeUI() {
    const modeCards = document.querySelectorAll(".wizard-mode-card");
    modeCards.forEach(card => {
      const mode = card.getAttribute("data-mode");
      if (mode === window.selectedMode) {
        card.classList.add("selected");
        card.style.borderColor = mode === "radio" ? "#ff9900" : (mode === "news" ? "#00d2d3" : "#6c5ce7");
        card.style.boxShadow = `0 0 15px ${mode === "radio" ? "rgba(255,153,0,0.35)" : (mode === "news" ? "rgba(0,210,211,0.35)" : "rgba(108,92,231,0.35)")}`;
      } else {
        card.classList.remove("selected");
        card.style.borderColor = "rgba(255, 255, 255, 0.1)";
        card.style.boxShadow = "none";
      }
    });
  }
  window.updateModeUI = updateModeUI;

  // ステップ遷移制御
  function goToStep(step) {
    window.currentStep = step;
    for (let i = 1; i <= 4; i++) {
      const elContent = document.getElementById(`step-${i}`);
      const elNode = document.getElementById(`step-node-${i}`);
      if (elContent) elContent.style.display = i === step ? "flex" : "none";
      if (elNode) {
        elNode.className = "wizard-step-node";
        if (i === step) elNode.classList.add("active");
        else if (i < step) elNode.classList.add("completed");
      }
    }

    const prevBtn = document.getElementById("nav-prev-btn");
    const nextBtn = document.getElementById("nav-next-btn");
    const finishBtn = document.getElementById("nav-finish-btn");
    if (prevBtn) prevBtn.style.display = step > 1 ? "block" : "none";
    if (nextBtn) nextBtn.style.display = step < 4 ? "block" : "none";
    if (finishBtn) finishBtn.style.display = step === 4 ? "block" : "none";

    if (step === 2) checkSystemHealth();
    if (step === 3 && typeof window.updateStep3Content === "function") window.updateStep3Content();
    if (step === 4 && typeof window.updateStep4Inputs === "function") window.updateStep4Inputs();
  }
  window.goToStep = goToStep;

  // Step 2: サーバー状態・システム健全性確認
  async function checkSystemHealth() {
    // Local API
    const elLocal = document.getElementById("status-local-api");
    try {
      const r = await fetch("/custom_idle_phrases.json", { cache: "no-store" });
      if (r.ok && elLocal) {
        elLocal.textContent = "🟢 正常動作中";
        elLocal.style.color = "#00e676";
      }
    } catch (e) {
      if (elLocal) {
        elLocal.textContent = "🔴 停止中";
        elLocal.style.color = "#ff7675";
      }
    }

    // AI Engine
    const elAi = document.getElementById("status-ai-engine");
    try {
      const provider = (window.openerWin?.document?.getElementById("ai-provider-select")?.value) || localStorage.getItem("savedAiProvider") || "gemini";
      const apiKey = (window.openerWin?.document?.getElementById("ai-api-key")?.value) || localStorage.getItem("savedAiApiKey") || "";
      
      let isOllamaRunning = false;
      let ollamaModel = "";
      try {
        const ollamaRes = await fetch("http://localhost:11434/api/tags", { cache: "no-store" });
        if (ollamaRes.ok) {
          const ollamaData = await ollamaRes.json();
          isOllamaRunning = true;
          if (ollamaData.models && ollamaData.models.length > 0) {
            ollamaModel = ollamaData.models[0].name;
          }
        }
      } catch(e) {}

      if (provider === "ollama") {
        if (isOllamaRunning) {
          if (elAi) {
            elAi.textContent = `🟢 正常動作中 (Ollama: ${ollamaModel || "ローカルLLM"})`;
            elAi.style.color = "#00e676";
          }
        } else {
          if (elAi) {
            elAi.textContent = "🔴 停止中 (Ollamaを起動してください)";
            elAi.style.color = "#ff7675";
          }
        }
      } else if (provider === "openai") {
        if (apiKey.trim()) {
          if (elAi) {
            elAi.textContent = "🟢 API設定済み (OpenAI)";
            elAi.style.color = "#00e676";
          }
        } else {
          if (elAi) {
            elAi.textContent = "🟡 APIキー未設定 (定型文モード)";
            elAi.style.color = "#ffeaa7";
          }
        }
      } else {
        if (apiKey.trim()) {
          if (elAi) {
            elAi.textContent = "🟢 API設定済み (Gemini)";
            elAi.style.color = "#00e676";
          }
        } else if (isOllamaRunning) {
          if (elAi) {
            elAi.textContent = `🟢 正常動作中 (Ollama検出: ${ollamaModel || "qwen2.5"})`;
            elAi.style.color = "#00e676";
          }
        } else {
          if (elAi) {
            elAi.textContent = "🟡 APIキー未設定 (定型文モード)";
            elAi.style.color = "#ffeaa7";
          }
        }
      }
    } catch(e) {
      if (elAi) {
        elAi.textContent = "🟡 未設定 (定型文モード)";
        elAi.style.color = "#ffeaa7";
      }
    }

    // YouTube Comment Server
    const elYt = document.getElementById("status-yt-server");
    try {
      let isUp = false;
      try {
        const statusRes = await fetch("/_api/servers", { cache: "no-store" });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.youtube_comment_server) isUp = true;
        }
      } catch(e) {}

      if (!isUp) {
        const wsTest = new WebSocket("ws://localhost:8768");
        isUp = await new Promise((resolve) => {
          wsTest.onopen = () => { wsTest.close(); resolve(true); };
          wsTest.onerror = () => { resolve(false); };
          setTimeout(() => { try { wsTest.close(); } catch(e){} resolve(false); }, 1000);
        });
      }

      if (isUp) {
        if (elYt) {
          elYt.textContent = "🟢 正常動作中";
          elYt.style.color = "#00e676";
        }
      } else {
        throw new Error("unconnected");
      }
    } catch (e) {
      if (elYt) {
        elYt.textContent = "🔴 停止中 (配信開始時に自動起動)";
        elYt.style.color = "#ff7675";
      }
    }

    // VOICEVOX
    const elVv = document.getElementById("status-voicevox");
    try {
      const r = await fetch("http://localhost:50021/version", { cache: "no-store" });
      if (r.ok && elVv) {
        elVv.textContent = "🟢 正常動作中";
        elVv.style.color = "#00e676";
      }
    } catch (e) {
      if (elVv) {
        elVv.textContent = "🔴 停止中 (アプリを起動してください)";
        elVv.style.color = "#ff7675";
      }
    }

    // OBS
    const elObs = document.getElementById("status-obs");
    if (elObs) {
      if (window.openerWin && window.openerWin.isObsWsConnected) {
        elObs.textContent = "🟢 接続済み";
        elObs.style.color = "#00e676";
      } else {
        elObs.textContent = "🟡 未接続 (手動配信時はスキップ可)";
        elObs.style.color = "var(--text-muted, #888)";
      }
    }
  }
  window.checkSystemHealth = checkSystemHealth;

  // DOMContentLoaded初期化
  function initWizardCore() {
    const openerStatus = document.getElementById("opener-status");
    if (!window.openerWin && openerStatus) {
      openerStatus.textContent = "⚠️ スタジオ未接続 (親画面なし)";
      openerStatus.style.color = "#ff7675";
    }

    // モードカード クリックイベント
    const modeCards = document.querySelectorAll(".wizard-mode-card");
    modeCards.forEach(card => {
      card.addEventListener("click", () => {
        window.selectedMode = card.getAttribute("data-mode");
        updateModeUI();
      });
    });
    updateModeUI();

    // 試聴テストボタン類
    document.getElementById("btn-test-se-op")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-test-se-op");
      if (btn) btn.textContent = "🔊 再生中...";
      console.log("[Wizard] 🔔 チャイム試聴ボタンがクリックされました");
      try {
        if (window.openerWin && window.openerWin.newsAudioPlayer && typeof window.openerWin.newsAudioPlayer.playSE === "function") {
          window.openerWin.newsAudioPlayer.playSE("放送開始チャイム");
        }
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") await ctx.resume();
        const res = await fetch("/se/%E6%94%BE%E9%80%81%E9%96%8B%E5%A7%8B%E3%83%81%E3%83%A3%E3%82%A4%E3%83%A0.mp3");
        const buf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(buf);
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        src.start(0);
        console.log("[Wizard] ✅ チャイム試聴の再生を開始しました");
      } catch(e) {
        console.warn("[Wizard] チャイム再生エラー:", e);
        try {
          const audio = new Audio("/se/%E6%94%BE%E9%80%81%E9%96%8B%E5%A7%8B%E3%83%81%E3%83%A3%E3%82%A4%E3%83%A0.mp3");
          audio.play();
        } catch(err) {}
      }
      setTimeout(() => { if (btn) btn.textContent = "🔔 チャイム試聴"; }, 2500);
    });

    document.getElementById("voice-test-btn")?.addEventListener("click", () => {
      if (window.openerWin && typeof window.openerWin.queueVoicevoxAudio === "function") {
        const charId = window.openerWin.currentModelId || "";
        const msg = charId.includes("zunda")
          ? "マイクとボイスのテストなのだ！準備万端なのだ！"
          : "音声のテスト発声です。正常に出力されています。";
        window.openerWin.queueVoicevoxAudio(msg, true).catch(e => console.warn(e));
      } else {
        if (typeof window.showWizardToast === "function") {
          window.showWizardToast("ℹ️ 親画面（スタジオ）と連携して音声を出力します。", true);
        }
      }
    });

    document.getElementById("bgm-test-btn")?.addEventListener("click", () => {
      if (window.openerWin) {
        const playBtn = window.openerWin.document.getElementById("bgm-play-btn");
        if (playBtn) playBtn.click();
      }
    });

    // ナビゲーションボタン
    document.getElementById("nav-prev-btn")?.addEventListener("click", () => {
      if (window.currentStep > 1) goToStep(window.currentStep - 1);
    });
    document.getElementById("nav-next-btn")?.addEventListener("click", () => {
      if (window.currentStep < 4) goToStep(window.currentStep + 1);
    });

    // ステップノードの直接クリック
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`step-node-${i}`)?.addEventListener("click", () => {
        goToStep(i);
      });
    }

    // 外部連携ボタン
    document.getElementById("open-idle-settings-btn")?.addEventListener("click", () => {
      if (window.openerWin) {
        const tab = window.openerWin.document.querySelector('.tab-btn[data-target="tab-audio"]');
        if (tab) tab.click();
        window.openerWin.focus();
      }
    });

    document.getElementById("open-radio-script-btn")?.addEventListener("click", () => {
      if (window.openerWin) {
        const btn = window.openerWin.document.getElementById("ai-radio-script-btn");
        if (btn) btn.click();
        window.openerWin.focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWizardCore);
  } else {
    initWizardCore();
  }
})();
