import http.server
import socketserver
import json
import os
import glob
import urllib.request
import ssl
import re
import time
import datetime
import shutil
import threading
import sqlite3

PORT = 8001
DATA_FILE = "custom_idle_phrases.json"
HIRAGANA_FILE = "hiragana_data.json"
DICT_FILE = "hiragana_dict.json"
RADIO_SCRIPT_FILE = "radio_script.txt"
RADIO_SCRIPT_YOMI_FILE = "radio_script_yomi.txt"
RADIO_SCRIPT_CONFIG_FILE = "radio_script_config.json"
NEWS_SCRIPT_FILE = "news_script.txt"
NEWS_SCRIPT_YOMI_FILE = "news_script_yomi.txt"
NEWS_SCRIPT_CONFIG_FILE = "news_script_config.json"

current_hot_reload_timestamp = int(time.time() * 1000)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLE_URLS_FILE = os.path.join(BASE_DIR, "article_urls.json")
PROMPT_TEMPLATE_FILE = os.path.join(BASE_DIR, "news_prompt_template.txt")
LOG_FILE = os.path.join(BASE_DIR, "browser_console.log")
LOG_BACKUP_DIR = os.path.join(BASE_DIR, "logs_backup")

_log_lock = threading.Lock()
_current_log_date = datetime.date.today().strftime('%Y-%m-%d')

def check_and_rotate_browser_log():
    """日付が変わった際に browser_console.log を logs_backup/ にバックアップし、1行目からリセット"""
    global _current_log_date
    today_str = datetime.date.today().strftime('%Y-%m-%d')
    with _log_lock:
        if today_str != _current_log_date:
            try:
                if not os.path.exists(LOG_BACKUP_DIR):
                    os.makedirs(LOG_BACKUP_DIR, exist_ok=True)
                if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 0:
                    backup_filename = f"browser_console_{_current_log_date}.log"
                    backup_path = os.path.join(LOG_BACKUP_DIR, backup_filename)
                    shutil.copy2(LOG_FILE, backup_path)
                    # 1行目からスタート
                    with open(LOG_FILE, 'w', encoding='utf-8') as f:
                        now_str = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S.000Z')
                        f.write(f"[{now_str}] [SYSTEM] === Log rotated for {today_str} (Previous: {backup_filename}) ===\n")
                    print(f"[LogRotation] 📅 日付変更を検知: {backup_filename} にバックアップし、browser_console.log を1行目から再スタートしました")
            except Exception as e:
                print(f"[LogRotationエラー]: {e}")
            finally:
                _current_log_date = today_str

def write_browser_console_log(log_message):
    """日次ローテーション管理付きの安全なログ書き込み"""
    check_and_rotate_browser_log()
    with _log_lock:
        try:
            with open(LOG_FILE, 'a', encoding='utf-8') as f:
                f.write(log_message + '\n')
        except Exception as e:
            print(f"[ログ書き込みエラー]: {e}")

def load_data(file_path=DATA_FILE):
    if not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_data(data, file_path=DATA_FILE):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def build_news_prompt(char_desc, transition, title, full_article_content):
    """外部プロンプトファイル news_prompt_template.txt からテンプレートを動的読み込みしてプロンプトを構築"""
    if os.path.exists(PROMPT_TEMPLATE_FILE):
        try:
            with open(PROMPT_TEMPLATE_FILE, 'r', encoding='utf-8') as f:
                template = f.read()
                return template.format(
                    char_desc=char_desc,
                    transition=transition,
                    title=title,
                    full_article_content=full_article_content
                )
        except Exception as e:
            print(f"[プロンプトファイル読み込みエラー]: {e}")
    # 万が一ファイルが無い場合の安全なフォールバック
    return f"あなたは人気配信者である{char_desc}\n冒頭: {transition}\n【タイトル】: {title}\n【内容】: {full_article_content}"

