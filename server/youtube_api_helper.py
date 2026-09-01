import os
import io
import json
import base64
import pickle
import logging
import datetime
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SCOPES = ['https://www.googleapis.com/auth/youtube']
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_PATH = os.path.join(BASE_DIR, 'config', 'token.pickle')
CLIENT_SECRET_PATH = os.path.join(BASE_DIR, 'config', 'client_secret.json')

_cached_youtube_client = None

def get_authenticated_service(force_reauth=False):
    """OAuth認証を行いYouTube APIクライアントを返す（エラー時はNone）"""
    global _cached_youtube_client
    if _cached_youtube_client and not force_reauth:
        return _cached_youtube_client

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
                    logging.warning(f"[YouTube OAuth] Token refresh failed: {e}")
                    if os.path.exists(TOKEN_PATH):
                        os.remove(TOKEN_PATH)
                    return None
            else:
                return None

        _cached_youtube_client = build('youtube', 'v3', credentials=creds)
        return _cached_youtube_client
    except Exception as e:
        logging.warning(f"[YouTube OAuth] Initialization failed: {e}")
        return None

def get_oauth_status():
    """現在のOAuth認証状態およびチャンネル名を取得"""
    has_secret = os.path.exists(CLIENT_SECRET_PATH)
    service = get_authenticated_service()
    if not service:
        return {
            "authenticated": False,
            "has_client_secret": has_secret,
            "channel_title": "",
            "channel_id": ""
        }
    try:
        res = service.channels().list(part="snippet,id", mine=True).execute()
        if res.get("items"):
            item = res["items"][0]
            return {
                "authenticated": True,
                "has_client_secret": has_secret,
                "channel_title": item["snippet"]["title"],
                "channel_id": item["id"]
            }
    except Exception as e:
        logging.warning(f"[YouTube OAuth] Channels fetch failed: {e}")
    return {
        "authenticated": False,
        "has_client_secret": has_secret,
        "channel_title": "",
        "channel_id": ""
    }

def start_oauth_flow():
    """ブラウザを開いてGoogle OAuth認証を実行し、token.pickleを保存"""
    global _cached_youtube_client
    if not os.path.exists(CLIENT_SECRET_PATH):
        raise FileNotFoundError("client_secret.json が見つかりません。")

    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_PATH, SCOPES)
    creds = flow.run_local_server(port=0, prompt='consent')
    with open(TOKEN_PATH, 'wb') as token:
        pickle.dump(creds, token)

    _cached_youtube_client = build('youtube', 'v3', credentials=creds)
    status = get_oauth_status()
    return status

