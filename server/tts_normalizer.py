# ── 大文字・正規表記が前提のテクノロジー・略語マップ（Case-sensitive） ──
TECH_ACRONYMS = {
    # 複合語・3文字以上
    "PR TIMES": "ピーアールタイムズ", "AUTOSPORT": "オートスポーツ",
    "IoT": "アイオーティー", "IOT": "アイオーティー", "ICT": "アイシーティー",
    "DX": "ディーエックス", "SNS": "エスエヌエス", "EV": "イーブイ",
    "OS": "オーエス", "UI": "ユーアイ", "UX": "ユーエックス",
    "API": "エーピーアイ", "CPU": "シーピーユー", "GPU": "ジーピーユー",
    "PC": "ピーシー", "TV": "テレビ", "URL": "ユーアールエル",
    "PDF": "ピーディーエフ", "SSD": "エスエスディー", "HDD": "エイチディーディー",
    "USB": "ユーエスビー", "WiFi": "ワイファイ", "WIFI": "ワイファイ", "Wi-Fi": "ワイファイ", "WI-FI": "ワイファイ",
    "NFT": "エヌエフティー", "Web3": "ウェブスリー", "WEB3": "ウェブスリー",
    "TGS": "ティージーエス", "KTC": "ケーティーシー", "PR": "ピーアール",
    "RPG": "アールピージー", "FPS": "エフピーエス", "MMO": "エムエムオー",
    "AI": "エーアイ", "VR": "ブイアール", "AR": "エーアール"
}

# ── 日本語文中でカタカナ語として定着している英単語マップ（Case-insensitive） ──
COMMON_ENGLISH_WORDS = {
    "APPLE": "アップル", "GOOGLE": "グーグル", "AMAZON": "アマゾン",
    "MICROSOFT": "マイクロソフト", "SONY": "ソニー", "META": "メタ",
    "OPENAI": "オープンエーアイ", "CHATGPT": "チャットジーピーティー",
    "MONSTER": "モンスター", "OFFICIAL": "オフィシャル", "SPECIAL": "スペシャル",
    "HUNTER": "ハンター", "RACING": "レーシング", "DRIVER": "ドライバー",
    "UPDATE": "アップデート", "ONLINE": "オンライン", "STUDIO": "スタジオ",
    "BATTLE": "バトル", "SPORTS": "スポーツ", "COMBAT": "コンバット",
    "BULLS": "ブルズ", "WORLD": "ワールド", "EVENT": "イベント",
    "SPORT": "スポーツ", "TIMES": "タイムズ",
    "GAME": "ゲーム", "LIVE": "ライブ", "NEWS": "ニュース",
    "STAR": "スター", "OTTO": "オットー"
}




# -*- coding: utf-8 -*-
"""
tts_normalizer.py
音声合成（TTS / VOICEVOX）専用のテキスト正規化・発音補正・言語規則処理モジュール
"""

