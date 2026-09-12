#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import urllib.parse
import json
import re

def get_voicevox_kana(text):
    params = urllib.parse.urlencode({"text": text, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=3) as res:
            return json.loads(res.read().decode("utf-8")).get("kana", "")
    except Exception as e:
        return f"Error: {e}"

test_cases = [
    # 単語として読みたい大文字英単語
    "GIRLS", "KIDS", "BAND", "DANCE", "KING", "QUEEN", "IDOL", "CAT", "DOG",
    # 略語として読みたい英単語
    "NHK", "FBI", "CIA", "SNS", "AI", "PR", "URL", "DX", "EV", "USA", "WHO"
]

print(f"{'単語':<8} | {'大文字の読み':<26} | {'Title-caseの読み':<20} | 判定")
print("-" * 75)

for word in test_cases:
    k_orig = get_voicevox_kana(word)
    k_title = get_voicevox_kana(word.capitalize())
    
    # 判定: 
    # もし大文字のときアルファベット1文字ずつのスペル読みになっていて、
    # Title-caseにすると英単語読み（モーラ数が大幅に減る、または自然になる）になるか
    # 例: GIRLS (ジ・イ・アイ・ア・アル・エル・エス = 12拍) ➔ Girls (ガ・ア・ル・ズ = 4拍)
    # 例: NHK (エヌエイチケイ) ➔ Nhk (エヌエイチケイ) 変化なし
    # 例: FBI (エフビーアイ) ➔ Fbi (エフビーアイ) 変化なし
    # 例: CAT (キャット = 3拍) ➔ Cat (キャット = 3拍)
    len_orig = len(k_orig.replace("/", "").replace("'", "").replace("_", ""))
    len_title = len(k_title.replace("/", "").replace("'", "").replace("_", ""))
    
    is_spellout_fixed = (len_orig >= len_title * 1.5)
    
    result_tag = "🌟 Title-caseで自動解決！" if is_spellout_fixed else "略語/通常読み（維持）"
    print(f"{word:<8} | {k_orig:<26} | {k_title:<20} | {result_tag}")
