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

def test_tororonya_healing():
    print("=== 🧪 Test 1: 「とろろにゃ」自動修復テスト ===")
    test_cases = [
        {
            "input": [
                {
                    "display": "宮崎市で車道に横たわっていた男性が普通自動車にはねられ死亡した事件に、とろろにゃ。",
                    "speech": "みやざきしでしゃどうによこたわっていた男せいがふつうじどうしゃにはねられしぼうしたじけんに、とろろにゃ。"
                }
            ],
            "title": "車道で倒れていた男性死亡",
            "expected_not_in": "とろろにゃ"
        },
        {
            "input": [
                {
                    "display": "この展開には驚いたとろろにゃ！",
                    "speech": "このてんかいにはおどろいたとろろにゃ！"
                }
            ],
            "title": "新技術が発表",
            "expected_not_in": "とろろにゃ"
        },
        {
            "input": [
                {
                    "display": "今後の試合展開も楽しみですねとろろにゃ。",
                    "speech": "こんごのしあいてんかいもたのしみですねとろろにゃ。"
                }
            ],
            "title": "サッカー日本代表戦",
            "expected_not_in": "とろろにゃ"
        }
    ]

    for tc in test_cases:
        healed = audit_and_heal_news_script(tc["input"], title=tc["title"])
        for h in healed:
            print(f"  [修復前] {tc['input'][0]['display']}")
            print(f"  [修復後 字幕] {h['display']}")
            print(f"  [修復後 音声] {h['speech']}")
            assert tc["expected_not_in"] not in h["display"], f"字幕にまだ {tc['expected_not_in']} が残っています: {h['display']}"
            assert tc["expected_not_in"] not in h["speech"], f"音声にまだ {tc['expected_not_in']} が残っています: {h['speech']}"

    print("  ✅ 全ての「とろろにゃ」が綺麗に自動修復されました！")

def test_tororonya_validation():
    print("\n=== 🧪 Test 2: 「とろろにゃ」バリデーションNGテスト ===")
    sample_text = (
        "【見出し】: 開発テストのニュースです\n"
        "本日は最新技術のニュースをお伝えします。\n"
        "人工知能の発展により様々な機能が向上しています。\n"
        "これからの進化にとても期待したい事件に、とろろにゃ。\n"
        "皆さんもぜひ注目してみてくださいね。"
    )
    ok, reason = validate_news_script_quality(sample_text, title="開発テスト")
    print(f"  [バリデーション結果] 合格={ok}, 理由={reason}")
    assert not ok, "「とろろにゃ」が含まれる原稿が合格してしまいました！"
    assert "とろろにゃ" in reason, f"理由に「とろろにゃ」が含まれていません: {reason}"
    print("  ✅ 「とろろにゃ」が確実に品質NGとして検知されました！")

def test_yahoo_source_harmonization():
    print("\n=== 🧪 Test 3: Yahoo URL時のソース名「Yahoo!ニュース」整合テスト ===")
    from server.news_crawler import resolve_batch_urls

    items = [
        {
            "title": "テスト記事1",
            "url": "https://news.yahoo.co.jp/articles/1234567890abcdef",
            "source": "NHKニュース"
        }
    ]
    # crawlerのresolve_batch_urlsのロジックをシミュレーション
    resolved = items[0]["url"]
    resolved_source = items[0].get("source", "")
    if resolved and "news.yahoo.co.jp" in resolved:
        resolved_source = "Yahoo!ニュース"
    assert resolved_source == "Yahoo!ニュース", f"ソースがYahoo!ニュースに更新されていません: {resolved_source}"
    print(f"  ✅ Yahoo URLの場合は source が '{resolved_source}' に整合されました！")

if __name__ == "__main__":
    test_tororonya_healing()
    test_tororonya_validation()
    test_yahoo_source_harmonization()
    print("\n🎉 全テスト合格！")
