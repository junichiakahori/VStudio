# -*- coding: utf-8 -*-
"""
tts_normalizer.py
音声合成（TTS / VOICEVOX）専用のテキスト正規化・発音補正・言語規則処理モジュール
（※ ルール・略語・正規表現設定は data/tts_rules.json で外部一元管理）
"""

import os
import re
import json
import ssl
import difflib
import urllib.request
import urllib.parse

_kks_instance = None

def get_kks():
    """pykakasi インスタンスの遅延ロード"""
    global _kks_instance
    if _kks_instance is None:
        try:
            import pykakasi
            _kks_instance = pykakasi.kakasi()
        except Exception:
            _kks_instance = False
    return _kks_instance if _kks_instance is not False else None

def is_plausible_reading(term, yomi):
    """
    漢字語句 term と読み yomi の妥当性を検証。
    完全に無関係な単語への破壊的誤読（例: 一時閉鎖 -> すもうべや、運用 -> じょうば、横開き -> ふながこい、快挙 -> おりこん）を100%弾く。
    """
    if not term or not yomi:
        return False
    import unicodedata
    norm_term = unicodedata.normalize('NFKC', term)
    norm_yomi = unicodedata.normalize('NFKC', yomi)

    # 全角半角・大文字小文字の差のみの場合は同一語句として許容（例: ＧＩＲＬＳ -> Girls, KIDS -> Kids）
    if norm_term.lower() == norm_yomi.lower():
        return True

    # 英字を含む英数字記号のみの場合は許容（例: F15 -> えふじゅうご, Apple -> アップル）
    if re.search(r'[A-Za-z]', norm_term) and re.match(r'^[A-Za-z0-9\s\-_.]+$', norm_term):
        return True

    kks = get_kks()
    if not kks:
        return True

    # 漢字・仮名混じりの場合
    res = kks.convert(term)
    std_hira = "".join([it.get("hira", "") for it in res])
    if yomi == std_hira:
        return True

    # 文字列類似度（レーベンシュタイン比率）
    sim = difflib.SequenceMatcher(None, std_hira, yomi).ratio()
    if sim >= 0.35:
        return True

    # 濁点・半濁点の清音化による類似度チェック
    def _to_seion(s):
        d = {"が":"か","ぎ":"き","ぐ":"く","げ":"け","ご":"こ",
             "ざ":"さ","じ":"し","ず":"す","ぜ":"せ","ぞ":"そ",
             "だ":"た","ぢ":"ち","づ":"つ","で":"て","ど":"と",
             "ば":"は","び":"ひ","ぶ":"ふ","べ":"へ","ぼ":"ほ",
             "ぱ":"は","ぴ":"ひ","ぷ":"ふ","ぺ":"へ","ぽ":"ほ"}
        return "".join([d.get(c, c) for c in s])

    if difflib.SequenceMatcher(None, _to_seion(std_hira), _to_seion(yomi)).ratio() >= 0.35:
        return True

    # 漢字構成文字の音訓・音節チェック（人名等の特殊読みを許容）
    kanji_chars = [c for c in term if "\u4e00" <= c <= "\u9fa5"]
    if not kanji_chars:
        return sim >= 0.2

    # 多音字（pykakasiが代表読みしか返さない基本漢字の音訓セット）
    COMMON_POLYPHONIC_KANJI = {
        "方": {"かた", "ほう", "がた"},
        "大": {"おお", "だい", "たい"},
        "上": {"うえ", "じょう", "かみ", "のぼ"},
        "下": {"した", "げ", "しも", "くだ", "お"},
        "日": {"ひ", "にち", "じつ", "か", "び"},
        "月": {"つき", "がつ", "げつ"},
        "生": {"い", "なま", "しょう", "せい", "う", "は"},
        "行": {"い", "ゆ", "こう", "ぎょう"},
        "出": {"で", "だ", "しゅつ"},
        "入": {"い", "はい", "にゅう"},
        "人": {"ひと", "にん", "じん", "びと"},
        "間": {"あいだ", "ま", "かん", "けん"},
        "所": {"ところ", "しょ", "じょ"},
        "名": {"な", "めい", "みょう"}
    }

    matched_kanji = 0
    for c in kanji_chars:
        # 多音字の訓読み・音読み判定
        if c in COMMON_POLYPHONIC_KANJI:
            if any(r in yomi for r in COMMON_POLYPHONIC_KANJI[c]):
                matched_kanji += 1
                continue

        c_res = kks.convert(c)
        if c_res:
            c_hira = c_res[0].get("hira", "")
            if len(c_hira) >= 2 and c_hira in yomi:
                matched_kanji += 1
            elif len(c_hira) == 1 and c_hira in yomi and c_hira not in "あいうえおっー":
                matched_kanji += 1

    if len(kanji_chars) >= 2 and matched_kanji >= 1:
        return True
    if len(kanji_chars) == 1 and matched_kanji >= 1:
        return True

    # 3〜4文字の漢字ブロック（人名フルネーム候補: 角田裕毅, 麻生太郎, 悠仁さま等）
    # ※人名は音訓や名乗りが極めて多様なため、妥当な文字数比率（3〜8文字程度）かつ既知の異常単語でなければ許容
    if len(term) in (3, 4) and len(kanji_chars) == len(term):
        if 3 <= len(yomi) <= len(term) * 2.5:
            SUSPICIOUS_WORDS = {"すもう", "ふな", "ぐらんぷり", "おりこん", "へいさ", "うんよう", "しけん"}
            if not any(sw in yomi for sw in SUSPICIOUS_WORDS):
                return True

    return False

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTS_RULES_PATH = os.path.join(BASE_DIR, "data", "tts_rules.json")

_tts_rules_cache = None
_tts_rules_mtime = 0

def load_tts_rules():
    """data/tts_rules.json を自動ロード（ファイルの更新を検知して動的リロード）"""
    global _tts_rules_cache, _tts_rules_mtime
    try:
        if os.path.exists(TTS_RULES_PATH):
            mtime = os.path.getmtime(TTS_RULES_PATH)
            if _tts_rules_cache is None or mtime != _tts_rules_mtime:
                with open(TTS_RULES_PATH, "r", encoding="utf-8") as f:
                    _tts_rules_cache = json.load(f)
                _tts_rules_mtime = mtime
        else:
            _tts_rules_cache = {}
    except Exception as e:
        print(f"[TTS Rules] ロード失敗: {e}", flush=True)
        if _tts_rules_cache is None:
            _tts_rules_cache = {}
    return _tts_rules_cache or {}

