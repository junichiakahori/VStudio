async function playNextVoicevox() {
  if (voicevoxAudioQueue.length === 0) {
    isVoicevoxPlaying = false;
    if (typeof resetIdleTimer === "function") resetIdleTimer();
    return;
  }
  isVoicevoxPlaying = true;
  const item = voicevoxAudioQueue.shift();

  let text = item;
  currentPlayingIsIdle = false;

  if (typeof item === "object" && item !== null && item.promise) {
    currentPlayingIsIdle = item.isIdle || false;
    try {
      text = await item.promise;
    } catch (e) {
      text = item.original;
    }
  }
  const speakerId = voicevoxSpeakerId ? voicevoxSpeakerId.value : "3";

  try {
    // 1. Audio Query
    const queryRes = await fetch(
      `http://127.0.0.1:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
      {
        method: "POST",
      },
    );
    if (!queryRes.ok) throw new Error("Audio query failed");
    const queryJson = await queryRes.json();

    // 語尾のイントネーション調整
    const cleanText = text.trim();
    if (
      cleanText.match(/のだ[！!ー…\.。]*$/) ||
      cleanText.match(/なのだ[！!ー…\.。]*$/)
    ) {
      // ずんだもんの「のだ」：語尾を自然に下げるため、最後の文字（だ）のピッチを静かに落とす
      const phrases = queryJson.accent_phrases;
      if (phrases && phrases.length > 0) {
        const lastPhrase = phrases[phrases.length - 1];
        if (lastPhrase.moras && lastPhrase.moras.length > 0) {
          const len = lastPhrase.moras.length;
          // 「の」が跳ね上がるのを防ぐため、アクセントは変更せずピッチの数値だけを滑らかに下げる
          lastPhrase.moras[len - 1].pitch -= 0.8;
          if (len > 1) {
            lastPhrase.moras[len - 2].pitch -= 0.2;
          }
        }
      }
    }

    // 2. Synthesis
    const synthRes = await fetch(
      `http://127.0.0.1:50021/synthesis?speaker=${speakerId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queryJson),
      },
    );
    if (!synthRes.ok) throw new Error("Synthesis failed");
    const arrayBuffer = await synthRes.arrayBuffer();

    // 3. Play Audio
    if (!voicevoxAudioContext) {
      voicevoxAudioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    if (voicevoxAudioContext.state === "suspended") {
      console.warn(
        "[VOICEVOX] AudioContext is suspended. Please click the page to unmute.",
      );
      voicevoxAudioContext
        .resume()
        .catch((e) => console.error("[VOICEVOX] Resume error:", e));
    }

    const audioBuffer = await voicevoxAudioContext.decodeAudioData(arrayBuffer);
    currentVoicevoxSource = voicevoxAudioContext.createBufferSource();
    currentVoicevoxSource.buffer = audioBuffer;

    if (!voicevoxAnalyser) {
      voicevoxAnalyser = voicevoxAudioContext.createAnalyser();
      voicevoxAnalyser.fftSize = 256;
    }
    if (!voicevoxGainNode) {
      voicevoxGainNode = voicevoxAudioContext.createGain();
      const volSlider = document.getElementById("voicevox-volume-slider");
      if (volSlider) {
        voicevoxGainNode.gain.value = parseFloat(volSlider.value) / 100.0;
      }
    }

    currentVoicevoxSource.connect(voicevoxGainNode);
    voicevoxGainNode.connect(voicevoxAnalyser);
    voicevoxAnalyser.connect(voicevoxAudioContext.destination);

    currentVoicevoxSource.onended = () => {
      if (currentVoicevoxSource) currentVoicevoxSource.disconnect();
      currentVoicevoxSource = null;
      isVoicevoxPlaying = false;
      // ラジオモードかつキューが空の場合、短い間隔で次の台本行を読む
      const radioModeToggle = document.getElementById("ai-radio-mode-toggle");
      const isRadioMode = radioModeToggle && radioModeToggle.checked;
      const aiRemakeToggle = document.getElementById("ai-idle-remake-toggle");
      const aiApiKeyInput = document.getElementById("ai-api-key");
      const hasApiKey = aiApiKeyInput && aiApiKeyInput.value.trim();
      const isRadioActive = isRadioMode; // ラジオモードはAI機能に依存しない

      if (
        isRadioActive &&
        radioModeState.currentPhase === "playing" &&
        radioModeState.scriptLines &&
        radioModeState.currentScriptIndex < radioModeState.scriptLines.length &&
        voicevoxAudioQueue.length === 0
      ) {
        // 1〜2秒後に次の行を読む
        setTimeout(() => triggerIdleSpeech(), 1500);
      } else {
        playNextVoicevox();
      }
    };

    console.log(`[VOICEVOX] Playing: "${text}" (Speaker ID: ${speakerId})`);
    currentVoicevoxSource.start(0);
  } catch (e) {
    console.error("VOICEVOX Error:", e);
    playNextVoicevox(); // Skip to next
  }
}

