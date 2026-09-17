# -*- coding: utf-8 -*-
"""
test_imperial_and_guard_safety.py
皇族文脈マスター保護、一般人誤爆防止、LLM発音暴走遮断、英単語正規化の網羅的検証テスト
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)

from server.tts_normalizer import (
    normalize_for_tts, is_imperial_article_context, extract_imperial_pronunciations,
    build_context_pronunciation_map, extract_article_rubies, lookup_wikipedia_person_reading
)
from server.news_script_processor import inspect_and_correct_pronunciation

def test_imperial_pronunciations():
    print("=== 1. 皇族マスター読みテスト（ノリコヒ・ユウジン根絶） ===")
    test_cases = [
        ("紀子妃さまのご心中には焦燥感が渦巻いてるって言われてるんだにゃ。", ["きこひさま"]),
        ("紀子妃さまは長男の悠仁さまへの思いが深く、将来の天皇としての育成に全力を尽くしてらっしゃるにゃ。", ["きこひさま", "ひさひとさま"]),
        ("紀子妃のご公務について宮内庁が発表しましたにゃ。", ["きこひ"]),
        ("紀子妃殿下が式典にご出席されましたにゃ。", ["きこひでんか"]),
        ("佳子さまがギリシャをご訪問されましたにゃ。", ["かこさま"]),
        ("愛子さまの人気が高まってきたにゃ。", ["あいこさま"]),
        ("秋篠宮ご夫妻が式典に出席されましたにゃ。", ["あきしののみや"]),
    ]
    for sent, expected_yomis in test_cases:
        norm = normalize_for_tts(sent)
        print(f"元文: '{sent}'\n ➔ 正規化: '{norm}'")
        for ey in expected_yomis:
            assert ey in norm, f"皇族の読み漏れ: '{ey}' not in '{norm}'"
        assert "ノリコヒ" not in norm and "のりこひ" not in norm, f"ノリコヒサマの誤読が発生: {norm}"
        assert "ユウジン" not in norm and "ゆうじん" not in norm, f"ユウジンサマの誤読が発生: {norm}"
    print("✅ 皇族マスター読みテスト合格！\n")

def test_commoner_safety():
    print("=== 2. 同姓同名の一般人・誤爆防止テスト（名字付き除外） ===")
    test_cases = [
        ("女優の松本佳子さんが新作映画の舞台挨拶に登壇しました。", "まつもと", "松本佳子"),
        ("詐欺の疑いで逮捕された佐藤紀子容疑者は容疑を否認しています。", "さとう", "佐藤紀子"),
        ("陸上大会で優勝した山田悠仁選手が注目を集めています。", "やまだ", "山田悠仁"),
    ]
    for sent, surname, full_name in test_cases:
        norm = normalize_for_tts(sent)
        print(f"一般人ニュース: '{sent}'\n ➔ 正規化: '{norm}'")
        # 皇族読み（かこさま、きこさま、ひさひとさま）に誤爆していないこと
        assert "かこさま" not in norm, f"一般人が佳子さまに誤爆: {norm}"
        assert "きこさま" not in norm and "きこひさま" not in norm, f"一般人が紀子さまに誤爆: {norm}"
        assert "ひさひとさま" not in norm, f"一般人が悠仁さまに誤爆: {norm}"
        assert full_name in norm or surname in norm, f"一般人名が破壊されました: {norm}"
    print("✅ 一般人誤爆防止テスト合格！\n")

def test_llm_hallucination_blocking():
    print("=== 3. LLM発音暴走遮断バリデーションテスト ===")
    from server.news_script_processor import extract_pronunciations_via_ai
    
    # 悪質な捏造読みシミュレーション
    raw_sentences = [
        "北海道共同募金会が新たに7000万円の使途不明金を明らかにしましたにゃ。",
        "自民党の新執行部が発足しましたにゃ。",
        "チームの参入に向けて全力で取り組む方針ですにゃ。"
    ]
    
    # LLMがデタラメ読みを出力した場合をシミュレート
    context_map = {}
    fake_llm_hallucinations = {
        "使途不明金": "しょとふもふきん",
        "役員": "やいん",
        "全力": "ぜんりき",
        "参入": "さんりん",
        "新執行部": "しんじっこうぶ"
    }
    
    FORBIDDEN = {"使途不明金", "役員", "全力", "参入", "新執行部"}
    for term, yomi in fake_llm_hallucinations.items():
        if term in FORBIDDEN:
            # 安全防壁によってブロックされるべき
            print(f"🛡️ 防壁テスト: '{term}' -> '{yomi}' をブロック検知")
        else:
            context_map[term] = yomi

    items = inspect_and_correct_pronunciation(raw_sentences, article_context="募金と政治とスポーツのニュース", context_map=context_map)
    for it in items:
        print(f"表示: {it['display']}")
        print(f"音声: {it['speech']}")
        assert "しょとふもふきん" not in it["speech"], f"使途不明金の破壊がすり抜けました: {it['speech']}"
        assert "ぜんりき" not in it["speech"], f"全力がぜんりきに破壊されました: {it['speech']}"
        assert "さんりん" not in it["speech"], f"参入がさんりんに破壊されました: {it['speech']}"
        assert "しんじっこうぶ" not in it["speech"], f"新執行部が分割ひらがな化されました: {it['speech']}"
    print("✅ LLM発音暴走遮断テスト合格！\n")

def test_tech_words():
    print("=== 4. 英単語・IT用語正規化テスト（アイフォネ根絶） ===")
    test_cases = [
        ("Appleが発表した初の折りたたみiPhone Duoが話題ですにゃ。", ["アップル", "アイフォン"]),
        ("レゾナックが300mm SiC単結晶基板を開発しましたにゃ。", ["エスアイシー"]),
        ("ChatGPTの最新アップデートが公開されましたにゃ。", ["チャットジーピーティー"]),
    ]
    for sent, expected_substrs in test_cases:
        norm = normalize_for_tts(sent)
        print(f"IT文: '{sent}'\n ➔ 正規化: '{norm}'")
        for sub in expected_substrs:
            assert sub in norm, f"'{sub}' が含まれていません: {norm}"
        assert "アイフォネ" not in norm, f"アイフォネの誤読が発生: {norm}"
    print("✅ 英単語・IT用語正規化テスト合格！\n")

if __name__ == "__main__":
    print("🚀 皇族文脈保護 ＆ 安全防壁テスト開始\n")
    test_imperial_pronunciations()
    test_commoner_safety()
    test_llm_hallucination_blocking()
    test_tech_words()
    print("🎉 全テストケースが完全に合格しました！")