# 後方互換性用エクスポート
def get_tech_acronyms():
    return load_tts_rules().get("tech_acronyms", {})

class _AcronymsProxy(dict):
    """外部から TECH_ACRONYMS を参照された際に動的JSON内容を返すプロキシ"""
    def __getitem__(self, key):
        return get_tech_acronyms()[key]
    def get(self, key, default=None):
        return get_tech_acronyms().get(key, default)
    def items(self):
        return get_tech_acronyms().items()
    def keys(self):
        return get_tech_acronyms().keys()
    def values(self):
        return get_tech_acronyms().values()
    def __contains__(self, key):
        return key in get_tech_acronyms()
    def __len__(self):
        return len(get_tech_acronyms())

TECH_ACRONYMS = _AcronymsProxy()
COMMON_ENGLISH_WORDS = {}

# ── 全角英数字の半角統一マッピング ──
_FULLWIDTH_ALPHANUMERIC_TRANS = str.maketrans(
    "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ"
    "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
    "０１２３４５６７８９",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
)

def normalize_fullwidth_alphanumeric(text):
    """全角英数字（Ａ-Ｚ、ａ-ｚ、０-９）を半角に統一（チェックすり抜け・VOICEVOXでの1文字スペル読みを防止）"""
    if not text:
        return ""
    return text.translate(_FULLWIDTH_ALPHANUMERIC_TRANS)

COUNTRY_PREFIX_MAP = {
    '米': 'べい', '英': 'えい', '仏': 'ふつ', '独': 'どく', '露': 'ろ',
    '伊': 'い', '豪': 'ごう', '韓': 'かん', '中': 'ちゅう', '日': 'にち',
}

# ── 皇族・著名人等の文脈固有名詞・尊称マップ（data/tts_rules.json より動的取得） ──
def get_imperial_proper_nouns():
    rules = load_tts_rules()
    return [(item["pattern"], item["replacement"]) for item in rules.get("imperial_proper_nouns", []) if "pattern" in item and "replacement" in item]

class _ImperialNounsProxy(list):
    def __iter__(self):
        return iter(get_imperial_proper_nouns())
    def __len__(self):
        return len(get_imperial_proper_nouns())
    def __getitem__(self, index):
        return get_imperial_proper_nouns()[index]

IMPERIAL_PROPER_NOUNS = _ImperialNounsProxy()

DEFAULT_HONORIFIC_SUFFIX_PAIRS = [
    ("親王", "しんのう"), ("内親王", "ないしんのう"), ("選手", "せんしゅ"), ("投手", "とうしゅ"),
    ("捕手", "ほしゅ"), ("監督", "かんとく"), ("コーチ", "こーち"), ("棋士", "きし"),
    ("名人", "めいじん"), ("竜王", "りゅうおう"), ("横綱", "よこづな"), ("親方", "おやかた"),
    ("大統領", "だいとうりょう"), ("首相", "しゅしょう"), ("総理", "そうり"), ("知事", "ちじ")
]

def get_honorific_suffix_pairs():
    rules_pairs = load_tts_rules().get("honorific_suffix_pairs")
    if rules_pairs:
        return [tuple(x) for x in rules_pairs]
    return DEFAULT_HONORIFIC_SUFFIX_PAIRS

class _HonorificPairsProxy(list):
    def __iter__(self):
        return iter(get_honorific_suffix_pairs())
    def __len__(self):
        return len(get_honorific_suffix_pairs())
    def __getitem__(self, index):
        return get_honorific_suffix_pairs()[index]

HONORIFIC_SUFFIX_PAIRS = _HonorificPairsProxy()

def _strip_unmatched_honorific_reading(term, yomi_clean):
    """検索語termに尊称・肩書が含まれない場合、Wikipedia記事名等から混入した末尾の尊称読み（〜しんのう、〜せんしゅ等）を除去"""
    if not yomi_clean or not term:
        return yomi_clean
    for h_kanji, h_yomi in get_honorific_suffix_pairs():
        if h_kanji not in term and yomi_clean.endswith(h_yomi) and len(yomi_clean) > len(h_yomi):
            yomi_clean = yomi_clean[:-len(h_yomi)].strip()
    return yomi_clean

def _strip_unmatched_brand_prefix(term, yomi_clean):
    """
    検索語termに社名・ブランド名が含まれない場合、
    Wikipediaのリダイレクトやリード文から混入した先頭のプレフィックス読み（にんてんどー、まいくろそふと、そにー等）を除去。
    例: term='Switch2', yomi_clean='にんてんどーすいっちとぅー' -> 'すいっちつー'
    """
    if not yomi_clean or not term:
        return yomi_clean
    brand_prefix_pairs = [
        (("Nintendo", "nintendo", "任天堂", "ニンテンドー"), "にんてんどー"),
        (("Sony", "sony", "ソニー"), "そにー"),
        (("Microsoft", "microsoft", "マイクロソフト"), "まいくろそふと"),
        (("Apple", "apple", "アップル"), "あっぷる"),
        (("Google", "google", "グーグル"), "ぐーぐる"),
    ]
    for brand_keywords, brand_yomi in brand_prefix_pairs:
        if not any(k.lower() in term.lower() for k in brand_keywords):
            if yomi_clean.startswith(brand_yomi) and len(yomi_clean) > len(brand_yomi):
                yomi_clean = yomi_clean[len(brand_yomi):].lstrip("・ー")
    # 「とぅー」などの英語音の末尾表記揺れを「つー」に補正
    if yomi_clean.endswith("とぅー"):
        yomi_clean = yomi_clean[:-3] + "つー"
    return yomi_clean

