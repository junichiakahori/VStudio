
def clean_news_description(desc):
    """Google News等のRSS descriptionから各社リンクの羅列や新聞社名を除去"""
    if not desc:
        return ""
    t = desc.strip()
    # HTMLタグの除去
    t = re.sub(r'<[^>]+>', ' ', t)
    # メディア名サフィックスの除去
    t = re.sub(r'[\s\-–—|｜]+(Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|NHK\s*NEWS\s*WEB|ITmedia[A-Za-z0-9\s]*|共同通信|時事通信|読売新聞|朝日新聞|毎日新聞|産経新聞|日経新聞|日本経済新聞|岩手日報|河北新報|秋田魁新報|山形新聞|福島民報|福島民友|茨城新聞|下野新聞|上毛新聞|埼玉新聞|千葉日報|東京新聞|神奈川新聞|新潟日報|北日本新聞|北國新聞|福井新聞|山梨日日新聞|信濃毎日新聞|岐阜新聞|静岡新聞|中日新聞|伊勢新聞|京都新聞|神戸新聞|奈良新聞|紀伊民報|山陽新聞|中國新聞|日本海新聞|山陰中央新報|山口新聞|徳島新聞|四国新聞|愛媛新聞|高知新聞|西日本新聞|佐賀新聞|長崎新聞|熊本日日新聞|大分合同新聞|宮崎日日新聞|南日本新聞|琉球新報|沖縄タイムス|TBS\s*NEWS\s*DIG|FNNプライムオンライン|テレ朝news|日テレNEWS[A-Za-z0-9\s]*)', ' ', t, flags=re.IGNORECASE)
    # 連続空白の整理
    t = re.sub(r'[\s　]+', ' ', t).strip()
    # もし各社見出しの単なる羅列（複数の文が句点なく並んでいる等）なら破棄
    if len(re.findall(r'(新聞|通信|日報|新報|NEWS|テレビ)', t)) >= 2:
        return ""
    return t

def extract_media_source(title):
    """タイトルから一次報道メディア名（出典）を抽出"""
    if not title:
        return ""
    t = str(title).strip()
    m = re.search(r'[（\(]([^）\)]*(?:新聞|通信|日報|新報|NEWS|スポニチ|デイリー|スポーツ|ORICON|文春|新潮|テレビ|WEB|DIG|編集部|Japan|PR\s*TIMES|PRTIMES|タイムス)[^）\)]*)[）\)]', t, flags=re.IGNORECASE)
    if m:
        src = re.sub(r'[\s\-–—]+(?:Yahoo!.*|Google.*)$', '', m.group(1).strip(), flags=re.IGNORECASE).strip()
        if src and not re.match(r'^(?:ニュース|Google|Google\s*ニュース|Yahoo!\s*ニュース)$', src, flags=re.IGNORECASE):
            return src
    # タイトル末尾のメディア名サフィックス（- 読売新聞, - Lmaga.jp, - crypto-times.jp 等）
    m2 = re.search(r'[\s|｜\-–—]+\s*([A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s.・][A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff\s.・\-]*)$', t)
    if m2:
        src = re.sub(r'[\s\-–—]+(?:Yahoo!.*|Google.*)$', '', m2.group(1).strip(), flags=re.IGNORECASE).strip()
        if src and 2 <= len(src) <= 25 and not re.match(r'^(?:ニュース|Google|Google\s*ニュース|Yahoo!\s*ニュース|主要ニュース|トピックス|速報|話題)$', src, flags=re.IGNORECASE):
            return src
    return ""

def clean_news_title(title):
    """ニュースタイトルから余計なアグリゲーターサフィックスを除去"""
    if not title:
        return ""
    t = str(title).strip()
    src = extract_media_source(t)
    if src:
        t = re.sub(rf'[\s|｜\-–—]+\s*{re.escape(src)}$', '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'[\s|｜\-–—]+(?:Google\s*ニュース|Google\s*News|Yahoo!\s*ニュース|Yahoo!\s*JAPAN|Yahoo!|ヤフー).*$', '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'[\s|｜\-–—]+$', '', t).strip()
    t = re.sub(r'^[★【】〈〉\[\]「」『』\s　]+', '', t)
    t = re.sub(r'[★【】〈〉\[\]「」『』\s　]+$', '', t)
    return t.strip()

def split_sentences_safely(text):
    """
    Yahoo! や M!LK 等のブランド名感嘆符での誤分割を防ぎ、
    文中の感嘆符（！）での過剰分割や「。にゃ。」などの不自然な二重句点・語尾孤立を防止する安全な文分割。
    """
    if not text:
        return []
    # 1. ブランド名保護
    t_safe = re.sub(r'Yahoo[!！]', 'Yahoo__EXCL__', text, flags=re.IGNORECASE)
    t_safe = re.sub(r'M[!！]LK', 'M__EXCL__LK', t_safe)
    t_safe = re.sub(r'Y[!！]ニュース', 'Y__EXCL__ニュース', t_safe)
    
    # 2. 不自然な「。にゃ。」「！にゃ！」等の二重句読点を「にゃ。」へ事前正規化
    t_safe = re.sub(r'[。！？]+[\s　]*(にゃ|のだ|なのだ)[。！？]*', r'\1。', t_safe)
    t_safe = re.sub(r'。{2,}', '。', t_safe)
    t_safe = re.sub(r'[！!]{2,}', '！', t_safe)
    t_safe = re.sub(r'[？?]{2,}', '？', t_safe)

    # 3. 文分割:
    # - 句点「。」や改行「\n」で分割（ただし直後に語尾が続く場合は分割しない）
    # - 「！？!?」は直後に改行があるか、空白を挟んで次の文がある場合のみ分割（文中のインライン！は分割しない）
    parts = [
        s.strip() for s in re.split(
            r'(?<=[。\n])(?!(?:にゃ|のだ|なのだ))|(?<=[！？!\?])\s*\n+|(?<=[！？!\?])\s+(?=[一-鿿ぁ-んァ-ヶ])',
            t_safe
        ) if s.strip() and re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ffA-Za-z0-9]', s)
    ]
    
    restored = [
        s.replace('Yahoo__EXCL__', 'Yahoo!').replace('M__EXCL__LK', 'M!LK').replace('Y__EXCL__ニュース', 'Y!ニュース')
        for s in parts
    ]
    return restored
# -*- coding: utf-8 -*-
"""
news_script_processor.py
ニュース原稿のAI生成・プロンプト構築・二重検証（ファクト照合・中国語・名乗り・定型句フィルター）・字幕/音声分離モジュール
"""

import os
import re
import json
import ssl
import time
import urllib.request
import urllib.error
import threading
from server.tts_normalizer import (
    normalize_for_tts, sanitize_speech_text, build_context_pronunciation_map,
    heal_sentence_reading, apply_person_kata_rules
)
from server.news_crawler import find_cached_url, search_news_url_by_title, register_cached_url, fetch_article_body, decode_google_news_url

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def build_news_prompt(char_desc, title, full_article_content):
    """prompts.json の news_script からプロンプトを構築"""
    prompts_file = os.path.join(BASE_DIR, "data", "prompts.json")
    if os.path.exists(prompts_file):
        try:
            with open(prompts_file, 'r', encoding='utf-8') as f:
                p_data = json.load(f)
                news_p = p_data.get("news_script", {}).get("prompt", [])
                if isinstance(news_p, list):
                    template = "\n".join(news_p)
                else:
                    template = str(news_p)
                if template:
                    return template.format(
                        char_desc=char_desc,
                        title=title,
                        full_article_content=full_article_content
                    )
        except Exception as e:
            print(f"[prompts.json 読み込みエラー]: {e}")
    return f"あなたは人気配信者である{char_desc}\n【タイトル】: {title}\n【内容】: {full_article_content}"

def call_gemini_backend(prompt, api_key, model="gemini-1.5-flash"):
    target_model = model or "gemini-1.5-flash"
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        }
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}]
        }
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
            res_json = json.loads(res.read().decode("utf-8"))
            candidates = res_json.get("candidates", [])
            if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                return candidates[0]["content"]["parts"][0]["text"].strip()
    except urllib.error.HTTPError as he:
        err_body = he.read().decode('utf-8') if hasattr(he, 'read') else ''
        print(f"[Gemini Backend] モデル '{target_model}' HTTPエラー {he.code}: {he.reason} - {err_body}", flush=True)
    except Exception as e:
        print(f"[Gemini Backend] モデル '{target_model}' 試行エラー: {e}", flush=True)
    return ""

