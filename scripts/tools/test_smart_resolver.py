#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
大文字英語のスマートな読み分け検証
"""
import urllib.request
import urllib.parse
import json
import re

# 既知の代表的な略語・頭字語（スペル読みまたは特定読みするもの）
KNOWN_ACRONYMS = {
    "NHK", "FBI", "CIA", "SNS", "AI", "PR", "URL", "DX", "EV", "OS", "UI", "UX",
    "API", "CPU", "GPU", "PC", "TV", "SSD", "HDD", "USB", "NFT", "TGS", "RPG",
    "FPS", "MMO", "VR", "AR", "USA", "UK", "WHO", "UN", "EU", "NATO", "IMF",
    "OECD", "GDP", "GNP", "CEO", "COO", "CFO", "CTO", "CIO", "CM", "PV", "MV",
    "BGM", "SE", "MC", "DJ", "CD", "DVD", "BD", "SD", "IC", "ID", "IT", "IP",
    "LTE", "SIM", "PIN", "QR", "SNS", "VIP", "PTA", "JAL", "ANA", "JR", "NPO",
    "NGO", "JRA", "NPB", "JFA", "Bリーグ", "WBC", "FIFA", "IOC", "JOC"
}

def get_voicevox_kana(text):
    params = urllib.parse.urlencode({"text": text, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=3) as res:
            return json.loads(res.read().decode("utf-8")).get("kana", "")
    except Exception as e:
        return f"Error: {e}"

def resolve_english_reading(word):
    """
    ダブルチェック用の安全な英単語発音リゾルバー
    - 既知の略語（NHK, SNS, AI, USA, WHO等）は絶対にいじらない
    - 2文字以下の英字（AI, PR, EV等）もいじらない
    - 3文字以上で母音を含み、Title-caseにするとVOICEVOXが自然な英単語読みになるもののみ、Title-caseを採用する
    """
    upper = word.upper()
    if upper in KNOWN_ACRONYMS or len(word) <= 2:
        return word # 略語のまま
        
    # 母音（A, I, U, E, O, Y）を含まないものは頭字語の可能性が極めて高い（例: BBC, CNN, KFC, DMM 等）
    if not re.search(r'[AIUEOYaiueoy]', word):
        return word

    # VOICEVOXで大文字とTitle-caseの読みをテスト
    k_orig = get_voicevox_kana(upper)
    title_word = word.capitalize()
    k_title = get_voicevox_kana(title_word)

    # もし大文字だと1文字ずつのスペル読み（ジ'イアイアアルエルエスなど）になっており、
    # Title-caseにすると英単語読み（モーラ数が大幅に減少し、アルファベット読みでなくなる）場合
    # スペル読み特有の長い拍数（文字数の2倍以上）を比較
    mora_orig = len(k_orig.replace("/", "").replace("'", "").replace("_", ""))
    mora_title = len(k_title.replace("/", "").replace("'", "").replace("_", ""))

    if mora_orig >= len(word) * 2 and mora_title < mora_orig * 0.7:
        # Title-caseで劇的に自然な英単語になる
        return title_word

    return word

test_words = [
    # 英単語（Title-caseで読ませたい）
    "GIRLS", "KIDS", "BAND", "DANCE", "KING", "QUEEN", "IDOL", "STAR", "LOVE", "MUSIC",
    # 略語（いじってはいけない！）
    "NHK", "FBI", "CIA", "SNS", "AI", "PR", "URL", "DX", "EV", "USA", "WHO", "CNN", "BBC", "CEO"
]

print(f"{'単語':<8} | {'解決結果':<10} | {'VOICEVOXカナ':<25} | 判定")
print("-" * 65)
for w in test_words:
    resolved = resolve_english_reading(w)
    kana = get_voicevox_kana(resolved)
    is_safe = False
    if w in ["GIRLS", "KIDS", "BAND", "DANCE", "KING", "QUEEN", "IDOL", "STAR", "LOVE", "MUSIC"]:
        is_safe = (resolved != w) # 単語化された
    else:
        is_safe = (resolved == w) # 略語のまま維持された
    print(f"{w:<8} | {resolved:<10} | {kana:<25} | {'⭕ 成功' if is_safe else '❌ 失敗'}")