def load_article_url_cache():
    if os.path.exists(ARTICLE_URLS_FILE):
        try:
            with open(ARTICLE_URLS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_article_url_cache(cache):
    try:
        with open(ARTICLE_URLS_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

ARTICLE_URL_CACHE = load_article_url_cache()
LAST_PLAYING_ARTICLE_URL = ""

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

init_preload_all_rss_urls()

def search_news_url_by_title(title):
    """タイトルからGoogle News RSSを瞬時に検索して元記事の正規URLを特定"""
    if not title:
        return ""
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
                    return link
    except Exception:
        pass
    return ""

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/hot_reload_signal':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'timestamp': current_hot_reload_timestamp}).encode('utf-8'))
        elif self.path == '/custom_idle_phrases.json':
            data = load_data(DATA_FILE)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        elif self.path == '/hiragana_data.json':
            data = load_data(HIRAGANA_FILE)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        elif self.path == '/hiragana_dict.json':
            data = load_data(DICT_FILE)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        elif self.path == '/se_list':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            se_files = []
            if os.path.exists('se'):
                for f in os.listdir('se'):
                    if f.endswith('.mp3') or f.endswith('.wav'):
                        name_without_ext = os.path.splitext(f)[0]
                        se_files.append(name_without_ext)
            
            self.wfile.write(json.dumps({"files": se_files}, ensure_ascii=False).encode('utf-8'))
        elif self.path == '/api/youtube/oauth_status':
            import youtube_api_helper
            status = youtube_api_helper.get_oauth_status()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(status, ensure_ascii=False).encode('utf-8'))
        elif self.path.startswith('/api/youtube/list_broadcasts'):
            import youtube_api_helper
            try:
                items = youtube_api_helper.list_my_broadcasts()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "items": items}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        elif self.path == '/radio_script':
            # 既存のラジオ台本を返す
            if os.path.exists(RADIO_SCRIPT_FILE):
                with open(RADIO_SCRIPT_FILE, 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
        elif self.path == '/radio_script_yomi':
            # ラジオ台本（読み上げ用）を返す
            if os.path.exists(RADIO_SCRIPT_YOMI_FILE):
                with open(RADIO_SCRIPT_YOMI_FILE, 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
        elif self.path == '/radio_script_config':
            # 台本生成設定ファイルを返す
            if os.path.exists(RADIO_SCRIPT_CONFIG_FILE):
                with open(RADIO_SCRIPT_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    content = f.read()
                # 中身が空だった場合のガード
                if not content.strip():
                    content = "{}"
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                # デフォルト設定を返す
                default_config = {"personality": {"name": "", "greeting_opening": "", "greeting_closing": ""}, "se_allowed": []}
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(default_config, ensure_ascii=False).encode('utf-8'))
        elif self.path == '/api/news/get_all_urls':
            try:
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "urls": ARTICLE_URL_CACHE,
                    "count": len(ARTICLE_URL_CACHE)
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/news_script_config':
            try:
                with open(NEWS_SCRIPT_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(config, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                # ファイルがまだない場合などは空のJSONなどを返す
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({}, ensure_ascii=False).encode('utf-8'))
        elif self.path == '/news_script':
            try:
                # 実際のテキストファイル名に合わせて変更してください（例: radio_script.txt）
                with open('radio_script.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            except Exception as e:
                self.send_response(404)
                self.end_headers()

        elif self.path == '/news_script_yomi':
            try:
                # 読み用テキストファイル名に合わせて変更してください（例: radio_script_yomi.txt）
                with open('radio_script_yomi.txt', 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            except Exception as e:
                self.send_response(404)
                self.end_headers()
        elif self.path == '/news_script_config':
            try:
                with open(NEWS_SCRIPT_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(config, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                # ファイルがまだない場合などは空のJSONなどを返す
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({}, ensure_ascii=False).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

    def do_POST(self):
        global current_hot_reload_timestamp, LAST_PLAYING_ARTICLE_URL
        if self.path == '/trigger_hot_reload':
            current_hot_reload_timestamp = int(time.time() * 1000)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "timestamp": current_hot_reload_timestamp}).encode('utf-8'))
        elif self.path == '/add_idle_phrase':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                model_type = payload.get('model', 'NORMAL_PHRASES')
                category = payload.get('category', 'general')
                phrase = payload.get('phrase', '')
                
                if phrase:
                    data = load_data()
                    if model_type not in data:
                        data[model_type] = {}
                    if category not in data[model_type]:
                        data[model_type][category] = []
                    
                    if phrase not in data[model_type][category]:
                        data[model_type][category].append(phrase)
                        save_data(data)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/update_hiragana_data':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                # 文章単位のAIキャッシュによる誤読蓄積・ハルシネーション汚染を完全に遮断
                payload['cache'] = {}
                save_data(payload, HIRAGANA_FILE)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/update_hiragana_dict':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                new_entries = json.loads(post_data.decode('utf-8'))
                current_dict = load_data(DICT_FILE)
                # マージ
                current_dict.update(new_entries)
                save_data(current_dict, DICT_FILE)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "total_entries": len(current_dict)}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/radio_script':
            # ラジオ台本ファイルの保存
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                script_text = post_data.decode('utf-8')
                with open(RADIO_SCRIPT_FILE, 'w', encoding='utf-8') as f:
                    f.write(script_text)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "lines": len(script_text.strip().split('\n'))}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/radio_script_yomi':
            # ラジオ台本（読み上げ用）ファイルの保存
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                script_text = post_data.decode('utf-8')
                with open(RADIO_SCRIPT_YOMI_FILE, 'w', encoding='utf-8') as f:
                    f.write(script_text)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "lines": len(script_text.strip().split('\n'))}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/radio_script_config':
            # 台本生成設定ファイルの保存
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                config = json.loads(post_data.decode('utf-8'))
                with open(RADIO_SCRIPT_CONFIG_FILE, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=4)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/news_script':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                script_text = post_data.decode('utf-8')
                with open(NEWS_SCRIPT_FILE, 'w', encoding='utf-8') as f:
                    f.write(script_text)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "lines": len(script_text.strip().split('\n'))}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/news_script_yomi':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                script_text = post_data.decode('utf-8')
                with open(NEWS_SCRIPT_YOMI_FILE, 'w', encoding='utf-8') as f:
                    f.write(script_text)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "lines": len(script_text.strip().split('\n'))}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/news_script_config':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                config = json.loads(post_data.decode('utf-8'))
                with open(NEWS_SCRIPT_CONFIG_FILE, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=4)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/convert_remaining_kanji':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                import pykakasi
                kks = pykakasi.kakasi()
                text = post_data.decode('utf-8')
                
                def process_segment(seg):
                    res = kks.convert(seg)
                    out = ""
                    for item in res:
                        if re.search(r'[\u4e00-\u9faf]', item['orig']):
                            out += item['hira']
                        else:
                            out += item['orig']
                    return out

                output = ""
                lines = text.split('\n')
                for i, line in enumerate(lines):
                    parts = re.split(r'(\[.*?\])', line)
                    for p in parts:
                        if p.startswith('[') and p.endswith(']'):
                            output += p
                        else:
                            output += process_segment(p)
                    if i < len(lines) - 1:
                        output += '\n'

                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(output.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/log':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                try:
                    payload = json.loads(post_data.decode('utf-8'))
                    log_message = payload.get('message', '')
                except Exception:
                    log_message = post_data.decode('utf-8', errors='ignore')
                if log_message:
                    # 🔗 ニュースログにURLが欠けている（またはURLなし）場合、サーバー側のURLキャッシュから正確に探索
                    if "[ニュース原稿(Backend)]" in log_message:
                        matched_url = ""
                        # 原稿本文やタイトルから正確な記事URLを探索
                        best_score = 0
                        for t_key, u_val in ARTICLE_URL_CACHE.items():
                            if not t_key or not u_val:
                                continue
                            # 記事タイトルの主要キーワード（5文字以上）がログ原稿に含まれているか照合
                            t_clean = re.sub(r'[【】『』「」\s　・、。！？!?]+', '', t_key)
                            if t_clean[:8] in log_message:
                                matched_url = u_val
                                break
                            # 原稿の冒頭部分とタイトルの共通単語マッチング
                            match_chars = sum(1 for c in t_clean[:12] if c in log_message)
                            if match_chars > best_score and match_chars >= 4:
                                best_score = match_chars
                                matched_url = u_val

                        if matched_url:
                            if "🔗 URLなし" in log_message:
                                log_message = log_message.replace("🔗 URLなし", f"🔗 {matched_url}")
                            elif "🔗" not in log_message:
                                log_message = re.sub(
                                    r'(\[ニュース原稿\(Backend\)\]\s*\[[0-9]+/[0-9]+件\])',
                                    r'\1 🔗 ' + matched_url + '\n',
                                    log_message
                                )

                    elif "[ニュース先読み]" in log_message:
                        matched_url = ""
                        for t_key, u_val in ARTICLE_URL_CACHE.items():
                            if t_key and (t_key[:10] in log_message or t_key in log_message):
                                matched_url = u_val
                                break
                        if matched_url:
                            if "🔗 URLなし" in log_message:
                                log_message = log_message.replace("🔗 URLなし", f"🔗 {matched_url}")
                            elif "🔗" not in log_message:
                                log_message = log_message.replace("を先行生成中...", f"🔗 {matched_url} を先行生成中...")

                    write_browser_console_log(log_message)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/fetch_rss':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                rss_url = payload.get('url', '')
                if not rss_url:
                    raise ValueError("URL is required")
                
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                
                req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
                    xml_data = response.read()
                
                # XML内の全アイテムのタイトルとリンクを自動キャッシュ＆永続化
                try:
                    xml_str = xml_data.decode('utf-8', errors='ignore')
                    items = re.findall(r'<item>(.*?)</item>', xml_str, flags=re.DOTALL)
                    new_cached = 0
                    for it in items:
                        t_m = re.search(r'<title>(.*?)</title>', it, flags=re.DOTALL)
                        l_m = re.search(r'<link>(.*?)</link>', it, flags=re.DOTALL) or re.search(r'<guid[^>]*>(.*?)</guid>', it, flags=re.DOTALL)
                        if t_m and l_m:
                            t_clean = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', t_m.group(1)).strip()
                            l_clean = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', l_m.group(1)).strip()
                            if t_clean and l_clean.startswith('http'):
                                ARTICLE_URL_CACHE[t_clean] = l_clean
                                new_cached += 1
                    if new_cached > 0:
                        save_article_url_cache(ARTICLE_URL_CACHE)
                except Exception:
                    pass

                self.send_response(200)
                self.send_header('Content-type', 'application/xml')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(xml_data)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
        elif self.path == '/get_youtube_video_info':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                raw_input = payload.get('videoId', '').strip()
                
                is_channel = raw_input.startswith('@') or 'youtube.com/@' in raw_input or '/channel/' in raw_input
                if is_channel:
                    if raw_input.startswith('@'):
                        handle = raw_input
                    elif 'youtube.com/@' in raw_input:
                        handle = '@' + raw_input.split('youtube.com/@')[1].split('/')[0]
                    else:
                        handle = raw_input
                    
                    if handle.startswith('@'):
                        url = f"https://www.youtube.com/{handle}/live"
                    else:
                        url = raw_input if raw_input.endswith('/live') else f"{raw_input}/live"
                    video_id = raw_input
                else:
                    # URLから動画IDを抽出
                    match_id = re.search(r'(?:v=|\/live\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})', raw_input)
                    video_id = match_id.group(1) if match_id else raw_input
                    url = f"https://www.youtube.com/watch?v={video_id}"
                
                if not video_id or len(video_id) < 3:
                    raise ValueError("有効なYouTube動画IDまたはチャンネル名を入力してください")
                
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
                with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
                    html = response.read().decode('utf-8', errors='ignore')
                
                # 実際のvideoId抽出（canonicalまたはHTML内から）
                match_actual_id = re.search(r'link rel="canonical" href="https://www\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})"', html)
                if not match_actual_id:
                    match_actual_id = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
                if match_actual_id:
                    video_id = match_actual_id.group(1)
                
                # scheduledStartTime
                match_time = re.search(r'"scheduledStartTime":\s*"([^"]+)"', html)
                if not match_time:
                    match_time = re.search(r'"upcomingEventData":\s*\{\s*"startTime":\s*"([^"]+)"', html)
                if not match_time:
                    match_time = re.search(r'"startTimestamp":\s*"([^"]+)"', html)
                scheduled_start_time = match_time.group(1) if match_time else None
                
                # isLive
                is_live = '"isLive":true' in html or '"isLiveNow":true' in html

                # title
                match_title = re.search(r'<title>([^<]+)</title>', html)
                title = match_title.group(1).replace(" - YouTube", "").strip() if match_title else ""
                
                if not title:
                    # oEmbedで確認
                    try:
                        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                        with urllib.request.urlopen(oembed_url, context=ctx, timeout=4) as oembed_res:
                            oembed_data = json.loads(oembed_res.read().decode('utf-8'))
                            title = oembed_data.get('title', '')
                    except Exception:
                        pass

                if not title:
                    if len(video_id) == 11:
                        title = f"YouTube予約・配信枠 ({video_id})"
                        status = "scheduled_private"
                    else:
                        title = f"チャンネル配信 ({raw_input})"
                        status = "channel_autodetect"
                else:
                    status = "live" if is_live else ("scheduled" if scheduled_start_time else "ready")
                
                result = {
                    "videoId": video_id,
                    "title": title,
                    "scheduledStartTime": scheduled_start_time,
                    "isLive": is_live,
                    "status": status
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/api/youtube/start_oauth':
            import youtube_api_helper
            try:
                status = youtube_api_helper.start_oauth_flow()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, **status}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        elif self.path == '/api/youtube/create_broadcast':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            import youtube_api_helper
            try:
                payload = json.loads(post_data.decode('utf-8')) if post_data else {}
                title = payload.get('title', '')
                description = payload.get('description', '')
                start_time_iso = payload.get('scheduledStartTime')
                privacy_status = payload.get('privacyStatus', 'public')
                if privacy_status not in ['public', 'unlisted', 'private']:
                    privacy_status = 'public'
                res = youtube_api_helper.create_live_broadcast(title, description, start_time_iso, privacy_status)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, **res}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                import traceback
                print(f"[create_broadcast エラー]: {e}")
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        elif self.path == '/api/youtube/update_broadcast':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            import youtube_api_helper
            try:
                payload = json.loads(post_data.decode('utf-8')) if post_data else {}
                video_id = payload.get('videoId', '').strip()
                title = payload.get('title')
                description = payload.get('description')
                start_time_iso = payload.get('scheduledStartTime')
                privacy_status = payload.get('privacyStatus')
                res = youtube_api_helper.update_live_broadcast(video_id, title, description, start_time_iso, privacy_status)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "videoId": video_id, "data": res}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        elif self.path == '/api/youtube/upload_thumbnail':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            import youtube_api_helper
            try:
                payload = json.loads(post_data.decode('utf-8')) if post_data else {}
                video_id = payload.get('videoId', '').strip()
                image_data = payload.get('imageData', '')
                res = youtube_api_helper.upload_thumbnail(video_id, image_data)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "videoId": video_id, "data": res}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        elif self.path == '/api/news/batch_resolve_urls':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8')) if post_data else {}
                titles = payload.get('titles', [])
                results = {}
                for t in titles:
                    if not t:
                        continue
                    if t in ARTICLE_URL_CACHE:
                        results[t] = ARTICLE_URL_CACHE[t]
                    else:
                        url = search_news_url_by_title(t)
                        if url:
                            results[t] = url
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "urls": results}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/api/news/generate_item_script':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                title = payload.get('title', '')
                description = payload.get('description', '')
                category_name = payload.get('categoryName', '')
                model_id = payload.get('modelId', 'tororo')
                is_first = payload.get('isFirst', False)
                is_category_changed = payload.get('isCategoryChanged', False)
                api_key = payload.get('apiKey', '').strip()
                provider = payload.get('provider', 'gemini')
                model_name = payload.get('modelName', 'gemini-1.5-flash')

                is_zunda = (model_id in ["zundamon", "zundamon_human"])
                is_cat = (model_id in ["tororo", "hijiki"])
                
                if is_zunda:
                    char_desc = "明るく元気なずんだ妖精のVTuber「ずんだもん」です。一人称は「ボク」で、ニュースの解説は自然なトーン（〜です、〜とのこと、〜みたい）を交えつつ、語尾は「〜のだ」「〜なのだ」「〜のだ？」を自然に使ってください（全文につけすぎずテンポよく話すこと）。※毎回「ボク、ずんだもんなのだ！」と自己紹介を挟むのは禁止です。"
                elif is_cat:
                    char_desc = "親しみやすく愛嬌のある猫VTuber「とろろ」です。一人称は「ボク」です。ニュース本文の解説は落ち着いた自然で聞き取りやすい言葉遣い（〜です、〜ですね、〜とのこと、〜みたい）を中心にし、語尾の「〜にゃ」「〜だにゃ」は毎文つけすぎず、全体の2〜3割程度や最後の感想に自然に添える程度にしてください。「ですねにゃ」「ますねにゃ」「にゃね」「にゃにゃ」などの不自然な二重語尾は絶対に禁止です（『〜ですね』または『〜ですにゃ』のどちらかにすること）。※記事ごとに毎回「ボク、とろろだにゃ！」と自己紹介を挟むのは禁止です。"
                else:
                    char_desc = "明るく聞き取りやすいニュースキャスター系VTuberです。親しみやすく丁寧なトーンで話してください。"
                
                if is_first:
                    transition = "「最初のニュースなのだ！」" if is_zunda else ("「最初のニュースですにゃ！」" if is_cat else "「最初のニュースです！」")
                elif is_category_changed and category_name:
                    transition = f"「続いては、{category_name}のニュースなのだ！」" if is_zunda else (f"「続いては、{category_name}のニュースですにゃ！」" if is_cat else f"「続いては、{category_name}のニュースです！」")
                else:
                    transition = "「次のニュースなのだ！」" if is_zunda else ("「次のニュースですにゃ！」" if is_cat else "「次のニュースです！」")

                article_url = (payload.get('url', '') or payload.get('link', '')).strip()
                if not article_url:
                    # タイトルの部分一致でURLキャッシュから探索
                    for t_k, u_v in ARTICLE_URL_CACHE.items():
                        if t_k and (t_k[:10] in title or title[:10] in t_k or t_k in title or title in t_k):
                            article_url = u_v
                            break

                # キャッシュにもない場合はGoogle News検索で正規URLを即時特定
                if not article_url:
                    article_url = search_news_url_by_title(title)

                if article_url:
                    LAST_PLAYING_ARTICLE_URL = article_url
                    ARTICLE_URL_CACHE[title] = article_url
                    save_article_url_cache(ARTICLE_URL_CACHE)
                    # 🔗 browser_console.log に記事URLを直接記録
                    now_iso = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
                    write_browser_console_log(f"[{now_iso}] [LOG] [ニュース記事URL] 🔗 {article_url} | 記事: 「{title}」")
                    print(f"[記事URL特定成功] 🔗 {article_url} ({title[:20]}...)")

                full_article_content = description

                # 元記事のURLが存在する場合、裏側で本文テキストを軽量自動スクレイピング
                if article_url:
                    fetched_body = fetch_article_body(article_url)
                    if fetched_body and len(fetched_body) > 30:
                        full_article_content = f"{description}\n【元記事の詳細本文】: {fetched_body}"
                        print(f"[元記事本文取得成功] {title[:20]}... ({len(fetched_body)}文字取得)")

                prompt = build_news_prompt(char_desc, transition, title, full_article_content)

                print(f"[generate_item_script] タイトル: {title[:20]}..., URL: {article_url or 'なし'}, provider: {provider}, model: {model_name}")
                raw_text = ""
                if provider == 'ollama':
                    raw_text = call_ollama_backend(prompt, model_name or "qwen2.5:7b")
                elif provider == 'openai':
                    if api_key:
                        try:
                            raw_text = call_openai_backend(prompt, api_key, model_name or "gpt-4o-mini")
                        except Exception as ai_err:
                            print(f"[OpenAI生成エラー]: {ai_err}")
                            raw_text = ""
                else:
                    if api_key:
                        try:
                            raw_text = call_gemini_backend(prompt, api_key, model_name or "gemini-1.5-flash")
                        except Exception as ai_err:
                            print(f"[Gemini生成エラー]: {ai_err}")
                            raw_text = ""

                if not raw_text:
                    print(f"[AI生成失敗] AI原稿の生成に失敗しました（空のレスポンスまたはエラー）。待機画面（しばらくお待ちください）へ移行させるため500エラーを返却します。")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "AI generation failed. Switching to standby waiting mode."}).encode('utf-8'))
                    return

                # クリーンアップ（カギ括弧除去 ＆ 不自然な語尾重複の自動補正）
                clean_text = raw_text.replace("「", "").replace("」", "").strip()
                clean_text = re.sub(r'にゃ{2,}', 'にゃ', clean_text)
                clean_text = re.sub(r'にゃ[か？\?]+にゃ', 'かにゃ', clean_text)
                clean_text = re.sub(r'のだ{2,}', 'のだ', clean_text)
                # 🐾 「ですねにゃ」「ますねにゃ」「かもしれませんねにゃ」「ねにゃ」等の不自然な二重語尾の包括的自動置換
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
                
                # 1文ずつ（句点・感嘆符・疑問符・改行）に正確に分割（M!LK等の単語内感嘆符は除外）
                split_sentences = [s.strip() for s in re.split(r'(?<=[。！？\n])|(?<=[!?])(?![A-Za-z0-9])', clean_text) if s.strip()]
                
                # 前置き挨拶・繋ぎフレーズの重複・末尾混入の完全排除
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
                for idx, s in enumerate(split_sentences):
                    if is_transition_phrase(s):
                        if idx > 0 or seen_transition:
                            print(f"[ニュース原稿] 冒頭以外の不正な前置き・繋ぎフレーズを除去しました: '{s}'")
                            continue
                        seen_transition = True
                    # 直前の文と完全に同一の場合もスキップ
                    if deduped_sentences and s == deduped_sentences[-1]:
                        print(f"[ニュース原稿] 重複した連続文をスキップしました: '{s}'")
                        continue
                    deduped_sentences.append(s)
                raw_sentences = deduped_sentences if deduped_sentences else split_sentences
                
                # ▼▼▼ 字幕用テキスト(display) と VOICEVOX発音用テキスト(speech) のスマート分離 ▼▼▼
                # ▼▼▼ VOICEVOXの読み予想と照合する二重チェック＆自動学習エンジン ▼▼▼
                items = inspect_and_correct_pronunciation(raw_sentences, provider, api_key, model_name, full_article_content + " " + title)

                # 万が一中国語フィルター等ですべての文が除去された場合の安全な日本語フォールバック生成
                if not items:
                    fallback_plain = description.replace("「", "").replace("」", "").strip()
                    if len(fallback_plain) > 80:
                        fallback_plain = fallback_plain[:80] + "…"
                    fallback_display = f"{transition} {title}についてです。{fallback_plain} 今後の展開にも注目ですね。"
                    fallback_speech = apply_backend_pronunciation_dict(fallback_display)
                    items = [{"display": fallback_display, "speech": fallback_speech}]
                    print(f"[フォールバック生成] 中国語除去のためクリーンな日本語原稿を安全自動生成しました: 「{title}」")

                final_sentences = [it["speech"] for it in items]

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "url": article_url or "",
                    "items": items,
                    "sentences": final_sentences,
                    "fullText": "\n".join([it["display"] for it in items])
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/api/voicevox/synthesize':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                text = payload.get('text', '').strip()
                speaker_id = int(payload.get('speakerId', 1))
                speed = float(payload.get('speedScale', 1.0))
                pitch = float(payload.get('pitchScale', 0.0))

                if not text:
                    raise ValueError("text is required")

                wav_bytes, kana_str, corrected, final_text = synthesize_voicevox_backend(text, speaker_id, speed, pitch)

                self.send_response(200)
                self.send_header('Content-type', 'audio/wav')
                self.send_header('Access-Control-Allow-Origin', '*')
                expose = 'X-Voicevox-Kana, X-Voicevox-Clean-Kana, X-Voicevox-Corrected, X-Voicevox-Final-Text'
                self.send_header('Access-Control-Expose-Headers', expose)
                if kana_str:
                    # URLエンコードしてヘッダーに乗せる（ASCII安全）
                    self.send_header('X-Voicevox-Kana', urllib.parse.quote(kana_str))
                    clean_kana = clean_kana_for_display(kana_str)
                    if clean_kana:
                        self.send_header('X-Voicevox-Clean-Kana', urllib.parse.quote(clean_kana))
                if final_text:
                    self.send_header('X-Voicevox-Final-Text', urllib.parse.quote(final_text))
                if corrected:
                    self.send_header('X-Voicevox-Corrected', '1')
                self.send_header('Content-Length', str(len(wav_bytes)))
                self.end_headers()
                self.wfile.write(wav_bytes)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def inspect_and_correct_pronunciation(raw_sentences, provider="ollama", api_key="", model_name="", article_context=""):
    """VOICEVOXの予想読みと原稿を照合し、誤読（同音異字・人名・特殊読み）を検出してspeechテキストを自動補正＆学習"""
    corrected_items = []
    new_learned_dict = {}

    for s in raw_sentences:
        # 字幕用: 漢字（ふりがな）から（ふりがな）を除去して綺麗な漢字表記にし、「のかた」等を「の方」に美しく整える
        display_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', s)
        display_s = display_s.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        display_s = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)のかた([たち|がた|も|は|が|に|へ|で|を|、|。|！|？\s]|$)', r'\1の方\2', display_s)
        display_s = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)なかた([たち|がた|も|は|が|に|へ|で|を|、|。|！|？\s]|$)', r'\1な方\2', display_s)

        # 🚫 記事本文・タイトルに存在しない勝手な『作品名・ゲーム名』の捏造をPython側で完全排除
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
                s = display_s  # 🚀 音声(speech_s)の元データも完全に安全な文へ同期！
            elif re.search(r'([、\s]|^)(が[0-9]+日|は[0-9]+日|そしては[0-9]+日)', display_s):
                # 万が一『』なしで主語抜け日付羅列が発生した場合の完全救済
                display_s = "記事では関連する詳細なスケジュールがまとめられています。"
                s = display_s

        # 🚫 不完全な途切れ単語・省略記号・情報不足の誤魔化し文（例: 「Ka…という銘柄」「…は別の銘柄でした」等）の検知＆自動修復
        FRAGMENT_HALLUCINATION_PATTERN = re.compile(
            r'([A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff]{1,10}[…\.]{2,}'
            r'|[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ff]{1,10}…'
            r'|別の(銘柄|会社|企業|人物|人|作品|ゲーム|商品|団体|地域)でした'
            r'|(某|某有名|とある)(会社|企業|人物|人|作品|銘柄))'
        )
        if FRAGMENT_HALLUCINATION_PATTERN.search(display_s):
            print(f"[不完全文字列・誤魔化し検知] 🚫 途切れ文字や不完全な作文を検知: '{display_s}' ➔ 安全な解説文へ置換")
            display_s = "記事では対象となった詳細な情報や一覧が紹介されています。"
            s = display_s

        # 🛡️ 記事コンテキストに基づいた「虚偽の属性・ジャンル捏造」自動検知＆自動修復エンジン
        # 元記事に記載がないのにAIが勝手に付けたジャンル修飾語（〜という雑誌、〜というゲーム等）を汎用的に検知・除去
        if article_context:
            GENRE_KEYWORDS = ["雑誌", "ゲーム", "VTuber", "Vtuber", "YouTuber", "アニメ", "映画", "漫画", "マンガ", "ドラマ", "アプリ", "SNS", "バンド", "アイドル", "小説", "新曲"]
            for genre in GENRE_KEYWORDS:
                if genre not in article_context:
                    # パターンA: 『〇〇』という雑誌 / 〇〇というゲーム ➔ 『〇〇』 / 〇〇 に自動修復
                    pattern_a = re.compile(r'([『「]?[A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ffー・]{2,20}[』」]?)\s*(という|といった|などの|等の)' + re.escape(genre))
                    for m in pattern_a.finditer(display_s):
                        target_full = m.group(0)
                        target_name = m.group(1)
                        print(f"[属性ハルシネーション検知] 🚫 記事にないジャンル『{genre}』の捏造を検知: '{target_full}' ➔ '{target_name}' に自動修復")
                        display_s = display_s.replace(target_full, target_name)
                    
                    # パターンB: 人気VTuber 〇〇 / 有名ゲーム 〇〇 ➔ 〇〇 に自動修復
                    pattern_b = re.compile(r'(人気|有名|話題の|注目の)?' + re.escape(genre) + r'\s*([『「][A-Za-z0-9\u4e00-\u9fff\u30a0-\u30ffー・]{2,20}[』」])')
                    for m in pattern_b.finditer(display_s):
                        target_full = m.group(0)
                        target_name = m.group(2)
                        if target_name:
                            print(f"[属性ハルシネーション検知] 🚫 記事にないジャンル冠詞『{genre}』の捏造を検知: '{target_full}' ➔ '{target_name}' に自動修復")
                            display_s = display_s.replace(target_full, target_name)
            s = display_s

        # 音声用初期値（ルビ付き表記からの読み抽出 ＆ 外部辞書 hiragana_dict.json の最長一致適用）
        speech_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', s)
        speech_s = apply_backend_pronunciation_dict(speech_s)

        # ============================================================
        # 🛡️ 鉄壁の中国語混入検知・完全除去フィルター
        # 1. 簡体字・中国語固有文字
        # 2. ひらがなが0文字の漢字/英記号文（日本語会話文としてあり得ない）
        # 3. ひらがな比率が極端に低い文（例: 冒頭だけ日本語で中身が中国語）
        # 4. 中国語特有の句読点（，、“”）
        # ============================================================
        def is_chinese_sentence(text):
            if not text:
                return False
            t = text.strip()
            # 簡体字・中国語固有の語彙
            CHINESE_CHARS = re.compile(
                r'[听说这那我他她它他们俩们呢吧吗么着过从让给于把被会能想说看吃写开关点去来里边头问做多真假现谁哪几没不'
                r'好开心关注加油打气关系可爱封面消息大家为喜欢的人非常但是因为所以如果虽然已经还是就是是不是吃惊开始结束继续停止选择确认取消]'
            )
            hiragana_count = len(re.findall(r'[\u3040-\u309f]', t))
            kanji_count = len(re.findall(r'[\u4e00-\u9fff]', t))
            total_len = len(t)

            # 中国語カンマ「，」や中国語引用符「“”」を含む
            if '，' in t or '“' in t or '”' in t:
                if hiragana_count < 4 or (total_len > 6 and (hiragana_count / total_len) < 0.25):
                    return True

            # ひらがなが0文字で漢字中心の文（例:「松村北斗和今田美桜的巴弟关系真是可爱」）
            if total_len >= 5 and hiragana_count == 0 and kanji_count >= 2:
                return True

            # ひらがな比率が18%未満で漢字が多い文（例:「このニュース听到这里我觉得好开心呢」）
            if total_len >= 7 and (hiragana_count / total_len) < 0.18:
                return True

            # 中国語固有文字が2文字以上
            if len(CHINESE_CHARS.findall(t)) >= 2 and (hiragana_count / total_len) < 0.35:
                return True

            return False

        if is_chinese_sentence(display_s) or is_chinese_sentence(speech_s):
            print(f"[中国語フィルター] 🚫 中国語混入文を完全除去: 「{display_s}」")
            continue  # この文はスキップ

        # ============================================================
        # 🏷️ 自己紹介・名乗り・末尾署名文の自動除去（例:「とろろにゃ」「ボク、とろろだにゃ！」「以上、とろろでした」等）
        # ============================================================
        SELF_INTRO_PATTERN = re.compile(r'^(以上[、\s]*)?(ボク|わたし|私|僕)?[、\s]*(とろろ|ずんだもん|ひより)[だですなにゃのだでしたでお送りしましたがお伝えしました！\s　。！？]*$', re.IGNORECASE)
        if SELF_INTRO_PATTERN.match(display_s.strip()) or SELF_INTRO_PATTERN.match(speech_s.strip()):
            print(f"[名乗り・署名フィルター] 不要な名乗り・署名文を除去: 「{display_s}」")
            continue

        # ============================================================
        # 🚫 「期待が高まります」系のワンパターン定型句の徹底的完全根絶（30文字以下は無条件削除）
        # ============================================================
        if any(kw in display_s for kw in ["期待が高ま", "期待が膨ら", "期待が寄せら", "期待したい", "期待大", "期待されます", "期待ですね"]):
            if len(display_s.strip()) <= 32:
                print(f"[定型句フィルター] 🚫 「期待が高まります」系定型文を完全除去: 「{display_s}」")
                continue

        CLICHE_PATTERN = re.compile(r'^(本当に|今後の展開に|これからの活躍に|今後の動向に|今後の試合も|チームの未来に)?.*期待が(高まります|高まる|高まっている|高まっています|膨らみます|膨らむ|寄せられます|寄せられている)(ね|よ|な|よね|と思います|と感じます)?[にゃのだ！\s　。！？]*$')
        if CLICHE_PATTERN.match(display_s.strip()) or CLICHE_PATTERN.match(speech_s.strip()):
            print(f"[定型句フィルター] ワンパターンな定型文を除去: 「{display_s}」")
            continue

        corrected_items.append({
            "display": display_s,
            "speech": speech_s
        })

    # AIが発見した単語を辞書に自動永続化
    if new_learned_dict:
        try:
            save_learned_pronunciations(new_learned_dict)
        except Exception as e:
            print(f"[辞書学習保存例外]: {e}")

    return corrected_items

