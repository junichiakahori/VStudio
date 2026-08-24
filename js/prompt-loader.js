/**
 * prompt-loader.js - 外部プロンプトファイル（/prompts/*.txt）の動的ロード＆変数展開モジュール
 */
(function (global) {
  const promptCache = {};

  async function loadPromptTemplate(promptName) {
    if (promptCache[promptName]) {
      return promptCache[promptName];
    }
    try {
      const res = await fetch(`/prompts/${promptName}.txt?t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        promptCache[promptName] = text;
        return text;
      }
    } catch (err) {
      console.warn(`[PromptLoader] Failed to load /prompts/${promptName}.txt`, err);
    }
    return "";
  }

  function formatPrompt(template, vars = {}) {
    let result = template;
    for (const [key, val] of Object.entries(vars)) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      result = result.replace(regex, val !== undefined && val !== null ? val : "");
    }
    return result;
  }

  async function getFormattedPrompt(promptName, vars = {}, fallback = "") {
    const template = await loadPromptTemplate(promptName);
    if (!template) {
      return typeof fallback === "function" ? fallback(vars) : fallback;
    }
    return formatPrompt(template, vars);
  }

  const PromptLoader = {
    loadPromptTemplate,
    formatPrompt,
    getFormattedPrompt,
  };

  global.PromptLoader = PromptLoader;
})(typeof window !== "undefined" ? window : globalThis);
