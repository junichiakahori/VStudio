# -*- coding: utf-8 -*-
"""
local_api_server.py
VStudio バックエンドHTTP APIサーバー & 静的ファイル配信ルーター
各機能ロジックは専用モジュールへ委譲し、本ファイルは軽量ルーティングに特化
"""

import sys
import os
import re
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
import http.server
import socketserver
import json
import os
import glob
import time
import datetime
import urllib.parse
import threading

# ── ログ自動二重書き込み機構（TeeLogger: stdout/stderrを常にlogs/api_server.logへ統一フォーマットで同期書き込み）──
class TeeLogger:
    """標準出力・エラー出力をコンソールとログファイルの両方に安全に出力（統一ログフォーマット徹底＆スレッドセーフ）"""
    def __init__(self, filepath, stream, default_level="INFO"):
        self.filepath = os.path.abspath(filepath)
        self.stream = stream
        self.default_level = default_level
        self._lock = threading.Lock()
        self._buffer = ""
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
        
        # 物理的に同一ログファイルへシェルリダイレクト (>> logs/api_server.log) されている場合のみファイル直接追記を無効化（二重書き込み防止）
        self.is_redirected = False
        try:
            if hasattr(stream, 'fileno'):
                stream_stat = os.fstat(stream.fileno())
                if os.path.exists(self.filepath):
                    file_stat = os.stat(self.filepath)
                    if stream_stat.st_ino == file_stat.st_ino and stream_stat.st_dev == file_stat.st_dev:
                        self.is_redirected = True
        except Exception:
            pass

    def _format_line(self, line):
        line = line.rstrip('\r\n')
        if not line:
            return ""
        # 既に [YYYY-MM-DD HH:MM:SS] [MODULE] [LEVEL] 形式になっている場合はそのまま
        if re.match(r'^\[\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\]', line):
            return line + "\n"
        
        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        level = self.default_level
        if any(kw in line for kw in ["⚠️", "WARN", "警告", "Timeout", "タイムアウト"]):
            level = "WARN"
        elif any(kw in line for kw in ["🚫", "ERROR", "エラー", "失敗", "Exception"]):
            level = "ERROR"
        
        return f"[{now_str}] [Local API] [{level}] {line}\n"

    def write(self, data):
        with self._lock:
            self._buffer += data
            while '\n' in self._buffer:
                line, self._buffer = self._buffer.split('\n', 1)
                formatted = self._format_line(line)
                if not formatted:
                    continue
                try:
                    self.stream.write(formatted)
                    self.stream.flush()
                except Exception:
                    pass
                if not self.is_redirected:
                    try:
                        with open(self.filepath, "a", encoding="utf-8") as f:
                            f.write(formatted)
                            f.flush()
                    except Exception:
                        pass

    def flush(self):
        with self._lock:
            if self._buffer.strip():
                formatted = self._format_line(self._buffer)
                self._buffer = ""
                if formatted:
                    try:
                        self.stream.write(formatted)
                        self.stream.flush()
                    except Exception:
                        pass
                    if not self.is_redirected:
                        try:
                            with open(self.filepath, "a", encoding="utf-8") as f:
                                f.write(formatted)
                                f.flush()
                        except Exception:
                            pass
            try:
                self.stream.flush()
            except Exception:
                pass

API_LOG_FILE = os.path.join(BASE_DIR, "logs", "api_server.log")
sys.stdout = TeeLogger(API_LOG_FILE, sys.stdout, default_level="INFO")
sys.stderr = TeeLogger(API_LOG_FILE, sys.stderr, default_level="INFO")


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
    fetch_rss_xml,
    check_and_filter_scrapeable_news
)
from server.news_script_processor import generate_news_item_script_data
from server.tts_normalizer import convert_remaining_kanji_to_hiragana, resolve_text_readings
from server.voicevox_client import synthesize_voicevox_backend, clean_kana_for_display
import server.youtube_api_helper as youtube_api_helper
from server.window_manager import bring_subwindow_to_front
from server.news_cache_manager import (
    list_available_cache_dates,
    get_cache_by_date,
    clear_cache_by_date,
    delete_cache_item
)