def call_openai_backend(prompt, api_key, model="gpt-4o-mini"):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    body = {
        "model": model or "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}]
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
        res_json = json.loads(res.read().decode("utf-8"))
        choices = res_json.get("choices", [])
        if choices and "message" in choices[0] and "content" in choices[0]["message"]:
            return choices[0]["message"]["content"].strip()
    return ""

def call_ollama_backend(prompt, model="qwen2.5:7b", base_url="http://127.0.0.1:11434"):
    target_model = model or "qwen2.5:7b"
    url = f"{base_url}/api/generate"
    headers = {
        "Content-Type": "application/json"
    }
    body = {
        "model": target_model,
        "prompt": prompt,
        "system": "You are a professional Japanese VTuber news anchor. Output 100% natural Japanese ONLY. Discuss ONLY the specific news events given in the user prompt. Under no circumstances should you ever output unrelated topics (such as COVID-19 vaccines), Chinese words, or hallucinated facts.",
        "options": {
            "temperature": 0.2,
            "top_p": 0.8,
            "num_ctx": 4096,
            "num_predict": 1000
        },
        "keep_alive": "60m",
        "stream": False
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=60) as res:
            res_json = json.loads(res.read().decode("utf-8"))
            return res_json.get("response", "").strip()
    except Exception as e:
        print(f"[Ollama Backend] モデル '{target_model}' 実行エラー: {e}", flush=True)
    return ""

def call_llm_backend(provider, prompt, api_key="", model_name=""):
    if provider == 'openai':
        return call_openai_backend(prompt, api_key, model=model_name)
    elif provider == 'ollama':
        return call_ollama_backend(prompt, model=model_name)
    else:
        return call_gemini_backend(prompt, api_key, model=model_name)


def is_title_duplicate_sentence(sentence, title):
    """
    文が見出し（タイトル）の単なる復唱・重複であるかを高度に判定する。
    例:
      タイトル: 'みんなで大家さん、事実上の事業終了へ'
      文: 'みんなで大家さん、事実上の事業終了へ。' ➔ True
      文: 'みんなで大家さんが、事実上の事業終了となる見込みです。' ➔ True
      文: 'みんなで大家さんについて、事実上の事業終了へ向かっているそうです。' ➔ True
    """
    if not sentence or not title:
        return False
    
    norm_s = re.sub(r'[★【】〈〉\[\]「」『』\s　\(\)（）\.,、。！？\!\?…・：:;；]', '', sentence)
    norm_t = re.sub(r'[★【】〈〉\[\]「」『』\s　\(\)（）\.,、。！？\!\?…・：:;；]', '', title)
    
    if not norm_s or not norm_t:
        return False

    # 1. 完全一致または前方一致
    if norm_s == norm_t or norm_s.startswith(norm_t) or norm_t.startswith(norm_s):
        if len(norm_s) <= len(norm_t) + 18:
            return True

    # 2. タイトルの主要キーワード（2文字以上の名詞・英数字・漢字カタカナ）の一致率チェック
    title_tokens = set(re.findall(r'[一-鿿゠-ヿA-Za-z0-9]{2,}', norm_t))
    if title_tokens:
        matched_tokens = sum(1 for tok in title_tokens if tok in norm_s)
        match_ratio = matched_tokens / len(title_tokens)
        if match_ratio >= 0.70 and len(norm_s) <= len(norm_t) * 1.4 + 12:
            return True

    # 3. 2文字バイグラム類似度
    s_bigrams = set(norm_s[i:i+2] for i in range(len(norm_s)-1))
    t_bigrams = set(norm_t[i:i+2] for i in range(len(norm_t)-1))
    if s_bigrams and t_bigrams:
        intersection = len(s_bigrams & t_bigrams)
        similarity = (2.0 * intersection) / (len(s_bigrams) + len(t_bigrams))
        if similarity >= 0.60 and len(norm_s) <= len(norm_t) * 1.4 + 12:
            return True

    # 4. タイトルの後方に「〜についての話題をお伝え」「〜についてのニュース」等のメタ文言が付いている場合
    if re.search(r'についての(?:話題|ニュース|出来事|お話)|についてお伝え|に関するニュース', norm_s):
        if any(tok in norm_s for tok in title_tokens):
            return True

    return False

def normalize_celebrity_honorifics(text, title, article_content=""):
    """
    著名人・皇族の敬称整合性チェック（安全なホワイトリスト＆完全一致限定）。
    ※【重要・根本原則】
      文脈を読めない正規表現による曖昧な人名推測（「モデルの〇〇」➔「価格さん」等の誤爆）は完全禁止。
      人物への敬称付与は文脈を理解できるLLM（プロンプト指示）に一任し、
      後処理は「タイトルに明確に敬称付きで明記されている実在人物の呼び捨て補正」と「皇族尊称保護」のみに厳格限定する。
    """
    if not text:
        return text

    result = text

    # 1. タイトル内に明確に「〜さん」「〜氏」「〜選手」「〜監督」と敬称付きで明記されている実在人物のみを抽出
    # ※曖昧な推測（カギ括弧手前、読点手前、職業＋名詞、名字2文字展開等）は一切行わない！
    if title:
        named_matches = re.findall(r'([一-鿿]{2,6}|[ァ-ヶー]{2,10})(?:さん|氏|選手|監督)', title)
        EXCLUDE_WORDS = {
            '台風', '地震', '政府', '警察', '東京', '日本', '中国', '米国', '英国', '韓国', '北朝鮮',
            '大雨', '復旧', '火災', '速報', '発表', '公式', '最新', '決算', '収支', '赤字', '黒字',
            '株価', '新製品', '発売', '開始', '中止', '延期', '調査', '会議', '検討', '決定',
            '会社', '企業', '病院', '学校', '大学', '銀行', '市場', '裁判', '判決', '価格', '機能',
            '創出', '開発', '利用', '販売', '提供', '終了', '変更', '増加', '減少', '参加', '開催',
            '労働', '雇用', 'モデル', '事業', '設立', '分野', '形態', '新規', '若者', '男子', '男士'
        }
        targets = [n for n in dict.fromkeys(named_matches) if n not in EXCLUDE_WORDS and len(n) >= 2]
        targets.sort(key=lambda x: len(x), reverse=True)

        HONORIFICS = r'(?:さん|氏|様|くん|君|ちゃん|選手|監督|大統領|首相|知事|容疑者|被告|先生|教授|アナウンサー|キャスター|医師|氏名|ファン|本人|夫妻|一家|側|ら|等|たち|達)'
        for name in targets:
            # タイトルに敬称付きで登場した人物名が、本文中で敬称なし呼び捨て（例: 「福山雅治が」）になっている場合のみ補正
            pat = re.compile(rf'({re.escape(name)})(?!{HONORIFICS})([のはがにもへと])')
            result = pat.sub(r'\1さん\2', result)

    # 2. ── 皇族名の「さん」→「さま」強制変換（炎上防止・最重要） ──
    # 固定の完全一致ホワイトリストのみを対象とし、一般名詞に誤爆することは絶対にない
    IMPERIAL_NAMES = [
        '悠仁', '佳子', '愛子', '眞子', '彬子', '承子',    # 現役皇族（お名前）
        '紀子', '雅子', '文仁', '徳仁',                    # 宮家・天皇皇后
        '秋篠宮', '常陸宮', '三笠宮', '高円宮',            # 宮号
        '天皇', '皇后', '上皇', '上皇后', '皇太子', '皇太后',  # 称号
    ]
    for imperial in IMPERIAL_NAMES:
        result = re.sub(
            rf'({re.escape(imperial)})さん(?!ま|様|殿|親王|内親王)',
            r'\1さま',
            result
        )

    return result


def _salvage_tone_sentence(sent, is_tororo, is_zunda):
    """1文に対するキャラクター口調（語尾）の救済補正（ネスト深さ最大2階層）"""
    l = sent.strip()
    if is_tororo:
        replacements = [
            (r'(?:と思います|思われます)[。！!？?\s]*$', 'と思うにゃ！'),
            (r'(?:感じます|感じられます)[。！!？?\s]*$', '感じるにゃ！'),
            (r'(?:期待されます|期待したいです|期待がかかります)[。！!？?\s]*$', '期待されるにゃ！'),
            (r'楽しみですね[。！!？?\s]*$', '楽しみにゃ！'),
            (r'(?:目が)?離せません(?:ね)?[。！!？?\s]*$', '目が離せないにゃ！'),
            (r'([ぁ-んァ-ヶー一-鿿]+)たいですね[。！!？?\s]*$', r'\1たいにゃ！'),
            (r'(?:でしょう|でしょうか)[。！!？?\s]*$', 'だろうにゃ。'),
            (r'ですね[。！!？?\s]*$', 'だにゃ。'),
            (r'ありません[。！!？?\s]*$', 'ないにゃ。'),
            (r'ました[。！!？?\s]*$', 'たにゃ。'),
            (r'です[。！!？?\s]*$', 'なんだにゃ。'),
            (r'だ[。！!？?\s]*$', 'んだにゃ。'),
        ]
        for pat, rep in replacements:
            if re.search(pat, l):
                return re.sub(pat, rep, l)
        if not re.search(r'にゃ[！!。、\s]*$', l):
            return re.sub(r'[。！!？?\s]*$', 'にゃ！', l)
        return l

    if is_zunda:
        replacements = [
            (r'(?:と思います|思われます)[。！!？?\s]*$', 'と思うのだ！'),
            (r'(?:感じます|感じられます)[。！!？?\s]*$', '感じるのだ！'),
            (r'(?:期待されます|期待したいです|期待がかかります)[。！!？?\s]*$', '期待されるのだ！'),
            (r'楽しみですね[。！!？?\s]*$', '楽しみなのだ！'),
            (r'(?:目が)?離せません(?:ね)?[。！!？?\s]*$', '目が離せないのだ！'),
            (r'([ぁ-んァ-ヶー一-鿿]+)たいですね[。！!？?\s]*$', r'\1たいのだ！'),
            (r'(?:でしょう|でしょうか)[。！!？?\s]*$', 'だろうのだ。'),
            (r'ですね[。！!？?\s]*$', 'なのだ。'),
            (r'ありません[。！!？?\s]*$', 'ないのだ。'),
            (r'ました[。！!？?\s]*$', 'たのだ。'),
            (r'です[。！!？?\s]*$', 'なのだ。'),
            (r'だ[。！!？?\s]*$', 'なのだ。'),
        ]
        for pat, rep in replacements:
            if re.search(pat, l):
                return re.sub(pat, rep, l)
        if not re.search(r'のだ[！!。、\s]*$', l):
            return re.sub(r'[。！!？?\s]*$', 'なのだ！', l)
        return l

    return sent


def salvage_character_tone(text, char_desc):
    """
    LLMがキャラクター口調を喪失して「〜ですね」「〜と思います」等の標準語・丁寧語で
    出力してしまった場合、文脈を破壊せずに後半（感想部）の語尾を救済・復元する。
    """
    if not text or not char_desc:
        return text

    is_tororo = "にゃ" in char_desc
    is_zunda = "のだ" in char_desc
    if not is_tororo and not is_zunda:
        return text

    target_suffix = "にゃ" if is_tororo else "のだ"
    if target_suffix in text:
        return text

    sentences = split_sentences_safely(text)
    if len(sentences) < 2:
        return text

    salvaged_sentences = []
    split_point = max(1, len(sentences) - 2)

    for i, sent in enumerate(sentences):
        if i < split_point:
            salvaged_sentences.append(sent)
            continue
        salvaged_sentences.append(_salvage_tone_sentence(sent, is_tororo, is_zunda))

    return ' '.join(salvaged_sentences)


def _apply_zunda_ending(s):
    """ずんだもん口調（のだ）の文末変換（最大深さ2階層）"""
    if re.search(r'(?:でした|であった|だった|ました|した|された|決めた|発表した|判明した|合意した)$', s):
        s = re.sub(r'(?:でした|であった|だった)$', 'だった', s)
        s = re.sub(r'ました$', 'た', s)
        return f"{s}のだ。"
    if re.search(r'(?:です|である|だ)$', s):
        s = re.sub(r'(?:です|である|だ)$', '', s)
        return f"{s}なのだ。"
    if re.search(r'(?:している|されている|となっている|見られている|起きている|ある|いる|ない)$', s):
        return f"{s}のだ。"
    return f"{s}なのだ。"


def _apply_tororo_ending(s):
    """とろろ口調（にゃ）の文末変換（最大深さ2階層）"""
    if re.search(r'(?:でした|であった|だった)$', s):
        s = re.sub(r'(?:でした|であった|だった)$', '', s)
        return f"{s}でしたにゃ。"
    if s.endswith("ました"):
        return f"{s}にゃ。"

    # 過去形の丁寧語化テーブル
    past_conversions = [
        ("判明した", "判明しました"),
        ("決定した", "決定しました"),
        ("上がった", "上がりました"),
        ("出た", "出ました"),
        ("された", "されました"),
        ("した", "しました"),
    ]
    if re.search(r'(?:発表した|明らかにした|判明した|決定した|合意した|開催された|実施された|報じた|伝えた|落とした|引き上げた|向かった|示した|求めた|受けた|選ばれた|当選した|左右した|上がった|出た|した|された)$', s):
        for old_tail, new_tail in past_conversions:
            if s.endswith(old_tail):
                s = s[:-len(old_tail)] + new_tail
                break
        return f"{s}にゃ。"

    if re.search(r'(?:している|されている|となっている|見られている|起きている|進めている|目指している|求めている)$', s):
        s = re.sub(r'ている$', 'ています', s)
        return f"{s}にゃ。"
    if s.endswith("ある"):
        s = re.sub(r'ある$', 'あります', s)
        return f"{s}にゃ。"
    if s.endswith("ない"):
        s = re.sub(r'ない$', 'ありません', s)
        return f"{s}にゃ。"
    if re.search(r'(?:です|ます)$', s):
        return f"{s}にゃ。"
    if re.search(r'(?:だ|である)$', s):
        s = re.sub(r'(?:だ|である)$', '', s)
        return f"{s}ですにゃ。"
    return f"{s}ですにゃ。"


def _apply_default_ending(s):
    """標準口調（です・ます）の文末変換（最大深さ2階層）"""
    if re.search(r'(?:した|された)$', s):
        s = re.sub(r'された$', 'されました', s)
        s = re.sub(r'した$', 'しました', s)
        return f"{s}。"
    if s.endswith("ている"):
        s = re.sub(r'ている$', 'ています', s)
        return f"{s}。"
    if re.search(r'(?:だ|である)$', s):
        s = re.sub(r'(?:だ|である)$', 'です', s)
        return f"{s}。"
    if not re.search(r'[。！？!?]$', s):
        return f"{s}です。"
    return f"{s}。"


def apply_character_speech_ending(body_sentence, char_desc):
    """
    ニュース本文の文末を、余計な伝聞（〜とのこと、〜と報じられている等）を一切挟まず、
    直接的で自然なキャラクター口調（丁寧＋語尾）に整形する（最大深さ2階層）。
    """
    suffix = "にゃ" if "にゃ" in char_desc else ("のだ" if "のだ" in char_desc else "です")
    is_zunda = ("のだ" in suffix)
    is_tororo = ("にゃ" in suffix)

    # 末尾の句読点・記号・空白を除去
    s = body_sentence.rstrip("。！？!? \t　")

    # 既に文末にキャラ語尾（にゃ、のだ等）が付いている場合は句点を補完してそのまま返す
    if is_tororo and re.search(r'(?:にゃ|にゃん)[！!。]?$', s):
        return s.rstrip("！!。") + "にゃ。"
    if is_zunda and re.search(r'(?:のだ|なのだ)[！!。]?$', s):
        return s.rstrip("！!。") + "のだ。"

    if is_zunda:
        return _apply_zunda_ending(s)
    if is_tororo:
        return _apply_tororo_ending(s)
    return _apply_default_ending(s)


def build_safe_fallback_sentences(title, article_content, char_desc, custom_dict=None):
    """
    LLMがトピック乖離・ハルシネーション（ワクチン等）を起こした際に、
    元記事のタイトルと本文から安全・確実な原稿（要約＋キャラクター感想）を自動構築する。
    ※【重要・厳守】
      - 1行目にタイトルをオウム返しする説明文（〜についての話題等）を絶対に含めない。
      - いちいち「〜とのこと」「〜と報じられている」等の伝聞文末表現を挟まない。
    """
    suffix = "にゃ" if "にゃ" in char_desc else ("のだ" if "のだ" in char_desc else "です")
    sentences = []

    # タイトルから主要キーワードおよび2文字バイグラムを抽出
    title_keywords = set(re.findall(r'[\u4e00-\u9fff]{2,}|[\u30a0-\u30ff]{2,}', title))
    title_keywords = {kw for kw in title_keywords if kw not in {"ニュース", "発表", "速報", "報道", "日本", "話題", "情報"}}

    norm_t = re.sub(r'[\s　、。！？!?,.\-ー…「」『』【】（）()★〈〉\[\]]+', '', title)
    t_bigrams = set(norm_t[i:i+2] for i in range(len(norm_t)-1))
    t_bigrams = {bg for bg in t_bigrams if re.search(r'[\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9]', bg)}

    # 本文から安全な文を抽出（1行目から具体的な事実から始める）
    if article_content and len(article_content.strip()) > 30:
        clean_content = article_content
        # 内部プロンプトラベルや構成見出しを完全除去
        clean_content = re.sub(r'【[^】]+】\s*[:：]?', '', clean_content)
        clean_content = re.sub(r'(?:元記事の詳細本文|記事本文|元記事本文|詳細本文|ニュース内容)\s*[:：]?', '', clean_content)
        raw_splits = split_sentences_safely(clean_content)
        for s in raw_splits:
            s_clean = s.strip().replace("「", "").replace("」", "")
            # 行頭の通信社名・クレジットプレフィックスを完全除去（例: （ブルームバーグ）：、(時事通信) 等）
            s_clean = re.sub(r'^[（(【\[［][^）)】\]］]+[）)】\]］]\s*[:：\-ー―〜～]?\s*', '', s_clean).strip()
            # 行頭に残存する可能性のあるプロンプトラベルやタグの完全除去
            s_clean = re.sub(r'^[【\[「(（]?(?:元記事の詳細本文|記事本文|詳細本文|元記事|本文|要約|見出し)[】\]」)）:：\s　]*', '', s_clean).strip()
            NG_FALLBACK_WORDS = [
                "不適切", "報告", "みんなの意見", "アンケート", "意識調査", "世論調査",
                "ランキング", "アクセス", "コメント", "記事全文", "続きを読む", "もっと見る",
                "クリック", "写真", "提供", "動画", "シェア", "フォロー", "ワクチン", "コロナ",
                "おすすめ", "注目", "解説", "特集", "舞台裏", "美術館", "閉じる",
                "アフィリエイト", "ライター", "筆者", "執筆", "収益", "クローゼット", "出没", "PR", "プロモーション"
            ]
            # 疑問文・見出し調（？で終わる）やNGワード、長さ不適合は除外
            if s_clean.endswith("？") or s_clean.endswith("?"):
                continue
            if not (15 <= len(s_clean) <= 120):
                continue
            if any(bad in s_clean for bad in NG_FALLBACK_WORDS):
                continue

            # 見出し（タイトル）そのものや、見出しの単なる復唱文は完全に除外
            if is_title_duplicate_sentence(s_clean, title):
                continue

            # タイトル整合性チェック:
            # 1) タイトル主要キーワードが1つでも含まれるか
            # 2) またはタイトルとの2文字バイグラムが2つ以上一致するか
            has_kw = any(kw in s_clean for kw in title_keywords) if title_keywords else False
            norm_s = re.sub(r'[\s　、。！？!?,.\-ー…「」『』【】（）()★〈〉\[\]]+', '', s_clean)
            s_bigrams = set(norm_s[i:i+2] for i in range(len(norm_s)-1))
            has_bigrams = len(t_bigrams & s_bigrams) >= 2 if t_bigrams else False

            if not has_kw and not has_bigrams:
                continue

            # 伝聞表現（とのこと等）を付けず、自然なキャラクター文末に直接変換
            s_final = apply_character_speech_ending(s_clean, char_desc)
            sentences.append(s_final)
            if len(sentences) >= 3:
                break

    # 本文から文が1件も取得できなかった場合のセーフティネット（タイトルから具体的な事実文を補完）
    if not sentences:
        clean_title = re.sub(r'[\s　]+', ' ', title).strip()
        clean_title = re.sub(r'[【\[（(][^】\]）)]*[】\]）)]', '', clean_title).strip()
        clean_title = clean_title.rstrip("。！？!? \t　")
        if clean_title.endswith("か"):
            fact_sent = apply_character_speech_ending(f"{clean_title[:-1]}という情報が入ってきました", char_desc)
        elif clean_title.endswith("へ") or clean_title.endswith("に"):
            fact_sent = apply_character_speech_ending(f"{clean_title}向けた動きが伝えられています", char_desc)
        else:
            fact_sent = apply_character_speech_ending(f"{clean_title}という話題が入ってきました", char_desc)
        sentences.append(fact_sent)

    # 結びの1文（感想・展望）
    sentences.append(f"今後の詳しい情報や進展にもぜひ注目していきたい{suffix}！")

    items = []
    for s in sentences:
        disp = sanitize_speech_text(s)
        items.append({
            "display": disp,
            "speech": normalize_for_tts(disp, custom_dict=custom_dict)
        })
    return items


def is_chinese_sentence(text):
    """中国語（簡体字）混入判定フィルター（日本の漢字に存在しない純粋な簡体字Unicodeのみ）"""
    if not text:
        return False
    t = text.strip()
    # 日本の常用漢字・人名用漢字に存在しない明確な簡体字（这/俩/们/么/谁/说/给/让/还/时/发）
    if re.search(r'[这俩们么谁说给让还时发]', t):
        return True

    hiragana_count = len(re.findall(r'[ぁ-ん]', t))
    total_len = len(t)

    # 中国語句読点（，、“ ”）があり、ひらがなが極少
    if ('，' in t or '“' in t or '”' in t) and (hiragana_count < 2 or (total_len > 10 and (hiragana_count / total_len) < 0.10)):
        return True

    return False
    t = text.strip()
    # 日本語の常用漢字・旧字体・人名用漢字に一切存在しない純粋な中国語簡体字
    STRICT_SIMPLIFIED = re.compile(r'[这俩们么谁哪几没为发时说着从让给过还话对头点个样现见后买卖听动东车长门问关]')
    # 簡体字が明確に含まれ、かつひらがなが少ない場合
    hiragana_count = len(re.findall(r'[ぁ-ん]', t))
    total_len = len(t)

    # 簡体字トークン
    if re.search(r'[这俩们么谁哪几没说]', t):
        return True

    # 句読点とひらがな極少
    if ('，' in t or '“' in t or '”' in t) and (hiragana_count < 2 or (total_len > 10 and (hiragana_count / total_len) < 0.12)):
        return True

    return False


def inspect_and_correct_pronunciation(raw_sentences, article_context="", custom_dict=None, context_map=None):
    """
    生成された原稿各文の検証・フィルタリング・字幕(display)と音声(speech)のペア生成
    （原稿全体・記事全体から構築された文脈読みマップ context_map を用いて一貫性のある発音を生成）
    """
    if context_map is None:
        full_context = (article_context or "") + "\n" + "\n".join(raw_sentences)
        context_map = build_context_pronunciation_map(full_context, custom_dict=custom_dict)

    if context_map:
        sample_keys = list(context_map.keys())[:6]
        print(f"[ニュース文脈発音] 🧠 記事・原稿全体から {len(context_map)} 件の文脈発音マップを構築: {sample_keys}", flush=True)

    corrected_items = []

    for s in raw_sentences:
        s = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', s).strip()
        if not s or not re.search(r'[一-鿿぀-ゟ゠-ヿA-Za-z0-9]', s):
            continue

        # 助詞（の、は、が、を、に、で、と、など）から始まる不完全な文の修復（※「にゃ」を助詞「に」と誤認させないガード付き）
        s = re.sub(r'^[」』）\)\s　]+', '', s).strip()
        if re.match(r'^(?:の|は|が|を|に(?!ゃ)|で|と|から|より|へ|など|等の)', s):
            if corrected_items:
                prev_display = corrected_items[-1]["display"]
                combined = prev_display + " " + s
                corrected_items[-1]["display"] = combined
                corrected_items[-1]["speech"] = normalize_for_tts(combined, custom_dict=custom_dict, context_map=context_map)
                continue

        # 単独の「にゃ！」「なのだ！」など意味のある文でないものは直前の文へ安全マージまたはスキップ
        core_chars = re.sub(r'[にゃのだ！!？?。、 \s　]+', '', s)
        if len(core_chars) < 2:
            if not corrected_items:
                continue
            prev_disp = corrected_items[-1]["display"].rstrip("。！？!? \t　")
            tail_suffix = re.sub(r'^[。！？!? \t　]+', '', s).strip()
            # 直前の文がまだ語尾で終わっておらず、suffixがある場合のみマージ
            if tail_suffix and not re.search(r'(?:にゃ|のだ|なのだ)$', prev_disp):
                combined_disp = f"{prev_disp}{tail_suffix}"
                corrected_items[-1]["display"] = combined_disp
                corrected_items[-1]["speech"] = normalize_for_tts(combined_disp, custom_dict=custom_dict, context_map=context_map)
            continue

        display_s = re.sub(r'(\d+)(?:歳|才)[（\(].*?[）\)]', r'\1歳', s)
        s = re.sub(r'(\d+)(?:歳|才)[（\(].*?[）\)]', r'\1歳', s)
        # 強化ルビ分離パターン（中黒・送り仮名付き漢字・英数字ハイフンに完全対応）
        RUBY_SEP_PATTERN = r'([A-Za-z0-9\-]+|[一-鿿]+[ぁ-ん]??)[（\(]([ぁ-んァ-ヶー・\s]+)[）\)]'
        display_s = re.sub(RUBY_SEP_PATTERN, r'\1', display_s)
        display_s = display_s.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        display_s = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)のかた([たち|がた|も|は|が|に|へ|で|を|、|。|！|？\s]|$)', r'\1の方\2', display_s)
        display_s = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)なかた([たち|がた|も|は|が|に|へ|で|を|、|。|！|？\s]|$)', r'\1な方\2', display_s)

        display_s = sanitize_speech_text(display_s)
        s = sanitize_speech_text(s)

        if article_context:
            invented_titles = re.findall(r'『(.*?)』', display_s)
            has_invented = False
            for inv_t in invented_titles:
                if inv_t and inv_t not in article_context:
                    print(f"[ハルシネーション検知] 🚫 記事に存在しない作品名捏造を検知: 『{inv_t}』 ➔ 文全体を安全な解説文へ置換")
                    has_invented = True
                    break
            
            if has_invented:
                continue
            elif re.search(r'([、\s]|^)(が[0-9]+日|は[0-9]+日|そしては[0-9]+日)', display_s):
                continue

        # 架空作品名捏造や途切れ文字の検知は実施済み

        FRAGMENT_HALLUCINATION_PATTERN = re.compile(
            r'([A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff]{1,10}[…\.]{2,}'
            r'|[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff]{1,10}…'
            r'|別の(銘柄|会社|企業|人物|人|作品|ゲーム|商品|団体|地域)でした'
            r'|(某|某有名|とある)(会社|企業|人物|人|作品|銘柄)'
            r'|(?:企業|会社)[A-Za-z0-9]'
            r'|(?<![A-Za-z0-9])[A-Za-z]社'
            r'|某社|某企業|〇〇社|XX社)'
        )
        if FRAGMENT_HALLUCINATION_PATTERN.search(display_s):
            print(f"[不完全文字列検知] 🚫 途切れ文字を検知: '{display_s}' ➔ この文を完全破棄")
            continue

        speech_s = re.sub(RUBY_SEP_PATTERN, r'\2', s)
        speech_s = normalize_for_tts(speech_s, custom_dict=custom_dict, context_map=context_map)

        if is_chinese_sentence(display_s) or is_chinese_sentence(speech_s):
            print(f"[中国語フィルター] 🚫 中国語混入文を完全除去: 「{display_s}」")
            continue

        SELF_INTRO_PATTERN = re.compile(r'^(以上[、\s]*)?(ボク|わたし|私|僕)?[、\s]*(とろろ|ずんだもん|ひより)[だですなにゃのだでしたでお送りしましたがお伝えしました！\s　。！？]*$', re.IGNORECASE)
        if SELF_INTRO_PATTERN.match(display_s.strip()) or SELF_INTRO_PATTERN.match(speech_s.strip()):
            print(f"[名乗り・署名フィルター] 不要な名乗り文を除去: 「{display_s}」")
            continue

        if any(kw in display_s for kw in ["期待が高ま", "期待が膨ら", "期待が寄せら", "期待したい", "期待大", "期待されます", "期待ですね"]):
            if len(display_s.strip()) <= 32:
                print(f"[定型句フィルター] 🚫 定型文を除去: 「{display_s}」")
                continue

        CLICHE_PATTERN = re.compile(r'^(本当に|今後の展開に|これからの活躍に|今後の動向に|今後の試合も|チームの未来に)?.*期待が(高まります|高まる|高まっている|高まっています|膨らみます|膨らむ|寄せられます|寄せられている)(ね|よ|な|よね|と思います|と感じます)?[にゃのだ！\s　。！？]*$')
        if CLICHE_PATTERN.match(display_s.strip()) or CLICHE_PATTERN.match(speech_s.strip()):
            continue

        # 直前の文と完全に重複している場合は2重読み上げを防止してスキップ
        if corrected_items:
            prev_display = corrected_items[-1]["display"].strip()
            if prev_display == display_s.strip():
                print(f"[重複文スキップ] ✂️ 直前と同一の文をスキップしました: 「{display_s}」")
                continue

        corrected_items.append({
            "display": display_s,
            "speech": speech_s
        })

    return audit_and_heal_news_script(corrected_items, title="", article_context=article_context)