def ensure_future_start_time_iso(start_time_iso=None):
    """
    YouTube API要件に合わせて、配信予約時刻が必ず未来（現在+2分以降）になるよう自動検証＆補正する
    """
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    min_future_utc = now_utc + datetime.timedelta(minutes=2)

    if not start_time_iso:
        return (now_utc + datetime.timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')

    iso_str = str(start_time_iso).strip()
    if "T" in iso_str and not (iso_str.endswith("Z") or "+" in iso_str or "-" in iso_str[10:]):
        iso_str = f"{iso_str}:00+09:00"

    try:
        dt = datetime.datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=9)))
        dt_utc = dt.astimezone(datetime.timezone.utc)
        if dt_utc < min_future_utc:
            # 過去または直前時刻を検知した場合は、安全な未来時刻（現在+3分）へ自動補正
            corrected = now_utc + datetime.timedelta(minutes=3)
            print(f"[YouTube API] ⚠️ 過去・直前時刻 ({iso_str}) を検知 ➔ 安全な未来時刻 ({corrected.strftime('%Y-%m-%dT%H:%M:%SZ')}) に自動補正しました")
            return corrected.strftime('%Y-%m-%dT%H:%M:%SZ')
        return dt_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception as e:
        print(f"[YouTube API] 時刻パースエラー ({e}) ➔ デフォルト未来時刻 (+5分) を適用")
        return (now_utc + datetime.timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')

def create_live_broadcast(title, description="", start_time_iso=None, privacy_status="unlisted"):
    """YouTube Live配信枠（予約枠）を新規作成し、ストリームにバインド"""
    service = get_authenticated_service()
    if not service:
        raise ValueError("YouTube API未認証です。Googleアカウント連携を行ってください。")

    # 過去時刻エラー（invalidScheduledStartTime 400）を100%防止する安全未来時刻化
    valid_start_time_iso = ensure_future_start_time_iso(start_time_iso)

    # 新規作成時は "keep" は使えないため、デフォルトの "public"（公開）にフォールバック
    valid_privacy = privacy_status if privacy_status in ["public", "unlisted", "private"] else "public"

    broadcast_body = {
        "snippet": {
            "title": title or "【生放送】バーチャル配信",
            "description": description or "",
            "scheduledStartTime": valid_start_time_iso
        },
        "status": {
            "privacyStatus": valid_privacy,
            "selfDeclaredMadeForKids": False
        },
        "contentDetails": {
            "enableAutoStart": True,
            "enableAutoStop": True,
            "enableDvr": True
        }
    }

    broadcast_req = service.liveBroadcasts().insert(
        part="snippet,status,contentDetails",
        body=broadcast_body
    )
    broadcast_res = broadcast_req.execute()
    broadcast_id = broadcast_res["id"]

    # 既存の mine=True ストリームを取得してバインド（なければ作成）
    try:
        streams_req = service.liveStreams().list(
            part="id,snippet,cdn,status",
            mine=True
        )
        streams_res = streams_req.execute()
        stream_id = None
        if streams_res.get("items"):
            stream_id = streams_res["items"][0]["id"]
        else:
            new_stream_req = service.liveStreams().insert(
                part="snippet,cdn",
                body={
                    "snippet": {"title": "VStudio Default Stream"},
                    "cdn": {
                        "frameRate": "variable",
                        "ingestionType": "rtmp",
                        "resolution": "variable"
                    }
                }
            )
            new_stream_res = new_stream_req.execute()
            stream_id = new_stream_res["id"]

        if stream_id:
            bind_req = service.liveBroadcasts().bind(
                part="id,contentDetails",
                id=broadcast_id,
                streamId=stream_id
            )
            bind_req.execute()
    except Exception as e:
        logging.warning(f"[YouTube Stream Bind Warning]: {e}")

    return {
        "id": broadcast_id,
        "title": broadcast_res["snippet"]["title"],
        "url": f"https://www.youtube.com/watch?v={broadcast_id}",
        "scheduledStartTime": broadcast_res["snippet"].get("scheduledStartTime", start_time_iso),
        "privacyStatus": privacy_status
    }

def update_live_broadcast(video_id, title=None, description=None, start_time_iso=None, privacy_status=None):
    """指定された動画ID / 配信枠のタイトル・概要欄・日時を更新"""
    service = get_authenticated_service()
    if not service:
        raise ValueError("YouTube API未認証です。Googleアカウント連携を行ってください。")

    # 1. まず liveBroadcasts として取得
    get_req = service.liveBroadcasts().list(
        part="snippet,status",
        id=video_id
    )
    get_res = get_req.execute()

    if not get_res.get("items"):
        # 通常の動画 (videos) として更新
        vid_req = service.videos().list(part="snippet,status", id=video_id)
        vid_res = vid_req.execute()
        if not vid_res.get("items"):
            raise ValueError(f"配信枠・動画ID ({video_id}) が見つかりませんでした。")
        item = vid_res["items"][0]
        snippet = item["snippet"]
        if title: snippet["title"] = title
        if description is not None: snippet["description"] = description
        if not snippet.get("categoryId"): snippet["categoryId"] = "22"
        up_req = service.videos().update(
            part="snippet",
            body={"id": video_id, "snippet": snippet}
        )
        return up_req.execute()

    item = get_res["items"][0]
    snippet = item["snippet"]
    status = item.get("status", {})
    lifecycle = status.get("lifeCycleStatus", "")

    if title: snippet["title"] = title
    if description is not None: snippet["description"] = description
    
    # 既に配信中 (live / complete) の場合は scheduledStartTime を変更しない（APIエラー回避）
    if start_time_iso and lifecycle not in ["live", "complete"]:
        snippet["scheduledStartTime"] = ensure_future_start_time_iso(start_time_iso)

    if privacy_status and privacy_status != "keep":
        status["privacyStatus"] = privacy_status

    try:
        if lifecycle in ["live", "complete"]:
            # 配信中の場合は videos().update で安全にタイトル・説明文を即時更新
            vid_req = service.videos().list(part="snippet", id=video_id)
            vid_res = vid_req.execute()
            if vid_res.get("items"):
                v_snippet = vid_res["items"][0]["snippet"]
                if title: v_snippet["title"] = title
                if description is not None: v_snippet["description"] = description
                up_req = service.videos().update(
                    part="snippet",
                    body={"id": video_id, "snippet": v_snippet}
                )
                return up_req.execute()

        parts = "snippet,status" if (privacy_status and privacy_status != "keep") else "snippet"
        body_data = {"id": video_id, "snippet": snippet}
        if privacy_status and privacy_status != "keep":
            body_data["status"] = status

        up_req = service.liveBroadcasts().update(
            part=parts,
            body=body_data
        )
        return up_req.execute()
    except Exception as e:
        logging.warning(f"liveBroadcasts update failed ({e}), falling back to videos().update")
        vid_req = service.videos().list(part="snippet", id=video_id)
        vid_res = vid_req.execute()
        if vid_res.get("items"):
            v_snippet = vid_res["items"][0]["snippet"]
            if title: v_snippet["title"] = title
            if description is not None: v_snippet["description"] = description
            up_req = service.videos().update(
                part="snippet",
                body={"id": video_id, "snippet": v_snippet}
            )
            return up_req.execute()
        raise e

def upload_thumbnail(video_id, image_data):
    """配信枠にサムネイル画像をアップロード"""
    service = get_authenticated_service()
    if not service:
        raise ValueError("YouTube API未認証です。Googleアカウント連携を行ってください。")

    if isinstance(image_data, str) and "," in image_data:
        image_data = image_data.split(",", 1)[1]

    if isinstance(image_data, str):
        raw_bytes = base64.b64decode(image_data)
    else:
        raw_bytes = image_data

    media = MediaIoBaseUpload(io.BytesIO(raw_bytes), mimetype='image/png', resumable=False)
    req = service.thumbnails().set(
        videoId=video_id,
        media_body=media
    )
    return req.execute()

def list_my_broadcasts(max_results=15):
    """自身のチャンネルの配信枠（upcoming/active/all）一覧を取得"""
    service = get_authenticated_service()
    if not service:
        raise ValueError("YouTube API未認証です。Googleアカウント連携を行ってください。")

    req = service.liveBroadcasts().list(
        part="id,snippet,status,contentDetails",
        mine=True,
        maxResults=max_results
    )
    res = req.execute()
    items = []
    for item in res.get("items", []):
        snippet = item.get("snippet", {})
        status = item.get("status", {})
        thumbnails = snippet.get("thumbnails", {})
        thumb_url = thumbnails.get("medium", {}).get("url") or thumbnails.get("default", {}).get("url") or f"https://i.ytimg.com/vi/{item.get('id')}/hqdefault.jpg"
        items.append({
            "id": item.get("id"),
            "title": snippet.get("title", "無題の配信"),
            "description": snippet.get("description", ""),
            "scheduledStartTime": snippet.get("scheduledStartTime"),
            "lifeCycleStatus": status.get("lifeCycleStatus"),
            "privacyStatus": status.get("privacyStatus"),
            "thumbnail": thumb_url,
            "url": f"https://www.youtube.com/watch?v={item.get('id')}"
        })
    return items


def fetch_video_info(raw_input):
    """URLまたは動画ID、チャンネル名から動画・ライブ配信情報を取得"""
    raw_input = (raw_input or "").strip()
    if not raw_input:
        raise ValueError("URL or Video ID is required")
        
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    video_id = raw_input
    if "youtu.be/" in raw_input:
        video_id = raw_input.split("youtu.be/")[1].split("?")[0].split("&")[0]
    elif "youtube.com/watch" in raw_input:
        m = re.search(r'[?&]v=([a-zA-Z0-9_-]+)', raw_input)
        if m:
            video_id = m.group(1)
    elif "youtube.com/live/" in raw_input:
        video_id = raw_input.split("youtube.com/live/")[1].split("?")[0].split("&")[0]
    elif "/live" in raw_input:
        video_id = raw_input.split("?")[0].split("#")[0]
        if not video_id.startswith("http"):
            video_id = "https://www.youtube.com/" + video_id.lstrip("/")

    if video_id.startswith("http"):
        target_url = video_id
    else:
        target_url = f"https://www.youtube.com/watch?v={video_id}"

    req = urllib.request.Request(
        target_url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        }
    )
    with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
        html = response.read().decode('utf-8', errors='ignore')

    match_actual_id = re.search(r'<meta property="og:video:url" content="[^"]*?[?&]v=([a-zA-Z0-9_-]{11})', html)
    if not match_actual_id:
        match_actual_id = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
    if match_actual_id:
        video_id = match_actual_id.group(1)

    match_time = re.search(r'"scheduledStartTime":\s*"([^"]+)"', html)
    if not match_time:
        match_time = re.search(r'"upcomingEventData":\s*\{\s*"startTime":\s*"([^"]+)"', html)
    if not match_time:
        match_time = re.search(r'"startTimestamp":\s*"([^"]+)"', html)
    scheduled_start_time = match_time.group(1) if match_time else None

    is_live = '"isLive":true' in html or '"isLiveNow":true' in html

    match_title = re.search(r'<title>([^<]+)</title>', html)
    title = match_title.group(1).replace(" - YouTube", "").strip() if match_title else ""

    if not title:
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            with urllib.request.urlopen(oembed_url, context=ctx, timeout=4) as oembed_res:
                oembed_data = json.loads(oembed_res.read().decode('utf-8'))
                title = oembed_data.get('title', '')
        except Exception:
            pass

    if not title:
        if len(video_id) == 11:
            title = f"YouTube予約・配信枠 ({video_id})"
            status = "scheduled_private"
        else:
            title = f"チャンネル配信 ({raw_input})"
            status = "channel_autodetect"
    else:
        status = "live" if is_live else ("scheduled" if scheduled_start_time else "ready")

    return {
        "videoId": video_id,
        "title": title,
        "scheduledStartTime": scheduled_start_time,
        "isLive": is_live,
        "status": status
    }