# 大規模国語辞典（master_dictionary.db: 65万語）接続管理
_master_db_conn = None
def get_master_db():
    global _master_db_conn
    if _master_db_conn is None:
        db_path = os.path.join(os.path.dirname(__file__), 'master_dictionary.db')
        if os.path.exists(db_path):
            try:
                _master_db_conn = sqlite3.connect(db_path, check_same_thread=False)
            except Exception as e:
                print(f"[MasterDict] DB接続エラー: {e}")
    return _master_db_conn

def lookup_master_dictionary(term):
    """65万語の国語・現代語辞典から最頻出の正しい読み（ひらがな）を瞬時に取得"""
    conn = get_master_db()
    if not conn or not term or len(term) < 2:
        return None
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT reading FROM dictionary WHERE surface = ? ORDER BY cost ASC LIMIT 1', (term,))
        row = cursor.fetchone()
        if row:
            return row[0]
    except Exception as e:
        pass
    return None

def apply_backend_pronunciation_dict(text):
    if not text:
        return text
    processed = text

    # ── 固有名詞・複合語の最優先読み分け（辞書分解や正規表現誤爆を防止） ──
    EARLY_TERMS = {
        '新千歳空港': 'しんちとせくうこう',
        '千歳空港': 'ちとせくうこう',
        '千歳基地': 'ちとせきち',
        '千歳市': 'ちとせし',
        '千歳': 'ちとせ',
        '日本ダービー': 'にほんだーびー',
    }
    for k, v in EARLY_TERMS.items():
        if k in processed:
            processed = processed.replace(k, v)

    # ── 文脈に応じた「米（べい＝アメリカ／こめ）」の最優先読み分け（辞書置換による単語分解を防止） ──
    BEI_PREFIX = {
        '米国内': 'べいこくない', '米国外': 'べいこくがい',
        '米中': 'べいちゅう', '米韓': 'べいかん', '米英': 'べいえい',
        '米仏': 'べいふつ', '米露': 'べいろ', '米朝': 'べいちょう',
        '米側': 'べいがわ', '米議会': 'べいぎかい', '米兵': 'べいへい',
        '米大使': 'べいたいし', '米副大統領': 'べいふくだいとうりょう',
        '米通商': 'べいつうしょう', '米貿易': 'べいぼうえき',
        '米国務': 'べいこくむ', '米連邦': 'べいれんぽう',
        '米民主党': 'べいみんしゅとう', '米共和党': 'べいきょうわとう',
        '米軍基地': 'べいぐんきち', '米財務長官': 'べいざいむちょうかん',
        '米財務省': 'べいざいむしょう', '米司法省': 'べいしほうしょう',
        '米労働省': 'べいろうどうしょう', '米農務省': 'べいのうむしょう',
        '米商務省': 'べいしょうむしょう', '米中央銀行': 'べいちゅうおうぎんこう',
        '米大学': 'べいだいがく', '米企業': 'べいきぎょう',
        '米市場': 'べいしじょう', '米株式': 'べいかぶしき', '米株': 'べいかぶ',
        '米メディア': 'べいメディア', '米当局': 'べいとうきょく',
        '米大手': 'べいおおて',
    }
    BEI_SUFFIX = {
        '日米': 'にちべい', '訪米': 'ほうべい', '対米': 'たいべい',
        '親米': 'しんべい', '反米': 'はんべい', '嫌米': 'けんべい',
        '知米': 'ちべい', '北米': 'ほくべい', '南米': 'なんべい',
        '中米': 'ちゅうべい', '在米': 'ざいべい', '帰米': 'きべい',
        '駐米': 'ちゅうべい', '来米': 'らいべい', '渡米': 'とべい',
        '赴米': 'ふべい',
    }
    # 長い語から順に置換（誤爆防止）
    for k, v in sorted({**BEI_PREFIX, **BEI_SUFFIX}.items(), key=lambda x: -len(x[0])):
        if k in processed:
            processed = processed.replace(k, v)

    # 1. 「米＋カタカナ地名/都市名/州名」（例: 米ネバダ州 → べいネバダ州、米アイダホ → べいアイダホ）
    processed = re.sub(r'米([ァ-ヴー]{2,})', r'べい\1', processed)
    # 2. 「米＋年数＋債/歳/物/国債」（例: 米10年債 → べい10年債、米10年歳 → べい10年さい、米2年物 → べい2年物）
    processed = re.sub(r'米([0-9０-９一二三四五六七八九十]+年(債|物|国債|歳))', r'べい\1', processed)
    # 3. 「米＋金融・経済指標・組織」（例: 米金利 → べい金利、米債券 → べい債券、米FRB → べいFRB、米CPI → べいCPI）
    processed = re.sub(r'米(金利|債券|景気|雇用統計|物価|株価|指数|経済|市場|ドル|通貨|金融|銀行|FRB|SEC|CPI|PCE|GDP|FOMC|国債)', r'べい\1', processed)
    # 4. 見出し・文頭・読点直後の単独「米」（例: 「米、対イラン」→「べい、対イラン」「米が軍事面」→「べいが軍事面」「米は」→「べいは」）
    processed = re.sub(r'(^|[、。！？「\s])米([、がはと])', r'\1べい\2', processed)

    dict_data = load_data(DICT_FILE)
    if isinstance(dict_data, dict):
        # 最長一致（長いフレーズから優先して置換し誤爆を防止）
        sorted_dict = sorted(dict_data.items(), key=lambda item: len(item[0]), reverse=True)
        for k, v in sorted_dict:
            if k in processed:
                processed = processed.replace(k, v)
    h_data = load_data(HIRAGANA_FILE)
    custom_lines = h_data.get("dictionary", "")
    if custom_lines:
        for line in custom_lines.split("\n"):
            parts = line.split(",")
            if len(parts) >= 2:
                src, dst = parts[0].strip(), parts[1].strip()
                if src and dst and src in processed:
                    processed = processed.replace(src, dst)

    # 人を指す「〜方（かた）」のVOICEVOX誤読（ホウ）完全・網羅的自動補正
    processed = re.sub(r'([ぁ-ん])方([がはもにへでを、。！？\s]|$|たち|がた)', r'\1かた\2', processed)
    processed = re.sub(r'([0-9０-９一二三四五六七八九十百千万]+人)の方', r'\1のかた', processed)

    # ── 文脈に応じた「歳（さい／とし）」の自動読み分け ──
    # 1. 年齢（数字+歳）は確実に「さい」と読ませる（例: 85歳の夫妻 → 85さいの夫妻 / 「千歳」は除外）
    processed = re.sub(r'(?<!千)([0-9０-９一二三四五六七八九十百千万]+|何)歳', r'\1さい', processed)
    # 2. 慣用句（歳をとる、歳の瀬など）は「とし」と読ませる
    processed = re.sub(r'歳を(と|重ね|取|かさね)', r'としを\1', processed)
    processed = re.sub(r'歳の(頃|ころ|市|瀬|せ)', r'としの\1', processed)

    # ── 数字+ストレージ容量単位の自動変換 ──
    # 「Pixel 11256GB」のようにAIがスペースを落とした場合も含めて対応
    # 先にモデル番号+容量の連結パターンを分離 例: ピクセル11256GB → ピクセル11 256ギガバイト
    processed = re.sub(
        r'(ピクセル|ギャラクシー|アイフォーン|アイフォン|エクスペリア)(\d{1,2})(\d{3})(GB|TB|MB)',
        r'\1\2 \3\4',
        processed
    )
    # 数字+単位を日本語読みに変換（\bの代わりに先読みで英字が続かないことを確認）
    processed = re.sub(r'(\d+)\s*TB(?![a-zA-Z])', r'\1テラバイト', processed)
    processed = re.sub(r'(\d+)\s*GB(?![a-zA-Z])', r'\1ギガバイト', processed)
    processed = re.sub(r'(\d+)\s*MB(?![a-zA-Z])', r'\1メガバイト', processed)

    # ── 英語グループ名・アーティスト固有名詞のカタカナ自動変換 ──
    ENGLISH_NAME_TO_KANA = {
        # K-POP グループ
        "SUPER JUNIOR": "スーパージュニア",
        "BTS": "ビーティーエス",
        "BLACKPINK": "ブラックピンク",
        "TWICE": "トゥワイス",
        "EXO": "エクソ",
        "NCT": "エヌシーティー",
        "SEVENTEEN": "セブンティーン",
        "STRAY KIDS": "ストレイキッズ",
        "aespa": "エスパ",
        "NewJeans": "ニュージーンズ",
        "IVE": "アイブ",
        "LE SSERAFIM": "ルセラフィム",
        "ILLIT": "イリット",
        "RIIZE": "ライズ",
        "BTOB": "ビートゥービー",
        "MONSTA X": "モンスタエックス",
        "GOT7": "ガットセブン",
        "DAY6": "デイシックス",
        "2PM": "ツーピーエム",
        "2NE1": "トゥエニーワン",
        "WINNER": "ウィナー",
        "iKON": "アイコン",
        "BIGBANG": "ビッグバン",
        "SHINee": "シャイニー",
        "f(x)": "エフエックス",
        "INFINITE": "インフィニット",
        "VIXX": "ヴィックス",
        "ASTRO": "アストロ",
        "THE BOYZ": "ザボーイズ",
        "ATEEZ": "エイティーズ",
        "TXT": "トゥモローバイトゥゲザー",
        "ENHYPEN": "エンハイプン",
        # J-POP・国際グループ
        "BIG BANG": "ビッグバン",
        "ONE DIRECTION": "ワンダイレクション",
        "COLDPLAY": "コールドプレイ",
    }
    for en_name, kana in ENGLISH_NAME_TO_KANA.items():
        # 前後が単語境界（スペース、句読点、文頭文末）の場合のみ置換
        processed = re.sub(r'(?<![a-zA-Z\u30a0-\u30ff\u3040-\u309f])' + re.escape(en_name) + r'(?![a-zA-Z])', kana, processed)

    return processed