SPORTS_KEYWORDS = {
    "野球", "サッカー", "五輪", "オリンピック", "大会", "試合", "スポーツ", "監督", "コーチ",
    "チーム", "日本代表", "メダル", "戦", "陸上", "水泳", "バスケ", "バレー", "テニス", "ゴルフ",
    "卓球", "格闘技", "プロレス", "ボクシング", "相撲", "競馬", "騎手", "投手", "捕手", "打者",
    "安打", "セーブ", "本塁打", "ゴール", "得点", "勝利", "敗戦", "優勝", "準優勝", "リーグ",
    "トーナメント", "クラブ", "選手", "アスリート", "F1", "レーサー", "ドライバー", "大谷", "ドジャース"
}

def _heal_athlete_honorific(disp, healed_sp, has_sumo_context, has_sports_context):
    """相撲・非スポーツ文脈における『選手』誤爆の自己修復（最大深さ2階層）"""
    if has_sumo_context:
        if "選手" in disp:
            disp_fixed = re.sub(r'([\u4e00-\u9fa5A-Za-zぁ-んァ-ヶー]{2,6})選手', r'\1', disp)
            if disp_fixed != disp:
                print(f"[敬称自己修復] 🩹 相撲記事での「選手」誤爆を検知・除去: '{disp}' ➔ '{disp_fixed}'", flush=True)
                disp = disp_fixed
        if "選手" in healed_sp:
            disp_sp_fixed = re.sub(r'([\u4e00-\u9fa5A-Za-zぁ-んァ-ヶー]{2,6})選手', r'\1', healed_sp)
            if disp_sp_fixed != healed_sp:
                healed_sp = disp_sp_fixed
        return disp, healed_sp

    if not has_sports_context:
        if "選手" in disp:
            disp_fixed = re.sub(r'([\u4e00-\u9fa5A-Za-zぁ-んァ-ヶー]{2,6})選手', r'\1さん', disp)
            if disp_fixed != disp:
                print(f"[敬称自己修復] 🩹 非スポーツ記事での「選手」誤爆を検知: '{disp}' ➔ '{disp_fixed}'", flush=True)
                disp = disp_fixed
        if "選手" in healed_sp:
            disp_sp_fixed = re.sub(r'([\u4e00-\u9fa5A-Za-zぁ-んァ-ヶー]{2,6})選手', r'\1さん', healed_sp)
            if disp_sp_fixed != healed_sp:
                healed_sp = disp_sp_fixed

    return disp, healed_sp


