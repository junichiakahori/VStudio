#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import urllib.parse
import json

test_words = [
    "GIRLS", "KIDS", "NEWS", "LIVE", "STAR", "BAND", "LOVE", "GAME",
    "MUSIC", "ROCK", "POP", "WORLD", "IDOL", "DANCE", "SHOW", "BOYS",
    "GIRL", "BOY", "KING", "QUEEN", "TEAM", "CLUB", "TOUR", "FESTIVAL"
]

for w in test_words:
    params = urllib.parse.urlencode({"text": w, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=3) as res:
            q = json.loads(res.read().decode("utf-8"))
            kana = q.get("kana", "")
            print(f"{w:<10} ➔ {kana}")
    except Exception as e:
        print(f"{w:<10} ➔ Error: {e}")