import os
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

    ctx = ssl._create_unverified_context()


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
                m = re.search(r'[\(（]\s*([ぁ-んァ-ヶゔヴー・、\s,，/／]+)', extract)
                if m:
                    raw_bracket = m.group(1).strip()
                    # 読点（、）、カンマ（，,）、スラッシュ等で分割し、先頭の1つの代表読みのみを取得（異読の全結合を完全防止）
                    raw_bracket = re.split(r'[、,，\t\n/／|｜]|\s{2,}|(?<=[ぁ-んァ-ヶゔヴー])\s+(?=[A-Za-z])', raw_bracket)[0].strip()
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

                        
                        yomi_clean = re.sub(r'[^ぁ-んゔー]', '', yomi_hira)
                        # 法人格接尾語（いんく、こーぽれーしょん、かぶしきがいしゃ等）を安全にカット
                        yomi_clean = re.sub(r'(いんく|こーぽれーしょん|かぶしきがいしゃ|ゆーげんがいしゃ|ごうどうがいしゃ|りみてっど)$', '', yomi_clean).strip()
                        
                        # 英単語に対して異常に長すぎる読みは誤読として除外
                        if re.match(r'^[A-Za-z0-9\s\-_]+$', term) and len(yomi_clean) > len(term) * 2.5:
                            print(f"[Wikipedia誤読防止] 🚫 '{term}' の読み '{yomi_clean}' は過剰展開のため破棄")
                            _wiki_reading_cache[term] = (None, None)
                            return None, None
                        if len(yomi_clean) >= 2:
                            _wiki_reading_cache[term] = (yomi_clean, term)
                            return yomi_clean, term


        search_url = f"https://ja.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(term)}&limit=1&format=json"
        req_s = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req_s, timeout=1.5, context=ctx) as r_s:
            s_res = json.loads(r_s.read().decode("utf-8"))
            if s_res and len(s_res) > 1 and s_res[1]:
                exact_title = s_res[1][0]
                # カッコ付き曖昧さ回避（例: VIVANT (テレビドラマ)）のみ許可
                clean_title = re.sub(r'[\(（].*?[\)）]', '', exact_title).strip()
                if clean_title == term:
                    yomi, _ = lookup_wikipedia_reading(exact_title)
                    if yomi:
                        _wiki_reading_cache[term] = (yomi, term)
                        return yomi, term

        # ── 3. Wikipedia 全文スニペット検索 (単独記事がない「株探」や名字「小籔」等の固有名詞対応) ──
        sr_url = f"https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(term)}&format=json"
        req_sr = urllib.request.Request(sr_url, headers=headers)
        with urllib.request.urlopen(req_sr, timeout=1.5, context=ctx) as r_sr:
            sr_data = json.loads(r_sr.read().decode("utf-8"))
            for item in sr_data.get("query", {}).get("search", []):
                snippet = item.get("snippet", "")
                clean_snippet = re.sub(r"<[^>]+>", "", snippet)
                
                # パターンA: "term（よみ）" または "term(よみ)"
                m_direct = re.search(re.escape(term) + r"[（\(]([ぁ-んァ-ヶー]+)[）\)]", clean_snippet)
                if m_direct:
                    y_raw = m_direct.group(1).strip()
                    y_hira = "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in y_raw])
                    if len(y_hira) >= 2 and y_hira not in INVALID_READINGS:
                        print(f"[Wikipediaスニペット読み解決] 🎯 '{term}' -> '{y_hira}'")
                        _wiki_reading_cache[term] = (y_hira, term)
                        return y_hira, term

                # パターンB: 人名（名字 term:2~3文字 + 名前 extra_name:1~3文字（名字よみ 名前よみ））
                m_person = re.search(re.escape(term) + r"\s*([^\(（\s、。]{1,3})?\s*[（\(]([ぁ-んァ-ヶー\s・]+)[、,）\)]", clean_snippet)
                if m_person and len(term) <= 3:
                    extra_name = m_person.group(1) or ""
                    y_raw = m_person.group(2).strip().replace("・", " ")
                    y_hira = "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in y_raw])
                    parts = y_hira.split()
                    if extra_name and len(parts) >= 2:
                        y_surname = parts[0]
                        if len(y_surname) >= 2 and y_surname not in INVALID_READINGS:
                            print(f"[Wikipedia人名・名字読み解決] 🎯 '{term}' -> '{y_surname}'")
                            _wiki_reading_cache[term] = (y_surname, term)
                            return y_surname, term
                    elif len(parts) == 1 and len(parts[0]) >= 2 and parts[0] not in INVALID_READINGS:
                        print(f"[Wikipediaスニペット読み解決] 🎯 '{term}' -> '{parts[0]}'")
                        _wiki_reading_cache[term] = (parts[0], term)
                        return parts[0], term
    except Exception:
        pass

    _wiki_reading_cache[term] = (None, None)
    return None, None

