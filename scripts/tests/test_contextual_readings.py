#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文脈依存語句（中条、金、上で）の自己修復および正規化テスト
- 中条: 「なかじょう」と発音（VOICEVOXの「ちゅうじょう」誤読防止）
- 金: お金文脈では「かね」、金メダル等は「きん」
- 上で: 動詞＋「上で」は「うえで」、ネット上等は「じょう」
"""
import sys
import os
import urllib.request
import urllib.parse
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from server.news_script_processor import audit_and_heal_news_script
from server.tts_normalizer import normalize_for_tts

def get_voicevox_kana(text):
    params = urllib.parse.urlencode({"text": text, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode("utf-8")).get("kana", "")

def test_contextual_readings():
    print("=== 文脈依存語句（中条、金、上で）の自己修復＆発音テスト ===")
    
    raw_items = [
        {
            "display": "中条あやみさんが鈴木亮平さんとの共演を語ったにゃ。",
            "speech": "中条あやみさんが鈴木亮平さんとの共演を語ったにゃ。"
        },
        {
            "display": "中条さんは今までで一番強烈なインパクトだったと明かしたにゃ。",
            "speech": "中条さんは今までで一番強烈なインパクトだったと明かしたにゃ。"
        },
        {
            "display": "少年グループが難癖をつけ、金を要求した疑いがあるにゃ。",
            "speech": "少年グループが難癖をつけ、金を要求した疑いがあるにゃ。"
        },
        {
            "display": "この状況は火山活動を予測する上で重要なんだにゃ。",
            "speech": "この状況は火山活動を予測する上で重要なんだにゃ。"
        },
        {
            "display": "ネット上でも金メダル獲得を祝福する声が広がっているにゃ！",
            "speech": "ネット上でも金メダル獲得を祝福する声が広がっているにゃ！"
        }
    ]

    healed = audit_and_heal_news_script(raw_items)
    
    # 1. 中条あやみさん: 字幕は漢字維持、音声は「なかじょうあやみさん」
    assert "中条あやみ" in healed[0]["display"], "字幕は漢字を維持"
    assert "なかじょうあやみ" in healed[0]["speech"], "音声は「なかじょう」に修復"
    kana0 = get_voicevox_kana(normalize_for_tts(healed[0]["speech"]))
    clean_k0 = kana0.replace("'", "").replace("/", "").replace("ジョオ", "ジョウ")
    assert "ナカジョウ" in clean_k0, f"なかじょうと発音されるべき: {kana0}"
    assert "チュウジョウ" not in clean_k0, "ちゅうじょうと誤読してはいけません"

    # 2. 中条さん: 字幕は漢字維持、音声は「なかじょうさん」
    assert "中条さん" in healed[1]["display"], "字幕は漢字を維持"
    assert "なかじょうさん" in healed[1]["speech"], "音声は「なかじょう」に修復"
    kana1 = get_voicevox_kana(normalize_for_tts(healed[1]["speech"]))
    clean_k1 = kana1.replace("'", "").replace("/", "").replace("ジョオ", "ジョウ")
    assert "ナカジョウ" in clean_k1, f"なかじょうと発音されるべき: {kana1}"
    assert "チュウジョウ" not in clean_k1, "ちゅうじょうと誤読してはいけません"

    # 3. 金を要求: 字幕は漢字維持、音声は「かねを要求」
    assert "金を要求" in healed[2]["display"], "字幕は漢字を維持"
    assert "かねを要求" in healed[2]["speech"], "音声は「かね」に修復"
    kana2 = get_voicevox_kana(normalize_for_tts(healed[2]["speech"]))
    clean_k2 = kana2.replace("'", "").replace("/", "")
    assert "カネオ" in clean_k2, f"かねをと発音されるべき: {kana2}"
    assert "キンオ" not in clean_k2, "きんをと誤読してはいけません"

    # 4. 予測する上で: 字幕は漢字維持、音声は「予測するうえで」
    assert "予測する上で" in healed[3]["display"], "字幕は漢字を維持"
    assert "予測するうえで" in healed[3]["speech"], "音声は「うえで」に修復"
    kana3 = get_voicevox_kana(normalize_for_tts(healed[3]["speech"]))
    clean_k3 = kana3.replace("'", "").replace("/", "")
    assert "ウエデ" in clean_k3, f"うえでと発音されるべき: {kana3}"
    assert "ジョウデ" not in clean_k3, "じょうでと誤読してはいけません"

    # 5. ネット上（じょう）＆金メダル（きん）: それぞれ「じょう」「きん」を正しく維持
    assert "ネット上" in healed[4]["display"]
    assert "金メダル" in healed[4]["display"]
    kana4 = get_voicevox_kana(normalize_for_tts(healed[4]["speech"]))
    clean_k4 = kana4.replace("'", "").replace("/", "").replace("ジョオ", "ジョウ")
    assert "ネットジョウ" in clean_k4, f"ネットじょうと発音されるべき: {kana4}"
    assert "キンメダル" in clean_k4, f"きんメダルと発音されるべき: {kana4}"

    print("🎉 全ての文脈依存語句（中条、金、上で）の自己修復＆発音テストに合格しました！")

if __name__ == "__main__":
    test_contextual_readings()
