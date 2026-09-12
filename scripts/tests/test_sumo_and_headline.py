# -*- coding: utf-8 -*-
import sys
import os
import re

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from server.news_script_processor import (
    audit_and_heal_news_script,
    validate_news_script_quality
)

def test_sumo_ring_healing():
    print("=== 🧪 Test 1: 相撲記事での「リング」➔「土俵」自己修復テスト ===")
    test_cases = [
        {
            "title": "大相撲秋場所 豊昇龍が初日白星",
            "article_context": "大関豊昇龍が力強い相撲を見せた。",
            "input": [
                {
                    "display": "豊昇龍関がリングに上がって見事な取組を見せました。",
                    "speech": "ほうしょうりゅうぜきがリングにあがってみごとなとりくみをみせました。"
                },
                {
                    "display": "これからのリング上での活躍にも期待したいですね。",
                    "speech": "これからのリングじょうでのかつやくにもきたいしたいですね。"
                }
            ]
        }
    ]

    for tc in test_cases:
        healed = audit_and_heal_news_script(tc["input"], title=tc["title"], article_context=tc["article_context"])
        for h in healed:
            print(f"  [修復後 字幕] {h['display']}")
            print(f"  [修復後 音声] {h['speech']}")
            assert "リング" not in h["display"], f"字幕にまだリングが残っています: {h['display']}"
            assert "リング" not in h["speech"] and "りんぐ" not in h["speech"], f"音声にまだリングが残っています: {h['speech']}"
            assert "土俵" in h["display"] or "どひょう" in h["speech"], "土俵への置換が確認できません"

    print("  ✅ 相撲記事での「リング」が「土俵」に綺麗に自動修復されました！")

def test_sumo_ring_validation():
    print("\n=== 🧪 Test 2: 相撲記事での「リング」バリデーションNGテスト ===")
    sample_text = (
        "【見出し】: 大相撲秋場所で熱戦が繰り広げられています\n"
        "大関豊昇龍が初日から見事な相撲を披露しました。\n"
        "力士たちの激しい取組に会場から大歓声が湧き起こりました。\n"
        "リング上での真剣勝負にとても感動したにゃ！\n"
        "今後の取組にも注目していきたいですね。"
    )
    ok, reason = validate_news_script_quality(sample_text, title="大相撲秋場所 豊昇龍白星", article_context="大相撲 秋場所 力士")
    print(f"  [バリデーション結果] 合格={ok}, 理由={reason}")
    assert not ok, "相撲でリングを使った原稿が合格してしまいました！"
    assert "土俵" in reason or "リング" in reason, f"理由にリング/土俵が含まれていません: {reason}"
    print("  ✅ 相撲記事での「リング」が確実に品質NGとして検知されました！")

def test_headline_ending_strip():
    print("\n=== 🧪 Test 3: 見出しからのキャラクター語尾（にゃ、のだ等）切除テスト ===")
    headlines = [
        "大相撲秋場所で豊昇龍が白星を飾ったにゃ！",
        "新型iPhoneがついに発表されたのだ",
        "都内で大規模なイベントが開催されたにゃ",
        "注目の新技術が公開されたそうですにゃ。"
    ]

    for hl in headlines:
        cleaned = re.sub(r'(?:です|だ|だった|された|した|ある|いる|なる|こと)?[\s　]*(?:とろろ)?(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', hl).strip()
        cleaned = re.sub(r'[\s　]*(?:にゃ|のだ|なのだ)[！!。？?\s　]*$', '', cleaned).strip()
        print(f"  [元見出し] '{hl}' ➔ [切除後] '{cleaned}'")
        assert not re.search(r'(?:にゃ|のだ)[！!。？?\s　]*$', cleaned), f"語尾が残っています: {cleaned}"

    print("  ✅ 見出し末尾から『にゃ』『のだ』が完全に切除されました！")

if __name__ == "__main__":
    test_sumo_ring_healing()
    test_sumo_ring_validation()
    test_headline_ending_strip()
    print("\n🎉 全テスト合格！")
