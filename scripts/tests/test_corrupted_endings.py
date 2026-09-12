#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
破損語尾（「みんないゃにゃ」「てみんないゃにゃ」「いゃにゃ」等）の検知・自動修復テスト
"""
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from server.news_script_processor import (
    validate_news_script_quality,
    audit_and_heal_news_script
)

def test_validation():
    print("=== 1. validate_news_script_quality テスト ===")
    bad_text = (
        "気象庁はエルニーニョ現象の発生について最新の監視速報を発表したにゃ。"
        "エルニーニョ現象は世界中の気候変動や日本の季節風に大きな影響を与えることが知られているんだにゃ。"
        "だから気象関連のニュースはいつも注目してみんないゃにゃ。"
        "日頃から環境に優しい行動を心がけてみんないゃにゃ！"
        "今後の動向をしっかり見守っていきたいところだにゃ。"
    )
    is_valid, reason = validate_news_script_quality(bad_text)
    print(f"破損語尾テキスト判定: valid={is_valid}, reason={reason}")
    assert not is_valid, "破損語尾テキストはNG判定されるべきです"
    assert "破損した語尾" in reason or "不自然な二重語尾" in reason, f"予期せぬ理由: {reason}"
    print("✅ バリデーションNG検知テスト成功！")

def test_audit_and_heal():
    print("\n=== 2. audit_and_heal_news_script テスト ===")
    raw_items = [
        {
            "display": "気象関連のニュースはいつも注目してみんないゃにゃ。",
            "speech": "気象関連のニュースはいつも注目してみんないゃにゃ。"
        },
        {
            "display": "環境に優しい行動を心がけてみんないゃにゃ！",
            "speech": "環境に優しい行動を心がけてみんないゃにゃ！"
        },
        {
            "display": "これからの季節も楽しく過ごしたいいゃにゃ。",
            "speech": "これからの季節も楽しく過ごしたいいゃにゃ。"
        }
    ]
    
    healed = audit_and_heal_news_script(raw_items)
    for orig, h in zip(raw_items, healed):
        print(f"元テキスト: {orig['display']}")
        print(f"修復後 (disp): {h['display']}")
        print(f"修復後 (speech): {h['speech']}")
        assert "みんないゃにゃ" not in h["display"]
        assert "みんないゃにゃ" not in h["speech"]
        assert "いゃにゃ" not in h["display"]
        assert "いゃにゃ" not in h["speech"]
    
    assert "注目してみてほしいにゃ" in healed[0]["display"]
    assert "心がけてみてほしいにゃ" in healed[1]["display"]
    assert "過ごしたいにゃ" in healed[2]["display"]
    print("✅ audit_and_heal 自己修復テスト成功！")

if __name__ == "__main__":
    test_validation()
    test_audit_and_heal()
    print("\n🎉 全ての破損語尾防止テストに合格しました！")
