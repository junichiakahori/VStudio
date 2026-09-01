# -*- coding: utf-8 -*-
"""
news_script_processor.py
ニュース原稿のAI生成・プロンプト構築・二重検証（ファクト照合・中国語・名乗り・定型句フィルター）・字幕/音声分離モジュール
"""

import os
import re
import json
import ssl
import urllib.request
from server.tts_normalizer import normalize_for_tts, sanitize_speech_text
from server.news_crawler import find_cached_url, search_news_url_by_title, register_cached_url, fetch_article_body

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
        "system": "You are a professional Japanese VTuber news anchor. Output 100% natural Japanese ONLY. Under no circumstances should you ever output any Chinese words, simplified Chinese characters, or hallucinated facts.",
        "options": {
            "temperature": 0.2,
            "top_p": 0.8
        },
        "stream": False
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=45) as res:
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

def is_chinese_sentence(text):
    """中国語混入判定フィルター"""
    if not text:
        return False
    t = text.strip()
    CHINESE_CHARS = re.compile(
        r'[听说这那我他她它他们俩们呢吧吗么着过从让给于把被会能想说看吃写开关点去来里边头問做多真假現誰哪幾沒不'
        r'好开心关注加油打气关系可爱封面消息大家为喜欢的人非常但是因为所以如果虽然已经还是就是是不是吃惊开始结束继续停止选择确认取消]'
    )
    hiragana_count = len(re.findall(r'[\u3040-\u309f]', t))
    kanji_count = len(re.findall(r'[\u4e00-\u9fff]', t))
    total_len = len(t)

    if '，' in t or '“' in t or '”' in t:
        if hiragana_count < 4 or (total_len > 6 and (hiragana_count / total_len) < 0.25):
            return True

    if total_len >= 5 and hiragana_count == 0 and kanji_count >= 2:
        return True

    if total_len >= 7 and (hiragana_count / total_len) < 0.18:
        return True

    if len(CHINESE_CHARS.findall(t)) >= 2 and (hiragana_count / total_len) < 0.35:
        return True

    return False

def inspect_and_correct_pronunciation(raw_sentences, article_context="", custom_dict=None):
    """
    生成された原稿各文の検証・フィルタリング・字幕(display)と音声(speech)のペア生成
    """
    corrected_items = []

    for s in raw_sentences:
        s = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', s).strip()
        if not s:
            continue

        display_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', s)
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
                display_s = "記事では詳細な経緯や今後の情報が詳しく紹介されています。"
                s = display_s
            elif re.search(r'([、\s]|^)(が[0-9]+日|は[0-9]+日|そしては[0-9]+日)', display_s):
                display_s = "記事では関連する詳細なスケジュールがまとめられています。"
                s = display_s

        if article_context and len(display_s) >= 12:
            is_pure_impression = bool(re.search(r'^(これ|このニュース|そう|本当|ボク|私|僕|みんな|皆|視聴者)?.*(楽しみ|嬉しい|うれしい|悲しい|残念|すごい|凄い|驚き|びっくり|注目|期待|応援|注視|和解|複雑|不思議|気になり|気をつ|注意|大切|安心|よかった|良かった)(です|だ|ね|よね|よ|な|と思います|にゃ|のだ|わ).*$', display_s))
            if not is_pure_impression:
                nouns = re.findall(r'[\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9]{2,}', display_s)
                FILTER_TERMS = {'こと', 'よう', 'そう', 'ため', 'ニュース', '記事', '内容', '今回', '発表', '紹介', '情報'}
                meaningful_nouns = [n for n in nouns if n not in FILTER_TERMS]
                if len(meaningful_nouns) >= 2:
                    matched_count = sum(1 for n in meaningful_nouns if n in article_context)
                    match_ratio = matched_count / len(meaningful_nouns)
                    if match_ratio < 0.25:
                        print(f"[ファクト照合・ハルシネーション遮断] 🚫 元記事と一致しない架空エピソードを検知: '{display_s}' (一致率: {match_ratio:.2f}) ➔ 安全な解説文に置換")
                        display_s = "記事では詳細な経緯や今後の情報が詳しく紹介されています。"
                        s = display_s

        FRAGMENT_HALLUCINATION_PATTERN = re.compile(
            r'([A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff]{1,10}[…\.]{2,}'
            r'|[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff]{1,10}…'
            r'|別の(銘柄|会社|企業|人物|人|作品|ゲーム|商品|団体|地域)でした'
            r'|(某|某有名|とある)(会社|企業|人物|人|作品|銘柄))'
        )
        if FRAGMENT_HALLUCINATION_PATTERN.search(display_s):
            print(f"[不完全文字列検知] 🚫 途切れ文字を検知: '{display_s}' ➔ 安全な解説文へ置換")
            display_s = "記事では対象となった詳細な情報や一覧が紹介されています。"
            s = display_s

        speech_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', s)
        speech_s = normalize_for_tts(speech_s, custom_dict=custom_dict)

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

        corrected_items.append({
            "display": display_s,
            "speech": speech_s
        })

    return corrected_items

