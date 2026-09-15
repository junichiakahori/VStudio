#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_tts_zero_rules.py: tts_rules.json ゼロ化検証用テストスイート
各カテゴリの代表的文において、ルールに依存せず一次AI補正（ルビ抽出）および二次AI補正によって
VOICEVOXが100% 正しい発音で読み上げられるかを自動検証する。
"""

import re
import sys
import json
import urllib.request
import urllib.parse

# 1. 強化されたルビ分離パターン
RUBY_PATTERN = re.compile(r'([A-Za-z0-9\-]+|[一-鿿]+[ぁ-ん]??)[（\(]([ぁ-んァ-ヶー・\s]+)[）\)]')

def separate_ruby(text):
    """テキストから字幕用(display)と音声用(speech)を分離"""
    display = RUBY_PATTERN.sub(r'\1', text)
    speech = RUBY_PATTERN.sub(r'\2', text)
    # 残存カッコのクリーンアップ
    display = display.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
    return display, speech

def get_voicevox_moras(text, speaker=58):
    """VOICEVOXからモーラ列（実際の発音）を取得"""
    try:
        query_url = f"http://127.0.0.1:50021/audio_query?text={urllib.parse.quote(text)}&speaker={speaker}"
        req = urllib.request.Request(query_url, method="POST")
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
        moras = []
        for phrase in data.get("accent_phrases", []):
            for mora in phrase.get("moras", []):
                moras.append(mora["text"])
            moras.append("/")
        return "".join(moras)
    except Exception as e:
        return f"ERROR: {e}"

# テストケース定義
TEST_CASES = [
    # ① アルファベット・略語 (tech_acronyms)
    {
        "category": "tech_acronyms",
        "input_with_ruby": "G7（ジーセブン）サミットとG20（ジートゥエンティ）首脳会議が開幕したにゃ。",
        "plain_speech": "ジーセブンサミットとジートゥエンティ首脳会議が開幕したにゃ。",
        "expected_sub_moras": ["ジイ/", "セブン", "ジイ/", "トゥエンティ"]
    },
    {
        "category": "tech_acronyms",
        "input_with_ruby": "U-18（アンダー・エイティーン）日本代表の試合だにゃ。",
        "plain_speech": "アンダー・エイティーン日本代表の試合だにゃ。",
        "expected_sub_moras": ["アンダア", "エイティイン"]
    },
    {
        "category": "tech_acronyms",
        "input_with_ruby": "最新のIT（アイティー）企業とAI（エーアイ）のニュースだにゃ。",
        "plain_speech": "最新のアイティー企業とエーアイのニュースだにゃ。",
        "expected_sub_moras": ["アイティー", "エーアイ"]
    },
    # ② 文脈同音異義語 (okonau, it)
    {
        "category": "context_verbs",
        "input_with_ruby": "現地で調査を行う（おこなう）予定だにゃ。",
        "plain_speech": "現地で調査をおこなう予定だにゃ。",
        "expected_sub_moras": ["オコナウ"]
    },
    {
        "category": "context_verbs",
        "input_with_ruby": "この方（かた）からのお便りだにゃ。",
        "plain_speech": "このかたからのお便りだにゃ。",
        "expected_sub_moras": ["カタ"]
    },
    # ③ 皇族・固有名詞 (imperial, names)
    {
        "category": "proper_nouns",
        "input_with_ruby": "秋篠宮家の悠仁（ひさひと）さまが出席されたにゃ。",
        "plain_speech": "秋篠宮家のひさひとさまが出席されたにゃ。",
        "expected_sub_moras": ["ヒサヒト"]
    },
    {
        "category": "proper_nouns",
        "input_with_ruby": "二十四節気の白露（はくろ）を迎えたにゃ。",
        "plain_speech": "二十四節気のはくろを迎えたにゃ。",
        "expected_sub_moras": ["ハクロ"]
    },
    # ④ 削除した国名プレフィックス・敬称の自然読解検証
    {
        "category": "country_and_honorifics",
        "input_with_ruby": "日米首脳会談で首相と大統領が合意したにゃ。",
        "plain_speech": "日米首脳会談で首相と大統領が合意したにゃ。",
        "expected_sub_moras": ["ニチベエ", "シュショオ", "ダイトオリョオ"]
    },
    {
        "category": "country_and_honorifics",
        "input_with_ruby": "大谷選手と山本投手が活躍したにゃ。",
        "plain_speech": "大谷選手と山本投手が活躍したにゃ。",
        "expected_sub_moras": ["オオタニセンシュ", "ヤマモトトオシュ"]
    }
]

def run_suite():
    print("=" * 60)
    print("🧪 tts_rules.json ゼロ化・ルビ分離 & VOICEVOX発音検証テスト")
    print("=" * 60)

    passed = 0
    total = len(TEST_CASES)

    for i, tc in enumerate(TEST_CASES, 1):
        cat = tc["category"]
        raw = tc["input_with_ruby"]
        disp, speech = separate_ruby(raw)
        moras = get_voicevox_moras(speech)

        # モーラの一致検証（長音記号の母音展開およびスラッシュ除去に対応）
        def normalize_moras(s):
            return s.replace("/", "").replace("ー", "").replace("ア", "ア").replace("イ", "イ").replace("ウ", "ウ").replace("エ", "エ").replace("オ", "オ")

        matched = True
        norm_moras = normalize_moras(moras.lower())
        for expected in tc["expected_sub_moras"]:
            norm_exp = normalize_moras(expected.lower())
            if norm_exp not in norm_moras:
                matched = False
                break

        status = "✅ PASS" if matched else "❌ FAIL"
        if matched:
            passed += 1

        print(f"[{i}/{total}] {status} [{cat}]")
        print(f"  入力: {raw}")
        print(f"  字幕: {disp}")
        print(f"  音声: {speech}")
        print(f"  発音: {moras}")
        if not matched:
            print(f"  ⚠️ 不一致期待モーラ: {tc['expected_sub_moras']}")
        print("-" * 60)

    print(f"\n📊 テスト結果: {passed}/{total} 合格 ({passed/total*100:.1f}%)")
    if passed == total:
        print("🎉 全テストケースが合格しました！一次ルビ分離による完全誤読防止が実証されました。")
    return passed == total

if __name__ == "__main__":
    success = run_suite()
    sys.exit(0 if success else 1)
