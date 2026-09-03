# -*- coding: utf-8 -*-
"""
log_manager.py
VStudio ログ管理・日次/サイズ別自動ローテーション・クリーンアップモジュール
"""

import os
import re
import time
import datetime
import shutil
import threading

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(BASE_DIR, "logs", "browser_console.log")
LOG_BACKUP_DIR = os.path.join(BASE_DIR, "logs_backup")

_log_lock = threading.Lock()
_current_log_date = datetime.date.today().strftime('%Y-%m-%d')

ALL_MANAGED_LOGS = [
    ('browser_console', os.path.join(BASE_DIR, "logs", "browser_console.log")),
]
MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
RETENTION_DAYS = 7

LOG_FILES_MAP = {
    'launcher': 'logs/launcher.log',
    'api_server': 'logs/api_server.log',
    'vite': 'logs/vite.log',
    'youtube_server': 'logs/youtube_server.log',
    'tiktok_server': 'logs/tiktok_server.log',
    'browser_console': 'logs/browser_console.log',
    'native_console': 'logs/native_console.log',
    'web_console': 'logs/web_console.log'
}

def clean_old_log_backups(retention_days=RETENTION_DAYS):
    """logs_backup/ 内の指定日数（デフォルト7日）以上前の日付ログを自動クリーンアップ"""
    try:
        if not os.path.exists(LOG_BACKUP_DIR):
            return
        cutoff_time = time.time() - (retention_days * 86400)
        for fname in os.listdir(LOG_BACKUP_DIR):
            if re.search(r'_[0-9]{4}-[0-9]{2}-[0-9]{2}\.log$', fname):
                fpath = os.path.join(LOG_BACKUP_DIR, fname)
                if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff_time:
                    os.remove(fpath)
                    print(f"[LogCleanup] 🧹 7日以上前の古い日付ログを削除しました: {fname}")
    except Exception as e:
        print(f"[LogCleanupエラー]: {e}")

def _rotate_single_log(log_key, file_path, reason_label):
    """単一ログファイルを日付単位 (YYYY-MM-DD) で安全に追記・退避管理"""
    if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
        return
    if not os.path.exists(LOG_BACKUP_DIR):
        os.makedirs(LOG_BACKUP_DIR, exist_ok=True)
        
    date_str = datetime.date.today().strftime('%Y-%m-%d')
    backup_path = os.path.join(LOG_BACKUP_DIR, f"{log_key}_{date_str}.log")
        
    try:
        # 既存の日付バックアップがある場合は追記（時間単位の別ファイル乱立を完全防止）
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as src:
            content = src.read()
        with open(backup_path, 'a', encoding='utf-8') as dst:
            dst.write(content)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            f.write(f"[{now_str}] [SYSTEM] === Log initialized for {date_str} ===\n")
        print(f"[LogRotation] 📦 {log_key} のログを日付単位バックアップ ({os.path.basename(backup_path)}) に保存しました")
    except Exception as e:
        print(f"[LogRotationエラー {log_key}]: {e}")

def check_and_rotate_logs():
    """日付変更またはサイズ上限(10MB)超過時に全ログをローテーション"""
    global _current_log_date
    today_str = datetime.date.today().strftime('%Y-%m-%d')
    
    with _log_lock:
        is_date_changed = (today_str != _current_log_date)
        
        if is_date_changed:
            prev_date = _current_log_date
            print(f"[LogRotation] 📅 日付変更を検知 ({prev_date} -> {today_str})。全ログをバックアップ退避します。")
            for log_key, file_path in ALL_MANAGED_LOGS:
                _rotate_single_log(log_key, file_path, f"Date changed from {prev_date}")
            _current_log_date = today_str
            clean_old_log_backups(RETENTION_DAYS)
        else:
            for log_key, file_path in ALL_MANAGED_LOGS:
                if os.path.exists(file_path):
                    try:
                        if os.path.getsize(file_path) >= MAX_LOG_SIZE_BYTES:
                            _rotate_single_log(log_key, file_path, "Size > 10MB")
                    except Exception:
                        pass

def check_and_rotate_browser_log():
    """後方互換用ラッパー"""
    check_and_rotate_logs()

