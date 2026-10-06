# -*- coding: utf-8 -*-
"""
news_cache_manager.py
ニュース原稿キャッシュ（data/news_history/news_YYYY-MM-DD.json）の管理・閲覧・削除専任モジュール
"""

import os
import re
import json
import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HISTORY_DIR = os.path.join(BASE_DIR, "data", "news_history")

def get_today_date_str():
    """現在の日付文字列 (YYYY-MM-DD) を取得"""
    return datetime.datetime.now().strftime("%Y-%m-%d")

def cluster_items_into_sessions(raw_items, date_str):
    """
    記事リストを「取得・生成セッション（バッチ）」ごとにクラスタリング。
    - 各記事の created_at の時系列変化（2時間以上の間隔）により自動分割
    - 各セッション内の記事に session_index (#1, #2, ...) を付与
    - 最新の取得分が先頭になるように逆順で返却
    """
    if not raw_items:
        return []

    # 1. 元のインデックスと created_at を解析
    parsed_list = []
    for idx, it in enumerate(raw_items):
        item_copy = dict(it)
        item_copy["global_index"] = idx + 1
        c = it.get("created_at") or ""
        dt = None
        if c:
            try:
                dt = datetime.datetime.strptime(c, "%Y-%m-%d %H:%M:%S")
            except:
                pass
        parsed_list.append((dt, idx, item_copy))

    # 2. created_at順に並べて時系列クラスタリング（日時不明は末尾）
    valid_items = [p for p in parsed_list if p[0] is not None]
    invalid_items = [p for p in parsed_list if p[0] is None]
    valid_items.sort(key=lambda x: x[0])

    clusters = []
    current_cluster = []
    last_dt = None

    for dt, idx, item_copy in valid_items:
        if last_dt is None or (dt - last_dt).total_seconds() > 3600 * 2:
            if current_cluster:
                clusters.append(current_cluster)
            current_cluster = [item_copy]
        else:
            current_cluster.append(item_copy)
        last_dt = dt

    if current_cluster:
        clusters.append(current_cluster)

    if invalid_items:
        if clusters:
            clusters[-1].extend([p[2] for p in invalid_items])
        else:
            clusters.append([p[2] for p in invalid_items])

    # 3. クラスタごとにメタ情報と session_index を構築
    sessions = []
    for c_idx, cluster in enumerate(clusters):
        first_dt_str = cluster[0].get("created_at", "")
        time_str = "00:00"
        hour = 12
        if first_dt_str and " " in first_dt_str:
            time_part = first_dt_str.split()[1]
            time_str = ":".join(time_part.split(":")[:2])
            try:
                hour = int(time_part.split(":")[0])
            except:
                pass

        icon = "☀️" if 4 <= hour < 14 else "🌙"
        clean_time = time_str.replace(":", "")
        session_code = f"batch_{clean_time}"
        label = f"{icon} {date_str} {time_str} 取得分 ({len(cluster)}件)"

        # 各クラスタ内のソート: broadcast_index（放送順番号）があれば最優先で昇順ソート
        cluster.sort(key=lambda x: (x.get("broadcast_index") is None, x.get("broadcast_index", 99999), x.get("created_at", "")))

        for s_idx, it in enumerate(cluster):
            it["session_id"] = session_code
            it["session_index"] = it.get("broadcast_index") or (s_idx + 1)

        sessions.append({
            "id": f"{date_str}_{session_code}",
            "session": session_code,
            "date": date_str,
            "time": time_str,
            "label": label,
            "item_count": len(cluster),
            "items": cluster
        })

    # 最新順（夜の取得 ➔ 朝の取得）にソート
    sessions.reverse()
    return sessions

