# -*- coding: utf-8 -*-
"""
news_history_logger.py: ニュース放送台本・原稿履歴の自動保存モジュール
- 原稿生成時（字幕・読み上げひらがな）に data/news_history/news_YYYY-MM-DD.md / .json へ自動記録
- 後からの誤読チェック、辞書補正、放送アーカイブとして機能
"""

import os
import re
import json
import threading
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
_HISTORY_LOCK = threading.Lock()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORY_DIR = os.path.join(BASE_DIR, "data", "news_history")

def get_today_jst():
    return datetime.now(JST).strftime("%Y-%m-%d")

def get_now_jst_str():
    return datetime.now(JST).strftime("%H:%M:%S")

def ensure_history_dir():
    os.makedirs(HISTORY_DIR, exist_ok=True)

def log_news_script_item(title, pub_date, source, url, sentences, full_display_text="", full_reading_text="",
                         title_reading="", title_voicevox_reading="", title_voicevox_kana="", headline_display=""):
    """
    生成されたニュース原稿1件を日次ログファイル（Markdown & JSON）に自動追記
    :param title: 記事見出し（元タイトル）
    :param pub_date: 元記事の日時（YYYY-MM-DD HH:MM 等）
    :param source: 出典メディア名
    :param url: 記事URL
    :param sentences: [{"display": "...", "reading": "...", "voicevox_reading": "...", "voicevox_kana": "..."}, ...]
    :param full_display_text: 全体字幕テキスト（任意）
    :param full_reading_text: 全体読みテキスト（任意）
    :param title_reading: タイトル読み上げ発音（ひらがな）
    :param title_voicevox_reading: タイトルのVOICEVOX実読み
    :param title_voicevox_kana: タイトルのVOICEVOXアクセントカナ
    :param headline_display: 見出し表示テキスト（AI短縮見出し等）
    """
    if not title:
        return

    with _HISTORY_LOCK:
        try:
            ensure_history_dir()
            today = get_today_jst()
            now_time = get_now_jst_str()
            
            md_path = os.path.join(HISTORY_DIR, f"news_{today}.md")
            json_path = os.path.join(HISTORY_DIR, f"news_{today}.json")

            # 1. 既存のJSON履歴を読み込み（重複防止 & 通番計算）
            existing_items = []
            if os.path.exists(json_path):
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        existing_items = json.load(f)
                except Exception:
                    existing_items = []

            # 同一URLまたは同一タイトルの重複登録を防止（すでに記録済みなら更新またはスキップ）
            item_index = len(existing_items) + 1
            for idx, ex in enumerate(existing_items):
                if (url and ex.get('url') == url) or (ex.get('title') == title):
                    # 既に存在する場合は上書き更新
                    item_index = idx + 1
                    break

            record = {
                "index": item_index,
                "title": title,
                "title_reading": title_reading or "",
                "title_voicevox_reading": title_voicevox_reading or "",
                "title_voicevox_kana": title_voicevox_kana or "",
                "headline": {
                    "display": headline_display or title,
                    "reading": title_reading or "",
                    "voicevox_reading": title_voicevox_reading or "",
                    "voicevox_kana": title_voicevox_kana or ""
                },
                "pub_date": pub_date or "日時不明",
                "source": "Yahoo!ニュース" if (url and "news.yahoo.co.jp" in url and (not source or "NHK" in source or source == "不明")) else (source or "不明"),
                "url": url or "",
                "created_at": f"{today} {now_time}",
                "sentences": sentences or [],
                "full_display_text": full_display_text,
                "full_reading_text": full_reading_text
            }

            if item_index <= len(existing_items):
                existing_items[item_index - 1] = record
            else:
                existing_items.append(record)

            # JSON 保存
            temp_json = json_path + ".tmp"
            with open(temp_json, 'w', encoding='utf-8') as f:
                json.dump(existing_items, f, ensure_ascii=False, indent=2)
            os.replace(temp_json, json_path)

            # 2. Markdown 全体再構築（常に番号順・綺麗に整列）
            md_lines = [
                f"# 📰 ニュース放送台本ログ（{today}）",
                f"> 累計記録記事数: {len(existing_items)} 件 | 最終更新: {now_time}",
                "",
                "---"
            ]

            for item in existing_items:
                idx = item.get("index", 1)
                t = item.get("title", "")
                p_date = item.get("pub_date", "日時不明")
                src = item.get("source", "不明")
                u = item.get("url", "")
                c_time = item.get("created_at", "").split()[-1] if item.get("created_at") else ""
                s_list = item.get("sentences", [])

                md_lines.append(f"### #{idx} [{p_date} | {src}] {t}")
                if u:
                    md_lines.append(f"- **URL**: {u}")
                md_lines.append(f"- **元記事日時**: {p_date} （生成時刻: {c_time}）")

                # 見出し・タイトルの読み情報
                h_disp = item.get("headline", {}).get("display") or item.get("title", "")
                h_read = item.get("title_reading") or item.get("headline", {}).get("reading", "")
                h_vv_read = item.get("title_voicevox_reading") or item.get("headline", {}).get("voicevox_reading", "")
                h_vv_kana = item.get("title_voicevox_kana") or item.get("headline", {}).get("voicevox_kana", "")

                if h_read or (h_disp and h_disp != t):
                    md_lines.append(f"- **見出し字幕**: {h_disp}")
                if h_read:
                    md_lines.append(f"- **見出し読み上げ（ひらがな）**: {h_read}")
                if h_vv_read:
                    md_lines.append(f"- **見出しVOICEVOX読み**: {h_vv_read}")
                if h_vv_kana:
                    md_lines.append(f"- **見出しVOICEVOXカナ**: {h_vv_kana}")

                md_lines.append("- **本文字幕テロップ**:")
                for s_i, s in enumerate(s_list, 1):
                    d_txt = s.get("display", "").strip()
                    if d_txt:
                        md_lines.append(f"  {s_i}. {d_txt}")

                md_lines.append("- **本文読み上げ発音（ひらがな）**:")
                for s_i, s in enumerate(s_list, 1):
                    r_txt = s.get("reading", "").strip()
                    if r_txt:
                        md_lines.append(f"  {s_i}. {r_txt}")

                # VOICEVOX の読み（カタカナ）が存在する場合は追加
                if any(s.get("voicevox_reading") for s in s_list):
                    md_lines.append("- **本文VOICEVOX発音（カナ）**:")
                    for s_i, s in enumerate(s_list, 1):
                        vv_txt = s.get("voicevox_reading", "").strip()
                        if vv_txt:
                            md_lines.append(f"  {s_i}. {vv_txt}")

                md_lines.append("")
                md_lines.append("---")

            temp_md = md_path + ".tmp"
            with open(temp_md, 'w', encoding='utf-8') as f:
                f.write("\n".join(md_lines) + "\n")
            os.replace(temp_md, md_path)

            print(f"[台本ログ保存] 📝 #{item_index} '{title[:25]}...' を {os.path.basename(md_path)} に記録しました", flush=True)
        except Exception as e:
            print(f"[台本ログ保存エラー]: {e}", flush=True)
