import http.server
import ssl
import socket
import json
import urllib.parse
from ddgs import DDGS

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = 'localhost'
    finally:
        s.close()
    return ip

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/search':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            query = query_params.get('q', [''])[0]
            
            # CORS headers
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            if not query:
                self.wfile.write(json.dumps({'results': [], 'error': 'Empty query'}, ensure_ascii=False).encode('utf-8'))
                return
                
            try:
                results = []
                with DDGS() as ddgs:
                    for r in ddgs.text(query, max_results=3):
                        results.append({
                            'title': r.get('title', ''),
                            'href': r.get('href', ''),
                            'body': r.get('body', '')
                        })
                self.wfile.write(json.dumps({'results': results}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({'results': [], 'error': str(e)}, ensure_ascii=False).encode('utf-8'))
        else:
            super().do_GET()

local_ip = get_ip()
port = 8443

server_address = ('0.0.0.0', port)
httpd = http.server.HTTPServer(server_address, MyHandler)

# ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# ctx.load_cert_chain(certfile='cert.pem', keyfile='key.pem')

# httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

print(f"==================================================")
print(f"HTTP Server running!")
print(f"iPhone Access URL: http://{local_ip}:{port}/live2d.html")
print(f"==================================================")

httpd.serve_forever()