def extract_special_terms(text):
    """
    発音ミスが起きやすいアルファベット略称・英字混じり固有名詞・『』や「」内の作品名・特殊固有名詞を自動抽出
    （※一般的な日本語漢字熟語はVOICEVOXが自然に読めるため除外）
    """
    terms = []
    # 1. 『...』および「...」で囲まれた作品名・固有名詞（セリフや会話文は除外）
    for m in re.finditer(r'[『「](.*?)[』」]', text):
        t = m.group(1).strip()
        if re.match(r'^[ぁ-んー]+$', t) or re.match(r'^[ァ-ヴー]+$', t):
            continue
        # 助詞（が、は、を、に、で、と、から、へ）や読点が含まれる文、または10文字超の会話文は除外
        if re.search(r'[がはをにでとからへ、。！？]', t) or len(t) > 12:
            continue
        if len(t) >= 2 and not re.match(r'^(ニュース|速報|話題|注目|新曲|記事)$', t):
            terms.append(t)

    # テキスト全体が英字・記号・スペースのみの英文フレーズ（例: Let it be, Take it easy）の場合はWikipedia検索を行わない
    if re.match(r'^[A-Za-z0-9\s\-_.,!?\'"]+$', text.strip()):
        return []

    # 2. 英字単語・略称（VIVANT, Ado, YOASOBI等 / アルファベットを1文字以上含むこと）
    IGNORED_SHORT_WORDS = {
        "https", "http", "www", "com", "net", "jp", "org", "co", "html",
        # 英語の代名詞・前置詞・冠詞・基本語（Wikipedia検索による誤読・映画タイトル吸い込みを防止）
        "it", "to", "in", "on", "at", "by", "of", "for", "is", "am", "are", "was", "were",
        "do", "go", "he", "me", "my", "we", "us", "no", "so", "up", "an", "as", "be", "if",
        "the", "and", "but", "you", "all", "can", "not", "let", "get", "set", "make", "take",
        "have", "say", "see", "day", "new", "out", "how", "who", "why", "just", "easy", "back", "only",
        # 既に静的マップや文脈ルールで解決済みの略語
        "it", "ai", "vr", "ar", "dx", "os", "ui", "ux", "api", "cpu", "gpu", "pc", "tv",
        "url", "pdf", "ssd", "hdd", "usb", "wifi", "nft", "pr", "rpg", "fps", "mmo", "sns", "ev", "iot", "ict"
    }
    for m in re.finditer(r'(?<![A-Za-z0-9])(?=[A-Za-z0-9\-]*[A-Za-z])[A-Za-z0-9\-]{2,}(?![A-Za-z0-9])', text):
        t = m.group(0)
        if t.lower() not in IGNORED_SHORT_WORDS:
            terms.append(t)

    # 3. 漢字/英字＋数字の固有名詞（日向坂46, 乃木坂46, 櫻坂46, AKB48, SKE48等）
    for m in re.finditer(r'(?:[A-Za-z]+|[\u4e00-\u9fa5]+)\d{1,3}', text):
        t = m.group(0)
        if not re.match(r'^(?:第?\d+|昭和\d+|平成\d+|令和\d+|\d+年|\d+月|\d+日|\d+歳|\d+人|\d+件|\d+回)$', t):
            terms.append(t)

    # 4. 敬称・肩書が付いた人名候補（河野俊嗣さん、菅原選手、高市総理など）
    for m in re.finditer(r'[\u4e00-\u9fa5]{2,4}(?=(?:さん|氏|選手|知事|首相|大臣|総理|議員|社長|会長|監督|コーチ|容疑者|被告))', text):
        t = m.group(0)
        if t not in {"日本", "東京", "大阪", "政府", "警察", "会社", "代表", "関係"}:
            terms.append(t)

    return list(dict.fromkeys(terms))


