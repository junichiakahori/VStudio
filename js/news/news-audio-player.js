// =====================================================================
// news-audio-player.js: 効果音(SE)・ジングル・繋ぎフレーズ再生モジュール
// =====================================================================

(function() {
  async function playSE(name, customVol = null) {
    try {
      const seVolSlider = document.getElementById("se-volume-slider") || document.getElementById("wizard-se-volume-slider");
      const seVol = (customVol !== null) ? customVol : (seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 0.85);
      const encoded = encodeURIComponent(name);

      // 🍏 HTML5 Audio で実音声を確実にスピーカーから発音 (CoreAudioスリープ・無音化の完全対策)
      const audioUrl = `/se/${encoded}.mp3`;
      const audioEl = new Audio(audioUrl);
      audioEl.volume = Math.min(1.0, Math.max(0.0, seVol));

      // Web Audio アナライザーがある場合は波形解析（メーター・リップシンク）も並行駆動
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        const ctx = (typeof window.getVoicevoxAudioContext === "function") 
          ? window.getVoicevoxAudioContext() 
          : (window.voicevoxAudioContext || window.bgmAudioContext || new AudioCtxClass());
        if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
          ctx.resume().catch(() => {});
        }
      } catch(e) {}

      return new Promise((resolve) => {
        audioEl.onended = () => {
          console.log(`[ニュースSE] ✅ 再生完了: ${name}`);
          resolve();
        };
        audioEl.onerror = () => {
          // wav フォールバック
          const wavAudio = new Audio(`/se/${encoded}.wav`);
          wavAudio.volume = Math.min(1.0, Math.max(0.0, seVol));
          wavAudio.onended = () => resolve();
          wavAudio.onerror = () => resolve();
          wavAudio.play().catch(() => resolve());
        };
        audioEl.play().then(() => {
          console.log(`[ニュースSE] 🔔 効果音再生開始: ${name} (音量: ${seVol})`);
        }).catch((err) => {
          console.warn(`[ニュースSE] HTML5 Audio再生エラー:`, err);
          resolve();
        });
      });
    } catch (err) {
      console.warn(`[ニュースSE] 再生例外 (${name}):`, err);
    }
  }

  function getNewsTransitionPhrase(isFirst, isCatChanged, catName) {
    let phrase = "";
    if (isFirst) {
      const firstPhrases = [
        "それでは、最初のニュースです。",
        "まずは、最初のニュースをお伝えします。",
        "最初の話題はこちらです。",
        "では、注目の最初のニュースから見ていきましょう。"
      ];
      phrase = firstPhrases[Math.floor(Math.random() * firstPhrases.length)];
    } else if (isCatChanged && catName) {
      const phrases = [
        `続いては、${catName}のニュースです。`,
        `変わりまして、${catName}の話題をお届けします。`,
        `次のトピックス、${catName}です。`
      ];
      phrase = phrases[Math.floor(Math.random() * phrases.length)];
    } else {
      const generalPhrases = [
        "続いてのニュースです。",
        "変わりまして、次の話題です。",
        "続いてはこちらのニュースです。",
        "次のニュースをお伝えします。"
      ];
      phrase = generalPhrases[Math.floor(Math.random() * generalPhrases.length)];
    }


    // 🐱 現在のアバターモデル（とろろ/ずんだもん/ヒヨリ等）の口調を適用
    const currentModelId = window.currentModelId || localStorage.getItem("selectedModel") || "tororo";
    if (window.aiFeatures && typeof window.aiFeatures.adjustIdlePhraseForModel === "function") {
      phrase = window.aiFeatures.adjustIdlePhraseForModel(phrase, currentModelId);
    } else if (currentModelId === "tororo" || currentModelId === "hijiki") {
      phrase = phrase.replace(/です([。！!]|$)/, "ですにゃ$1").replace(/ます([。！!]|$)/, "ますにゃ$1");
    } else if (currentModelId === "zundamon") {
      phrase = phrase.replace(/です([。！!]|$)/, "なのだ$1").replace(/ます([。！!]|$)/, "るのだ$1");
    }

    return phrase;
  }

  window.getNewsTransitionPhrase = getNewsTransitionPhrase;

  window.newsAudioPlayer = {
    playSE,
    getNewsTransitionPhrase
  };
})();
