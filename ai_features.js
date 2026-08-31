// AIおよびテキスト変換関連の機能をまとめたモジュール（HMR対応用）
// HMR TEST COMMENT
export function adjustIdlePhraseForModel(phrase, modelId) {
    if (!phrase) return phrase;

    if (modelId === 'hiyori') {
        return phrase;
    }
    
    if (modelId === 'akari') {
        let newPhrase = phrase;
        newPhrase = newPhrase.replace(/あたし/g, 'わたし');
        newPhrase = newPhrase.replace(/だよ/g, 'ね');
        newPhrase = newPhrase.replace(/だよね/g, 'でしょ');
        newPhrase = newPhrase.replace(/だぞ/g, 'ですよ');
        newPhrase = newPhrase.replace(/だよー/g, 'ですよ〜');
        newPhrase = newPhrase.replace(/かね/g, 'かしら');
        newPhrase = newPhrase.replace(/かな？/g, 'かしら？');
        newPhrase = newPhrase.replace(/ない？/g, 'ないかしら？');
        newPhrase = newPhrase.replace(/の？/g, 'のね？');
        newPhrase = newPhrase.replace(/じゃん/g, 'ですわ');
        return newPhrase;
    }
    
    if (modelId === 'hijiki' || modelId === 'tororo') {
        let newPhrase = phrase;
        newPhrase = newPhrase.replace(/わたし/g, 'ぼく');
        newPhrase = newPhrase.replace(/あたし/g, 'ぼく');
        newPhrase = newPhrase.replace(/ねえねえ/g, 'にゃーにゃー');
        newPhrase = newPhrase.replace(/ねえ/g, 'にゃー');
        newPhrase = newPhrase.replace(/だよ/g, 'にゃ');
        newPhrase = newPhrase.replace(/だよね/g, 'にゃね');
        newPhrase = newPhrase.replace(/だぞ/g, 'にゃぞ');
        newPhrase = newPhrase.replace(/だよー/g, 'にゃー');
        
        // 文末や句読点の手前の「ね」「な」のみ置換
        newPhrase = newPhrase.replace(/ねー(?=[。！!？\?、,…\s]|$)/g, 'にゃー');
        newPhrase = newPhrase.replace(/ね(?=[。！!？\?、,…\s]|$)/g, 'にゃ');
        newPhrase = newPhrase.replace(/なー(?=[。！!？\?、,…\s]|$)/g, 'にゃー');
        newPhrase = newPhrase.replace(/なぁ(?=[。！!？\?、,…\s]|$)/g, 'にゃぁ');
        newPhrase = newPhrase.replace(/な(?=[。！!？\?、,…\s]|$)/g, 'にゃ');
        
        newPhrase = newPhrase.replace(/(にゃー?)?([。！!？\?]|ー+)?$/, (match, nya, punc) => {
            if (nya) return match; // すでに「にゃ」がある場合は追加しない
            if (!punc) return 'にゃ';
            if (punc.includes('！') || punc.includes('!')) return 'にゃ！';
            if (punc.includes('？') || punc.includes('?')) return 'にゃ？';
            return 'にゃ' + punc;
        });
        return newPhrase;
    }
    
    if (modelId === 'wanko') {
        let newPhrase = phrase;
        newPhrase = newPhrase.replace(/わたし/g, 'ぼく');
        newPhrase = newPhrase.replace(/あたし/g, 'ぼく');
        newPhrase = newPhrase.replace(/ねえねえ/g, 'わんわん');
        newPhrase = newPhrase.replace(/ねえ/g, 'ワン');
        newPhrase = newPhrase.replace(/だよ/g, 'だワン');
        newPhrase = newPhrase.replace(/だよね/g, 'ワンね');
        newPhrase = newPhrase.replace(/だぞ/g, 'ワンぞ');
        newPhrase = newPhrase.replace(/だよー/g, 'ワンー');
        
        // 文末や句読点の手前の「ね」「な」のみ置換
        newPhrase = newPhrase.replace(/ねー(?=[。！!？\?、,…\s]|$)/g, 'ワンー');
        newPhrase = newPhrase.replace(/ね(?=[。！!？\?、,…\s]|$)/g, 'ワン');
        newPhrase = newPhrase.replace(/なー(?=[。！!？\?、,…\s]|$)/g, 'ワンー');
        newPhrase = newPhrase.replace(/なぁ(?=[。！!？\?、,…\s]|$)/g, 'ワンー');
        newPhrase = newPhrase.replace(/な(?=[。！!？\?、,…\s]|$)/g, 'ワン');
        
        newPhrase = newPhrase.replace(/(ワンー?)?([。！!？\?]|ー+)?$/, (match, wan, punc) => {
            if (wan) return match; // すでに「ワン」がある場合は追加しない
            if (!punc) return 'ワン';
            if (punc.includes('！') || punc.includes('!')) return 'ワン！';
            if (punc.includes('？') || punc.includes('?')) return 'ワン？';
            return 'ワン' + punc;
        });
        return newPhrase;
    }
    
    return phrase;
}

