
# 一般的な英単語・略称・ゲームIT用語の発音マップ
COMMON_ENGLISH_WORDS = {
    "KEY": "キー", "TO": "トゥー", "COMBAT": "コンバット",
    "TGS": "ティージーエス", "KTC": "ケーティーシー",
    "PR": "ピーアール", "TIMES": "タイムズ", "PR TIMES": "ピーアールタイムズ",
    "NEWS": "ニュース", "LIVE": "ライブ", "GAME": "ゲーム",
    "RPG": "アールピージー", "FPS": "エフピーエス", "MMO": "エムエムオー",
    "OPEN": "オープン", "AI": "エーアイ", "VR": "ブイアール", "AR": "エーアール",
    "ONLINE": "オンライン", "STUDIO": "スタジオ", "UPDATE": "アップデート",
    "WORLD": "ワールド", "OFFICIAL": "オフィシャル", "SPECIAL": "スペシャル",
    "SHOW": "ショー", "EVENT": "イベント", "BATTLE": "バトル", "WAR": "ウォー",
    "STAR": "スター", "MONSTER": "モンスター", "HUNTER": "ハンター",
    "CHAMPION": "チャンピオン", "LEAGUE": "リーグ", "CUP": "カップ"
}

# -*- coding: utf-8 -*-
"""
tts_normalizer.py
音声合成（TTS / VOICEVOX）専用のテキスト正規化・発音補正・言語規則処理モジュール
"""

import re
import json
import ssl
import urllib.request
import urllib.parse

# ── 国名略称（1文字）の報道文法プレフィックスマップ ──
COUNTRY_PREFIX_MAP = {
    '米': 'べい',
    '英': 'えい',
    '仏': 'ふつ',
    '独': 'どく',
    '露': 'ろ',
    '伊': 'い',
    '豪': 'ごう',
    '韓': 'かん',
    '中': 'ちゅう',
    '日': 'にち',
}

# ── Wikipedia 読み取得キャッシュ ──
_wiki_reading_cache = {}

def lookup_wikipedia_reading(term):
    """
    Wikipedia APIで特殊な固有名詞・アルファベット名の読み（ひらがな）を動的取得。
    記事タイトルの直後にある最初の括弧から正確に読みを抽出。
    """
    if not term or len(term) < 2:
        return None, None
    if term in _wiki_reading_cache:
        return _wiki_reading_cache[term]

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    headers = {
        "User-Agent": "VStudio-TTS-Bot/1.0 (https://github.com/junichiakahori/VStudio)"
    }
    INVALID_READINGS = {"あるいは", "または", "かつて", "えいご", "ちゅうごくご", "ちょうせんご", "かんこくご", "りゃくしょう", "つうしょう", "ほんみょう", "きゅうせい"}

    try:
        ext_url = (
            "https://ja.wikipedia.org/w/api.php"
            "?action=query&prop=extracts&exintro=true&exsentences=2"
            "&explaintext=true&titles={}&redirects=1&format=json"
        ).format(urllib.parse.quote(term))
        req = urllib.request.Request(ext_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5, context=ctx) as r:
            pages = json.loads(r.read().decode("utf-8")).get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if pid == "-1":
                    continue
                extract = pdata.get("extract", "")
                # 括弧内の先頭にあるひらがな/カタカナ読みを抽出（英語併記があっても確実に取得）
                m = re.search(r'[\(（]\s*([ぁ-んァ-ヶゔヴー・、\s]+)', extract)
                if m:
                    raw_bracket = m.group(1).strip()
                    # 英語や別名表記の手前までを取得
                    raw_bracket = re.split(r'[,，\t\n]|\s{2,}|(?<=[ぁ-んァ-ヶゔヴー])\s+(?=[A-Za-z])', raw_bracket)[0].strip()
                    # 読点を整理
                    yomi_raw = raw_bracket.replace("・", "").replace(" ", "").strip()
                    if yomi_raw and yomi_raw not in INVALID_READINGS:
                        # カタカナをひらがなに変換（ヴ・ゔもサポート）
                        yomi_hira = ""
                        for c in yomi_raw:
                            if 0x30A1 <= ord(c) <= 0x30F6:
                                yomi_hira += chr(ord(c) - 0x60)
                            elif c == 'ヴ':
                                yomi_hira += 'ゔ'
                            else:
                                yomi_hira += c
                        
                        yomi_clean = re.sub(r'[^ぁ-んゔー、]', '', yomi_hira)
                        # 英単語に対して異常に長すぎる読み（例: COMBAT -> バリス式列車検知型閉塞装置）は誤読として除外
                        if re.match(r'^[A-Za-z0-9\s\-_]+$', term) and len(yomi_clean.replace("、", "")) > len(term) * 2.5:
                            print(f"[Wikipedia誤読防止] 🚫 '{term}' の読み '{yomi_clean}' は過剰展開のため破棄")
                            _wiki_reading_cache[term] = (None, None)
                            return None, None
                        if len(yomi_clean.replace("、", "")) >= 2:
                            _wiki_reading_cache[term] = (yomi_clean, term)
                            return yomi_clean, term

        search_url = f"https://ja.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(term)}&limit=1&format=json"
        req_s = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req_s, timeout=5, context=ctx) as r_s:
            s_res = json.loads(r_s.read().decode("utf-8"))
            if s_res and len(s_res) > 1 and s_res[1]:
                exact_title = s_res[1][0]
                if exact_title != term:
                    return lookup_wikipedia_reading(exact_title)
    except Exception as e:
        print(f"[Wikipedia読み取得エラー] '{term}': {e}")

    _wiki_reading_cache[term] = (None, None)
    return None, None

