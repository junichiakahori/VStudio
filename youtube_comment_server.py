import asyncio
import json
import logging
import websockets
import pytchat
import requests
import re
import os
import pickle
from typing import Optional
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

logging.basicConfig(level=logging.INFO)

# YouTube API scopes
SCOPES = ['https://www.googleapis.com/auth/youtube']
youtube_api_client = None

def get_authenticated_service():
    """OAuth認証を行いYouTube APIクライアントを返す"""
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
            
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('client_secret.json'):
                logging.warning("client_secret.jsonが見つからないため、YouTube API(配信終了など)は利用できません。")
                return None
            flow = InstalledAppFlow.from_client_secrets_file('client_secret.json', SCOPES)
            creds = flow.run_local_server(port=0)
            
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
            
    return build('youtube', 'v3', credentials=creds)

# 初回起動時に認証を試みる
youtube_api_client = get_authenticated_service()

# 接続中のWebSocketクライアントを保持するセット
connected_clients = set()

# pytchatのチャット取得ループタスク
chat_task: Optional[asyncio.Task] = None
stats_task: Optional[asyncio.Task] = None
# 現在接続中の動画ID
current_video_id = None
# pytchat インスタンス
chat = None
recent_comments = []
comment_history = [] # 実際のメッセージJSONを保持する履歴 (最大100件)

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
            elif data.get('type') == 'end_youtube_stream':
                video_id = data.get('videoId')
                if video_id:
                    await handle_end_stream(video_id, websocket)
            elif data.get('type') == 'start_youtube_stream':
                video_id = data.get('videoId')
                if video_id:
                    await handle_start_stream(video_id, websocket)
            elif data.get('type') == 'check_stream_status':
                video_id = data.get('videoId')
                if video_id:
                    await check_youtube_stream_status(video_id, websocket)
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"WebSocket client disconnected: {websocket.remote_address}")
    finally:
        connected_clients.discard(websocket)

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

async def handle_end_stream(video_id, websocket):
    """YouTube APIを叩いて配信を終了させる"""
    global youtube_api_client
    if not youtube_api_client:
        logging.error("YouTube API Client is not authenticated. Cannot end stream.")
        await websocket.send(json.dumps({'type': 'error', 'message': 'YouTube API未認証のため、配信終了できません。'}))
        return
        
    try:
        logging.info(f"Ending YouTube stream: {video_id}")
        request = youtube_api_client.liveBroadcasts().transition(
            broadcastStatus="complete",
            id=video_id,
            part="id,status"
        )
        # ネットワークリクエストはブロックするので別スレッドで実行するかrun_in_executorを使う
        response = await asyncio.to_thread(request.execute)
        logging.info(f"Stream ended successfully. API Response: {response}")
        await websocket.send(json.dumps({'type': 'system', 'message': '✅ YouTubeの配信を正常に終了しました。'}))
    except Exception as e:
        logging.error(f"Failed to end stream: {e}")
        await websocket.send(json.dumps({'type': 'error', 'message': f'配信の終了に失敗しました: {e}'}))

async def handle_start_stream(video_id, websocket):
    """YouTube APIを叩いて配信をLive状態に遷移させる"""
    global youtube_api_client
    if not youtube_api_client:
        logging.error("YouTube API Client is not authenticated. Cannot start stream.")
        await websocket.send(json.dumps({'type': 'error', 'message': 'YouTube API未認証のため、配信開始できません。'}))
        return
        
    try:
        logging.info(f"Starting YouTube stream: {video_id}")
        # statusをliveにする
        request = youtube_api_client.liveBroadcasts().transition(
            broadcastStatus="live",
            id=video_id,
            part="id,status"
        )
        response = await asyncio.to_thread(request.execute)
        logging.info(f"Stream started successfully. API Response: {response}")
        await websocket.send(json.dumps({'type': 'stream_started', 'videoId': video_id, 'message': '✅ YouTube配信を開始しました！'}))
    except Exception as e:
        logging.error(f"Failed to start stream: {e}")
        await websocket.send(json.dumps({'type': 'error', 'message': f'配信の開始に失敗しました。OBSから映像が送信されているか確認してください。({e})'}))