# ポート番号（引数 --port または環境変数 PORT、デフォルト 8001）
PORT = 8001
for _i, _arg in enumerate(sys.argv):
    if _arg == "--port" and _i + 1 < len(sys.argv):
        try:
            PORT = int(sys.argv[_i + 1])
        except ValueError:
            pass
    elif _arg.startswith("--port="):
        try:
            PORT = int(_arg.split("=", 1)[1])
        except ValueError:
            pass
if "PORT" in os.environ:
    try:
        PORT = int(os.environ["PORT"])
    except ValueError:
        pass
# BASE_DIR is defined above

# ── データファイルパス定義 ──
DATA_FILE = os.path.join(BASE_DIR, "data", "custom_idle_phrases.json")
HIRAGANA_FILE = os.path.join(BASE_DIR, "data", "hiragana_data.json")

# ── ニュース原稿サーバーキャッシュ（重複リクエスト防止・10分保持・最大200件）──
NEWS_SCRIPT_CACHE = {}  # { title_key: (result_dict, expire_timestamp) }
NEWS_SCRIPT_CACHE_TTL = 600  # 10分
NEWS_SCRIPT_CACHE_MAX = 200

def _get_news_script_cache(title: str):
    if title in NEWS_SCRIPT_CACHE:
        result, expire = NEWS_SCRIPT_CACHE[title]
        if time.time() < expire:
            return result
        else:
            del NEWS_SCRIPT_CACHE[title]
    return None

