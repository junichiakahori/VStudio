// =====================================================================
// news-audio-player.js: 効果音(SE)・ジングル・繋ぎフレーズ再生モジュール
// =====================================================================

(function() {
  function playSE(name) {
    return new Promise((resolve) => {
      try {
        const seVolSlider = document.getElementById("se-volume-slider");
        const seVol = seVolSlider ? parseInt(seVolSlider.value, 10) / 100 : 0.85;
        const encoded = encodeURIComponent(name);
        const audio = new Audio(`/se/${encoded}.mp3`);
        audio.volume = seVol;

        let isEnded = false;
        const done = () => {
          if (!isEnded) {
            isEnded = true;
            resolve();
          }
        };

        audio.onended = done;
        audio.onerror = () => {
          const wavAudio = new Audio(`/se/${encoded}.wav`);
          wavAudio.volume = seVol;
          wavAudio.onended = done;
          wavAudio.onerror = () => {
            console.warn(`[ニュースSE] 音声ファイルが見つかりません (${name})`);
            done();
          };
          wavAudio.play().catch(e => { done(); });
        };

        audio.play().then(() => {
          console.log(`[ニュースSE] 🔔 効果音再生: ${name}`);
        }).catch(err => {
          console.warn(`[ニュースSE] 再生エラー (${name}):`, err);
          done();
        });
      } catch (err) {
        console.error(`[ニュースSE] 初期化エラー (${name}):`, err);
        resolve();
      }
    });
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
