# -*- coding: utf-8 -*-
"""
test_person_name_resolver.py
案A（人名限定Wikipedia照合＋元記事ルビ抽出）の網羅的単体・結合テスト
"""

import os
import sys

# プロジェクトルートを sys.path に追加
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)

from server.tts_normalizer import (
    extract_article_rubies, lookup_wikipedia_person_reading,
    normalize_for_tts, build_context_pronunciation_map
)
from server.news_script_processor import extract_person_names_via_ai, inspect_and_correct_pronunciation

def test_ruby_extraction():
    print("=== 1. 元記事ルビ抽出テスト ===")
    sample_text = """
    映画監督の甫木元空（ほきもと・そら＝34）さんの新作が発表されました。
    バレーボール男子日本代表の高橋藍（らん＝23）選手が大活躍です。
    大相撲春場所では安青錦（あおにしき＝22）が注目を集めています。
    """
    rubies = extract_article_rubies(sample_text)
    print("抽出されたルビ:", rubies)
    assert "甫木元空" in rubies and rubies["甫木元空"] == "ほきもとそら", f"甫木元空のルビ失敗: {rubies}"
    assert "高橋藍" in rubies and rubies["高橋藍"] == "らん", f"高橋藍のルビ失敗: {rubies}"
    assert "安青錦" in rubies and rubies["安青錦"] == "あおにしき", f"安青錦のルビ失敗: {rubies}"
    print("✅ 元記事ルビ抽出テスト合格！\n")

def test_wikipedia_person_reading():
    print("=== 2. 人名専用Wikipedia照合テスト ===")
    test_cases = [
        ("夏帆", "かほ", "ドラマや映画で活躍する女優"),
        ("高橋藍", "たかはし らん", "男子バレーボール日本代表の選手"),  # 異体字（髙橋藍）かつ文脈照合
        ("安青錦", "あおにしき", "大相撲の注目力士"),                     # prefixsearch（安青錦新大）四股名経由
        ("志尊淳", "しそんじゅん", "ドラマや舞台で話題の俳優"),
    ]
    for name, expected, hint in test_cases:
        yomi = lookup_wikipedia_person_reading(name, context_hint=hint)
        print(f"人名: '{name}' (文脈: '{hint}') ➔ 取得読み: '{yomi}' (期待: '{expected}')")
        assert yomi is not None, f"'{name}' の読み取得に失敗"
        norm_yomi = yomi.replace(" ", "").replace("・", "")
        norm_exp = expected.replace(" ", "").replace("・", "")
        assert norm_exp in norm_yomi or norm_yomi in norm_exp, f"'{name}': 期待 '{expected}' != 取得 '{yomi}'"
    print("✅ 人名専用Wikipedia照合テスト合格！\n")

def test_general_words_safety():
    print("=== 3. 一般熟語・安全性テスト（誤爆防止） ===")
    test_sentences = [
        ("デザインは左右対称で美しい仕上がりです。", "線対称", "左右対称"),
        ("施設は改修工事のため一時閉鎖されます。", "すもう", "一時閉鎖"),
        ("蔵内前議長は記者会見を開きました。", "ぞうない", "蔵内"),
        ("服部知事は方針を示しました。", "ふくべ", "はっとり"),
    ]
    for sent, bad_substr, good_substr in test_sentences:
        normalized = normalize_for_tts(sent)
        print(f"文: '{sent}'\n ➔ 正規化: '{normalized}' (NG単語 '{bad_substr}' なし, '{good_substr}' 保持)")
        assert bad_substr not in normalized, f"誤読・異常置換を検知: {normalized} (含んではいけない '{bad_substr}')"
        assert good_substr in normalized or "クラウチ" in normalized or "ハットリ" in normalized, f"語句が失われました: {normalized}"
    print("✅ 一般熟語・安全性テスト合格！\n")

def test_integrated_script_pronunciation():
    print("=== 4. 統合原稿生成パイプライン・シミュレーション ===")
    title = "バレーボール高橋藍選手、イタリアで大活躍"
    article_body = "男子バレーの日本代表・高橋藍選手がイタリアのリーグ戦で大活躍し、MVPに選ばれました。"
    raw_sentences = [
        "男子バレーの高橋藍選手が素晴らしい活躍を見せましたにゃ！",
        "相手チームのブロックを打ち破るスパイクは左右対称の美しさでしたにゃ。",
        "今後の高橋選手の活躍にも目が離せないにゃ！"
    ]
    
    # context_map構築
    full_text = f"{title}\n{article_body}\n" + "\n".join(raw_sentences)
    context_map = build_context_pronunciation_map(full_text)
    
    # 案A: 人名Wikipedia解決
    p_names = ["高橋藍", "高橋選手"]
    for pname in p_names:
        import re
        core_name = re.sub(r'(?:選手|知事|氏)$', '', pname).strip()
        w_yomi = lookup_wikipedia_person_reading(core_name, context_hint=full_text)
        if w_yomi:
            context_map[pname] = w_yomi
            context_map[core_name] = w_yomi

    items = inspect_and_correct_pronunciation(raw_sentences, article_context=article_body, context_map=context_map)
    for it in items:
        print(f"表示: {it['display']}")
        print(f"音声: {it['speech']}")
    
    first_speech = items[0]["speech"]
    assert "たかはし" in first_speech and "らん" in first_speech, f"高橋藍の読みが不正: {first_speech}"
    second_speech = items[1]["speech"]
    assert "左右対称" in second_speech or "さゆうたいしょう" in second_speech, f"左右対称が壊れた: {second_speech}"
    print("✅ 統合パイプライン・シミュレーション合格！\n")

if __name__ == "__main__":
    print("🚀 案A 人名発音解決テスト開始\n")
    test_ruby_extraction()
    test_wikipedia_person_reading()
    test_general_words_safety()
    test_integrated_script_pronunciation()
    print("🎉 全テストケースが完全に合格しました！")