export async function callAI(prompt, apiKey, provider, pureText=false, maxTokens=null) {
    try {
        if (provider === 'ollama') {
            const aiModelInput = document.getElementById('ai-model-input');
            const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'qwen2.5:7b';
            const sysInst = pureText ? "あなたは配信者です。出力はあなたの発言内容のみ（余計な説明や括弧書き、絵文字は不要）としてください。\n\n" : "";
            const res = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: targetModel,
                    prompt: sysInst + prompt,
                    stream: false
                })
            });
            const json = await res.json();
            if (res.ok && json.response) {
                const rawText = json.response.trim();
                const hasMultipleLines = rawText.includes('\n');
                return hasMultipleLines ? rawText : rawText.replace(/[\r\n]+/g, ' ');
            }
        } else if (provider === 'gemini') {
            const aiModelInput = document.getElementById('ai-model-input');
            const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'gemini-1.5-flash';
            const sysInst = pureText ? "あなたは配信者です。出力はあなたの発言内容のみ（余計な説明や括弧書き、絵文字は不要）としてください。" : "";
            
            const body = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            };
            if (sysInst) {
                body.systemInstruction = { parts: [{ text: sysInst }] };
            }

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (res.ok && json.candidates && json.candidates.length > 0) {
                const rawText = json.candidates[0].content.parts[0].text.trim();
                // pureText=trueでも台本生成などで改行が必要な場合を考慮
                // 複数行が含まれている場合は改行を維持し、単一行の場合のみ改行→スペース変換する
                const hasMultipleLines = rawText.includes('\n');
                return hasMultipleLines ? rawText : rawText.replace(/[\r\n]+/g, ' ');
            }
        } else if (provider === 'openai') {
            const aiModelInput = document.getElementById('ai-model-input');
            const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'gpt-4o-mini';
            const sysInst = pureText ? "あなたは配信者です。出力はあなたの発言内容のみ（余計な説明や括弧書き、絵文字は不要）としてください。" : "";
            const msgs = [];
            if (sysInst) msgs.push({ role: 'system', content: sysInst });
            msgs.push({ role: 'user', content: prompt });

            const requestBody = {
                model: targetModel,
                messages: msgs,
                temperature: 0.7
            };
            if (maxTokens) {
                requestBody.max_tokens = maxTokens;
            }

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
            const json = await res.json();
            if (res.ok && json.choices && json.choices.length > 0) {
                const rawText = json.choices[0].message.content.trim();
                const hasMultipleLines = rawText.includes('\n');
                return hasMultipleLines ? rawText : rawText.replace(/[\r\n]+/g, ' ');
            }
        }
    } catch (e) {
        console.error("AI Generation Error:", e);
    }
    return null;
}

export function applyCustomHiraganaDict(text) {
    let processedText = text;

    // ユーザーが画面上で明示的に登録したカスタム辞書（例: VTuber, ぶいちゅーばー 等）のみを素直に適用
    const aiHiraganaDict = document.getElementById('ai-hiragana-dict');
    if (!aiHiraganaDict || !aiHiraganaDict.value.trim()) return processedText;
    const lines = aiHiraganaDict.value.split('\n');
    for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const target = parts[0].trim();
            const replacement = parts[1].trim();
            if (target && replacement) {
                try {
                    const regex = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    processedText = processedText.replace(regex, replacement);
                } catch (e) {
                    processedText = processedText.split(target).join(replacement);
                }
            }
        }
    }
    return processedText;
}