def generate_news_item_script_data(payload, custom_dict=None):
    """
    ニュース1件分の原稿AI生成、ファクト照合、発音検証、見出し生成を一括処理して返す
    """
    title = payload.get('title', '').strip()
    description = payload.get('description', '').strip()
    char_desc = payload.get('charDesc', '').strip()
    category_name = payload.get('categoryName', '').strip()
    transition = payload.get('transition', '').strip()
    article_url = payload.get('url', '').strip()
    provider = payload.get('provider', 'gemini')
    api_key = payload.get('apiKey', '')
    model_name = payload.get('model', '')

    if not article_url:
        article_url = find_cached_url(title)
    if not article_url:
        article_url = search_news_url_by_title(title)
    if article_url:
        register_cached_url(title, article_url)

    full_article_content = description
    if article_url:
        fetched_body = fetch_article_body(article_url)
        if fetched_body and len(fetched_body) > 30:
            full_article_content = f"{description}\n【元記事の詳細本文】: {fetched_body}"

    prompt = build_news_prompt(char_desc, title, full_article_content)
    raw_text = call_llm_backend(provider, prompt, api_key, model_name)

    if not raw_text:
        return None

    clean_text = raw_text
    clean_text = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', clean_text, flags=re.MULTILINE).strip()

    ai_headline_raw = None
    headline_match = re.search(r'(?:\[HEADLINE:\s*|【見出し】:\s*)(.*?)(?:\]|\n|$)', raw_text)
    if headline_match:
        ai_headline_raw = headline_match.group(1).strip()
        ai_headline_raw = re.sub(r'^(?:とろろ|ずんだもん|ひじき|キャスター|AITuber|VTuber|配信者)[\s　]*[：:\-ー]\s*', '', ai_headline_raw).strip()
        clean_text = re.sub(r'(?:\[HEADLINE:\s*|【見出し】:\s*).*?(?:\]|\n|$)', '', clean_text).strip()

    clean_text = clean_text.replace("「", "").replace("」", "").strip()
    clean_text = re.sub(r'にゃ{2,}', 'にゃ', clean_text)
    clean_text = re.sub(r'にゃ[か？\?]+にゃ', 'かにゃ', clean_text)
    clean_text = re.sub(r'のだ{2,}', 'のだ', clean_text)
    clean_text = re.sub(r'かもしれませんねにゃ([！\s　。！？]|$)', r'かもしれませんね\1', clean_text)
    clean_text = re.sub(r'ですねにゃ([！\s　。！？]|$)', r'ですね\1', clean_text)
    clean_text = re.sub(r'ますねにゃ([！\s　。！？]|$)', r'ますね\1', clean_text)
    clean_text = re.sub(r'ですよねにゃ([！\s　。！？]|$)', r'ですよね\1', clean_text)
    clean_text = re.sub(r'でしたにゃ([！\s　。！？]|$)', r'でした\1', clean_text)
    clean_text = re.sub(r'ませんにゃ([！\s　。！？]|$)', r'ません\1', clean_text)
    clean_text = re.sub(r'にゃね([！\s　。！？]|$)', r'ですね\1', clean_text)
    clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)ねにゃ([！\s　。！？]|$)', r'\1ですね\2', clean_text)
    clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)ねのだ([！\s　。！？]|$)', r'\1なのだ\2', clean_text)
    clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)かなにゃ([！\s　。！？]|$)', r'\1かにゃ\2', clean_text)
    clean_text = clean_text.replace("使えへん", "使えない").replace("出来へん", "出来ない").replace("分からへん", "分からない").replace("知らへん", "知らない")
    clean_text = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)へん([の|ね|よ|な|にゃ|！|？|。|、]|$)', r'\1ない\2', clean_text)
    clean_text = re.sub(r'\b[a-z]{3,}な', '大変な', clean_text)

    split_sentences = [s.strip() for s in re.split(r'(?<=[。！？\n])|(?<=[!?])(?![A-Za-z0-9])', clean_text) if s.strip()]

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

    deduped_sentences = []
    seen_transition = False
    clean_title_core = re.sub(r'[★【】〈〉\[\]「」\s　\(\)（）]', '', title)
    for idx, s in enumerate(split_sentences):
        if is_transition_phrase(s):
            if idx > 0 or seen_transition:
                continue
            seen_transition = True
        if idx == 0 and clean_title_core:
            clean_s = re.sub(r'[★【】〈〉\[\]「」\s　\(\)（）]', '', s)
            if (clean_s.startswith(clean_title_core) or clean_title_core.startswith(clean_s)) and len(clean_s) <= len(clean_title_core) + 14:
                continue
        if deduped_sentences and s == deduped_sentences[-1]:
            continue
        deduped_sentences.append(s)
    raw_sentences = deduped_sentences if deduped_sentences else split_sentences

    items = inspect_and_correct_pronunciation(raw_sentences, full_article_content + " " + title, custom_dict=custom_dict)

    if not items:
        fallback_plain = description.replace("「", "").replace("」", "").strip()
        if len(fallback_plain) > 80:
            fallback_plain = fallback_plain[:80] + "…"
        fallback_display = f"{transition} {title}についてです。{fallback_plain} 今後の展開にも注目ですね。"
        fallback_speech = normalize_for_tts(fallback_display, custom_dict=custom_dict)
        items = [{"display": fallback_display, "speech": fallback_speech}]

    if ai_headline_raw:
        headline_display = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', ai_headline_raw)
        headline_display = headline_display.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        if not re.search(r'[\u4e00-\u9fff\u30a0-\u30ffA-Za-z]', headline_display):
            headline_display = title.replace("「", "").replace("」", "").strip()
        headline_speech = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', ai_headline_raw)
        headline_speech = normalize_for_tts(headline_speech, custom_dict=custom_dict)
    else:
        headline_display = title.replace("「", "").replace("」", "").strip()
        headline_speech = normalize_for_tts(headline_display, custom_dict=custom_dict)

    return {
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
