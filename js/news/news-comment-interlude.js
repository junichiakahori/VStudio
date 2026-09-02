// =====================================================================
// news-comment-interlude.js: ニュース合間のリスナーコメント紹介・返信
// =====================================================================

(function() {
  async function processNewsInterludeComments() {
    if (typeof window.newsCommentQueue === "undefined" || window.newsCommentQueue.length === 0) return;
    const comment = window.newsCommentQueue.shift();
    if (!comment || !comment.text) return;

    console.log(`[ニュース番組] 💬 待機コメントを紹介します: "${comment.text}" (${comment.author})`);
    
    // 定型またはAIによるキャスター返信
    const intro = `ここで、リスナーの${comment.author || 'リスナー'}さんからコメントをいただいています。「${comment.text}」とのことです。ありがとうございます！`;
    if (typeof window.queueVoicevoxAudio === "function") {
      await window.queueVoicevoxAudio(intro, true);
      if (typeof window.waitForVoicevoxFinish === "function") {
        await window.waitForVoicevoxFinish();
      }
    }
  }

  window.newsCommentInterlude = {
    processNewsInterludeComments
  };
})();
