# -*- coding: utf-8 -*-
"""
test_pronunciation_fixes.py
昨夜の配信で発生した誤読・誤字・キメラ分解の対策検証テスト
"""

import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from server.tts_normalizer import normalize_for_tts, heal_sentence_reading
from server.pronunciation_audit_service import PronunciationAuditService
from server.web_pronunciation_resolver import _extract_ruby_from_snippet, _extract_ruby_from_text, is_valid_reading_for_term

def run_tests():
    passed = 0
    total = 0

    def assert_eq(actual, expected, name):
        nonlocal passed, total
        total += 1
        if actual == expected:
            print(f"  ✅ [PASS] {name}: '{actual}'")
            passed += 1
        else:
            print(f"  ❌ [FAIL] {name}: 期待値 '{expected}' に対し 実際値 '{actual}'")

    def assert_contains(actual, expected_substr, name):
        nonlocal passed, total
        total += 1
        if expected_substr in actual:
            print(f"  ✅ [PASS] {name}: '{actual}' contains '{expected_substr}'")
            passed += 1
        else:
            print(f"  ❌ [FAIL] {name}: '{actual}' に '{expected_substr}' が含まれていません")

    def assert_not_contains(actual, unexpected_substr, name):
        nonlocal passed, total
        total += 1
        if unexpected_substr not in actual:
            print(f"  ✅ [PASS] {name}: '{actual}' does not contain '{unexpected_substr}'")
            passed += 1
        else:
            print(f"  ❌ [FAIL] {name}: '{actual}' に予期せぬ '{unexpected_substr}' が含まれています")

    print("\n--- 1. 書類送検の読み固定・ハルシネーション修復テスト ---")
    t1 = normalize_for_tts("警視庁は大林組の社員2人を書類送検したにゃ。")
    assert_contains(t1, "しょるいそうけん", "書類送検 ➔ しょるいそうけん")
    assert_not_contains(t1, "そうち", "書類送検に'そうち'が含まれない")

    # LLMが誤って「しょるいそうち」と生成した場合の自己修復
    display_sent = "警視庁は大林組の社員2人を業務上過失致死傷の疑いで書類送検したにゃ。"
    speech_sent = "警視庁は大林組の社員2人を業務上過失致死傷の疑いでしょるいそうちしたにゃ。"
    healed = heal_sentence_reading(display_sent, speech_sent)
    assert_contains(healed, "しょるいそうけん", "LLMハルシネーション'しょるいそうち'が'しょるいそうけん'に自己修復される")
    assert_not_contains(healed, "しょるいそうち", "自己修復後に'しょるいそうち'が残っていない")

    print("\n--- 2. ゲームタイトル「FF」ナンバリング＆ローマ数字テスト ---")
    t2_1 = normalize_for_tts("『FF7 リベレーション』の試遊が行われたにゃ。")
    assert_contains(t2_1, "エフエフセブン", "FF7 ➔ エフエフセブン")
    assert_not_contains(t2_1, "エフエフナナ", "FF7で'エフエフナナ'にならない")

    t2_2 = normalize_for_tts("2027年4月8日に発売される『FFVII リベレーション』の内容だにゃ。")
    assert_contains(t2_2, "エフエフセブン", "FFVII ➔ エフエフセブン")
    assert_not_contains(t2_2, "フヴィ", "FFVIIで'フヴィ'にならない")

    t2_3 = normalize_for_tts("FINAL FANTASY VIIの完全新作だにゃ。")
    assert_contains(t2_3, "ファイナルファンタジーセブン", "FINAL FANTASY VII ➔ ファイナルファンタジーセブン")

    t2_4 = normalize_for_tts("FF10とFF14とFF16も人気だにゃ。")
    assert_contains(t2_4, "エフエフテン", "FF10 ➔ エフエフテン")
    assert_contains(t2_4, "エフエフフォーティーン", "FF14 ➔ エフエフフォーティーン")
    assert_contains(t2_4, "エフエフシックスティーン", "FF16 ➔ エフエフシックスティーン")

    print("\n--- 3. 一般熟語・人名誤読防止（最終章、入境、裏日本）テスト ---")
    t3_1 = normalize_for_tts("セフィロスの行動も最終章ならではの緊張感があったにゃ。")
    assert_contains(t3_1, "さいしゅうしょう", "最終章 ➔ さいしゅうしょう")
    assert_not_contains(t3_1, "あきら", "最終章で'あきら'にならない")

    t3_2 = normalize_for_tts("香港に入境したということですにゃ。")
    assert_contains(t3_2, "にゅうきょう", "入境 ➔ にゅうきょう")
    assert_not_contains(t3_2, "いれきょう", "入境で'いれきょう'にならない")

    t3_3 = normalize_for_tts("裏日本を中心に大雨となる見込みだにゃ。")
    assert_contains(t3_3, "うらにほん", "裏日本 ➔ うらにほん")

    print("\n--- 4. Pronunciation Audit 英単語キメラ化防止テスト ---")
    audit = PronunciationAuditService()
    # 一般英単語 FINAL, CAFE が来ても略語破損修復がスキップされるか
    audit._inspect_line("[英単語発音修復] 🩹 'FINAL' ➔ 'Final'")
    audit._inspect_line("[英単語発音修復] 🩹 'CAFE' ➔ 'Cafe'")
    total += 1
    # tech_acronyms に FINAL や CAFE が中途半端なカナで入っていないことを検証
    from server.tts_normalizer import load_tts_rules
    rules = load_tts_rules().get("tech_acronyms", {})
    if rules.get("FINAL") != "エフアイエヌAL" and rules.get("CAFE") != "CAエフE":
        print("  ✅ [PASS] FINAL / CAFE がキメラ文字として tts_rules に登録されない")
        passed += 1
    else:
        print("  ❌ [FAIL] FINAL / CAFE がキメラ文字として登録されています")

    print("\n--- 5. Web自動解決 スニペットゴミ語句・注釈除外テスト ---")
    # 「のページです」を含むスニペット
    snippet_bad1 = "安住淳元のページです。読み方は（あずみじゅん）。"
    ruby1 = _extract_ruby_from_snippet("安住淳元", snippet_bad1)
    assert_eq(ruby1, None, "「のページです」を含むスニペットは除外される")

    # 「がもうちょっとで」を含むスニペット
    snippet_bad2 = "中竹春前の情報。読み方は「がもうちょっとで」分かります。"
    ruby2 = _extract_ruby_from_snippet("中竹春前", snippet_bad2)
    assert_eq(ruby2, None, "「がもうちょっとで」を含むスニペットは除外される")

    # Wikipediaの「もしくは」曖昧さ回避分離
    wiki_text = "news23（ニュースツーもしくはトゥースリー）は、TBS系列で放送されている報道番組である。"
    ruby_wiki = _extract_ruby_from_text("news23", wiki_text)
    assert_eq(ruby_wiki, "ニュースツー", "Wikipedia括弧内の「もしくは」以降が分離され先頭のみ抽出される")

    # バリデーションチェック
    assert_eq(is_valid_reading_for_term("安住淳元", "のページです"), False, "「のページです」は無効と判定される")
    assert_eq(is_valid_reading_for_term("X3", "スティレットの"), False, "英数字X3に対する「スティレットの」は無効と判定される")
    assert_eq(is_valid_reading_for_term("書類送検", "しょるいそうけん"), True, "「書類送検」➔「しょるいそうけん」は有効と判定される")

    print(f"\n==========================================")
    print(f"結果: {passed} / {total} テスト通過")
    print(f"==========================================")
    if passed == total:
        print("🎉 全テストに合格しました！")
        return 0
    else:
        print("⚠️ 一部テストが失敗しました。")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