export async function convertToHiraganaWithAI(text) {
    if (!text || !text.trim()) return text;

    // 1. キャッシュが存在する場合は即座に返却（0ms）
    const cacheKey = text.trim();
    if (window.aiHiraganaCache && window.aiHiraganaCache[cacheKey]) {
        return window.aiHiraganaCache[cacheKey];
    }

    // 2. カスタム辞書（手動登録）を適用
    let dictApplied = applyCustomHiraganaDict(text);

    // 3. AI設定の取得
    const aiHiraganaToggle = document.getElementById('ai-hiragana-toggle');
    const isAiHiraganaEnabled = aiHiraganaToggle ? aiHiraganaToggle.checked : true;
    const aiApiKeyInput = document.getElementById('ai-api-key');
    const apiKey = (aiApiKeyInput ? aiApiKeyInput.value.trim() : '') || localStorage.getItem('savedAiApiKey') || '';
    const providerSelect = document.getElementById('ai-provider-select');
    const provider = (providerSelect ? providerSelect.value : '') || localStorage.getItem('savedAiProvider') || 'ollama';

    // AIが利用できない場合は辞書適用結果をそのまま返却
    if (!isAiHiraganaEnabled || (!apiKey && provider !== 'ollama')) {
        return dictApplied;
    }

    try {
        const prompt = `あなたは日本語の音声合成（VOICEVOX）用の文脈校正アシスタントです。
与えられた日本語の文章の中で、「文脈によって読み方が変わる漢字（中央市場、株式市場、私立、1日など）」や「誤読されやすい城名などの固有名詞（丸岡城→丸岡じょう等）」だけを、正しいひらがなでピンポイントに補正してください。
通常の漢字、人名（下地幹郎など）、一般的な熟語（速報、知事選、立候補、表明など）はそのまま漢字で維持してください。

テキスト: ${dictApplied}
校正後:`;

        let result = null;
        if (provider === 'ollama') {
            const aiModelInput = document.getElementById('ai-model-input');
            const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'qwen2.5:7b';
            const systemPrompt = `You are a professional Japanese phonetic proofreader for speech synthesis (TTS).
Your task is to fix mispronounced Japanese words, rare names/usernames, and ambiguous context-dependent kanji so VOICEVOX pronounces them naturally:
1. Replace rare or unusual names, usernames, and handles before honorifics (e.g. 魂児さん/魂児くん → こんじさん/こんじくん) with their natural phonetic reading in Hiragana.
2. Replace context-dependent kanji with phonetic hiragana (e.g. 丸岡城 → 丸岡じょう, 中央市場 → 中央いちば, 私立 → しりつ, 1日 → ついたち/いちにち).
3. Keep common standard dictionary Kanji and well-known proper nouns intact (e.g. 速報, 下地幹郎, 沖縄知事選).
4. Do NOT translate, summarize, or comment. Output the corrected Japanese text only.`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: targetModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: dictApplied }
                    ],
                    stream: false,
                    options: {
                        temperature: 0.0
                    }
                })
            });
            clearTimeout(timeoutId);
            const json = await res.json();
            if (res.ok && json.message && json.message.content) {
                result = json.message.content.trim();
            }
        } else {
            result = await callAI(prompt, apiKey, provider, false, 200);
        }

        if (result && typeof result === 'string') {
            result = result.replace(/^校正後[:：\s]*/i, '').trim();
            result = result.replace(/[\r\n]+/g, ' ').trim();
            console.log(`[AI文脈校正] 🤖 AIの校正結果: "${result}"`);
            if (result && result.length > 0) {
                if (!window.aiHiraganaCache) window.aiHiraganaCache = {};
                window.aiHiraganaCache[cacheKey] = result;
                if (typeof window.saveHiraganaData === 'function') {
                    window.saveHiraganaData();
                }
                return result;
            }
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.warn("[AI文脈校正] エラー:", e);
        }
    }

    return dictApplied;
}

export function restorePunctuation(original, hiragana) {
    if (!original || !hiragana) return hiragana;
    
    const punctRegex = /[、。！？!?,.…『』「」]/;
    // Convert Katakana to Hiragana for better alignment
    const originalKana = original.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
    
    // DP for LCS
    const m = originalKana.length;
    const n = hiragana.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (originalKana[i - 1] === hiragana[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    // Backtrack
    let i = m;
    let j = n;
    let result = [];
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalKana[i - 1] === hiragana[j - 1]) {
            result.unshift(hiragana[j - 1]);
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift(hiragana[j - 1]);
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            const char = original[i - 1]; // Use original character
            if (punctRegex.test(char)) {
                result.unshift(char);
            }
            i--;
        }
    }
    
    // Collapse repeated punctuations (e.g. ！！ -> ！) to prevent doubling if AI kept it and we also inserted it
    let finalResult = result.join('');
    // Replace multiple dots with a single ellipsis to avoid VOICEVOX treating it as a weird pause
    finalResult = finalResult.replace(/\.{2,}/g, '…');
    // Collapse other identical punctuations except when it's intentional
    finalResult = finalResult.replace(/([、。！？!?,『』「」])\1+/g, '$1');
    
    return finalResult;
}
