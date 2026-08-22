// ==========================================
// YouTube / TikTok Live Reaction Effects Engine
// ==========================================

(function () {
  let reactionCanvas = null;
  let ctx = null;
  let particles = [];
  let isRunning = false;
  let audioCtx = null;

  const DEFAULT_EMOJIS = [
    "❤️", "💖", "💕", "💓", "💗", "💘", "✨", "🌟", "🎉", "🥳", "👍", "😻", "🐾", "🔥"
  ];

  // リアクションの種類・テーマ定義
  function getReactionTheme(emoji) {
    if (!emoji) emoji = "❤️";

    if (/[❤️💖💕💓💗💘🥰😍]/.test(emoji)) {
      return {
        type: "heart",
        glow: "rgba(255, 105, 180, 0.8)",
        shadowBlur: 16,
        baseFreq: 659.25, // E5
        soundType: "sweet"
      };
    } else if (/[✨🌟⭐💫]/.test(emoji)) {
      return {
        type: "star",
        glow: "rgba(255, 215, 0, 0.9)",
        shadowBlur: 20,
        baseFreq: 880.0, // A5
        soundType: "twinkle"
      };
    } else if (/[🎉🥳🙌🎊]/.test(emoji)) {
      return {
        type: "celebration",
        glow: "rgba(0, 255, 255, 0.85)",
        shadowBlur: 18,
        baseFreq: 523.25, // C5
        soundType: "fanfare"
      };
    } else if (/[👍🔥⚡💪]/.test(emoji)) {
      return {
        type: "energy",
        glow: "rgba(255, 69, 0, 0.85)",
        shadowBlur: 16,
        baseFreq: 440.0, // A4
        soundType: "pop"
      };
    } else if (/[😻🐾🐱🐈]/.test(emoji)) {
      return {
        type: "cat",
        glow: "rgba(238, 130, 238, 0.85)",
        shadowBlur: 16,
        baseFreq: 783.99, // G5
        soundType: "meow"
      };
    } else if (/[🎁💎👑]/.test(emoji)) {
      return {
        type: "gift",
        glow: "rgba(255, 223, 0, 0.95)",
        shadowBlur: 22,
        baseFreq: 1046.5, // C6
        soundType: "luxury"
      };
    }

    return {
      type: "default",
      glow: "rgba(255, 105, 180, 0.7)",
      shadowBlur: 14,
      baseFreq: 587.33,
      soundType: "pop"
    };
  }

  function initReactionCanvas() {
    const container = document.getElementById("avatar-viewport") || document.querySelector(".canvas-container") || document.body;
    if (!container) return;

    reactionCanvas = document.getElementById("reaction-effects-canvas");
    if (!reactionCanvas) {
      reactionCanvas = document.createElement("canvas");
      reactionCanvas.id = "reaction-effects-canvas";
      reactionCanvas.style.position = "absolute";
      reactionCanvas.style.top = "0";
      reactionCanvas.style.left = "0";
      reactionCanvas.style.width = "100%";
      reactionCanvas.style.height = "100%";
      reactionCanvas.style.pointerEvents = "none";
      reactionCanvas.style.zIndex = "999";
    }

    if (!container.contains(reactionCanvas)) {
      container.appendChild(reactionCanvas);
    }

    ctx = reactionCanvas.getContext("2d");
    resizeCanvas();
    window.removeEventListener("resize", resizeCanvas);
    window.addEventListener("resize", resizeCanvas);
  }

  function resizeCanvas() {
    if (!reactionCanvas) return;
    const parent = reactionCanvas.parentElement || document.getElementById("avatar-viewport") || document.body;
    const rect = parent.getBoundingClientRect();
    reactionCanvas.width = Math.max(rect.width || 0, parent.clientWidth || 0, window.innerWidth || 800);
    reactionCanvas.height = Math.max(rect.height || 0, parent.clientHeight || 0, window.innerHeight || 600);
  }

  class ReactionParticle {
    constructor(emoji, x, y) {
      this.emoji = emoji || DEFAULT_EMOJIS[Math.floor(Math.random() * DEFAULT_EMOJIS.length)];
      this.theme = getReactionTheme(this.emoji);
      const parent = reactionCanvas ? reactionCanvas.parentElement : null;
      const w = (reactionCanvas && reactionCanvas.width > 0)
        ? reactionCanvas.width
        : (parent && parent.clientWidth > 0 ? parent.clientWidth : window.innerWidth);
      const h = (reactionCanvas && reactionCanvas.height > 0)
        ? reactionCanvas.height
        : (parent && parent.clientHeight > 0 ? parent.clientHeight : window.innerHeight);

      this.x = x !== undefined ? x : (w * 0.65 + (Math.random() - 0.5) * (w * 0.45));
      this.y = y !== undefined ? y : (h - 100 - Math.random() * 80);

      this.startX = this.x;
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = -(3.8 + Math.random() * 3.2);
      this.swaySpeed = 0.04 + Math.random() * 0.03;
      this.swayAmp = 25 + Math.random() * 20;
      this.age = 0;
      this.maxAge = 110 + Math.random() * 40;
      this.scale = 0.2;
      this.targetScale = 0.9 + Math.random() * 0.6;
      this.opacity = 1.0;
      this.rot = (Math.random() - 0.5) * 0.3;
      this.rotSpeed = (Math.random() - 0.5) * 0.02;
    }

    update() {
      this.age++;
      this.y += this.vy;
      this.x = this.startX + Math.sin(this.age * this.swaySpeed) * this.swayAmp + (this.vx * this.age * 0.5);
      this.rot += this.rotSpeed;

      if (this.scale < this.targetScale) {
        this.scale += 0.08;
      }

      const lifeRatio = this.age / this.maxAge;
      if (lifeRatio > 0.6) {
        this.opacity = Math.max(0, 1 - (lifeRatio - 0.6) / 0.4);
      }
      return this.age < this.maxAge && this.y > -60;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.scale(this.scale, this.scale);

      ctx.font = "42px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 種類ごとの光彩グロー
      ctx.shadowColor = this.theme.glow;
      ctx.shadowBlur = this.theme.shadowBlur;
      ctx.fillText(this.emoji, 0, 0);

      ctx.restore();
    }
  }

  function animationLoop() {
    if (!ctx || !reactionCanvas) return;
    ctx.clearRect(0, 0, reactionCanvas.width, reactionCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.update()) {
        p.draw(ctx);
      } else {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      requestAnimationFrame(animationLoop);
    } else {
      isRunning = false;
    }
  }

  /**
   * リアクション演出を発生させる
   * @param {string} emoji
   * @param {number} count
   */
  window.spawnReactionEffect = function (emoji, count = 1) {
    const toggle = document.getElementById("reaction-effects-toggle");
    if (toggle && !toggle.checked) return;

    initReactionCanvas();
    const spawnCount = Math.min(Math.max(count, 1), 12);
    const chosenEmoji = emoji || DEFAULT_EMOJIS[Math.floor(Math.random() * DEFAULT_EMOJIS.length)];

    console.log(`[Reaction] ✨ エフェクト発生: ${chosenEmoji} x ${spawnCount}`);

    for (let i = 0; i < spawnCount; i++) {
      setTimeout(() => {
        particles.push(new ReactionParticle(chosenEmoji));
        if (!isRunning) {
          isRunning = true;
          requestAnimationFrame(animationLoop);
        }
      }, i * 70);
    }

    // Live2Dの笑顔リアクション
    if (typeof window.aiEmotion !== "undefined") {
      window.aiEmotion = "joy";
    }
  };

  /**
   * テスト用リアクションバースト（各種類を順番にデモ）
   */
  window.testReactionBurst = function () {
    console.log("[Reaction] 🎆 テストリアクションバースト開始");
    const demoEmojis = ["💖", "✨", "🎉", "🔥", "🐾", "👍"];
    demoEmojis.forEach((e, idx) => {
      setTimeout(() => {
        window.spawnReactionEffect(e, 2);
      }, idx * 180);
    });
  };

  (window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("reaction-effects", initReactionCanvas);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReactionCanvas);
  } else {
    initReactionCanvas();
  }
})();
