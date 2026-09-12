#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
「上（うえ）」と「上（じょう）」のTTS読み分け・自己修復テスト
"""
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from server.tts_normalizer import normalize_for_tts
from server.news_script_processor import audit_and_heal_news_script

def test_tts_normalizer_ue_jyo():
    print("=== 1. normalize_for_tts の「上」読み分けテスト ===")
    
    # 1. X上 ➔ エックスじょう
    res1 = normalize_for_tts("X上で話題になっています。")
    print(f"[X上で] ➔ '{res1}'")
    assert "エックスじょう" in res1, f"X上はエックスじょうになるべきです: {res1}"

    # 2. X上では ➔ エックスじょうでは
    res2 = normalize_for_tts("X上では様々な意見が交わされているにゃ。")
    print(f"[X上では] ➔ '{res2}'")
    assert "エックスじょうでは" in res2

    # 3. ネット上 ➔ ネットじょう
    res3 = normalize_for_tts("ネット上でも反響が広がっているにゃ。")
    print(f"[ネット上でも] ➔ '{res3}'")
    assert "ネットじょうでも" in res3

    # 4. 検討した上で ➔ 検討したうえで
    res4 = normalize_for_tts("今後の動向を検討した上で判断するとのことだにゃ。")
    print(f"[検討した上で] ➔ '{res4}'")
    assert "検討したうえで" in res4

    # 5. 土俵の上で ➔ 土俵のうえで
    res5 = normalize_for_tts("土俵の上で熱戦が繰り広げられたにゃ。")
    print(f"[土俵の上で] ➔ '{res5}'")
    assert "土俵のうえで" in res5
    print("✅ normalize_for_tts テスト成功！")

def test_audit_and_heal_ue_jyo():
    print("\n=== 2. audit_and_heal_news_script の自己修復テスト ===")
    raw_items = [
        {
            "display": "公式サイトではイラストが公開され、X上で話題になりましたにゃ！",
            "speech": "公式サイトではイラストが公開され、X上で話題になりましたにゃ！"
        },
        {
            "display": "関係者と相談の上、最終決定を下す方針ですにゃ。",
            "speech": "関係者と相談の上、最終決定を下す方針ですにゃ。"
        },
        {
            "display": "土俵の上では力士たちの真剣勝負が続いているにゃ。",
            "speech": "土俵の上では力士たちの真剣勝負が続いているにゃ。"
        },
        {
            "display": "今後の発表に期待したいところだにゃ！",
            "speech": "今後の発表に期待したいところだにゃ！"
        }
    ]
    
    healed = audit_and_heal_news_script(raw_items)
    for orig, h in zip(raw_items, healed):
        print(f"表示 (disp)  : {h['display']}")
        print(f"音声 (speech): {h['speech']}")
    
    # 表示用は漢字の「X上」を維持
    assert "X上" in healed[0]["display"], "表示字幕は漢字を維持すべきです"
    # 音声用は「エックスじょう」に修復
    assert "エックスじょう" in healed[0]["speech"], f"音声はエックスじょうに修復されるべきです: {healed[0]['speech']}"
    print("✅ audit_and_heal 自己修復テスト成功！")

if __name__ == "__main__":
    test_tts_normalizer_ue_jyo()
    test_audit_and_heal_ue_jyo()
    print("\n🎉 全ての「上（うえ／じょう）」読み分け・自己修復テストに合格しました！")
