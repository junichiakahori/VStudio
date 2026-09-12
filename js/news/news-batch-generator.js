/**
 * news-batch-generator.js: ニュース原稿バックグラウンド事前生成モジュール
 * - 記事一覧取得後、画面をブロックせずに裏で1件ずつ安全に生成キューを実行
 * - 進捗状況（完了件数/総件数/%）のリアルタイム通知
 * - 一時停止（Pause）、再開（Resume）、中止（Stop）の完全制御
 * - Gemini API の Rate Limit（RPM）を回避する安全待機（クールダウン）
 */

window.NewsBatchGenerator = (function() {
  let _items = [];
  let _currentIndex = 0;
  let _state = "idle"; // 'idle' | 'running' | 'paused' | 'stopped' | 'completed'
  let _abortController = null;
  let _listeners = [];
  let _intervalTimer = null;

  function _notify(eventType, data) {
    _listeners.forEach(fn => {
      try { fn(eventType, data); } catch (e) { console.error("[BatchGen Notify Err]", e); }
    });
    // カスタムイベントの発火（他ウィンドウ・モジュール連携用）
    window.dispatchEvent(new CustomEvent("news-batch-progress", {
      detail: { state: _state, ...getStatus() }
    }));
  }

  function getStatus() {
    const total = _items.length;
    const completed = _currentIndex;
    const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    const currentItem = _items[_currentIndex] || null;
    return {
      state: _state,
      total: total,
      completed: completed,
      percent: percent,
      currentTitle: currentItem ? currentItem.title : ""
    };
  }

  function addListener(fn) {
    if (typeof fn === "function" && !_listeners.includes(fn)) {
      _listeners.push(fn);
    }
  }

  function removeListener(fn) {
    _listeners = _listeners.filter(f => f !== fn);
  }

  async function _processNext() {
    if (_state !== "running") return;

    // 配信中（放送中）は配信側の生成を最優先するため、一時的に待機
    if (window.newsBroadcastState && window.newsBroadcastState.isRunning) {
      console.log("[原稿事前生成] 📡 ニュース配信中のためバッチ生成を一時スリープします...");
      _intervalTimer = setTimeout(_processNext, 3000);
      return;
    }

    if (_currentIndex >= _items.length) {
      _state = "completed";
      console.log(`[原稿事前生成] 🎉 全 ${_items.length} 件の原稿事前生成が完了しました！`);
      _notify("complete", getStatus());
      return;
    }

    const item = _items[_currentIndex];
    if (!item || !item.title) {
      _currentIndex++;
      _processNext();
      return;
    }

    const apiKeyInput = document.getElementById("ai-api-key");
    const providerSelect = document.getElementById("ai-provider-select");
    const modelInput = document.getElementById("ai-model-input");
    const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : "") || localStorage.getItem("savedAiApiKey") || localStorage.getItem("ai_api_key") || "";
    const provider = (providerSelect ? providerSelect.value : "") || localStorage.getItem("savedAiProvider") || "ollama";
    const modelName = (modelInput ? modelInput.value.trim() : "") || localStorage.getItem("savedAiModel") || (provider === "ollama" ? "qwen2.5:7b" : "gemini-1.5-flash");

    const isZundaMode = (typeof currentModelId !== "undefined" ? String(currentModelId) : "").includes("zunda");
    const charDescVal = isZundaMode
      ? "明るく元気なずんだ妖精のニュースキャスター「ずんだもん」です。語尾は「〜のだ」「〜なのだ」を使います。"
      : "愛嬌のある白猫のニュースキャスター「とろろ」です。語尾には自然に「〜にゃ」「〜にゃ！」を使います。";

    const payload = {
      title: item.title,
      description: item.description || "",
      url: item.link || "",
      categoryName: item.categoryName || "",
      pubDate: item.pubDate || "",
      source: item.publisher || item.source || "",
      modelId: window.currentModelId || "hiyori",
      charDesc: charDescVal,
      isFirst: (_currentIndex === 0),
      isCategoryChanged: false,
      apiKey: apiKey,
      provider: provider,
      modelName: modelName,
      articleIndex: _currentIndex + 1,
      totalArticles: _items.length
    };

    _notify("item-start", getStatus());

    try {
      _abortController = new AbortController();
      const res = await fetch("/api/news/generate_item_script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: _abortController.signal
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[原稿事前生成] ✅ [${_currentIndex + 1}/${_items.length}] '${item.title.substring(0, 20)}...'`);
      } else {
        console.warn(`[原稿事前生成] ⚠️ [${_currentIndex + 1}/${_items.length}] HTTP ${res.status}`);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("[原稿事前生成] ⏹️ リクエストが中止されました");
        return;
      }
      console.warn("[原稿事前生成] 生成エラー:", err && err.message ? err.message : err);
    } finally {
      _abortController = null;
    }

    _currentIndex++;
    _notify("progress", getStatus());

    if (_state === "running") {
      // API Rate Limit（分間リクエスト制限）を確実に防ぐための安全ウェイト（1.0秒）
      _intervalTimer = setTimeout(_processNext, 1000);
    }
  }

  function start(items) {
    if (!items || items.length === 0) return;
    if (_state === "running") return; // 既に走行中

    // 中断からの再開ではなく新規スタートの場合
    if (_state !== "paused") {
      _items = items;
      _currentIndex = 0;
    }
    _state = "running";
    console.log(`[原稿事前生成] ▶️ バックグラウンド生成を開始します (全 ${_items.length} 件中 ${_currentIndex + 1} 件目〜)`);
    _notify("start", getStatus());
    _processNext();
  }

  function pause() {
    if (_state !== "running") return;
    _state = "paused";
    if (_intervalTimer) {
      clearTimeout(_intervalTimer);
      _intervalTimer = null;
    }
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    console.log(`[原稿事前生成] ⏸️ 一時停止しました (${_currentIndex}/${_items.length} 件)`);
    _notify("pause", getStatus());
  }

  function resume() {
    if (_state !== "paused") return;
    _state = "running";
    console.log(`[原稿事前生成] ▶️ 再開します (${_currentIndex + 1}/${_items.length} 件目〜)`);
    _notify("resume", getStatus());
    _processNext();
  }

  function stop() {
    _state = "stopped";
    if (_intervalTimer) {
      clearTimeout(_intervalTimer);
      _intervalTimer = null;
    }
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    console.log(`[原稿事前生成] ⏹️ 生成キューを中止しました`);
    _notify("stop", getStatus());
    _currentIndex = 0;
    _items = [];
  }

  return {
    start,
    pause,
    resume,
    stop,
    getStatus,
    addListener,
    removeListener
  };
})();