def resolve_text_readings(text, custom_dict=None):
    """
    文章全体に対して辞書置換・英語発音マップ・Wikipedia/Web読み方解決を一括適用
    """
    if not text:
        return text

    normalized = text

    # 1. カスタム辞書（最優先）
    if custom_dict is None:
        try:
            dict_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dict", "custom_dict.json")
            if os.path.exists(dict_path):
                with open(dict_path, "r", encoding="utf-8") as f:
                    custom_dict = json.load(f)
        except Exception:
            custom_dict = {}

    if custom_dict and isinstance(custom_dict, dict):
        for k, v in custom_dict.items():
            if k and v and k in normalized:
                normalized = normalized.replace(k, v)

    # 2. 英語発音マップ
    for eng, yomi in COMMON_ENGLISH_WORDS.items():
        pattern = re.compile(rf'(?<![A-Za-z0-9]){re.escape(eng)}(?![A-Za-z0-9])', re.IGNORECASE)
        normalized = pattern.sub(yomi, normalized)

    # 3. 特殊語句・固有名詞の動的解決 (Wikipedia / Web検索)
    terms = extract_special_terms(normalized)
    for term in terms:
        if term in normalized and not re.match(r'^[ぁ-んァ-ヶー]+$', term):
            yomi, _ = lookup_wikipedia_reading(term)
            if yomi:
                # 一般漢字熟語で長さが異常に長いものは誤爆除外（例: 新曲 -> しんきょくえくすぷれす 等の同名作品）
                if re.match(r'^[\u4e00-\u9fa5]+$', term) and len(yomi) > len(term) * 3:
                    continue
                normalized = normalized.replace(term, yomi)
            else:
                # 複合語の場合（例: 右肩甲骨 -> 右 + 肩甲骨、右肩肩甲骨 -> 肩甲骨）
                # A. 接頭辞（右、左、両、上、下、前、元）+ 語句
                p_match = re.match(r"^([右左両上下前元])(.+)$", term)
                resolved_compound = False
                if p_match:
                    pref, rest = p_match.groups()
                    rest_yomi, rest_title = lookup_wikipedia_reading(rest)
                    if rest_yomi and rest_title and rest_title == rest:
                        p_map = {"右": "みぎ", "左": "ひだり", "両": "りょう", "上": "じょう", "下": "か", "前": "まえ", "元": "もと"}
                        full_yomi = p_map.get(pref, pref) + rest_yomi
                        print(f"[Wikipedia接頭辞解決] 🎯 '{term}' ➔ '{full_yomi}'")
                        normalized = normalized.replace(term, full_yomi)
                        resolved_compound = True
                
                # B. 内部の2〜4文字の単独記事完全一致（例: 右肩肩甲骨 -> 肩甲骨 -> けんこうこつ / 漢字語句のみ対象）
                if not resolved_compound and len(term) >= 3 and re.match(r'^[\u4e00-\u9fa5]+$', term):
                    for length in range(min(len(term) - 1, 4), 2, -1):
                        for i in range(len(term) - length + 1):
                            sub = term[i:i+length]
                            sub_yomi, sub_title = lookup_wikipedia_reading(sub)
                            if sub_yomi and sub_title and sub_title == sub:
                                print(f"[Wikipedia複合語内読み解決] 🎯 '{term}' 内の '{sub}' ➔ '{sub_yomi}'")
                                normalized = normalized.replace(sub, sub_yomi)
                                resolved_compound = True
                                break
                        if resolved_compound:
                            break

    return normalized

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

