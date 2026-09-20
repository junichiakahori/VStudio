# -*- coding: utf-8 -*-
"""
web_pronunciation_resolver.py
未知の固有名詞・人名・グループ名等の読み方を、Web（Wikipedia API + DuckDuckGo）から
自動検索・特定し、pronunciation_memory.json に自動永続学習させる専用サービスモジュール。
"""

import os
import sys
import re
import json
import time
import datetime
import urllib.request
import urllib.parse
import ssl
from typing import Optional, Dict, Any, List

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRONUNCIATION_MEMORY_PATH = os.path.join(BASE_DIR, "data", "pronunciation_memory.json")

_WIKI_API_URL = "https://ja.wikipedia.org/w/api.php"
_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
_TIMEOUT = 3.5

def _get_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def is_already_registered(term: str) -> bool:
    """既に pronunciation_memory.json に登録されているか確認"""
    if not os.path.exists(PRONUNCIATION_MEMORY_PATH):
        return False
    try:
        with open(PRONUNCIATION_MEMORY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            records = data.get("records", [])
            return any(r.get("surface") == term for r in records)
    except Exception:
        return False

def save_to_pronunciation_memory(
    surface: str,
    reading: str,
    wrong_reading: str = "",
    note: str = "",
    category: str = "general",
    sample_sentence: str = "",
    article_topic: str = "",
    context_keywords: Optional[List[str]] = None,
    scope: str = ""
) -> bool:
    """判明した読み方を pronunciation_memory.json に文脈情報付きで永続追加・保存"""
    if not surface or not reading or surface == reading:
        return False
    try:
        mem_data = {"version": "2.0", "records": []}
        if os.path.exists(PRONUNCIATION_MEMORY_PATH):
            with open(PRONUNCIATION_MEMORY_PATH, "r", encoding="utf-8") as f:
                mem_data = json.load(f)

        records = mem_data.setdefault("records", [])

        # 自動スコープ判定（未指定の場合）:
        # 2〜3文字の漢字熟語・苗字は地名や同姓異名の誤爆を防ぐため contextual に設定
        if not scope:
            if len(surface) in (2, 3) and re.match(r'^[\u4e00-\u9fa5]+$', surface):
                scope = "contextual"
            else:
                scope = "global"

        # 既存更新または新規追加
        for r in records:
            if r.get("surface") == surface:
                r["reading"] = reading
                if wrong_reading:
                    r["wrong_reading"] = wrong_reading
                r["updated_date"] = datetime.datetime.now().strftime("%Y-%m-%d")
                if article_topic and not r.get("article_topic"):
                    r["article_topic"] = article_topic
                if context_keywords:
                    existing_kw = set(r.get("context_keywords", []))
                    existing_kw.update([k for k in context_keywords if k])
                    r["context_keywords"] = list(existing_kw)
                if note:
                    r["note"] = note
                with open(PRONUNCIATION_MEMORY_PATH, "w", encoding="utf-8") as f:
                    json.dump(mem_data, f, ensure_ascii=False, indent=2)
                return True

        new_record = {
            "id": f"auto_{int(time.time())}_{abs(hash(surface)) % 10000}",
            "surface": surface,
            "reading": reading,
            "wrong_reading": wrong_reading,
            "scope": scope,
            "article_topic": article_topic or f"{surface}に関するニュース",
            "sample_sentence": sample_sentence or f"{surface}に関する最新情報です。",
            "category": category,
            "registered_date": datetime.datetime.now().strftime("%Y-%m-%d"),
            "note": note or "Web検索（自動解決）により記憶"
        }
        if scope == "contextual" and context_keywords:
            new_record["context_keywords"] = [k for k in context_keywords if k]
        elif scope == "contextual" and not context_keywords and article_topic:
            words = [w for w in re.findall(r'[\u4e00-\u9fa5]{2,}|[ァ-ヶー]{2,}|[A-Za-z0-9]{2,}', article_topic) if len(w) >= 2]
            new_record["context_keywords"] = words[:6]

        records.append(new_record)

        with open(PRONUNCIATION_MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump(mem_data, f, ensure_ascii=False, indent=2)
        print(f"🧠 [自動記憶] 新しい読み方を台帳に保存しました: '{surface}' ➔ 正読:'{reading}' 誤読:'{wrong_reading or 'なし'}' (scope: {scope}, topic: {article_topic or '一般'})", flush=True)
        return True
    except Exception as e:
        print(f"⚠️ [自動記憶エラー] 保存失敗: {e}", flush=True)
        return False

def fetch_wikipedia_ruby(term: str) -> Optional[str]:
    """
    Wikipedia API を使って単語の冒頭括弧から読み仮名を抽出。
    例: 「乃木坂46」 ➔ 「乃木坂46（のぎざかフォーティーシックス、Nogizaka46）は、...」 ➔ 「のぎざかフォーティーシックス」
    """
    if not term:
        return None
    ctx = _get_ssl_context()
    headers = {"User-Agent": _USER_AGENT}

    try:
        # 1. 記事直接取得（リダイレクト解決付き）
        url = (
            f"{_WIKI_API_URL}?action=query&prop=extracts&exintro=true&exsentences=2"
            f"&explaintext=true&titles={urllib.parse.quote(term)}&redirects=1&format=json"
        )
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=_TIMEOUT, context=ctx) as r:
            data = json.loads(r.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if pid == "-1":
                    continue
                extract = pdata.get("extract", "")
                ruby = _extract_ruby_from_text(term, extract)
                if ruby:
                    return ruby
    except Exception:
        pass

    try:
        # 2. Wikipedia 検索（完全一致タイトルの探索）
        s_url = f"{_WIKI_API_URL}?action=query&list=search&srsearch={urllib.parse.quote(term)}&format=json"
        req_s = urllib.request.Request(s_url, headers=headers)
        with urllib.request.urlopen(req_s, timeout=_TIMEOUT, context=ctx) as r_s:
            data = json.loads(r_s.read().decode("utf-8"))
            for res in data.get("query", {}).get("search", [])[:3]:
                title = res.get("title", "")
                if title == term or title.startswith(f"{term} (") or title.startswith(f"{term}（"):
                    ext_url = (
                        f"{_WIKI_API_URL}?action=query&prop=extracts&exintro=true&exsentences=2"
                        f"&explaintext=true&titles={urllib.parse.quote(title)}&redirects=1&format=json"
                    )
                    req2 = urllib.request.Request(ext_url, headers=headers)
                    with urllib.request.urlopen(req2, timeout=_TIMEOUT, context=ctx) as r2:
                        p2 = json.loads(r2.read().decode("utf-8")).get("query", {}).get("pages", {})
                        for _, pd2 in p2.items():
                            ruby = _extract_ruby_from_text(term, pd2.get("extract", ""))
                            if ruby:
                                return ruby
    except Exception:
        pass

    return None

def _extract_ruby_from_text(term: str, extract_text: str) -> Optional[str]:
    """Wikipedia本文冒頭から読み仮名（ひらがな・カタカナ）を抽出"""
    if not extract_text:
        return None
    # 冒頭 200 文字以内に現れる括弧 （...） または (...) を探索
    head = extract_text[:200]
    m = re.search(r'[\(（]([^\)）]+)[\)）]', head)
    if not m:
        return None
    content = m.group(1).strip()
    # 英語表記や別名、「もしくは」「または」等の注釈表現で分割し、最初の読みブロックを取得
    first_part = re.split(r'[,、，/／;；|｜]|\s*(?:もしくは|または|あるいは|および)\s*', content)[0].strip()
    # アルファベット併記を除去（例: "のぎざかフォーティーシックス Nogizaka46"）
    first_part = re.sub(r'[A-Za-z0-9\-_.]+', '', first_part).strip()
    
    # ひらがな・カタカナ・長音符のみを抽出
    cleaned = re.sub(r'[^ぁ-んァ-ヶー・]', '', first_part).replace('・', '')
    if len(cleaned) >= 2 and len(cleaned) <= max(len(term) * 5, 20):
        # 助詞切れ・文末語尾ゴミの遮断
        if not re.search(r'(?:の|が|は|で|を|に|へ|と|です|ます)$', cleaned):
            return cleaned
    return None

def search_duckduckgo_reading(term: str) -> Optional[str]:
    """
    DuckDuckGo HTML検索で「{term} 読み方」を検索し、スニペットから読み仮名を抽出。
    APIキー不要・完全無料。
    """
    ctx = _get_ssl_context()
    query = f"{term} 読み方"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    headers = {
        "User-Agent": _USER_AGENT,
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=_TIMEOUT, context=ctx) as r:
            html = r.read().decode("utf-8", errors="ignore")
            # 検索結果のスニペット（a class="result__snippet" または class="result__snippet"）を抽出
            snippets = re.findall(r'<a class="result__snippet[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
            if not snippets:
                snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</div>', html, re.DOTALL)

            for s in snippets[:4]:
                clean_s = re.sub(r'<[^>]+>', '', s).strip()
                ruby = _extract_ruby_from_snippet(term, clean_s)
                if ruby:
                    return ruby
    except Exception as e:
        print(f"⚠️ [DuckDuckGo検索失敗] {e}", flush=True)
    return None

def _extract_ruby_from_snippet(term: str, snippet: str) -> Optional[str]:
    """検索スニペットから「term（よみ）」や「読み方は『よみ』」等のパターンを抽出"""
    if not snippet:
        return None

    GARBAGE_PATTERNS = {"のページです", "について", "があります", "がもうちょっとで", "一覧", "案内", "検索", "公式", "サイト", "こちら", "クリック", "詳細", "スティレット"}
    if any(gp in snippet for gp in GARBAGE_PATTERNS):
        return None

    candidates = []

    # パターン1: term（よみ） または term(よみ)
    m1 = re.search(re.escape(term) + r'[\(（]([ぁ-んァ-ヶー・\s]+)[\)）]', snippet)
    if m1:
        c = re.sub(r'[^ぁ-んァ-ヶー]', '', m1.group(1).replace('・', '').replace(' ', ''))
        candidates.append(c)

    # パターン2: 読み方は「よみ」 / 読み方は『よみ』 / 読み：よみ
    m2 = re.search(r'(?:読み方|読み|よみ|発音)(?:は|：|:)?\s*[「『（\(]?([ぁ-んァ-ヶー]+)[」』）\)]?', snippet)
    if m2:
        candidates.append(m2.group(1).strip())

    # パターン3: 「term」の読み方は「よみ」
    m3 = re.search(re.escape(term) + r'[^。]*?(?:読み方|読み)(?:は|：|:)?\s*[「『（\(]?([ぁ-んァ-ヶー]+)[」』）\)]?', snippet)
    if m3:
        candidates.append(m3.group(1).strip())

    for c in candidates:
        if 2 <= len(c) <= max(len(term) * 5, 20):
            # 助詞切れ・文末語尾ゴミの遮断
            if not re.search(r'(?:の|が|は|で|を|に|へ|と|です|ます)$', c):
                if not any(gp in c for gp in GARBAGE_PATTERNS):
                    return c

    return None

def is_valid_reading_for_term(term: str, ruby: str) -> bool:
    """
    元の単語と取得した読み仮名の妥当性を検証。
    リダイレクトによる長大別名（例: 震度3 -> きしょうちょうしんどかいきゅう）や、
    一般的苗字（神田 -> かんだ）に対するニッチな歴史用語（神田 -> しんでん）の誤爆を100%遮断。
    """
    if not term or not ruby:
        return False
    # 漢字・英数字を含む単語に対して、読みが異常に長大（3.5倍以上かつ8文字超）な場合は除外
    if len(ruby) > max(len(term) * 3, 8) and len(ruby) > 9:
        return False

    # 助詞切れ・文末ゴミの遮断
    if re.search(r'(?:の|が|は|で|を|に|へ|と|です|ます)$', ruby):
        return False

    # 明らかに無関係な単語の除外
    DISALLOWED_READING_KEYWORDS = {
        "かいきゅう", "しょうさい", "いちらん", "あいまいで", "たいしょう", "しんでん",
        "のぺえじ", "のページ", "について", "あります", "もうちょっと", "スティレット",
        "もしくは", "または"
    }
    if any(kw in ruby for kw in DISALLOWED_READING_KEYWORDS):
        return False

    # 短い英数字・型番（例: X3, F1, F15, ROG20）に対して無関係な会社名や架空兵器名が割り当てられるのを防止
    if re.match(r'^[A-Za-z0-9\-_]+$', term):
        # 英語・数字の型番なのに、アルファベット音や数字音を含まない日本語名（例: F15 -> ボーイング）は除外
        if re.search(r'[\u3040-\u30ff]', ruby):
            ALPHABET_SOUNDS = {"エフ", "エー", "ビー", "シー", "ディー", "イー", "ジー", "エイチ", "アイ", "ジェイ", "ケー", "エル", "エム", "エヌ", "オー", "ピー", "キュー", "アール", "エス", "ティー", "ユー", "ブイ", "ダブリュー", "エックス", "ワイ", "ゼット", "ワン", "ツー", "スリー", "フォー", "ファイブ", "シックス", "セブン", "エイト", "ナイン", "テン"}
            has_acronym_sound = any(snd in ruby for snd in ALPHABET_SOUNDS)
            has_number = any(c.isdigit() for c in term)
            # アルファベットの型番なのにアルファベット音が一切入っていない日本語（例: ボーイング）は除外
            if not has_acronym_sound:
                return False

    # 漢字熟語に対して、同義語・第一次産業等のリダイレクト先別名義にすり替わるのを防止
    kanji_chars = [c for c in term if "\u4e00" <= c <= "\u9fa5"]
    if len(kanji_chars) >= 2:
        try:
            import pykakasi
            kks = pykakasi.kakasi()
            std_hira = "".join([it.get("hira", "") for it in kks.convert(term)])
            # 標準読みと全く一致せず、類似度も著しく低い（同義語リダイレクトの典型例: 農林水産 -> だいいちじさんぎょう 等）
            import difflib
            sim = difflib.SequenceMatcher(None, std_hira, ruby).ratio()
            # 3文字以上の熟語で類似度が0.40未満の場合は同義語リダイレクトとみなして除外
            if len(kanji_chars) >= 3 and sim < 0.40:
                return False
        except Exception:
            pass

    from server.tts_normalizer import is_plausible_reading
    if not is_plausible_reading(term, ruby):
        return False

    return True

def resolve_unknown_reading_online(
    term: str,
    auto_save: bool = True,
    article_title: str = "",
    context_keywords: Optional[List[str]] = None,
    scope: str = ""
) -> Optional[str]:
    """
    未知語の読み方を Web（Wikipedia ➔ DuckDuckGo）で自動解決。
    成功した場合は自動で pronunciation_memory.json に文脈情報付きで保存して永続学習。
    """
    if not term or len(term) < 2:
        return None

    # 既に登録済みならスキップ
    if is_already_registered(term):
        return None

    print(f"🔍 [Web読み方検索開始] 対象: '{term}'", flush=True)

    # 1. まずWikipediaを調査（高精度・公式・高速）
    ruby = fetch_wikipedia_ruby(term)
    source = "wikipedia"

    # 2. Wikipediaで取れなければDuckDuckGoで「〇〇 読み方」を検索
    if not ruby:
        ruby = search_duckduckgo_reading(term)
        source = "duckduckgo"

    if ruby and is_valid_reading_for_term(term, ruby):
        print(f"✨ [Web読み方解決成功] '{term}' ➔ '{ruby}' (情報源: {source})", flush=True)
        if auto_save:
            # VOICEVOXのデフォルト読みをプレ取得し、正解(ruby)と相違があれば誤読(wrong_reading)としてペア記録
            wrong_reading = ""
            try:
                from server.voicevox_client import get_voicevox_reading_and_kana
                vv_reading, _ = get_voicevox_reading_and_kana(term)
                if vv_reading:
                    import pykakasi
                    kks = pykakasi.kakasi()
                    res = kks.convert(vv_reading)
                    hira_reading = "".join([it.get("hira", "") for it in res]).strip()
                    if hira_reading and hira_reading != ruby:
                        wrong_reading = hira_reading
            except Exception:
                pass

            save_to_pronunciation_memory(
                surface=term,
                reading=ruby,
                wrong_reading=wrong_reading,
                note=f"Web自動解決 ({source})" + (f" (VOICEVOX誤読: {wrong_reading})" if wrong_reading else ""),
                category="web_auto_resolved",
                article_topic=article_title,
                context_keywords=context_keywords,
                scope=scope
            )
        return ruby

    print(f"ℹ️ [Web読み方未検出/無効判定] '{term}' の妥当な読み方はWebから特定できませんでした。", flush=True)
    return None

def extract_candidate_terms_from_text(text: str) -> List[str]:
    """
    ニュース本文や原稿から「読み方が怪しい・調べた方が良い単語候補」を自動抽出。
    ・特定アイドル・固有名詞＋数字（乃木坂46, AKB48, SiC, PS5等）
    ・敬称付き固有名詞（〇〇選手、〇〇氏など）
    ※ 一般的な数量・度量衡・日時・順位表現（震度3、100カ所、第1位等）は完全除外
    """
    if not text:
        return []
    candidates = []

    # 数量・単位・度量衡・日時の一般表現フィルター
    def is_quantity_or_common_measure(word: str) -> bool:
        if re.search(r'^(?:震度|マグニチュード|M|約|およそ|最大|最小|第|トップ)?\d+(?:\.\d+)?(?:度|強|弱|人|件|カ所|カ国|店舗|社|割|倍|％|%|点|円|ドル|勝|敗|分|秒|時間|時|日|月|年|歳|本|台|機|隻|匹|位|番)?$', word):
            return True
        if re.search(r'^(?:国内外|全国|各地|都内|市内|道内|府内|県内|海外|前年|前月|前日|過去|平均|計|合計|定員|募集|先着|限定)', word):
            return True
        return False

    # 1. 坂道シリーズ等の特定漢字＋数字（乃木坂46、櫻坂46、日向坂46、吉本坂46等）
    for m in re.finditer(r'((?:乃木坂|櫻坂|日向坂|吉本坂|欅坂|坂道)\d{1,3})', text):
        candidates.append(m.group(1))

    # 2. 英字＋数字の固有名詞（AKB48, SKE48, F15, iPhone16, PS5等）
    for m in re.finditer(r'(?<![A-Za-z0-9])([A-Za-z]{1,8}\d{1,4})(?![A-Za-z0-9])', text):
        w = m.group(1)
        if not re.match(r'^(?:v\d+|p\d+|s\d+|ch\d+|no\d+|\d+)$', w.lower()):
            candidates.append(w)

    # 3. 敬称・肩書つきの固有名詞候補（3〜4文字の珍しい人名フルネームを優先）
    # ※ 神田、田中、鈴木などの2文字の一般的苗字はTTSが標準で正確に読めるため、Web検索で歴史用語（神田->しんでん）を誤爆させないよう除外
    HONORIFIC = r'(?:選手|監督|知事|市長|首相|大臣|総理|総裁|議員|社長|会長|棋士|容疑者|被告)'
    COMMON_SURNAMES_AND_WORDS = {
        "政府", "警察", "当局", "関係", "会社", "組織", "日本", "全国", "自民", "公明", "立憲", "共産",
        "神田", "鈴木", "田中", "佐藤", "高橋", "渡辺", "伊藤", "山本", "中村", "小林", "加藤", "吉田",
        "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水", "山崎", "阿部", "森",
        "池田", "橋本", "山下", "石川", "中島", "前田", "藤田", "小川", "岡田", "後藤", "長谷川", "石井",
        "村上", "近藤", "坂本", "遠藤", "青木", "藤井", "西村", "福田", "太田", "三浦", "藤原", "岡本"
    }
    for m in re.finditer(rf'([\u4e00-\u9fa5]{{2,4}})(?={HONORIFIC})', text):
        t = m.group(1)
        if t not in COMMON_SURNAMES_AND_WORDS and not is_quantity_or_common_measure(t):
            # 2文字で一般的な音読み・訓読みがあるものは除外
            if len(t) == 2 and t in COMMON_SURNAMES_AND_WORDS:
                continue
            candidates.append(t)

    # 一般数量表現の除外＆重複排除
    filtered = [c for c in candidates if not is_quantity_or_common_measure(c)]
    return list(dict.fromkeys(filtered))