def _set_news_script_cache(title: str, result: dict):
    if len(NEWS_SCRIPT_CACHE) >= NEWS_SCRIPT_CACHE_MAX:
        # 最も古いエントリを1件削除
        oldest_key = min(NEWS_SCRIPT_CACHE, key=lambda k: NEWS_SCRIPT_CACHE[k][1])
        del NEWS_SCRIPT_CACHE[oldest_key]
    NEWS_SCRIPT_CACHE[title] = (result, time.time() + NEWS_SCRIPT_CACHE_TTL)
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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Voicevox-Kana, X-Voicevox-Clean-Kana')
        super().end_headers()

    def log_message(self, format, *args):
        # ログ転送 (/log) はノイズになるため除外、それ以外のAPIリクエストを統一フォーマットで出力
        if self.path == '/log' and args and '200' in str(args[1] if len(args) > 1 else ''):
            return
        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        level = "INFO"
        if args and len(args) >= 2:
            code = str(args[1])
            if code.startswith('4') or code.startswith('5'):
                level = "ERROR"
        msg = format % args
        sys.stderr.write(f"[{now_str}] [Local API] [{level}] {msg}\n")
        sys.stderr.flush()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()


    def _send_json(self, data, status=200):
        try:
            self.send_response(status)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def _send_text(self, text, content_type='text/plain; charset=utf-8', status=200):
        try:
            self.send_response(status)
            self.send_header('Content-type', content_type)
            self.end_headers()
            self.wfile.write(text.encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def _send_error(self, message, status=500):
        try:
            self._send_json({"error": str(message)}, status=status)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


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
            log_name = params.get('name', params.get('tab', ['browser_console']))[0]
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
            '/api/youtube/auth_status': lambda: self._send_json(youtube_api_helper.get_oauth_status()),
        }


        if self.path in GET_ROUTES:
            return GET_ROUTES[self.path]()

        if self.path == '/se_list':
            se_dir = os.path.join(BASE_DIR, "se")
            se_files = [os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(se_dir, "*.*")) if f.endswith(('.mp3', '.wav', '.ogg', '.m4a'))] if os.path.exists(se_dir) else []
            return self._send_json({"files": se_files})

        if self.path.startswith('/api/youtube/list_broadcasts'):
            try:
                res = youtube_api_helper.get_my_broadcasts_safe()
                return self._send_json(res)
            except Exception as e:
                return self._send_json({"success": False, "items": [], "error": str(e), "message": "配信枠の取得でエラーが発生しました。"})

        if self.path.startswith('/api/youtube/detect_live'):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            channel = params.get('channel', [''])[0]
            res = youtube_api_helper.detect_channel_live(channel)
            return self._send_json(res)

        if self.path.startswith('/api/window/focus'):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            win_type = params.get('type', [''])[0]
            success = bring_subwindow_to_front(win_type)
            return self._send_json({"success": success})

        # ── ニュースキャッシュ管理 API (GET) ──
        if self.path == '/api/news_cache/list':
            return self._send_json({"success": True, "dates": list_available_cache_dates()})

        if self.path.startswith('/api/news_cache'):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            date_str = params.get('date', [datetime.datetime.now().strftime("%Y-%m-%d")])[0]
            return self._send_json(get_cache_by_date(date_str))

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

            # ── TTS 読み方動的解決 (Wikipedia / Web検索 / 辞書) ──
            if self.path == '/api/tts/resolve_reading':
                payload = self._read_json()
                text = payload.get('text', '').strip()
                if not text:
                    return self._send_json({"status": "ok", "resolved_text": "", "applied": False})
                resolved = resolve_text_readings(text, custom_dict=load_json(CUSTOM_DICT_FILE))
                return self._send_json({
                    "status": "ok",
                    "original": text,
                    "resolved_text": resolved,
                    "applied": (resolved != text)
                })

            # ── 🤖 AIルールチューナー（読み上げルールの自然言語による即時追加・更新） ──
            if self.path == '/api/tune-tts-rule':
                payload = self._read_json()
                instruction = payload.get('instruction', '').strip()
                if not instruction:
                    return self._send_json({"success": False, "error": "指示文が空です。"})
                from server.rule_tuner_service import tune_tts_rule
                result = tune_tts_rule(instruction)
                return self._send_json(result)

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

            if self.path in ('/api/news/batch_resolve_urls', '/api/get_article_urls'):
                payload = self._read_json()
                items = payload.get('items', [])
                if not items and 'titles' in payload:
                    items = [{'title': t} for t in payload.get('titles', [])]
                resolved_map = resolve_batch_urls(items)
                return self._send_json({"status": "ok", "resolved": resolved_map, "urls": resolved_map})

            if self.path in ('/api/news/filter_scrapeable', '/api/news/check_scrapeable'):
                payload = self._read_json()
                items = payload.get('items', [])
                if not items and 'titles' in payload:
                    items = [{'title': t} for t in payload.get('titles', [])]
                res = check_and_filter_scrapeable_news(items)
                return self._send_json(res)

            if self.path == '/api/news/generate_item_script':
                payload = self._read_json()
                cache_title = payload.get('title', '').strip()
                is_special = payload.get('categoryName', '') in ["コメント返信", "リスナーコメント"]
                cached = None if is_special else _get_news_script_cache(cache_title)
                if cached:
                    tag_str = cache_title[:16] + ("..." if len(cache_title) > 16 else "")
                    print(f"[ニュースAI {tag_str}] ⚡ サーバーキャッシュから即時返却 (重複処理を完全スキップ)", flush=True)
                    # ファイル側が消去・空だった場合、ファイル履歴にも確実に復元・追記保存
                    try:
                        from server.news_history_logger import log_news_script_item
                        log_news_script_item(
                            title=cache_title,
                            pub_date=payload.get('pub_date', ''),
                            source=payload.get('source', ''),
                            url=payload.get('url', ''),
                            sentences=cached.get('sentences', []),
                            full_display_text=cached.get('full_display_text', ''),
                            full_reading_text=cached.get('full_reading_text', ''),
                            title_reading=cached.get('title_reading', ''),
                            title_voicevox_reading=cached.get('title_voicevox_reading', ''),
                            title_voicevox_kana=cached.get('title_voicevox_kana', ''),
                            headline_display=payload.get('title', '')
                        )
                    except Exception:
                        pass
                    return self._send_json(cached)
                res = generate_news_item_script_data(payload, custom_dict=load_json(CUSTOM_DICT_FILE))
                if not res:
                    return self._send_error("AI generation failed. Switching to standby.", status=500)
                if not is_special:
                    _set_news_script_cache(cache_title, res)
                return self._send_json(res)


            # ── YouTube API 連携 ──
            if self.path == '/get_youtube_video_info':
                p = self._read_json()
                url = p.get('url') or p.get('videoId', '')
                return self._send_json(youtube_api_helper.fetch_video_info(url))

            if self.path in ('/api/youtube/start_oauth', '/api/youtube/auth'):
                return self._send_json({"success": True, **youtube_api_helper.start_oauth_flow()})

            if self.path == '/api/youtube/create_broadcast':
                p = self._read_json()
                title = p.get('title', '')
                desc = p.get('description', '')
                sched = p.get('scheduledStartTime') or p.get('scheduled_start_time')
                privacy = p.get('privacyStatus') or p.get('privacy_status', 'public')
                try:
                    res = youtube_api_helper.create_live_broadcast(title, desc, sched, privacy)
                    return self._send_json({"success": True, **res})
                except Exception as e:
                    err_str = str(e)
                    if "quotaExceeded" in err_str:
                        err_str = "YouTube APIの1日あたりの利用枠（クォータ上限）に達しました。YouTube Studioから直接設定してください。"
                    return self._send_json({"success": False, "error": err_str})

            if self.path == '/api/youtube/update_broadcast':
                p = self._read_json()
                vid = p.get('videoId') or p.get('video_id', '')
                title = p.get('title')
                desc = p.get('description')
                sched = p.get('scheduledStartTime') or p.get('scheduled_start_time')
                privacy = p.get('privacyStatus') or p.get('privacy_status')
                try:
                    res = youtube_api_helper.update_live_broadcast(vid, title, desc, sched, privacy)
                    return self._send_json({"success": True, "videoId": vid, "data": res})
                except Exception as e:
                    err_str = str(e)
                    if "quotaExceeded" in err_str:
                        err_str = "YouTube APIの1日あたりの利用枠（クォータ上限）に達しました。"
                    return self._send_json({"success": False, "error": err_str})

            if self.path in ('/api/youtube/upload_thumbnail', '/api/youtube/set_thumbnail'):
                p = self._read_json()
                vid = p.get('videoId') or p.get('video_id', '')
                img = p.get('imageData') or p.get('image_base64', '')
                try:
                    res = youtube_api_helper.upload_thumbnail(vid, img)
                    return self._send_json({"success": True, "videoId": vid, "data": res})
                except Exception as e:
                    err_str = str(e)
                    if "quotaExceeded" in err_str:
                        err_str = "YouTube APIの1日あたりの利用枠（クォータ上限）に達しました。"
                    return self._send_json({"success": False, "error": err_str})


            # ── ニュースキャッシュ管理 API (POST) ──
            if self.path == '/api/news_cache/clear':
                p = self._read_json()
                date_str = p.get('date', datetime.datetime.now().strftime("%Y-%m-%d"))
                res = clear_cache_by_date(date_str)
                # 🧠 サーバーのインメモリキャッシュも同時に完全消去（空のまま取り残される現象を防止）
                NEWS_SCRIPT_CACHE.clear()
                print("[NewsCacheManager] 🗑️ サーバーインメモリキャッシュ (NEWS_SCRIPT_CACHE) も全消去しました", flush=True)
                return self._send_json(res)

            if self.path == '/api/news_cache/delete_item':
                p = self._read_json()
                date_str = p.get('date', datetime.datetime.now().strftime("%Y-%m-%d"))
                idx = p.get('index')
                title = p.get('title')
                res = delete_cache_item(date_str, item_index=idx, title=title)
                # 該当記事のインメモリキャッシュも消去
                if title and title in NEWS_SCRIPT_CACHE:
                    del NEWS_SCRIPT_CACHE[title]
                return self._send_json(res)

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
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as e:
            self._send_error(e, status=500)



def run():
    start_log_rotation_scheduler()
    init_preload_all_rss_urls()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    while True:
        try:
            with socketserver.ThreadingTCPServer(("", PORT), RequestHandler) as httpd:
                print(f"API Server running at port {PORT} (Multi-threaded)")
                httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Local API] シャットダウンシグナルを受信しました。終了します。")
            break
        except Exception as e:
            print(f"[Local API ERROR] サーバー例外発生: {e} (3秒後に自動復旧・再起動します)")
            time.sleep(3)


if __name__ == '__main__':
    run()
