#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import urllib.parse
import json

test_words = [
    ("GIRLS", "Girls"),
    ("KIDS", "Kids"),
    ("BAND", "Band"),
    ("DANCE", "Dance"),
    ("KING", "King"),
    ("QUEEN", "Queen"),
    ("IDOL", "Idol"),
    ("WORLD", "World"),
    ("MUSIC", "Music")
]

for upper, title in test_words:
    for w in [upper, title]:
        params = urllib.parse.urlencode({"text": w, "speaker": 1})
        url = f"http://127.0.0.1:50021/audio_query?{params}"
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=3) as res:
            q = json.loads(res.read().decode("utf-8"))
            kana = q.get("kana", "")
            print(f"{w:<10} ➔ {kana}")
    print("-" * 40)
