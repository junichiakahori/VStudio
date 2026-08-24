import http.server
import socketserver
import json
import os
import glob
import urllib.request
import ssl
import re
import time

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
        if self.path == '/trigger_hot_reload':
            global current_hot_reload_timestamp
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
                privacy_status = payload.get('privacyStatus', 'unlisted')
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
                    char_desc = "親しみやすく愛嬌のある猫VTuber「とろろ」です。一人称は「ボク」です。ニュース本文の解説は落ち着いた自然で聞き取りやすい言葉遣い（〜です、〜ですね、〜とのこと、〜みたい）を中心にし、語尾の「〜にゃ」「〜だにゃ」は毎文つけすぎず、全体の2〜3割程度や最後の感想に自然に添える程度にしてください。「にゃにゃ」「にゃかにゃ」などの連続語尾は絶対に禁止です。※記事ごとに毎回「ボク、とろろだにゃ！」と自己紹介を挟むのは禁止です。"
                else:
                    char_desc = "明るく聞き取りやすいニュースキャスター系VTuberです。親しみやすく丁寧なトーンで話してください。"
                
                if is_first:
                    transition = "「最初のニュースなのだ！」" if is_zunda else ("「最初のニュースですにゃ！」" if is_cat else "「最初のニュースです！」")
                elif is_category_changed and category_name:
                    transition = f"「続いては、{category_name}のニュースなのだ！」" if is_zunda else (f"「続いては、{category_name}のニュースですにゃ！」" if is_cat else f"「続いては、{category_name}のニュースです！」")
                else:
                    transition = "「次のニュースなのだ！」" if is_zunda else ("「次のニュースですにゃ！」" if is_cat else "「次のニュースです！」")

                article_url = (payload.get('url', '') or payload.get('link', '')).strip()
                full_article_content = description

                # 元記事のURLが存在する場合、裏側で本文テキストを軽量自動スクレイピング
                if article_url:
                    fetched_body = fetch_article_body(article_url)
                    if fetched_body and len(fetched_body) > 30:
                        full_article_content = f"{description}\n【元記事の詳細本文】: {fetched_body}"
                        print(f"[元記事本文取得成功] {title[:20]}... ({len(fetched_body)}文字取得)")

                prompt = f"""あなたは人気配信者である{char_desc}
以下のニュース記事（タイトルと概要、詳細本文）の内容をしっかりと読み込み、出来事の経緯やポイントをリスナーに分かりやすく丁寧に紹介した上で、そのニュースに即した共感や感想を伝えてください。

【構成のルール（全体で5〜7文程度の充実した構成）】:
1. **冒頭**: {transition}
2. **ニュースの丁寧な紹介（3〜4文）**:
   ・【ニュースタイトル】と【記事内容（概要・詳細本文）】に書かれている出来事、背景、状況、関係者のコメントなどをしっかり拾って分かりやすく解説してください。
   ・概要や詳細本文に書かれている事実を丁寧に拾い、単なるタイトルの一行要約で終わらせないこと。
3. **内容に即した感想（1〜2文）**:
   ・「期待が高まりますね」などのワンパターンの定型句ではなく、ニュースの内容（驚き、感動、応援、共感など）にしっかり合わせた温かい感想を述べてください。

【話し方・トーンの重要ルール】:
0. **【完全日本語厳守・中国語絶対禁止】必ず100%標準語の自然な日本語のみで出力してください。中国語文字（听、这、那、很、吃惊、吗、的、了等）は1文字も混入させないこと。**
1. **テンポの良い短文構成**: 1文は20〜35文字程度で句点「。」で区切り、聞き取りやすくリズミカルに話してください。
2. **語尾の使いすぎ禁止**: 毎文無理にキャラクター語尾をつけず、通常の丁寧語（〜です、〜ですね、〜とのことです）を基本にし、要所にのみ自然に添えてください。
3. **前置き挨拶の重複・末尾配置の絶対禁止**: {transition}は冒頭に1度だけ発話し、2文目以降や末尾に「次のニュース」「続いてのニュース」等を絶対に入れないこと。
4. **余計な注釈の禁止**: セリフ以外の前置きや解説（「」等）は出力せず、発話するセリフのみを出力してください。
5. **人名・作品タイトルのルビ必須ルール**: 日本の人名や作品タイトル（『』「」）は必ず【漢字・英字（正しいひらがな・カタカナ読み）】の形式でルビを振ってください（例: 『ONE PIECE（ワンピース）』、孫正義（そん まさよし）氏、SixTONES（ストーンズ））。
6. **事実に基づく解説（ハルシネーション厳禁）**:
   記事内容に書かれている詳細情報を豊かに解説してください。ただし、記事に書かれていない全く無関係な人名やでっち上げの創作を勝手に追加することは厳禁です。

【ニュースタイトル】: {title}
【記事内容（概要・詳細本文）】: {full_article_content}"""

                print(f"[generate_item_script] タイトル: {title[:20]}..., APIキー文字数: {len(api_key)}, provider: {provider}, model: {model_name}")
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
                items = inspect_and_correct_pronunciation(raw_sentences, provider, api_key, model_name)

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

                wav_bytes = synthesize_voicevox_backend(text, speaker_id, speed, pitch)
                
                self.send_response(200)
                self.send_header('Content-type', 'audio/wav')
                self.send_header('Access-Control-Allow-Origin', '*')
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

