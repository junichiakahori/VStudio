# -*- coding: utf-8 -*-
"""
test_wrong_reading_healing.py
wrong_reading（誤読）と reading（正読）のペアによる自動検知・自己修復テスト
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from server.tts_normalizer import heal_sentence_reading, load_pronunciation_memory
from server.web_pronunciation_resolver import save_to_pronunciation_memory

def run_tests():
    passed = 0
    total = 0

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

    print("\n--- 1. 台帳wrong_reading駆動の誤読自己修復テスト ---")
    # 書類送検 (しょるいそうち -> しょるいそうけん)
    disp1 = "容疑者を書類送検したと発表しました。"
    spch1 = "容疑者をしょるいそうちしたと発表しました。"
    healed1 = heal_sentence_reading(disp1, spch1)
    assert_contains(healed1, "しょるいそうけん", "書類送検: しょるいそうち ➔ しょるいそうけん")
    assert_not_contains(healed1, "しょるいそうち", "書類送検: しょるいそうちが残っていない")

    # 麻生 (あそ -> あそう)
    disp2 = "麻生元首相が会談を行いました。"
    spch2 = "あそ元首相が会談を行いました。"
    healed2 = heal_sentence_reading(disp2, spch2)
    assert_contains(healed2, "あそう", "麻生: あそ ➔ あそう")
    assert_not_contains(healed2, "あそ元首相", "麻生: あそが残っていない")

    # 石油供給 (せきゆきゅう -> せきゆきょうきゅう)
    disp3 = "石油供給の安定化に向けた協議です。"
    spch3 = "せきゆきゅうの安定化に向けた協議です。"
    healed3 = heal_sentence_reading(disp3, spch3)
    assert_contains(healed3, "せきゆきょうきゅう", "石油供給: せきゆきゅう ➔ せきゆきょうきゅう")
    assert_not_contains(healed3, "せきゆきゅう", "石油供給: せきゆきゅうが残っていない")

    # 最終章 (さいしゅうあきら -> さいしゅうしょう)
    disp4 = "物語はいよいよ最終章を迎えます。"
    spch4 = "物語はいよいよさいしゅうあきらを迎えます。"
    healed4 = heal_sentence_reading(disp4, spch4)
    assert_contains(healed4, "さいしゅうしょう", "最終章: さいしゅうあきら ➔ さいしゅうしょう")
    assert_not_contains(healed4, "さいしゅうあきら", "最終章: さいしゅうあきらが残っていない")

    print("\n--- 2. wrong_readingペア保存テスト ---")
    save_to_pronunciation_memory(
        surface="テスト人物X",
        reading="てすとじんぶつエックス",
        wrong_reading="てすとひとばつ",
        note="ユニットテスト用",
        category="test"
    )
    pm = load_pronunciation_memory()
    matched = [r for r in pm.get("records", []) if r.get("surface") == "テスト人物X"]
    total += 1
    if matched and matched[0].get("wrong_reading") == "てすとひとばつ":
        print("  ✅ [PASS] wrong_reading が正しく台帳に永続化された")
        passed += 1
    else:
        print("  ❌ [FAIL] wrong_reading の永続化に失敗")

    # テスト人物Xの誤読修復
    disp5 = "テスト人物Xが登場しました。"
    spch5 = "てすとひとばつが登場しました。"
    healed5 = heal_sentence_reading(disp5, spch5)
    assert_contains(healed5, "てすとじんぶつエックス", "動的追加されたwrong_readingも修復される")

    print("\n--- 3. 同義語リダイレクト・型番企業名すり替え拒否テスト ---")
    from server.web_pronunciation_resolver import is_valid_reading_for_term
    total += 1
    if not is_valid_reading_for_term("F15", "ボーイング"):
        print("  ✅ [PASS] F15 ➔ ボーイング（企業名リダイレクト）が拒否される")
        passed += 1
    else:
        print("  ❌ [FAIL] F15 ➔ ボーイング が許可されてしまいました")

    total += 1
    if not is_valid_reading_for_term("農林水産", "だいいちじさんぎょう"):
        print("  ✅ [PASS] 農林水産 ➔ だいいちじさんぎょう（同義語リダイレクト）が拒否される")
        passed += 1
    else:
        print("  ❌ [FAIL] 農林水産 ➔ だいいちじさんぎょう が許可されてしまいました")

    total += 1
    if not is_valid_reading_for_term("女流", "じょせい"):
        print("  ✅ [PASS] 女流 ➔ じょせい（同義語リダイレクト）が拒否される")
        passed += 1
    else:
        print("  ❌ [FAIL] 女流 ➔ じょせい が許可されてしまいました")

    total += 1
    if is_valid_reading_for_term("F15", "エフじゅうご"):
        print("  ✅ [PASS] 正当な型番読み F15 ➔ エフじゅうご が許可される")
        passed += 1
    else:
        print("  ❌ [FAIL] F15 ➔ エフじゅうご が拒否されてしまいました")

    # クリーンアップ
    import json
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "pronunciation_memory.json")
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    d["records"] = [r for r in d.get("records", []) if r.get("surface") != "テスト人物X"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

    print(f"\n==========================================")
    print(f"結果: {passed} / {total} テスト通過")
    print(f"==========================================")
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(run_tests())
