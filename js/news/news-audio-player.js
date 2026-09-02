// =====================================================================
// news-audio-player.js: 効果音(SE)・ジングル・繋ぎフレーズ再生モジュール
// =====================================================================

(function() {
  async function playSE(name) {
    try {
      const seVolSlider = document.getElementById("se-volume-slider");
      const seVol = seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 0.85;
      const encoded = encodeURIComponent(name);

      // 稼働実績のある共通 AudioContext を取得
      const ctx = (typeof window.getVoicevoxAudioContext === "function") 
        ? window.getVoicevoxAudioContext() 
        : (window.voicevoxAudioContext || window.bgmAudioContext || new (window.AudioContext || window.webkitAudioContext)());

      if (ctx && ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      if (ctx && typeof ctx.decodeAudioData === "function") {
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
            console.log(`[ニュースSE] ✅ 効果音再生完了: ${name}`);
            resolve();
          };
          source.start(0);
          console.log(`[ニュースSE] 🔔 効果音再生中: ${name}`);
        });
      }
    } catch (err) {
      console.warn(`[ニュースSE] Web Audio再生スキップ/フォールバック (${name}):`, err);
      // HTML5 Audio フォールバック
      try {
        const audio = new Audio(`/se/${encodeURIComponent(name)}.mp3`);
        audio.play().catch(() => {});
      } catch(e) {}
    }
  }

  function getNewsTransitionPhrase(isFirst, isCatChanged, catName) {
    if (isFirst) {
      return "それでは、最初のニュースです。";
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
      "次のニュースです。",
      "続いての話題です。",
      "変わりまして、次のニュースです。",
      "さて、続いてはこちらの話題です。"
    ];
    return generalPhrases[Math.floor(Math.random() * generalPhrases.length)];
  }

  window.newsAudioPlayer = {
    playSE,
    getNewsTransitionPhrase
  };
})();
