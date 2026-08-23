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
                payload = json.loads(post_data.decode('utf-8'))
                log_message = payload.get('message', '')
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
                    char_desc = "明るく元気なずんだ妖精のVTuber「ずんだもん」です。一人称は「ボク」で、語尾は「〜のだ」「〜なのだ」「〜のだ！」「〜のだ？」など自然で感情豊かなずんだもん口調を使ってください。"
                elif is_cat:
                    char_desc = "親しみやすく愛嬌のある猫耳VTuber「とろろ」です。一人称は「ボク」または「わたし」で、語尾に「〜にゃ」「〜だにゃ」「〜かにゃ？」「〜にゃ！」「〜だよにゃ」など自然でバリエーション豊かな猫口調を使ってください（全行同じ語尾を単調に繰り返さないこと）。"
                else:
                    char_desc = "明るく聞き取りやすいニュースキャスター系VTuberです。親しみやすく丁寧なトーンで話してください。"
                
                if is_first:
                    transition = "「最初のニュースなのだ！」" if is_zunda else ("「最初のニュースですにゃ！」" if is_cat else "「最初のニュースです！」")
                elif is_category_changed and category_name:
                    transition = f"「続いては、{category_name}のニュースなのだ！」" if is_zunda else (f"「続いては、{category_name}のニュースですにゃ！」" if is_cat else f"「続いては、{category_name}のニュースです！」")
                else:
                    transition = "「次のニュースなのだ！」" if is_zunda else ("「次のニュースですにゃ！」" if is_cat else "「次のニュースです！」")

                prompt = f"""あなたは人気配信者である{char_desc}
以下のニュース記事について、{transition}と元気に前置きして、リスナーに向けてニュースの要点をかみ砕いて分かりやすく伝え、最後にあなた自身の感情やリスナーへの気遣い・共感を込めた率直な一言感想を述べてください。

【話し方・トーンの重要ルール】:
1. **淡々とした事実の羅列を禁止**: 単なる事実の箇条書きではなく、驚き・心配・喜びなどの感情を込め、リスナーに語りかけるように生き生きと話してください。
2. **語尾のバリエーション**: 毎文同じ語尾（「〜したにゃ」等）を機械的に連発せず、「〜みたいだにゃ」「〜なんだって！」「〜本当に心配だにゃ…」「みんなも気をつけてほしいにゃ」など、自然でリズミカルな会話調にしてください。
3. **テンポの良い短文構成**: 1文は20〜35文字程度で句点「。」で区切り、長文を1文でダラダラ話さないようにしてください。
4. **自然な日本語表記**: 字幕用として読みやすい自然な日本語（漢字・ひらがな・カタカナ）で表記してください。
5. **前置き挨拶の重複禁止**: {transition}は冒頭に1度だけ発話し、2文目以降に「次のニュースです」「続いてのニュース」などの前置きを絶対に重複させないこと。
6. **余計な注釈の禁止**: セリフ以外の前置きや解説（「」等）は出力せず、発話するセリフのみを出力してください。
7. **人名・固有名詞・難読語のふりがな付与**:
   日本の人名、著名人、選手、政治家、芸能人、グループ名など、読み間違いやすい固有名詞は、必ず【漢字（ひらがな）】または【英語（カタカナ）】の形式で出力してください。
   （例: 角田裕毅（つのだ ゆうき）選手、松村北斗（まつむら ほくと）さん、大谷翔平（おおたに しょうへい）選手、SixTONES（ストーンズ）、ランド・ノリス選手）
8. **人を指す「方（かた）」や誤読しやすい日常語の平仮名化**:
   人を表す「方」（例: 高齢のかた、被害に遭ったかた、亡くなられたかた、作業をしていたかた、リスナーのかた等）は音声合成が「ほう」と誤読するのを防ぐため、**必ず平仮名で「かた」と表記**してください。
   また、辛い→つらい、焦る→あせる、お家→おうち、何事→なにごと、〜件→〜けん、一日中→いちにちじゅう等も自然な平仮名で表記してください。
9. **「米（アメリカ vs お米）」の誤読防止**:
   アメリカを指す場合は見出しの「米」をそのまま読ませず「アメリカ」または「米国（べいこく）」と表記し、食べるお米を指す場合は「お米（おこめ）」や「新米」と明確に表記してください。

【ニュースタイトル】: {title}
【概要】: {description}"""

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

                # クリーンアップ（カギ括弧のみ除去し、ルビ用の括弧（）は保持）
                clean_text = raw_text.replace("「", "").replace("」", "").strip()
                
                # 1文ずつ（句点・感嘆符・疑問符・改行）に正確に分割（M!LK等の単語内感嘆符は除外）
                split_sentences = [s.strip() for s in re.split(r'(?<=[。！？\n])|(?<=[!?])(?![A-Za-z0-9])', clean_text) if s.strip()]
                
                # 前置き挨拶の重複・連続文の完全排除
                transition_phrases = [
                    "次のニュースですにゃ！", "次のニュースですにゃ", "次のニュースにゃ！", "次のニュースにゃ",
                    "次のニュースなのだ！", "次のニュースなのだ", "次のニュースなのだ？",
                    "最初のニュースですにゃ！", "最初のニュースにゃ！", "最初のニュースなのだ！", "最初のニュースなのだ",
                    "次のニュースです！", "最初のニュースです！", "次の話題ですにゃ！", "次の話題なのだ！",
                    "続いてのニュースですにゃ！", "続いてのニュースにゃ！", "続いてのニュースなのだ！", "続いてのニュースです！",
                    "続いては、", "続いては"
                ]
                deduped_sentences = []
                seen_transition = False
                for s in split_sentences:
                    is_trans = any(s == tp or s.startswith(tp) for tp in transition_phrases) or (category_name and f"{category_name}のニュース" in s)
                    if is_trans:
                        if seen_transition:
                            print(f"[ニュース原稿] 重複した前置き挨拶をスキップしました: '{s}'")
                            continue
                        seen_transition = True
                    # 直前の文と完全に同一の場合もスキップ
                    if deduped_sentences and s == deduped_sentences[-1]:
                        print(f"[ニュース原稿] 重複した連続文をスキップしました: '{s}'")
                        continue
                    deduped_sentences.append(s)
                raw_sentences = deduped_sentences if deduped_sentences else split_sentences
                
                # ▼▼▼ 字幕用テキスト(display) と VOICEVOX発音用テキスト(speech) のスマート分離 ▼▼▼
                items = []
                for s in raw_sentences:
                    # 字幕用: 漢字（ふりがな）から（ふりがな）を除去して綺麗な漢字表記にする
                    display_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', s)
                    display_s = display_s.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()

                    # 音声用: 漢字（ふりがな）を【ふりがな】に置換してVOICEVOXに100%正確に読ませる
                    speech_s = re.sub(r'([\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9・]+)[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', s)
                    speech_s = apply_backend_pronunciation_dict(speech_s)

                    items.append({
                        "display": display_s,
                        "speech": speech_s
                    })
                
                final_sentences = [it["speech"] for it in items]

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "items": items,
                    "sentences": final_sentences,
                    "fullText": "\n".join(raw_sentences)
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

def apply_backend_pronunciation_dict(text):
    if not text:
        return text
    processed = text
    dict_data = load_data(DICT_FILE)
    if isinstance(dict_data, dict):
        for k, v in dict_data.items():
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

    # 人を指す「〜の方（かた）」のVOICEVOX誤読（ホウ）自動補正
    processed = re.sub(r'([0-9０-９一二三四五六七八九十百千万]+人)の方', r'\1のかた', processed)
    processed = re.sub(r'(高齢|被害|被災|怪我|ケガ|けが|作業|リスナー|視聴者|ファン|関係者|参加者|一般|遺族|家族|避難|利用|生存|死亡|亡くなられた|亡くなった|遭った|いた|行っていた|お持ち|ご覧|来場|お越し|ご存知|お困り|お悩み|お考え)の方([がはもにへでを、。！？\s]|$)', r'\1のかた\2', processed)

    return processed

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
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"API Server running at port {PORT}")
        httpd.serve_forever()

if __name__ == '__main__':
    run()
