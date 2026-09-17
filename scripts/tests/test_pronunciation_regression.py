#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_pronunciation_regression.py
過去に誤読を起こした単語・表現の回帰防止テスト（リグレッションテスト）。
data/pronunciation_memory.json に登録された全レコードについて、
normalize_for_tts による正規化結果が正しい読みになり、かつ誤読文字列が含まれないかを検証します。
"""

import os
import sys
import json

# 親ディレクトリをモジュール検索パスに追加
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
sys.path.insert(0, BASE_DIR)

from server.tts_normalizer import normalize_for_tts, load_pronunciation_memory

def run_pronunciation_regression_tests():
    data = load_pronunciation_memory()
    records = data.get("records", [])
    
    if not records:
        print("⚠️ [警告] pronunciation_memory.json にテストレコードが存在しません。")
        return 0

    print(f"==================================================")
    print(f"📢 TTS誤読 回帰防止テストスイート（全 {len(records)} 件）")
    print(f"==================================================")

    passed_count = 0
    failed_count = 0

    for idx, rec in enumerate(records, 1):
        rec_id = rec.get("id", f"case_{idx}")
        surface = rec.get("surface", "")
        expected_reading = rec.get("reading", "")
        wrong_reading = rec.get("wrong_reading", "")
        sentence = rec.get("sample_sentence", surface)

        # normalize_for_tts を実行
        normalized = normalize_for_tts(sentence)

        # 検証1: 期待する読みが含まれているか
        has_expected = (expected_reading in normalized) or (surface in normalized and expected_reading == surface)
        # 検証2: 誤読文字列が含まれていないか
        has_wrong = bool(wrong_reading and wrong_reading in normalized)

        is_success = has_expected and not has_wrong

        if is_success:
            passed_count += 1
            print(f"✅ [{idx:02d}/{len(records):02d}] PASS: {surface} ➔ {expected_reading} (ID: {rec_id})")
        else:
            failed_count += 1
            print(f"❌ [{idx:02d}/{len(records):02d}] FAIL: {surface} (ID: {rec_id})")
            print(f"   入力例文: {sentence}")
            print(f"   正規化後: {normalized}")
            print(f"   期待読み: {expected_reading} (含まれるべき: {has_expected})")
            if wrong_reading:
                print(f"   誤読文字列: {wrong_reading} (含まれてはならない: {'含まれてしまっている' if has_wrong else '含まれていない'})")
            print("-" * 50)

    print("==================================================")
    print(f"🎯 テスト結果: 合計 {len(records)} 件 | 成功: {passed_count} 件 | 失敗: {failed_count} 件")
    print("==================================================")

    if failed_count > 0:
        return 1
    return 0

if __name__ == "__main__":
    exit_code = run_pronunciation_regression_tests()
    sys.exit(exit_code)
