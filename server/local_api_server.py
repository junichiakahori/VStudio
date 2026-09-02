# -*- coding: utf-8 -*-
"""
local_api_server.py
VStudio バックエンドHTTP APIサーバー & 静的ファイル配信ルーター
各機能ロジックは専用モジュールへ委譲し、本ファイルは軽量ルーティングに特化
"""

import sys
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
import http.server
import socketserver
import json
import os
import glob
import time
import urllib.parse

from server.log_manager import (
    start_log_rotation_scheduler,
    write_browser_console_log,
    read_log_file,
    clear_log_file
)
from server.news_crawler import (
    init_preload_all_rss_urls,
    get_all_cached_urls,
    resolve_batch_urls,
    fetch_rss_xml
)
from server.news_script_processor import generate_news_item_script_data
from server.tts_normalizer import convert_remaining_kanji_to_hiragana
from server.voicevox_client import synthesize_voicevox_backend, clean_kana_for_display
import server.youtube_api_helper as youtube_api_helper

PORT = 8001
# BASE_DIR is defined above

# ── データファイルパス定義 ──
DATA_FILE = os.path.join(BASE_DIR, "data", "custom_idle_phrases.json")
HIRAGANA_FILE = os.path.join(BASE_DIR, "data", "hiragana_data.json")
DICT_FILE = os.path.join(BASE_DIR, "dict", "hiragana_dict.json")
CUSTOM_DICT_FILE = os.path.join(BASE_DIR, "dict", "custom_dict.json")
RADIO_SCRIPT_FILE = os.path.join(BASE_DIR, "data", "radio_script.txt")
RADIO_SCRIPT_YOMI_FILE = os.path.join(BASE_DIR, "data", "radio_script_yomi.txt")
RADIO_SCRIPT_CONFIG_FILE = os.path.join(BASE_DIR, "data", "radio_script_config.json")
NEWS_SCRIPT_FILE = os.path.join(BASE_DIR, "data", "news_script.txt")
NEWS_SCRIPT_YOMI_FILE = os.path.join(BASE_DIR, "data", "news_script_yomi.txt")
NEWS_SCRIPT_CONFIG_FILE = os.path.join(BASE_DIR, "data", "news_script_config.json")

current_hot_reload_timestamp = int(time.time() * 1000)

def load_json(file_path, default=None):
    if default is None:
        default = {}
    if not os.path.exists(file_path):
        return default
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default