window.playNextVoicevox = playNextVoicevox;
async function queueVoicevoxAudio(
  text,
  isIdle = false,
  preConvertedYomi = null,
) {
  // スペース（半角・全角）を読点（、）に変換して、VOICEVOXが適切に区切って読めるようにする
  let targetText = preConvertedYomi ? preConvertedYomi : text;
  let processedText = targetText.replace(/[ 　]+/g, "、");

  // VOICEVOXは長すぎるテキストを1リクエストで処理できない（URLが長すぎて500エラー）
  // 読点・句点・感嘆符・疑問符で分割し、150文字以内のチャンクに分けてキューに積む
  const MAX_CHUNK_CHARS = 150;
  if (processedText.length > MAX_CHUNK_CHARS) {
    // 読点・句点・！？などで分割
    const splitPattern = /(?<=[、。！？!?…])/g;
    const parts = processedText.split(splitPattern).filter((p) => p.length > 0);

    let chunk = "";
    for (const part of parts) {
      if ((chunk + part).length > MAX_CHUNK_CHARS && chunk.length > 0) {
        // 現在のchunkをキューに積む
        const chunkText = chunk;
        if (preConvertedYomi) {
          voicevoxAudioQueue.push({
            original: chunkText,
            promise: Promise.resolve(chunkText),
            isIdle,
          });
        } else {
          const aiHiraganaToggle =
            document.getElementById("ai-hiragana-toggle");
          if (aiHiraganaToggle && aiHiraganaToggle.checked) {
            let promise = aiFeatures
              .convertToHiraganaWithAI(
                chunkText,
                aiHiraganaCache,
                saveHiraganaData,
              )
              .then((hiragana) => {
                return aiFeatures.restorePunctuation(chunkText, hiragana);
              });
            voicevoxAudioQueue.push({
              original: chunkText,
              promise: promise,
              isIdle,
            });
          } else {
            voicevoxAudioQueue.push({
              original: chunkText,
              promise: Promise.resolve(chunkText),
              isIdle,
            });
          }
        }
        chunk = part;
      } else {
        chunk += part;
      }
    }
    // 残りをキューに積む
    if (chunk.length > 0) {
      if (preConvertedYomi) {
        voicevoxAudioQueue.push({
          original: chunk,
          promise: Promise.resolve(chunk),
          isIdle,
        });
      } else {
        const aiHiraganaToggle = document.getElementById("ai-hiragana-toggle");
        if (aiHiraganaToggle && aiHiraganaToggle.checked) {
          let promise = aiFeatures
            .convertToHiraganaWithAI(chunk, aiHiraganaCache, saveHiraganaData)
            .then((hiragana) => {
              return aiFeatures.restorePunctuation(chunk, hiragana);
            });
          voicevoxAudioQueue.push({
            original: chunk,
            promise: promise,
            isIdle,
          });
        } else {
          voicevoxAudioQueue.push({
            original: chunk,
            promise: Promise.resolve(chunk),
            isIdle,
          });
        }
      }
    }
  } else {
    if (preConvertedYomi) {
      voicevoxAudioQueue.push({
        original: processedText,
        promise: Promise.resolve(processedText),
        isIdle,
      });
    } else {
      const aiHiraganaToggle = document.getElementById("ai-hiragana-toggle");
      if (aiHiraganaToggle && aiHiraganaToggle.checked) {
        let promise = aiFeatures
          .convertToHiraganaWithAI(
            processedText,
            aiHiraganaCache,
            saveHiraganaData,
          )
          .then((hiragana) => {
            return aiFeatures.restorePunctuation(processedText, hiragana);
          });
        voicevoxAudioQueue.push({
          original: processedText,
          promise: promise,
          isIdle,
        });
      } else {
        voicevoxAudioQueue.push({
          original: processedText,
          promise: Promise.resolve(processedText),
          isIdle,
        });
      }
    }
  }

  if (
    !isIdle &&
    currentVoicevoxSource &&
    isVoicevoxPlaying &&
    currentPlayingIsIdle
  ) {
    const radioModeToggle = document.getElementById("ai-radio-mode-toggle");
    const isRadioMode = radioModeToggle && radioModeToggle.checked;
    console.log(
      isRadioMode
        ? "[VOICEVOX] ラジオ台本を中断してコメントを優先します！"
        : "[VOICEVOX] 独り言を中断してコメントを優先します！",
    );
    try {
      currentVoicevoxSource.stop(); // This triggers onended -> playNextVoicevox()
    } catch (e) {
      console.warn("Failed to stop current source", e);
    }
  } else if (!isVoicevoxPlaying) {
    playNextVoicevox();
  }

  if (typeof clearIdleTimer === "function") clearIdleTimer();
}

window.queueVoicevoxAudio = queueVoicevoxAudio;
