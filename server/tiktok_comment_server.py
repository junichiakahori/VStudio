import sys
import asyncio
import json
import logging
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
from typing import Optional

try:
    import certifi
    os.environ['SSL_CERT_FILE'] = certifi.where()
except ImportError:
    pass

import websockets
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, CommentEvent, DisconnectEvent, JoinEvent, GiftEvent, LikeEvent

from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))

class JSTFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=JST)
        if datefmt:
            return dt.strftime(datefmt)
        return dt.strftime('%Y-%m-%d %H:%M:%S')

os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)
_log_file_path = os.path.join(BASE_DIR, "logs", "tiktok_server.log")

_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(JSTFormatter('[%(asctime)s] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))

_file_handler = logging.FileHandler(_log_file_path, mode='a', encoding='utf-8')
_file_handler.setFormatter(JSTFormatter('[%(asctime)s] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))

logging.root.handlers = [_stream_handler, _file_handler]
logging.root.setLevel(logging.INFO)

logging.getLogger("websockets").setLevel(logging.CRITICAL)
logging.getLogger("websockets.server").setLevel(logging.CRITICAL)
logging.getLogger("websockets.protocol").setLevel(logging.CRITICAL)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# 接続中のWebSocketクライアントを保持するセット
connected_clients = set()

# TikTokLiveClientのインスタンス
tiktok_client: Optional[TikTokLiveClient] = None
recent_comments = []

async def ws_handler(websocket):
    """WebSocketのハンドラ。ブラウザからの接続を受け付ける"""
    connected_clients.add(websocket)
    logging.info(f"New WebSocket client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get('type') == 'connect_tiktok':
                username = data.get('username')
                if username:
                    await start_tiktok_client(username, websocket)
            elif data.get('type') == 'disconnect_tiktok':
                await stop_tiktok_client()
    except websockets.exceptions.ConnectionClosed as e:
        logging.info(f"WebSocket client disconnected: {websocket.remote_address}")
    finally:
        connected_clients.remove(websocket)

async def broadcast_to_clients(message_dict):
    """全ての接続済みWebSocketクライアントにメッセージを送信"""
    if not connected_clients:
        return
    message = json.dumps(message_dict)
    
    # 接続切れクライアントの削除用
    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send(message)
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(ws)
    
    for ws in disconnected:
        connected_clients.remove(ws)

async def start_tiktok_client(username: str, websocket):
    global tiktok_client
    
    # すでに実行中なら停止
    if tiktok_client is not None and tiktok_client.connected:
        await stop_tiktok_client()

    logging.info(f"Connecting to TikTok Live user: @{username}")
    tiktok_client = TikTokLiveClient(unique_id=username)

    current_client = tiktok_client

    @tiktok_client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        if current_client is not tiktok_client: return
        logging.info(f"Connected to @{event.unique_id} (Room ID: {current_client.room_id})")
        await broadcast_to_clients({
            "type": "status",
            "status": "connected",
            "message": f"Connected to @{event.unique_id}"
        })

    @tiktok_client.on(DisconnectEvent)
    async def on_disconnect(event: DisconnectEvent):
        if current_client is not tiktok_client: return
        logging.info("Disconnected from TikTok Live")
        await broadcast_to_clients({
            "type": "status",
            "status": "disconnected",
            "message": "Disconnected from TikTok Live"
        })

    @tiktok_client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        global recent_comments
        if current_client is not tiktok_client: return
        
        comment_sig = f"{event.user.nickname}:{event.comment}"
        if comment_sig in recent_comments:
            return
        
        recent_comments.append(comment_sig)
        if len(recent_comments) > 100:
            recent_comments.pop(0)

        icon_url = event.user.avatar.urls[0] if event.user.avatar and event.user.avatar.urls else ""
        # ログにも出す
        logging.info(f"[Comment] {event.user.nickname}: {event.comment}")
        # ブラウザに送信
        await broadcast_to_clients({
            "type": "comment",
            "nickname": event.user.nickname,
            "comment": event.comment,
            "iconUrl": icon_url
        })

    @tiktok_client.on(JoinEvent)
    async def on_join(event: JoinEvent):
        global recent_comments
        if current_client is not tiktok_client: return
        
        # ログにも出す
        logging.info(f"[Join] {event.user.nickname} joined")
        # ブラウザに送信
        await broadcast_to_clients({
            "type": "join",
            "nickname": event.user.nickname
        })

    @tiktok_client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        icon_url = event.user.avatar.urls[0] if event.user.avatar and event.user.avatar.urls else ""
        # コンボ中（streaking）の途中経過はスキップし、最後に1回だけ処理するか、単純に全部「ギフトありがとう」とするか
        # ここでは連続ギフトの度に喋るとうるさいので、とりあえず全部拾うがJS側で少し間引くかシンプルに扱う
        logging.info(f"[Gift] {event.user.nickname} sent a gift")
        await broadcast_to_clients({
            "type": "gift",
            "nickname": event.user.nickname,
            "iconUrl": icon_url
        })

    @tiktok_client.on(LikeEvent)
    async def on_like(event: LikeEvent):
        logging.info(f"[Like] {event.user.nickname} liked {event.count} times")
        await broadcast_to_clients({
            "type": "like",
            "nickname": event.user.nickname
        })

    async def run_client():
        try:
            await tiktok_client.start()
        except Exception as e:
            logging.error(f"Failed to start TikTok client: {e}")
            await broadcast_to_clients({
                "type": "status",
                "status": "error",
                "message": f"エラー: ユーザーがオフラインか存在しません"
            })

    # TikTokLiveClientをバックグラウンドで開始
    asyncio.create_task(run_client())
    await broadcast_to_clients({
        "type": "status",
        "status": "connecting",
        "message": f"Connecting to @{username}..."
    })

async def stop_tiktok_client():
    global tiktok_client
    if tiktok_client is not None:
        logging.info("Stopping TikTok Live client...")
        try:
            await tiktok_client.disconnect()
        except AttributeError:
            try:
                tiktok_client.stop()
            except Exception:
                pass
        except Exception:
            pass
        tiktok_client = None
        await broadcast_to_clients({
            "type": "status",
            "status": "disconnected",
            "message": "Disconnected"
        })

async def main():
    host = "localhost"
    port = 8767
    logging.info(f"Starting WebSocket server on ws://{host}:{port}")
    
    server = await websockets.serve(ws_handler, host, port)
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server stopped.")
