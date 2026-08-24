import http.server
import socketserver
import json
import os
import glob
import urllib.request
import ssl
import re
import time
import threading

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

current_hot_reload_timestamp = int(time.time() * 1000)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLE_URLS_FILE = os.path.join(BASE_DIR, "article_urls.json")
PROMPT_TEMPLATE_FILE = os.path.join(BASE_DIR, "news_prompt_template.txt")

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

                    with open('browser_console.log', 'a', encoding='utf-8') as f:
                        f.write(log_message + '\n')
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
                privacy_status = payload.get('privacyStatus', 'unlisted')
                if privacy_status not in ['public', 'unlisted', 'private']:
                    privacy_status = 'unlisted'
                res = youtube_api_helper.create_live_broadcast(title, description, start_time_iso, privacy_status)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, **res}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
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
                    with open('browser_console.log', 'a', encoding='utf-8') as f:
                        f.write(f"[{now_iso}] [LOG] [ニュース記事URL] 🔗 {article_url} | 記事: 「{title}」\n")
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

                wav_bytes, kana_str = synthesize_voicevox_backend(text, speaker_id, speed, pitch)
                
                self.send_response(200)
                self.send_header('Content-type', 'audio/wav')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Expose-Headers', 'X-Voicevox-Kana')
                if kana_str:
                    # URLエンコードしてヘッダーに乗せる（ASCII安全）
                    self.send_header('X-Voicevox-Kana', urllib.parse.quote(kana_str))
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

def apply_backend_pronunciation_dict(text):
    if not text:
        return text
    processed = text
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
    # ※ 直前が平仮名（大切な方、〜の方、〜る方、〜た方、〜ない方、この方 等）は100%「かた」に補正
    # ※ 一方、両方、前方、後方、方法等の漢字熟語（直前が漢字）は「ほう」のまま安全に維持
    processed = re.sub(r'([ぁ-ん])方([がはもにへでを、。！？\s]|$|たち|がた)', r'\1かた\2', processed)
    processed = re.sub(r'([0-9０-９一二三四五六七八九十百千万]+人)の方', r'\1のかた', processed)

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

def synthesize_voicevox_backend(text, speaker_id=1, speed=1.0, pitch=0.0):
    import urllib.parse
    processed_text = apply_backend_pronunciation_dict(text)
    encoded_text = urllib.parse.quote(processed_text)
    query_url = f"http://localhost:50021/audio_query?text={encoded_text}&speaker={speaker_id}"
    req = urllib.request.Request(query_url, method="POST")
    with urllib.request.urlopen(req, timeout=10) as q_res:
        query_json = json.loads(q_res.read().decode("utf-8"))
    
    kana_str = query_json.get("kana", "")
    if kana_str:
        print(f"[VOICEVOX発音カナ] {kana_str}")

    if speed != 1.0:
        query_json["speedScale"] = speed
    if pitch != 0.0:
        query_json["pitchScale"] = pitch
    
    synth_url = f"http://localhost:50021/synthesis?speaker={speaker_id}"
    req_synth = urllib.request.Request(synth_url, data=json.dumps(query_json).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req_synth, timeout=15) as s_res:
        wav_bytes = s_res.read()
    return wav_bytes, kana_str

def run():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), RequestHandler) as httpd:
        print(f"API Server running at port {PORT} (Multi-threaded)")
        httpd.serve_forever()

if __name__ == '__main__':
    run()