def apply_it_context_rules(text):
    """
    「IT」の多義性（情報技術 vs 映画『IT』 vs 英語代名詞 it）を文脈から解決
    """
    if not text:
        return ""
    t = text

    # 1. 映画・作品名文脈の「IT」（イット）の保護
    # 例: 『IT』, 「IT」, 《IT》, 映画IT, ホラー映画IT, スティーヴン・キングのIT, IT／イット
    t = re.sub(r'([『「《〈])IT([』」》〉])', r'\1イット\2', t)
    t = re.sub(r'(映画|ホラー|名作|スティーヴン・キング|ペニーワイズ)[の\s・]*IT(?![A-Za-z0-9])', r'\1のイット', t)
    t = re.sub(r'(?<![A-Za-z0-9])IT[／/](イット|それ)', r'イット／\1', t)

    # 2. 英語フレーズ・代名詞（小文字 it や前後に英語が続くケース）は変換しない
    # （VOICEVOXやTTSエンジンが自然に英語として「イット」と発音する）

    # 3. 情報技術・テクノロジー文脈の大文字「IT」 ➔ 「アイティー」
    # (a) 複合語・接尾辞パターン: IT・, IT企業, IT技術, IT業界, ITエンジニア, IT化, IT関連, IT導入, ITシステム, IT分野, IT部門, ITサービス, ITパスポート, IT革命, ITインフラ, ITリテラシー, IT人材, IT大手, IT市場, IT産業, IT活用, IT用語
    it_suffixes = r'(・|テクノロジー|企業|業界|技術|エンジニア|化|関連|導入|システム|分野|部門|サービス|ベンチャー|パスポート|ストラテジ|人材|活用|革命|インフラ|リテラシー|大手|市場|産業|スキル|拠点|総研|ガバナンス|用語|担当|戦略|基盤|製品|ソリューション|リサーチ)'
    t = re.sub(rf'(?<![A-Za-z0-9])IT(?={it_suffixes})', 'アイティー', t)

    # (b) 日本語修飾・プレフィックスパターン: 日本のIT, 最新のIT, 大手IT, 先端IT, 医療IT, 金融IT, 教育IT, 我が国のIT, 行政のIT
    it_prefixes = r'(日本の|最新の|大手の|大手|先端|医療|金融|教育|行政の|我が国の|社内|自治体|地域|国内|世界|グローバル)'
    t = re.sub(rf'({it_prefixes})IT(?![A-Za-z0-9])', r'\1アイティー', t)

    # (c) 日本語文中に単独で現れる大文字「IT」
    # 前後が日本語（ひらがな・カタカナ・漢字・句読点・記号・文頭文末）の大文字IT
    t = re.sub(r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF、。！？\s])IT(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF、。！？\s]|$)', r'\1アイティー', t)
    t = re.sub(r'^IT(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF、。！？\s])', 'アイティー', t)


    return t

def apply_tech_acronyms(text):
    """大文字・正規表記のテクノロジー略語マップの適用（大文字厳格一致で誤爆防止）"""
    if not text:
        return ""
    t = text
    for acronym, yomi in TECH_ACRONYMS.items():
        t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(acronym)}(?![A-Za-z0-9])', yomi, t)
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
    TTS用テキストの包括的正規化処理（文脈解決 -> 辞書 -> 英語マップ -> Wikipedia動的解決）
    """
    if not text:
        return ""

    t = text

    # 1. 文脈考慮型のIT発音解決（映画『IT』 vs 英語代名詞 it vs 情報技術 大文字IT）
    t = apply_it_context_rules(t)

    # 2. テクノロジー大文字略語マップ適用（Case-sensitive）
    t = apply_tech_acronyms(t)

    # 3. 一般英単語カタカナマップ適用（Case-insensitive）
    for eng_word, kana_yomi in COMMON_ENGLISH_WORDS.items():
        t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(eng_word)}(?![A-Za-z0-9])', kana_yomi, t, flags=re.IGNORECASE)

    # 4. 固有名詞の文脈保護ルール（動詞「探す」と重複する「株探」の誤爆防止）
    # 送り仮名（し・す・せ・そ・さ・っ）が直後に続く場合は「探す（さがす）」なので置換せず、メディア名「株探」のみ「かぶたん」に置換
    t = re.sub(r'株探(?![しすせそさっ])', 'かぶたん', t)

    # 5. カスタム辞書適用
    if custom_dict and isinstance(custom_dict, dict):
        for orig, yomi in custom_dict.items():
            if orig and yomi and orig != "株探" and orig in t:
                t = t.replace(orig, yomi)

    # 6. 報道文法・国名プレフィックスと動詞文脈解決
    t = apply_country_prefixes(t)
    t = apply_okonau_context_rules(t)

    # 7. 特殊固有名詞のWikipedia動的解決
    terms = extract_special_terms(t)
    for term in terms:
        yomi, _ = lookup_wikipedia_reading(term)
        if yomi:
            print(f"[Wikipedia自動発音解決] '{term}' ➔ '{yomi}'", flush=True)
            if log_collector is not None and isinstance(log_collector, list):
                log_collector.append({"term": term, "yomi": yomi})
            t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])', yomi, t)

    # 8. サニタイズ
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
