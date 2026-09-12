#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
大文字英単語のスペル読み自動修復テスト
- GIRLS, KIDS, BAND, DANCE などの英単語が、字幕はそのまま、音声は自然な英単語発音に修復されること
- NHK, FBI, SNS, AI, USA, WHO などの略語が100%保護されること
"""
import sys
import os
import urllib.request
import urllib.parse
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from server.news_script_processor import audit_and_heal_news_script

def get_voicevox_kana(text):
    params = urllib.parse.urlencode({"text": text, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req, timeout=3) as res:
        return json.loads(res.read().decode("utf-8")).get("kana", "")

def test_audit_and_heal_english_spellout():
    print("=== audit_and_heal_news_script の大文字英単語スペル読み自動修復テスト ===")
    
    raw_items = [
        {
            "display": "人気のＧＩＲＬＳグループが最新アルバムを発表しましたにゃ！",
            "speech": "人気のGIRLSグループが最新アルバムを発表しましたにゃ！"
        },
        {
            "display": "イベントには多くのKIDSが集まり、DANCEを披露しましたにゃ。",
            "speech": "イベントには多くのKIDSが集まり、DANCEを披露しましたにゃ。"
        },
        {
            "display": "NHKの報道によると、USAとWHOが共同声明を発表しましたにゃ。",
            "speech": "NHKの報道によると、USAとWHOが共同声明を発表しましたにゃ。"
        },
        {
            "display": "SNS上でもAI技術を活用したPR動画が話題になっているにゃ！",
            "speech": "SNS上でもAI技術を活用したPR動画が話題になっているにゃ！"
        }
    ]

    healed = audit_and_heal_news_script(raw_items)
    
    print("\n【検証結果】")
    for orig, h in zip(raw_items, healed):
        disp = h["display"]
        sp = h["speech"]
        kana = get_voicevox_kana(sp)
        print(f"字幕 (display): {disp}")
        print(f"音声 (speech) : {sp}")
        print(f"VOICEVOXカナ  : {kana}")
        print("-" * 50)
        
    # 1. GIRLS: 字幕は全角ＧＩＲＬＳを維持、音声は Girls、カナは ガールズ
    assert "ＧＩＲＬＳ" in healed[0]["display"], "字幕は全角ＧＩＲＬＳを維持すべき"
    assert "Girls" in healed[0]["speech"], "音声はGirlsに修復されるべき"
    k0 = get_voicevox_kana(healed[0]["speech"])
    assert "ガアルズ" in k0.replace("'", ""), f"ガールズと発音されるべき: {k0}"
    assert "ジ'イアイ" not in k0, "スペル読みになってはいけません"

    # 2. KIDS & DANCE: 音声は Kids & Dance、カナは キッズ & ダンス
    assert "Kids" in healed[1]["speech"]
    assert "Dance" in healed[1]["speech"]
    k1 = get_voicevox_kana(healed[1]["speech"])
    assert "キッズ" in k1.replace("'", ""), f"キッズと発音されるべき: {k1}"
    assert "ダンス" in k1.replace("'", ""), f"ダンスと発音されるべき: {k1}"

    # 3. NHK, USA, WHO: 音声も略語のまま維持、カナも正しい略語読み
    assert "NHK" in healed[2]["speech"], "NHKは維持されるべき"
    assert "USA" in healed[2]["speech"], "USAは維持されるべき"
    assert "WHO" in healed[2]["speech"], "WHOは維持されるべき"
    k2 = get_voicevox_kana(healed[2]["speech"])
    assert "エヌエイチケイ" in k2.replace("'", ""), f"NHKはエヌエイチケイ: {k2}"
    assert "ユウエスエー" in k2.replace("'", "").replace("エエ", "エー"), f"USAはユウエスエー: {k2}"
    assert "ダブリュウエイチオオ" in k2.replace("'", ""), f"WHOはダブリューエイチオー: {k2}"

    # 4. SNS, AI, PR: 音声も略語のまま維持
    assert "SNS" in healed[3]["speech"]
    assert "AI" in healed[3]["speech"]
    assert "PR" in healed[3]["speech"]

    print("\n🎉 全ての大文字英単語自動修復＆略語保護テストに合格しました！")

if __name__ == "__main__":
    test_audit_and_heal_english_spellout()
