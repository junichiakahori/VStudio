#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_pronunciation_memory_api.py
pronunciation_memory の動的リロードおよび追加・更新機能の単体テスト
"""

import os
import sys
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
sys.path.insert(0, BASE_DIR)

from server.tts_normalizer import normalize_for_tts, load_pronunciation_memory, PRONUNCIATION_MEMORY_PATH

def test_dynamic_reload():
    print("🧪 誤読記憶台帳の動的リロード単体テスト開始...")
    
    # 既存データをバックアップ
    with open(PRONUNCIATION_MEMORY_PATH, "r", encoding="utf-8") as f:
        original_data = json.load(f)

    try:
        # 1. テスト用の一時レコードを追加
        test_word = "テスト用架空語XYZ"
        test_reading = "てすとようかくうごえっくすわいぜっと"
        
        test_data = dict(original_data)
        records = list(test_data.get("records", []))
        records.append({
            "id": "test_temp_entry",
            "surface": test_word,
            "reading": test_reading,
            "sample_sentence": f"これは{test_word}の検証です。",
            "category": "test"
        })
        test_data["records"] = records

        # ファイルに書き込み（mtime更新）
        time.sleep(0.05)
        with open(PRONUNCIATION_MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump(test_data, f, ensure_ascii=False, indent=2)

        # 2. normalize_for_tts を実行して即時反映されるか検証
        res = normalize_for_tts(f"本日のニュースでは{test_word}が取り上げられました。")
        assert test_reading in res, f"動的リロード失敗: {res}"
        print(f"✅ 動的リロード成功: '{test_word}' ➔ '{test_reading}' が即時反映されました！")

    finally:
        # バックアップから元に戻す
        with open(PRONUNCIATION_MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump(original_data, f, ensure_ascii=False, indent=2)
        print("🧹 テスト完了・ファイル復元完了")

if __name__ == "__main__":
    test_dynamic_reload()