def fetch_article_body(url):
    """ニュース元記事のURLにアクセスし、記事本文テキストを抽出して取得する（タイムアウト3.5秒）"""
    if not url or not url.startswith("http"):
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
                
            # 不要なタグ（スクリプト、スタイル、ナビゲーション、広告）を除去
            cleaned = re.sub(r'<(script|style|nav|header|footer|aside|noscript|iframe)[^>]*>.*?</\1>', '', html_text, flags=re.DOTALL | re.IGNORECASE)
            
            # <p>タグや記事本文要素からテキストを抽出
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
        "model": model,
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
        print(f"[Ollama Backend] モデル '{target_model}' 実行エラー (Ollamaが起動しているか確認してください): {e}", flush=True)
    return ""

def get_voicevox_kana(text, speaker_id=1):
    """VOICEVOXのaudio_queryを呼び出し、形態素解析結果のカタカナ読み列を取得する"""
    try:
        import urllib.parse
        encoded_text = urllib.parse.quote(text)
        query_url = f"http://localhost:50021/audio_query?text={encoded_text}&speaker={speaker_id}"
        req = urllib.request.Request(query_url, method="POST")
        with urllib.request.urlopen(req, timeout=5) as q_res:
            query_json = json.loads(q_res.read().decode("utf-8"))
            moras = []
            for phrase in query_json.get("accent_phrases", []):
                phrase_text = "".join([m.get("text", "") for m in phrase.get("moras", [])])
                moras.append(phrase_text)
            return " ".join(moras)
    except Exception as e:
        print(f"[VOICEVOX Kana Error]: {e}")
        return ""

