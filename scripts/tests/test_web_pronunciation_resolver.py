#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_web_pronunciation_resolver.py
web_pronunciation_resolver の単体テスト。
Wikipedia API および DuckDuckGo による読み方自動解決と候補語抽出を検証します。
"""

import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
sys.path.insert(0, BASE_DIR)

from server.web_pronunciation_resolver import (
    fetch_wikipedia_ruby,
    search_duckduckgo_reading,
    extract_candidate_terms_from_text
)

def test_resolver():
    print("==================================================")
    print("🧪 Web読み方自動解決エンジン 単体テスト")
    print("==================================================")

    # 1. 候補語抽出テスト
    sample_news = "アイドルグループ乃木坂46のキャプテンや、F1で活躍する角田裕毅選手、新型iPhone16について取材した。"
    candidates = extract_candidate_terms_from_text(sample_news)
    print(f"📋 抽出された候補語: {candidates}")
    assert "乃木坂46" in candidates
    assert "角田裕毅" in candidates
    print("✅ 候補語抽出: PASS")

    # 2. Wikipedia 冒頭ルビ抽出テスト（取得のみテスト）
    print("🌐 Wikipediaルビ探索テスト: '乃木坂46'...")
    ruby = fetch_wikipedia_ruby("乃木坂46")
    print(f"   ➔ 結果: {ruby}")
    assert ruby is not None and ("フォーティーシックス" in ruby or "のぎざか" in ruby)
    print("✅ Wikipediaルビ探索: PASS")

    # 3. エンドツーエンド自動解決＆自動学習テスト
    from server.web_pronunciation_resolver import resolve_unknown_reading_online, PRONUNCIATION_MEMORY_PATH
    import json
    with open(PRONUNCIATION_MEMORY_PATH, "r", encoding="utf-8") as f:
        before_data = json.load(f)

    try:
        print("🧠 自動解決＆永続記憶テスト: '櫻坂46'...")
        # 一旦台帳から櫻坂46を除外した一時データでテスト
        temp_records = [r for r in before_data.get("records", []) if r.get("surface") != "櫻坂46"]
        with open(PRONUNCIATION_MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump({"version": "1.0", "records": temp_records}, f, ensure_ascii=False, indent=2)

        res_reading = resolve_unknown_reading_online("櫻坂46", auto_save=True)
        print(f"   ➔ 解決結果: {res_reading}")
        assert res_reading is not None and "さくらざか" in res_reading
        
        # 台帳に実際に書き込まれたか確認
        with open(PRONUNCIATION_MEMORY_PATH, "r", encoding="utf-8") as f:
            after_data = json.load(f)
        assert any(r.get("surface") == "櫻坂46" for r in after_data.get("records", []))
        print("✅ 自動記憶・ファイル永続化: PASS")
    finally:
        # 元に戻す
        with open(PRONUNCIATION_MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump(before_data, f, ensure_ascii=False, indent=2)
        print("🧹 テスト完了・状態復元完了")

    print("==================================================")
    print("🎯 全テスト完了: Web自動解決ロジックは正常に機能しています！")
    print("==================================================")

if __name__ == "__main__":
    test_resolver()
