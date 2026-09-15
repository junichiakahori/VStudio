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

def list_available_cache_dates():
    """利用可能なニュースキャッシュの日付一覧およびサマリー情報を取得"""
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
            item_count = len(data) if isinstance(data, list) else 0
            results.append({
                "date": date_str,
                "filename": fname,
                "item_count": item_count,
                "file_size": stat.st_size,
                "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            })
        except Exception as e:
            print(f"[NewsCacheManager] Error reading {fname}: {e}")
            continue

    return results

def get_cache_by_date(date_str):
    """指定日付のニュースキャッシュデータを取得"""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return {"success": False, "error": "無効な日付フォーマットです (例: YYYY-MM-DD)"}

    filepath = os.path.join(HISTORY_DIR, f"news_{date_str}.json")
    if not os.path.exists(filepath):
        return {"success": True, "date": date_str, "items": [], "item_count": 0, "file_exists": False}

    try:
        stat = os.stat(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        items = data if isinstance(data, list) else []
        return {
            "success": True,
            "date": date_str,
            "items": items,
            "item_count": len(items),
            "file_size": stat.st_size,
            "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "file_exists": True
        }
    except Exception as e:
        return {"success": False, "error": f"キャッシュ読み込みエラー: {str(e)}"}

def clear_cache_by_date(date_str):
    """指定日付のニュースキャッシュをクリア（全削除）"""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return {"success": False, "error": "無効な日付フォーマットです"}

    filepath = os.path.join(HISTORY_DIR, f"news_{date_str}.json")
    if not os.path.exists(filepath):
        return {"success": True, "message": f"{date_str} のキャッシュは既に存在しません", "deleted": False}

    try:
        # 安全のため空配列で上書き保存（履歴ディレクトリの管理上）
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"{date_str} のキャッシュを正常に消去しました", "deleted": True}
    except Exception as e:
        return {"success": False, "error": f"キャッシュ消去エラー: {str(e)}"}

def delete_cache_item(date_str, item_index=None, title=None):
    """指定日付のキャッシュから特定記事のみを削除"""
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

        for i, item in enumerate(data):
            # indexによるマッチ
            if item_index is not None and (item.get("index") == item_index or i == item_index):
                continue
            # titleによるマッチ
            if title and item.get("title") == title:
                continue
            new_items.append(item)

        if len(new_items) == original_len:
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