def save_learned_pronunciations(new_words):
    """AIが検知した誤読単語（漢字 -> 正しいひらがな）を hiragana_dict.json に自動保存"""
    dict_path = os.path.join(os.path.dirname(__file__), 'hiragana_dict.json')
    try:
        existing = {}
        if os.path.exists(dict_path):
            with open(dict_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        updated = False
        for k, v in new_words.items():
            k_s = (k or "").strip()
            v_s = (v or "").strip()
            # 1文字単語や助詞・活用語尾（って、は、を、お等）は文破壊の原因になるため登録禁止
            if len(k_s) < 2 or not re.search(r'[\u4e00-\u9fafA-Za-z0-9]', k_s):
                continue
            if k_s in ["って", "て", "は", "わ", "を", "お", "でお", "のを"]:
                continue
            if k_s and v_s and k_s not in existing:
                existing[k_s] = v_s
                updated = True
                print(f"[AI自動学習] 読み補正を辞書に新規登録: '{k_s}' -> '{v_s}'")
        if updated:
            with open(dict_path, 'w', encoding='utf-8') as f:
                json.dump(existing, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"[辞書自動保存エラー]: {e}")

# pykakasi インスタンス（起動時に一度だけ初期化してキャッシュ）
_kakasi_instance = None
def _get_kakasi():
    global _kakasi_instance
    if _kakasi_instance is None:
        try:
            import pykakasi
            _kakasi_instance = pykakasi.kakasi()
        except Exception as e:
            print(f"[pykakasi 初期化エラー]: {e}")
    return _kakasi_instance

def convert_to_hiragana_yomi(text):
    """pykakasiで漢字・英字を含むテキストをひらがな読みに変換する"""
    kks = _get_kakasi()
    if kks is None:
        return text
    try:
        result = kks.convert(text)
        return "".join(item.get("hira", item.get("orig", "")) for item in result)
    except Exception as e:
        print(f"[pykakasi変換エラー]: {e}")
        return text

def needs_misread_correction(processed_text, kana_str):
    """
    辞書変換後のテキストに漢字が残っていれば誤読リスクあり → 再合成が必要と判定。
    ひらがな・カタカナ・英数字・記号のみなら誤読の余地なし。
    """
    # 漢字（CJK統合漢字）が1文字でも残っていれば補正対象
    if re.search(r'[\u4e00-\u9fff\u3400-\u4dbf]', processed_text):
        return True
    return False

# ── Wikipedia 読み取得キャッシュ（同一ワードの重複API呼び出しを防止）──
_wiki_reading_cache = {}

def lookup_wikipedia_reading(term):
    """
    Wikipedia APIで固有名詞の読み（ひらがな）を取得する。
    記事名を直接指定して冒頭文から正確な読みを抽出。
    ノイズワード（接続詞や外国語別称）は厳格に除外。
    返り値: (登録対象語句, 読みひらがな) のタプル、または (None, None)
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

    # 明らかに除外すべきノイズ単語
    INVALID_READINGS = {"あるいは", "または", "かつて", "えいご", "ちゅうごくご", "ちょうせんご", "かんこくご", "りゃくしょう", "つうしょう", "ほんみょう", "きゅうせい"}

    try:
        # Step1: 記事名を直接指定して抽出（最も高精度＆1リクエストで完了）
        ext_url = (
            "https://ja.wikipedia.org/w/api.php"
            "?action=query&prop=extracts&exintro=true&exsentences=2"
            "&explaintext=true&titles={}&redirects=1&format=json"
        ).format(urllib.parse.quote(term))
        req = urllib.request.Request(ext_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5, context=ctx) as r:
            pages = json.loads(r.read().decode("utf-8")).get("query", {}).get("pages", {})

        for page_id, page in pages.items():
            if page_id == "-1":
                continue
            extract = page.get("extract", "")
            page_title = page.get("title", term)

            # 冒頭80文字以内の最初の括弧から読みを取得（後方の別名や外国語読みを拾わない）
            intro_text = extract[:100]
            m = re.search(
                r'[（(]([ぁ-んァ-ヶー\s　っッ]+?)(?:[、,\s　]|あるいは|または|[）)])',
                intro_text
            )
            if m:
                reading = re.sub(r"[\s　]", "", m.group(1))
                if re.fullmatch(r"[ぁ-んァ-ヶーっッ]+", reading) and 2 <= len(reading) <= 20:
                    reading = reading.translate(str.maketrans(
                        "ァィゥェォァイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンッー",
                        "ぁぃぅぇぉあいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんっー"
                    ))
                    # ノイズ単語チェック
                    if reading in INVALID_READINGS:
                        continue

                    # 括弧などの曖昧さ回避表記を除去
                    clean_title = re.sub(r'\s*[\(（][^\)）]*[\)）]', '', page_title).strip()
                    # 検索語と記事タイトルが厳密一致または主要語であること
                    t_c = term.replace(" ", "")
                    p_c = clean_title.replace(" ", "")
                    if t_c != p_c and not (len(p_c) >= 3 and p_c in t_c) and not (len(t_c) >= 3 and t_c in p_c):
                        continue

                    # 2文字の日常語がマイナー専門用語や別名に化けるのを防止（文字数の比率が不自然なものは除外）
                    if len(term) == 2 and (len(reading) > 6 or len(reading) < 2):
                        continue

                    target_term = clean_title if (len(clean_title) >= 2 and len(clean_title) <= len(term)) else term
                    print(f"[Wikipedia読み取得] '{term}' → 記事名:'{target_term}' 読み:'{reading}'")
                    res = (target_term, reading)
                    _wiki_reading_cache[term] = res
                    return res

        _wiki_reading_cache[term] = (None, None)
        return None, None
    except Exception as e:
        print(f"[Wikipedia読み取得エラー] '{term}': {e}")
        _wiki_reading_cache[term] = (None, None)
        return None, None

def extract_kanji_terms(text):
    """テキストから漢字を含む固有名詞・人名を的確に抽出する（「満島ひかり」「広瀬すず」等のひらがな混じり人名にも対応）"""
    # 一般的な日常語でWikipedia検索不要なワード（VOICEVOXが自然に読める基本語）
    COMMON_BASIC_WORDS = {
        "今日", "明日", "昨日", "現在", "過去", "未来", "時間", "場所", "理由", "原因",
        "日本", "世界", "全国", "東京", "大阪", "京都", "情報", "記事", "紹介", "普通",
        "体験", "現代", "都市", "寄付", "後世", "歴史", "計画", "部分", "評価", "政治",
        "丁寧", "合流", "政党", "海外", "移籍", "試合", "我慢", "限界", "経験", "連盟",
        "対策", "改善", "男女", "事故", "花火", "途中", "安全", "死因", "死亡", "鉄道",
        "警察", "押収", "大切", "侵略", "和平", "降伏", "侵攻", "期間", "戦争", "保険",
        "費用", "修理", "白菜", "調査", "中国", "首相", "総裁", "波紋", "非難", "批判",
        "対応", "政府", "声明", "反応", "超党派", "事業", "展開", "状況", "安定", "金融",
        "成長", "機関", "役割", "関与", "強化", "財政", "株主", "基盤", "企業", "利益",
        "価値", "最大", "銀行", "主幹事", "空港", "銘柄", "政策", "兵士", "望遠", "統一",
        "使用", "保持", "化学", "物質", "農家", "関連", "健康", "食品", "注意", "野菜",
        "信頼", "結果", "初夏", "浅野", "出産", "彼女", "俳優", "自然", "消費者", "化学物質"
    }

    terms = set()

    # 1. 漢字のみの語句（例: 三浦大知、河北省、小川航基）
    raw_kanji = re.findall(r'[\u4e00-\u9fff\u3400-\u4dbf]{2,}', text)
    for t in raw_kanji:
        if t not in COMMON_BASIC_WORDS:
            terms.add(t)

    # 2. 「漢字＋ひらがな」の人名・芸名（例: 満島ひかり、広瀬すず、藤原さくら、百田夏菜子）
    mixed_hiragana = re.findall(r'[\u4e00-\u9fff\u3400-\u4dbf]{1,4}[ぁ-ん]{2,4}', text)
    for t in mixed_hiragana:
        if t not in COMMON_BASIC_WORDS and len(t) >= 3:
            terms.add(t)

    # 3. 「漢字＋カタカナ」の人名・芸名（例: 柴咲コウ、大野拓朗）
    mixed_katakana = re.findall(r'[\u4e00-\u9fff\u3400-\u4dbf]{1,4}[ァ-ヶー]{2,4}', text)
    for t in mixed_katakana:
        if t not in COMMON_BASIC_WORDS and len(t) >= 3:
            terms.add(t)

    # 4. 役職サフィックス（市長、選手、知事等）の分離
    suffixes = ['市長', '選手', '知事', '首相', '総理', '大臣', '社長', '会長', '教授', '監督', '議員', '代表', 'アナ']
    for t in list(terms):
        for s in suffixes:
            if t.endswith(s) and len(t) > len(s) + 1:
                base = t[:-len(s)]
                if base not in COMMON_BASIC_WORDS:
                    terms.add(base)

    # 長い固有名詞優先（三浦大知 > 三浦 など）でソート
    return sorted(list(set(t for t in terms if len(t) >= 2)), key=lambda x: len(x), reverse=True)

def enrich_dict_from_text(text):
    """
    テキスト中の漢字語句をWikipedia APIで読み検索し、
    未登録のものを hiragana_dict.json に自動追加する。
    返り値: 新規追加件数
    """
    dict_path = os.path.join(os.path.dirname(__file__), "hiragana_dict.json")
    try:
        existing = {}
        if os.path.exists(dict_path):
            with open(dict_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
    except Exception:
        existing = {}

    terms = extract_kanji_terms(text)
    # 既に辞書登録済みはスキップ
    unknown_terms = [t for t in terms if t not in existing]
    if not unknown_terms:
        return 0

    added = 0
    import time
    for term in unknown_terms:
        # Step 1: 65万語の大規模国語辞典から最優先ルックアップ（超高速・高精度）
        master_reading = lookup_master_dictionary(term)
        if master_reading and term not in existing:
            existing[term] = master_reading
            added += 1
            print(f"[国語辞典自動登録 (65万語)] '{term}' → '{master_reading}'")
            continue

        # Step 2: 国語辞典にない固有名詞・人名・最新用語のみ Wikipedia API で検索
        target_term, reading = lookup_wikipedia_reading(term)
        time.sleep(0.05)  # APIレートリミット対策
        if target_term and reading and target_term not in existing:
            existing[target_term] = reading
            added += 1
            print(f"[Wikipedia辞書自動登録] '{target_term}' → '{reading}'")

    if added > 0:
        try:
            with open(dict_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False, indent=4)
            print(f"[辞書自動学習] 計{added}件を hiragana_dict.json に追加しました")
        except Exception as e:
            print(f"[辞書保存エラー]: {e}")

    return added

def clean_kana_for_display(kana_str):
    """VOICEVOX内部のアクセント記号（'や_や/）を除去して、人間が読める読みやすいカナ文字列に整形"""
    if not kana_str:
        return ""
    # / は単語区切りなのでスペースに、' や _ はアクセント記号なので削除
    cleaned = kana_str.replace('/', ' ').replace("'", "").replace("_", "").strip()
    return cleaned

def synthesize_voicevox_backend(text, speaker_id=1, speed=1.0, pitch=0.0):
    import urllib.parse
    processed_text = apply_backend_pronunciation_dict(text)
    final_text = processed_text
    corrected = False

    def _audio_query(t):
        enc = urllib.parse.quote(t)
        url = f"http://localhost:50021/audio_query?text={enc}&speaker={speaker_id}"
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))

    query_json = _audio_query(processed_text)
    kana_str = query_json.get("kana", "")
    if kana_str:
        print(f"[VOICEVOX発音カナ] {kana_str}")

    # ── 誤読チェック＆自動リトライ ──
    if needs_misread_correction(processed_text, kana_str):
        # Step1: Wikipedia で漢字語の読みを取得 → 辞書に自動登録
        wiki_added = enrich_dict_from_text(processed_text)
        if wiki_added > 0:
            # 辞書更新後に再適用
            processed_text = apply_backend_pronunciation_dict(text)
            final_text = processed_text
            print(f"[誤読補正] Wikipedia登録後 再変換: {processed_text!r}")

        # Step2: まだ漢字が残るなら pykakasi で完全ひらがな化
        if needs_misread_correction(processed_text, None):
            yomi_text = convert_to_hiragana_yomi(processed_text)
            final_text = yomi_text
            print(f"[誤読補正] pykakasi適用: {yomi_text!r}")
            query_json = _audio_query(yomi_text)
        else:
            # Wikipedia だけで解決した場合はそのまま再合成
            final_text = processed_text
            query_json = _audio_query(processed_text)

        kana_str = query_json.get("kana", kana_str)
        corrected = True
        if kana_str:
            print(f"[VOICEVOX発音カナ(補正後)] {kana_str}")


    if speed != 1.0:
        query_json["speedScale"] = speed
    if pitch != 0.0:
        query_json["pitchScale"] = pitch

    synth_url = f"http://localhost:50021/synthesis?speaker={speaker_id}"
    req_synth = urllib.request.Request(
        synth_url,
        data=json.dumps(query_json).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_synth, timeout=15) as s_res:
        wav_bytes = s_res.read()
    return wav_bytes, kana_str, corrected, final_text

def run():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), RequestHandler) as httpd:
        print(f"API Server running at port {PORT} (Multi-threaded)")
        httpd.serve_forever()

if __name__ == '__main__':
    run()
