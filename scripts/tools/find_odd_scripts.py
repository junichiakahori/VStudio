#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json

target_file = "/Users/junichiakahori/Documents/Antigravity/VStudio/data/news_history/news_2026-09-11.json"
with open(target_file, "r", encoding="utf-8") as f:
    data = json.load(f)

suspicious_items = []
for i, item in enumerate(data):
    sentences = item.get("sentences", [])
    displays = [s.get("display", "").strip() for s in sentences]
    if not displays:
        continue
    last = displays[-1]
    
    reasons = []
    # 助詞や未完結で終了
    end_particles = ["と。", "が。", "で。", "に。", "を。", "は。", "も。", "から。", "ので。", "けど。", "って。", "など。", "とか。", "常磁。", "への。", "での。"]
    if any(last.endswith(w) for w in end_particles):
        reasons.append(f"助詞・未完語尾: {last[-10:]}")
    elif any(last.endswith(w) for w in ["と", "が", "で", "に", "を", "は", "も", "から", "ので", "けど", "って"]):
        reasons.append(f"句点なし助詞終了: {last[-10:]}")
    elif not any(last.endswith(p) for p in ["。", "！", "!", "？", "?", "」", "）", "…"]):
        reasons.append(f"句点等なし: {last[-10:]}")
        
    # 5行以上で、末尾文に「にゃ」「のだ」「ね」「よ」「す」などの終止形がない、または途切れ
    if len(sentences) >= 5:
        if not any(last.endswith(w) for w in ["にゃ。", "にゃ！", "にゃ?", "にゃ？", "のだ。", "のだ！", "ね。", "ね！", "よ。", "よ！", "す。", "す！", "だ。", "た。"]):
            reasons.append(f"終止形口調なし末尾: {last[-15:]}")
            
    if reasons:
        suspicious_items.append((i, len(sentences), item.get("title", ""), displays, reasons))

print(f"Total suspicious items: {len(suspicious_items)}\n")
for idx, s_len, title, disps, r in suspicious_items:
    print(f"【#{idx}】 ({s_len}文) タイトル: {title}")
    print(f"   理由: {r}")
    if len(disps) >= 2:
        print(f"   [前]: {disps[-2]}")
    print(f"   [末]: {disps[-1]}")
    print("-" * 60)
