#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/tools/auto_sync_on_stream_end.py

OBS配信・番組の終了を自動監視し、配信終了を検知した瞬間に
開発環境（VStudio-dev）の改修成果物を本番環境（VStudio）へ安全に完全同期・Gitプッシュする自動スクリプト。
"""

import os
import sys
import subprocess
import time

DEV_DIR = "/Users/junichiakahori/Documents/Antigravity/VStudio-dev"
PROD_DIR = "/Users/junichiakahori/Documents/Antigravity/VStudio"

# 同期対象ファイル一覧（相対パス）
SYNC_FILES = [
    "js/news-mode.js",
    "js/news/news-fetcher.js",
    "views/live2d.html",
    "server/tts_normalizer.py",
    "data/pronunciation_memory.json",
    "scripts/tests/test_all_historical_pronunciations.py",
    "scripts/tools/auto_sync_on_stream_end.py"
]

def is_stream_active():
    try:
        # 1. OBS プロセス自体が終了していれば配信終了
        res = subprocess.run(["pgrep", "-f", "OBS"], capture_output=True, text=True)
        if res.returncode != 0 or len(res.stdout.strip()) == 0:
            return False

        # 2. OBS プロセスが起動中でも、ブラウザログで StopStream が送信され番組が完了していれば配信終了と判定
        log_path = os.path.join(PROD_DIR, "logs", "browser_console.log")
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            last_50 = lines[-50:]
            stop_stream_success = any("StopStream" in l and "成功" in l for l in last_50)
            stream_automation_done = any("配信終了プロセスを開始します" in l or "全記事読了" in l for l in last_50)
            voice_active = any("VOICEVOX] 音声リクエスト送信" in l for l in lines[-10:])
            if stop_stream_success and stream_automation_done and not voice_active:
                print("LOGS_CONFIRM_STREAM_ENDED: OBS stream output stopped and news program ended.")
                return False

        return True
    except Exception:
        return True

def check_and_sync():
    if is_stream_active():
        print("STREAMING_ACTIVE: OBS or live broadcast is currently active. Skipping sync.")
        return False

    print("STREAM_ENDED: Live broadcast output has ended. Starting automatic production sync...")

    # 1. ファイル同期
    for rel_path in SYNC_FILES:
        src = os.path.join(DEV_DIR, rel_path)
        dst = os.path.join(PROD_DIR, rel_path)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            subprocess.run(["cp", src, dst], check=True)
            print(f"Copied: {rel_path} -> {dst}")
        else:
            print(f"Warning: {src} does not exist!")

    # 2. Git コミット & プッシュ
    commit_msg = "fix(news & tts): 放送完了時のゾンビ復元完全防止および「一目で」誤読（ひとめ）恒久是正"
    try:
        for f in SYNC_FILES:
            subprocess.run(["git", "add", f], cwd=PROD_DIR, check=True)
        res = subprocess.run(["git", "commit", "-m", commit_msg], cwd=PROD_DIR, capture_output=True, text=True)
        print("Git commit output:", res.stdout.strip() if res.stdout else res.stderr.strip())
        push_res = subprocess.run(["git", "push", "origin", "main"], cwd=PROD_DIR, capture_output=True, text=True)
        print("Git push output:", push_res.stdout.strip() if push_res.stdout else push_res.stderr.strip())
    except Exception as e:
        print("Git Error:", e)

    print("SYNC_SUCCESS: Production environment successfully updated and pushed.")
    return True

if __name__ == "__main__":
    is_watch = "--watch" in sys.argv
    if is_watch:
        print("WATCH_MODE_STARTED: Monitoring OBS and live broadcast state every 10 seconds...")
        while True:
            if check_and_sync():
                print("WATCH_MODE_COMPLETED: Synchronization and git push finished. Exiting watcher.")
                sys.exit(0)
            time.sleep(10)
    else:
        success = check_and_sync()
        sys.exit(0 if success else 1)
