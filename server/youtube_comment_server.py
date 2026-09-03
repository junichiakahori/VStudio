import sys
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
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

from pytchat.processors.default.processor import DefaultProcessor, Chatdata
from pytchat.parser.live import Parser
import time
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))

class JSTFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=JST)
        if datefmt:
            return dt.strftime(datefmt)
        return dt.strftime('%Y-%m-%d %H:%M:%S')

os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)
_log_file_path = os.path.join(BASE_DIR, "logs", "youtube_server.log")

_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(JSTFormatter('[%(asctime)s] [YouTube WS] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))

_file_handler = logging.FileHandler(_log_file_path, mode='a', encoding='utf-8')
_file_handler.setFormatter(JSTFormatter('[%(asctime)s] [YouTube WS] [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))


logging.root.handlers = [_stream_handler, _file_handler]
logging.root.setLevel(logging.INFO)

logging.getLogger("websockets").setLevel(logging.CRITICAL)
logging.getLogger("websockets.server").setLevel(logging.CRITICAL)
logging.getLogger("websockets.protocol").setLevel(logging.CRITICAL)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)

import urllib.parse
import base64

# ----------------------------------------------------
# YouTube チャンネル表示名（DisplayName）キャッシュ＆自動解決
# ----------------------------------------------------

# ----------------------------------------------------
# YouTube 絵文字ショートコード自動復元テーブル
# ----------------------------------------------------
COMMON_EMOJI_SHORTCODES = {
    ':front_facing_baby_chick:': '🐥',
    ':baby_chick:': '🐤',
    ':hatching_chick:': '🐣',
    ':sparkles:': '✨',
    ':star:': '⭐',
    ':star2:': '🌟',
    ':heart:': '❤️',
    ':sparkling_heart:': '💖',
    ':two_hearts:': '💕',
    ':heart_eyes:': '😍',
    ':thumbsup:': '👍',
    ':thumbs_up:': '👍',
    ':+1:': '👍',
    ':clap:': '👏',
    ':tada:': '🎉',
    ':partying_face:': '🥳',
    ':cat:': '🐱',
    ':cat2:': '🐈',
    ':heart_eyes_cat:': '😻',
    ':paw_prints:': '🐾',
    ':fire:': '🔥',
    ':hundred_points:': '💯',
    ':100:': '💯',
    ':smile:': '😄',
    ':laughing:': '😆',
    ':joy:': '😂',
    ':sob:': '😭',
    ':pray:': '🙏',
    ':raised_hands:': '🙌'
}

def decode_youtube_emojis(message: str) -> str:
    if not message or ':' not in message:
        return message
    res = message
    for code, em in COMMON_EMOJI_SHORTCODES.items():
        if code in res:
            res = res.replace(code, em)
    return res

from server.listener_crm import record_listener_comment

USER_CACHE_FILE = os.path.join(BASE_DIR, "dict", "youtube_user_cache.json")
_user_name_cache = {}

def load_user_cache():
    global _user_name_cache
    if os.path.exists(USER_CACHE_FILE):
        try:
            with open(USER_CACHE_FILE, "r", encoding="utf-8") as f:
                _user_name_cache = json.load(f)
        except Exception as e:
            logging.warning(f"Failed to load youtube_user_cache.json: {e}")

def save_user_cache():
    try:
        os.makedirs(os.path.dirname(USER_CACHE_FILE), exist_ok=True)
        with open(USER_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_user_name_cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.warning(f"Failed to save youtube_user_cache.json: {e}")

load_user_cache()

async def resolve_author_name(author_name: str, channel_id: str = None) -> str:
    """ハンドル名（例: @drone.akahori）や channel_id から YouTube チャンネル正式表示名（例: ドローン赤堀）を解決"""
    if not author_name:
        return "視聴者"
    
    clean_handle = author_name.strip()
    # 既にキャッシュにある場合は即座に返却
    if clean_handle in _user_name_cache:
        return _user_name_cache[clean_handle]
    if channel_id and channel_id in _user_name_cache:
        return _user_name_cache[channel_id]
        
    # @ で始まらない（既に通常の名義）ならそのままキャッシュして返す
    if not clean_handle.startswith("@"):
        _user_name_cache[clean_handle] = clean_handle
        save_user_cache()
        return clean_handle

    resolved_name = None

    # 1. スクレイピングによる超高速解決 (https://www.youtube.com/@handle)
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9"
    }
    
    urls_to_try = [f"https://www.youtube.com/{clean_handle}"]
    if channel_id:
        urls_to_try.append(f"https://www.youtube.com/channel/{channel_id}")

    for target_url in urls_to_try:
        try:
            def _fetch():
                return requests.get(target_url, headers=headers, timeout=3).text
            html = await asyncio.to_thread(_fetch)
            og_match = re.search(r'<meta property="og:title" content="([^"]+)">', html)
            if og_match:
                candidate = og_match.group(1).strip()
                if candidate and candidate != clean_handle:
                    resolved_name = candidate
                    break
            title_match = re.search(r'<title>([^<]+?)(?: - YouTube)?</title>', html)
            if title_match:
                candidate = title_match.group(1).strip()
                if candidate and candidate != clean_handle:
                    resolved_name = candidate
                    break
        except Exception as e:
            logging.debug(f"Fetch channel title failed for {target_url}: {e}")

    if resolved_name:
        logging.info(f"✨ [YouTube Author Resolved] {clean_handle} ➔ 『{resolved_name}』")
        _user_name_cache[clean_handle] = resolved_name
        if channel_id:
            _user_name_cache[channel_id] = resolved_name
        save_user_cache()
        return resolved_name

    # 解決できなかった場合は @ を除いたハンドル名をデフォルトとする
    fallback_name = clean_handle.lstrip("@")
    _user_name_cache[clean_handle] = fallback_name
    save_user_cache()
    return fallback_name

def _resolve_single_emoji(s):
    if not s:
        return "❤️"
        
    # If s is escaped (e.g. \\uD83C\\uDF89), decode it
    try:
        if "\\u" in s or "\\U" in s:
            s_decoded = s.encode('utf-8').decode('unicode-escape')
            s = s + " " + s_decoded
    except Exception:
        pass

    # URL decode if needed (%3D, %2F)
    try:
        s_unquoted = urllib.parse.unquote(s)
        s = s + " " + s_unquoted
    except Exception:
        pass

    # Base64 decode any base64 segments in s
    b64_matches = re.findall(r'[A-Za-z0-9+/=]{12,}', s)
    for b in b64_matches:
        try:
            b_pad = b + '=' * (-len(b) % 4)
            raw = base64.b64decode(b_pad)
            decoded_text = raw.decode('latin-1', errors='ignore')
            s += " " + decoded_text
        except Exception:
            pass

    # Match all Unicode emojis (including 😄, 😳, 🎉, 💯, ❤️ etc.)
    found = re.findall(r'[\U00010000-\U0010ffff\u2600-\u27bf\u2300-\u23ff\u2b50\u2b55\u3030\u303d\u3297\u3299\ufe0f]', s)
    if found:
        # Return non-heart emoji if found, or first emoji
        non_hearts = [e for e in found if e not in ['❤️', '❤']]
        if non_hearts:
            return non_hearts[0]
        return found[0]

    s_lower = s.lower()
    mapping = [
        (["party_popper", "tada", "celebration", "party", "popper", "1f389", "f389"], "🎉"),
        (["100", "hundred", "1f4af", "f4af", "one_hundred"], "💯"),
        (["smile", "grinning", "happy", "1f604", "f604"], "😄"),
        (["flushed", "blush", "surprised", "1f633", "f633"], "😳"),
        (["clapping", "clap", "applaud", "1f44f", "f44f"], "👏"),
        (["joy", "laugh", "tears_of_joy", "rofl", "lol", "funny", "1f602", "f602"], "😂"),
        (["fire", "flame", "lit", "hot", "1f525", "f525"], "🔥"),
        (["+1", "thumbs_up", "like", "thumbsup", "1f44d", "f44d"], "👍"),
        (["star_struck", "star", "sparkle", "glitter", "2b50", "1f31f"], "⭐"),
        (["heart_eyes", "love", "heart", "heart_suit", "sweet", "2764", "1f496"], "❤️"),
        (["cat", "meow", "neko", "1f63b", "f63b"], "😻"),
    ]
    for keywords, em in mapping:
        if any(k in s_lower for k in keywords):
            return em
            
    return "❤️"

def _extract_emojis_from_payload(m_payload, fountain, buckets):
    emoji_counts = {}
    for b in buckets:
        rx_list = b.get("reactionsData", []) or b.get("reactions", [])
        for r in rx_list:
            cnt = r.get("reactionCount", 1)
            em = r.get("unicodeEmojiId") or r.get("emojiId") or _resolve_single_emoji(json.dumps(r, ensure_ascii=False))
            if em:
                emoji_counts[em] = max(emoji_counts.get(em, 0), cnt)
                
    for r in fountain.get("reactionsData", []) or fountain.get("reactions", []):
        cnt = r.get("reactionCount", 1)
        em = r.get("unicodeEmojiId") or r.get("emojiId") or _resolve_single_emoji(json.dumps(r, ensure_ascii=False))
        if em:
            emoji_counts[em] = max(emoji_counts.get(em, 0), cnt)
            
    if not emoji_counts:
        full_str = json.dumps(m_payload, ensure_ascii=False)
        logging.info(f"[Reaction Payload Inspection] {full_str[:250]}")
        em = _resolve_single_emoji(full_str)
        emoji_counts[em or "❤️"] = 1
        
    return list(emoji_counts.items())

# YouTube InnerTube Live Reactions (emojiFountainDataEntity) Hook
_original_get_contents = Parser.get_contents
_last_fountain_update_time = None
_last_fountain_emoji_counts = {}

def _custom_get_contents(self, jsn):
    global _last_fountain_update_time, _last_fountain_emoji_counts
    if jsn and "frameworkUpdates" in jsn:
        try:
            mutations = jsn["frameworkUpdates"].get("entityBatchUpdate", {}).get("mutations", [])
            for m in mutations:
                payload = m.get("payload", {})
                if "emojiFountainDataEntity" in payload:
                    fountain = payload["emojiFountainDataEntity"]
                    update_time = fountain.get("updateTimeUsec")
                    buckets = fountain.get("reactionBuckets", [])
                    
                    # 以前と同一の updateTime なら重複処理をスキップ
                    if update_time and update_time == _last_fountain_update_time:
                        continue
                    
                    # 各絵文字の現在のカウントを集計
                    current_counts = {}
                    for b in buckets:
                        for r in b.get("reactionsData", []) or b.get("reactions", []):
                            cnt = r.get("reactionCount", 0)
                            em = r.get("unicodeEmojiId") or r.get("emojiId") or _resolve_single_emoji(json.dumps(r, ensure_ascii=False))
                            if em and cnt > 0:
                                current_counts[em] = current_counts.get(em, 0) + cnt
                    for r in fountain.get("reactionsData", []) or fountain.get("reactions", []):
                        cnt = r.get("reactionCount", 0)
                        em = r.get("unicodeEmojiId") or r.get("emojiId") or _resolve_single_emoji(json.dumps(r, ensure_ascii=False))
                        if em and cnt > 0:
                            current_counts[em] = current_counts.get(em, 0) + cnt
                    
                    # 初回接続時は現在のカウントをベースラインとして記憶（過去の累積を即時発火させない）
                    if _last_fountain_update_time is None:
                        _last_fountain_update_time = update_time
                        _last_fountain_emoji_counts = current_counts
                        continue
                    
                    _last_fountain_update_time = update_time
                    
                    # 差分（新規に増加したリアクション数）のみを発火
                    new_reactions = []
                    for em, cnt in current_counts.items():
                        prev_cnt = _last_fountain_emoji_counts.get(em, 0)
                        diff = cnt - prev_cnt
                        if diff > 0:
                            new_reactions.append((em, diff))
                    
                    _last_fountain_emoji_counts = current_counts
                    
                    if new_reactions:
                        contents = jsn.get('continuationContents')
                        if contents and 'liveChatContinuation' in contents:
                            lc = contents['liveChatContinuation']
                            if 'actions' not in lc or lc['actions'] is None:
                                lc['actions'] = []
                            for em, diff in new_reactions:
                                logging.info(f"[YouTube Live Reaction Intercepted!] emoji={em} count={diff} updateTime={update_time}")
                                lc['actions'].append({
                                    "vstudioLiveReaction": {
                                        "emoji": em,
                                        "count": min(diff, 10)  # 一度のバースト上限
                                    }
                                })
        except Exception as err:
            logging.debug(f"Error parsing emojiFountainDataEntity: {err}")

    return _original_get_contents(self, jsn)

Parser.get_contents = _custom_get_contents

class ReactionItem:
    def __init__(self, emoji="❤️", count=1, nickname="YouTube視聴者"):
        self.type = "reaction"
        self.emoji = emoji
        self.count = count
        self.nickname = nickname
        self.author = type('Author', (), {'name': nickname, 'imageUrl': ''})()
        self.message = emoji * count
        self.amountValue = 0
        self.amountString = ""
        self.timestamp = int(time.time() * 1000)

class VStudioChatProcessor(DefaultProcessor):
    def process(self, chat_components: list):
        chatlist = []
        timeout = 0
        if chat_components:
            for component in chat_components:
                if component is None:
                    continue
                timeout += component.get('timeout', 0)
                chatdata = component.get('chatdata')
                if chatdata is None:
                    continue
                for action in chatdata:
                    if action is None:
                        continue
                    if action.get('vstudioLiveReaction') is not None:
                        rx = action['vstudioLiveReaction']
                        chatlist.append(ReactionItem(emoji=rx.get('emoji', '❤️'), count=rx.get('count', 1)))
                    elif action.get('addChatItemAction') is not None:
                        item = action['addChatItemAction'].get('item')
                        if item:
                            chat = self._parse(item)
                            if chat:
                                chatlist.append(chat)
                    else:
                        try:
                            action_str = json.dumps(action, ensure_ascii=False)
                            # 高評価(Like)や通知パネル等の無関係なイベントをハートリアクションとして誤検知しないようガード
                            # 絵文字が明示的に含まれるリアクションイベント（例: viewerReaction, liveChatReaction）のみ対象とする
                            found_emojis = re.findall(r'[❤️💖💕💓💗💘✨🌟🎉🥳👍😻🐾🔥🥰😍🙌⭐💯👏😭😂]', action_str)
                            if found_emojis and any(k in action_str.lower() for k in ["viewerreaction", "livechatreaction", "reactionaction"]):
                                emoji = found_emojis[0]
                                logging.info(f"[YouTube Live Reaction Raw Match] {emoji} (Payload: {action_str[:160]})")
                                chatlist.append(ReactionItem(emoji=emoji, count=1))
                            else:
                                logging.debug(f"[YouTube Other Action] {action_str[:120]}")
                        except Exception as parse_err:
                            logging.debug(f"[YouTube Action Parse Err] {parse_err}")
        if self.first and chatlist:
            self.abs_diff = time.time() - (getattr(chatlist[0], 'timestamp', time.time() * 1000) / 1000)
            self.first = False
        return Chatdata(chatlist, float(timeout), self.abs_diff)

# YouTube API scopes
SCOPES = ['https://www.googleapis.com/auth/youtube']
BASE_DIR = BASE_DIR
TOKEN_PATH = os.path.join(BASE_DIR, 'config', 'token.pickle')
youtube_api_client = None

def get_authenticated_service():
    """OAuth認証を行いYouTube APIクライアントを返す（エラー時は安全にNoneを返す）"""
    creds = None
    try:
        if os.path.exists(TOKEN_PATH):
            with open(TOKEN_PATH, 'rb') as token:
                creds = pickle.load(token)
                
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    with open(TOKEN_PATH, 'wb') as token:
                        pickle.dump(creds, token)
                except Exception as e:
                    logging.warning(f"OAuth Token refresh failed: {e}. Removing stale token.")
                    if os.path.exists(TOKEN_PATH):
                        os.remove(TOKEN_PATH)
                    return None
            else:
                logging.info("有効なトークンがないため、スクレイピングモードで即時起動します。")
                return None
                
        return build('youtube', 'v3', credentials=creds)
    except Exception as e:
        logging.warning(f"YouTube OAuth initialization failed ({e}). Running in scraping mode.")
        return None

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
    global youtube_api_client, current_video_id
_youtube_quota_exceeded_until = 0

async def fetch_live_stats_loop(video_id):
    """
    配信中の同時接続者数・高評価数・チャンネル登録者数を定期更新するループタスク
    """
    global current_video_id, current_stats, _youtube_quota_exceeded_until
    
    try:
        while current_video_id == video_id:
            viewers = ""
            subscribers = ""
            likes = ""

            # 1. YouTube Data API が利用可能な場合（クォータ制限中は無駄な通信をスキップ）
            now_ts = time.time()
            if youtube_api_client and now_ts >= _youtube_quota_exceeded_until:
                try:
                    req = youtube_api_client.videos().list(
                        part="liveStreamingDetails,statistics,snippet",
                        id=video_id
                    )
                    res = await asyncio.to_thread(req.execute)
                    if res and "items" in res and len(res["items"]) > 0:
                        item = res["items"][0]
                        stats = item.get("statistics", {})
                        lsd = item.get("liveStreamingDetails", {})
                        if "viewCount" in stats:
                            viewers = f"{int(stats['viewCount']):,}"
                        elif "concurrentViewers" in lsd:
                            viewers = f"{int(lsd['concurrentViewers']):,}"
                        
                        if "likeCount" in stats:
                            likes = f"{int(stats['likeCount']):,}"
                        
                        channel_id = item.get("snippet", {}).get("channelId")
                        if channel_id:
                            ch_req = youtube_api_client.channels().list(
                                part="statistics",
                                id=channel_id
                            )
                            ch_res = await asyncio.to_thread(ch_req.execute)
                            if ch_res and "items" in ch_res and len(ch_res["items"]) > 0:
                                ch_stats = ch_res["items"][0].get("statistics", {})
                                if "subscriberCount" in ch_stats:
                                    subscribers = f"{int(ch_stats['subscriberCount']):,}"
                except Exception as e:
                    err_str = str(e)
                    if "quotaExceeded" in err_str or "403" in err_str:
                        _youtube_quota_exceeded_until = now_ts + 1800  # 30分間APIリクエストを停止
                        logging.info("ℹ️ [YouTube API] 1日のクォータ上限に達したため、API通信を一時休止しスクレイピングフォールバックへ自動移行します（コメント取得・番組進行は正常継続）")
                    else:
                        logging.warning(f"YouTube Data API fetch stats failed: {e}")

            # 2. スクレイピングによる抽出（フォールバック）
            if not viewers or not subscribers or not likes:
                url = f"https://www.youtube.com/watch?v={video_id}"
                headers = {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
                }

                try:
                    html = await asyncio.to_thread(lambda: requests.get(url, headers=headers, timeout=8).text)
                    
                    if not viewers:
                        player_match = re.search(r'ytInitialPlayerResponse\s*=\s*(\{.*?\});(?:var|</script>)', html)
                        if player_match:
                            try:
                                player = json.loads(player_match.group(1))
                                videoDetails = player.get("videoDetails", {})
                                raw_vc = videoDetails.get("viewCount")
                                if raw_vc is not None and str(raw_vc).isdigit():
                                    viewers = f"{int(raw_vc):,}"
                            except Exception:
                                pass

                    if not viewers:
                        txt_match = re.search(r'"(?:simpleText|label)"\s*:\s*"([\d,]+)\s*(?:回視聴|人が視聴中)"', html)
                        if txt_match:
                            viewers = txt_match.group(1)

                    if not viewers:
                        vc_match = re.search(r'"viewCount"\s*:\s*"?(\d+)"?', html)
                        if vc_match:
                            viewers = f"{int(vc_match.group(1)):,}"

                    if not likes:
                        like_lbl_match = re.search(r'"label"\s*:\s*"([\d,]+)\s*(?:件の|人による)?高評価"', html)
                        if like_lbl_match:
                            likes = like_lbl_match.group(1)
                        else:
                            like_txt_match = re.search(r'"(?:simpleText|label)"\s*:\s*"([\d,]+)\s*(?:件の高評価|高評価)"', html)
                            if like_txt_match:
                                likes = like_txt_match.group(1)
                            else:
                                like_cnt_match = re.search(r'"likeCount"\s*:\s*"?(\d+)"?', html)
                                if like_cnt_match:
                                    likes = f"{int(like_cnt_match.group(1)):,}"

                    if not subscribers:
                        sub_match1 = re.search(r'"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\}', html)
                        if sub_match1:
                            subscribers = sub_match1.group(1)
                        else:
                            sub_match2 = re.search(r'"subscriberCountText":\{"simpleText":"([^"]+)"\}', html)
                            if sub_match2:
                                subscribers = sub_match2.group(1)
                except Exception as e:
                    logging.error(f"Error fetching stats via scraping: {e}")

            if not viewers:
                viewers = "-"
            if not likes:
                likes = "-"

            await broadcast_to_clients({
                "type": "stats",
                "videoId": video_id,
                "viewers": viewers,
                "subscribers": subscribers,
                "likes": likes
            })
                
            await asyncio.sleep(10) # 10秒ごとに更新
    except asyncio.CancelledError:
        pass

def resolve_youtube_video_id(input_str: str) -> tuple[str, str]:
    """
    入力文字列（動画ID、動画URL、チャンネルURL、@ハンドル名）から動画IDと解決情報を取得する。
    Returns: (video_id, info_message)
    """
    input_str = input_str.strip()
    if not input_str:
        return "", ""

    # 1. すでに11文字の動画IDそのもの（英数字と-_）の場合
    if re.match(r'^[a-zA-Z0-9_-]{11}$', input_str):
        return input_str, f"Direct Video ID: {input_str}"

    # 0. API認証済みの場合、進行中/予約枠から自動解決
    global youtube_api_client
    if youtube_api_client and (input_str.startswith("@") or len(input_str) != 11):
        try:
            b_req = youtube_api_client.liveBroadcasts().list(part="id,status", mine=True, maxResults=10)
            b_res = b_req.execute()
            for b in b_res.get("items", []):
                st = b.get("status", {}).get("lifeCycleStatus")
                if st in ["live", "testStarting", "liveStarting", "ready"]:
                    logging.info(f"[AutoDetect] Found active broadcast via API: {b['id']} ({st})")
                    return b["id"], f"Authenticated Live Stream: {b['id']} ({st})"
        except Exception as e:
            logging.debug(f"API live broadcast check: {e}")

    # 2. 通常の動画URL（watch?v=... / youtu.be/... / live/...）
    v_match = re.search(r'(?:v=|\/live\/|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', input_str)
    if v_match and not "@" in input_str and not "/channel/" in input_str:
        vid = v_match.group(1)
        return vid, f"Video URL: {vid}"

    # 3. チャンネル指定（@handle または channel/UC... または c/...）
    handle = ""
    if input_str.startswith("@"):
        handle = input_str
    else:
        handle_match = re.search(r'youtube\.com\/(@[a-zA-Z0-9_.-]+)', input_str)
        if handle_match:
            handle = handle_match.group(1)

    channel_url = ""
    if handle:
        channel_url = f"https://www.youtube.com/{handle}/live"
    elif "youtube.com/channel/" in input_str:
        cid_match = re.search(r'youtube\.com\/channel\/([a-zA-Z0-9_-]+)', input_str)
        if cid_match:
            channel_url = f"https://www.youtube.com/channel/{cid_match.group(1)}/live"
    elif input_str.startswith("UC") and len(input_str) >= 20:
        channel_url = f"https://www.youtube.com/channel/{input_str}/live"

    if channel_url:
        logging.info(f"[AutoDetect] Resolving live video ID from channel live URL: {channel_url}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }
        try:
            resp = requests.get(channel_url, headers=headers, timeout=10, allow_redirects=True)
            
            # リダイレクト後のURLから v= または /live/ を取得
            v_match_final = re.search(r'(?:v=|\/live\/|\/watch\?v=)([a-zA-Z0-9_-]{11})', resp.url)
            if v_match_final:
                vid = v_match_final.group(1)
                logging.info(f"[AutoDetect] Resolved Video ID via redirect: {vid}")
                return vid, f"Auto-detected Live Stream: {vid} ({handle or input_str})"

            # HTML内の canonical URL から取得
            html = resp.text
            canon_match = re.search(r'<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"', html)
            if canon_match:
                vid = canon_match.group(1)
                logging.info(f"[AutoDetect] Resolved Video ID via canonical: {vid}")
                return vid, f"Auto-detected Live Stream: {vid} ({handle or input_str})"

            # ytInitialData 内の最新ストリーム一覧から先頭の videoId を取得
            vid_matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if vid_matches:
                vid = vid_matches[0]
                logging.info(f"[AutoDetect] Resolved Video ID via ytInitialData: {vid}")
                return vid, f"Auto-detected Latest Stream: {vid} ({handle or input_str})"
        except Exception as e:
            logging.error(f"Failed to auto-resolve live video ID from {channel_url}: {e}")

    # フォールバック（URL内の動画IDまたは入力文字列そのもの）
    if v_match:
        return v_match.group(1), f"Fallback Video ID: {v_match.group(1)}"
    return input_str, input_str

async def start_youtube_client(video_id_or_channel: str, websocket):
    global chat_task, current_video_id, chat, recent_comments, comment_history
    
    # チャンネル名/@ハンドル/URLから最新の動画IDを自動解決
    video_id, resolve_info = await asyncio.to_thread(resolve_youtube_video_id, video_id_or_channel)
    if not video_id:
        video_id = video_id_or_channel

    logging.info(f"[YouTube] Connect requested for '{video_id_or_channel}' -> Resolved as '{video_id}' ({resolve_info})")

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

    # 既存の接続・統計タスクを確実に停止
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
                    raw_author = renderer.get("authorName", {}).get("simpleText", "")
                    ch_id = renderer.get("authorExternalChannelId", "")
                    author = await resolve_author_name(raw_author, ch_id)
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
        last_status_sent = None
        try:
            loop = asyncio.get_event_loop()
            while chat_task is not None and current_video_id == video_id:
                if local_chat is None or not local_chat.is_alive():
                    try:
                        import httpx
                        local_chat = await loop.run_in_executor(
                            None, 
                            lambda: pytchat.create(
                                video_id=video_id, 
                                processor=VStudioChatProcessor(),
                                interruptable=False, 
                                client=httpx.Client(http2=False)
                            )
                        )
                        if local_chat.is_alive():
                            if last_status_sent != "connected":
                                last_status_sent = "connected"
                                await broadcast_to_clients({
                                    "type": "status",
                                    "status": "connected",
                                    "message": f"Connected to YouTube Live (ID: {video_id})"
                                })
                        else:
                            if last_status_sent != "waiting":
                                last_status_sent = "waiting"
                                await broadcast_to_clients({
                                    "type": "status",
                                    "status": "waiting",
                                    "message": f"待機中... 配信開始またはチャットの有効化を待っています (ID: {video_id})"
                                })
                    except Exception as e:
                        logging.warning(f"pytchat creation failed (might not be live yet): {e}")
                        local_chat = None
                        if last_status_sent != "waiting":
                            last_status_sent = "waiting"
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
                        # ライブリアクション (YouTube Live Reactions)
                        if getattr(c, 'type', None) == 'reaction':
                            logging.info(f"[YouTube Live Reaction] {c.emoji} x {c.count} ({c.nickname})")
                            await broadcast_to_clients({
                                "type": "reaction",
                                "emoji": c.emoji,
                                "nickname": c.nickname,
                                "count": c.count
                            })
                            continue

                        # 投稿者表示名（ハンドル名からチャンネル正式名）の解決
                        author_disp = await resolve_author_name(c.author.name, getattr(c.author, 'channelId', None))
                        comment_sig = f"{author_disp}:{c.message}"
                        if comment_sig in recent_comments:
                            continue
                        
                        recent_comments.append(comment_sig)
                        if len(recent_comments) > 100:
                            recent_comments.pop(0)

                        logging.info(f"[YouTube] {author_disp}: {c.message}")
                        
                        if c.amountValue > 0:
                            logging.info(f"[SuperChat] {author_disp} sent {c.amountString}")
                            msg = {
                                "type": "gift",
                                "nickname": author_disp,
                                "amount": c.amountString,
                                "iconUrl": c.author.imageUrl
                            }
                            comment_history.append(msg)
                            if len(comment_history) > 100: comment_history.pop(0)
                            await broadcast_to_clients(msg)
                        
                        clean_msg = decode_youtube_emojis(c.message)
                        crm_info = record_listener_comment(
                            platform="youtube",
                            user_id=getattr(c.author, 'channelId', None) or author_disp,
                            display_name=author_disp,
                            handle=getattr(c.author, 'name', '') if str(getattr(c.author, 'name', '')).startswith('@') else '',
                            comment=clean_msg,
                            stream_id=current_video_id,
                            is_superchat=(c.amountValue > 0),
                            amount=c.amountString
                        )
                        msg = {
                            "type": "comment",
                            "nickname": author_disp,
                            "comment": clean_msg,
                            "iconUrl": c.author.imageUrl,
                            "isFirstTime": crm_info.get("isFirstTime", False),
                            "visitDaysCount": crm_info.get("visitDaysCount", 1)
                        }
                        comment_history.append(msg)
                        if len(comment_history) > 100: comment_history.pop(0)
                        await broadcast_to_clients(msg)

                        # リアクション絵文字の検知とブロードキャスト
                        rx_emojis = re.findall(r'[❤️💖💕💓💗💘✨🌟🎉🥳👍😻🐾🔥🥰😍🙌⭐💯👏]', c.message)
                        if rx_emojis:
                            await broadcast_to_clients({
                                "type": "reaction",
                                "emoji": rx_emojis[0],
                                "nickname": author_disp,
                                "count": len(rx_emojis)
                            })
                    
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
    global chat_task, stats_task, current_video_id, chat
    if chat_task is not None:
        logging.info("Stopping YouTube Live client...")
        chat_task.cancel()
        chat_task = None
    if stats_task is not None:
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