def inspect_and_correct_pronunciation(raw_sentences, provider="ollama", api_key="", model_name=""):
    """VOICEVOXの予想読みと原稿を照合し、誤読（同音異字・人名・特殊読み）を検出してspeechテキストを自動補正＆学習"""
    corrected_items = []
    new_learned_dict = {}

    for s in raw_sentences:
        # 字幕用: 漢字（ふりがな）から（ふりがな）を除去して綺麗な漢字表記にし、「のかた」等を「の方」に美しく整える
        display_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', s)
        display_s = display_s.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
        display_s = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)のかた([たち|がた|も|は|が|に|へ|で|を|、|。|！|？\s]|$)', r'\1の方\2', display_s)
        display_s = re.sub(r'([ぁ-んァ-ヶーA-Za-z0-9・]+)なかた([たち|がた|も|は|が|に|へ|で|を|、|。|！|？\s]|$)', r'\1な方\2', display_s)
        display_s = display_s.replace("とろろにゃん", "とろろ").replace("お知らせしてあげる", "お知らせします").replace("教えてあげる", "ご紹介します").replace("安心しなさい", "ご安心ください")

        # 音声用初期値
        speech_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', s)
        speech_s = speech_s.replace("とろろにゃん", "とろろ").replace("お知らせしてあげる", "お知らせします").replace("教えてあげる", "ご紹介します").replace("安心しなさい", "ご安心ください")
        speech_s = apply_backend_pronunciation_dict(speech_s)

        # 誤読頻出単語の確実な置換
        known_fixes = {
            "孫正義氏": "そんまさよしし",
            "孫正義さん": "そんまさよしさん",
            "孫正義社長": "そんまさよししゃちょう",
            "孫正義会長": "そんまさよしかいちょう",
            "孫正義": "そんまさよし",
            "孫氏": "そんし",
            "孫社長": "そんしゃちょう",
            "孫会長": "そんかいちょう",
            "方たち": "かたたち",
            "方々": "かたがた",
            "調光": "ちょうこう",
            "世知辛い": "せちづらい",
            "世知つらい": "せちづらい",
            "今話題の": "いまわだいの",
            "今話題": "いまわだい",
            "今現在": "いまげんざい"
        }
        for k, v in known_fixes.items():
            if k in speech_s:
                speech_s = speech_s.replace(k, v)
                new_learned_dict[k] = v

        # AIが生成したルビ（例: KEY TO LIT（キートゥーリット）、角田裕毅（つのだ ゆうき））を自動抽出して学習辞書に即時登録
        for m in re.finditer(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・\s]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', s):
            orig_word = m.group(1).strip()
            reading_word = m.group(2).strip()
            if orig_word and reading_word and len(orig_word) >= 2:
                new_learned_dict[orig_word] = reading_word

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
        # 自己紹介・名乗り文の自動除去（例:「ボク、とろろだにゃ！」「ボク、とろろです！」など）
        # ============================================================
        SELF_INTRO_PATTERN = re.compile(r'^(ボク|わたし|私|僕)[、\s]*(とろろ|ずんだもん|ひより)[だですなにゃのだ！\s]*$')
        if SELF_INTRO_PATTERN.match(display_s.strip()):
            print(f"[自己紹介フィルター] 不要な名乗り文を除去: 「{display_s}」")
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

    # ニュースで頻出する主要英単語・IT用語の自動カタカナ変換（棒読み防止セーフティネット）
    COMMON_ENGLISH_WORDS = {
        "AI": "エーアイ", "IT": "アイティー", "SNS": "エスエヌエス", "EV": "イーブイ",
        "DX": "ディーエックス", "SDGs": "エスディージーズ", "LIVE": "ライブ", "Live": "ライブ",
        "NEWS": "ニュース", "News": "ニュース", "WORLD": "ワールド", "World": "ワールド",
        "TOP": "トップ", "Top": "トップ", "NEW": "ニュー", "New": "ニュー",
        "STUDIO": "スタジオ", "Studio": "スタジオ", "GAME": "ゲーム", "Game": "ゲーム",
        "MUSIC": "ミュージック", "Music": "ミュージック", "MOVIE": "ムービー", "Movie": "ムービー",
        "DRAMA": "ドラマ", "Drama": "ドラマ", "EVENT": "イベント", "Event": "イベント",
        "TOUR": "ツアー", "Tour": "ツアー", "SHOW": "ショー", "Show": "ショー",
        "FESTIVAL": "フェスティバル", "Festival": "フェスティバル", "FES": "フェス", "Fes": "フェス",
        "STAGE": "ステージ", "Stage": "ステージ", "STAR": "スター", "Star": "スター",
        "TEAM": "チーム", "Team": "チーム", "CLUB": "クラブ", "Club": "クラブ",
        "LINE": "ライン", "Line": "ライン", "APP": "アップ", "App": "アップ", "Apps": "アップス",
        "WEB": "ウェブ", "Web": "ウェブ", "ONLINE": "オンライン", "Online": "オンライン",
        "SITE": "サイト", "Site": "サイト", "PAGE": "ページ", "Page": "ページ",
        "POST": "ポスト", "Post": "ポスト", "FAN": "ファン", "Fan": "ファン",
        "GOODS": "グッズ", "Goods": "グッズ", "SHOP": "ショップ", "Shop": "ショップ",
        "STORE": "ストア", "Store": "ストア", "MARKET": "マーケット", "Market": "マーケット",
        "SALE": "セール", "Sale": "セール", "PRICE": "プライス", "Price": "プライス",
        "RANKING": "ランキング", "Ranking": "ランキング", "BEST": "ベスト", "Best": "ベスト",
        "HOT": "ホット", "Hot": "ホット", "TREND": "トレンド", "Trend": "トレンド",
        "PROJECT": "プロジェクト", "Project": "プロジェクト", "GROUP": "グループ", "Group": "グループ",
        "MEMBER": "メンバー", "Member": "メンバー", "VOICE": "ボイス", "Voice": "ボイス",
        "AUDIO": "オーディオ", "Audio": "オーディオ", "VIDEO": "ビデオ", "Video": "ビデオ",
        "CHANNEL": "チャンネル", "Channel": "チャンネル", "STREAM": "ストリーム", "Stream": "ストリーム",
        "ROOM": "ルーム", "Room": "ルーム", "STATION": "ステーション", "Station": "ステーション"
    }
    # 単語境界または記号で囲まれた英単語を安全に置換
    for en_word, kana_word in sorted(COMMON_ENGLISH_WORDS.items(), key=lambda x: len(x[0]), reverse=True):
        processed = re.sub(r'(?<![A-Za-z0-9])' + re.escape(en_word) + r'(?![A-Za-z0-9])', kana_word, processed)

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
    
    if speed != 1.0:
        query_json["speedScale"] = speed
    if pitch != 0.0:
        query_json["pitchScale"] = pitch
    
    synth_url = f"http://localhost:50021/synthesis?speaker={speaker_id}"
    req_synth = urllib.request.Request(synth_url, data=json.dumps(query_json).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req_synth, timeout=15) as s_res:
        wav_bytes = s_res.read()
    return wav_bytes

def run():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), RequestHandler) as httpd:
        print(f"API Server running at port {PORT} (Multi-threaded)")
        httpd.serve_forever()

if __name__ == '__main__':
    run()
