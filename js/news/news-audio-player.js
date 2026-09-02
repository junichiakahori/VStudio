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
    if (isCatChanged && catName) {
      const phrases = [
        `続いては、${catName}のニュースです。`,
        `変わりまして、${catName}の話題をお届けします。`,
        `次のトピックス、${catName}です。`
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    }
    const generalPhrases = [
      "続いてのニュースです。",
      "変わりまして、次の話題です。",
      "続いてはこちらのニュースです。"
    ];
    return generalPhrases[Math.floor(Math.random() * generalPhrases.length)];
  }

  window.getNewsTransitionPhrase = getNewsTransitionPhrase;

  window.newsAudioPlayer = {
    playSE,
    getNewsTransitionPhrase
  };
})();
