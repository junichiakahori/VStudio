#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
トークン制限拡張および途切れ不完全文（「生活も。」「常磁。」「現地で撮。」等）の
検知・除去・自己修復テスト
"""
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from server.news_script_processor import (
    validate_news_script_quality,
    audit_and_heal_news_script
)

def test_validation_incomplete_endings():
    print("=== 1. validate_news_script_quality の不完全文末検知テスト ===")
    
    # テスト1: 助詞終了（「生活も。」）
    bad_text_1 = (
        "学校の教育現場で働き方改革が進んでいることを知ったにゃ。"
        "OHK岡山放送のアナウンサーが、夏休み中の中学校に勤務する教師に話を聞き、その現状を取材したにゃ。"
        "具体的には、14年前から教師として働いていて、当時は午前6時に家を出て午後9時まで帰宅するのが普通だったにゃ。"
        "熱血的に指導し、生徒たちは自分の直すべきところが明確になるにゃ。"
        "働き方改革のおかげで、教師たちの生活も。"
    )
    is_valid, reason = validate_news_script_quality(bad_text_1)
    print(f"助詞終了テキスト判定: valid={is_valid}, reason={reason}")
    assert not is_valid, "助詞終了テキストはNG判定されるべきです"
    assert "助詞で途切れています" in reason or "不完全" in reason

    # テスト2: 語幹・未完漢字終了（「FGTが常磁。」）
    bad_text_2 = (
        "大阪大学の研究グループが、ファンデルワールス強磁性体Fe5GeTe2FGTを使った新しい発見をしたにゃ。"
        "このFGTは常磁性から強磁性へと磁気相が変化する際に、電流をスピン流に変換する効率が約1桁も変わるというにゃ。"
        "これはスピンホール効果の研究にとって大きな進歩なんだにゃ。"
        "スピン流は磁性体の磁化を効率的に制御できるから、次世代不揮発性磁気メモリの駆動原理として注目されているんだにゃ。"
        "さらに、測定温度を系統的に変化させたところ、FGTが常磁。"
    )
    is_valid, reason = validate_news_script_quality(bad_text_2)
    print(f"未完漢字テキスト判定: valid={is_valid}, reason={reason}")
    assert not is_valid, "未完漢字テキストはNG判定されるべきです"
    assert "体言止め・ぶつ切り文" in reason

    # テスト3: 正常な文末（「〜注目が集まっているにゃ！」）
    good_text = (
        "学校の教育現場で働き方改革が進んでいることを知ったにゃ。"
        "OHK岡山放送のアナウンサーが、夏休み中の中学校に勤務する教師に話を聞き、その現状を取材したにゃ。"
        "具体的には、14年前から教師として働いていて、当時は午前6時に家を出て午後9時まで帰宅するのが普通だったにゃ。"
        "熱血的に指導し、生徒たちは自分の直すべきところが明確になるにゃ。"
        "働き方改革のおかげで、教師たちの生活環境も改善されていきそうだにゃ！"
    )
    is_valid, reason = validate_news_script_quality(good_text)
    print(f"正常テキスト判定: valid={is_valid}, reason={reason}")
    assert is_valid, f"正常テキストは合格するべきです: {reason}"
    print("✅ バリデーション検知テスト成功！")

def test_audit_and_heal_incomplete_endings():
    print("\n=== 2. audit_and_heal_news_script の末尾不完全文トリムテスト ===")
    raw_items = [
        {"display": "学校の教育現場で働き方改革が進んでいることを知ったにゃ。", "speech": "学校の教育現場で働き方改革が進んでいることを知ったにゃ。"},
        {"display": "OHK岡山放送のアナウンサーが、夏休み中の中学校に勤務する教師に話を聞き、その現状を取材したにゃ。", "speech": "OHK岡山放送のアナウンサーが、夏休み中の中学校に勤務する教師に話を聞き、その現状を取材したにゃ。"},
        {"display": "具体的には、14年前から教師として働いていて、当時は午前6時に家を出て午後9時まで帰宅するのが普通だったにゃ。", "speech": "具体的には、14年前から教師として働いていて、当時は午前6時に家を出て午後9時まで帰宅するのが普通だったにゃ。"},
        {"display": "熱血的に指導し、生徒たちは自分の直すべきところが明確になるにゃ。", "speech": "熱血的に指導し、生徒たちは自分の直すべきところが明確になるにゃ。"},
        {"display": "働き方改革のおかげで、教師たちの生活も。", "speech": "働き方改革のおかげで、教師たちの生活も。"}
    ]
    
    healed = audit_and_heal_news_script(raw_items)
    print(f"修復前文数: {len(raw_items)} ➔ 修復後文数: {len(healed)}")
    print(f"修復後最終文: {healed[-1]['display']}")
    assert len(healed) == 4, f"不完全な5文目は除去されて4文になるべきです (実際: {len(healed)}文)"
    assert healed[-1]["display"] == "熱血的に指導し、生徒たちは自分の直すべきところが明確になるにゃ。"
    print("✅ audit_and_heal 自己修復テスト成功！")

if __name__ == "__main__":
    test_validation_incomplete_endings()
    test_audit_and_heal_incomplete_endings()
    print("\n🎉 全ての途切れ・不完全文対策テストに合格しました！")