def save_json(file_path, data):
    dir_name = os.path.dirname(file_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_text(file_path):
    if not os.path.exists(file_path):
        return ""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception:
        return ""

def save_text(file_path, text):
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Voicevox-Kana, X-Voicevox-Clean-Kana')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _send_text(self, text, content_type='text/plain; charset=utf-8', status=200):
        self.send_response(status)
        self.send_header('Content-type', content_type)
        self.end_headers()
        self.wfile.write(text.encode('utf-8'))

    def _send_error(self, message, status=500):
        self._send_json({"error": str(message)}, status=status)

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length > 0 else b""

    def _read_json(self):
        body = self._read_body()
        return json.loads(body.decode('utf-8')) if body else {}

    def do_GET(self):
        global current_hot_reload_timestamp

        # ── ログ取得 ──
        if self.path.startswith('/api/log'):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            log_name = params.get('name', ['browser_console'])[0]
            lines = int(params.get('lines', [200])[0])
            res = read_log_file(log_name, lines=lines)
            return self._send_json(res, status=400 if "error" in res else 200)

        # ── ホットリロード & 設定・辞書・スクリプト取得 ──
        GET_ROUTES = {
            '/hot_reload_signal': lambda: self._send_text(str(current_hot_reload_timestamp)),
            '/custom_idle_phrases.json': lambda: self._send_json(load_json(DATA_FILE)),
            '/hiragana_data.json': lambda: self._send_json(load_json(HIRAGANA_FILE)),
            '/hiragana_dict.json': lambda: self._send_json(load_json(DICT_FILE)),
            '/radio_script': lambda: self._send_text(load_text(RADIO_SCRIPT_FILE)),
            '/radio_script_yomi': lambda: self._send_text(load_text(RADIO_SCRIPT_YOMI_FILE)),
            '/radio_script_config': lambda: self._send_json(load_json(RADIO_SCRIPT_CONFIG_FILE)),
            '/news_script': lambda: self._send_text(load_text(NEWS_SCRIPT_FILE)),
            '/news_script_yomi': lambda: self._send_text(load_text(NEWS_SCRIPT_YOMI_FILE)),
            '/news_script_config': lambda: self._send_json(load_json(NEWS_SCRIPT_CONFIG_FILE)),
            '/api/news/get_all_urls': lambda: self._send_json(get_all_cached_urls()),
            '/api/youtube/oauth_status': lambda: self._send_json(youtube_api_helper.get_oauth_status()),
        }

        if self.path in GET_ROUTES:
            return GET_ROUTES[self.path]()

        if self.path == '/se_list':
            se_dir = os.path.join(BASE_DIR, "se")
            se_files = [os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(se_dir, "*.*")) if f.endswith(('.mp3', '.wav', '.ogg', '.m4a'))] if os.path.exists(se_dir) else []
            return self._send_json({"files": se_files})

        if self.path.startswith('/api/youtube/list_broadcasts'):
            try:
                items = youtube_api_helper.list_my_broadcasts()
                return self._send_json({"success": True, "items": items})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, status=500)

        # ── 静的ファイル配信 ──
        super().do_GET()

    def do_POST(self):
        global current_hot_reload_timestamp
        try:
            # ── ホットリロードトリガー ──
            if self.path == '/trigger_hot_reload':
                current_hot_reload_timestamp = int(time.time() * 1000)
                return self._send_json({"status": "ok", "timestamp": current_hot_reload_timestamp})

            # ── 待機セリフ追加 ──
            if self.path == '/add_idle_phrase':
                payload = self._read_json()
                phrase = payload.get('phrase', '').strip()
                if not phrase:
                    return self._send_error("phrase is required", status=400)
                data = load_json(DATA_FILE, default={"phrases": []})
                if phrase not in data.get("phrases", []):
                    data.setdefault("phrases", []).append(phrase)
                    save_json(DATA_FILE, data)
                return self._send_json({"status": "ok", "data": data})

            # ── JSON・テキストデータ更新 ──
            SAVE_ROUTES_JSON = {
                '/update_hiragana_data': HIRAGANA_FILE,
                '/update_hiragana_dict': DICT_FILE,
                '/radio_script_config': RADIO_SCRIPT_CONFIG_FILE,
                '/news_script_config': NEWS_SCRIPT_CONFIG_FILE,
            }
            if self.path in SAVE_ROUTES_JSON:
                payload = self._read_json()
                save_json(SAVE_ROUTES_JSON[self.path], payload)
                return self._send_json({"status": "ok"})

            SAVE_ROUTES_TEXT = {
                '/radio_script': RADIO_SCRIPT_FILE,
                '/radio_script_yomi': RADIO_SCRIPT_YOMI_FILE,
                '/news_script': NEWS_SCRIPT_FILE,
                '/news_script_yomi': NEWS_SCRIPT_YOMI_FILE,
            }
            if self.path in SAVE_ROUTES_TEXT:
                body_text = self._read_body().decode('utf-8')
                save_text(SAVE_ROUTES_TEXT[self.path], body_text)
                return self._send_json({"status": "ok"})

            # ── 残存漢字の一括ひらがな変換 ──
            if self.path == '/convert_remaining_kanji':
                body_text = self._read_body().decode('utf-8')
                return self._send_text(convert_remaining_kanji_to_hiragana(body_text))

            # ── ログ書き込み & クリア ──
            if self.path == '/log':
                payload = self._read_json()
                msg = payload.get('message', '')
                client = payload.get('client', 'web')
                if msg:
                    write_browser_console_log(msg, client_type=client)
                return self._send_json({"status": "ok"})

            if self.path.startswith('/api/log_clear'):
                params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                log_name = params.get('name', ['browser_console'])[0]
                return self._send_json(clear_log_file(log_name))

            # ── RSS・クローラー・ニュース原稿 ──
            if self.path == '/fetch_rss':
                p = self._read_json()
                url = p.get('url') or p.get('videoId', '')
                xml_data = fetch_rss_xml(url)
                self.send_response(200)
                self.send_header('Content-type', 'application/xml; charset=utf-8')
                self.end_headers()
                return self.wfile.write(xml_data)

            if self.path == '/api/news/batch_resolve_urls':
                items = self._read_json().get('items', [])
                return self._send_json({"status": "ok", "resolved": resolve_batch_urls(items)})

            if self.path == '/api/news/generate_item_script':
                payload = self._read_json()
                res = generate_news_item_script_data(payload, custom_dict=load_json(CUSTOM_DICT_FILE))
                if not res:
                    return self._send_error("AI generation failed. Switching to standby.", status=500)
                return self._send_json(res)

            # ── YouTube API 連携 ──
            if self.path == '/get_youtube_video_info':
                p = self._read_json()
                url = p.get('url') or p.get('videoId', '')
                return self._send_json(youtube_api_helper.fetch_video_info(url))

            if self.path == '/api/youtube/start_oauth':
                return self._send_json({"success": True, **youtube_api_helper.start_oauth_flow()})

            if self.path == '/api/youtube/create_broadcast':
                p = self._read_json()
                res = youtube_api_helper.create_live_broadcast(p.get('title', ''), p.get('description', ''), p.get('scheduledStartTime'), p.get('privacyStatus', 'public'))
                return self._send_json({"success": True, **res})

            if self.path == '/api/youtube/update_broadcast':
                p = self._read_json()
                res = youtube_api_helper.update_live_broadcast(p.get('videoId', ''), p.get('title'), p.get('description'), p.get('scheduledStartTime'), p.get('privacyStatus'))
                return self._send_json({"success": True, "videoId": p.get('videoId'), "data": res})

            if self.path == '/api/youtube/upload_thumbnail':
                p = self._read_json()
                res = youtube_api_helper.upload_thumbnail(p.get('videoId', ''), p.get('imageData', ''))
                return self._send_json({"success": True, "videoId": p.get('videoId'), "data": res})

            # ── VOICEVOX 音声合成 ──
            if self.path == '/api/voicevox/synthesize':
                p = self._read_json()
                text = p.get('text', '').strip()
                if not text:
                    return self._send_error("text is required", status=400)
                wav_bytes, kana_str, corrected, final_text = synthesize_voicevox_backend(
                    text, int(p.get('speakerId', 1)), float(p.get('speedScale', 1.0)), float(p.get('pitchScale', 0.0)),
                    custom_dict=load_json(CUSTOM_DICT_FILE)
                )
                self.send_response(200)
                self.send_header('Content-type', 'audio/wav')
                self.send_header('Access-Control-Expose-Headers', 'X-Voicevox-Kana, X-Voicevox-Clean-Kana, X-Voicevox-Corrected, X-Voicevox-Final-Text')
                if kana_str:
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
                return self.wfile.write(wav_bytes)

            self.send_response(404)
            self.end_headers()
        except Exception as e:
            self._send_error(e, status=500)


def run():
    start_log_rotation_scheduler()
    init_preload_all_rss_urls()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), RequestHandler) as httpd:
        print(f"API Server running at port {PORT} (Multi-threaded)")
        httpd.serve_forever()


if __name__ == '__main__':
    run()
