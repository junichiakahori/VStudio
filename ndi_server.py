#!/usr/bin/env python3
"""
Live2D NDI Server
================
Browser(Canvas) -> WebSocket -> このサーバー -> NDI出力

Usage:
    python3 ndi_server.py

Dependencies:
    pip3 install ndi-python websockets
"""

import asyncio
import json
import struct
import time
import numpy as np
import NDIlib as ndi
import websockets
from websockets.server import serve

# NDI設定
NDI_SOURCE_NAME = "Live2D Avatar"
WS_PORT = 8766
FRAME_WIDTH  = 1920
FRAME_HEIGHT = 1080
FPS = 30

# グローバル状態
ndi_sender = None
connected_clients = set()
frame_count = 0
last_fps_time = time.time()
active_frame_buffer = None  # GC対策用バッファ保持変数

def init_ndi():
    """NDIを初期化してSenderを作成"""
    global ndi_sender
    
    if not ndi.initialize():
        print("[NDI] ERROR: NDI initialize failed.")
        print("[NDI] NDI Runtime がインストールされているか確認してください: https://ndi.video/tools/")
        return False
    
    send_settings = ndi.SendCreate()
    send_settings.ndi_name = NDI_SOURCE_NAME  # ndi-python 6.x API
    
    ndi_sender = ndi.send_create(send_settings)
    if not ndi_sender:
        print("[NDI] ERROR: NDI Sender creation failed.")
        return False
    
    print(f"[NDI] ✅ NDI Sender ready: '{NDI_SOURCE_NAME}'")
    print(f"[NDI] OBS/受信ソフトで '{NDI_SOURCE_NAME}' を選択してください")
    return True

def send_ndi_frame(rgba_data: bytes, width: int, height: int):
    """RGBA raw データをNDIフレームとして送信"""
    global frame_count, last_fps_time, active_frame_buffer
    
    if not ndi_sender:
        return
    
    try:
        # numpy配列に変換
        arr = np.frombuffer(rgba_data, dtype=np.uint8).reshape((height, width, 4))
        
        # NDIlib は BGRA 形式を使用するため RGBA -> BGRA 変換 (上下反転はブラウザ側で補正済)
        bgra = arr[:, :, [2, 1, 0, 3]].copy()
        
        # NDIビデオフレームを作成
        video_frame = ndi.VideoFrameV2()
        video_frame.xres = width
        video_frame.yres = height
        video_frame.FourCC = ndi.FOURCC_VIDEO_TYPE_BGRA
        video_frame.frame_rate_N = FPS
        video_frame.frame_rate_D = 1
        video_frame.picture_aspect_ratio = width / height
        video_frame.frame_format_type = ndi.FRAME_FORMAT_TYPE_PROGRESSIVE
        if hasattr(video_frame, 'p_data'):
            video_frame.p_data = bgra
        else:
            video_frame.data = bgra
        video_frame.line_stride_in_bytes = width * 4
        
        # メモリ解放（GC）を防ぐためにグローバル変数に保持（video_frame自体も保持）
        active_frame_buffer = (video_frame, bgra)
        
        ndi.send_send_video_v2(ndi_sender, video_frame)
        
        frame_count += 1
        now = time.time()
        if now - last_fps_time >= 2.0:
            fps = frame_count / (now - last_fps_time)
            max_val = np.max(bgra)
            print(f"[NDI] 📺 送信中: {fps:.1f} fps, {width}x{height}, クライアント: {len(connected_clients)}, 画素最大値: {max_val}")
            frame_count = 0
            last_fps_time = now
            
    except Exception as e:
        print(f"[NDI] Frame send error: {e}")

def create_blank_frame(width: int, height: int) -> np.ndarray:
    """透明な空のフレームを作成"""
    return np.zeros((height, width, 4), dtype=np.uint8)

async def handle_client(websocket):
    """WebSocketクライアントを処理"""
    client_addr = websocket.remote_address
    connected_clients.add(websocket)
    print(f"[WS] クライアント接続: {client_addr}")
    
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # バイナリメッセージ: ヘッダー(12バイト) + RGBAデータ
                if len(message) < 12:
                    continue
                
                # ヘッダーを解析: width(4) + height(4) + timestamp(4)
                width, height, ts = struct.unpack('>III', message[:12])
                rgba_data = message[12:]
                
                expected_size = width * height * 4
                if len(rgba_data) != expected_size:
                    print(f"[WS] Warning: Size mismatch. Expected {expected_size} bytes ({width}x{height}), but received {len(rgba_data)} bytes.")
                    continue
                
                send_ndi_frame(rgba_data, width, height)
                
            elif isinstance(message, str):
                # テキストメッセージ: コントロールコマンド
                try:
                    cmd = json.loads(message)
                    if cmd.get('type') == 'ping':
                        await websocket.send(json.dumps({'type': 'pong', 'ndi': NDI_SOURCE_NAME}))
                    elif cmd.get('type') == 'status':
                        await websocket.send(json.dumps({
                            'type': 'status',
                            'ndi_source': NDI_SOURCE_NAME,
                            'clients': len(connected_clients),
                            'fps': FPS
                        }))
                except json.JSONDecodeError:
                    pass
                    
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"[WS] Client error: {e}")
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] クライアント切断: {client_addr}")
        
        # クライアントが全員切断したら空フレームを送信
        if not connected_clients and ndi_sender:
            blank = create_blank_frame(1920, 1080)
            for _ in range(5):
                send_ndi_frame(blank.tobytes(), 1920, 1080)

async def main():
    print("=" * 50)
    print("  Live2D NDI Server")
    print("=" * 50)
    
    # NDI初期化
    if not init_ndi():
        print("[ERROR] NDI initialization failed. Exiting.")
        return
    
    print(f"[WS] WebSocketサーバー起動中: ws://localhost:{WS_PORT}")
    print(f"[NDI] NDI送信名: '{NDI_SOURCE_NAME}'")
    print(f"[INFO] ブラウザで http://localhost:8000/live2d.html を開いてください")
    print(f"[INFO] Ctrl+C で停止")
    print()
    
    try:
        async with serve(handle_client, "localhost", WS_PORT, max_size=20000000) as server:
            print(f"[WS] ✅ WebSocketサーバー起動完了: ws://localhost:{WS_PORT}")
            await asyncio.Future()  # 永続実行
    except KeyboardInterrupt:
        print("\n[INFO] サーバーを停止します...")
    finally:
        if ndi_sender:
            ndi.send_destroy(ndi_sender)
        ndi.destroy()
        print("[NDI] Cleanup complete.")

if __name__ == '__main__':
    asyncio.run(main())