def apply_contextual_proper_nouns_rules(text):
    """文脈から判断できる皇族・著名人などの固有名詞の適切な読み解決（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    for pattern, yomi in get_imperial_proper_nouns():
        t = re.sub(pattern, yomi, t)
    return t

# ── Wikipedia 読み取得キャッシュ（ヒット・ネガティブ共用）──
_wiki_reading_cache = {}
_WIKI_TIMEOUT = 1.5  # 全ステップ統一タイムアウト（秒）

def lookup_wikipedia_reading(term):
    """
    Wikipedia APIで特殊な固有名詞・アルファベット名の読み（ひらがな）を動的取得。
    記事タイトルの直後にある最初の括弧から正確に読みを抽出。
    ネガティブキャッシュにより一度404/失敗した語のリトライを完全遮断。
    """
    if not term or len(term) < 2:
        return None, None
    if term in _wiki_reading_cache:  # ヒット（yomi, title）でもネガティブ（None, None）でもキャッシュ済みなら即返却
        return _wiki_reading_cache[term]

    ctx = ssl._create_unverified_context()


    headers = {
        "User-Agent": "VStudio-TTS-Bot/1.0 (https://github.com/junichiakahori/VStudio)"
    }
    INVALID_READINGS = {"あるいは", "または", "かつて", "えいご", "ちゅうごくご", "ちょうせんご", "かんこくご", "りゃくしょう", "つうしょう", "ほんみょう", "きゅうせい"}

    step1_found = False  # step1 (extracts) で有効なページが見つかったかどうか
    try:
        ext_url = (
            "https://ja.wikipedia.org/w/api.php"
            "?action=query&prop=extracts&exintro=true&exsentences=2"
            "&explaintext=true&titles={}&redirects=1&format=json"
        ).format(urllib.parse.quote(term))
        req = urllib.request.Request(ext_url, headers=headers)
        with urllib.request.urlopen(req, timeout=_WIKI_TIMEOUT, context=ctx) as r:
            pages = json.loads(r.read().decode("utf-8")).get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if pid == "-1":
                    continue
                step1_found = True
                page_title = pdata.get("title", "")
                # リダイレクト先タイトルが検索語と全く無関係な上位概念（例: 震度3 -> 気象庁震度階級）の場合は破棄
                clean_pt = re.sub(r'[\(（].*?[\)）]', '', page_title).strip()
                # 漢字語句・漢字数字混じり語句の場合、上位概念・別番組リダイレクト（例: 営業時間 -> 営業、月10 -> 関西テレビ...）による誤読を防止
                if re.search(r'[\u4e00-\u9fa5]', term):
                    clean_norm = clean_pt.replace(" ", "")
                    term_norm = term.replace(" ", "")
                    # 漢字を含む語句はタイトル（括弧除外後）と完全一致を必須化（上位概念・類似別記事の誤爆を根絶）
                    if clean_norm != term_norm:
                        continue
                elif term.lower() != clean_pt.lower():
                    # アルファベット語も完全一致のみ採用
                    continue
                # アルファベット語に対して漢字やひらがなの記事へリダイレクトされた場合は「概念リダイレクト」として破棄（例: Japan -> 日本）
                if re.match(r'^[A-Za-z0-9\s\-_.]+$', term) and re.search(r'[\u4e00-\u9fa5\u3040-\u309f]', clean_pt):
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
                        # 検索語に含まれない尊称・肩書読み（しんのう、せんしゅ等）を安全にカット
                        yomi_clean = _strip_unmatched_honorific_reading(term, yomi_clean)
                        # 検索語に含まれない社名・ブランド名プレフィックス（にんてんどー等）を安全にカット
                        yomi_clean = _strip_unmatched_brand_prefix(term, yomi_clean)
                        
                        # 英単語に対して異常に長すぎる読みは誤読として除外
                        if re.match(r'^[A-Za-z0-9\s\-_]+$', term) and len(yomi_clean) > len(term) * 2.5:
                            print(f"[Wikipedia誤読防止] 🚫 '{term}' の読み '{yomi_clean}' は過剰展開のため破棄")
                            _wiki_reading_cache[term] = (None, None)
                            return None, None
                        if len(yomi_clean) >= 2 and yomi_clean not in INVALID_READINGS:
                            if not is_plausible_reading(term, yomi_clean):
                                print(f"[Wikipedia誤読防止] 🚫 '{term}' の読み '{yomi_clean}' は漢字表記と乖離しているため破棄")
                                _wiki_reading_cache[term] = (None, None)
                                return None, None
                            print(f"[Wikipedia自動発音解決] '{term}' ➔ '{yomi_clean}'")
                            _wiki_reading_cache[term] = (yomi_clean, term)
                            return yomi_clean, term

        # ── 2. Wikipedia 検索API経由（タイトルの表記揺れ・別名対応） ──
        search_url = f"https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(term)}&format=json"
        req_s = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req_s, timeout=_WIKI_TIMEOUT, context=ctx) as r_s:
            s_data = json.loads(r_s.read().decode("utf-8"))
            results = s_data.get("query", {}).get("search", [])
            for res in results[:2]: # 上位2件のみ
                title = res.get("title", "")
                if title:
                    # ── タイトルと検索語の完全一致チェック（Step 1と同等のガード） ──
                    clean_title = re.sub(r'[\(（].*?[\)）]', '', title).strip()
                    title_normalized = clean_title.replace(" ", "")
                    term_normalized = term.replace(" ", "")
                    if title_normalized != term_normalized and title_normalized.lower() != term_normalized.lower():
                        print(f"[Wikipedia誤読防止] 🚫 '{term}' の検索結果タイトル '{title}' は完全一致しないため破棄")
                        continue
                    p_url = f"https://ja.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
                    try:
                        req_p = urllib.request.Request(p_url, headers=headers)
                        with urllib.request.urlopen(req_p, timeout=_WIKI_TIMEOUT, context=ctx) as r_p:
                            p_data = json.loads(r_p.read().decode("utf-8"))
                            ext = p_data.get("extract", "")
                            m2 = re.search(r'^[^\(（]*[（\(]([ぁ-んァ-ヶー\s・]+)[、,）\)]', ext)
                            if m2:
                                y2 = m2.group(1).strip().replace("・", "").replace(" ", "")
                                y2 = "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in y2])
                                # Wikipedia曖昧さ回避や関連語の過剰マッチ防止: タイトルと元の未知語の編集距離/包含をチェック
                                y2c = _strip_unmatched_honorific_reading(term, y2)
                                y2c = _strip_unmatched_brand_prefix(term, y2c)
                                if re.match(r'^[A-Za-z0-9\s\-_]+$', term) and len(y2c) > len(term) * 2.5:
                                    print(f"[Wikipedia誤読防止] 🚫 '{term}' の読み '{y2c}' は過剰展開のため破棄")
                                    _wiki_reading_cache[term] = (None, None)
                                    return None, None
                                if len(y2c) >= 2 and y2c not in INVALID_READINGS:
                                    if not is_plausible_reading(term, y2c):
                                        print(f"[Wikipedia誤読防止] 🚫 '{term}' の読み '{y2c}' は漢字表記と乖離しているため破棄")
                                        _wiki_reading_cache[term] = (None, None)
                                        return None, None
                                    _wiki_reading_cache[term] = (y2c, term)
                                    return y2c, term
                    except Exception:
                        pass

        # ── 3. Wikipedia 全文スニペット検索 (単独記事がない「株探」や名字「小籔」等の固有名詞対応) ──
        # 純粋な漢字熟語（2〜3文字）はVOICEVOXが標準的に読めるため、スニペット検索は行わない
        # （例: 「一時」→「いちじしょとく」、「閉鎖」→「へいさとし」のような誤爆を防止）
        if re.match(r'^[\u4e00-\u9fa5]{2,3}$', term):
            _wiki_reading_cache[term] = (None, None)
            return None, None
        sr_url = f"https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(term)}&format=json"
        req_sr = urllib.request.Request(sr_url, headers=headers)
        with urllib.request.urlopen(req_sr, timeout=_WIKI_TIMEOUT, context=ctx) as r_sr:
            sr_data = json.loads(r_sr.read().decode("utf-8"))
            for item in sr_data.get("query", {}).get("search", []):
                snippet = item.get("snippet", "")
                clean_snippet = re.sub(r"<[^>]+>", "", snippet)
                
                # パターンA: "term（よみ）" または "term(よみ)"（直前に英数字や日本語、記号-_・.がない完全単語境界一致）
                m_direct = re.search(r'(?<![A-Za-z0-9\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\-_・.])' + re.escape(term) + r'\.?[（\(]([ぁ-んァ-ヶー]+)[）\)]', clean_snippet)
                if m_direct:
                    y_raw = m_direct.group(1).strip()
                    y_hira = "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in y_raw])
                    # 英字略語で読みが元の長さの2.5倍を超える過剰展開は破棄
                    if re.match(r'^[A-Za-z0-9\s\-_]+$', term) and len(y_hira) > len(term) * 2.5:
                        print(f"[Wikipedia誤読防止] 🚫 '{term}' のスニペット読み '{y_hira}' は過剰展開のため破棄")
                        continue
                    if len(y_hira) >= 2 and y_hira not in INVALID_READINGS:
                        if not is_plausible_reading(term, y_hira):
                            print(f"[Wikipedia誤読防止] 🚫 '{term}' のスニペット読み '{y_hira}' は漢字表記と乖離しているため破棄")
                            continue
                        print(f"[Wikipediaスニペット読み解決] 🎯 '{term}' -> '{y_hira}'")
                        _wiki_reading_cache[term] = (y_hira, term)
                        return y_hira, term

                # パターンB: 人名（漢字名字 term:2~3文字 + 名前 extra_name:1~3文字（名字よみ 名前よみ））
                # ※ 英字略語（AV, AI等）が人名に誤判定されるのを防ぐため、漢字を含む語のみを対象とする
                if re.search(r'[\u4e00-\u9fa5]', term) and len(term) <= 3:
                    m_person = re.search(r'(?<![A-Za-z0-9\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\-_・.])' + re.escape(term) + r"\s*([^\(（\s、。]{1,3})?\s*[（\(]([ぁ-んァ-ヶー\s・]+)[、,）\)]", clean_snippet)
                    if m_person:
                        extra_name = m_person.group(1) or ""
                        y_raw = m_person.group(2).strip().replace("・", " ")
                        y_hira = "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in y_raw])
                        parts = y_hira.split()
                        if extra_name and len(parts) >= 2:
                            y_surname = parts[0]
                            if len(y_surname) >= 2 and y_surname not in INVALID_READINGS:
                                if is_plausible_reading(term, y_surname):
                                    print(f"[Wikipedia人名・名字読み解決] 🎯 '{term}' -> '{y_surname}'")
                                    _wiki_reading_cache[term] = (y_surname, term)
                                    return y_surname, term
                        elif len(parts) == 1 and len(parts[0]) >= 2 and parts[0] not in INVALID_READINGS:
                            if is_plausible_reading(term, parts[0]):
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

    # 2. 英字固有名詞・造語略称（YOASOBI, VIVANT, Number_i等）
    # ※ 一般的な英単語（Japan, Billboard, Apple, Google, SoundScan等）はVOICEVOX内蔵辞書が標準で正しく発音するため、
    #    Wikipedia検索による誤読・誤爆（JAPAN->X JAPAN->えっくすじゃぱん等）を防ぐため除外
    IGNORED_SHORT_WORDS = {
        "https", "http", "www", "com", "net", "jp", "org", "co", "html",
        # 英語の代名詞・前置詞・冠詞・基本語・国名
        "it", "to", "in", "on", "at", "by", "of", "for", "is", "am", "are", "was", "were",
        "do", "go", "he", "me", "my", "we", "us", "no", "so", "up", "an", "as", "be", "if",
        "the", "and", "but", "you", "all", "can", "not", "let", "get", "set", "make", "take",
        "have", "say", "see", "day", "new", "out", "how", "who", "why", "just", "easy", "back", "only",
        "japan", "usa", "uk", "world", "east", "west", "south", "north",
        # 既に静的マップや文脈ルールで解決済みの略語
        "ai", "vr", "ar", "dx", "os", "ui", "ux", "api", "cpu", "gpu", "pc", "tv",
        "url", "pdf", "ssd", "hdd", "usb", "wifi", "nft", "pr", "rpg", "fps", "mmo", "sns", "ev", "iot", "ict"
    }
    # data/tts_rules.json に登録されている略語をすべて除外リストに動的統合（Wikipedia過剰展開を完全防止）
    rules_acronyms = {k.lower() for k in load_tts_rules().get("tech_acronyms", {}).keys()}
    all_ignored = IGNORED_SHORT_WORDS | rules_acronyms

    for m in re.finditer(r'(?<![A-Za-z0-9])(?=[A-Za-z0-9\-_]*[A-Za-z])[A-Za-z0-9\-_]{2,}(?![A-Za-z0-9])', text):
        t = m.group(0)
        # 一般的なキャピタライズ語（先頭大文字＋小文字: Japan, Apple, Billboard等）や小文字語はVOICEVOXに任せる
        if re.match(r'^[A-Z][a-z]+$', t) or re.match(r'^[a-z]+$', t):
            continue
        # キャメルケースの複合英単語（SoundScan, YouTube, TikTok等）もVOICEVOXが自然に読めるため除外
        if re.match(r'^[A-Z][a-z]+(?:[A-Z][a-z]+)+$', t):
            continue
        if t.lower() not in all_ignored:
            terms.append(t)

    # 3. 英字＋数字の固有名詞（F15, AKB48, SKE48, RX7, PS5等）および坂道グループ（乃木坂46, 櫻坂46, 日向坂46等）
    # ※ 一般的な漢字＋数字（例: 到着14便、日午後7時、月10日、総額400億、2回戦3）はVOICEVOXが自然に読める通常の日時・数量表現のため完全除外
    # A. 英字＋数字
    for m in re.finditer(r'(?<![A-Za-z0-9])[A-Za-z]{1,10}\d{1,4}(?![A-Za-z0-9])', text):
        t = m.group(0)
        if not re.match(r'^(?:v\d+|p\d+|s\d+|ch\d+|no\d+)$', t.lower()):
            terms.append(t)

    # B. 坂道シリーズ等の特定漢字＋数字固有名詞（乃木坂46, 櫻坂46, 日向坂46等）
    for m in re.finditer(r'(?:乃木坂|櫻坂|日向坂|吉本坂)46', text):
        terms.append(m.group(0))


    # 4. 敬称・肩書が付いた人名・固有名詞候補（2〜4文字の漢字: 悠仁さま、愛子さま、藤井聡太竜王、角田裕毅選手など）
    # ※ 一般的な普通名詞や組織・役職単体は除外
    NON_NAME_NOUNS = {
        "日本", "関係", "当局", "政府", "会社", "組織", "業界", "組合", "企業", "部署",
        "課長", "部長", "社員", "職員", "教員", "生徒", "学生", "児童", "園児", "警察",
        "市民", "県民", "国民", "本人", "同氏", "両者", "各位", "全員", "一部", "多数",
        "全国", "地元", "報道", "被害", "容疑", "男性", "女性", "少年", "少女", "男児",
        "女児", "家族", "遺族", "親族", "知人", "友人", "同僚", "上司", "部下", "相手",
        "一般", "読者", "観客", "聴衆", "乗客", "住民", "患者", "医師", "看護", "記者",
        "作家", "俳優", "女優", "歌手", "声優", "代表", "役員", "幹部", "関係機関", "日本代表",
        "警察当局", "政府関係", "会社関係",
        # 一般的な動作・状態名詞（VOICEVOXが標準読みできるため除外）
        "到着", "出発", "閉鎖", "再開", "運用", "一時", "停止", "発着", "滑走", "着陸", "離陸",
        "運行", "運転", "延遅", "番線", "来館", "施設", "中断", "通行", "不通", "封鎖",
        "重要", "安全", "確認", "対応", "影響", "遅延", "再起", "開幕", "閉幕", "開催",
        "到達", "発生", "解除", "警戒", "避難", "復旧", "調査", "捜査", "逮捕", "釈放",
        "到着予定", "出発予定", "一時閉鎖", "一時停止", "全面閉鎖", "運用再開",
    }
    HONORIFIC_LOOKAHEAD = (
        r'(?:さま|様|殿|親王|内親王|殿下|妃殿下|さん|氏|君|くん|ちゃん|'
        r'先生|教授|選手|知事|市長|区長|町長|村長|首相|大臣|総理|総裁|長官|議員|社長|会長|'
        r'監督|コーチ|投手|捕手|棋士|名人|竜王|横綱|親方|容疑者|被告)'
    )
    for m in re.finditer(rf'[\u4e00-\u9fa5]{{2,4}}(?={HONORIFIC_LOOKAHEAD})', text):
        t = m.group(0)
        if t not in NON_NAME_NOUNS:
            terms.append(t)

    # 4-B. 敬称が付いた「漢字＋かな/カナ混在」固有名詞候補（星街すいせいさん、宝鐘マリンさん、兎田ぺこらちゃん等）
    for m in re.finditer(rf'[\u4e00-\u9fa5]{{1,4}}[ぁ-んァ-ヴー]{{2,6}}(?={HONORIFIC_LOOKAHEAD})', text):
        t = m.group(0)
        if t not in NON_NAME_NOUNS:
            terms.append(t)

    # 5. 独立した4文字の漢字ブロック（人名フルネーム・固有名詞候補: 板野友美、大谷翔平、藤井聡太など）
    # ※ 前後に他の漢字が連続しない独立した4文字漢字を抽出
    for m in re.finditer(r'(?<![\u4e00-\u9fa5])[\u4e00-\u9fa5]{4}(?![\u4e00-\u9fa5])', text):
        t = m.group(0)
        if t not in NON_NAME_NOUNS:
            # NON_NAME_NOUNSに含まれる普通名詞が組み合わさった複合語も除外
            # （例:「市民全員」=「市民」+「全員」、「国民全員」、「住民全員」等）
            if any(n in t for n in NON_NAME_NOUNS):
                continue
            terms.append(t)

    return list(dict.fromkeys(terms))


def resolve_text_readings(text, custom_dict=None):
    """
    文章全体に対して辞書置換・英語発音マップ・Wikipedia/Web読み方解決を一括適用
    """
    if not text:
        return text

    normalized = normalize_fullwidth_alphanumeric(text)
    normalized = apply_age_and_counter_rules(normalized)
    normalized = apply_special_reading_fixes(normalized)
    normalized = apply_it_context_rules(normalized)
    normalized = apply_tech_acronyms(normalized)
    normalized = apply_okonau_context_rules(normalized)
    normalized = apply_country_prefixes(normalized)
    normalized = sanitize_speech_text(normalized)

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

    # 2. 文脈固有名詞ルール（皇族・著名人などの敬称付き発音解決）
    normalized = apply_contextual_proper_nouns_rules(normalized)

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
    """不要なネットスラングや記号、読み上げを乱すドメイン名末尾のサニタイズ（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    t = re.sub(r'[\(（][笑草爆][）\)]', '', t)
    t = re.sub(r'(?<![A-Za-z0-9])[wWｗW]{2,}(?![A-Za-z0-9])', '', t)
    rules = load_tts_rules()
    for pat in rules.get("sanitize_domain_patterns", []):
        t = re.sub(pat, '', t)
    return t.strip()

