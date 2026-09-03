// =====================================================================
// news-audio-player.js: 効果音(SE)・ジングル・繋ぎフレーズ再生モジュール
// =====================================================================

(function() {
    async function playSE(name, customVol = null) {
    try {
      const seVolSlider = document.getElementById("se-volume-slider") || document.getElementById("wizard-se-volume-slider");
      const seVol = (customVol !== null) ? customVol : (seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 0.85);
      const encoded = encodeURIComponent(name);

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = (typeof window.getVoicevoxAudioContext === "function") 
        ? window.getVoicevoxAudioContext() 
        : (window.voicevoxAudioContext || window.bgmAudioContext || new AudioCtxClass());

      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      let res = await fetch(`/se/${encoded}.mp3`);
      if (!res.ok) res = await fetch(`/se/${encoded}.wav`);
      if (!res.ok) throw new Error("SE file not found");

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      return new Promise((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(seVol, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.onended = () => {
          console.log(`[ニュースSE] ✅ 再生完了: ${name}`);
          resolve();
        };
        source.start(0);
        console.log(`[ニュースSE] 🔔 効果音再生開始: ${name} (音量: ${seVol})`);
      });
    } catch (err) {
      console.warn(`[ニュースSE] Web Audio再生エラー (${name}):`, err);
      // HTML5 Audio フォールバック
      try {
        const audio = new Audio(`/se/${encodeURIComponent(name)}.mp3`);
        audio.play().catch(e => console.warn("[ニュースSE] HTML5 Audio再生も拒否されました:", e));
      } catch(e) {}
    }
  }

  function getNewsTransitionPhrase(isFirst, isCatChanged, catName) {
    // 1件目はOP挨拶直後のため、クドい繋ぎセリフを挟まず直接見出しへ
    if (isFirst) {
      return "";
    }
    let phrase = "";
    if (isCatChanged && catName) {
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
