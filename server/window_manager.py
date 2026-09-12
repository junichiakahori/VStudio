# -*- coding: utf-8 -*-
"""
window_manager.py
macOS サブウィンドウ（ウィザード・ニュース一覧等）の最前面化・フォーカス管理モジュール
"""

import os
import subprocess
import logging

logger = logging.getLogger("WindowManager")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def is_dev_environment() -> bool:
    """現在のサーバーが開発環境(VStudio-dev)かどうか判定"""
    return "dev" in os.path.basename(BASE_DIR).lower() or "-dev" in BASE_DIR.lower()

def bring_subwindow_to_front(win_type: str) -> bool:
    """
    指定された種類のサブウィンドウ（news_list または wizard）を macOS 上で最前面に引き上げる
    - 開発環境時は 'VStudio Dev' のみ対象（本番 'VStudio' は絶対に触らない）
    - 本番環境時は 'VStudio' のみ対象（開発 'VStudio Dev' は絶対に触らない）
    - 該当ウィンドウの存在を確認してから前面化（無関係なアプリ前面化事故を完全防止）
    """
    target_keyword = ""
    if win_type == "news_list":
        target_keyword = "ニュース一覧"
    elif win_type == "wizard":
        target_keyword = "ウィザード"
    else:
        return False

    is_dev = is_dev_environment()
    target_app = "VStudio Dev" if is_dev else "VStudio"

    # AppleScript: 該当ウィンドウが存在する場合にのみ frontmost と AXRaise を実行
    script = f'''
    tell application "System Events"
        if exists (process "{target_app}") then
            tell process "{target_app}"
                repeat with w in windows
                    if name of w contains "{target_keyword}" then
                        set frontmost to true
                        perform action "AXRaise" of w
                        return true
                    end if
                end repeat
            end tell
        end if
    end tell
    return false
    '''

    try:
        proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=2)
        success = "true" in proc.stdout.lower()
        if success:
            logger.info(f"✅ サブウィンドウ [{win_type}: {target_keyword}] を最前面に引き上げました ({target_app})")
        return success
    except Exception as e:
        logger.warning(f"⚠️ サブウィンドウ最前面化でエラー: {e}")
        return False