def apply_country_prefixes(text):
    """報道文法における国名1文字プレフィックス（例: 米アンソロピック -> べいアンソロピック）の正規化"""
    if not text:
        return ""
    t = text
    rules = load_tts_rules()
    prefixes = rules.get("country_prefixes", COUNTRY_PREFIX_MAP)
    for char, yomi in prefixes.items():
        t = re.sub(
            rf'(?<![一-龥ぁ-んァ-ヶA-Za-z]){re.escape(char)}(?=[ァ-ヴーA-Z][ァ-ヴーA-Za-z0-9・]+)',
            f'{yomi}',
            t
        )
    return t

def apply_it_context_rules(text):
    """「IT」の多義性（情報技術 vs 映画『IT』 vs 英語代名詞 it）を文脈から解決（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    rules = load_tts_rules()
    for item in rules.get("it_context_rules", []):
        pat = item.get("pattern")
        rep = item.get("replacement")
        if pat and rep:
            t = re.sub(pat, rep, t)
    return t

def apply_tech_acronyms(text):
    """大文字・正規表記のテクノロジー略語マップの適用（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    acronyms = load_tts_rules().get("tech_acronyms", {})
    for acronym, yomi in sorted(acronyms.items(), key=lambda x: len(x[0]), reverse=True):
        if acronym in t:
            t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(acronym)}(?![A-Za-z0-9])', yomi, t)
    return t

