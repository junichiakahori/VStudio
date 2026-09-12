#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VTuber・タレント固有名詞の自己修復および発音解決テスト
- 星街すいせい / 星街: 字幕は漢字維持、音声は「ほしまち」に自動修復
- 宝鐘マリン 等の漢字＋かな混在名: Wikipedia動的解決で正しく読まれること
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
    with urllib.request.urlopen(req, timeout=3) as res:
        return json.loads(res.read().decode("utf-8")).get("kana", "")

def test_vtuber_name_healing():
    print("=== VTuber・固有名詞の自己修復＆発音解決テスト ===")
    
    raw_items = [
        {
            "display": "人気VTuberの星街すいせいさんが新曲を発表したにゃ！",
            "speech": "人気VTuberの星街すいせいさんが新曲を発表したにゃ！"
        },
        {
            "display": "星街さんの日本武道館ライブが大成功を収めたにゃ。",
            "speech": "星街さんの日本武道館ライブが大成功を収めたにゃ。"
        },
        {
            "display": "宝鐘マリンさんや兎田ぺこらちゃんも祝福したにゃ！",
            "speech": "宝鐘マリンさんや兎田ぺこらちゃんも祝福したにゃ！"
        },
        {
            "display": "今後のさらなる活躍に期待が高まるにゃ。",
            "speech": "今後のさらなる活躍に期待が高まるにゃ。"
        }
    ]

    healed = audit_and_heal_news_script(raw_items)
    
    # 1. 星街すいせい: 字幕は「星街すいせい」を維持、音声は「ほしまちすいせい」
    assert "星街すいせい" in healed[0]["display"], "字幕は漢字表記を維持すべき"
    assert "ほしまちすいせい" in healed[0]["speech"], "音声はほしまちに修復されるべき"
    kana0 = get_voicevox_kana(normalize_for_tts(healed[0]["speech"]))
    clean_k0 = kana0.replace("'", "").replace("/", "")
    assert "ホシマチ" in clean_k0, f"ほしまちと発音されるべき: {kana0}"
    assert "ホシガイ" not in clean_k0, "ほしがいと誤読してはいけません"

    # 2. 星街さん: 字幕は「星街さん」を維持、音声は「ほしまちさん」
    assert "星街さん" in healed[1]["display"], "字幕は漢字表記を維持すべき"
    assert "ほしまちさん" in healed[1]["speech"], "音声はほしまちに修復されるべき"
    kana1 = get_voicevox_kana(normalize_for_tts(healed[1]["speech"]))
    clean_k1 = kana1.replace("'", "").replace("/", "")
    assert "ホシマチ" in clean_k1, f"ほしまちと発音されるべき: {kana1}"
    assert "ホシガイ" not in clean_k1, "ほしがいと誤読してはいけません"

    # 3. 宝鐘マリン: Wikipedia解決で「ほうしょうまりん」
    kana2 = get_voicevox_kana(normalize_for_tts(healed[2]["speech"]))
    clean_k2 = kana2.replace("'", "").replace("/", "")
    assert "ホオショウマリン" in clean_k2, f"ほうしょうまりんと発音されるべき: {kana2}"

    print("🎉 全てのVTuber・固有名詞の自己修復＆発音解決テストに合格しました！")

if __name__ == "__main__":
    test_vtuber_name_healing()