async def check_youtube_stream_status(video_id, websocket):
    """YouTube APIで動画の予約時間と現在の状態を取得する"""
    global youtube_api_client
    if not youtube_api_client:
        return
    
    try:
        request = youtube_api_client.videos().list(
            part="snippet,liveStreamingDetails",
            id=video_id
        )
        response = await asyncio.to_thread(request.execute)
        if response.get('items'):
            item = response['items'][0]
            snippet = item.get('snippet', {})
            live_broadcast_content = snippet.get('liveBroadcastContent') # 'live', 'upcoming', 'none'
            live_streaming_details = item.get('liveStreamingDetails', {})
            scheduled_start_time = live_streaming_details.get('scheduledStartTime')
            
            await websocket.send(json.dumps({
                'type': 'stream_info',
                'videoId': video_id,
                'liveBroadcastContent': live_broadcast_content,
                'scheduledStartTime': scheduled_start_time
            }))
    except Exception as e:
        logging.error(f"Failed to fetch stream status: {e}")

async def send_history(websocket):
    """接続したクライアントに履歴を送信する"""
    for msg in comment_history:
        try:
            history_msg = dict(msg)
            history_msg['isHistory'] = True
            await websocket.send(json.dumps(history_msg))
        except websockets.exceptions.ConnectionClosed:
            break


async def fetch_stats(video_id):
    try:
        while True:
            url = f"https://www.youtube.com/watch?v={video_id}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept-Language": "en-US,en;q=0.9"
            }
            try:
                html = requests.get(url, headers=headers, timeout=10).text
                viewers = ""
                subscribers = ""
                
                player_match = re.search(r'ytInitialPlayerResponse\s*=\s*(\{.*?\});(?:var|</script>)', html)
                if player_match:
                    import json
                    try:
                        player = json.loads(player_match.group(1))
                        videoDetails = player.get("videoDetails", {})
                        viewers = videoDetails.get("viewCount", "")
                    except Exception as e:
                        logging.error(f"Error parsing player response: {e}")

                data_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});(?:var|</script>)', html)
                if data_match:
                    try:
                        sub_match1 = re.search(r'"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\}', html)
                        if sub_match1:
                            subscribers = sub_match1.group(1)
                        else:
                            sub_match2 = re.search(r'"subscriberCountText":\{"simpleText":"([^"]+)"\}', html)
                            if sub_match2:
                                subscribers = sub_match2.group(1)
                    except Exception as e:
                        pass
                
                await broadcast_to_clients({
                    "type": "stats",
                    "viewers": viewers,
                    "subscribers": subscribers
                })
            except Exception as e:
                logging.error(f"Error fetching stats: {e}")
                
            await asyncio.sleep(30)
    except asyncio.CancelledError:
        pass

