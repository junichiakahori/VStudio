#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server/pronunciation_audit_service.py
リアルタイム誤字・誤読監視サービス（常駐デーモンモジュール）
ニュース原稿生成ログやVOICEVOX音声合成を常時監視し、
AIハルシネーションや略語破損、ニッチ専門用語の誤爆を自動検知して
pronunciation_memory.json / tts_rules.json へ文脈情報付きで自己修復・永続登録する。
"""

import os
import re
import json
import time
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_PATH = os.path.join(BASE_DIR, "logs", "api_server.log")
MEMORY_PATH = os.path.join(BASE_DIR, "data", "pronunciation_memory.json")
RULES_PATH = os.path.join(BASE_DIR, "data", "tts_rules.json")

class PronunciationAuditService:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._is_running = False
        self._lock = threading.Lock()
        
        self.stats = {
            "is_running": False,
            "started_at": None,
            "last_check_at": None,
            "inspected_lines": 0,
            "detected_issues": 0,
            "repaired_count": 0,
            "recent_repairs": []  # 直近の修復ログ（最大20件）
        }
        self._file_pos = 0

    @property
    def is_running(self) -> bool:
        return self._is_running

    def start(self) -> bool:
        with self._lock:
            if self._is_running:
                return True
            self._stop_event.clear()
            # 起動時は現在のファイル末尾から監視開始（過去ログの多重修復を防止）
            if os.path.exists(LOG_PATH):
                try:
                    self._file_pos = os.path.getsize(LOG_PATH)
                except Exception:
                    self._file_pos = 0
            else:
                self._file_pos = 0

            self._thread = threading.Thread(target=self._run_loop, daemon=True, name="PronunciationAuditThread")
            self._is_running = True
            self.stats["is_running"] = True
            self.stats["started_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self._thread.start()
            print("[Pronunciation Audit] 🛡️ 誤字・誤読監視サービスを常駐起動しました", flush=True)
            return True

    def stop(self) -> bool:
        with self._lock:
            if not self._is_running:
                return True
            self._stop_event.set()
            self._is_running = False
            self.stats["is_running"] = False
            print("[Pronunciation Audit] ⏹️ 誤字・誤読監視サービスを停止しました", flush=True)
            return True

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            res = dict(self.stats)
            res["is_running"] = self._is_running
            return res

    def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                self._scan_new_log_entries()
            except Exception as e:
                print(f"[Pronunciation Audit] ⚠️ 監視ループエラー: {e}", flush=True)

            # 3秒待機（stop_eventで即時脱出可能）
            self._stop_event.wait(3.0)

    def _scan_new_log_entries(self):
        if not os.path.exists(LOG_PATH):
            return

        current_size = os.path.getsize(LOG_PATH)
        if current_size < self._file_pos:
            # ログローテーション検知
            self._file_pos = 0

        if current_size == self._file_pos:
            self.stats["last_check_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return

        try:
            with open(LOG_PATH, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self._file_pos)
                new_lines = f.readlines()
                self._file_pos = f.tell()
        except Exception:
            return

        if not new_lines:
            return

        self.stats["inspected_lines"] += len(new_lines)
        self.stats["last_check_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for line in new_lines:
            self._inspect_line(line.strip())

    def _inspect_line(self, line: str):
        if not line:
            return

        # 1. 英単語化（略語破損）検知: [英単語発音修復] 🩹 'UFJ' ➔ 'Ufj'
        m_en = re.search(r'\[英単語発音修復\] 🩹 \'([^\']+)\' ➔ \'([^\']+)\'', line)
        if m_en:
            orig, fixed = m_en.group(1), m_en.group(2)
            if orig.isupper() and len(orig) >= 3 and fixed == orig.capitalize():
                self._heal_acronym_corruption(orig)

        # 2. AI発音ダブルチェックの長音抜け・モーラ欠落検知
        m_ai = re.search(r'\[AI発音ダブルチェック\] 固有名詞の読みをAI判定: (\{.*?\})', line)
        if m_ai:
            try:
                data = json.loads(m_ai.group(1).replace("'", '"'))
                for term, yomi in data.items():
                    self._audit_ai_reading(term, yomi)
            except Exception:
                pass

        # 3. Web自動解決の異常検知（一般的苗字の歴史用語誤爆など）
        m_web = re.search(r'\[Web読み方解決成功\] \'([^\']+)\' ➔ \'([^\']+)\'', line)
        if m_web:
            term, yomi = m_web.group(1), m_web.group(2)
            self._audit_web_reading(term, yomi)

    def _heal_acronym_corruption(self, acronym: str):
        """略語が誤って英単語化（小文字化）された事故を自動修復"""
        self.stats["detected_issues"] += 1
        print(f"[Pronunciation Audit] 🚨 略語破損を自動検知: '{acronym}' ➔ 即時自己修復を実行", flush=True)

        # 1. tts_rules.json の tech_acronyms に登録されているか確認
        try:
            if os.path.exists(RULES_PATH):
                with open(RULES_PATH, "r", encoding="utf-8") as f:
                    rules = json.load(f)
                tech = rules.setdefault("tech_acronyms", {})
                if acronym not in tech:
                    # カナ読み生成
                    kana_map = {"U":"ユー", "F":"エフ", "J":"ジェイ", "N":"エヌ", "T":"ティー", "K":"ケー", "D":"ディー", "I":"アイ", "S":"エス", "B":"ビー"}
                    kana_yomi = "".join([kana_map.get(c, c) for c in acronym])
                    tech[acronym] = kana_yomi
                    with open(RULES_PATH, "w", encoding="utf-8") as f:
                        json.dump(rules, f, ensure_ascii=False, indent=2)
                    self._record_repair(acronym, kana_yomi, "略語のスペル破損防止（大文字保護）")
        except Exception as e:
            print(f"[Pronunciation Audit] ⚠️ tts_rules 更新失敗: {e}", flush=True)

    def _audit_ai_reading(self, term: str, yomi: str):
        """AI判定読みの長音抜けや誤読を検査"""
        # 例: 麻生 -> あそ、石油供給 -> せきゆきゅう
        if term == "麻生" and yomi == "あそ":
            self.stats["detected_issues"] += 1
            self._save_memory_record(
                surface="麻生", reading="あそう",
                scope="contextual",
                keywords=["麻生太郎", "自民党", "麻生派", "首相"],
                note="AIの長音抜け（あそ）自動修復"
            )
        elif "供給" in term and "きゅう" in yomi and "きょうきゅう" not in yomi:
            self.stats["detected_issues"] += 1
            self._save_memory_record(
                surface=term, reading=term.replace("供給", "きょうきゅう"),
                scope="global",
                note="AIの音節欠落（供給->きゅう）自動修復"
            )

    def _audit_web_reading(self, term: str, yomi: str):
        """Web自動解決の異常検知"""
        if term in ("神田", "上田", "中村", "田中", "鈴木") and yomi == "しんでん":
            self.stats["detected_issues"] += 1
            self._save_memory_record(
                surface="神田", reading="かんだ",
                scope="global",
                note="歴史用語（神田->しんでん）自動修復"
            )

    def _save_memory_record(self, surface: str, reading: str, scope: str = "global", keywords: List[str] = None, note: str = ""):
        try:
            if not os.path.exists(MEMORY_PATH):
                return
            with open(MEMORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            records = data.setdefault("records", [])

            # 既存レコード更新または追加
            for r in records:
                if r.get("surface") == surface:
                    r["reading"] = reading
                    r["scope"] = scope
                    if keywords:
                        r["context_keywords"] = keywords
                    r["updated_date"] = datetime.now().strftime("%Y-%m-%d")
                    r["note"] = note
                    with open(MEMORY_PATH, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    self._record_repair(surface, reading, note)
                    return

            records.append({
                "id": f"audit_{int(time.time())}_{abs(hash(surface)) % 10000}",
                "surface": surface,
                "reading": reading,
                "scope": scope,
                "context_keywords": keywords or [],
                "article_topic": f"{surface}の発音自動監査・修復",
                "category": "auto_audited",
                "registered_date": datetime.now().strftime("%Y-%m-%d"),
                "note": note
            })
            with open(MEMORY_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._record_repair(surface, reading, note)
        except Exception as e:
            print(f"[Pronunciation Audit] ⚠️ 台帳更新エラー: {e}", flush=True)

    def _record_repair(self, term: str, reading: str, reason: str):
        self.stats["repaired_count"] += 1
        record = {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "term": term,
            "reading": reading,
            "reason": reason
        }
        self.stats["recent_repairs"].insert(0, record)
        if len(self.stats["recent_repairs"]) > 20:
            self.stats["recent_repairs"].pop()
        print(f"[Pronunciation Audit] ✅ 自動修復完了: '{term}' ➔ '{reading}' ({reason})", flush=True)

# シングルトンインスタンス
_audit_service_instance: Optional[PronunciationAuditService] = None

def get_pronunciation_audit_service() -> PronunciationAuditService:
    global _audit_service_instance
    if _audit_service_instance is None:
        _audit_service_instance = PronunciationAuditService()
    return _audit_service_instance
