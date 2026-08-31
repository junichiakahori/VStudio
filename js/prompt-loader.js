/**
 * prompt-loader.js - プロンプト一元管理ファイル（/prompts.json）の動的ロード＆変数展開モジュール
 */
(function (global) {
  let promptsData = null;
  let loadPromise = null;

  async function loadPrompts() {
    if (promptsData) return promptsData;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const res = await fetch(`/prompts.json?t=${Date.now()}`);
        if (res.ok) {
          promptsData = await res.json();
          return promptsData;
        }
      } catch (err) {
        console.warn("[PromptLoader] Failed to load /prompts.json, trying fallback", err);
      }
      return {};
    })();

    return loadPromise;
  }

  async function loadPromptTemplate(promptName) {
    const data = await loadPrompts();
    if (data && data[promptName]) {
      const entry = data[promptName];
      if (typeof entry === "string") return entry;
      if (Array.isArray(entry)) return entry.join("\n");
      if (entry.prompt) {
        if (Array.isArray(entry.prompt)) return entry.prompt.join("\n");
        return entry.prompt;
      }
    }

    // 個別 .txt ファイルへの後方互換フォールバック
    try {
      const res = await fetch(`/prompts/${promptName}.txt?t=${Date.now()}`);
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {}

    return "";
  }

  function formatPrompt(template, vars = {}) {
    if (!template) return "";
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

  async function getPromptConfig(promptName) {
    const data = await loadPrompts();
    return (data && data[promptName]) || null;
  }

  const PromptLoader = {
    loadPrompts,
    loadPromptTemplate,
    formatPrompt,
    getFormattedPrompt,
    getPromptConfig,
  };

  global.PromptLoader = PromptLoader;
})(typeof window !== "undefined" ? window : globalThis);