def audit_and_heal_news_script(items, title="", article_context=""):
    """
    生成された原稿各文（items: [{'display': ..., 'speech': ...}]）を再チェックし、
    誤読・異常置換・不適切な敬称（選手/さん）の自動修正（自己修復・Healing）を行う。
    """
    if not items:
        return items

    full_context = f"{title} {article_context}"
    has_sports_context = any(kw in full_context for kw in SPORTS_KEYWORDS)

    # 相撲文脈キーワード（力士に対して「選手」と呼ぶ誤爆を検知・除去）
    SUMO_KEYWORDS = [
        "大相撲", "相撲", "力士", "関取", "土俵", "秋場所", "春場所", "夏場所", "初場所", "名古屋場所", "九州場所",
        "横綱", "大関", "関脇", "小結", "幕内", "十両", "幕下", "三段目", "序二段", "序ノ口",
        "白星", "黒星", "金星", "取組", "寄り切り", "押し出し", "上手投げ", "下手投げ", "叩き込み", "すくい投げ"
    ]
    has_sumo_context = any(kw in full_context for kw in SUMO_KEYWORDS)

    # 普通名詞・組織名・国名への不自然な「さん」誤爆の最終除去リスト
    INVALID_SAN_NOUNS = [
        "価格", "値段", "相場", "中国", "アメリカ", "米国", "日本", "ロシア", "ウクライナ",
        "自衛隊", "警察", "政府", "当局", "会社", "組織", "空港", "戦闘機", "滑走路",
        "モデル", "タイプ", "システム", "アプリ", "機能", "データ",
        "男性", "女性", "男児", "女児", "少年", "少女", "被害者", "容疑者", "患者",
        "死亡者", "負傷者", "乗客", "住民", "市民", "県民", "国民", "本人", "同氏",
        "両者", "各位", "全員", "店舗", "施設", "病院", "事件", "事故"
    ]

    healed_items = []
    for it in items:
        disp = it.get("display", "")
        sp = it.get("speech", "")

        # 0. 「東奥」（東奥日報等）の誤読（ひがしおく ➔ とうおう）を先行修復（差分解析の誤判定防止）
        if "東奥" in disp or "ひがしおく" in sp:
            sp = re.sub(r'ひがしおくにっぽう', 'とうおうにっぽう', sp)
            sp = re.sub(r'ひがしおくぎじゅく', 'とうおうぎじゅく', sp)
            sp = re.sub(r'ひがしおく', 'とうおう', sp)
            sp = re.sub(r'東奥日報', 'とうおうにっぽう', sp)
            sp = re.sub(r'東奥義塾', 'とうおうぎじゅく', sp)
            sp = re.sub(r'東奥', 'とうおう', sp)

        # 1. 読み上げテキスト(speech)の異常置換自己修復
        healed_sp = heal_sentence_reading(disp, sp)

        # 2. 「選手」の文脈適正チェック
        disp, healed_sp = _heal_athlete_honorific(disp, healed_sp, has_sumo_context, has_sports_context)

        # 3. 普通名詞・国名・組織名への「さん」誤爆の最終除去
        for noun in INVALID_SAN_NOUNS:
            san_pattern = f"{noun}さん"
            if san_pattern in disp:
                print(f"[敬称自己修復] 🩹 普通名詞/組織への「さん」誤爆を除去: '{san_pattern}' ➔ '{noun}'", flush=True)
                disp = disp.replace(san_pattern, noun)
            if san_pattern in healed_sp:
                healed_sp = healed_sp.replace(san_pattern, noun)

        # 3.5 「男さん」「女さん」の単体誤爆除去（長男さん等の家族呼称は巻き込まず、単独の「男さん」「女さん」を除去）
        if "男さん" in disp or "女さん" in disp:
            disp = re.sub(r'(?<![長次三四五ご御])男さん', '男', disp)
            disp = re.sub(r'(?<![長次三四五ご御])女さん', '女', disp)
        if "男さん" in healed_sp or "女さん" in healed_sp:
            healed_sp = re.sub(r'(?<![長次三四五ご御])男さん', '男', healed_sp)
            healed_sp = re.sub(r'(?<![長次三四五ご御])女さん', '女', healed_sp)

        # 4. 「とろろにゃ」誤爆の自己修復（文末・文中の異常なキャラクター口調混入を除去・是正）
        if "とろろにゃ" in disp or "とろろにゃ" in healed_sp:
            print(f"[口調自己修復] 🩹 「とろろにゃ」誤爆を検知・自動修復: '{disp}'", flush=True)
            # パターン1: 助詞＋「とろろにゃ」（例: 「事件に、とろろにゃ。」➔「事件がありました。」）
            disp = re.sub(r'([にでへ])[\s　、,]*とろろにゃ[！!。？?]*', r'\1関するニュースです。', disp)
            healed_sp = re.sub(r'([にでへ])[\s　、,]*とろろにゃ[！!。？?]*', r'\1かんするにゅーすです。', healed_sp)
            # パターン2: 終助詞＋「とろろにゃ」（例: 「楽しみですねとろろにゃ。」➔「楽しみですね。」）
            disp = re.sub(r'([ねよ]ね?|[。！？])[\s　]*とろろにゃ[！!。？?]*', r'\1', disp)
            healed_sp = re.sub(r'([ねよ]ね?|[。！？])[\s　]*とろろにゃ[！!。？?]*', r'\1', healed_sp)
            # パターン3: 述語＋「とろろにゃ」（例: 「驚いたとろろにゃ」➔「驚いたにゃ」）
            disp = re.sub(r'([ただるいくすつぬふむゆよれろ]|です|ます|でした|ました)とろろにゃ', r'\1にゃ', disp)
            healed_sp = re.sub(r'([ただるいくすつぬふむゆよれろ]|です|ます|でした|ました)とろろにゃ', r'\1にゃ', healed_sp)
            # パターン4: 残存する「とろろにゃ」の除去・置換
            disp = re.sub(r'とろろにゃ[！!。？?]*', 'ですね。', disp)
            healed_sp = re.sub(r'とろろにゃ[！!。？?]*', 'ですね。', healed_sp)

        # 5. 日付・時刻の読み崩れ（例: 「22分」が「にがつにじゅうににち」等）の自己修復
        if re.search(r'\d+分', disp) and re.search(r'[にち日]', healed_sp) and not re.search(r'\d+日', disp):
            m_min = re.search(r'(\d+)分', disp)
            if m_min:
                healed_sp = re.sub(r'[0-9一-鿿ぁ-んァ-ヶ]+(?:にち|日)分', f"{m_min.group(1)}分", healed_sp)

        # 6. 相撲記事での「リング」誤用自己修復（相撲の舞台はリングではなく「土俵」）
        SUMO_KEYWORDS = {
            "相撲", "大相撲", "力士", "横綱", "大関", "関脇", "小結", "幕内", "十両", "行司", "土俵",
            "巡業", "部屋", "親方", "取組", "白星", "黒星", "金星", "豊昇龍", "琴桜", "大の里",
            "照ノ富士", "尊富士", "若元春", "若隆景", "阿炎", "王鵬", "熱海富士", "伯桜鵬", "宇良", "翔猿"
        }
        has_sumo_context = any(kw in full_context for kw in SUMO_KEYWORDS)
        if has_sumo_context:
            if "リング" in disp:
                print(f"[相撲用語修復] 🩹 相撲記事での「リング」誤用を検知: '{disp}' ➔ '土俵' へ自動修復", flush=True)
                disp = re.sub(r'リング(?:上)?', '土俵', disp)
            if "リング" in healed_sp or "りんぐ" in healed_sp:
                healed_sp = re.sub(r'(?:リング|りんぐ)(?:じょう|上)?', 'どひょう', healed_sp)

        # 7. 不自然な「。にゃ。」「！にゃ！」「。 にゃ！」等の二重句読点・語尾結合の自己修復
        if re.search(r'[。！？]+[\s　]*(?:にゃ|のだ|なのだ)', disp) or "。にゃ" in disp or "にゃ。 にゃ" in disp or "。。" in disp:
            disp = re.sub(r'[。！？]+[\s　]*(にゃ|のだ|なのだ)[！!。？?]*', r'\1。', disp)
            disp = re.sub(r'(?:にゃ[！!。？?\s　]*){2,}', 'にゃ！', disp)
            disp = re.sub(r'(?:のだ[！!。？?\s　]*){2,}', 'のだ！', disp)
            disp = re.sub(r'。{2,}', '。', disp)
        if re.search(r'[。！？]+[\s　]*(?:にゃ|のだ|なのだ)', healed_sp) or "。にゃ" in healed_sp or "にゃ。 にゃ" in healed_sp or "。。" in healed_sp:
            healed_sp = re.sub(r'[。！？]+[\s　]*(にゃ|のだ|なのだ)[！!。？?]*', r'\1。', healed_sp)
            healed_sp = re.sub(r'(?:にゃ[！!。？?\s　]*){2,}', 'にゃ！', healed_sp)
            healed_sp = re.sub(r'(?:のだ[！!。？?\s　]*){2,}', 'のだ！', healed_sp)
            healed_sp = re.sub(r'。{2,}', '。', healed_sp)

        # 8. 「東奥」（東奥日報等）の誤読（ひがしおく ➔ とうおう）の自己修復
        if "東奥" in disp or "ひがしおく" in healed_sp or "東奥" in healed_sp:
            if "ひがしおく" in healed_sp:
                print(f"[誤読自己修復] 🩹 「東奥」の誤読を検知・自動修復: 'ひがしおく' ➔ 'とうおう'", flush=True)
                healed_sp = re.sub(r'ひがしおくにっぽう', 'とうおうにっぽう', healed_sp)
                healed_sp = re.sub(r'ひがしおくぎじゅく', 'とうおうぎじゅく', healed_sp)
                healed_sp = re.sub(r'ひがしおく', 'とうおう', healed_sp)
            if "東奥" in healed_sp:
                healed_sp = re.sub(r'東奥日報', 'とうおうにっぽう', healed_sp)
                healed_sp = re.sub(r'東奥義塾', 'とうおうぎじゅく', healed_sp)
                healed_sp = re.sub(r'東奥', 'とうおう', healed_sp)

        # 9. 破損語尾（「みんないゃにゃ」「いゃにゃ」「ないゃ」等）の自己修復
        if re.search(r'(?:みんないゃ|いゃにゃ|ないゃ|てみんないゃ)', disp):
            print(f"[語尾自己修復] 🩹 破損語尾を検知・自動修復 (display): '{disp}'", flush=True)
            disp = re.sub(r'てみんないゃにゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', disp)
            disp = re.sub(r'みんないゃにゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', disp)
            disp = re.sub(r'てみんないゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', disp)
            disp = re.sub(r'みんないゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', disp)
            disp = re.sub(r'い+ゃにゃ([！!？?。、\s　]|$)', r'いにゃ\1', disp)
            disp = re.sub(r'ない+ゃにゃ([！!？?。、\s　]|$)', r'ないにゃ\1', disp)
            disp = re.sub(r'ない+ゃ([！!？?。、\s　]|$)', r'ないにゃ\1', disp)

        if re.search(r'(?:みんないゃ|いゃにゃ|ないゃ|てみんないゃ)', healed_sp):
            print(f"[語尾自己修復] 🩹 破損語尾を検知・自動修復 (speech): '{healed_sp}'", flush=True)
            healed_sp = re.sub(r'てみんないゃにゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', healed_sp)
            healed_sp = re.sub(r'みんないゃにゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', healed_sp)
            healed_sp = re.sub(r'てみんないゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', healed_sp)
            healed_sp = re.sub(r'みんないゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', healed_sp)
            healed_sp = re.sub(r'い+ゃにゃ([！!？?。、\s　]|$)', r'いにゃ\1', healed_sp)
            healed_sp = re.sub(r'ない+ゃにゃ([！!？?。、\s　]|$)', r'ないにゃ\1', healed_sp)
            healed_sp = re.sub(r'ない+ゃ([！!？?。、\s　]|$)', r'ないにゃ\1', healed_sp)

        # 10. 「上（うえ／じょう）」の誤読自己修復（表示は漢字を維持し、音声読み上げを確実に補正）
        if re.search(r'(?<![A-Za-z0-9])(?:X|Ｘ)上(?=[、\s　「『でにはものからと]|$)', healed_sp):
            print(f"[誤読自己修復] 🩹 'X上'の誤読を検知・自動修復: 'X上' ➔ 'エックスじょう'", flush=True)
            healed_sp = re.sub(r'(?<![A-Za-z0-9])(?:X|Ｘ)上(?=[、\s　「『でにはものからと]|$)', 'エックスじょう', healed_sp)

        # 「〜の上（うえ）」「〜した上で（うえで）」が音声用テキストで「じょう」と誤変換されていた場合の修復
        if re.search(r'([ぁ-んァ-ヶー一-鿿]+(?:した|された|られた|行った|見た|確認した|検討した|相談した|納得した|調査した|判断した))じょう(?=で|に|は|も|[、\s　]|$)', healed_sp):
            healed_sp = re.sub(r'([ぁ-んァ-ヶー一-鿿]+(?:した|された|られた|行った|見た|確認した|検討した|相談した|納得した|調査した|判断した))じょう(?=で|に|は|も|[、\s　]|$)', r'\1うえ', healed_sp)

        # 11. 読み上げテキスト(speech)内の全角英数字を半角英数へ正規化＆大文字英単語のスペル読み（GIRLS ➔ ジ・イ・アイ…）自動修復
        # ※字幕（disp）は一切変更せず全角を維持。
        def _zenkaku_to_hankaku_alnum(s):
            return s.translate(str.maketrans(
                'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            ))
        healed_sp = _zenkaku_to_hankaku_alnum(healed_sp)

        # ※略語（NHK, FBI, CIA, SNS, AI, PR, URL, DX, EV, USA, WHO, MUFG等）は完全保護
        SAFE_KNOWN_ACRONYMS = {
            "NHK", "FBI", "CIA", "SNS", "AI", "PR", "URL", "DX", "EV", "OS", "UI", "UX",
            "API", "CPU", "GPU", "PC", "TV", "SSD", "HDD", "USB", "NFT", "TGS", "RPG",
            "FPS", "MMO", "VR", "AR", "USA", "UK", "WHO", "UN", "EU", "NATO", "IMF",
            "OECD", "GDP", "GNP", "CEO", "COO", "CFO", "CTO", "CIO", "CM", "PV", "MV",
            "BGM", "SE", "MC", "DJ", "CD", "DVD", "BD", "SD", "IC", "ID", "IT", "IP",
            "LTE", "SIM", "PIN", "QR", "VIP", "PTA", "JAL", "ANA", "JR", "NPO", "NGO",
            "JRA", "NPB", "JFA", "WBC", "FIFA", "IOC", "JOC", "MUFG", "SMBC", "FRB",
            "CPI", "SMR", "TNO", "LLM"
        }
        def _fix_uppercase_word(m):
            w = m.group(0)
            u = w.upper()
            if u in SAFE_KNOWN_ACRONYMS or len(w) <= 2 or not re.search(r'[AIUEOYaiueoy]', w):
                return w
            fixed = w.capitalize()
            print(f"[英単語発音修復] 🩹 '{w}' ➔ '{fixed}'（VOICEVOXのスペル読みを防止）", flush=True)
            return fixed

        if re.search(r'(?<![A-Za-z])[A-Z]{3,}(?![A-Za-z])', healed_sp):
            healed_sp = re.sub(r'(?<![A-Za-z])[A-Z]{3,}(?![A-Za-z])', _fix_uppercase_word, healed_sp)

        # 12. 特殊固有名詞・人名の誤読自己修復（字幕は漢字表記を完全維持し、音声側のみ自然な発音へ補正）
        # 例: 「星街すいせい」「星街」➔「ほしまちすいせい」「ほしまち」（VOICEVOXが「ほしがい」と誤読するのを恒久防止）
        if "星街" in healed_sp:
            print(f"[誤読自己修復] 🩹 '星街'の誤読を検知・自動修復 (speech): '星街' ➔ 'ほしまち'", flush=True)
            healed_sp = re.sub(r'星街すいせい', 'ほしまちすいせい', healed_sp)
            healed_sp = re.sub(r'星街', 'ほしまち', healed_sp)

        # 13. 文脈依存語句（中条、金、上で）の誤読自己修復（字幕は漢字表記を完全維持、音声側のみ自然な発音へ補正）
        # A. 人名「中条」➔「なかじょう」（VOICEVOXが「ちゅうじょう」と誤読するのを恒久防止）
        if "中条" in healed_sp:
            print(f"[誤読自己修復] 🩹 '中条'の誤読を検知・自動修復 (speech): '中条' ➔ 'なかじょう'", flush=True)
            healed_sp = re.sub(r'(?<![0-9〇一二三四五六七八九十百千万第])中条(?=(?:あやみ|きよし|さん|氏|様|ちゃん|くん|君))', 'なかじょう', healed_sp)

        # B. お金文脈での「金」➔「かね」（VOICEVOXが「きん」と誤読するのを恒久防止）
        if "金" in healed_sp:
            healed_sp = re.sub(r'金(?=目当て|めあて|払い|はらい|勘定|かんじょう|の切れ目|の亡者)', 'かね', healed_sp)
            healed_sp = re.sub(r'金(?=を(?:要求|受取|受け取|奪|払|はら|持|もっ|渡|わた|取|盗|ぬす|返|かえ|借|か|貸|欲|ほし|稼|かせ|出|だ|使|つか|脅|巻き上げ|せび))', 'かね', healed_sp)
            healed_sp = re.sub(r'金(?=に(?:困|こま|目がない|目がくら|糸目をつけず|飽か))', 'かね', healed_sp)
            healed_sp = re.sub(r'金(?=が(?:欲|ほし|無|な|足|た))', 'かね', healed_sp)

        # C. 動詞連体形＋「上で」➔「うえで」（VOICEVOXが「じょうで」と誤読するのを恒久防止）
        if "上" in healed_sp:
            healed_sp = re.sub(r'([ぁ-んァ-ヶー一-鿿]+(?:する|できる|行う|おこなう|考える|かんがえる|予測する|判断する|生きる|選ぶ|進める|進む|暮らす|使う|働く|送る|受ける|決める|保つ|守る|続ける|見る|知る|得る|勝つ|負ける|言う|語る|読む|書く|含む|伴う|従う|基づく|沿う|向かう|至る|及ぶ|応じる|した|された|られた|行った|見た|選んだ|読んだ|確認した|検討した|相談した|納得した|調査した|判断した|考慮した))上(?=で|に|は|も|の|[、\s　]|$)', r'\1うえ', healed_sp)

        # 14. 異常な二重化（「緊急事態非常事態」「きんきゅうじたいひじょうじたい」等）の自動一本化
        if "きんきゅうじたいひじょうじたい" in healed_sp or "緊急事態非常事態" in healed_sp:
            healed_sp = re.sub(r'きんきゅうじたい[\s　]*ひじょうじたい', 'きんきゅうじたい', healed_sp)
            healed_sp = re.sub(r'緊急事態[\s　]*非常事態', '緊急事態', healed_sp)
        if "緊急事態非常事態" in disp:
            disp = re.sub(r'緊急事態[\s　]*非常事態', '緊急事態', disp)

        # 15. 外国人選手・特殊固有名詞の誤読自己修復
        if "周啓豪" in healed_sp:
            healed_sp = re.sub(r'周啓豪', 'しゅうけいごう', healed_sp)

        # 16. 音声用テキスト内の不要な解説括弧ルビ（例: 消費者物価指数（しーぴーあい）等）の自動除去
        if re.search(r'[（\(]', healed_sp):
            # パターン1: 直前に日本語/英字があり、括弧内が英字略語またはカナ/ひらがなルビ
            healed_sp = re.sub(r'([ぁ-んァ-ヶー一-鿿A-Za-z])[（\(](?:[ぁ-んァ-ヴー]{1,10}|[A-Za-z]{2,6})[）\)]', r'\1', healed_sp)
            # パターン2: 直前に英字略語があり、括弧内が日本語解説（例: LLM（大規模言語モデル））
            healed_sp = re.sub(r'([A-Za-z]{2,10})[（\(][ぁ-んァ-ヶー一-鿿]{2,15}[）\)]', r'\1', healed_sp)

        # 17. 助詞重複による文法崩れの自己修復（「〜が注目が集まる」➔「〜に注目が集まる」）
        if "が注目が集まる" in disp:
            disp = re.sub(r'([ぁ-んァ-ヶー一-鿿A-Za-z0-9]+)が注目が集まる', r'\1に注目が集まる', disp)
        if "が注目が集まる" in healed_sp:
            healed_sp = re.sub(r'([ぁ-んァ-ヶー一-鿿A-Za-z0-9]+)が注目が集まる', r'\1に注目が集まる', healed_sp)

        # 18. 「大（おお／だい）」の文脈依存語句の自己修復（字幕は漢字を完全維持、音声のみ自然な読みへ補正）
        if "大" in healed_sp:
            healed_sp = re.sub(r'大(?=違い|ちがい|食い|ぐい|一番|いちばん|舞台|ぶたい|荒れ|あれ|雨|あめ|雪|ゆき|水|みず|風|かぜ|波|なみ|勢|ぜい|入り|いり|騒ぎ|さわぎ|掛かり|がかり|掛け|がけ|盛り|もり|急ぎ|いそぎ|慌て|あわて|柄|がら|物|もの|詰め|づめ|筋|すじ|昔|むかし|喜び|よろこび|笑い|わらい|泣き|なき|声|ごえ|怪我|けが|火傷|やけど|粒|つぶ|箱|ばこ|所帯|しょたい|所帯|じょたい|立ち回り|たちまわり|見栄|みえ|見出し|みだし|船|ぶね|元|もと|まか|手|て|相撲|ずもう)', 'おお', healed_sp)
            healed_sp = re.sub(r'大人気(?=ない|なさ|なく|なかっ)', 'おとなげ', healed_sp)

        # 19. 人を指す「方（かた）」の文脈自己修復（字幕は漢字を完全維持、音声のみ自然な発音へ補正）
        if "方" in healed_sp:
            healed_sp = apply_person_kata_rules(healed_sp)

        healed_items.append({
            "display": disp,
            "speech": healed_sp
        })

    # 10. 末尾アイテムが途中で切れた不完全文（例: 「教師たちの生活も。」「FGTが常磁。」「現地で撮。」等）の場合の安全トリム
    while len(healed_items) >= 4:
        last_disp = healed_items[-1]["display"].strip()
        last_strp = re.sub(r'[。！？\!\?」』）\)\s　]+$', '', last_disp)
        is_fragment = False
        # 助詞終了チェック
        if re.search(r'(?:[がはをにとのとでもからへよりまたそして、,，]|けど|ので|って|とか|など|といった|として|による|により|に対する)$', last_strp):
            is_fragment = True
        # 述語・終止形がない体言止め・ぶつ切り文チェック
        elif not re.search(r'(?:にゃ|のだ|なのだ|です|ます|でした|ました|ません|した|された|られた|なった|行った|言った|見た|あった|いた|勝った|負けた|ある|いる|ない|たい|だ|た|る|い|う|く|つ|ぬ|ふ|む|ゆ|ね|よ|わ|よな|よね|かな|かい|ぞ|ぜ|さ|しょう)[！!？?。、\s　]*$', last_disp):
            is_fragment = True
        
        if is_fragment:
            print(f"[不完全文自己修復] 🩹 途中で切れた末尾文を除去: '{last_disp}'", flush=True)
            healed_items.pop()
        else:
            break

GENERIC_TITLE_WORDS = {
    'ニュース', '速報', '発表', '開始', '決定', '予定', '実施', '検討', '注意', '情報', '対策',
    '対応', '確認', '政府', '方針', '問題', '報告', '理由', '影響', '結果', '状況',
    '活動', '公開', '登場', '開催', '参加', '紹介', '話題', '注目', '人気', '最新',
    '公式', '更新', '変更', '拡大', '減少', '増加', '提供', '発売', '記念', '取材',
    'コメント', '投稿', '報告', '解説', '特集', '一覧', 'まとめ'
}

def _match_title_subjects_in_script(primary_subjects, kanji_names, clean_t, raw_text, article_context):
    """タイトル主要固有名詞・主語のマッチング検証（最大深さ2階層）"""
    matched_subs = [s for s in primary_subjects if s in raw_text]

    # 人名の場合、先頭2文字の名字（例: 大森元貴 -> 大森）も許容
    for k in kanji_names:
        if re.match(r'^[一-鿿]{4}$', k) and k[:2] in raw_text and k[:2] not in matched_subs:
            matched_subs.append(k[:2])
            continue
        if len(k) >= 4:
            stem = re.sub(r'(接近|発表|開始|決定|中止|通過|着陸|出発|逮捕|搬送|衝突|火災|避難|警戒|対策|方針|合意|声明|会談|訪問|辞任|就任)$', '', k)
            if len(stem) >= 2 and stem in raw_text and stem not in matched_subs:
                matched_subs.append(stem)

    # タイトル内の2〜3文字の重要漢字（例: 大統領、専用機）や本文の固有エンティティが含まれていれば救済
    if not matched_subs:
        sub_nouns = [w for w in re.findall(r'[一-鿿]{2,3}', clean_t) if w not in GENERIC_TITLE_WORDS]
        matched_nouns = [w for w in sub_nouns if w in raw_text]
        common_kana = {
            'ニュース', 'コメント', 'オリジナル', 'ランキング', 'アワード', 'アンケート', 'リポート',
            'シリーズ', 'イベント', 'ストリーミング', 'ショット', 'リリース', 'インタビュー',
            'トップ', 'ラスト', 'スタート', 'ゴール', 'メンバー', 'グループ', 'チーム', 'ファン',
            'マイナス', 'プラス', 'ポイント'
        }
        body_entities = [w for w in re.findall(r'[ァ-ヶー]{3,}|[A-Za-z]{3,}', article_context or "") if w not in common_kana]
        matched_body = [w for w in body_entities if w in raw_text]
        if matched_nouns or (len(matched_body) >= 2):
            matched_subs.extend(matched_nouns + matched_body)

    return matched_subs


def validate_news_script_quality(raw_text, title="", article_context="", char_desc=""):
    """
    生成されたニュース原稿の品質をダブルチェックする。
    """
    if not raw_text or len(raw_text.strip()) < 100:
        return False, f"原稿の文字数が少なすぎます ({len(raw_text.strip()) if raw_text else 0}文字 < 100文字)"

    split_sentences_check = split_sentences_safely(raw_text)
    raw_len = len(raw_text.strip())
    if len(split_sentences_check) < 3 or (len(split_sentences_check) < 4 and raw_len < 160):
        return False, f"原稿の文数・文字数が不足しています ({len(split_sentences_check)}文, {raw_len}文字)。"

    if re.search(r'(?:だよですね|だねですね|よねですね|よですね|ねですね|だなにゃ|だなのだ|とろろにゃ|みんないゃ|いゃにゃ|ないゃ|てみんないゃ)', raw_text):
        return False, "不自然な二重語尾・破損した語尾（みんないゃにゃ等）または禁止された口調「とろろにゃ」が含まれています"

    # 末尾の文が途中で切れた不完全文（助詞終了など）でないかのチェック
    if split_sentences_check:
        last_s = split_sentences_check[-1].strip()
        last_strp = re.sub(r'[。！？\!\?」』）\)\s　]+$', '', last_s)
        if re.search(r'(?:[がはをにとのとでもからへよりまたそして、,，]|けど|ので|って|とか|など|といった|として|による|により|に対する)$', last_strp):
            return False, f"原稿の末尾文が助詞で途切れています: '{last_s}'"
        if not re.search(r'(?:にゃ|のだ|なのだ|です|ます|でした|ました|ません|した|された|られた|なった|行った|言った|見た|あった|いた|勝った|負けた|ある|いる|ない|たい|だ|た|る|い|う|く|つ|ぬ|ふ|む|ゆ|ね|よ|わ|よな|よね|かな|かい|ぞ|ぜ|さ|しょう)[！!？?。、\s　]*$', last_s):
            return False, f"原稿の末尾文が述語・終止形のない体言止め・ぶつ切り文です: '{last_s}'"

    # 相撲記事での「リング」使用チェック（相撲の舞台はリングではなく「土俵」）
    SUMO_CHECK_KEYWORDS = {"相撲", "大相撲", "力士", "横綱", "大関", "関脇", "小結", "幕内", "十両", "行司", "土俵", "巡業", "親方", "取組", "白星", "黒星", "金星", "豊昇龍", "琴桜", "大の里", "照ノ富士"}
    full_context_check = f"{title} {article_context} {raw_text}"
    if any(kw in full_context_check for kw in SUMO_CHECK_KEYWORDS) and ("リング" in raw_text or "リング上" in raw_text):
        return False, "相撲のニュースで不適切な格闘技用語「リング」が使用されています（相撲の舞台は「土俵」です）"

    # 0. AIメタ応答・前置き・プロンプト復唱の検知（「了解しました」「以下に出力します」等）
    AI_META_PATTERNS = [
        re.compile(r'(了解しました|承知いたしました|承知しました|かしこまりました)'),
        re.compile(r'(以下に[、\s]|以下のとおり|以下の通り|テキストを出力します|台本を出力します)'),
        re.compile(r'(指定されたルール|ルールに従|ルールに基づ|プロンプト|制約事項|品質修正指示|ダブルチェック)'),
        re.compile(r'(皇族のお名前|ルビ形式|ルビを付けないで|キャスター感想の表現|報道倫理ルール|出力形式のルール|深掘り解説台本|台本作成ルール)'),
        re.compile(r'(別の話題へのすり替え|話題のすり替え|すり替えは厳禁)'),
    ]
    for pat in AI_META_PATTERNS:
        if pat.search(raw_text):
            return False, f"AIのメタ発言・プロンプト指示の復唱が検知されました: '{pat.pattern}'"

    # 1. 連続した長文英文フレーズの混入チェック（※製品名等の固有名詞は許容し、5単語以上の英文センテンスのみを検知）
    check_text = raw_text
    if title:
        for eng_phrase in re.findall(r'[a-zA-Z0-9\s]{3,}', title):
            if eng_phrase.strip():
                check_text = check_text.replace(eng_phrase.strip(), "")
    if re.search(r'(?:[a-zA-Z]{2,}\s+){4,}[a-zA-Z]{2,}', check_text):
        return False, "長文の英文フレーズが混入しています"

    # 2. 中国語・簡体字チェック
    for l in split_sentences_check:
        if is_chinese_sentence(l):
            return False, f"中国語・簡体字表現が検知されました: '{l}'"

    # 3. 報道メタ説明（「〜で報じられています」等の中身のない空虚な文）の検知
    META_REPORT_PATTERNS = [
        re.compile(r'[0-9]+年?[0-9]+月?[0-9]+日.*?(で|に|から|として)?(報じられてい|報道されてい|伝えられてい|掲載されてい|配信されてい|記事になってい)'),
        re.compile(r'(ライブドアニュース|Yahoo!ニュース|NHK|共同通信|時事通信|各社|メディア|新聞|ネットニュース)で(報じ|報道|伝え|掲載)'),
        re.compile(r'^(これ|このニュース|この記事)は.*?(報じられて|報道されて|伝えられて)'),
        re.compile(r'という(ニュース|記事|報道)が(あり|報じられ|伝えられ)ました'),
        re.compile(r'^(これ|このニュース|この記事|今回)?.*?(について|に関して)(お伝えします|お伝えいたします|お届けします|お送りします|ご紹介します|解説します|見ていきましょう)'),
    ]
    for pat in META_REPORT_PATTERNS:
        if pat.search(raw_text):
            return False, f"具体的な内容のない報道メタ説明文が検知されました: '{pat.pattern}'"

    # 4. トートロジー・中身のない水増し文句チェック
    TAUTOLOGY_PATTERNS = [
        re.compile(r'これは一体どういうことなのか説明してみよう'),
        re.compile(r'(名作映画|人気作品|話題作|新作|商品)ってどんな作品だろうか'),
        re.compile(r'長年愛され続けている.*のことを指すんだ'),
        re.compile(r'という配信プラットフォームに'),
        re.compile(r'どういうことなのか、詳しく見ていきましょうか'),
        re.compile(r'別の(銘柄|会社|企業|人物|人|作品|ゲーム|商品|団体|地域)でした'),
        re.compile(r'(某|某有名|とある)(会社|企業|人物|人|作品|銘柄|地域|所|場所|市|町|村|県|国)'),
    ]
    for pat in TAUTOLOGY_PATTERNS:
        if pat.search(raw_text):
            return False, f"中身のない同語反復・曖昧な水増し表現が検知されました: '{pat.pattern}'"

    # 5. 句読点（。）の存在チェック
    has_kuten = any(c in raw_text for c in ['。', '！', '？', '!', '?'])
    if not has_kuten:
        return False, "文末の句点（。）が欠落しています"

    # 6. ファクト照合・架空作品名や捏造エピソードの検知
    if article_context and len(article_context) > 40:
        invented_titles = re.findall(r'『(.*?)』', raw_text)
        for inv_t in invented_titles:
            if inv_t and inv_t not in article_context and inv_t not in title:
                return False, f"元記事に存在しない作品名が捏造されています: 『{inv_t}』"

        # 6-2. 地名（都道府県名）のファクト照合（元記事に存在しない他県の事件・場所の捏造ハルシネーション検知）
        ALL_PREFECTURES = [
            '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
            '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
            '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
            '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
            '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
            '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
            '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
        ]
        combined_context = f"{title} {article_context}"
        for pref in ALL_PREFECTURES:
            pref_short = pref.rstrip('都府県')
            if pref in raw_text or (len(pref_short) >= 2 and f"{pref_short}の" in raw_text):
                if pref_short not in combined_context:
                    return False, f"元記事に存在しない都道府県・地名が捏造されています: '{pref}' (元記事の事件現場・地域と一致しません)"

        # 6-3. 市区町村名のファクト照合（元記事に存在しない架空・他地域の市町村名の捏造ハルシネーション検知）
        # 例: 山形県酒田市の事件なのに「防府市」「松阪市」等を捏造した場合を即座に撃墜
        GENERIC_MUNICIPALITY_EXCLUDES = {
            '各自治体', '各市町村', '全国の市', '周辺地域', '現場周辺', '一部地域',
            '大都市', '地方都市', '主要都市', '市場', '朝市', '魚市場', '下町', '門前町',
            '市役所', '区役所', '町役場', '村役場'
        }
        for m_city in re.finditer(r'([一-鿿]{2,5}(?:市|区|町|村))', raw_text):
            loc = m_city.group(1)
            if loc in GENERIC_MUNICIPALITY_EXCLUDES or loc.endswith('市場'):
                continue
            loc_core = loc[:-1]  # '防府市' -> '防府'
            if len(loc_core) >= 2 and loc_core not in combined_context:
                return False, f"元記事に存在しない市区町村名が捏造されています: '{loc}' (元記事の事件現場・地域と一致しません)"

        # 6-4. 日本に存在しない架空の組織名（〇〇市警）の検知
        if re.search(r'[一-鿿]{2,6}市警', raw_text):
            return False, "日本に存在しない架空の組織名（〇〇市警）が捏造されています"

    # 7. トピック整合性チェック（元記事タイトルとの乖離・全く無関係な幻覚ニュースの検知）
    if title:
        # 元記事タイトル・本文にない「ワクチン」「コロナ」の幻覚を即座に撃墜
        is_vaccine_topic = any(w in (title + " " + article_context) for w in ['ワクチン', 'コロナ', 'COVID', 'オミクロン', '接種'])
        if not is_vaccine_topic and any(w in raw_text for w in ['ワクチン', 'コロナ', '接種体制', '臨床試験も順調', '国民全員への接種']):
            return False, "元記事に存在しないワクチン・新型コロナのハルシネーションが検知されました"

        title_keywords = re.findall(r'[一-鿿]{2,}|[ァ-ヶー]{2,}|[A-Za-z0-9]{2,}', title)
        filtered_keywords = [w for w in title_keywords if w not in GENERIC_TITLE_WORDS]
        # 長い漢字塊（4文字以上、例: 正恩氏後継、無人機接近）がある場合、前後の2文字サブキーワードも候補に加える
        expanded_keywords = list(filtered_keywords)
        for w in filtered_keywords:
            if len(w) >= 4 and re.match(r'^[一-鿿]+$', w):
                sub1, sub2 = w[:2], w[-2:]
                if sub1 not in GENERIC_TITLE_WORDS and sub1 not in expanded_keywords:
                    expanded_keywords.append(sub1)
                if sub2 not in GENERIC_TITLE_WORDS and sub2 not in expanded_keywords:
                    expanded_keywords.append(sub2)

        if expanded_keywords:
            matched_keywords = [w for w in expanded_keywords if w in raw_text]
            if not matched_keywords:
                return False, f"元記事タイトル「{title}」の重要キーワード（{filtered_keywords[:3]}）が原稿内に全く含まれていません（トピック乖離・幻覚）"

        # 固有主語チェック（人名・グループ名・英字固有名詞・主要カタカナ名が原稿内に存在するか）
        clean_t = re.sub(r'[（\(][^）\)]*(?:ニュース|新聞|通信|DIG|ORICON|オリコン|Yahoo|NHK|TBS|日テレ|テレビ|放送|共同|時事)[^）\)]*[）\)]', '', title)
        eng_tokens = [t for t in re.findall(r'[A-Za-z]{2,}', clean_t) if t.upper() not in {'NEWS', 'RSS', 'DIG', 'PR', 'WEB', 'JNN', 'ANN', 'FNN', 'NNN', 'TBS', 'NHK', 'TV', 'VS'}]
        kanji_names = [k for k in re.findall(r'[一-鿿]{4,}', clean_t) if k not in GENERIC_TITLE_WORDS]
        m_head = re.match(r'^([一-鿿]{2,6})[「『（\(\s、,]', clean_t)
        if m_head and m_head.group(1) not in GENERIC_TITLE_WORDS:
            kanji_names.append(m_head.group(1))

        COMMON_KANA_WORDS = {
            'ニュース', 'コメント', 'オリジナル', 'ランキング', 'アワード', 'アンケート', 'リポート',
            'シリーズ', 'イベント', 'ストリーミング', 'ショット', 'リリース', 'インタビュー',
            'トップ', 'ラスト', 'スタート', 'ゴール', 'メンバー', 'グループ', 'チーム', 'ファン',
            'マイナス', 'プラス', 'ポイント'
        }
        kana_tokens = [k for k in re.findall(r'[ァ-ヶー]{3,}', clean_t) if k not in COMMON_KANA_WORDS]
        primary_subjects = list(dict.fromkeys(eng_tokens + kanji_names + kana_tokens))
        if primary_subjects:
            matched_subs = _match_title_subjects_in_script(primary_subjects, kanji_names, clean_t, raw_text, article_context)
            if not matched_subs:
                return False, f"元記事タイトルの主要固有名詞・主語（{primary_subjects[:3]}）が原稿内に全く含まれていません（主語喪失・一般論ハルシネーション）"

    # 8. スイーツ・洋菓子ブランドの誤認（ナイトクラブ・夜遊びとの混同ハルシネーション）防止
    if "クラブハリエ" in title or "クラブハリエ" in article_context:
        if re.search(r'(夜の景観|夜の楽しみ方|ナイトクラブ|ディスコ|夜遊び|クラブイベント|人気クラブ)', raw_text):
            return False, "洋菓子店『クラブハリエ』を夜のクラブ・ディスコと誤認したハルシネーションが検知されました"

    # 9. キャラクター口調・感想の欠落チェック（とろろモードなら「にゃ」が1つ以上含まれているか）
    if "にゃ" in char_desc and "にゃ" not in raw_text:
        return False, "キャラクター口調（〜にゃ）およびキャスターの感想・リアクションが欠落しています（客観報道文のみになっています）"
    elif "なのだ" in char_desc and "のだ" not in raw_text:
        return False, "キャラクター口調（〜なのだ）およびキャスターの感想・リアクションが欠落しています"

    # 10. 「このニュース見たにゃ」等の中身のない空虚な感想の検知
    if re.search(r'この(?:ニュース|話題|記事|出来事)(?:を|は)?(?:見て|見た|見ました|知った|知って|読んで)(?:にゃ|のだ|ですね|だなにゃ|だ|！|。|、|\s)*$', raw_text):
        return False, "「このニュース見たにゃ」等の中身のない空虚な感想が含まれています"

    # 11. 架空企業名・プレースホルダー（企業A、会社A、A社、X社等）の捏造ハルシネーション検知
    FICTITIOUS_PATTERNS = [
        re.compile(r'(?:企業|会社)[A-Za-z0-9]'),
        re.compile(r'(?<![A-Za-z0-9])[A-Za-z]社'),
        re.compile(r'(?:某社|某企業|〇〇社|XX社)'),
    ]
    for pat in FICTITIOUS_PATTERNS:
        m = pat.search(raw_text)
        if m:
            matched_str = m.group(0)
            if not article_context or matched_str not in article_context:
                return False, f"元記事に存在しない架空の企業名・プレースホルダーが捏造されています: '{matched_str}'"

    return True, ""


_SCRIPT_CACHE_LOCK = threading.Lock()
_NEWS_SCRIPT_CACHE = {}
_INFLIGHT_EVENTS = {}

def _save_to_news_history(title, payload, item_obj, article_url, items, headline_dict=None):
    """生成されたニュース台本（見出し＋本文の字幕・読み・VOICEVOX発音カナ）を日次台本ログへ自動記録"""
    try:
        from server.news_history_logger import log_news_script_item
        from server.voicevox_client import get_voicevox_reading_and_kana

        pub_date = payload.get('pubDate') or item_obj.get('pubDate', '')
        source_name = payload.get('source') or item_obj.get('source') or item_obj.get('publisher', '')
        # 🛡️ Yahooミラー記事で本文を取得している場合はソース名を「Yahoo!ニュース」に整合
        if article_url and "news.yahoo.co.jp" in article_url:
            if not source_name or "NHK" in source_name or "不明" in source_name:
                source_name = "Yahoo!ニュース"
        model_id = (payload.get('modelId', '') or '').lower()
        speaker_id = 3 if 'zunda' in model_id else 1

        # 見出し（タイトル）の表示・読み上げ・VOICEVOX実読み・アクセントカナを取得
        headline_disp = (headline_dict.get("display") if isinstance(headline_dict, dict) else "") or title
        headline_speech = (headline_dict.get("speech") if isinstance(headline_dict, dict) else "") or title
        title_vv_reading, title_vv_kana = get_voicevox_reading_and_kana(headline_speech or title, speaker_id=speaker_id)

        sentence_records = []
        for it in (items or []):
            disp = it.get("display", "")
            reading = it.get("speech", "")
            # VOICEVOX API を通した実際の読み・アクセントカナを取得
            vv_reading, vv_kana = get_voicevox_reading_and_kana(reading or disp, speaker_id=speaker_id)
            sentence_records.append({
                "display": disp,
                "reading": reading,
                "voicevox_reading": vv_reading,
                "voicevox_kana": vv_kana
            })

        log_news_script_item(
            title=title,
            pub_date=pub_date,
            source=source_name,
            url=article_url or "",
            sentences=sentence_records,
            full_display_text="\n".join([it.get("display", "") for it in (items or [])]),
            full_reading_text=" ".join([it.get("speech", "") for it in (items or [])]),
            title_reading=headline_speech,
            title_voicevox_reading=title_vv_reading,
            title_voicevox_kana=title_vv_kana,
            headline_display=headline_disp
        )
    except Exception as log_err:
        print(f"[台本ログ保存エラー]: {log_err}", flush=True)

def generate_news_item_script_data(payload, custom_dict=None):
    """
    ニュース1件分の原稿AI生成、ファクト照合、発音検証、見出し生成を一括処理して返す
    （同一記事タイトルのインフライト重複実行防止＆サーバーキャッシュ完備）
    """
    item_obj = payload.get('item') if isinstance(payload.get('item'), dict) else {}
    raw_title = payload.get('title') or item_obj.get('title', '')
    title = clean_news_title(raw_title)
    raw_desc = payload.get('description') or item_obj.get('description', '')
    description = clean_news_description(raw_desc)
    model_id = (payload.get('modelId', '') or '').lower()
    char_desc = payload.get('charDesc', '').strip()
    if not char_desc:
        if 'zunda' in model_id:
            char_desc = "明るく元気なずんだ妖精のニュースキャスター「ずんだもん」です。語尾は「〜のだ」「〜なのだ」を使います。"
        else:
            char_desc = "愛嬌のある白猫のニュースキャスター「とろろ」です。語尾には自然に「〜にゃ」「〜にゃ！」を使います。" 
    category_name = payload.get('categoryName', '').strip()
    transition = payload.get('transition', '').strip()
    article_url = (payload.get('url') or item_obj.get('link', '')).strip()
    provider = payload.get('provider', 'gemini')
    api_key = payload.get('apiKey', '')
    model_name = payload.get('model', '')

    # コメント返信やシステムタイトルはニュース記事ではないためURL検索・キャッシュ対象外とする
    is_special_item = category_name in ["コメント返信", "リスナーコメント"] or title.startswith("コメント返信") or title.startswith("【コメント")

    article_idx = payload.get('articleIndex')
    total_cnt = payload.get('totalArticles')
    idx_str = f"#{article_idx}/{total_cnt}" if (article_idx and total_cnt) else (f"#{article_idx}" if article_idx else "")
    short_title = title[:16] + "..." if len(title) > 16 else title
    tag = f"[ニュースAI {idx_str} {short_title}]" if idx_str else f"[ニュースAI {short_title}]"

    # 1. すでに生成完了済みのキャッシュが存在する場合は即時返却（Ollama重複呼び出しゼロ）
    cache_key = f"{model_id}_{provider}_{title}"
    if not is_special_item:
        with _SCRIPT_CACHE_LOCK:
            if cache_key in _NEWS_SCRIPT_CACHE:
                print(f"{tag} ⚡ サーバーキャッシュから即時返却 (重複処理を完全スキップ)", flush=True)
                return _NEWS_SCRIPT_CACHE[cache_key]

        # 2. 別スレッドで同一タイトルが現在生成中の場合、重複実行せず完了を待機して同じ結果を共有
        my_event = None
        with _SCRIPT_CACHE_LOCK:
            if cache_key in _INFLIGHT_EVENTS:
                in_event = _INFLIGHT_EVENTS[cache_key]
            else:
                my_event = threading.Event()
                _INFLIGHT_EVENTS[cache_key] = my_event
                in_event = None

        if in_event is not None:
            print(f"{tag} ⏳ 同一記事の生成が先行実行中のため待機し、結果を共有します...", flush=True)
            in_event.wait(timeout=60)
            with _SCRIPT_CACHE_LOCK:
                if cache_key in _NEWS_SCRIPT_CACHE:
                    return _NEWS_SCRIPT_CACHE[cache_key]

    print(f"{tag} 📥 原稿生成リクエスト受信 (AI: {provider}/{model_name or 'default'})", flush=True)

    if not is_special_item:
        if not article_url:
            article_url = find_cached_url(title)
        if not article_url:
            print(f"{tag} 🔍 記事URLを検索中...", flush=True)
            article_url = search_news_url_by_title(title)
        if article_url:
            register_cached_url(title, article_url)
            print(f"{tag} 🔗 記事URL特定: {article_url}", flush=True)

    full_article_content = description
    fetched_body = ""
    if article_url:
        # Google News の転送リンクであれば、まず配信元の正規URLにデコード
        if "news.google.com" in article_url:
            print(f"{tag} 🔓 Google News転送リンクを配信元URLにデコード中...", flush=True)
            decoded_url = decode_google_news_url(article_url)
            if decoded_url and "news.google.com" not in decoded_url:
                print(f"{tag} 🎯 配信元正規URLデコード成功: {decoded_url}", flush=True)
                article_url = decoded_url
                register_cached_url(title, decoded_url)

        print(f"{tag} 🌐 記事本文をスクレイピング取得中...", flush=True)
        fetched_body = fetch_article_body(article_url)
        # もし本文が取得できず、かつURLがGoogle News等の転送URLだった場合、Yahoo!ニュース等の正規URLで再探索
        if not fetched_body and "news.google.com" in article_url:
            print(f"{tag} 🔄 Google News転送リンクのため、Yahoo!ニュース等の正規URLを再検索中...", flush=True)
            direct_url = search_news_url_by_title(title)
            if direct_url and "news.google.com" not in direct_url:
                article_url = direct_url
                register_cached_url(title, direct_url)
                fetched_body = fetch_article_body(direct_url)
            else:
                print(f"{tag} 🛡️ 正規の同一記事が特定できないため、別記事混入を防止しRSS概要文のみを安全に活用します", flush=True)

        if fetched_body and len(fetched_body) > 30:
            if len(fetched_body) > 800:
                fetched_body = fetched_body[:800] + "…"
            full_article_content = f"{description}\n【元記事の詳細本文】: {fetched_body}"
            print(f"{tag} 📄 記事本文取得完了 ({len(fetched_body)}文字) ➔ プロンプト注入", flush=True)
        else:
            print(f"{tag} ℹ️ 本文取得スキップ (RSS概要を活用)", flush=True)

    # 著名スイーツ・洋菓子ブランド等の誤認（ナイトクラブ等との混同）防止補足
    if "クラブハリエ" in title and "洋菓子" not in full_article_content and "バームクーヘン" not in full_article_content:
        full_article_content += "\n【重要補足】『クラブハリエ』はバームクーヘン等の洋菓子・スイーツで全国的に有名な専門店です。夜のクラブやナイトクラブ・ディスコではありません。"

    # コメント返信や特殊アナウンスはニュース台本（5文構成）ではなく1〜2文の返答専用として直接生成
    if is_special_item:
        m_nick = re.search(r'コメント返信:\s*(.+?)さん', title)
        nickname = m_nick.group(1) if m_nick else "リスナー"
        m_c = re.search(r'[「『](.*?)[」』]', description)
        comment_text = m_c.group(1) if m_c else description.replace("さんのコメント", "").replace("に対して1〜2文で返信してください。", "").strip()

        prompt = (
            f"あなたは{char_desc}\n"
            f"リスナーの「{nickname}」さんから『{comment_text}』というコメントをいただきました。\n"
            "キャスターとして、このコメントに対して1〜2文で親しみやすく自然に返信してください（20〜40文字程度）。\n"
            "※自己紹介やシステムメッセージ、画面名などは含めず、コメントに対する親身な返答セリフのみを出力してください。"
        )

        candidate_text = call_llm_backend(provider, prompt, api_key, model_name)
        clean_text = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', candidate_text or '').strip()
        clean_text = clean_text.replace("「", "").replace("」", "").strip()

        # システム定型文や画面遷移文の誤出力ガード
        if any(bad in clean_text for bad in ["画面へ移動", "Virtual Studio", "Live2D Virtual", "VStudio -"]):
            clean_text = f"{nickname}さん、コメントありがとうございますにゃ！"
        
        split_s = split_sentences_safely(clean_text)
        if not split_s:
            split_s = [clean_text] if clean_text else [f"{nickname}さん、コメントありがとうございますにゃ！"]
        
        items = []
        for s in split_s[:2]:
            disp = sanitize_speech_text(s)
            items.append({
                "display": disp,
                "speech": normalize_for_tts(disp, custom_dict=custom_dict)
            })
        total_speech_chars = sum(len(it.get('speech', '')) for it in items)
        print(f"{tag} ✅ コメント返信生成完了！ (計 {len(items)}文, {total_speech_chars}文字)", flush=True)
        return {
            "status": "ok",
            "url": "",
            "headline": { "display": title, "speech": title },
            "headline_speech": title,
            "fullText": " ".join([it["display"] for it in items]),
            "items": items,
            "sentences": [it["display"] for it in items]
        }

    # 🛡️ 本文が完全に欠落している場合（40文字未満かつ詳細本文なし）は、LLM妄想創作を物理的に遮断して安全フォールバックへ直行
    has_valid_body = (fetched_body and len(fetched_body) >= 30) or (full_article_content and len(full_article_content) >= 50)
    if not has_valid_body:
        print(f"{tag} 🛡️ 記事本文がスクレイピングできないため、ハルシネーションを防止し安全な定型原稿を自動構築します", flush=True)
        items = build_safe_fallback_sentences(title, full_article_content, char_desc, custom_dict=custom_dict)
        raw_text = "\n".join([it["display"] for it in items])
        headline_dict = {"display": title, "speech": title}
        if not is_special_item:
            _save_to_news_history(title, payload, item_obj, article_url, items, headline_dict=headline_dict)
        return {
            "status": "ok",
            "url": article_url or "",
            "headline": headline_dict,
            "headline_speech": title,
            "fullText": " ".join([it["display"] for it in items]),
            "items": items,
            "sentences": [it["display"] for it in items]
        }

    prompt = build_news_prompt(char_desc, title, full_article_content)
    raw_text = None
    items = None
    ai_headline_raw = None
    best_candidate_text = ""
    best_candidate_items = []
    news_context_map = {}
    attempt = 0

    while True:
        attempt += 1
        cur_prompt = prompt
        if attempt > 1:
            suffix_instruction = "語尾には必ず『にゃ』『にゃ！』を付けて発話してください。" if "にゃ" in char_desc else ("語尾には必ず『なのだ』『のだ』を付けて発話してください。" if "なのだ" in char_desc else "")
            cur_prompt += f"\n\n【重要・品質修正指示（再生成 試行{attempt}回目）】直前の生成で品質基準の不備が検知されたため再生成します。必ず「{title}」の事件・出来事についてのみ解説してください。見出しをそのまま繰り返さず、記事本文の具体的な詳細から解説を始めてください。必ず【前半: 記事要約2〜3文】＋【後半: あなた自身の感想2〜3文】の【合計4〜6文】で作成してください。{suffix_instruction}"
            print(f"{tag} 🔄 [試行 {attempt}] ダブルチェック再生成を実行中...", flush=True)
        else:
            print(f"{tag} 🤖 [試行 1] LLMへ原稿生成リクエスト送信中...", flush=True)

        candidate_text = call_llm_backend(provider, cur_prompt, api_key, model_name)
        if not candidate_text:
            print(f"{tag} ⚠️ [試行 {attempt}] LLM応答なし ➔ 再試行します", flush=True)
            if attempt >= 3:
                print(f"{tag} 🛡️ 最大試行回数(3回)に達してもLLM応答が得られないため、元記事から安全な原稿を自動構築します", flush=True)
                items = build_safe_fallback_sentences(title, full_article_content, char_desc, custom_dict=custom_dict)
                raw_text = "\n".join([it["display"] for it in items])
                break
            time.sleep(2)
            continue

        print(f"{tag} 📩 [試行 {attempt}] LLM応答受信 ({len(candidate_text)}文字) ➔ 発音・ファクト照合中...", flush=True)

        best_candidate_text = candidate_text

        # パース・重複除去・発音検証を通して items を作成
        clean_text = candidate_text
        clean_text = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', clean_text, flags=re.MULTILINE).strip()

        headline_match = re.search(r'(?:\[(?:HEADLINE|見出し):\s*|【(?:ニュース)?見出し】[\s:：]*|見出し[\s:：]+)(.*?)(?:\]|\n|$)', candidate_text)
        if headline_match:
            ai_headline_raw = headline_match.group(1).strip()
            ai_headline_raw = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', ai_headline_raw).strip()
            # 🛡️ 見出しにはキャラクター語尾（にゃ、のだ等）を絶対に付けない（客観的な報道タイトルのため完全切除）
            ai_headline_raw = re.sub(r'(?:です|だ|だった|された|した|ある|いる|なる|こと)?[\s　]*(?:とろろ)?(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', ai_headline_raw).strip()
            ai_headline_raw = re.sub(r'[\s　]*(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', ai_headline_raw).strip()
            clean_text = re.sub(r'(?:\[(?:HEADLINE|見出し):\s*|【(?:ニュース)?見出し】[\s:：]*|見出し[\s:：]+).*?(?:\]|\n|$)', '', clean_text).strip()

        # ✂️ 【記事本文】【要約】【解説台本】【感想】等のセクションタグ行・見出し行を一括完全消去
        clean_text = re.sub(r'(?:\[(?:HEADLINE|見出し|記事本文|本文|要約|解説|感想):\s*|【(?:ニュース)?(?:見出し|記事本文|本文|要約|解説台本|解説|感想|リアクション)?(?:の見出し)?】[\s:：]*|(?:記事本文|ニュース本文|記事の見出し|記事要約|解説台本|解説|感想)[\s:：]+).*?(?:\]|\n|$)', '', clean_text).strip()

        clean_text = clean_text.replace("「", "").replace("」", "").strip()
        # 不自然な名乗り・導入語尾を正規化（「とろろとしては」「ずんだもんとしては」等の不要な自称・前置きを完全に除去）
        clean_text = re.sub(r'(?:この(?:ニュース|話題|記事|出来事)を?(?:受けた|に対する))?(?:とろろ|トロロ|ずんだもん|ズンダモン)としては[、,\s　]*', '', clean_text)
        clean_text = re.sub(r'(?:^|(?<=[。！？\s「（]))(?:とろろ|トロロ|ずんだもん|ズンダモン)(?:としては|にゃ|はにゃ|なのだ|のだ|はなのだ|はのだ)[、,\s　]*', '', clean_text)
        clean_text = re.sub(r'^[、,\s　]+', '', clean_text)
        clean_text = re.sub(r'この(?:ニュース|話題|記事|出来事)(?:を|は)?(?:見て|聞いて|知って|読んで)[、,\s　]*本当に便利(?:だにゃ|ですね|だなにゃ|だ)', 'この取り組み、本当に便利だにゃ', clean_text)
        clean_text = re.sub(r'この(?:ニュース|話題|記事|出来事)(?:を|は)?(?:見て|見た|見ました|聞いて|知って|知った|読んで)[、,\s　]*(?:にゃ|のだ|ですね|だなにゃ|だ|！|。|、|\s)*', '', clean_text)
        clean_text = re.sub(r'この(?:ニュース|話題|記事|出来事)[、,\s　]+(?=[ぁ-んァ-ヶ一-鿿])', '', clean_text)
        # 語尾の二重化や不自然な重ねの事前サニタイズ
        clean_text = re.sub(r'だよですね([！!？?。、\s　]|$)', r'ですね\1', clean_text)
        clean_text = re.sub(r'だねですね([！!？?。、\s　]|$)', r'ですね\1', clean_text)
        clean_text = re.sub(r'よねですね([！!？?。、\s　]|$)', r'ですよね\1', clean_text)
        clean_text = re.sub(r'よですね([！!？?。、\s　]|$)', r'ですね\1', clean_text)
        clean_text = re.sub(r'ねですね([！!？?。、\s　]|$)', r'ですね\1', clean_text)
        clean_text = re.sub(r'だよねにゃ([！!？?。、\s　]|$)', r'だよね\1', clean_text)
        clean_text = re.sub(r'ですよねにゃ([！!？?。、\s　]|$)', r'ですよね\1', clean_text)
        clean_text = re.sub(r'かもしれませんねにゃ([！\s　。！？]|$)', r'かもしれませんね\1', clean_text)
        clean_text = re.sub(r'ですねにゃ([！\s　。！？]|$)', r'ですね\1', clean_text)
        clean_text = re.sub(r'ますねにゃ([！\s　。！？]|$)', r'ますね\1', clean_text)
        clean_text = re.sub(r'でしたにゃ([！\s　。！？]|$)', r'でした\1', clean_text)
        clean_text = re.sub(r'ませんにゃ([！\s　。！？]|$)', r'ません\1', clean_text)
        clean_text = re.sub(r'にゃね([！\s　。！？]|$)', r'ですね\1', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)ねにゃ([！\s　。！？]|$)', r'\1ですね\2', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)ねのだ([！\s　。！？]|$)', r'\1なのだ\2', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)かなにゃ([！\s　。！？]|$)', r'\1かにゃ\2', clean_text)
        clean_text = clean_text.replace("使えへん", "使えない").replace("出来へん", "出来ない").replace("分からへん", "分からない").replace("知らへん", "知らない")
        clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)へん([の|ね|よ|な|にゃ|！|？|。|、]|$)', r'\1ない\2', clean_text)

        # 方言（関西弁）・役割語の標準語化（「〜やろ」「〜んやろ」「じゃが」等の自動補正）
        clean_text = re.sub(r'(?:^|(?<=[。、！？\s　]))じゃが(?!いも|バター|りこ)[、,\s　]*', 'だが、', clean_text)
        clean_text = re.sub(r'なんじゃが(?!いも|バター|りこ)', 'なんだが', clean_text)
        clean_text = re.sub(r'んじゃが(?!いも|バター|りこ)', 'んだが', clean_text)
        clean_text = re.sub(r'(?<![ぁ-んァ-ヶー一-鿿])じゃが(?!いも|バター|りこ)', 'だが', clean_text)
        clean_text = re.sub(r'んやろにゃ([！!？?。、\s　]|$)', r'んだろうにゃ\1', clean_text)
        clean_text = re.sub(r'やろにゃ([！!？?。、\s　]|$)', r'だろうにゃ\1', clean_text)
        clean_text = re.sub(r'んやろのだ([！!？?。、\s　]|$)', r'んだろうのだ\1', clean_text)
        clean_text = re.sub(r'やろのだ([！!？?。、\s　]|$)', r'だろうのだ\1', clean_text)
        clean_text = re.sub(r'んやろ([か？\?！!。、\s　]|な|ね|$)', r'んだろう\1', clean_text)
        clean_text = re.sub(r'やろ([か？\?！!。、\s　]|な|ね|$)', r'だろう\1', clean_text)
        clean_text = re.sub(r'んやな([！!？?。、\s　]|$)', r'んだな\1', clean_text)
        clean_text = re.sub(r'やな([！!？?。、\s　]|$)', r'だな\1', clean_text)
        clean_text = re.sub(r'んやね([！!？?。、\s　]|$)', r'んだね\1', clean_text)
        clean_text = re.sub(r'やね([！!？?。、\s　]|$)', r'だね\1', clean_text)
        clean_text = re.sub(r'ねんにゃ([！!？?。、\s　]|$)', r'んだにゃ\1', clean_text)
        clean_text = re.sub(r'ねんのだ([！!？?。、\s　]|$)', r'んだのだ\1', clean_text)
        clean_text = re.sub(r'のじゃ([！!？?。、\s　]|$)', r'のだ\1', clean_text)
        clean_text = re.sub(r'なんじゃ([！!？?。、\s　]|$)', r'なんだ\1', clean_text)
        clean_text = re.sub(r'んじゃ([！!？?。、\s　]|$)', r'んだ\1', clean_text)

        # 🐱 【キャラクター口調・語尾接続の包括的自然化（しにゃ・れにゃ・だにゃ・るにゃ等の完全自動修復）】
        # 1. 連用形＋にゃ ➔ 過去形「〜たにゃ」への修復（「しにゃ」「れにゃ」「されにゃ」「られにゃ」等）
        clean_text = re.sub(r'されにゃ([！!？?。、\s　]|$)', r'されたにゃ\1', clean_text)
        clean_text = re.sub(r'されのだ([！!？?。、\s　]|$)', r'されたのだ\1', clean_text)
        clean_text = re.sub(r'られにゃ([！!？?。、\s　]|$)', r'られたにゃ\1', clean_text)
        clean_text = re.sub(r'られのだ([！!？?。、\s　]|$)', r'られたのだ\1', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)しにゃ([！!？?。、\s　]|$)', r'\1したにゃ\2', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)しのだ([！!？?。、\s　]|$)', r'\1したのだ\2', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)れにゃ([！!？?。、\s　]|$)', r'\1れたにゃ\2', clean_text)
        clean_text = re.sub(r'(?<!どんな)(?<!いい)(?<!良い)(?<!って)(?<!いう)(?<!な)感じにゃ([！!？?。、\s　]|$)', r'感じたにゃ\1', clean_text)
        clean_text = re.sub(r'(?<!どんな)(?<!いい)(?<!良い)(?<!って)(?<!いう)(?<!な)感じのだ([！!？?。、\s　]|$)', r'感じたのだ\1', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+[報信応演生命論禁])じにゃ([！!？?。、\s　]|$)', r'\1じたにゃ\2', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+[報信応演生命論禁])じのだ([！!？?。、\s　]|$)', r'\1じたのだ\2', clean_text)

        # 2. 「だにゃ」「だなにゃ」➔「なんだにゃ」への自然化（大変だにゃ ➔ 大変なんだにゃ、大切だにゃ ➔ 大切なんだにゃ）
        # ※直前が「ん」「な」「の」の場合は多重化（んなんだにゃ/なんなんだにゃ/のなんだにゃ）を防ぐため除外
        clean_text = re.sub(r'(?<![んなの])([一-鿿ぁ-んァ-ヶ]{2,})だにゃ([！!？?。、\s　]|$)', r'\1なんだにゃ\2', clean_text)
        clean_text = re.sub(r'([一-鿿ぁ-んァ-ヶ]{2,})だなにゃ([！!？?。、\s　]|$)', r'\1なんだにゃ\2', clean_text)
        clean_text = re.sub(r'([一-鿿ぁ-んァ-ヶ]{2,})だよにゃ([！!？?。、\s　]|$)', r'\1なんだよね\2', clean_text)
        clean_text = re.sub(r'だなにゃ([！!？?。、\s　]|$)', r'なんだにゃ\1', clean_text)
        clean_text = re.sub(r'だなのだ([！!？?。、\s　]|$)', r'なのだ\1', clean_text)
        clean_text = re.sub(r'だよにゃ([！!？?。、\s　]|$)', r'なんだよね\1', clean_text)
        clean_text = re.sub(r'だねにゃ([！!？?。、\s　]|$)', r'ですね\1', clean_text)

        # 畳語・多重化の完全解消（のなんだにゃ ➔ んだにゃ、なんなんだにゃ ➔ なんだにゃ、感じるんなんだにゃ ➔ 感じるんだにゃ）
        clean_text = re.sub(r'の+なんだにゃ([！!？?。、\s　]|$)', r'んだにゃ\1', clean_text)
        clean_text = re.sub(r'の+なのだ([！!？?。、\s　]|$)', r'のだ\1', clean_text)
        clean_text = re.sub(r'な+んなんだにゃ([！!？?。、\s　]|$)', r'なんだにゃ\1', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿])んなんだにゃ([！!？?。、\s　]|$)', r'\1んだにゃ\2', clean_text)
        clean_text = re.sub(r'ん+んだにゃ([！!？?。、\s　]|$)', r'んだにゃ\1', clean_text)
        clean_text = re.sub(r'ん+んだのだ([！!？?。、\s　]|$)', r'んだのだ\1', clean_text)

        # 3. 「〜るにゃ」「〜すにゃ」の硬い文語体 ➔ 自然な会話口調へ補正
        clean_text = re.sub(r'となるにゃ([！!？?。、\s　]|$)', r'となりそうだにゃ\1', clean_text)
        clean_text = re.sub(r'を与えるにゃ([！!？?。、\s　]|$)', r'を与えそうだにゃ\1', clean_text)
        clean_text = re.sub(r'進められるにゃ([！!？?。、\s　]|$)', r'進められそうだにゃ\1', clean_text)
        clean_text = re.sub(r'注目されるにゃ([！!？?。、\s　]|$)', r'注目が集まるにゃ\1', clean_text)
        clean_text = re.sub(r'示唆するにゃ([！!？?。、\s　]|$)', r'示唆しているにゃ\1', clean_text)
        clean_text = re.sub(r'願うにゃ([！!？?。、\s　]|$)', r'願いたいところだにゃ\1', clean_text)
        clean_text = re.sub(r'目指すにゃ([！!？?。、\s　]|$)', r'目指しているにゃ\1', clean_text)
        clean_text = re.sub(r'予想されるにゃ([！!？?。、\s　]|$)', r'予想されているにゃ\1', clean_text)
        clean_text = re.sub(r'考えられるにゃ([！!？?。、\s　]|$)', r'考えられているにゃ\1', clean_text)
        clean_text = re.sub(r'期待されるにゃ([！!？?。、\s　]|$)', r'期待されているにゃ\1', clean_text)
        clean_text = re.sub(r'見られるにゃ([！!？?。、\s　]|$)', r'見られているにゃ\1', clean_text)

        # 4. 「ましょにゃ」「にゃ！ にゃ！」などの破綻のクリーンアップ
        clean_text = re.sub(r'いきましょにゃ([！!？?。、\s　]|$)', r'いきましょうにゃ\1', clean_text)
        clean_text = re.sub(r'(?:にゃ[！!？?\s　]*){2,}', 'にゃ！', clean_text)

        # 5. 破損語尾・崩れた文末（「みんないゃにゃ」「てみんないゃにゃ」等）の自然化
        clean_text = re.sub(r'てみんないゃにゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', clean_text)
        clean_text = re.sub(r'みんないゃにゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', clean_text)
        clean_text = re.sub(r'てみんないゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', clean_text)
        clean_text = re.sub(r'みんないゃ([！!？?。、\s　]|$)', r'てみてほしいにゃ\1', clean_text)
        clean_text = re.sub(r'い+ゃにゃ([！!？?。、\s　]|$)', r'いにゃ\1', clean_text)
        clean_text = re.sub(r'ない+ゃにゃ([！!？?。、\s　]|$)', r'ないにゃ\1', clean_text)
        clean_text = re.sub(r'ない+ゃ([！!？?。、\s　]|$)', r'ないにゃ\1', clean_text)

        # 不自然な英単語動詞・形容詞の混入を自然な日本語へ自動補正（strengthening ➔ 上昇・強含み 等）
        ENGLISH_FINANCIAL_REPLACEMENTS = [
            (r'\bstrengthening\b', '上昇'),
            (r'\bweakening\b', '下落'),
            (r'\brally(?:ing)?\b', '反発'),
            (r'\bsurg(?:e|ing)\b', '急上昇'),
            (r'\bdrop(?:ping)?\b', '下落'),
            (r'\bloss(?:es)?\b', '損失'),
            (r'\bgain(?:s|ing)?\b', '上昇'),
            (r'\brising\b', '上昇'),
            (r'\bfalling\b', '下落'),
            (r'\bdeclin(?:e|ing)\b', '下落'),
            (r'\bgrowth\b', '成長'),
            (r'\bhigh(?:er)?\b', '高値'),
            (r'\blow(?:er)?\b', '安値'),
        ]
        for eng_pat, jpn_rep in ENGLISH_FINANCIAL_REPLACEMENTS:
            clean_text = re.sub(eng_pat, jpn_rep, clean_text, flags=re.IGNORECASE)

        # 5. 方言（西日本・九州等の「〜とった」「〜とる」）の標準語自動正規化
        clean_text = re.sub(r'なっとった', 'なっていた', clean_text)
        clean_text = re.sub(r'なっとる', 'なっている', clean_text)
        clean_text = re.sub(r'しとった', 'していた', clean_text)
        clean_text = re.sub(r'しとる', 'している', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)とった([！!？?。、\s　]|$)', r'\1ていた\2', clean_text)
        clean_text = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)とる([！!？?。、\s　]|$)', r'\1ている\2', clean_text)
        clean_text = re.sub(r'やろにゃ([！!？?。、\s　]|$)', r'だろうにゃ\1', clean_text)
        clean_text = re.sub(r'ねんにゃ([！!？?。、\s　]|$)', r'なんだにゃ\1', clean_text)

        # 6. 馴れ馴れしい雑談調の語頭フレーズ（最近ね、あのね、等）の除去
        clean_text = re.sub(r'(?:^|[。！？\n])[\s　]*(?:最近ね[、,\s]*|あのね[、,\s]*|ねえねえ[、,\s]*|ちょっと聞いて[、,\s]*)', '', clean_text)

        # 7. 個別記事末尾の番組終了挨拶（クロージング誤爆: ではまたにゃ！、またにゃ！、それではまた次回！等）の完全除去
        FAREWELL_REMOVAL_PATTERN = (
            r'[\s　]*(?:それでは|では|じゃあ|それじゃあ)?[、,\s]*'
            r'(?:また(?:次回)?(?:お会いしましょう|お会いできるのを楽しみに|今度|ですね)?'
            r'|また(?:ね|な|よ|ですね)?'
            r'|次回も?お楽しみに'
            r'|さようなら|バイバイ|ばいばい|ばい)'
            r'(?:にゃ|のだ|なのだ|ね|よ)?[！!。、\s]*$'
        )
        clean_text = re.sub(FAREWELL_REMOVAL_PATTERN, '', clean_text, flags=re.IGNORECASE)

        # 8. 被写体人物への唐突な直接挨拶（武田さん、お疲れ様にゃ！等）の除去
        DIRECT_GREETING_PATTERN = (
            r'(?:^|(?<=[。！？\s　]))[A-Za-z0-9\u4e00-\u9fffぁ-んァ-ヶ]+(?:さん|様|氏|選手)[、,\s]*'
            r'(?:お疲れ様|おつかれさま|おつかれ|ご苦労様|こんにちは|おはよう|こんばんは|いつもありがとう)'
            r'[！!。、\s]*(?:でした|です|にゃ|のだ|なのだ)?[！!。、\s]*'
        )
        clean_text = re.sub(DIRECT_GREETING_PATTERN, '', clean_text)

        # 9. 実在の著名人・芸能人・人物に対する呼び捨ての敬称（〜さん）自動補正
        clean_text = normalize_celebrity_honorifics(clean_text, title, full_article_content)

        # 10. キャラクター口調（にゃ／なのだ）の救済（LLMが客観調で出力した場合でも後半感想を自動補正）
        clean_text = salvage_character_tone(clean_text, char_desc)

        split_sentences = split_sentences_safely(clean_text)
        # 末尾の文が番組終了挨拶単独の場合の安全除去（またにゃ！、ではまたにゃ！、バイバイにゃ！等）
        if split_sentences:
            last_s = split_sentences[-1]
            if re.search(r'^(?:それでは|では|じゃあ|それじゃあ)?[、,\s]*(?:また(?:次回)?(?:お会いしましょう|お会いできるのを楽しみに|今度|ですね)?|また(?:ね|な|よ|ですね)?|次回も?お楽しみに|さようなら|バイバイ|ばいばい|ばい)(?:にゃ|のだ|なのだ|ね|よ)?[！!。、\s]*$', last_s, flags=re.IGNORECASE):
                print(f"{tag} ✂️ 個別記事末尾の不自然な終了挨拶（誤爆）を除去: '{last_s}'", flush=True)
                split_sentences.pop()

        def is_transition_phrase(txt):
            cleaned = re.sub(r'[。！？\!\? \s　、]+', '', txt)
            keywords = [
                "次のニュースですにゃ", "次のニュースにゃ", "次のニュースです", "次のニュースなのだ", "次のニュース",
                "続いてのニュースですにゃ", "続いてのニュースにゃ", "続いてのニュースです", "続いてのニュースなのだ", "続いてのニュース",
                "最初のニュースですにゃ", "最初のニュースにゃ", "最初のニュースです", "最初のニュースなのだ", "最初のニュース",
                "次の話題ですにゃ", "次の話題にゃ", "次の話題です", "次の話題なのだ", "次の話題",
                "続いては", "次の記事です", "次の記事にゃ", "続いての記事です", "続いての話題"
            ]
            return any(cleaned == kw or cleaned.startswith(kw) for kw in keywords) or (category_name and f"{category_name}のニュース" in cleaned)

        def is_ai_meta_sentence(s):
            cleaned = s.strip()
            if re.search(r'^(了解しました|承知いたしました|承知しました|かしこまりました|以下に|注[：:])', cleaned):
                return True
            if re.search(r'(ルールに従|ルールに基づ|皇族のお名前|ルビを付けないで|キャスター感想の表現|報道倫理ルール|出力形式のルール|深掘り解説台本|指定されたルール|品質修正指示|ダブルチェック)', cleaned):
                return True
            # プロンプトの禁止文句復唱の撃墜
            if re.search(r'(別の話題へのすり替え|話題のすり替え|すり替えは厳禁)', cleaned):
                return True
            # ✂️ セクション見出し・構成ラベル・プロンプト項目名の漏れ出しを完全除去（「記事本文の見出し」「記事要約」「1文目」等）
            if re.search(r'^(?:[【\[「(（]?)?(?:記事本文|ニュース本文|本文|見出し|記事要約|要約|解説台本|解説|感想|リアクション|前半|後半|[1-6１-６一二三四五六]文目?)(?:の見出し|の要約|の解説|の感想)?(?:[】\]」)）:：\s　]|にゃ|のだ|です|した|$)', cleaned):
                return True
            if re.search(r'^(?:記事本文|ニュース本文|記事要約|解説台本|前半の要約|後半の感想)', cleaned):
                return True
            # 「〜の見出したにゃ」「〜の見出しにゃ」「〜の見出しです」等のメタ行語尾崩れを完全撃墜
            if re.search(r'見出し(?:たにゃ|にゃ|なのだ|のだ|です|でした|。[！!？?。、\s　]*$)', cleaned):
                return True
            return False

        def is_incomplete_sentence_fragment(s):
            """
            文として完結しておらず、途中でブツッと切れた不完全な文片（fragment）を検知
            例: '発売日が', '生活も。', 'FGTが常磁。', '現地で撮。', '本千葉カントリークラブ。' 等
            """
            if not s:
                return True
            cleaned = re.sub(r'^[・\-*■◆★【】〈〉\[\]「」『』\s　0-9０-９]+', '', s).strip()
            if not cleaned or len(cleaned) <= 1:
                return True

            # 句点・感嘆符・疑問符を一旦取り除いた末尾を調査
            stripped = re.sub(r'[。！？\!\?」』）\)\s　]+$', '', cleaned)
            if not stripped or len(stripped) <= 1:
                return True

            # 1. 末尾が格助詞・接続助詞・読点で終わっている場合は明らかに文の途中（句点の有無問わず）
            # 例: 「教師たちの生活も」「発売日が」「今後は」「〜という結果に」など
            PARTICLE_ENDINGS = r'(?:[がはをにとのとでもからへよりまたそして、,，]|けど|ので|って|とか|など|といった|として|による|により|に対する)$'
            if re.search(PARTICLE_ENDINGS, stripped) or re.search(r'(\.{2,}|…+)$', stripped):
                return True

            # 2. 文末に述語・用言・終止形・口調（にゃ、のだ、です、ます、だ、た、る、い、よ、ね等）がない未完結・体言止め文
            # 例: 「〜現地で撮」「〜FGTが常磁」「千葉市緑区の本千葉カントリークラブ」など
            VALID_PREDICATE_ENDINGS = (
                r'(?:にゃ|のだ|なのだ|です|ます|でした|ました|ません|'
                r'した|された|られた|なった|行った|言った|見た|あった|いた|勝った|負けた|'
                r'ある|いる|ない|たい|だ|た|る|い|う|く|つ|ぬ|ふ|む|ゆ|'
                r'ね|よ|わ|よな|よね|かな|かい|ぞ|ぜ|さ|しょう|う！|る！|にゃ！|のだ！)$'
            )
            if not re.search(VALID_PREDICATE_ENDINGS, stripped):
                return True

            return False

        deduped_sentences = []
        seen_transition = False
        for s in split_sentences:
            if is_ai_meta_sentence(s):
                print(f"{tag} ✂️ AIメタ行・指示文復唱を除去: '{s}'", flush=True)
                continue

            if is_incomplete_sentence_fragment(s):
                print(f"{tag} ✂️ 途中で切れた不完全な文片を除去: '{s}'", flush=True)
                continue

            if is_transition_phrase(s):
                if seen_transition:
                    continue
                seen_transition = True
                deduped_sentences.append(s)
                continue
            
            if is_title_duplicate_sentence(s, title):
                print(f"{tag} ✂️ タイトル重複文を除去: '{s}'", flush=True)
                continue

            if deduped_sentences and s == deduped_sentences[-1]:
                continue

            # 正常な文で末尾に句点（。）がない場合は補完して自然な音声終端を保証
            s_clean = s.strip()
            if not re.search(r'[。！？\!\?」』）\)]\s*$', s_clean):
                s_clean = s_clean + "。"
            deduped_sentences.append(s_clean)

        raw_sentences = deduped_sentences if deduped_sentences else split_sentences

        # 🧠 元記事タイトル ＋ 元記事本文 ＋ AI生成台本全文 を統合して記事全体文脈読みマップを一括構築
        full_context_text = f"{title}\n{full_article_content}\n{clean_text}"
        news_context_map = build_context_pronunciation_map(full_context_text, custom_dict=custom_dict)

        candidate_items = inspect_and_correct_pronunciation(
            raw_sentences,
            full_article_content + " " + title,
            custom_dict=custom_dict,
            context_map=news_context_map
        )
        candidate_items = audit_and_heal_news_script(candidate_items, title=title, article_context=full_article_content)

        # 粗チェック（品質・トピック整合性・ファクト照合・キャラクター感想の有無）
        is_valid, reason = validate_news_script_quality(clean_text, title, full_article_content, char_desc)
        if not is_valid:
            print(f"{tag} ⚠️ [試行 {attempt}] 出力を不自然と判定 (理由: {reason})", flush=True)
            if attempt >= 3:
                print(f"{tag} 🛡️ 最大試行回数(3回)に達しましたが原稿が不合格(理由: {reason})のため、幻覚原稿を全破棄し元記事から安全な原稿を自動構築します", flush=True)
                items = build_safe_fallback_sentences(title, full_article_content, char_desc, custom_dict=custom_dict)
                raw_text = "\n".join([it["display"] for it in items])
                break
            time.sleep(1)
            continue

        # 7文以上生成された場合は、要約3文 + 感想2〜3文（最大6文）にスマートに制限
        if len(candidate_items) > 6:
            candidate_items = candidate_items[:3] + candidate_items[-3:]
            if len(candidate_items) > 6:
                candidate_items = candidate_items[:6]

        total_chars = sum(len(it["display"]) for it in candidate_items)
        if len(candidate_items) < 3 or total_chars < 100 or (len(candidate_items) < 4 and total_chars < 150):
            reason = f"フィルター適用後の文数・文字数不足 ({len(candidate_items)}文, {total_chars}文字)"
            print(f"{tag} ⚠️ [試行 {attempt}] 原稿不足 (理由: {reason})", flush=True)
            if attempt >= 3:
                print(f"{tag} 🛡️ 最大試行回数(3回)に達しましたが原稿不足(理由: {reason})のため、元記事から安全な原稿を自動構築します", flush=True)
                items = build_safe_fallback_sentences(title, full_article_content, char_desc, custom_dict=custom_dict)
                raw_text = "\n".join([it["display"] for it in items])
                break
            time.sleep(1)
            continue

        # 5文以上かつ品質・トピック整合性合格！
        items = candidate_items
        raw_text = candidate_text
        if attempt > 1:
            print(f"{tag} ✅ 試行 {attempt} 回目で高品質な深掘り原稿が生成されました！（{len(items)}文, {total_chars}文字）", flush=True)
        break

    if not items:
        items = []

    # 見出しが元記事タイトルと一致しているかを厳密検証（トピック乖離・別記事見出しの混入・勝手な途中省略の防止）
    use_ai_headline = False
    if ai_headline_raw:
        clean_ai = re.sub(r'[（\(][ぁ-んァ-ヶー\s]+[）\)]', '', ai_headline_raw)
        clean_ai = re.sub(r'[★【】〈〉\[\]「」『』\s　、。！？!?,.\-ー…]+', '', clean_ai)
        clean_orig = re.sub(r'[★【】〈〉\[\]「」『』\s　、。！？!?,.\-ー…]+', '', title)

        # ⚠️ 勝手な省略（文字数が元タイトルの75%未満）は完全却下
        if len(clean_orig) >= 10 and len(clean_ai) / len(clean_orig) < 0.75:
            print(f"{tag} ⚠️ AI見出しが元タイトルを大幅省略・切り捨てしているため却下 ({len(clean_ai)}文字 < 元タイトル{len(clean_orig)}文字の75%) ➔ 元タイトル全文から音声を生成", flush=True)
            use_ai_headline = False
        else:
            title_tokens = re.findall(r'[\u4e00-\u9fff]{2,}|[\u30a0-\u30ff]{2,}', clean_orig)
            if not title_tokens and len(clean_orig) >= 2:
                title_tokens = [clean_orig[:4]]

            matched_tokens = [tok for tok in title_tokens if tok in clean_ai]
            # トークン網羅率チェック（元タイトルの主要キーワードの半分以上が含まれているか）
            token_ratio = (len(matched_tokens) / len(title_tokens)) if title_tokens else 1.0
            if token_ratio >= 0.50:
                use_ai_headline = True
            else:
                print(f"{tag} 🚫 見出しの重要語欠落・トピック乖離を検知 ('{ai_headline_raw}' 一致率: {token_ratio:.2f}) ➔ 幻覚原稿を全破棄し元記事から安全な原稿を自動再構築", flush=True)
                use_ai_headline = False
                # 🛡️ 本文（items）も幻覚であるため全破棄し、元記事タイトル・本文から安全な要約を生成
                items = build_safe_fallback_sentences(title, full_article_content, char_desc, custom_dict=custom_dict)

    if use_ai_headline and ai_headline_raw:
        headline_display = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', ai_headline_raw)
        headline_display = headline_display.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        if not re.search(r'[\u4e00-\u9fff\u30a0-\u30ffA-Za-z]', headline_display) or len(headline_display) < 3:
            headline_display = title.replace("「", "").replace("」", "").strip()
        headline_speech = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', ai_headline_raw)
        headline_speech = normalize_for_tts(headline_speech, custom_dict=custom_dict, context_map=news_context_map)
        headline_speech = re.sub(r'^[、,\s　]+', '', headline_speech)
        headline_speech = re.sub(r'[、,\s　]+$', '', headline_speech)

        # 🛡️ 見出しにはキャラクター語尾（にゃ、のだ等）を絶対に付けない（客観的見出しのため完全切除）
        headline_display = re.sub(r'(?:です|だ|だった|された|した|ある|いる|なる|こと)?[\s　]*(?:とろろ)?(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', headline_display).strip()
        headline_display = re.sub(r'[\s　]*(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', headline_display).strip()
        headline_speech = re.sub(r'(?:です|だ|だった|された|した|ある|いる|なる|こと)?[\s　]*(?:とろろ)?(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', headline_speech).strip()
        headline_speech = re.sub(r'[\s　]*(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', headline_speech).strip()

        print(f"{tag} 🗣️ 文脈校正見出し生成成功: 表示='{headline_display}' / 発音='{headline_speech}'", flush=True)
    else:
        # 元タイトル全文を一文字も省略せずに文脈読みを付与してTTS音声化
        headline_display = title.replace("「", "").replace("」", "").strip()
        headline_speech = normalize_for_tts(headline_display, custom_dict=custom_dict, context_map=news_context_map)
        headline_speech = re.sub(r'^[、,\s　]+', '', headline_speech)
        headline_speech = re.sub(r'[、,\s　]+$', '', headline_speech)
        print(f"{tag} 🗣️ 元タイトル全文から文脈読み生成 (省略ゼロ): 発音='{headline_speech}'", flush=True)

    total_speech_chars = sum(len(it.get('speech', '')) for it in (items or []))
    print(f"{tag} ✅ 原稿生成完了！ (計 {len(items or [])}文, {total_speech_chars}文字)", flush=True)

    result_data = {
        "status": "ok",
        "url": article_url or "",
        "headline": {
            "display": headline_display,
            "speech": headline_speech
        },
        "headline_speech": headline_speech,
        "items": items,
        "sentences": [it["display"] for it in items],
        "fullText": "\n".join([it["display"] for it in items])
    }

    if not is_special_item:
        _save_to_news_history(title, payload, item_obj, article_url, items, headline_dict=result_data.get("headline"))
        with _SCRIPT_CACHE_LOCK:
            _NEWS_SCRIPT_CACHE[cache_key] = result_data
            if len(_NEWS_SCRIPT_CACHE) > 100:
                oldest_k = next(iter(_NEWS_SCRIPT_CACHE))
                del _NEWS_SCRIPT_CACHE[oldest_k]
            if cache_key in _INFLIGHT_EVENTS:
                _INFLIGHT_EVENTS[cache_key].set()
                del _INFLIGHT_EVENTS[cache_key]

    return result_data