def start_log_rotation_scheduler():
    """定期的にログローテーションとクリーンアップをチェックするバックグラウンドスレッドを開始"""
    def _loop():
        time.sleep(2)
        check_and_rotate_logs()
        clean_old_log_backups(RETENTION_DAYS)
        while True:
            time.sleep(300)  # 5分毎にサイズ・日付変更を巡回チェック
            try:
                check_and_rotate_logs()
            except Exception:
                pass
    t = threading.Thread(target=_loop, daemon=True)
    t.start()

def log_to_api_file(message):
    try:
        check_and_rotate_logs()
        log_path = os.path.join(BASE_DIR, "logs", "api_server.log")
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, 'a', encoding='utf-8') as f:
            timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass

def write_browser_console_log(log_message, client_type="web"):
    """
    logs/browser_console.log (メインログ) に [NATIVE]/[SAFARI] タグ付きで全ログを確実に常時追記し、
    同時に専用ログ (native_console.log / web_console.log) および logs_backup/ にも保存
    """
    now = datetime.datetime.now()
    today_str = now.strftime('%Y-%m-%d')
    client_lower = str(client_type).lower() if client_type else "web"
    is_native = ("native" in client_lower) or ("[🖥️ NATIVE]" in log_message) or ("[🧭 NATIVE]" in log_message)
    prefix = "native_console" if is_native else "web_console"
    
    # タイムスタンプ [YYYY-MM-DD HH:MM:SS.mmm] が未付与の場合は自動補完
    formatted_msg = log_message
    if not (log_message.startswith("[20") or (log_message.startswith("[") and len(log_message) > 20 and log_message[5] == "-")):
        timestamp_str = now.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        formatted_msg = f"[{timestamp_str}] {log_message}"

    main_log_file = os.path.join(BASE_DIR, "logs", "browser_console.log")
    active_client_file = os.path.join(BASE_DIR, "logs", f"{prefix}.log")
    backup_file = os.path.join(BASE_DIR, "logs_backup", f"browser_console_{today_str}.log")
    backup_client_file = os.path.join(BASE_DIR, "logs_backup", f"{prefix}_{today_str}.log")

    if not os.path.exists(LOG_BACKUP_DIR):
        os.makedirs(LOG_BACKUP_DIR, exist_ok=True)
    if not os.path.exists(os.path.join(BASE_DIR, "logs")):
        os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)

    with _log_lock:
        try:
            # 1. logs/browser_console.log (メイン) に常に全ログを残す
            with open(main_log_file, 'a', encoding='utf-8') as f:
                f.write(formatted_msg + '\n')
            # 2. logs_backup/browser_console_YYYY-MM-DD.log にも日次保存
            with open(backup_file, 'a', encoding='utf-8') as f:
                f.write(formatted_msg + '\n')
            # 3. 各専用ファイルにも保存
            with open(active_client_file, 'a', encoding='utf-8') as f:
                f.write(formatted_msg + '\n')
            with open(backup_client_file, 'a', encoding='utf-8') as f:
                f.write(formatted_msg + '\n')
        except Exception as e:
            print(f"[ログ書き込みエラー]: {e}")


def read_log_file(name, lines=200):
    """指定されたログファイルを末尾から指定行取得"""
    if name not in LOG_FILES_MAP:
        return {"error": f"Unknown log name: {name}"}
    
    file_path = os.path.join(BASE_DIR, LOG_FILES_MAP[name])
    if not os.path.exists(file_path):
        return {"name": name, "lines": [], "path": file_path, "size": 0}
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
            tail_lines = [line.rstrip('\r\n') for line in all_lines[-lines:]]
            return {
                "name": name,
                "lines": tail_lines,
                "total_lines": len(all_lines),
                "path": file_path,
                "size": os.path.getsize(file_path)
            }
    except Exception as e:
        return {"error": str(e)}

def clear_log_file(name):
    """指定されたログファイルをクリア（バックアップ退避後に空にする）"""
    if name not in LOG_FILES_MAP:
        return {"error": f"Unknown log name: {name}"}
    
    file_path = os.path.join(BASE_DIR, LOG_FILES_MAP[name])
    if os.path.exists(file_path):
        try:
            _rotate_single_log(name, file_path, "manual_clear")
            with open(file_path, 'w', encoding='utf-8') as f:
                now_str = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S.000Z')
                f.write(f"[{now_str}] [SYSTEM] Log cleared by user\n")
            return {"success": True, "name": name}
        except Exception as e:
            return {"error": str(e)}
    return {"success": True, "name": name}
