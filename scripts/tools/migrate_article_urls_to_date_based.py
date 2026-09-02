#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_article_urls_to_date_based.py
article_urls.json を「日付管理型（当日＋前日保持、2日以上前自動破棄）」へ移行する安全適用スクリプト
"""
import os
import json
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def apply_migration():
    today_str = datetime.date.today().strftime('%Y-%m-%d')
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')

    for base in [BASE_DIR, '/Users/junichiakahori/Documents/Antigravity/VStudio-dev']:
        if not os.path.exists(base):
            continue

        p_json = os.path.join(base, "data", "article_urls.json")
        p_crawler = os.path.join(base, "server", "news_crawler.py")

        # 1. 既存 article_urls.json の日付構造化移行
        if os.path.exists(p_json):
            try:
                with open(p_json, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                
                # 既に日付構造の場合はそのまま
                if any(k.startswith("20") and len(k) == 10 for k in old_data.keys()):
                    new_structure = old_data
                else:
                    # フラットな旧辞書からコメント返信等を除外し、直近500件を本日の日付に格納
                    cleaned = {k: v for k, v in old_data.items() if not k.startswith("コメント返信") and not k.startswith("リスナー") and not k.startswith("【コメント")}
                    recent_keys = list(cleaned.keys())[-500:]
                    recent_dict = {k: cleaned[k] for k in recent_keys}
                    new_structure = {
                        today_str: recent_dict
                    }

                # 2日以上前の日付キーを自動破棄
                valid_dates = {today_str, yesterday_str}
                final_structure = {d: urls for d, urls in new_structure.items() if d in valid_dates}

                with open(p_json, 'w', encoding='utf-8') as f:
                    json.dump(final_structure, f, ensure_ascii=False, indent=2)
                print(f"[Migration] ✅ {p_json} を日付管理型（直近2日保持）へ移行完了")
            except Exception as e:
                print(f"[Migration Error] {p_json}: {e}")

        # 2. server/news_crawler.py のコード改修
        if os.path.exists(p_crawler):
            with open(p_crawler, 'r', encoding='utf-8') as f:
                code = f.read()

            crawler_logic = """# -*- coding: utf-8 -*-
import os
import json
import re
import urllib.request
import urllib.parse
import ssl
import threading
import datetime
from bs4 import BeautifulSoup

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
    \"\"\"現在の全URLキャッシュマップ（当日＋前日を統合したフラット辞書）を取得\"\"\"
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
    \"\"\"タイトルまたは部分一致からキャッシュされたURLを取得（当日＋前日を優先検索）\"\"\"
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
    \"\"\"記事タイトルとURLのペアを当日の日付キーにキャッシュ＆古い日付を自動消去\"\"\"
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
"""
            # news_crawler.py の先頭〜init_preload_all_rss_urls の手前までを置換
            idx = code.find("def init_preload_all_rss_urls():")
            if idx != -1:
                new_code = crawler_logic + "\n" + code[idx:]
                with open(p_crawler, 'w', encoding='utf-8') as f:
                    f.write(new_code)
                print(f"[Migration] ✅ {p_crawler} に日付管理型ロジックを配備完了")

if __name__ == "__main__":
    apply_migration()