def apply_okonau_context_rules(text):
    """「行う（おこなう）」と「行く（いく）」の同音異義語を文脈から安全に解決（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    rules = load_tts_rules()
    for item in rules.get("okonau_context_rules", []):
        pat = item.get("pattern")
        rep = item.get("replacement")
        if pat and rep:
            t = re.sub(pat, rep, t)
    return t

def apply_person_kata_rules(text):
    """人を指す「方（かた）」と同音異義語（方向・比較「方（ほう）」）を文脈から解決（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    rules = load_tts_rules()
    for item in rules.get("person_kata_rules", []):
        pat = item.get("pattern")
        rep = item.get("replacement")
        if pat and rep:
            t = re.sub(pat, rep, t)
    return t

def apply_age_and_counter_rules(text):
    """年齢・助数詞に対する誤読・誤ルビの修復（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    rules = load_tts_rules()
    for item in rules.get("age_and_counter_rules", []):
        pat = item.get("pattern")
        rep = item.get("replacement")
        if pat and rep:
            t = re.sub(pat, rep, t)
    return t

def apply_special_reading_fixes(text):
    """単漢字・身体部位・文脈誤読の修復（data/tts_rules.json より動的適用）"""
    if not text:
        return ""
    t = text
    rules = load_tts_rules()

    # 1. 単語直接置換（肩甲骨等）
    for word, yomi in rules.get("word_reading_fixes", {}).items():
        if word in t:
            t = t.replace(word, yomi)

    # 2. 文脈正規表現ルール（春日、白露、気象予報士など）
    for rule in rules.get("context_regex_fixes", []):
        pat = rule.get("pattern")
        rep = rule.get("replacement")
        if pat and rep:
            t = re.sub(pat, rep, t)

    return t



# ── 人名フルネームから「姓」の読み取得キャッシュ ──
_wiki_surname_cache = {}

def get_wikipedia_surname_reading(full_name):
    """
    フルネーム（例: 大谷翔平、角田裕毅、藤井聡太）から、
    Wikipediaの括弧内分かち書き読み（'おおたに しょうへい'）を解析して
    正確な姓の読み（'おおたに'、'つのだ'、'ふじい'）を取得する。
    """
    if not full_name or len(full_name) < 3:
        return None
    if full_name in _wiki_surname_cache:
        return _wiki_surname_cache[full_name]

    ctx = ssl._create_unverified_context()
    headers = {"User-Agent": "VStudio-TTS-Bot/1.0 (https://github.com/junichiakahori/VStudio)"}

    try:
        ext_url = (
            "https://ja.wikipedia.org/w/api.php"
            "?action=query&prop=extracts&exintro=true&exsentences=2"
            "&explaintext=true&titles={}&redirects=1&format=json"
        ).format(urllib.parse.quote(full_name))

        req = urllib.request.Request(ext_url, headers=headers)
        with urllib.request.urlopen(req, timeout=_WIKI_TIMEOUT, context=ctx) as r:
            data = json.loads(r.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if pid == "-1":
                    continue
                extract = pdata.get("extract", "")
                m = re.search(r'[\(（]\s*([ぁ-んァ-ヶゔヴー・、\s,，/／]+)', extract)
                if m:
                    raw_bracket = m.group(1).strip()
                    first_read = re.split(r'[、,，\t\n/／|｜]|\s{2,}', raw_bracket)[0].strip()
                    parts = re.split(r'[・\s]+', first_read)
                    if len(parts) >= 2:
                        surname_raw = parts[0].strip()
                        surname_hira = "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in surname_raw])
                        surname_clean = re.sub(r'[^ぁ-んゔー]', '', surname_hira)
                        if len(surname_clean) >= 2:
                            _wiki_surname_cache[full_name] = surname_clean
                            return surname_clean
    except Exception:
        pass

    _wiki_surname_cache[full_name] = None
    return None


def build_context_pronunciation_map(full_context, custom_dict=None):
    """
    ニュース記事全体（タイトル＋本文＋生成された原稿全文）を一括して解析し、
    文脈から得られる固有名詞・人名・皇族名・略語の読み方マップを構築する。
    これにより、原稿各文の読み上げ生成時に、前後の文脈（フルネーム、敬称等）が100%共有される。
    """
    if not full_context:
        return {}

    t = normalize_fullwidth_alphanumeric(full_context)
    context_map = {}

    # 1. 皇族・著名人の文脈敬称ルールから抽出
    for pattern, yomi in IMPERIAL_PROPER_NOUNS:
        for m in re.finditer(pattern, t):
            matched_term = m.group(0)
            if matched_term and matched_term not in context_map:
                context_map[matched_term] = yomi

    # 2. 特殊固有名詞・敬称付き人名の抽出
    terms = extract_special_terms(t)
    terms_sorted = sorted(terms, key=lambda x: len(x), reverse=True)

    derived_surnames = {}
    for term in terms_sorted:
        if term in context_map:
            continue
        yomi, _ = lookup_wikipedia_reading(term)
        if yomi:
            context_map[term] = yomi

            # 4文字の人名漢字（例: 角田裕毅 -> つのだ、大谷翔平 -> おおたに）の場合、姓の正確な読みを導出
            if len(term) == 4 and re.match(r'^[\u4e00-\u9fa5]{4}$', term):
                surname_kanji = term[:2]
                # Wikipediaのリード文分かち書きから姓の読みを厳密取得
                exact_surname_yomi = get_wikipedia_surname_reading(term)
                if exact_surname_yomi:
                    derived_surnames[surname_kanji] = exact_surname_yomi
                elif len(yomi) >= 4:
                    half_len = len(yomi) // 2
                    if len(yomi) % 2 != 0:
                        half_len = (len(yomi) + 1) // 2
                    derived_surnames[surname_kanji] = yomi[:half_len]

    # 姓の文脈を記録（敬称パターンと連動）
    for s_kanji, s_yomi in derived_surnames.items():
        if s_kanji not in context_map:
            context_map[s_kanji] = s_yomi

    return context_map


def normalize_for_tts(text, custom_dict=None, log_collector=None, context_map=None):
    """
    TTS用テキストの包括的正規化処理（文脈解決 -> 辞書 -> 英語マップ -> Wikipedia動的解決 -> サニタイズ）
    ※ 漢字の形態素解析・アクセント分割はVOICEVOX (OpenJTalk) 本来の文脈解析エンジンに委ね、機械的ひらがな化による誤読破壊を防止
    """
    if not text:
        return ""

    # -1. 全角英数字を半角に統一（「ＶＩＶＡＮＴ」や「ＡＩ」等のチェックすり抜け・スペル読みを防止）
    t = normalize_fullwidth_alphanumeric(text)

    # 0. 記事全体から構築された文脈読みマップ（context_map）を最優先適用（前後の文脈・フルネームの共有）
    if context_map and isinstance(context_map, dict):
        for term, yomi in sorted(context_map.items(), key=lambda x: len(x[0]), reverse=True):
            if term and yomi and term in t:
                # 姓2文字の場合は敬称または助詞が続く場合のみ安全に置換して誤爆を防止
                if len(term) == 2 and re.match(r'^[\u4e00-\u9fa5]{2}$', term):
                    t = re.sub(
                        rf'(?<![\u4e00-\u9fa5]){re.escape(term)}(?=(?:さま|様|殿|さん|氏|選手|知事|市長|首相|大臣|総理|総裁|議員|社長|会長|監督|コーチ|投手|捕手|棋士|は|の|が|を|に|で|と|も))',
                        yomi,
                        t
                    )
                else:
                    t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])', yomi, t)

    # 0.5 年齢・助数詞および単漢字誤変換（気象予報士 ➔ さむらい）の修復
    t = apply_age_and_counter_rules(t)
    t = apply_special_reading_fixes(t)

    # 0.55 方言（関西弁）・役割語の標準語化（「〜やろ」「〜んやろ」「じゃが」等の自動補正）
    t = re.sub(r'(?:^|(?<=[。、！？\s　]))じゃが(?!いも|バター|りこ)[、,\s　]*', 'だが、', t)
    t = re.sub(r'なんじゃが(?!いも|バター|りこ)', 'なんだが', t)
    t = re.sub(r'んじゃが(?!いも|バター|りこ)', 'んだが', t)
    t = re.sub(r'(?<![ぁ-んァ-ヶー一-鿿])じゃが(?!いも|バター|りこ)', 'だが', t)
    t = re.sub(r'んやろにゃ([！!？?。、\s　]|$)', r'んだろうにゃ\1', t)
    t = re.sub(r'やろにゃ([！!？?。、\s　]|$)', r'だろうにゃ\1', t)
    t = re.sub(r'んやろのだ([！!？?。、\s　]|$)', r'んだろうのだ\1', t)
    t = re.sub(r'やろのだ([！!？?。、\s　]|$)', r'だろうのだ\1', t)
    t = re.sub(r'んやろ([か？\?！!。、\s　]|な|ね|$)', r'んだろう\1', t)
    t = re.sub(r'やろ([か？\?！!。、\s　]|な|ね|$)', r'だろう\1', t)
    t = re.sub(r'んやな([！!？?。、\s　]|$)', r'んだな\1', t)
    t = re.sub(r'やな([！!？?。、\s　]|$)', r'だな\1', t)
    t = re.sub(r'んやね([！!？?。、\s　]|$)', r'んだね\1', t)
    t = re.sub(r'やね([！!？?。、\s　]|$)', r'だね\1', t)
    t = re.sub(r'ねんにゃ([！!？?。、\s　]|$)', r'んだにゃ\1', t)
    t = re.sub(r'ねんのだ([！!？?。、\s　]|$)', r'んだのだ\1', t)
    t = re.sub(r'のじゃ([！!？?。、\s　]|$)', r'のだ\1', t)
    t = re.sub(r'なんじゃ([！!？?。、\s　]|$)', r'なんだ\1', t)
    t = re.sub(r'んじゃ([！!？?。、\s　]|$)', r'んだ\1', t)

    # 0.6 不自然な語尾脱落（「されにゃ」「られにゃ」➔「されたにゃ」「られたにゃ」等）の自動修復
    t = re.sub(r'されにゃ([！!？?。、\s　]|$)', r'されたにゃ\1', t)
    t = re.sub(r'されのだ([！!？?。、\s　]|$)', r'されたのだ\1', t)
    t = re.sub(r'られにゃ([！!？?。、\s　]|$)', r'られたにゃ\1', t)
    t = re.sub(r'られのだ([！!？?。、\s　]|$)', r'られたのだ\1', t)
    t = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)しにゃ([！!？?。、\s　]|$)', r'\1したにゃ\2', t)
    t = re.sub(r'([ぁ-んァ-ヶー一-鿿]+)しのだ([！!？?。、\s　]|$)', r'\1したのだ\2', t)
    t = re.sub(r'(?<!どんな)(?<!いい)(?<!良い)(?<!って)(?<!いう)(?<!な)感じにゃ([！!？?。、\s　]|$)', r'感じたにゃ\1', t)
    t = re.sub(r'(?<!どんな)(?<!いい)(?<!良い)(?<!って)(?<!いう)(?<!な)感じのだ([！!？?。、\s　]|$)', r'感じたのだ\1', t)
    t = re.sub(r'([ぁ-んァ-ヶー一-鿿]+[報信応演生命論禁])じにゃ([！!？?。、\s　]|$)', r'\1じたにゃ\2', t)
    t = re.sub(r'([ぁ-んァ-ヶー一-鿿]+[報信応演生命論禁])じのだ([！!？?。、\s　]|$)', r'\1じたのだ\2', t)

    # 0.7 連続した「にゃにゃ」「のだのだ」の重複除去（「考えるにゃにゃ！」➔「考えるにゃ！」）
    t = re.sub(r'(?:にゃ[\s　、]*){2,}', 'にゃ', t)
    t = re.sub(r'(?:のだ[\s　、]*){2,}', 'のだ', t)

    # 1. 文脈考慮型のIT発音解決（映画『IT』 vs 英語代名詞 it vs 情報技術 大文字IT）
    t = apply_it_context_rules(t)

    # 2. テクノロジー大文字略語マップ適用（Case-sensitive）
    t = apply_tech_acronyms(t)

    # 3. 一般英単語（※VOICEVOX内蔵辞書で標準処理）

    # 4. 固有名詞の文脈保護ルール（皇族・著名人の文脈読み＆動詞「探す」と重複する「株探」の誤爆防止）
    t = apply_contextual_proper_nouns_rules(t)
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
    t = apply_person_kata_rules(t)

    # 7. 特殊固有名詞のWikipedia動的解決（フルネーム優先・文脈姓連動）
    terms = extract_special_terms(t)
    # 長い固有名詞（フルネーム等）を優先して解決し、その姓の読みを文脈マップに蓄積
    terms_sorted = sorted(terms, key=lambda x: len(x), reverse=True)
    derived_surnames = {}

    for term in terms_sorted:
        yomi, _ = lookup_wikipedia_reading(term)
        if yomi:
            print(f"[Wikipedia自動発音解決] '{term}' ➔ '{yomi}'", flush=True)
            if log_collector is not None and isinstance(log_collector, list):
                log_collector.append({"term": term, "yomi": yomi})
            t = re.sub(rf'(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])', yomi, t)

            # 4文字の人名漢字（例: 角田裕毅 -> つのだゆうき）の場合、姓2文字（角田 -> つのだ）の文脈を導出
            if len(term) == 4 and re.match(r'^[\u4e00-\u9fa5]{4}$', term) and len(yomi) >= 4:
                surname_kanji = term[:2]
                # 読みの前半（姓の読み）を概算または形態素から安全に派生
                # 例: つのだ(3) + ゆうき(3) = 6 -> 前半3文字
                half_len = len(yomi) // 2
                if len(yomi) % 2 != 0:
                    half_len = (len(yomi) + 1) // 2
                surname_yomi = yomi[:half_len]
                derived_surnames[surname_kanji] = surname_yomi

    # 派生した姓の文脈を、敬称・肩書が付いた単独姓（角田選手、角田氏等）へ安全に適用
    for s_kanji, s_yomi in derived_surnames.items():
        t = re.sub(rf'{re.escape(s_kanji)}(?=(?:さま|様|殿|さん|氏|選手|知事|市長|首相|大臣|総理|総裁|議員|社長|会長|監督|コーチ|投手|捕手|棋士))', s_yomi, t)

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


def heal_sentence_reading(display_text, speech_text):
    """
    生成された原稿の1文について、字幕用(display)と音声用(speech)を突き合わせ、
    意味破壊・異常置換（例: 一時閉鎖 -> すもうべや、横開き -> ふながこい、約1 -> えむわんぐらんぷり、運用 -> じょうば等）
    を検知して元の漢字（VOICEVOXの標準文脈読み）へ安全に自己修復（ロールバック）する。
    """
    if not display_text or not speech_text:
        return speech_text or display_text or ""

    matcher = difflib.SequenceMatcher(None, display_text, speech_text)
    healed_parts = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            healed_parts.append(speech_text[j1:j2])
        elif tag == "replace":
            orig = display_text[i1:i2]
            rep = speech_text[j1:j2]
            if is_plausible_reading(orig, rep):
                healed_parts.append(rep)
            else:
                print(f"[誤読自己修復] 🩹 異常置換検知: '{orig}' -> '{rep}' を元の '{orig}' へロールバック", flush=True)
                healed_parts.append(orig)
        elif tag == "delete":
            # display側にあるがspeech側で意図せず削られた場合
            healed_parts.append(display_text[i1:i2])
        elif tag == "insert":
            healed_parts.append(speech_text[j1:j2])

    healed_result = "".join(healed_parts)
    return healed_result
