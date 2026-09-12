#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import urllib.parse
import json

test_words = [
    "数字上は", "統計データ上は", "マップ上では", "リスト上では", "番組上は",
    "契約上は", "道義上は", "関係上は", "日程上は", "構造上は",
    "ネット上では", "X（旧Twitter）上で", "Twitter上では", "YouTube上では",
    "TikTok上では", "Instagram上では", "Facebook上では",
    "旧Twitter上では", "X（旧ツイッター）上では"
]

for w in test_words:
    params = urllib.parse.urlencode({"text": w, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=3) as res:
            q = json.loads(res.read().decode("utf-8"))
            kana = q.get("kana", "")
            is_ue = "ウエ" in kana
            tag = "BAD_UE" if is_ue else "GOOD_JYO"
            print(f"[{tag}] {w} ➔ {kana}")
    except Exception as e:
        print(f"Error for {w}: {e}")
