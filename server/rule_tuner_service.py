"""
rule_tuner_service.py
配信画面上の「AIルールチューナー」から送信された自然言語指示を解析し、
data/tts_rules.json を安全かつ即座に更新・同期する専任サービス。
"""

import os
import re
import json
import shutil
import urllib.request
from typing import Dict, Tuple, Optional, Any

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV_RULES_FILE = os.path.join(BASE_DIR, "data", "tts_rules.json")
PROD_RULES_FILE = "/Users/junichiakahori/Documents/Antigravity/VStudio/data/tts_rules.json"


def parse_reading_instruction(prompt_text: str) -> Optional[Tuple[str, str]]:
    """
    ユーザーの入力文から「対象単語」と「正しい読み」を抽出する。
    1. 高速ルールベース・パターンマッチ
    2. 失敗時は Ollama ローカルLLM を呼び出して抽出
    """
    text = prompt_text.strip()
    if not text:
        return None

    # 1. パターンA: 矢印・等号（A → B, A -> B, A ➔ B, A = B）
    m = re.search(r"^(?:「|『)?(.+?)(?:」|』)?\s*(?:[→➔=＝]|->)\s*(?:「|『)?(.+?)(?:」|』)?$", text)
    if m:
        w, r = m.group(1).strip(), m.group(2).strip()
        if w and r:
            return w, r

    # 2. パターンB: コロン（A: B, A：B）
    m = re.search(r"^(?:「|『)?(.+?)(?:」|』)?\s*[:：]\s*(?:「|『)?(.+?)(?:」|』)?$", text)
    if m:
        w, r = m.group(1).strip(), m.group(2).strip()
        if w and r:
            return w, r

    # 3. パターンC: 自然言語助詞（AはB、AをBと読んで、Aの読みはB、AはBで登録等）
    m = re.search(
        r"^(?:「|『)?(.+?)(?:」|』)?(?:の読み[はを]|の読み方[はを]|は|を|って)\s*(?:「|『)?(.+?)(?:」|』)?(?:と[読よ]んで?|で[登登]録して?|に[直修]して?|にして?|で[お願ねが]い|と[発話]して?|)$",
        text
    )
    if m:
        w, r = m.group(1).strip(), m.group(2).strip()
        if w and r:
            return w, r

    # 4. パターンD: Ollama ローカルLLMによるインテリジェント抽出フォールバック
    return extract_via_llm(text)


def extract_via_llm(text: str) -> Optional[Tuple[str, str]]:
    """Ollama API (qwen2.5) を用いて自然言語から単語と読みをJSON形式で抽出"""
    try:
        system_prompt = (
            "あなたは日本語音声合成の辞書メンテナーです。"
            "ユーザーの発言から「対象となる単語や表記（word）」と「正しい読み仮名（reading）」を抽出してください。"
            '必ず次の形式の有効なJSONのみを1行で出力してください: {"word": "...", "reading": "..."}'
        )
        payload = {
            "model": "qwen2.5:7b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            "stream": False,
            "options": {"temperature": 0.0}
        }
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("message", {}).get("content", "").strip()
            # JSONブロック抽出
            json_m = re.search(r"\{.*?\}", content, re.DOTALL)
            if json_m:
                parsed = json.loads(json_m.group(0))
                w = parsed.get("word", "").strip().replace("「", "").replace("」", "")
                r = parsed.get("reading", "").strip().replace("「", "").replace("」", "")
                if w and r:
                    return w, r
    except Exception as e:
        print(f"[RuleTuner] LLM extraction fallback failed: {e}", flush=True)

    return None


def tune_tts_rule(instruction_text: str) -> Dict[str, Any]:
    """
    自然言語の指示を受け取り、data/tts_rules.json を更新・本番同期する。
    """
    extracted = parse_reading_instruction(instruction_text)
    if not extracted:
        return {
            "success": False,
            "error": "指示文から単語と読み仮名を解析できませんでした。「単語 → 読み」または「単語 は 読み」の形式で入力してください。"
        }

    word, reading = extracted
    # 読みの余計な語尾を除去
    reading = re.sub(r'(?:と[読よ]んで?|で[登登]録して?|に[直修]して?|にして?|で[お願ねが]い|)$', '', reading).strip()

    if not word or not reading:
        return {"success": False, "error": "単語または読み仮名が空です。"}

    # 1. 開発環境の tts_rules.json をロード
    if not os.path.exists(DEV_RULES_FILE):
        return {"success": False, "error": f"設定ファイルが見つかりません: {DEV_RULES_FILE}"}

    try:
        with open(DEV_RULES_FILE, "r", encoding="utf-8") as f:
            rules_data = json.load(f)
    except Exception as e:
        return {"success": False, "error": f"tts_rules.json の読み込みに失敗しました: {e}"}

    # 2. 分類・登録
    # A. 英字・略語（例: Aimer, U-18, PR, API等）またはハイフン混じり ➔ tech_acronyms
    # B. 通常の日本語漢字・単語（例: 超え, 萬谷, 春日等） ➔ word_reading_fixes
    category = "word_reading_fixes"
    if re.search(r"^[A-Za-z0-9\-_./&]+$", word) or re.search(r"[A-Za-z]", word):
        category = "tech_acronyms"

    if category not in rules_data:
        rules_data[category] = {}

    rules_data[category][word] = reading

    # 3. 保存と検証
    try:
        with open(DEV_RULES_FILE, "w", encoding="utf-8") as f:
            json.dump(rules_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    except Exception as e:
        return {"success": False, "error": f"tts_rules.json の保存に失敗しました: {e}"}

    # 4. 本番環境（VStudio）へ即座に完全同期（RULE 7）
    prod_synced = False
    if os.path.exists(os.path.dirname(PROD_RULES_FILE)):
        try:
            shutil.copyfile(DEV_RULES_FILE, PROD_RULES_FILE)
            prod_synced = True
        except Exception as e:
            print(f"[RuleTuner] Warning: failed to sync to prod: {e}", flush=True)

    # 5. メモリキャッシュのリフレッシュ（tts_normalizer の内部キャッシュ更新）
    try:
        from server.tts_normalizer import _ACRONYMS_CACHE
        if hasattr(_ACRONYMS_CACHE, "clear"):
            _ACRONYMS_CACHE.clear()
    except Exception:
        pass

    return {
        "success": True,
        "word": word,
        "reading": reading,
        "category": category,
        "prod_synced": prod_synced,
        "message": f"「{word}」の読みを「{reading}」として登録しました（{category}）"
    }
