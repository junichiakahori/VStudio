# -*- coding: utf-8 -*-
import os
import json
import re
import urllib.request
import urllib.parse
import ssl
import threading
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLE_URLS_FILE = os.path.join(BASE_DIR, "data", "article_urls.json")

_cache_lock = threading.Lock()

def _get_active_dates():
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    return today.strftime('%Y-%m-%d'), yesterday.strftime('%Y-%m-%d')

def load_article_url_cache():
    if os.path.exists(ARTICLE_URLS_FILE):
        try:
            with open(ARTICLE_URLS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    return {}

def save_article_url_cache(cache):
    try:
        with _cache_lock:
            with open(ARTICLE_URLS_FILE, 'w', encoding='utf-8') as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

ARTICLE_URL_CACHE = load_article_url_cache()

def get_all_cached_urls():
    """現在の全URLキャッシュマップ（当日＋前日を統合したフラット辞書）を取得"""
    global ARTICLE_URL_CACHE
    if not ARTICLE_URL_CACHE:
        ARTICLE_URL_CACHE = load_article_url_cache()
    today_str, yest_str = _get_active_dates()
    combined = {}
    if yest_str in ARTICLE_URL_CACHE and isinstance(ARTICLE_URL_CACHE[yest_str], dict):
        combined.update(ARTICLE_URL_CACHE[yest_str])
    if today_str in ARTICLE_URL_CACHE and isinstance(ARTICLE_URL_CACHE[today_str], dict):
        combined.update(ARTICLE_URL_CACHE[today_str])
    return combined

def find_cached_url(title):
    """タイトルまたは部分一致からキャッシュされたURLを取得（当日＋前日を優先検索）"""
    if not title:
        return ""
    all_urls = get_all_cached_urls()
    if title in all_urls:
        return all_urls[title]
    for t_k, u_v in all_urls.items():
        if t_k and (t_k[:10] in title or title[:10] in t_k or t_k in title or title in t_k):
            return u_v
    return ""

def register_cached_url(title, url):
    """記事タイトルとURLのペアを当日の日付キーにキャッシュ＆古い日付を自動消去"""
    if not title or not url:
        return
    # コメント返信等のシステムタイトルは除外
    if title.startswith("コメント返信") or title.startswith("リスナー") or title.startswith("【コメント"):
        return

    today_str, yest_str = _get_active_dates()
    if today_str not in ARTICLE_URL_CACHE or not isinstance(ARTICLE_URL_CACHE[today_str], dict):
        ARTICLE_URL_CACHE[today_str] = {}

    ARTICLE_URL_CACHE[today_str][title] = url

    # 2日以上前の古い日付ブロックを全自動で破棄 (日次クリーンアップ)
    valid_dates = {today_str, yest_str}
    keys_to_del = [d for d in list(ARTICLE_URL_CACHE.keys()) if d not in valid_dates]
    for old_d in keys_to_del:
        del ARTICLE_URL_CACHE[old_d]

    save_article_url_cache(ARTICLE_URL_CACHE)

def init_preload_all_rss_urls():
    """サーバー起動時に全カテゴリのRSSからタイトルとURLのマップを即座に事前取得して永続化"""
    def _worker():
        try:
            urls = [
                "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
                "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/domestic.xml",
                "https://news.google.com/news/rss/headlines/section/topic/NATION?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/world.xml",
                "https://news.google.com/news/rss/headlines/section/topic/WORLD?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/business.xml",
                "https://news.google.com/news/rss/headlines/section/topic/BUSINESS?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.google.com/news/rss/headlines/section/topic/POLITICS?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/entertainment.xml",
                "https://news.google.com/news/rss/headlines/section/topic/ENTERTAINMENT?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/sports.xml",
                "https://news.google.com/news/rss/headlines/section/topic/SPORTS?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/it.xml",
                "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
                "https://news.google.com/news/rss/headlines/section/topic/TECHNOLOGY?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/science.xml",
                "https://news.google.com/news/rss/headlines/section/topic/SCIENCE?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/local.xml"
            ]
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            cached = 0
            for u in urls:
                try:
                    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, context=ctx, timeout=5) as res:
                        xml_str = res.read().decode('utf-8', errors='ignore')
                        items = re.findall(r'<item>(.*?)</item>', xml_str, flags=re.DOTALL)
                        for it in items:
                            t_m = re.search(r'<title>(.*?)</title>', it, flags=re.DOTALL)
                            l_m = re.search(r'<link>(.*?)</link>', it, flags=re.DOTALL) or re.search(r'<guid[^>]*>(.*?)</guid>', it, flags=re.DOTALL)
                            if t_m and l_m:
                                t_clean = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', t_m.group(1)).strip()
                                l_clean = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', l_m.group(1)).strip()
                                if t_clean and l_clean.startswith('http'):
                                    ARTICLE_URL_CACHE[t_clean] = l_clean
                                    cached += 1
                except Exception:
                    pass
            if cached > 0:
                save_article_url_cache(ARTICLE_URL_CACHE)
                print(f"[RSS URLマップ初期化完了] {len(ARTICLE_URL_CACHE)}件の記事URLをキャッシュ＆article_urls.jsonに保存しました")
        except Exception as e:
            print(f"[RSS URL初期化エラー]: {e}")
            
    t = threading.Thread(target=_worker, daemon=True)
    t.start()

