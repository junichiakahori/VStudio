import http.server
import socketserver
import json
import os
import glob

PORT = 8001
DATA_FILE = "custom_idle_phrases.json"
HIRAGANA_FILE = "hiragana_data.json"
RADIO_SCRIPT_FILE = "radio_script.txt"
RADIO_SCRIPT_YOMI_FILE = "radio_script_yomi.txt"
RADIO_SCRIPT_CONFIG_FILE = "radio_script_config.json"

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

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/custom_idle_phrases.json':
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
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/add_idle_phrase':
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
        elif self.path == '/convert_remaining_kanji':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                import pykakasi
                import re
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
        else:
            self.send_response(404)
            self.end_headers()

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"API Server running at port {PORT}")
        httpd.serve_forever()

if __name__ == '__main__':
    run()
