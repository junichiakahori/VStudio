import asyncio
import json
import logging
import websockets
import pytchat
from typing import Optional

logging.basicConfig(level=logging.INFO)

# 接続中のWebSocketクライアントを保持するセット
connected_clients = set()

# pytchatのチャット取得ループタスク
chat_task: Optional[asyncio.Task] = None
# 現在接続中の動画ID
current_video_id: Optional[str] = None
# pytchat インスタンス
chat: Optional[pytchat.LiveChat] = None
recent_comments = []

async def ws_handler(websocket):
    """WebSocketのハンドラ。ブラウザからの接続を受け付ける"""
    connected_clients.add(websocket)
    logging.info(f"New WebSocket client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get('type') == 'connect_youtube':
                video_id = data.get('video_id')
                if video_id:
                    await start_youtube_client(video_id, websocket)
            elif data.get('type') == 'disconnect_youtube':
                await stop_youtube_client()
    except websockets.exceptions.ConnectionClosed:
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

async def start_youtube_client(video_id: str, websocket):
    global chat_task, current_video_id, chat
    
    # すでに実行中なら停止
    if chat_task is not None:
        await stop_youtube_client()

    logging.info(f"Connecting to YouTube Live video: {video_id}")
    current_video_id = video_id

    try:
        chat = pytchat.create(video_id=video_id)
        if not chat.is_alive():
            raise Exception("Chat is not alive. Invalid Video ID or not a live stream.")
    except Exception as e:
        logging.error(f"Failed to start YouTube client: {e}")
        await broadcast_to_clients({
            "type": "status",
            "status": "error",
            "message": "接続エラー: 無効な動画IDか、ライブ配信ではありません"
        })
        return

    await broadcast_to_clients({
        "type": "status",
        "status": "connected",
        "message": f"Connected to YouTube Live (ID: {video_id})"
    })

    async def fetch_chat():
        global recent_comments
        try:
            while chat.is_alive():
                # pytchat is synchronous in fetching, so we wrap it slightly or just poll it with sleep
                for c in chat.get().sync_items():
                    comment_sig = f"{c.author.name}:{c.message}"
                    if comment_sig in recent_comments:
                        continue
                    
                    recent_comments.append(comment_sig)
                    if len(recent_comments) > 100:
                        recent_comments.pop(0)

                    logging.info(f"[YouTube] {c.author.name}: {c.message}")
                    
                    # You can also handle SuperChats here by checking c.amountValue
                    if c.amountValue > 0:
                        logging.info(f"[SuperChat] {c.author.name} sent {c.amountString}")
                        await broadcast_to_clients({
                            "type": "gift",
                            "nickname": c.author.name,
                            "amount": c.amountString
                        })
                    
                    await broadcast_to_clients({
                        "type": "comment",
                        "nickname": c.author.name,
                        "comment": c.message
                    })
                
                await asyncio.sleep(1) # wait 1 second before polling again
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logging.error(f"Chat fetch error: {e}")
        finally:
            if chat:
                chat.terminate()

    chat_task = asyncio.create_task(fetch_chat())

async def stop_youtube_client():
    global chat_task, current_video_id, chat
    if chat_task is not None:
        logging.info("Stopping YouTube Live client...")
        chat_task.cancel()
        chat_task = None
    
    if chat:
        chat.terminate()
        chat = None
        
    current_video_id = None
    await broadcast_to_clients({
        "type": "status",
        "status": "disconnected",
        "message": "Disconnected from YouTube Live"
    })

async def main():
    host = "localhost"
    port = 8768
    logging.info(f"Starting YouTube WebSocket server on ws://{host}:{port}")
    
    server = await websockets.serve(ws_handler, host, port)
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server stopped.")