PREFECTURES_LIST = [
    '北海道','青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','東京','神奈川',
    '新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重','滋賀','京都','大阪','兵庫',
    '奈良','和歌山','鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡','佐賀',
    '長崎','熊本','大分','宮崎','鹿児島','沖縄'
]

def is_matching_news_title(orig_title, candidate_title):
    """元記事タイトルと検索候補記事タイトルの同一性・地域合致性を厳格に照合"""
    if not orig_title or not candidate_title:
        return False
        
    # 1. 地域名チェック（元タイトルに地名がある場合、候補にも一致地名が含まれているか確認）
    orig_prefs = [p for p in PREFECTURES_LIST if p in orig_title]
    cand_prefs = [p for p in PREFECTURES_LIST if p in candidate_title]
    if orig_prefs and not any(p in candidate_title for p in orig_prefs):
        # 元タイトルに地名があるのに候補タイトルに含まれていない（別地域のニュース誤爆）
        return False
    if not orig_prefs and cand_prefs:
        # 元タイトルに地名がないのに候補が特定地方ローカルの場合は慎重に判定
        pass

    # 2. 8〜14文字のキーフレーズ部分一致チェック（日本語タイトルの同一記事判定に最も高精度）
    clean_orig = re.sub(r'[\s\u3000【】「」『』\(\)（）\-_/・…|｜－―—\d]+', '', orig_title)
    clean_cand = re.sub(r'[\s\u3000【】「」『』\(\)（）\-_/・…|｜－―—\d]+', '', candidate_title)
    if len(clean_orig) >= 8 and len(clean_cand) >= 8:
        for length in (14, 12, 10, 8):
            for i in range(len(clean_orig) - length + 1):
                sub = clean_orig[i:i+length]
                if sub in clean_cand:
                    return True

    # 3. Bi-gram（2文字組）重複率チェック（表現が一部異なる同一トピックの照合）
    bg1 = set(clean_orig[i:i+2] for i in range(len(clean_orig)-1))
    bg2 = set(clean_cand[i:i+2] for i in range(len(clean_cand)-1))
    if bg1 and bg2:
        overlap = len(bg1 & bg2) / min(len(bg1), len(bg2))
        if overlap >= 0.38:
            return True

    return False

