# -*- coding: utf-8 -*-
"""
listener_crm.py
AITuber リスナー管理（CRM）・コメント日付記録・常連/初見判定エンジン
"""

import os
import json
import threading
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LISTENERS_FILE = os.path.join(BASE_DIR, "data", "users", "listeners.json")
COMMENTS_DIR = os.path.join(BASE_DIR, "data", "comments")

_crm_lock = threading.Lock()
_listeners_cache = {}

def _ensure_dirs():
    os.makedirs(os.path.dirname(LISTENERS_FILE), exist_ok=True)
    os.makedirs(COMMENTS_DIR, exist_ok=True)

def load_listeners():
    global _listeners_cache
    _ensure_dirs()
    if os.path.exists(LISTENERS_FILE):
        try:
            with open(LISTENERS_FILE, 'r', encoding='utf-8') as f:
                _listeners_cache = json.load(f)
                return _listeners_cache
        except Exception as e:
            print(f"[CRM] listeners.json 読み込みエラー: {e}")
    _listeners_cache = {}
    return _listeners_cache

def save_listeners():
    _ensure_dirs()
    try:
        with _crm_lock:
            with open(LISTENERS_FILE, 'w', encoding='utf-8') as f:
                json.dump(_listeners_cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[CRM] listeners.json 保存エラー: {e}")

load_listeners()

def record_listener_comment(platform, user_id, display_name, handle="", comment="", stream_id="", is_superchat=False, amount=""):
    """
    リスナーからのコメントを受信し、台帳および日別コメントログに記録する。
    初見（isFirstTime）、通算来訪日数、累計コメント数などのインテリジェント情報を返す。
    """
    global _listeners_cache
    if not user_id:
        user_id = handle or display_name
    if not user_id:
        return {"isFirstTime": False, "visitDaysCount": 1, "totalComments": 1}

    now = datetime.datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')
    today_str = now.strftime('%Y-%m-%d')

    with _crm_lock:
        if not _listeners_cache:
            load_listeners()

        is_first_time = False
        user = _listeners_cache.get(user_id)
        if not user:
            is_first_time = True
            user = {
                "userId": user_id,
                "displayName": display_name or user_id,
                "handle": handle or "",
                "firstSeen": now_str,
                "lastSeen": now_str,
                "activeDates": [today_str],
                "visitDaysCount": 1,
                "totalComments": 0,
                "totalSuperChats": 0,
                "platform": platform,
                "recentComments": []
            }
            _listeners_cache[user_id] = user

        # 情報の更新
        if display_name and not display_name.startswith("@"):
            user["displayName"] = display_name
        if handle and handle.startswith("@"):
            user["handle"] = handle

        user["lastSeen"] = now_str
        if today_str not in user.get("activeDates", []):
            user.setdefault("activeDates", []).append(today_str)
            user["activeDates"].sort()
        user["visitDaysCount"] = len(user["activeDates"])
        user["totalComments"] = user.get("totalComments", 0) + 1
        if is_superchat:
            user["totalSuperChats"] = user.get("totalSuperChats", 0) + 1

        recent = user.setdefault("recentComments", [])
        recent.append({
            "timestamp": now_str,
            "text": comment,
            "streamId": stream_id
        })
        if len(recent) > 20:
            user["recentComments"] = recent[-20:]

        save_listeners()

    # 日別コメントログへの追記
    try:
        daily_comments_file = os.path.join(COMMENTS_DIR, f"comments_{today_str}.json")
        comments_list = []
        if os.path.exists(daily_comments_file):
            try:
                with open(daily_comments_file, 'r', encoding='utf-8') as f:
                    comments_list = json.load(f)
            except Exception:
                comments_list = []
        comments_list.append({
            "timestamp": now_str,
            "platform": platform,
            "userId": user_id,
            "displayName": display_name,
            "handle": handle,
            "comment": comment,
            "isSuperChat": is_superchat,
            "amount": amount,
            "streamId": stream_id
        })
        with open(daily_comments_file, 'w', encoding='utf-8') as f:
            json.dump(comments_list, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[CRM] 日別コメントログ保存エラー: {e}")

    return {
        "isFirstTime": is_first_time,
        "visitDaysCount": user.get("visitDaysCount", 1),
        "totalComments": user.get("totalComments", 1),
        "displayName": user.get("displayName", display_name)
    }

def migrate_legacy_youtube_cache():
    """既存の dict/youtube_user_cache.json を listeners.json へ安全に移行・紐付け"""
    cache_file = os.path.join(BASE_DIR, "dict", "youtube_user_cache.json")
    if not os.path.exists(cache_file):
        return
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        today_str = datetime.datetime.now().strftime('%Y-%m-%d')

        # チャンネルID（UCKxh...）とハンドル（@...）をグループ化
        channels = {k: v for k, v in data.items() if k.startswith("UC")}
        handles = {k: v for k, v in data.items() if k.startswith("@")}

        for ch_id, d_name in channels.items():
            matched_handle = ""
            for h_k, h_v in handles.items():
                if h_v == d_name:
                    matched_handle = h_k
                    break
            record_listener_comment("youtube", ch_id, d_name, handle=matched_handle, comment="（既存キャッシュからの初期移行）")
        print(f"[CRM] ✅ {len(channels)}件の既存YouTubeリスナーを listeners.json に初期登録完了")
    except Exception as e:
        print(f"[CRM] 既存キャッシュ移行エラー: {e}")

if __name__ == "__main__":
    migrate_legacy_youtube_cache()