def extract_special_terms(text):
    """
    発音ミスが起きやすいアルファベット略称・英字混じり固有名詞・『』や「」内の作品名を自動抽出
    """
    terms = []
    # 1. 『...』および「...」で囲まれた作品名・固有名詞（既にひらがな・カタカナのみのものは除外）
    for m in re.finditer(r'[『「](.*?)[』」]', text):
        t = m.group(1).strip()
        # すでにひらがなのみ、またはカタカナのみの場合は読みが確定しているためWikipedia置換しない
        if re.match(r'^[ぁ-んー]+$', t) or re.match(r'^[ァ-ヴー]+$', t):
            continue
        if len(t) >= 2 and len(t) <= 25 and not re.match(r'^(ニュース|速報|話題|注目)$', t):
            terms.append(t)

    # 2. 英字単語・略称（VIVANT, Ado, YOASOBI等）
    for m in re.finditer(r'(?<![A-Za-z0-9])[A-Za-z0-9\-]{2,}(?![A-Za-z0-9])', text):
        t = m.group(0)
        if t.lower() not in {"https", "http", "www", "com", "net", "jp", "org", "co", "html"}:
            terms.append(t)
    return list(dict.fromkeys(terms))

def sanitize_speech_text(text):
    """不要なネットスラングや記号のサニタイズ"""
    if not text:
        return ""
    t = text
    t = re.sub(r'[\(（][笑草爆][）\)]', '', t)
    t = re.sub(r'(?<![A-Za-z0-9])[wWｗW]{2,}(?![A-Za-z0-9])', '', t)
    return t.strip()

def apply_country_prefixes(text):
    """報道文法における国名1文字プレフィックス（例: 米アンソロピック -> べいアンソロピック）の正規化"""
    if not text:
        return ""
    t = text
    for char, yomi in COUNTRY_PREFIX_MAP.items():
        t = re.sub(
            rf'(?<![一-龥ぁ-んァ-ヶA-Za-z]){char}(?=[ァ-ヴーA-Z][ァ-ヴーA-Za-z0-9・]+)',
            f'{yomi}',
            t
        )
    return t

def apply_okonau_context_rules(text):
    """「行う（おこなう）」と「行く（いく）」の同音異義語を文脈から安全に解決"""
    if not text:
        return ""
    t = text
    t = re.sub(r'([をがにでもはと])行([っいうわえな])', r'\1おこな\2', t)
    t = re.sub(r'(活動|調査|支援|開発|実験|作業|対応|対策|工事|手続き|点検|研修|指導|投票|開票|審査|試験|発表|配信|運営|管理|処理|実行|実施|施行|開催|避難|提供|販売|製造|修理|変更|修正|開始|終了|停止|中止|延期|再開)行([っいうわえな])', r'\1おこな\2', t)
    t = re.sub(r'行わ([れせないずぬてたまば])', r'おこなわ\1', t)
    t = re.sub(r'行い([まてた])', r'おこない\1', t)
    t = re.sub(r'行う([こと|もの|予定|方針|見込み|よう|際|時|ため|と|が|の|から|に|。|！|？|、]|$)', r'おこなう\1', t)
    return t

def normalize_for_tts(text, custom_dict=None, log_collector=None):
    """
    TTS用テキストの包括的正規化処理（Wikipedia解決ログも収集）
    """
    if not text:
        return ""

    t = text

    # 0. 一般英単語・ゲームIT用語のカタカナ発音適用
    for eng_word, kana_yomi in COMMON_ENGLISH_WORDS.items():
        t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(eng_word)}(?![A-Za-z0-9])', kana_yomi, t, flags=re.IGNORECASE)

    if custom_dict and isinstance(custom_dict, dict):
        for orig, yomi in custom_dict.items():
            if orig and yomi and orig in t:
                t = t.replace(orig, yomi)

    t = apply_country_prefixes(t)
    t = apply_okonau_context_rules(t)

    terms = extract_special_terms(t)
    for term in terms:
        yomi, _ = lookup_wikipedia_reading(term)
        if yomi:
            print(f"[Wikipedia自動発音解決] '{term}' ➔ '{yomi}'", flush=True)
            if log_collector is not None and isinstance(log_collector, list):
                log_collector.append({"term": term, "yomi": yomi})
            t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])', yomi, t)

    t = sanitize_speech_text(t)
    return t

def convert_remaining_kanji_to_hiragana(text):
    """原稿中の残存漢字のみをpykakasiでひらがなに変換（タグ [SE:...] 等は維持）"""
    import pykakasi
    kks = pykakasi.kakasi()

    def process_segment(seg):
        res = kks.convert(seg)
        out = ""
        for item in res:
            if re.search(r'[\u4e00-\u9faf]', item.get('orig', '')):
                out += item.get('hira', item.get('orig', ''))
            else:
                out += item.get('orig', '')
        return out

    output = []
    for line in text.split('\n'):
        parts = re.split(r'(\[.*?\])', line)
        line_out = ""
        for p in parts:
            if p.startswith('[') and p.endswith(']'):
                line_out += p
            else:
                line_out += process_segment(p)
        output.append(line_out)
    return '\n'.join(output)