def search_yahoo_mirror_url(title):
    """Yahoo!ニュース検索から同一記事の配信URL（全文取得可能）を厳密照合して特定"""
    if not title:
        return ""
    try:
        clean = re.sub(r'[\s|｜\-–—]+(?:mainichi\.jp|毎日新聞|朝日新聞|日本経済新聞|日経|ロイター|Reuters|Bloomberg|読売新聞|産経新聞).*$', '', title).strip()
        clean_no_brackets = re.sub(r'^[【\[「『\(（][^】\]」』\)）]+[】\]」』\)）]', '', clean).strip()
        chunks = re.split(r'[\s\u3000、,;:\-–—\(\)（）|｜]+', clean_no_brackets)
        chunks = [c for c in chunks if len(c) >= 2]
        if chunks:
            first = chunks[0]
            if len(first) > 22:
                search_query = first[:22]
            elif len(first) < 6 and len(chunks) > 1:
                search_query = (first + " " + chunks[1])[:22]
            else:
                search_query = first
        else:
            search_query = clean[:20]

        q = urllib.parse.quote(search_query)
        yahoo_search_url = f"https://news.yahoo.co.jp/search?p={q}"
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(yahoo_search_url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as res:
            html = res.read().decode('utf-8', errors='ignore')
            items = re.findall(r'<a[^>]+href=[\"\'](https://news\.yahoo\.co\.jp/articles/[a-f0-9]+)[\"\'][^>]*>(.*?)</a>', html, flags=re.DOTALL)
            for link_url, inner_html in items:
                cand_title = re.sub(r'<[^>]+>', ' ', inner_html)
                cand_title = ' '.join(cand_title.split())
                if is_matching_news_title(clean, cand_title) or is_matching_news_title(title, cand_title):
                    register_cached_url(title, link_url)
                    return link_url
    except Exception:
        pass
    return ""

def search_news_url_by_title(title):
    """タイトルからYahoo!ニュース検索またはGoogle News RSSを瞬時に検索し、同一記事であることを厳密に照合して正規URLを特定"""
    if not title:
        return ""
    cached = find_cached_url(title)
    if cached and "news.google.com/rss/articles" not in cached and not is_known_blocked_domain(cached):
        return cached

    # 1. Yahoo!ニュース検索（タイトル照合付き）
    yahoo_url = search_yahoo_mirror_url(title)
    if yahoo_url:
        return yahoo_url

    # 2. Google News RSS 検索（タイトル照合付き）
    try:
        clean_title = re.sub(r'[\s\-_].*$', '', title).strip()
        if len(clean_title) < 5:
            clean_title = title[:25]
        q = urllib.parse.quote(clean_title)
        url = f"https://news.google.com/rss/search?q={q}&hl=ja&gl=JP&ceid=JP:ja"
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as res:
            xml_str = res.read().decode('utf-8', errors='ignore')
            item_blocks = re.findall(r'<item>(.*?)</item>', xml_str, flags=re.DOTALL)
            for it in item_blocks:
                m_title = re.search(r'<title>(.*?)</title>', it)
                m_link = re.search(r'<link>(.*?)</link>', it)
                if m_title and m_link:
                    cand_title = m_title.group(1).strip()
                    cand_link = m_link.group(1).strip()
                    if cand_link.startswith('http') and is_matching_news_title(title, cand_title):
                        register_cached_url(title, cand_link)
                        return cand_link
    except Exception:
        pass
    return ""

def decode_google_news_url(url):
    """Google News の暗号化転送URL（news.google.com/rss/articles/...）を配信元正規URLに自動デコード"""
    if not url or "news.google.com" not in url:
        return url
    try:
        from googlenewsdecoder import gnewsdecoder
        res = gnewsdecoder(url)
        if isinstance(res, dict) and res.get('status') and res.get('decoded_url'):
            decoded = res['decoded_url']
            if decoded and decoded.startswith('http') and "news.google.com" not in decoded:
                return decoded
    except Exception as e:
        print(f"[Google News デコード失敗] {url[:50]}... ({e})")
# ── 本文メモリキャッシュ（原稿生成時の重複スクレイピングを完全スキップ）──
_ARTICLE_BODY_CACHE = {}
_BODY_CACHE_LOCK = threading.Lock()

def get_cached_article_body(url):
    if not url:
        return ""
    with _BODY_CACHE_LOCK:
        return _ARTICLE_BODY_CACHE.get(url, "")

def set_cached_article_body(url, body):
    if not url or not body:
        return
    with _BODY_CACHE_LOCK:
        if len(_ARTICLE_BODY_CACHE) > 500:
            _ARTICLE_BODY_CACHE.pop(next(iter(_ARTICLE_BODY_CACHE)))
        _ARTICLE_BODY_CACHE[url] = body

# ── 既知のスクレイピング遮断・有料会員限定ドメイン（直接アクセス不可）──
BLOCKED_ARTICLE_DOMAINS = [
    "nhk.or.jp",          # NHK（SPA化により初期HTMLに本文全文が存在しない）
    "news.web.nhk",       # NHK ONE（SPA化により初期HTMLに本文全文が存在しない）
    "mainichi.jp",        # 毎日新聞（ボット遮断・Connection reset）
    "nikkei.com",         # 日本経済新聞（有料会員限定）
    "asahi.com/articles", # 朝日新聞（有料記事）
    "bloomberg.com",      # ブルームバーグ（403・ペイウォール）
    "reuters.com",        # ロイター（403・ペイウォール）
    "san-ei.co.jp",
    "president.jp/articles/-/",
]

def is_known_blocked_domain(url):
    if not url:
        return False
    u_lower = url.lower()
    return any(b in u_lower for b in BLOCKED_ARTICLE_DOMAINS)

def _resolve_yahoo_pickup_article(url, html_text, headers):
    """Yahoo!ニュースのpickup中間ページから記事全文ページURLとHTMLを取得（最大深さ2階層）"""
    if "news.yahoo.co.jp/pickup/" not in url:
        return url, html_text
    m_art = re.search(r'href=[\"\'](https://news\.yahoo\.co\.jp/articles/[a-f0-9]+)[\"\']', html_text)
    if not m_art:
        return url, html_text
    art_url = m_art.group(1)
    try:
        import requests
        res_art = requests.get(art_url, headers=headers, timeout=4.0)
        if res_art.status_code == 200:
            res_art.encoding = res_art.apparent_encoding or 'utf-8'
            return art_url, res_art.text
    except Exception:
        pass
    return url, html_text


def fetch_article_body(url):
    """元記事URLから本文テキストを軽量スクレイピング（メモリキャッシュ連動）"""
    if not url or not url.startswith('http'):
        return ""
    
    cached = get_cached_article_body(url)
    if cached:
        return cached

    if "news.google.com" in url:
        url = decode_google_news_url(url)
        if not url or not url.startswith('http') or "news.google.com" in url:
            return ""
        cached = get_cached_article_body(url)
        if cached:
            return cached

    # 既知の遮断サイトの場合は即座に空返却（無駄なタイムアウト待機やエラーを防止）
    if is_known_blocked_domain(url):
        return ""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }
    html_text = ""
    try:
        import requests
        res = requests.get(url, headers=headers, timeout=4.0)
        if res.status_code == 200:
            res.encoding = res.apparent_encoding or 'utf-8'
            html_text = res.text
            url, html_text = _resolve_yahoo_pickup_article(url, html_text, headers)
    except Exception:
        pass

    if not html_text:
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=3.5) as res:
                html_bytes = res.read()
                content_type = res.headers.get('Content-Type', '')
                charset = 'utf-8'
                if 'charset=' in content_type.lower():
                    charset = content_type.lower().split('charset=')[-1].split(';')[0].strip()
                try:
                    html_text = html_bytes.decode(charset, errors='replace')
                except Exception:
                    html_text = html_bytes.decode('utf-8', errors='replace')
        except Exception as e:
            print(f"[本文取得スキップ] URL: {url[:30]}... ({e})")
            return ""

    try:
        # 1. meta description / og:description の事前抽出
        meta_desc = ""
        m_desc = re.search(r'<meta\s+[^>]*(?:name|property)=[\"\'](?:description|og:description)[\"\'][^>]*content=[\"\'](.*?)[\"\']', html_text, re.DOTALL | re.IGNORECASE)
        if m_desc:
            meta_desc = m_desc.group(1).strip()
            meta_desc = re.sub(r'^(?:【[^】]+】|\[[^\]]+\]|\([^\)]+\))', '', meta_desc).strip()
            meta_desc = re.sub(r'\s+', ' ', meta_desc)
            for noise in ["最新ニュース", "ニュース速報", "のニュースです"]:
                meta_desc = meta_desc.replace(noise, "")

        cleaned = re.sub(r'<(script|style|nav|header|footer|aside|noscript|iframe)[^>]*>.*?</\1>', '', html_text, flags=re.DOTALL | re.IGNORECASE)
        p_tags = re.findall(r'<p[^>]*>(.*?)</p>', cleaned, flags=re.DOTALL | re.IGNORECASE)
        extracted_paragraphs = []
        for p in p_tags:
            text = re.sub(r'<[^>]+>', '', p).strip()
            # UI境界キーワードやレコメンド・一覧ブロックが現れたらそれ以降の段落はすべて本文外とみなして即時打ち切り
            UI_BREAK_WORDS = [
                "不適切な結果を報告", "みんなの意見", "意識調査", "アクセスランキング", "ランキング",
                "注目のニュース", "おすすめ記事", "おすすめニュース", "関連記事", "最新のニュース",
                "トピックス一覧", "もっと見る", "続きを読む", "【ストリーミング】", "【ランキング】",
                "【オリコン】", "【写真多数】", "ランキング一覧", "オリコンランキング"
            ]
            if any(kw in text for kw in UI_BREAK_WORDS):
                break
            # ニュースカードの日付表示（例: 9月9日 15:55 等）を検知したらレコメンド一覧開始とみなして打ち切り
            if re.match(r'^\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2})?', text):
                break

            # 段落先頭・末尾のUIノイズをクリーンアップ
            text = re.sub(r'^(?:閉じる\s*)+', '', text)
            text = re.sub(r'シェアする.*', '', text).strip()
            text = re.sub(r'^\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}\s*', '', text).strip()
            text = re.sub(r'pic\.twitter\.com/\S+', '', text).strip()

            # アフィリエイト免責・PR注記・ライター紹介ブロックの完全除去
            text = re.sub(r'※?本ページはアフィリエイト[^\n。]*[。\s]*', '', text).strip()
            text = re.sub(r'[^。]*?(?:好きなライター|専門のライター|担当ライター|執筆者|筆者プロフィール)[^。]*?。?', '', text).strip()
            text = re.sub(r'[^。]*?(?:クローゼットがパンパン|出没します)[^。]*?。?', '', text).strip()

            if len(text) >= 15 and not any(ng in text for ng in ["JavaScript", "Cookie", "利用規約", "プライバシーポリシー", "禁無断転載", "All Rights Reserved", "不適切", "みんなの意見", "意識調査"]):
                extracted_paragraphs.append(text)
        
        body = ""
        if extracted_paragraphs:
            body = " ".join(extracted_paragraphs)
            for pat in [r'不適切な結果を報告.*', r'みんなの意見.*', r'意識調査.*', r'アクセスランキング.*', r'関連記事.*', r'【ストリーミング】.*', r'【ランキング】.*']:
                body = re.sub(pat, '', body, flags=re.DOTALL)
            body = body.strip()

        # 本文が短すぎる（120文字未満など）または空の場合、meta_descが充実していれば統合または代替
        if meta_desc and len(meta_desc) >= 30:
            if not body or len(body) < len(meta_desc):
                body = meta_desc
            elif meta_desc not in body and len(body) < 150:
                body = f"{meta_desc} {body}".strip()

        if body:
            if len(body) > 600:
                body = body[:600] + "…"
            set_cached_article_body(url, body)
            return body
            
        raw_clean = re.sub(r'<[^>]+>', ' ', cleaned)
        for pat in [r'不適切な結果を報告.*', r'みんなの意見.*', r'意識調査.*', r'アクセスランキング.*', r'関連記事.*']:
            raw_clean = re.sub(pat, '', raw_clean, flags=re.DOTALL)
        raw_clean = re.sub(r'\s+', ' ', raw_clean).strip()
        if len(raw_clean) > 50:
            res_body = raw_clean[:500] + "…"
            set_cached_article_body(url, res_body)
            return res_body
    except Exception as e:
        print(f"[本文取得スキップ] URL: {url[:30]}... ({e})")
    return ""

