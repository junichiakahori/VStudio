#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import ssl
import urllib.request
import urllib.parse
import json

ctx = ssl._create_unverified_context()

for term in ["GIRLS", "KIDS", "BAND", "DANCE", "KING", "QUEEN"]:
    url = f"https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(term)}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "VStudio/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5, context=ctx) as res:
            data = json.loads(res.read().decode("utf-8"))
            results = data.get("query", {}).get("search", [])
            if results:
                t = results[0].get("title", "")
                s = results[0].get("snippet", "")[:80]
                print(f"[{term}] Title: {t} | Snippet: {s}")
    except Exception as e:
        print(f"[{term}] Error: {e}")