async def start_youtube_client(video_id: str, websocket):
    global chat_task, current_video_id, chat, recent_comments, comment_history
    
    # すでに同じ動画IDで実行中なら履歴だけ送って終了
    if chat_task is not None and current_video_id == video_id:
        logging.info(f"Already connected to {video_id}. Sending history to new client.")
        await websocket.send(json.dumps({
            "type": "status",
            "status": "connected",
            "message": f"Connected to YouTube Live (ID: {video_id})"
        }))
        await send_history(websocket)
        return

    # 違う動画IDなら停止して再接続
    if chat_task is not None:
        await stop_youtube_client(broadcast=False)

    recent_comments.clear()
    comment_history.clear()

    logging.info(f"Connecting to YouTube Live video: {video_id}")
    current_video_id = video_id
    
    # --- ここで初期履歴をスクレイピング ---
    try:
        chat_url = f"https://www.youtube.com/live_chat?is_popout=1&v={video_id}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        html = requests.get(chat_url, headers=headers, timeout=10).text
        match = re.search(r'window\["ytInitialData"\]\s*=\s*(\{.*?\});\s*</script>', html)
        if match:
            data = json.loads(match.group(1))
            actions = data.get("contents", {}).get("liveChatRenderer", {}).get("actions", [])
            for action in actions:
                item = action.get("addChatItemAction", {}).get("item", {})
                if "liveChatTextMessageRenderer" in item:
                    renderer = item["liveChatTextMessageRenderer"]
                    author = renderer.get("authorName", {}).get("simpleText", "")
                    message = "".join([r.get("text", "") for r in renderer.get("message", {}).get("runs", [])])
                    icon_url = ""
                    thumbnails = renderer.get("authorPhoto", {}).get("thumbnails", [])
                    if thumbnails:
                        icon_url = thumbnails[0].get("url", "")
                    
                    comment_sig = f"{author}:{message}"
                    recent_comments.append(comment_sig)
                    msg = {
                        "type": "comment",
                        "nickname": author,
                        "comment": message,
                        "iconUrl": icon_url
                    }
                    comment_history.append(msg)
            
            logging.info(f"Scraped {len(comment_history)} initial comments from history.")
            await send_history(websocket)
        else:
            logging.warning("ytInitialData not found during initial scrape.")
    except Exception as e:
        logging.error(f"Error scraping initial history: {e}")
    # ----------------------------------

    await broadcast_to_clients({
        "type": "status",
        "status": "waiting",
        "message": f"Connecting to YouTube (ID: {video_id})..."
    })

    async def fetch_chat():
        global recent_comments, comment_history, chat_task, current_video_id
        local_chat = None
        try:
            loop = asyncio.get_event_loop()
            while chat_task is not None and current_video_id == video_id:
                if local_chat is None or not local_chat.is_alive():
                    try:
                        import httpx
                        local_chat = await loop.run_in_executor(None, lambda: pytchat.create(video_id=video_id, interruptable=False, client=httpx.Client(http2=False)))
                        if local_chat.is_alive():
                            await broadcast_to_clients({
                                "type": "status",
                                "status": "connected",
                                "message": f"Connected to YouTube Live (ID: {video_id})"
                            })
                        else:
                            await broadcast_to_clients({
                                "type": "status",
                                "status": "waiting",
                                "message": f"待機中... 配信開始またはチャットの有効化を待っています (ID: {video_id})"
                            })
                    except Exception as e:
                        logging.warning(f"pytchat creation failed (might not be live yet): {e}")
                        local_chat = None
                        await broadcast_to_clients({
                            "type": "status",
                            "status": "waiting",
                            "message": f"待機中... 配信開始またはチャットの有効化を待っています (ID: {video_id})"
                        })
                    
                    if local_chat is None or not local_chat.is_alive():
                        await asyncio.sleep(15) # 15秒ごとに再試行
                        continue

                try:
                    chat_data = await loop.run_in_executor(None, local_chat.get)
                    for c in chat_data.sync_items():
                        comment_sig = f"{c.author.name}:{c.message}"
                        if comment_sig in recent_comments:
                            continue
                        
                        recent_comments.append(comment_sig)
                        if len(recent_comments) > 100:
                            recent_comments.pop(0)

                        logging.info(f"[YouTube] {c.author.name}: {c.message}")
                        
                        if c.amountValue > 0:
                            logging.info(f"[SuperChat] {c.author.name} sent {c.amountString}")
                            msg = {
                                "type": "gift",
                                "nickname": c.author.name,
                                "amount": c.amountString,
                                "iconUrl": c.author.imageUrl
                            }
                            comment_history.append(msg)
                            if len(comment_history) > 100: comment_history.pop(0)
                            await broadcast_to_clients(msg)
                        
                        msg = {
                            "type": "comment",
                            "nickname": c.author.name,
                            "comment": c.message,
                            "iconUrl": c.author.imageUrl
                        }
                        comment_history.append(msg)
                        if len(comment_history) > 100: comment_history.pop(0)
                        await broadcast_to_clients(msg)
                    
                    await asyncio.sleep(1) # wait 1 second before polling again
                except Exception as e:
                    logging.error(f"Chat fetch error: {e}")
                    local_chat = None # エラー時は次回ループで再接続
                    await asyncio.sleep(5)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logging.error(f"Chat loop fatal error: {e}")

    chat_task = asyncio.create_task(fetch_chat())
    global stats_task
    stats_task = asyncio.create_task(fetch_stats(video_id))

async def stop_youtube_client(broadcast=True):
    global chat_task, current_video_id, chat
    if chat_task is not None:
        logging.info("Stopping YouTube Live client...")
        chat_task.cancel()
        chat_task = None
    if stats_task:
        stats_task.cancel()
        stats_task = None
    
    if chat:
        chat.terminate()
        chat = None
        
    current_video_id = None
    if broadcast:
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
