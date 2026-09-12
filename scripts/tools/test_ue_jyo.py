#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import urllib.parse
import json

test_sentences = [
    # 1. 空間・位置・場所（うえ）
    "土俵の上で戦います。",
    "土俵の上には誰もいません。",
    "土俵の上の砂を払いました。",
    "土俵の上も緊張感があります。",
    "土俵の上から落ちました。",
    "ステージの上で歌う姿が印象的でした。",
    "舞台の上で輝いていました。",
    "氷の上で転んでしまいました。",
    "川の上を渡る風が心地よいにゃ。",
    "机の上に本があります。",
    "机の上で勉強します。",
    "ベッドの上で休みました。",
    
    # 2. 条件・前提・接続詞（うえ）
    "その上で決定します。",
    "その上、さらに良いことがあります。",
    "その上の階に行きました。",
    "検討した上で決めます。",
    "検討の上で決めます。",
    "検討の上、決めます。",
    "確認の上、お願いします。",
    "納得の上、契約しました。",
    "相談の上、進めます。",
    "理解の上でご参加ください。",
    "承諾の上で進めます。",
    
    # 3. ネット・SNS・メディア・システム（じょう）
    "X上で話題になっています。",
    "X上では炎上しています。",
    "X上での投稿が注目されています。",
    "X上にも多くの声があります。",
    "ネット上で話題です。",
    "SNS上で拡散されています。",
    "Web上で公開されました。",
    "オンライン上で開催されます。",
    "画面上で確認できます。",
    "紙上で発表されました。",
    "誌上で特集されました。",
    
    # 4. 接尾辞（じょう）
    "法律上の問題はありません。",
    "事実上の終了です。",
    "形式上の手続きです。",
    "歴史上、重要な人物です。",
    "健康上の理由で休養します。",
    "立場上、言えません。",
    "都合上、変更になります。",
    "安全上の配慮が必要です。",
    "業務上のミスでした。",
    "計算上の数値です。",
    "理論上は可能です。"
]

print(f"{'期待':<6} | {'実際':<6} | {'判定':<6} | {'例文'}")
print("-" * 70)

for s in test_sentences:
    params = urllib.parse.urlencode({"text": s, "speaker": 1})
    url = f"http://127.0.0.1:50021/audio_query?{params}"
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=3) as res:
            q = json.loads(res.read().decode("utf-8"))
            kana = q.get("kana", "")
            
            # 期待値判定
            expected = "じょう" if any(k in s for k in ["X上", "ネット上", "SNS上", "Web上", "オンライン上", "画面上", "紙上", "誌上", "法律上", "事実上", "形式上", "歴史上", "健康上", "立場上", "都合上", "安全上", "業務上", "計算上", "理論上"]) else "うえ"
            
            # 実際
            actual = "？"
            if "ウエ" in kana:
                actual = "うえ"
            elif "ジョオ" in kana:
                actual = "じょう"
            elif "カミ" in kana:
                actual = "かみ"
                
            judge = "⭕ OK" if expected == actual else "❌ 誤読"
            print(f"{expected:<6} | {actual:<6} | {judge:<6} | {s}")
            if expected != actual:
                print(f"      ➔ Kana: {kana}")
    except Exception as e:
        print(f"Error for {s}: {e}")