MIN_ARTICLE_BODY_LEN = 150  # 🛡️ 深掘り原稿生成に耐えうる最低本文文字数（150文字）

# 🚫 バックエンド二重防壁: 市況データ羅列・写真特集等の低情報量タイトルパターン
INVALID_DATA_TITLE_PATTERNS = [
    re.compile(r'成行注文', re.IGNORECASE),
    re.compile(r'買い越しランキング|売り越しランキング', re.IGNORECASE),
    re.compile(r'ストップ高|ストップ安', re.IGNORECASE),
    re.compile(r'値上がり率ランキング|値下がり率ランキング', re.IGNORECASE),
    re.compile(r'出来高上位|信用取引残高', re.IGNORECASE),
    re.compile(r'写真まとめ|写真多数|写真特集|フォトギャラリー|写真ニュース|グラビア', re.IGNORECASE),
]

def check_and_filter_scrapeable_news(items):
    """
    複数のニュース項目について、スクレイピング可能（本文が150文字以上取得可能）かを並行検証する。
    毎日新聞等の遮断サイト、有料限定、短文速報、株価データ羅列、動画前提記事は scrapeable=False となり除外対象となる。
    """
    results = {}
    scrapeable_titles = []
    lock = threading.Lock()

    def _worker(item):
        title = item.get('title', '').strip()
        url = item.get('url', item.get('link', '')).strip()
        if not title:
            return

        # 🚫 0. 市況・株価データ羅列や写真特集の即時除外（文章情報量ゼロ・極小）
        for pat in INVALID_DATA_TITLE_PATTERNS:
            if pat.search(title):
                with lock:
                    results[title] = {
                        "scrapeable": False,
                        "url": url,
                        "reason": "市況データ羅列・写真特集等の低情報量記事"
                    }
                return

        # 1. URLの解決（キャッシュ、検索、Googleデコード）
        resolved = url
        if not resolved or not resolved.startswith('http'):
            resolved = find_cached_url(title)
        if not resolved:
            resolved = search_news_url_by_title(title)
        if resolved and "news.google.com" in resolved:
            decoded = decode_google_news_url(resolved)
            if decoded and "news.google.com" not in decoded:
                resolved = decoded

        # 2. 既知の遮断サイト（mainichi.jpなど）の場合、タイトルを整形してYahoo!ニュース等のミラー記事を積極探索
        clean_search_title = re.sub(r'[\s|｜\-–—]+(?:mainichi\.jp|毎日新聞|朝日新聞|日本経済新聞|日経|ロイター|Reuters|Bloomberg|読売新聞|産経新聞).*$', '', title).strip()
        if is_known_blocked_domain(resolved):
            mirror_url = search_yahoo_mirror_url(clean_search_title or title)
            if mirror_url and not is_known_blocked_domain(mirror_url):
                print(f"[ミラー救済] 🎯 遮断URL({resolved[:30]}...)をYahooミラーに置換: {mirror_url[:50]}...", flush=True)
                resolved = mirror_url

        # 3. 既知の遮断サイトでミラーも見つからない場合はスクレイピング不可判定
        if is_known_blocked_domain(resolved):
            with lock:
                results[title] = {
                    "scrapeable": False,
                    "url": resolved,
                    "reason": "既知のスクレイピング遮断・有料限定サイト（ミラー記事なし）"
                }
            return

        # 4. 実際に本文を取得（キャッシュも効く）
        body = fetch_article_body(resolved) if resolved else ""
        # 🛡️ 本文が情報量不足（150文字未満）の場合、Yahoo!ニュース等のミラー探索で救済を試みる
        if (not body or len(body) < MIN_ARTICLE_BODY_LEN):
            mirror_url = search_yahoo_mirror_url(clean_search_title or title)
            if mirror_url and mirror_url != resolved and not is_known_blocked_domain(mirror_url):
                mirror_body = fetch_article_body(mirror_url)
                if mirror_body and len(mirror_body) >= MIN_ARTICLE_BODY_LEN:
                    print(f"[ミラー救済] 🎯 本文不足URL({resolved[:30]}...)をYahooミラーで救済 ({len(mirror_body)}文字): {mirror_url[:50]}...", flush=True)
                    resolved = mirror_url
                    body = mirror_body

        # 🛡️ 本文が 150文字以上取得できた場合のみ「合格（取得可能）」とする！
        if body and len(body) >= MIN_ARTICLE_BODY_LEN:
            if resolved:
                register_cached_url(title, resolved)
                set_cached_article_body(resolved, body)
            resolved_source = item.get("source", "")
            if resolved and "news.yahoo.co.jp" in resolved:
                resolved_source = "Yahoo!ニュース"
                item["source"] = "Yahoo!ニュース"
            with lock:
                scrapeable_titles.append(title)
                results[title] = {
                    "scrapeable": True,
                    "url": resolved,
                    "resolved_url": resolved,
                    "source": resolved_source,
                    "body_len": len(body)
                }
        else:
            with lock:
                results[title] = {
                    "scrapeable": False,
                    "url": resolved,
                    "reason": f"本文情報量不足 ({len(body)}文字 < {MIN_ARTICLE_BODY_LEN}文字)"
                }

    from concurrent.futures import ThreadPoolExecutor, as_completed
    max_workers = min(20, max(4, len(items)))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_worker, it): it for it in items}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                pass

    # タイムアウト等で未完了の項目があれば安全に不可判定を補填
    for it in items:
        t = it.get('title', '').strip()
        if t and t not in results:
            results[t] = {
                "scrapeable": False,
                "url": it.get('url', it.get('link', '')),
                "reason": "検証未完了により本文取得をスキップ"
            }

    return {
        "status": "ok",
        "scrapeable_titles": scrapeable_titles,
        "results": results
    }

def resolve_batch_urls(items):
    """複数のニュース項目について一括で正規URLをバックグラウンド並行解決"""
    results = {}
    threads = []
    
    def _worker(title, original_url):
        resolved = original_url
        if not resolved or not resolved.startswith('http'):
            resolved = find_cached_url(title)
        if not resolved:
            resolved = search_news_url_by_title(title)
        if resolved and "news.google.com" in resolved:
            decoded = decode_google_news_url(resolved)
            if decoded and "news.google.com" not in decoded:
                resolved = decoded
        if resolved:
            register_cached_url(title, resolved)
        results[title] = resolved or original_url or ""

    for it in items:
        t = it.get('title', '').strip()
        u = it.get('url', '').strip()
        if t:
            th = threading.Thread(target=_worker, args=(t, u))
            th.start()
            threads.append(th)
            
    for th in threads:
        th.join(timeout=4.0)
        
    return results

def fetch_rss_xml(rss_url):
    """指定されたRSSフィードURLからXMLデータを取得"""
    if not rss_url:
        raise ValueError("URL is required")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        rss_url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
        return response.read()
