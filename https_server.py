import http.server
import ssl
import socket

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

local_ip = get_ip()
port = 8443

server_address = ('0.0.0.0', port)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile='cert.pem', keyfile='key.pem')

httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

print(f"==================================================")
print(f"HTTPS Server running!")
print(f"iPhone Access URL: https://{local_ip}:{port}/live2d.html")
print(f"==================================================")

httpd.serve_forever()
