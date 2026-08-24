function initChatClient() {
  window.youtubeWs = null;
  window.tiktokWs = null;
  window.oauthAccessToken = null;
  window.tokenClient = null;
  window.isAiGenerating = false;
  window.aiResponseText = "";
  window.oauthStatInterval = null;
  window.youtubeReconnectTimer = null;
  window.tiktokReconnectTimer = null;

  function addCommentToViewer(
    nickname,
    comment,
    platform,
    isGift = false,
    iconUrl = "",
  ) {
    // サーバーから送られてきた履歴の重複表示・二重カウントを防ぐ
    const checkRange = commentHistory.slice(-50);
    const isDuplicate = checkRange.some(
      (c) =>
        c.nickname === nickname &&
        c.comment === comment &&
        c.platform === platform,
    );

    if (isDuplicate) return;

    commentHistory.push({ nickname, comment, platform, isGift, iconUrl });
    if (commentHistory.length > 100) {
      commentHistory.shift();
    }
    localStorage.setItem("savedCommentHistory", JSON.stringify(commentHistory));

    totalCommentsCount++;
    localStorage.setItem("savedTotalCommentsCount", totalCommentsCount);
    const statCommentsEl = document.getElementById("stat-comments");
    if (statCommentsEl) statCommentsEl.textContent = totalCommentsCount;

    const viewer = document.getElementById("comment-viewer");
    if (!viewer) return;

    const el = document.createElement("div");
    el.className = `comment-item ${platform}-comment`;
    if (isGift) el.classList.add("gift-comment");

    const icon =
      platform === "youtube" ? "🔴" : platform === "tiktok" ? "🎵" : "💬";

    let avatarHtml = "";
    if (iconUrl) {
      avatarHtml = `<img src="${iconUrl}" class="comment-avatar" alt="${nickname}" crossorigin="anonymous">`;
    }

    el.innerHTML = `<div class="comment-author">${avatarHtml}<span>${icon} ${nickname}</span></div><div class="comment-text">${comment}</div>`;
    viewer.appendChild(el);

    // 最新のコメントが見えるようにスクロール
    viewer.scrollTop = viewer.scrollHeight;

    // 最大100件まで保持
    while (viewer.children.length > 100) {
      viewer.removeChild(viewer.firstChild);
    }
  }

  window.isTiktokIntendedConnect = false;
  let tiktokReconnectTimer = null;

  if (tiktokConnectBtn) {
    tiktokConnectBtn.onclick = (event) => {
      const username = tiktokUserInput.value.trim();
      if (!username) {
        if (event && event.isTrusted) {
          alert("TikTokのユーザー名を入力してください");
        }
        return;
      }
      const savedTiktokId = localStorage.getItem("savedTiktokId");
      if (savedTiktokId && savedTiktokId !== username) {
        if (typeof clearAllComments === "function") clearAllComments();
      }
      localStorage.setItem("savedTiktokId", username);

      if (isTiktokIntendedConnect) {
        isTiktokIntendedConnect = false;
        clearTimeout(tiktokReconnectTimer);
        if (tiktokWs) {
          try {
            if (tiktokWs.readyState === WebSocket.OPEN) {
              tiktokWs.send(JSON.stringify({ type: "disconnect_tiktok" }));
            }
            tiktokWs.close();
          } catch (e) {}
          tiktokWs = null;
        }
        tiktokConnectBtn.textContent = "接続";
        tiktokConnectBtn.style.background = "var(--primary)";
        tiktokStatus.textContent = "未接続";
        joinedUsers.clear();
        return;
      }

      isTiktokIntendedConnect = true;
      joinedUsers.clear();
      tiktokStatus.textContent = "接続中...";
      tiktokWs = new WebSocket("ws://localhost:8767");

      tiktokWs.onopen = () => {
        tiktokWs.send(
          JSON.stringify({ type: "connect_tiktok", username: username }),
        );
        tiktokConnectBtn.textContent = "切断";
        tiktokConnectBtn.style.background = "var(--danger, #ff4444)";
        resetIdleTimer();
      };

      tiktokWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status") {
            tiktokStatus.textContent = data.message;
            if (data.status === "connected") {
              console.log("[TikTok] コメント読み上げの準備が完了しました！");
            }
            if (data.status === "error") {
              if (tiktokWs) {
                tiktokWs.close();
                tiktokWs = null;
              }
              tiktokConnectBtn.textContent = "接続";
              tiktokConnectBtn.style.background = "var(--primary)";
            }
          } else if (data.type === "join") {
            console.log(`[TikTok] ${data.nickname} joined`);
            if (
              isVoicevoxEnabled &&
              (typeof isStreamEndedState === "undefined" || !isStreamEndedState)
            ) {
              const cleanName = data.nickname
                .replace(
                  /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g,
                  "",
                )
                .trim();
              if (cleanName.length > 0) {
                const zunda =
                  isZundamonSelected() && currentModelId === "hiyori";
                if (joinedUsers.has(cleanName)) {
                  // 2回目以降の入室（戻ってきた）
                  let greet = zunda
                    ? `${cleanName}さん、おかえりなさいなのだ！`
                    : `${cleanName}さん、おかえりなさい！`;
                  greet = aiFeatures.adjustIdlePhraseForModel(
                    greet,
                    currentModelId,
                  );
                  queueCommentAudio(greet);
                } else {
                  // 初回の入室
                  joinedUsers.add(cleanName);
                  const timeGreeting = getTimeGreeting();
                  const phrases = zunda
                    ? [
                        "いらっしゃい！",
                        "ゆっくりしていってね！",
                        "遊びに来てくれてありがとうなのだ！",
                      ]
                    : [
                        "いらっしゃい！",
                        "ゆっくりしていってね！",
                        "遊びに来てくれてありがとう！",
                      ];
                  const randomPhrase =
                    phrases[Math.floor(Math.random() * phrases.length)];
                  aiEmotion = "joy";

                  let fullGreeting = zunda
                    ? `${cleanName}さん、${timeGreeting}なのだ！${randomPhrase}`
                    : `${cleanName}さん、${timeGreeting}！${randomPhrase}`;

                  fullGreeting = aiFeatures.adjustIdlePhraseForModel(
                    fullGreeting,
                    currentModelId,
                  );
                  queueCommentAudio(fullGreeting);
                }
              }
            }
          } else if (data.type === "gift") {
            console.log(`[TikTok] ${data.nickname} sent a gift`);
            addCommentToViewer(
              data.nickname,
              `🎁 ギフトを送りました！`,
              "tiktok",
              true,
              data.iconUrl,
            );
            if (
              isVoicevoxEnabled &&
              (typeof isStreamEndedState === "undefined" || !isStreamEndedState)
            ) {
              const cleanName = removeEmojis(data.nickname);
              if (cleanName.length > 0) {
                aiEmotion = "joy";
                const zunda =
                  isZundamonSelected() && currentModelId === "hiyori";
                let greet = zunda
                  ? `${cleanName}さん、ギフトありがとうなのだ！`
                  : `${cleanName}さん、ギフトありがとう！`;
                greet = aiFeatures.adjustIdlePhraseForModel(
                  greet,
                  currentModelId,
                );
                queueCommentAudio(greet);
              }
            }
          } else if (data.type === "like") {
            console.log(`[TikTok] ${data.nickname} sent likes`);
            if (typeof window.spawnReactionEffect === "function") {
              window.spawnReactionEffect("❤️", data.count || 2);
            }
          } else if (data.type === "reaction") {
            if (typeof window.spawnReactionEffect === "function") {
              window.spawnReactionEffect(data.emoji || "❤️", data.count || 1);
            }
          } else if (data.type === "comment") {
            console.log(`[TikTok] @${data.nickname}: ${data.comment}`);
            // 絵文字・リアクション検知
            const reactionMatches = (data.comment || "").match(/[❤️💖💕💓💗💘✨🌟🎉🥳👍😻🐾🔥🥰😍🙌⭐]/g);
            if (reactionMatches && typeof window.spawnReactionEffect === "function") {
              window.spawnReactionEffect(reactionMatches[0], Math.min(reactionMatches.length, 3));
            }
            addCommentToViewer(
              data.nickname,
              data.comment,
              "tiktok",
              false,
              data.iconUrl,
            );
            if (
              isVoicevoxEnabled &&
              (typeof isStreamEndedState === "undefined" || !isStreamEndedState)
            ) {
              // 絵文字を除去してテンポ良く読み上げる
              const cleanNickname = removeEmojis(data.nickname);
              const cleanComment = removeEmojis(data.comment);
              if (cleanComment.length > 0) {
                // ユーザーのコメントから感情を推測して即座に表情を変える
                aiEmotion = guessEmotionFromText(cleanComment);

                const timeGreeting = getTimeGreeting();
                const zunda =
                  isZundamonSelected() && currentModelId === "hiyori";
                const replies = [
                  {
                    keywords: [
                      "おはよう",
                      "おは",
                      "こんにちは",
                      "こんちわ",
                      "こんばん",
                      "やっほ",
                      "ハロー",
                    ],
                    response: zunda
                      ? `${timeGreeting}ー！来てくれてありがとうなのだ！`
                      : `${timeGreeting}ー！来てくれてありがとう！`,
                  },
                  {
                    keywords: [
                      "かわいい",
                      "可愛い",
                      "カワイイ",
                      "かわちい",
                      "美人",
                      "きれい",
                    ],
                    response: zunda
                      ? "えへへ、褒められちゃったのだ！ありがとうなのだ！"
                      : "えへへ、褒められちゃった！ありがとう！",
                  },
                  {
                    keywords: ["初見", "しょけん"],
                    response: zunda
                      ? "初見さん、初めましてなのだ！ゆっくりしていってほしいのだ！"
                      : "初見さん、初めまして！ゆっくりしていってね！",
                  },
                  {
                    keywords: ["草", "w", "ｗ", "ウケる", "笑", "ワロタ"],
                    response: zunda ? "あはははなのだっ！" : "あはははっ！",
                  },
                  {
                    keywords: [
                      "おつ",
                      "お疲れ",
                      "おつかれ",
                      "バイバイ",
                      "おやすみ",
                      "寝る",
                    ],
                    response: zunda
                      ? "お疲れ様なのだー！またねなのだ！"
                      : "お疲れ様ー！またね！",
                  },
                  {
                    keywords: ["？", "?", "なんで", "どうして"],
                    response: zunda
                      ? "んー、どうだろうねー？私には分かんないのだ！"
                      : "んー、どうだろうねー？私には分かんないや！",
                  },
                ];

                const matchedRule = replies.find((rule) =>
                  rule.keywords.some((kw) => cleanComment.includes(kw)),
                );
                const isQueueFull = voicevoxAudioQueue.length >= 5;

                // キューが溢れていて、かつ重要なキーワードも含まれていない場合はスキップ
                if (isQueueFull && !matchedRule) {
                  console.log(
                    `[TikTok Skip] 待機列過多のためスキップ: ${cleanComment}`,
                  );
                } else {
                  // 1. コメントを読み上げる
                  queueCommentAudio(`${cleanNickname}さん、${cleanComment}`);

                  if (
                    isAiReplyEnabled &&
                    aiApiKeyInput &&
                    aiApiKeyInput.value.trim().length > 0
                  ) {
                    // 2A. AIによる自動返信
                    generateAIResponse(cleanNickname, cleanComment);
                  } else {
                    // 2B. キーワードによる自動返信
                    if (matchedRule) {
                      const adjustedReply = aiFeatures.adjustIdlePhraseForModel(
                        matchedRule.response,
                        currentModelId,
                      );
                      queueCommentAudio(adjustedReply);
                    } else if (Math.random() < 0.2) {
                      // 3. キーワードに一致しなかった場合、たまに相槌を打つ（20%の確率）
                      const genericReplies = [
                        "なるほどなるほどー",
                        "たしかにー！",
                        "へぇー！",
                        "そうんだね！",
                        "わかるわかるー",
                      ];
                      const adjustedReply = aiFeatures.adjustIdlePhraseForModel(
                        genericReplies[
                          Math.floor(Math.random() * genericReplies.length)
                        ],
                        currentModelId,
                      );
                      queueCommentAudio(adjustedReply);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("TikTok WS parse error", e);
        }
      };

      tiktokWs.onclose = () => {
        if (isTiktokIntendedConnect) {
          tiktokStatus.textContent = "再接続中...";
          tiktokConnectBtn.textContent = "再接続";
          tiktokConnectBtn.style.background = "#ff8800";
          clearTimeout(tiktokReconnectTimer);
          tiktokReconnectTimer = setTimeout(() => {
            if (isTiktokIntendedConnect) tiktokConnectBtn.click();
          }, 5000);
        } else {
          tiktokStatus.textContent = "未接続";
          tiktokConnectBtn.textContent = "接続";
          tiktokConnectBtn.style.background = "var(--primary)";
        }
      };

      tiktokWs.onerror = (err) => {
        tiktokStatus.textContent = "未接続";
        if (typeof clearIdleTimer === "function") clearIdleTimer();
      };
    };

    // 保存されたTikTokIDがあれば入力欄に復元
    const savedTiktokId = localStorage.getItem("savedTiktokId");
    if (savedTiktokId !== null) {
      const trimmedTiktokId = savedTiktokId.trim();
      if (trimmedTiktokId) {
        if (tiktokUserInput) tiktokUserInput.value = trimmedTiktokId;
      } else {
        localStorage.removeItem("savedTiktokId");
      }
    }
  }

  window.isYoutubeIntendedConnect = false;
  let youtubeReconnectTimer = null;

  window.connectYoutubeLive = function(newVideoId = null) {
    if (newVideoId && youtubeUserInput) {
      youtubeUserInput.value = newVideoId.trim();
    }
    if (window.isYoutubeIntendedConnect) {
      // 既に接続中の場合は一度切断してから再接続
      if (youtubeConnectBtn) youtubeConnectBtn.click();
      setTimeout(() => {
        if (youtubeConnectBtn) youtubeConnectBtn.click();
      }, 300);
    } else {
      if (youtubeConnectBtn) youtubeConnectBtn.click();
    }
  };

  const youtubeChannelInput = document.getElementById("youtube-channel-input");
  const youtubeDetectBtn = document.getElementById("youtube-detect-btn");
  if (youtubeChannelInput) {
    const savedChannel = localStorage.getItem("savedYoutubeChannel") || "@drone.akahori";
    youtubeChannelInput.value = savedChannel;
    youtubeChannelInput.addEventListener("input", () => {
      localStorage.setItem("savedYoutubeChannel", youtubeChannelInput.value);
    });
  }

  if (youtubeUserInput) {
    let savedVid = localStorage.getItem("savedYoutubeVideoId") || "";
    if (savedVid.startsWith("@") || savedVid.includes("channel") || (savedVid.length !== 11 && savedVid.length > 0)) {
      savedVid = "";
      localStorage.removeItem("savedYoutubeVideoId");
    }
    youtubeUserInput.value = savedVid;
    youtubeUserInput.addEventListener("input", () => {
      localStorage.setItem("savedYoutubeVideoId", youtubeUserInput.value);
    });
  }
  if (youtubeDetectBtn) {
    youtubeDetectBtn.addEventListener("click", async () => {
      const channelVal = youtubeChannelInput ? youtubeChannelInput.value.trim() : "";
      if (!channelVal) {
        alert("配信者ID / @チャンネル名を入力してください");
        return;
      }
      youtubeDetectBtn.disabled = true;
      youtubeDetectBtn.textContent = "検出中...";
      try {
        const res = await fetch("http://localhost:8001/get_youtube_video_info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: channelVal })
        });
        if (res.ok) {
          const info = await res.json();
          if (info && info.videoId && info.videoId.length === 11) {
            if (youtubeUserInput) {
              youtubeUserInput.value = info.videoId;
              localStorage.setItem("savedYoutubeVideoId", info.videoId);
            }
            alert(`✅ 配信枠を検出しました: ${info.title} (${info.videoId})`);
          } else {
            alert(`⚠️ 枠情報: ${info.title || "現在進行中/予約中の枠が見つかりませんでした"}`);
          }
        }
      } catch (e) {
        alert("検出エラー: " + e.message);
      } finally {
        youtubeDetectBtn.disabled = false;
        youtubeDetectBtn.textContent = "📡 枠を検出";
      }
    });
  }

  // メイン画面用 配信枠一覧モーダル
  const mainModalPicker = document.getElementById("main-modal-broadcast-picker");
  const mainBtnClosePicker = document.getElementById("main-btn-close-broadcast-picker");
  const mainBtnOpenPicker = document.getElementById("youtube-select-modal-btn");
  const mainListContainer = document.getElementById("main-broadcast-picker-list");
  let mainCachedBroadcasts = [];
  let mainActiveFilter = "all";

  async function mainLoadBroadcasts() {
    if (!mainListContainer) return;
    mainListContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:20px;">⏳ 配信枠一覧を取得中...</div>';
    try {
      const res = await fetch("http://localhost:8001/api/youtube/list_broadcasts", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        mainCachedBroadcasts = data.items;
        mainRenderBroadcasts();
      } else {
        mainListContainer.innerHTML = `<div style="color:#ff7675; font-size:0.8rem; text-align:center; padding:20px;">⚠️ 取得エラー: ${data.error || "未認証です"}</div>`;
      }
    } catch (err) {
      mainListContainer.innerHTML = `<div style="color:#ff7675; font-size:0.8rem; text-align:center; padding:20px;">❌ 通信エラー: ${err.message}</div>`;
    }
  }

  function mainRenderBroadcasts() {
    if (!mainListContainer) return;
    mainListContainer.innerHTML = "";
    let filtered = mainCachedBroadcasts;
    if (mainActiveFilter === "upcoming") {
      filtered = mainCachedBroadcasts.filter(b => b.lifeCycleStatus === "ready" || b.lifeCycleStatus === "created" || b.lifeCycleStatus === "upcoming");
    }
    if (filtered.length === 0) {
      mainListContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:20px;">該当する配信枠が見つかりませんでした。</div>';
      return;
    }
    filtered.forEach(item => {
      const card = document.createElement("div");
      card.style.cssText = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.2s; display: flex; gap: 12px; align-items: center;";
      card.onmouseenter = () => { card.style.background = "rgba(0, 210, 211, 0.12)"; card.style.borderColor = "#00d2d3"; };
      card.onmouseleave = () => { card.style.background = "rgba(255,255,255,0.05)"; card.style.borderColor = "rgba(255,255,255,0.1)"; };

      let statusBadge = "⚪️ 待機中";
      let statusColor = "#aaa";
      if (item.lifeCycleStatus === "live") { statusBadge = "🟢 配信中 (Live)"; statusColor = "#00e676"; }
      else if (item.lifeCycleStatus === "ready" || item.lifeCycleStatus === "upcoming") { statusBadge = "🟡 予約・待機中"; statusColor = "#ffb400"; }
      else if (item.lifeCycleStatus === "complete") { statusBadge = "⚪️ 終了済"; statusColor = "#777"; }

      let timeStr = "指定なし";
      if (item.scheduledStartTime) {
        try {
          const d = new Date(item.scheduledStartTime);
          timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } catch (e) {}
      }

      let privacyBadge = item.privacyStatus === "public" ? "🌐 公開" : (item.privacyStatus === "unlisted" ? "🔒 限定公開" : "👁️ 非公開");
      const thumbUrl = item.thumbnail || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`;

      card.innerHTML = `
        <img src="${thumbUrl}" alt="Thumbnail" style="width: 110px; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; background: #000; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0;" onerror="this.src='https://i.ytimg.com/vi/${item.id}/hqdefault.jpg'">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.72rem; font-weight:bold; color:${statusColor};">${statusBadge}</span>
            <span style="font-size:0.7rem; color:var(--text-muted); background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px;">${privacyBadge}</span>
          </div>
          <div style="font-size:0.85rem; font-weight:bold; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${item.title || "無題の配信"}
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
            <span>⏰ 予定: ${timeStr}</span>
            <span style="font-family:monospace; color:#00d2d3;">ID: ${item.id}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        if (youtubeUserInput) {
          youtubeUserInput.value = item.id;
          localStorage.setItem("savedYoutubeVideoId", item.id);
        }
        if (mainModalPicker) mainModalPicker.style.display = "none";
      });

      mainListContainer.appendChild(card);
    });
  }

  mainBtnOpenPicker?.addEventListener("click", () => {
    if (mainModalPicker) mainModalPicker.style.display = "flex";
    mainLoadBroadcasts();
  });
  mainBtnClosePicker?.addEventListener("click", () => {
    if (mainModalPicker) mainModalPicker.style.display = "none";
  });
  mainModalPicker?.addEventListener("click", (e) => {
    if (e.target === mainModalPicker) mainModalPicker.style.display = "none";
  });
  document.getElementById("main-filter-all-broadcasts")?.addEventListener("click", (e) => {
    mainActiveFilter = "all";
    mainRenderBroadcasts();
  });
  document.getElementById("main-filter-upcoming-broadcasts")?.addEventListener("click", (e) => {
    mainActiveFilter = "upcoming";
    mainRenderBroadcasts();
  });
  document.getElementById("main-btn-refresh-broadcasts")?.addEventListener("click", () => {
    mainLoadBroadcasts();
  });

  if (youtubeUserInput) {
    youtubeUserInput.addEventListener("change", () => {
      const newId = youtubeUserInput.value.trim();
      const currentSaved = localStorage.getItem("savedYoutubeId");
      if (newId && window.isYoutubeIntendedConnect && newId !== currentSaved) {
        console.log(`[YouTube] Video IDが変更されたため (${currentSaved} -> ${newId})、再接続します`);
        window.connectYoutubeLive(newId);
      }
    });
  }

  if (youtubeConnectBtn) {
  function stopYoutubeConnection() {
    window.isYoutubeIntendedConnect = false;
    clearTimeout(youtubeReconnectTimer);
    if (youtubeWs) {
      try {
        if (youtubeWs.readyState === WebSocket.OPEN) {
          youtubeWs.send(JSON.stringify({ type: "disconnect_youtube" }));
        }
        youtubeWs.close();
      } catch (e) {}
      youtubeWs = null;
    }
    if (youtubeConnectBtn) {
      youtubeConnectBtn.textContent = "接続";
      youtubeConnectBtn.style.background = "#ff0000";
    }
    if (youtubeStatus) youtubeStatus.textContent = "未接続";
    const scheduleContainer = document.getElementById("youtube-schedule-container");
    if (scheduleContainer) scheduleContainer.style.display = "none";
    if (window.youtubeScheduleTimer) clearInterval(window.youtubeScheduleTimer);
  }

  async function startYoutubeConnection(videoId) {
    if (!videoId) return;
    window.isYoutubeIntendedConnect = true;
    if (youtubeStatus) youtubeStatus.textContent = "接続中...";

    // サーバーが未起動の場合は自動起動
    try {
      fetch("/_api/servers/youtube_comment_server/start", { method: "POST" }).catch(() => {});
    } catch (e) {}

    if (youtubeWs) {
      try { youtubeWs.close(); } catch (e) {}
      youtubeWs = null;
    }

    // YouTube接続時、ラジオの開始行を1にリセットする
    const startLineInput = document.getElementById("radio-script-start-line");
    if (startLineInput) {
      startLineInput.value = 1;
    }
    localStorage.setItem("radioScriptLastIndex", 0);

    youtubeWs = new WebSocket("ws://localhost:8768");

    youtubeWs.onopen = () => {
      youtubeWs.send(
        JSON.stringify({ type: "connect_youtube", video_id: videoId }),
      );
      youtubeWs.send(
        JSON.stringify({ type: "check_stream_status", videoId: videoId }),
      );
      if (youtubeConnectBtn) {
        youtubeConnectBtn.textContent = "切断";
        youtubeConnectBtn.style.background = "var(--danger, #ff4444)";
      }
      if (typeof resetIdleTimer === "function") resetIdleTimer();
    };

    let isYoutubeConnectedLogged = false;
      youtubeWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status") {
            youtubeStatus.textContent = data.message;
            if (data.status === "connected" && !isYoutubeConnectedLogged) {
              isYoutubeConnectedLogged = true;
              console.log("[YouTube] コメント読み上げの準備が完了しました！");
            }
            if (data.status === "error" || data.status === "disconnected") {
              isYoutubeConnectedLogged = false;
              if (youtubeWs) {
                youtubeWs.close();
                youtubeWs = null;
              }
              youtubeConnectBtn.textContent = "接続";
              youtubeConnectBtn.style.background = "#ff0000";
              const scheduleContainer = document.getElementById(
                "youtube-schedule-container",
              );
              if (scheduleContainer) scheduleContainer.style.display = "none";
              if (window.youtubeScheduleTimer)
                clearInterval(window.youtubeScheduleTimer);
            }
          } else if (data.type === "stream_started") {
            youtubeStatus.textContent = data.message;
            youtubeStatus.style.color = "#0f0";
            setTimeout(() => {
              youtubeStatus.style.color = "";
            }, 3000);
            const scheduleContainer = document.getElementById(
              "youtube-schedule-container",
            );
            if (scheduleContainer) scheduleContainer.style.display = "none";
          } else if (data.type === "stream_info") {
            if (
              data.liveBroadcastContent === "upcoming" &&
              data.scheduledStartTime
            ) {
              const scheduleContainer = document.getElementById(
                "youtube-schedule-container",
              );
              const timeEl = document.getElementById("youtube-schedule-time");
              const countdownEl = document.getElementById(
                "youtube-schedule-countdown",
              );
              const autoStartCb = document.getElementById(
                "youtube-auto-start-cb",
              );

              if (scheduleContainer) scheduleContainer.style.display = "block";

              const targetTime = new Date(data.scheduledStartTime);
              if (timeEl) {
                timeEl.textContent = `予定時刻: ${targetTime.toLocaleString()}`;
              }

              if (window.youtubeScheduleTimer)
                clearInterval(window.youtubeScheduleTimer);
              window.youtubeScheduleTimer = setInterval(() => {
                const now = new Date();
                const diff = targetTime.getTime() - now.getTime();

                if (diff <= 0) {
                  clearInterval(window.youtubeScheduleTimer);
                  if (countdownEl) countdownEl.textContent = "00:00:00";

                  // DOM要素を最新状態で取得し直す
                  const currentAutoStartCb = document.getElementById(
                    "youtube-auto-start-cb",
                  );

                  let shouldStart = false;
                  if (currentAutoStartCb && currentAutoStartCb.checked) {
                    shouldStart = true;
                  } else {
                    // ブラウザのキャッシュでチェックが外れていた場合のフォールバック
                    shouldStart = confirm(
                      "予定時刻を過ぎていますが、自動開始のチェックが外れています。\n今すぐOBSのストリーミングとラジオの自動再生を開始しますか？",
                    );
                  }

                  if (shouldStart && youtubeWs && youtubeWs.readyState === 1) {
                    console.log(
                      "[YouTube] 予約時間になりました。配信開始プロセスをトリガーします。",
                    );

                    // 配信準備中などのオーバーレイを自動で解除する
                    if (
                      typeof window.executeOverlayClearProcess === "function"
                    ) {
                      window.executeOverlayClearProcess();
                    } else {
                      // フォールバック
                      const streamOverlayEl =
                        document.getElementById("stream-overlay");
                      if (streamOverlayEl)
                        streamOverlayEl.classList.remove("active");
                      if (typeof isPreparing !== "undefined")
                        isPreparing = false;
                    }

                    // 1. OBSの配信を開始する
                    if (typeof window.ensureObsStreamingStarted === "function") {
                      window.ensureObsStreamingStarted().catch((e) => console.warn(e));
                    } else if (
                      typeof isObsWsConnected !== "undefined" &&
                      isObsWsConnected &&
                      typeof obsWsClient !== "undefined" &&
                      obsWsClient
                    ) {
                      obsWsClient.call("StartStream").catch((err) => {
                        console.warn("[OBS] StartStream warning:", err);
                      });
                    }

                    // 2. 映像がYouTubeに届くまで少し待機してから、YouTubeのステータスをLiveにする
                    setTimeout(() => {
                      console.log(
                        "[YouTube] YouTube側の配信(Live)を開始します...",
                      );
                      try {
                        youtubeWs.send(
                          JSON.stringify({
                            type: "start_youtube_stream",
                            videoId: videoId,
                          }),
                        );
                      } catch (e) {
                        alert(
                          "YouTubeへの開始コマンド送信に失敗しました: " + e,
                        );
                      }

                      // 3. ラジオ台本ボタンを押す
                      setTimeout(() => {
                        // ラジオモードがOFFの場合は強制的にONにする
                        const radioModeToggle = document.getElementById(
                          "ai-radio-mode-toggle",
                        );
                        if (radioModeToggle && !radioModeToggle.checked) {
                          console.log(
                            "[YouTube] ラジオモードを強制的にONにします",
                          );
                          radioModeToggle.checked = true;
                          radioModeToggle.dispatchEvent(new Event("change"));
                        }

                        const playBtn = document.getElementById(
                          "radio-script-play-btn",
                        );
                        if (playBtn) {
                          console.log("[YouTube] ラジオ自動再生を実行");
                          playBtn.click();
                        }
                      }, 2000); // 配信開始から少し遅らせて再生
                    }, 8000); // OBS開始から8秒待機
                  } else {
                    console.log(
                      "【自動開始スキップ】ユーザーがキャンセルしたか、接続が失われています。",
                    );
                  }

                  if (scheduleContainer) {
                    setTimeout(() => {
                      scheduleContainer.style.display = "none";
                    }, 5000);
                  }
                } else {
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const mins = Math.floor(
                    (diff % (1000 * 60 * 60)) / (1000 * 60),
                  );
                  const secs = Math.floor((diff % (1000 * 60)) / 1000);
                  if (countdownEl) {
                    countdownEl.textContent =
                      String(hours).padStart(2, "0") +
                      ":" +
                      String(mins).padStart(2, "0") +
                      ":" +
                      String(secs).padStart(2, "0");
                  }
                }
              }, 1000);
            } else if (data.liveBroadcastContent === "live") {
              if (
                confirm(
                  "この配信はすでにYouTube上で「Live」状態です。\nOBSのストリーミングとラジオの自動再生だけを開始しますか？",
                )
              ) {
                if (typeof window.ensureObsStreamingStarted === "function") {
                  window.ensureObsStreamingStarted().catch((e) => console.warn(e));
                } else if (
                  typeof isObsWsConnected !== "undefined" &&
                  isObsWsConnected &&
                  typeof obsWsClient !== "undefined" &&
                  obsWsClient
                ) {
                  obsWsClient.call("StartStream").catch((err) => {
                    console.warn("[OBS] StartStream warning:", err);
                  });
                }

                setTimeout(() => {
                  const radioModeToggle = document.getElementById(
                    "ai-radio-mode-toggle",
                  );
                  if (radioModeToggle && !radioModeToggle.checked) {
                    radioModeToggle.checked = true;
                    radioModeToggle.dispatchEvent(new Event("change"));
                  }
                  const playBtn = document.getElementById(
                    "radio-script-play-btn",
                  );
                  if (playBtn) {
                    playBtn.click();
                  }
                }, 2000);
              }
            }
          } else if (data.type === "stats") {
            const statViewers = document.getElementById("stat-viewers");
            if (statViewers && data.viewers !== undefined) {
              statViewers.textContent = (data.viewers === "" || data.viewers === null) ? "-" : data.viewers;
            }
            const statSubscribers = document.getElementById("stat-subscribers");
            let subDisplay = "-";
            if (statSubscribers && data.subscribers) {
              const numOnly = String(data.subscribers).match(/[\d,]+/);
              subDisplay = numOnly ? numOnly[0] : data.subscribers;
              statSubscribers.textContent = subDisplay;
            }
            const currentCommentsCount = window.totalCommentsCount || 0;
            const inputVal = document.getElementById("youtube-video-input")?.value || "";
            const currentVid = data.videoId || "-";
            const statsSig = `${inputVal}|${currentVid}|${subDisplay}|${data.viewers}|${currentCommentsCount}`;
            if (window._lastLoggedStatsSig !== statsSig) {
              window._lastLoggedStatsSig = statsSig;
              console.log(
                `[YouTube Live 統計] 📺 接続先: ${inputVal || currentVid} (動画ID: ${currentVid}) | 👤 登録者数: ${subDisplay}人 | 👁️ 視聴者数/再生数: ${data.viewers || '-'} | 💬 コメント総数: ${currentCommentsCount}件`
              );
            }
          } else if (data.type === "gift") {
            console.log(`[YouTube] ${data.nickname} sent a superchat/gift`);
            if (typeof window.spawnReactionEffect === "function") {
              window.spawnReactionEffect("🎁", 3);
            }
            addCommentToViewer(
              data.nickname,
              `🎁 スーパーチャット！`,
              "youtube",
              true,
              data.iconUrl,
            );
            const isRadioModeFlag = document.getElementById(
              "ai-radio-mode-toggle",
            )?.checked;
            const acceptHistory =
              isRadioModeFlag && radioModeState.currentPhase === "none";
            if (
              isVoicevoxEnabled &&
              (!data.isHistory || acceptHistory) &&
              (typeof isStreamEndedState === "undefined" || !isStreamEndedState)
            ) {
              const cleanName = removeEmojis(data.nickname);
              if (cleanName.length > 0) {
                aiEmotion = "joy";
                const zunda =
                  isZundamonSelected() && currentModelId === "hiyori";
                let greet = zunda
                  ? `${cleanName}さん、スーパーチャットありがとうなのだ！`
                  : `${cleanName}さん、スーパーチャットありがとう！`;
                greet = aiFeatures.adjustIdlePhraseForModel(
                  greet,
                  currentModelId,
                );
                queueCommentAudio(greet);
              }
            }
          } else if (data.type === "reaction") {
            if (typeof window.spawnReactionEffect === "function") {
              window.spawnReactionEffect(data.emoji || "❤️", data.count || 1);
            }
          } else if (data.type === "comment") {
            console.log(`[YouTube] @${data.nickname}: ${data.comment}`);
            // 絵文字・リアクション検知
            const reactionMatches = (data.comment || "").match(/[❤️💖💕💓💗💘✨🌟🎉🥳👍😻🐾🔥🥰😍🙌⭐]/g);
            if (reactionMatches && typeof window.spawnReactionEffect === "function") {
              window.spawnReactionEffect(reactionMatches[0], Math.min(reactionMatches.length, 3));
            }
            addCommentToViewer(
              data.nickname,
              data.comment,
              "youtube",
              false,
              data.iconUrl,
            );
            const isRadioModeFlag = document.getElementById(
              "ai-radio-mode-toggle",
            )?.checked;
            const acceptHistory =
              isRadioModeFlag && radioModeState.currentPhase === "none";
            console.log(
              `[DEBUG] Comment Check: isVoicevoxEnabled=${isVoicevoxEnabled}, isHistory=${data.isHistory}, acceptHistory=${acceptHistory}, phase=${radioModeState.currentPhase}`,
            );
            if (
              isVoicevoxEnabled &&
              (!data.isHistory || acceptHistory) &&
              typeof isStreamEndedState !== "undefined" &&
              !isStreamEndedState
            ) {
              const cleanNickname = removeEmojis(data.nickname);
              const cleanComment = removeEmojis(data.comment);
              if (cleanComment.length > 0) {
                aiEmotion = guessEmotionFromText(cleanComment);

                const timeGreeting = getTimeGreeting();
                const zunda =
                  isZundamonSelected() && currentModelId === "hiyori";
                const replies = [
                  {
                    keywords: [
                      "おはよう",
                      "おは",
                      "こんにちは",
                      "こんちわ",
                      "こんばん",
                      "やっほ",
                      "ハロー",
                    ],
                    response: zunda
                      ? `${timeGreeting}ー！来てくれてありがとうなのだ！`
                      : `${timeGreeting}ー！来てくれてありがとう！`,
                  },
                  {
                    keywords: [
                      "かわいい",
                      "可愛い",
                      "カワイイ",
                      "かわちい",
                      "美人",
                      "きれい",
                    ],
                    response: zunda
                      ? "えへへ、褒められちゃったのだ！ありがとうなのだ！"
                      : "えへへ、褒められちゃった！ありがとう！",
                  },
                  {
                    keywords: ["初見", "しょけん"],
                    response: zunda
                      ? "初見さん、初めましてなのだ！ゆっくりしていってほしいのだ！"
                      : "初見さん、初めまして！ゆっくりしていってね！",
                  },
                  {
                    keywords: ["草", "w", "ｗ", "ウケる", "笑", "ワロタ"],
                    response: zunda ? "あはははなのだっ！" : "あはははっ！",
                  },
                  {
                    keywords: [
                      "おつ",
                      "お疲れ",
                      "おつかれ",
                      "バイバイ",
                      "おやすみ",
                      "寝る",
                    ],
                    response: zunda
                      ? "お疲れ様なのだー！またねなのだ！"
                      : "お疲れ様ー！またね！",
                  },
                  {
                    keywords: ["？", "?", "なんで", "どうして"],
                    response: zunda
                      ? "んー、どうだろうねー？私には分かんないのだ！"
                      : "んー、どうだろうねー？私には分かんないや！",
                  },
                ];

                const matchedRule = replies.find((rule) =>
                  rule.keywords.some((kw) => cleanComment.includes(kw)),
                );
                const isQueueFull = voicevoxAudioQueue.length >= 5;

                if (isQueueFull && !matchedRule) {
                  console.log(
                    `[YouTube Skip] 待機列過多のためスキップ: ${cleanComment}`,
                  );
                } else {
                  queueCommentAudio(`${cleanNickname}さん、${cleanComment}`);

                  if (
                    isAiReplyEnabled &&
                    aiApiKeyInput &&
                    aiApiKeyInput.value.trim().length > 0
                  ) {
                    generateAIResponse(cleanNickname, cleanComment);
                  } else {
                    if (matchedRule) {
                      const adjustedReply = aiFeatures.adjustIdlePhraseForModel(
                        matchedRule.response,
                        currentModelId,
                      );
                      queueCommentAudio(adjustedReply);
                    } else if (Math.random() < 0.2) {
                      const genericReplies = [
                        "なるほどなるほどー",
                        "たしかにー！",
                        "へぇー！",
                        "そうんだね！",
                        "わかるわかるー",
                      ];
                      const adjustedReply = aiFeatures.adjustIdlePhraseForModel(
                        genericReplies[
                          Math.floor(Math.random() * genericReplies.length)
                        ],
                        currentModelId,
                      );
                      queueCommentAudio(adjustedReply);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("YouTube WS parse error", e);
        }
      };

      youtubeWs.onclose = () => {
        if (window.isYoutubeIntendedConnect) {
          if (youtubeStatus) youtubeStatus.textContent = "再接続中...";
          if (youtubeConnectBtn) {
            youtubeConnectBtn.textContent = "再接続中";
            youtubeConnectBtn.style.background = "#ff8800";
          }
          clearTimeout(youtubeReconnectTimer);
          youtubeReconnectTimer = setTimeout(() => {
            if (window.isYoutubeIntendedConnect) {
              startYoutubeConnection(videoId);
            }
          }, 3500);
        } else {
          if (youtubeStatus) youtubeStatus.textContent = "未接続";
          if (youtubeConnectBtn) {
            youtubeConnectBtn.textContent = "接続";
            youtubeConnectBtn.style.background = "#ff0000";
          }
        }
      };

      youtubeWs.onerror = (err) => {
        console.error("YouTube WS error", err);
        if (youtubeStatus) youtubeStatus.textContent = "接続エラー (自動再試行中)";
        if (typeof clearIdleTimer === "function") clearIdleTimer();
      };
    }

    // 古いイベントリスナーの重複実行を完全に防止するため、ボタンをクローンして置き換える
    const oldBtn = document.getElementById("youtube-connect-btn");
    if (oldBtn) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(newBtn, oldBtn);
      youtubeConnectBtn = newBtn;

      youtubeConnectBtn.addEventListener("click", (event) => {
        const videoId = youtubeUserInput ? youtubeUserInput.value.trim() : "";
        if (!videoId) {
          if (event && event.isTrusted) {
            alert("YouTubeの動画IDまたはチャンネル名を入力してください");
          }
          return;
        }

        const savedYoutubeId = localStorage.getItem("savedYoutubeId");
        if (savedYoutubeId && savedYoutubeId !== videoId) {
          if (typeof clearAllComments === "function") clearAllComments();
        }
        localStorage.setItem("savedYoutubeId", videoId);

        if (window.isYoutubeIntendedConnect) {
          stopYoutubeConnection();
        } else {
          startYoutubeConnection(videoId);
        }
      });
    }

    window.startYoutubeConnection = startYoutubeConnection;
    window.stopYoutubeConnection = stopYoutubeConnection;
    window.connectYouTubeNow = function(channelOrId) {
      const target = channelOrId || (youtubeUserInput ? youtubeUserInput.value.trim() : "@drone.akahori");
      if (target) {
        if (youtubeUserInput) youtubeUserInput.value = target;
        localStorage.setItem("savedYoutubeId", target);
        startYoutubeConnection(target);
      }
    };

    const savedYoutubeId = localStorage.getItem("savedYoutubeId");
    if (savedYoutubeId && youtubeUserInput) {
      youtubeUserInput.value = savedYoutubeId;
    }
  }

  // --- Google OAuth (YouTube Data API) Logic ---
  const oauthClientIdInput = document.getElementById("youtube-oauth-client-id");
  const oauthApiKeyInput = document.getElementById("youtube-api-key");
  const oauthLoginBtn = document.getElementById("youtube-oauth-login-btn");
  const oauthLogoutBtn = document.getElementById("youtube-oauth-logout-btn");
  const oauthStatus = document.getElementById("youtube-oauth-status");
  let tokenClient = null;
  let oauthAccessToken = null;
  let oauthStatInterval = null;

  if (oauthClientIdInput && oauthLoginBtn) {
    // =========================================================
    // Load saved credentials and access token
    // =========================================================
    const savedClientId = localStorage.getItem("savedYoutubeClientId");
    const savedApiKey = localStorage.getItem("savedYoutubeApiKey");
    if (savedClientId) oauthClientIdInput.value = savedClientId;
    if (savedApiKey) oauthApiKeyInput.value = savedApiKey;

    const savedToken = localStorage.getItem("savedGoogleAccessToken");
    const savedTokenTime = localStorage.getItem("savedGoogleAccessTime");
    if (savedToken && savedTokenTime) {
      const timeElapsed = Date.now() - parseInt(savedTokenTime, 10);
      // トークンの有効期限は通常1時間。余裕を見て55分(3300000ms)以内なら再利用
      if (timeElapsed < 3300000) {
        oauthAccessToken = savedToken;
        oauthStatus.textContent = "認証成功（復元）";
        oauthLoginBtn.style.display = "none";
        oauthLogoutBtn.style.display = "block";

        // Fetch stats immediately and then periodically
        setTimeout(() => {
          fetchYoutubeApiStats();
          if (oauthStatInterval) clearInterval(oauthStatInterval);
          oauthStatInterval = setInterval(fetchYoutubeApiStats, 60000);
        }, 1000); // すぐだとAPIキーの復元と競合する可能性があるので少し待つ
      } else {
        // 期限切れ
        localStorage.removeItem("savedGoogleAccessToken");
        localStorage.removeItem("savedGoogleAccessTime");
      }
    }

    // Dynamically load Google Identity Services
    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      console.log("Google Identity Services loaded.");
    };
    document.head.appendChild(gisScript);

    async function fetchYoutubeApiStats() {
      if (!oauthAccessToken || !oauthApiKeyInput.value.trim()) return;
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true&key=${oauthApiKeyInput.value.trim()}`,
          {
            headers: {
              Authorization: `Bearer ${oauthAccessToken}`,
            },
          },
        );
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const stats = data.items[0].statistics;
          const statSubEl = document.getElementById("stat-subscribers");
          if (statSubEl && stats.subscriberCount) {
            const num = parseInt(stats.subscriberCount, 10);
            if (!isNaN(num)) statSubEl.textContent = num.toLocaleString();
          }
        }
      } catch (e) {
        console.error("YouTube Data API fetch error:", e);
        oauthStatus.textContent = "APIフェッチエラー";
      }
    }

    oauthLoginBtn.addEventListener("click", () => {
      const clientId = oauthClientIdInput.value.trim();
      const apiKey = oauthApiKeyInput.value.trim();
      if (!clientId || !apiKey) {
        alert("クライアントIDとAPIキーを入力してください。");
        return;
      }
      localStorage.setItem("savedYoutubeClientId", clientId);
      localStorage.setItem("savedYoutubeApiKey", apiKey);

      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/youtube.readonly",
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              oauthAccessToken = tokenResponse.access_token;

              // Save to local storage
              localStorage.setItem("savedGoogleAccessToken", oauthAccessToken);
              localStorage.setItem("savedGoogleAccessTime", Date.now());

              oauthStatus.textContent = "認証成功（統計取得中）";
              oauthLoginBtn.style.display = "none";
              oauthLogoutBtn.style.display = "block";

              // Fetch stats immediately and then periodically
              fetchYoutubeApiStats();
              if (oauthStatInterval) clearInterval(oauthStatInterval);
              oauthStatInterval = setInterval(fetchYoutubeApiStats, 60000); // 1 minute interval
            }
          },
        });
      }
      tokenClient.requestAccessToken();
    });

    oauthLogoutBtn.addEventListener("click", () => {
      if (
        oauthAccessToken &&
        typeof google !== "undefined" &&
        google.accounts
      ) {
        try {
          google.accounts.oauth2.revoke(oauthAccessToken, () => {
            console.log("Access token revoked");
          });
        } catch (e) {
          console.error("Token revoke failed", e);
        }
      }
      oauthAccessToken = null;
      localStorage.removeItem("savedGoogleAccessToken");
      localStorage.removeItem("savedGoogleAccessTime");

      if (oauthStatInterval) clearInterval(oauthStatInterval);
      oauthStatus.textContent = "未認証";
      oauthLoginBtn.style.display = "block";
      oauthLogoutBtn.style.display = "none";
    });
  }

  async function fetchWebSearch(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return data.results.map((r) => `・${r.title}: ${r.body}`).join("\n");
        }
      }
    } catch (e) {
      console.error("Search API error:", e);
    }
    return "";
  }

  async function generateAIResponse(nickname, comment, autoContext = "") {
    if (!aiApiKeyInput || !aiProviderSelect || !aiSystemPromptInput) return;
    const apiKey = aiApiKeyInput.value.trim();
    const provider = aiProviderSelect.value;
    const systemPromptRaw = aiSystemPromptInput.value.trim();
    let modelCharacterInstruction = "";
    if (typeof currentModelId !== "undefined") {
      if (currentModelId === "hiyori") {
        modelCharacterInstruction =
          "\n\n【キャラクター設定】あなたは元気で明るい女子高生の「ひより」です。親しみやすく、語尾には「〜だよ！」「〜だね！」などをつけて元気いっぱいに話してください。";
      } else if (currentModelId === "akari") {
        modelCharacterInstruction =
          "\n\n【キャラクター設定】あなたは落ち着いた優しいお姉さんキャラの「あかり」です。丁寧な口調で、少し大人っぽく「〜ね」「〜かしら」などを交えて話してください。";
      } else if (currentModelId === "hijiki") {
        modelCharacterInstruction =
          "\n\n【キャラクター設定】あなたは黒猫の「ひじき」です。人間の言葉を話す猫として振る舞い、語尾に「〜にゃ」「〜にゃん」をつけて可愛く話してください。";
      } else if (currentModelId === "tororo") {
        modelCharacterInstruction =
          "\n\n【キャラクター設定】あなたは白猫の「とろろ」です。人間の言葉を話す猫として振る舞い、語尾に「〜にゃ」「〜にゃん」をつけてマイペースに話してください。";
      } else if (currentModelId === "wanko") {
        modelCharacterInstruction =
          "\n\n【キャラクター設定】あなたは元気な犬の「わんこ」です。人間の言葉を話す犬として振る舞い、語尾に「〜だワン」「〜ワン！」をつけて人懐っこく話してください。";
      }
    }

    const zundamonInstruction =
      isZundamonSelected() && !modelCharacterInstruction
        ? "\n\n【重要】あなたは「ずんだもん」です。語尾には必ず「〜のだ」や「〜なのだ」をつけて話してください。ただし、質問や疑問形の場合は「〜のだ？」や「〜なの？」は使わず、自然な疑問形（例：〜する？、〜かな？）にしてください。"
        : "";

    const activeCharacterInstruction =
      modelCharacterInstruction || zundamonInstruction;

    const emotionInstruction =
      "\n\n【重要】返答の先頭に必ず [joy], [angry], [sad], [neutral] のいずれかの感情タグをつけてください。例: [joy]わーい！" +
      activeCharacterInstruction;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();
    const yomiDays = [
      "にちようび",
      "げつようび",
      "かようび",
      "すいようび",
      "もくようび",
      "きんようび",
      "どようび",
    ];
    const currentDay = yomiDays[now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    let greetingHint = "こんにちわ";
    if (currentHour >= 5 && currentHour < 11) greetingHint = "おはよう";
    else if (currentHour >= 18 || currentHour < 5) greetingHint = "こんばんわ";

    const timeContext = `\n\n【現在日時】きょうは ${currentMonth}月${currentDate}日（${currentDay}）、現在は ${currentHour}時${currentMinute}分 です。日付や時間、曜日を聞かれた場合は「〜がつ〜にち」「〜ようび」「〜じ〜ふん」と自然なひらがなで答えてください。ユーザーへの挨拶が必要な場合は「${greetingHint}」を使用してください。`;

    const roleplayInstruction =
      "\n\n【配信者としての振る舞い（超重要）】あなたはバーチャル空間から配信しているVTuber（配信者）です。「私はAIなので…」といった機械的な発言やAIだと自称することは絶対にやめてください。\n・天気や最新ニュースなどを聞かれた場合は、必ず最新の情報を検索・調査して答えてください。\n・【重要】最新情報を検索しても分からない場合や、全く知識がない場合にのみ、「ずっと部屋でゲームしてるから分からないよ〜！」のように人間の配信者らしいユーモアで切り返してください。最初から検索せずにはぐらかすのは厳禁です。\n・どんな質問に対しても、リスナーと仲良く会話を楽しむ人間（配信者）として振る舞ってください。";
    let systemPrompt =
      systemPromptRaw + emotionInstruction + timeContext + roleplayInstruction;

    // 注意: ひらがな変換は返信文生成の後に別ステップで行うため、
    // ここで「ひらがなのみ」指示を追加すると「コメント→こんと」のような誤変換が起きる。
    // そのため意図的にこのブロックは削除済み。

    // DuckDuckGo検索（Agentic Loop）以外のモードが選ばれている場合は、
    // ユーザーがテキストエリアに残している手動の [search] 指示文を無視・除去する（誤爆を防ぐため）
    if (aiSearchSelect && aiSearchSelect.value !== "ddg") {
      systemPrompt = systemPrompt
        .replace(/【重要】.*\[search\].*現在/g, "")
        .trim();
    }

    const aiModelInput = document.getElementById("ai-model-input");
    const modelName = aiModelInput
      ? aiModelInput.value.trim()
      : provider === "openai"
        ? "gpt-4o-mini"
        : "gemini-1.5-flash";

    if (!apiKey) return;

    // API制限（429エラー）防止：AIが考え中、または前回の送信から5秒以内ならスキップ
    if (isAiGenerating) return;
    const nowMs = Date.now();
    if (!autoContext && nowMs - lastAiRequestTime < 5000) return;
    isAiGenerating = true;
    lastAiRequestTime = nowMs;

    let searchContext = "";

    const finalSearchContext = autoContext || searchContext;

    // 会話履歴にユーザーコメントを追加
    aiChatHistory.push({
      role: "user",
      content: `${nickname} says: ${comment}`,
    });
    if (aiChatHistory.length > 10) aiChatHistory.shift(); // 直近10件のみ保持

    let aiResponseText = "";

    try {
      let currentSystemPrompt = systemPrompt;
      if (finalSearchContext) {
        currentSystemPrompt +=
          "\n【絶対厳守】すでに最新の検索結果を提供しました。これ以上 `[search]` タグを出力してはいけません。必ず提供された検索結果をもとに、知っているふりをして回答を作成してください。";
      }

      if (provider === "openai") {
        const tempHistory = [...aiChatHistory];
        if (finalSearchContext && tempHistory.length > 0) {
          const lastMsg = tempHistory[tempHistory.length - 1];
          tempHistory[tempHistory.length - 1] = {
            role: lastMsg.role,
            content:
              lastMsg.content +
              `\n\n[検索結果の参考情報]:\n${finalSearchContext}\n\n上記の検索結果（最新情報）から具体的な情報を読み取り、必ずその内容をユーザーに教えてあげてください。もし検索結果の中に明確な答えが含まれていない場合は、知ったかぶりや推測をせず、正直に「調べてみたけどよくわからなかった」と答えてください。`,
          };
        }
        const messages = [
          { role: "system", content: currentSystemPrompt },
          ...tempHistory,
        ];
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName || "gpt-4o-mini",
            messages: messages,
            max_tokens: 60,
            temperature: 0.7,
          }),
        });
        const json = await res.json();
        if (json.choices && json.choices.length > 0) {
          aiResponseText = json.choices[0].message.content.trim();
        } else {
          throw new Error(JSON.stringify(json));
        }
      } else if (provider === "gemini") {
        const targetModel = modelName || "gemini-1.5-flash";

        // aiChatHistoryをGemini用のフォーマットに変換
        const geminiContents = aiChatHistory.map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        }));

        if (finalSearchContext && geminiContents.length > 0) {
          const lastMsg = geminiContents[geminiContents.length - 1];
          lastMsg.parts[0].text += `\n\n[検索結果の参考情報]:\n${finalSearchContext}\n\n上記の検索結果（最新情報）から具体的な情報を読み取り、必ずその内容をユーザーに教えてあげてください。もし検索結果の中に明確な答えが含まれていない場合は、知ったかぶりや推測をせず、正直に「調べてみたけどよくわからなかった」と答えてください。`;
        }

        const payload = {
          systemInstruction: { parts: [{ text: currentSystemPrompt }] },
          contents: geminiContents,
        };

        if (aiSearchSelect && aiSearchSelect.value === "google") {
          payload.tools = [{ googleSearch: {} }]; // Google検索を有効化（グラウンディング）
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(payload),
          },
        );

        const json = await res.json();

        if (res.ok) {
          if (json.candidates && json.candidates.length > 0) {
            aiResponseText = json.candidates[0].content.parts[0].text.trim();
          } else {
            throw new Error(
              "No text returned from API: " + JSON.stringify(json),
            );
          }
        } else {
          throw new Error(json.error?.message || JSON.stringify(json));
        }
      }

      if (aiResponseText) {
        // Agentic Auto-Search Loop: もしAIが [search] キーワード と返してきた場合、検索して再帰実行
        const autoSearchMatch = aiResponseText.match(/\[search\]\s*(.+)/i);

        if (
          autoSearchMatch &&
          aiSearchSelect &&
          aiSearchSelect.value === "ddg"
        ) {
          if (!autoContext) {
            let query = autoSearchMatch[1].replace(/\[.*?\]/g, "").trim();
            if (query) {
              console.log("[Agent] AI requested auto-search for:", query);
              aiChatHistory.pop(); // 追加したユーザーメッセージを一旦消す（再帰時にまた追加されるため）
              isAiGenerating = false;
              const newContext = await fetchWebSearch(query);
              // 再帰呼び出しで検索結果付きでリトライ
              return generateAIResponse(nickname, comment, newContext);
            }
          } else {
            // 検索結果を渡してもまだ [search] を返してきた場合（検索結果に答えがなかった）
            console.log("[Agent] AI still doesn't know. Fallback to apology.");
            aiResponseText =
              "[sad]ごめんにゃ、ネットで調べてみたんだけど、よくわからなかったにゃ…！";
          }
        }

        // アシスタントの返答を履歴に追加
        aiChatHistory.push({ role: "assistant", content: aiResponseText });
        // 感情タグの抽出と除去
        let finalSpokenText = aiResponseText;
        const emotionMatch = finalSpokenText.match(/^\[(.*?)\]/);
        if (emotionMatch) {
          finalSpokenText = finalSpokenText.replace(/^\[.*?\]\s*/, "");
        }

        // 読み上げ用のクリーンアップ（絵文字除去など）
        const cleanResponse = finalSpokenText
          .replace(
            /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g,
            "",
          )
          .trim();
        if (cleanResponse.length > 0) {
          queueCommentAudio(cleanResponse);
        }
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      // 失敗時は履歴から直近のユーザーメッセージを削除してリトライ可能にする
      aiChatHistory.pop();
      const aiTestStatus = document.getElementById("ai-test-status");
      if (aiTestStatus) {
        aiTestStatus.textContent = `❌ AIエラー: ${error.message}`;
        aiTestStatus.style.color = "var(--danger, #ff4444)";
      }
    } finally {
      isAiGenerating = false;
    }
  }

  window.addCommentToViewer = addCommentToViewer;
  window.generateAIResponse = generateAIResponse;
  function queueCommentAudio(text) {
    const radioModeToggle = document.getElementById("ai-radio-mode-toggle");
    const isRadioMode = radioModeToggle && radioModeToggle.checked;
    if (isRadioMode && radioModeState.currentPhase !== "waiting_for_comments") {
      radioCommentQueue.push(text);
      console.log(`[ラジオモード] コメントをプールに保存しました: ${text}`);
    } else {
      queueVoicevoxAudio(text).catch((e) => console.warn(e));
    }
  }

  window.queueCommentAudio = queueCommentAudio;
}

window.initChatClient = initChatClient;
(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("chat-client", initChatClient);
if (document.getElementById("youtube-connect-btn") || window.isUiLoaded) {
  initChatClient();
}
