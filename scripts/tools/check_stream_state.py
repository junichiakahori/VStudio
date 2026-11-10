#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_stream_state.py - 配信状態（配信中フラグ）の確認・判定ユーティリティ

本番アプリが常駐起動している環境下において、現在実際に配信中・番組進行中であるかを判定します。
AIエージェントや自動化スクリプトが、配信中のサーバー再起動やファイル破壊を100%遮断するために使用します。

【判定ロジック】
- data/stream_state.json の "is_streaming" を検査
- is_streaming が True の場合:
    終了コード 1 (STREAM_ACTIVE: 配信中)
- is_streaming が False の場合:
    終了コード 0 (STREAM_INACTIVE: 待機中 / 停止中)

【使用例】
$ python3 scripts/tools/check_stream_state.py
$ python3 scripts/tools/check_stream_state.py --env prod
$ python3 scripts/tools/check_stream_state.py --json
$ python3 scripts/tools/check_stream_state.py --set true --type news
"""

import os
import sys
import json
import argparse
from datetime import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))

# 本番環境パス（標準構成）
PROD_PROJECT_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, "..", "VStudio"))

def get_state_file_path(env="auto"):
    """環境に応じた stream_state.json のパスを解決"""
    if env == "prod":
        return os.path.join(PROD_PROJECT_ROOT, "data", "stream_state.json")
    elif env == "dev":
        return os.path.join(PROJECT_ROOT, "data", "stream_state.json")
    else: # auto
        local_path = os.path.join(PROJECT_ROOT, "data", "stream_state.json")
        return local_path

def load_state(file_path):
    """状態ファイルを安全に読み込む"""
    if not os.path.exists(file_path):
        return {
            "is_streaming": False,
            "stream_type": "none",
            "updated_at": "",
            "details": {
                "obs_streaming": False,
                "news_running": False,
                "radio_running": False
            }
        }
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to read stream state from {file_path}: {e}", file=sys.stderr)
        return {
            "is_streaming": False,
            "stream_type": "error",
            "error": str(e)
        }

def save_state(file_path, state):
    """状態ファイルを安全に保存する"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    temp_path = file_path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(temp_path, file_path)

def main():
    parser = argparse.ArgumentParser(description="配信状態フラグの確認・判定ユーティリティ")
    parser.add_argument("--env", choices=["auto", "dev", "prod"], default="auto", help="対象環境 (dev, prod, auto)")
    parser.add_argument("--json", action="store_true", help="JSON形式で出力")
    parser.add_argument("--quiet", action="store_true", help="出力を抑制し終了コードのみ返す")
    parser.add_argument("--set", choices=["true", "false"], help="配信フラグを強制更新")
    parser.add_argument("--type", default="manual", help="--set 指定時の stream_type (news, radio, obs, etc.)")

    args = parser.parse_args()
    file_path = get_state_file_path(args.env)

    if args.set is not None:
        new_is_streaming = (args.set == "true")
        state = load_state(file_path)
        state["is_streaming"] = new_is_streaming
        state["stream_type"] = args.type if new_is_streaming else "none"
        state["updated_at"] = datetime.now().isoformat()
        if "details" not in state:
            state["details"] = {}
        if not new_is_streaming:
            state["details"]["obs_streaming"] = False
            state["details"]["news_running"] = False
            state["details"]["radio_running"] = False
        save_state(file_path, state)
        if not args.quiet:
            print(f"[SET] Updated {file_path}: is_streaming={new_is_streaming}, type={state['stream_type']}")
        sys.exit(0)

    state = load_state(file_path)
    is_streaming = state.get("is_streaming", False)

    if args.json:
        print(json.dumps(state, ensure_ascii=False, indent=2))
    elif not args.quiet:
        status_text = "STREAM_ACTIVE" if is_streaming else "STREAM_INACTIVE"
        stream_type = state.get("stream_type", "none")
        updated_at = state.get("updated_at", "unknown")
        details = state.get("details", {})
        print(f"[{status_text}] Target: {file_path}")
        print(f"  is_streaming : {is_streaming}")
        print(f"  stream_type  : {stream_type}")
        print(f"  updated_at   : {updated_at}")
        print(f"  details      : {details}")

    # 判定結果に応じた終了コード
    # 配信中なら exit 1, 待機・停止中なら exit 0
    sys.exit(1 if is_streaming else 0)

if __name__ == "__main__":
    main()
