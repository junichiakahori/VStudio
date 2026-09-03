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
                "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
                "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
                "https://www.nhk.or.jp/rss/news/cat0.xml",
                "https://news.yahoo.co.jp/rss/topics/domestic.xml",
                "https://www.nhk.or.jp/rss/news/cat1.xml",
                "https://news.yahoo.co.jp/rss/topics/world.xml",
                "https://www.nhk.or.jp/rss/news/cat6.xml",
                "https://news.yahoo.co.jp/rss/topics/business.xml",
                "https://www.nhk.or.jp/rss/news/cat5.xml",
                "https://www.nhk.or.jp/rss/news/cat4.xml",
                "https://news.yahoo.co.jp/rss/topics/entertainment.xml",
                "https://www.nhk.or.jp/rss/news/cat2.xml",
                "https://news.yahoo.co.jp/rss/topics/sports.xml",
                "https://www.nhk.or.jp/rss/news/cat7.xml",
                "https://news.yahoo.co.jp/rss/topics/it.xml",
                "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
                "https://news.yahoo.co.jp/rss/topics/science.xml",
                "https://www.nhk.or.jp/rss/news/cat3.xml",
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

def search_news_url_by_title(title):
    """タイトルからGoogle News RSSを瞬時に検索して元記事の正規URLを特定"""
    if not title:
        return ""
    cached = find_cached_url(title)
    if cached:
        return cached

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
            m = re.search(r'<item>.*?<link>(.*?)</link>', xml_str, flags=re.DOTALL)
            if m:
                link = m.group(1).strip()
                if link.startswith('http'):
                    register_cached_url(title, link)
                    return link
    except Exception:
        pass
    return ""

def fetch_article_body(url):
    """元記事URLから本文テキストを軽量スクレイピング"""
    if not url or not url.startswith('http'):
        return ""
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        )
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
                
            cleaned = re.sub(r'<(script|style|nav|header|footer|aside|noscript|iframe)[^>]*>.*?</\1>', '', html_text, flags=re.DOTALL | re.IGNORECASE)
            
            p_tags = re.findall(r'<p[^>]*>(.*?)</p>', cleaned, flags=re.DOTALL | re.IGNORECASE)
            extracted_paragraphs = []
            for p in p_tags:
                text = re.sub(r'<[^>]+>', '', p).strip()
                if len(text) >= 15 and not any(ng in text for ng in ["JavaScript", "Cookie", "利用規約", "プライバシーポリシー", "禁無断転載", "All Rights Reserved"]):
                    extracted_paragraphs.append(text)
            
            if extracted_paragraphs:
                body = " ".join(extracted_paragraphs)
                if len(body) > 600:
                    body = body[:600] + "…"
                return body
                
            raw_clean = re.sub(r'<[^>]+>', ' ', cleaned)
            raw_clean = re.sub(r'\s+', ' ', raw_clean).strip()
            if len(raw_clean) > 50:
                return raw_clean[:500] + "…"
    except Exception as e:
        print(f"[本文取得スキップ] URL: {url[:30]}... ({e})")
    return ""

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
