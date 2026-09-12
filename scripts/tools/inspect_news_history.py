#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os

target_file = "/Users/junichiakahori/Documents/Antigravity/VStudio/data/news_history/news_2026-09-11.json"
with open(target_file, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total articles in 2026-09-11: {len(data)}")

# 文数ごとのカウント
counts = {}
for item in data:
    s_len = len(item.get("sentences", []))
    counts[s_len] = counts.get(s_len, 0) + 1
print("Sentence length distribution:", sorted(counts.items()))

print("\n" + "="*80)
print("🔍 5行以上の原稿（全件）の末尾チェック")
print("="*80)

for i, item in enumerate(data):
    sentences = item.get("sentences", [])
    s_len = len(sentences)
    if s_len >= 5:
        title = item.get("title", "")
        displays = [s.get("display", "").strip() for s in sentences]
        last = displays[-1] if displays else ""
        prev = displays[-2] if len(displays) >= 2 else ""
        
        # 疑わしい特徴を検出
        flags = []
        
        # 1. 途中で切れている
        if any(last.endswith(w) for w in ["と", "が", "で", "に", "を", "は", "も", "から", "ので", "けど", "って", "など", "とか"]):
            flags.append(f"助詞終了（未完句）: '{last[-6:]}'")
        elif any(last.endswith(w) for w in ["と。", "が。", "で。", "に。", "を。", "は。", "も。", "から。", "ので。", "けど。", "って。"]):
            flags.append(f"助詞＋句点終了: '{last[-6:]}'")
            
        # 2. 句点なし
        if not any(last.endswith(p) for p in ["。", "！", "!", "？", "?"]):
            flags.append(f"句点なし: '{last[-6:]}'")
            
        # 3. 呼びかけ・疑問形で唐突
        if "？" in last or "?" in last:
            flags.append("疑問符あり")
            
        # 4. 定型挨拶・メタ発言・次回
        if any(w in last for w in ["次回", "ではまた", "バイバイ", "さようなら", "いかがでした", "以上、", "お伝えしました", "でしたにゃ", "でした。"]):
            flags.append(f"締め挨拶混入")
            
        # 5. 変な語尾（方言、崩れ）
        if any(w in last for w in ["いゃ", "みんないゃ", "のだにゃ", "にゃのだ", "じゃが", "やろ", "へん", "ねん"]):
            flags.append("語尾崩れ・方言")
            
        # 6. 「〜とのことだにゃ」「〜というにゃ」等の客観報道調（感想になってない）
        if any(last.endswith(w) for w in ["というにゃ。", "とのことだにゃ。", "とのことですにゃ。", "という。", "とのことです。"]):
            flags.append("客観文で終了（感想なし？）")
            
        # 7. 短すぎる・長すぎる
        if len(last) < 15:
            flags.append(f"短文 ({len(last)}文字)")
            
        # 8. 前の文と同じような内容（ループ）
        if len(displays) >= 2 and (displays[-1][:10] == displays[-2][:10] or displays[-1][-10:] == displays[-2][-10:]):
            flags.append("文末/文頭の重複・ループ")

        print(f"\n【#{i}】 ({s_len}文) タイトル: {title}")
        for idx, d in enumerate(displays):
            marker = " 👉 [末尾]" if idx == len(displays) - 1 else f"    [{idx+1}]"
            print(f"{marker} {d}")
        if flags:
            print(f"   ⚠️ 注目フラグ: {', '.join(flags)}")
