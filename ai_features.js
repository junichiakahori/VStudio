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

export async function callAI(prompt, apiKey, provider, pureText=false) {
    try {
        if (provider === 'gemini') {
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

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages: msgs,
                    max_tokens: 100,
                    temperature: 0.7
                })
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

    // 1. システム組み込みのよくある読み間違い辞書（AIのミスをカバー）
    const DEFAULT_DICT = {
        "焼肉": "やきにく",
        "明日": "あした",
        "今日": "きょう",
        "昨日": "きのう",
        "明後日": "あさって",
        "一昨日": "おととい",
        "初見": "しょけん",
        "配信": "はいしん",
        "枠": "わく",
        "耐久": "たいきゅう",
        "同接": "どうせつ",
        "高評価": "こうひょうか",
        "登録": "とうろく",
        "概要欄": "がいようらん",
        "何": "なに",
        "私": "わたし",
        "俺": "おれ",
        "僕": "ぼく",
        "君": "きみ"
    };

    for (const [target, replacement] of Object.entries(DEFAULT_DICT)) {
        if (processedText.includes(target)) {
            processedText = processedText.split(target).join(replacement);
        }
    }

    // 2. ユーザーが画面上で登録したカスタム辞書
    const aiHiraganaDict = document.getElementById('ai-hiragana-dict');
    if (!aiHiraganaDict || !aiHiraganaDict.value.trim()) return processedText;
    const lines = aiHiraganaDict.value.split('\n');
    for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const target = parts[0].trim();
            const replacement = parts[1].trim();
            if (target && replacement) {
                processedText = processedText.split(target).join(replacement);
            }
        }
    }
    return processedText;
}

export async function convertToHiraganaWithAI(text, aiHiraganaCache, saveHiraganaDataFn) {
    if (!text) return text;

    // 1. 辞書（組み込み＋ユーザー）の適用
    const dictAppliedText = applyCustomHiraganaDict(text);

    // 2. キャッシュの確認
    if (aiHiraganaCache && aiHiraganaCache[dictAppliedText]) {
        return aiHiraganaCache[dictAppliedText];
    }

    const aiApiKeyInput = document.getElementById('ai-api-key');
    const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : null;
    if (!apiKey) return dictAppliedText;

    const aiProviderSelect = document.getElementById('ai-provider-select');
    const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';
    
    // AIへの強力な指示
    const systemPrompt = "あなたは読み仮名変換アシスタントです。ユーザーが入力したテキストの漢字をひらがなに変換し、全体をひらがなとカタカナのみの文章として出力してください。非常に重要なルールとして、元の文章の単語、助詞（てにをは）、動詞などの文字を【絶対に】省略・変更・削除しないでください（例: 「夢を見たんだ」→「ゆめをみたんだ」）。読点（、）や句点（。）、疑問符（？）、感嘆符（！）などの記号は音声の自然な間やイントネーションのために【必ずそのまま残してください】。また、日付や時間など、意味の区切りが良いところには積極的に読点（、）を補って、音声合成が自然な息継ぎをできるようにしてください。さらに、「焼肉（やきにく）」などの一般的な単語の読み間違い（ハルシネーション）をしないよう、文脈に沿った自然な日本語の読みを心がけてください。その他の余計な文章は一切含めないでください。";

    try {
        if (provider === 'gemini') {
            const aiModelInput = document.getElementById('ai-model-input');
            const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'gemini-1.5-flash';
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: dictAppliedText }] }]
                })
            });
            const json = await res.json();
            if (res.ok && json.candidates && json.candidates.length > 0) {
                const resultText = json.candidates[0].content.parts[0].text.trim().replace(/\s+/g, '');
                if (aiHiraganaCache) aiHiraganaCache[dictAppliedText] = resultText;
                if (saveHiraganaDataFn) saveHiraganaDataFn();
                return resultText;
            }
        } else if (provider === 'openai') {
            const aiModelInput = document.getElementById('ai-model-input');
            const targetModel = (aiModelInput && aiModelInput.value.trim()) || 'gpt-4o-mini';
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: dictAppliedText }
                    ],
                    max_tokens: 60,
                    temperature: 0.0
                })
            });
            const json = await res.json();
            if (res.ok && json.choices && json.choices.length > 0) {
                const resultText = json.choices[0].message.content.trim().replace(/\s+/g, '');
                if (aiHiraganaCache) aiHiraganaCache[dictAppliedText] = resultText;
                if (saveHiraganaDataFn) saveHiraganaDataFn();
                return resultText;
            }
        }
    } catch (e) {
        console.error("AI Hiragana Conversion Error:", e);
    }
    return dictAppliedText;
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
