# -*- coding: utf-8 -*-
"""
test_reading_healing_and_guards.py
誤読自動再チェック・自己修復（Auto-Healing）およびWikipedia過剰展開防止ガードの単体テスト
"""

import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from server.tts_normalizer import (
    lookup_wikipedia_reading,
    is_plausible_reading,
    heal_sentence_reading,
    normalize_for_tts,
)
from server.news_script_processor import (
    audit_and_heal_news_script,
)

def run_tests():
    print("=== [Test 1] is_plausible_reading の判定精度テスト ===")
    cases_plausible = [
        ("一時閉鎖", "すもうべや", False),
        ("運用", "じょうば", False),
        ("横開き", "ふながこい", False),
        ("快挙", "おりこん", False),
        ("約1", "えむわんぐらんぷり", False),
        ("那覇空港", "なはくうこう", True),
        ("大谷翔平", "おおたにしょうへい", True),
        ("油圧系統", "ゆあつしすてむ", True),
        ("角田裕毅", "つのだゆうき", True),
        ("F15", "えふじゅうご", True),
    ]
    for term, yomi, expected in cases_plausible:
        actual = is_plausible_reading(term, yomi)
        assert actual == expected, f"Failed: {term} -> {yomi}: expected {expected}, got {actual}"
        print(f"  ✅ {term} -> {yomi}: plausible={actual} (expected {expected})")

    print("\n=== [Test 2] Wikipedia 読み取得でのタイトル一致ガード ===")
    # 一時閉鎖・横開きが無関係な記事（相撲部屋、舟囲い等）に化けないことを検証
    y_close, _ = lookup_wikipedia_reading("一時閉鎖")
    assert y_close is None, f"Expected None for 一時閉鎖, got {y_close}"
    print(f"  ✅ '一時閉鎖' ➔ {y_close} (無関係な相撲部屋等への誤爆を完全遮断)")

    y_open, _ = lookup_wikipedia_reading("横開き")
    assert y_open is None, f"Expected None for 横開き, got {y_open}"
    print(f"  ✅ '横開き' ➔ {y_open} (無関係な舟囲い等への誤爆を完全遮断)")

    y_airport, _ = lookup_wikipedia_reading("那覇空港")
    assert y_airport == "なはくうこう", f"Expected なはくうこう, got {y_airport}"
    print(f"  ✅ '那覇空港' ➔ '{y_airport}' (正統な固有名詞は正常に解決)")

    print("\n=== [Test 3] heal_sentence_reading による異常置換の自動ロールバック ===")
    cases_heal = [
        (
            "那覇空港の第2滑走路が一時閉鎖されたんだにゃ。",
            "なはくうこうの第2滑走路がすもうべやされたんだにゃ。",
            "なはくうこうの第2滑走路が一時閉鎖されたんだにゃ。"
        ),
        (
            "約1時間後には運用が再開されたんだにゃ。",
            "えむわんぐらんぷり時間後にはじょうばが再開されたんだにゃ。",
            "約1時間後には運用が再開されたんだにゃ。"
        ),
        (
            "他社の最新横開きモデル",
            "他社の最新ふながこいモデル",
            "他社の最新横開きモデル"
        ),
        (
            "通算２５０セーブを達成した。",
            "通算あんだセーブを達成した。",
            "通算２５０セーブを達成した。"
        ),
    ]
    for disp, sp, expected in cases_heal:
        healed = heal_sentence_reading(disp, sp)
        assert healed == expected, f"Failed: expected '{expected}', got '{healed}'"
        print(f"  ✅ 治癒成功: '{sp}' ➔ '{healed}'")

    print("\n=== [Test 4] audit_and_heal_news_script による敬称・文脈自動修復 ===")
    # ケースA: 非スポーツ記事での「選手」誤爆 ➔ 「さん」へ自動修正
    items_non_sports = [
        {"display": "OpenAIのアルトマン選手が発表したにゃ。", "speech": "OpenAIのアルトマン選手が発表したにゃ。"},
        {"display": "最新のスマートフォン価格さんが値上がりしたにゃ。", "speech": "最新のスマートフォン価格さんが値上がりしたにゃ。"},
        {"display": "中国さんが新しい政策を発表したにゃ。", "speech": "中国さんが新しい政策を発表したにゃ。"}
    ]
    healed_non_sports = audit_and_heal_news_script(items_non_sports, title="OpenAIの新AIモデル発表", article_context="IT技術に関する最新動向")
    assert "アルトマンさん" in healed_non_sports[0]["display"], f"アルトマン選手が修正されていません: {healed_non_sports[0]['display']}"
    assert "価格が" in healed_non_sports[1]["display"], f"価格さんが修正されていません: {healed_non_sports[1]['display']}"
    assert "中国が" in healed_non_sports[2]["display"], f"中国さんが修正されていません: {healed_non_sports[2]['display']}"
    print(f"  ✅ 非スポーツ記事での選手誤爆修復: {healed_non_sports[0]['display']}")
    print(f"  ✅ 価格さん誤爆除去: {healed_non_sports[1]['display']}")
    print(f"  ✅ 中国さん誤爆除去: {healed_non_sports[2]['display']}")

    # ケースB: スポーツ記事での「選手」は正常に維持
    items_sports = [
        {"display": "巨人のマルティネス選手が通算250セーブを達成したにゃ。", "speech": "巨人のマルティネス選手が通算250セーブを達成したにゃ。"}
    ]
    healed_sports = audit_and_heal_news_script(items_sports, title="マルティネス選手 通算250セーブ達成", article_context="プロ野球 巨人対中日の試合")
    assert "マルティネス選手" in healed_sports[0]["display"], f"マルティネス選手が誤修正されました: {healed_sports[0]['display']}"
    print(f"  ✅ スポーツ記事での選手維持: {healed_sports[0]['display']}")

    print("\n🎉 すべての誤読再チェック・自己修復テストに合格しました！")

if __name__ == "__main__":
    run_tests()
