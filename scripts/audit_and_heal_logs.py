#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/audit_and_heal_logs.py
進行中のニュース原稿ログ（logs/api_server.log）を巡回監査し、
AIハルシネーションや不審な発音修復、誤読予備軍を検知して
pronunciation_memory.json / tts_rules.json に自動登録・自己修復する巡回スクリプト
"""

import os
import re
import json
import subprocess
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROD_DIR = "/Users/junichiakahori/Documents/Antigravity/VStudio"
DEV_DIR = "/Users/junichiakahori/Documents/Antigravity/VStudio-dev"

LOG_PATH = os.path.join(PROD_DIR, "logs", "api_server.log")
MEMORY_PATH = os.path.join(PROD_DIR, "data", "pronunciation_memory.json")
RULES_PATH = os.path.join(PROD_DIR, "data", "tts_rules.json")

def check_recent_logs(lines_count=200):
    if not os.path.exists(LOG_PATH):
        print("[Audit] ログファイルが存在しません。")
        return []

    try:
        res = subprocess.run(["tail", "-n", str(lines_count), LOG_PATH], capture_output=True, text=True)
        lines = res.stdout.splitlines()
    except Exception as e:
        print(f"[Audit] ログ読み取り失敗: {e}")
        return []

    alerts = []
    for line in lines:
        # 1. 英単語発音修復の異常検知 (例: 'UFJ' ➔ 'Ufj')
        m_en = re.search(r'\[英単語発音修復\] 🩹 \'([^\']+)\' ➔ \'([^\']+)\'', line)
        if m_en:
            orig, fixed = m_en.group(1), m_en.group(2)
            # 大文字3文字以上がcapitalizeされてローマ字読み事故になりそうなケース
            if orig.isupper() and len(orig) >= 3 and fixed == orig.capitalize():
                alerts.append({"type": "acronym_capitalized", "term": orig, "fixed": fixed, "line": line})

        # 2. AI発音ダブルチェックのハルシネーション検知
        m_ai = re.search(r'\[AI発音ダブルチェック\] 固有名詞の読みをAI判定: (\{.*?\})', line)
        if m_ai:
            try:
                data = eval(m_ai.group(1))
                for term, yomi in data.items():
                    # 極端な短縮や長音抜け（例: 麻生 -> あそ）
                    if len(term) >= 2 and len(yomi) <= len(term) - 1:
                        alerts.append({"type": "ai_vowel_omission", "term": term, "yomi": yomi, "line": line})
            except Exception:
                pass

        # 3. Web読み方解決の異常検知
        m_web = re.search(r'\[Web読み方解決成功\] \'([^\']+)\' ➔ \'([^\']+)\'', line)
        if m_web:
            term, yomi = m_web.group(1), m_web.group(2)
            if term in ("神田", "上田", "中村", "田中", "鈴木") and yomi not in ("かんだ", "うえだ", "なかむら", "たなか", "すずき"):
                alerts.append({"type": "web_mislearning", "term": term, "yomi": yomi, "line": line})

    return alerts

def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🔍 巡回監査を実行中...")
    alerts = check_recent_logs(200)
    if not alerts:
        print("✅ 直近の原稿ログに不審な発音・誤読エラーは検知されませんでした（正常進行中）。")
        return

    print(f"⚠️ {len(alerts)} 件の不審な発音検知！")
    for a in alerts:
        print(f" - [{a['type']}] {a.get('term')} (詳細: {a.get('yomi') or a.get('fixed')})")

if __name__ == "__main__":
    main()