def list_available_cache_dates():
    """利用可能なニュースキャッシュの日付・取得セッション一覧を取得"""
    if not os.path.exists(HISTORY_DIR):
        return []

    results = []
    files = sorted(os.listdir(HISTORY_DIR), reverse=True)
    for fname in files:
        m = re.match(r"^news_(\d{4}-\d{2}-\d{2})\.json$", fname)
        if not m:
            continue
        date_str = m.group(1)
        filepath = os.path.join(HISTORY_DIR, fname)
        try:
            stat = os.stat(filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            raw_items = data if isinstance(data, list) else []

            cluster_sessions = cluster_items_into_sessions(raw_items, date_str)

            sessions = []
            for cs in cluster_sessions:
                sessions.append({
                    "id": cs["id"],
                    "session": cs["session"],
                    "date": cs["date"],
                    "label": cs["label"],
                    "item_count": cs["item_count"]
                })

            if len(sessions) > 1:
                sessions.append({
                    "id": f"{date_str}_all",
                    "session": "all",
                    "date": date_str,
                    "label": f"📅 {date_str} 一日全体 ({len(raw_items)}件)",
                    "item_count": len(raw_items)
                })
            elif len(sessions) == 0:
                sessions.append({
                    "id": f"{date_str}_all",
                    "session": "all",
                    "date": date_str,
                    "label": f"📅 {date_str} (0件)",
                    "item_count": 0
                })

            results.append({
                "date": date_str,
                "filename": fname,
                "item_count": len(raw_items),
                "sessions": sessions,
                "file_size": stat.st_size,
                "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            })
        except Exception as e:
            print(f"[NewsCacheManager] Error reading {fname}: {e}")
            continue

    return results

def get_cache_by_date(date_str, session=None):
    """
    指定日付のニュースキャッシュデータを取得。
    session パラメータ（例: 'batch_1802', 'batch_0646', 'all' または None）に応じて
    該当する取得バッチの記事を返し、セッション内連番 (session_index: #1, #2, ...) を提供する。
    """
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return {"success": False, "error": "無効な日付フォーマットです (例: YYYY-MM-DD)"}

    filepath = os.path.join(HISTORY_DIR, f"news_{date_str}.json")
    if not os.path.exists(filepath):
        return {
            "success": True, "date": date_str, "session": session or "all",
            "items": [], "item_count": 0, "total_count": 0, "file_exists": False
        }

    try:
        stat = os.stat(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        raw_items = data if isinstance(data, list) else []

        cluster_sessions = cluster_items_into_sessions(raw_items, date_str)

        # session に合致するクラスタを探索
        selected_session = None
        if session and session != "all":
            # 完全一致（batch_XXXX または 日付_batch_XXXX）
            for cs in cluster_sessions:
                if cs["session"] == session or cs["id"] == session or cs["session"] in session:
                    selected_session = cs
                    break
            # 後方互換（morning / evening）
            if not selected_session and session in ("morning", "evening"):
                for cs in cluster_sessions:
                    hour = int(cs["time"].split(":")[0]) if ":" in cs["time"] else 12
                    is_morning = 4 <= hour < 14
                    if (session == "morning" and is_morning) or (session == "evening" and not is_morning):
                        selected_session = cs
                        break

        if selected_session:
            filtered_items = selected_session["items"]
        else:
            # 全件（クラスタ内の全記事を展開）
            all_items = []
            for cs in cluster_sessions:
                all_items.extend(cs["items"])
            filtered_items = all_items if all_items else raw_items

        return {
            "success": True,
            "date": date_str,
            "session": session or (selected_session["session"] if selected_session else "all"),
            "session_label": selected_session["label"] if selected_session else f"📅 {date_str} 一日全体 ({len(raw_items)}件)",
            "items": filtered_items,
            "item_count": len(filtered_items),
            "total_count": len(raw_items),
            "file_size": stat.st_size,
            "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "file_exists": True
        }
    except Exception as e:
        return {"success": False, "error": f"キャッシュ取得中にエラーが発生しました: {str(e)}"}

def clear_cache_by_date(date_str, session=None):
    """
    指定日付（または指定取得バッチセッション）のキャッシュを消去。
    """
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return {"success": False, "error": "無効な日付フォーマットです"}

    filepath = os.path.join(HISTORY_DIR, f"news_{date_str}.json")
    if not os.path.exists(filepath):
        return {"success": True, "message": f"{date_str} のキャッシュは存在しません"}

    try:
        if not session or session == "all":
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            return {"success": True, "message": f"{date_str} の全キャッシュを消去しました", "deleted": True}

        # 特定取得セッションのみ削除
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        raw_items = data if isinstance(data, list) else []

        cluster_sessions = cluster_items_into_sessions(raw_items, date_str)
        remove_titles = set()
        session_label = session
        for cs in cluster_sessions:
            if cs["session"] == session or cs["id"] == session or cs["session"] in session:
                session_label = cs["label"]
                for it in cs["items"]:
                    if it.get("title"):
                        remove_titles.add(it["title"])

        kept_items = [it for it in raw_items if it.get("title") not in remove_titles]
        for idx, it in enumerate(kept_items):
            it["index"] = idx + 1

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(kept_items, f, ensure_ascii=False, indent=2)

        return {
            "success": True,
            "message": f"「{session_label}」のキャッシュを消去しました（残り: {len(kept_items)}件）",
            "deleted": True,
            "remaining_count": len(kept_items)
        }
    except Exception as e:
        return {"success": False, "error": f"キャッシュ消去エラー: {str(e)}"}

def delete_cache_item(date_str, item_index=None, title=None, global_index=None):
    """
    指定日付のキャッシュから特定記事のみを削除。
    タイトルまたは global_index による正確な特定を優先。
    """
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return {"success": False, "error": "無効な日付フォーマットです"}

    filepath = os.path.join(HISTORY_DIR, f"news_{date_str}.json")
    if not os.path.exists(filepath):
        return {"success": False, "error": "キャッシュファイルが存在しません"}

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return {"success": False, "error": "無効なキャッシュデータ形式です"}

        original_len = len(data)
        new_items = []
        deleted = False

        for i, item in enumerate(data):
            # 1. タイトル一致による正確な特定（最優先）
            if not deleted and title and item.get("title") == title:
                deleted = True
                continue
            # 2. global_index (1-indexed) または配列インデックス
            if not deleted and global_index is not None and (i + 1 == global_index or item.get("index") == global_index):
                deleted = True
                continue
            # 3. item_index
            if not deleted and item_index is not None and not title and (item.get("index") == item_index or i == item_index):
                deleted = True
                continue

            new_items.append(item)

        if not deleted:
            return {"success": False, "error": "削除対象の記事が見つかりませんでした"}

        # indexを再番号付け
        for idx, it in enumerate(new_items):
            it["index"] = idx + 1

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(new_items, f, ensure_ascii=False, indent=2)

        return {
            "success": True,
            "message": "指定した記事のキャッシュを削除しました",
            "remaining_count": len(new_items)
        }
    except Exception as e:
        return {"success": False, "error": f"記事削除エラー: {str(e)}"}
