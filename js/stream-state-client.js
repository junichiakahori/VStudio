// ==============================================================================
// 📡 stream-state-client.js
// 本番配信フラグ（配信中 / 待機中）の一元管理・API同期クライアント
// アプリが常駐起動していても、実際の配信中か否かを確実に判定可能にする
// ==============================================================================

(function () {
  "use strict";

  window.currentStreamState = {
    is_streaming: false,
    stream_type: "none",
    started_at: null,
    details: {
      obs_streaming: false,
      news_running: false,
      radio_running: false,
      title: ""
    }
  };

  /**
   * 配信状態をサーバー（/api/stream_state）へ非同期通知・同期する
   * @param {Object} updates - { is_streaming, stream_type, news_running, radio_running, obs_streaming, title }
   */
  window.updateStreamState = async function (updates) {
    try {
      if (!updates || typeof updates !== "object") return;
      
      const port = location.port === "8444" ? "8002" : "8001";
      const apiUrl = `${location.protocol}//${location.hostname}:${port}/api/stream_state`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.state) {
          window.currentStreamState = data.state;
          const icon = data.state.is_streaming ? "📡 [配信中フラグON]" : "🛑 [配信フラグOFF]";
          console.log(`[StreamState] ${icon} 配信状態同期完了:`, data.state);
        }
      }
    } catch (err) {
      console.warn("[StreamState] 配信状態同期エラー:", err);
    }
  };

  /**
   * 現在の配信状態を取得する
   */
  window.getStreamState = function () {
    return window.currentStreamState;
  };

  // 起動時の初期化（初期状態を問い合わせ）
  async function initStreamState() {
    try {
      const port = location.port === "8444" ? "8002" : "8001";
      const apiUrl = `${location.protocol}//${location.hostname}:${port}/api/stream_state`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const state = await res.json();
        if (state) {
          window.currentStreamState = state;
          console.log("[StreamState] 初期配信状態を読み込みました:", state);
        }
      }
    } catch (e) {
      // 起動直後の軽微な失敗は無視
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStreamState);
  } else {
    initStreamState();
  }
})();

