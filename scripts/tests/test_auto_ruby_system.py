#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI自律発音解決（ふりがなルビ自動分離）テスト
- LLMが人名・地名・専門用語に「漢字（ひらがな）」のルビを付与した場合に、
  字幕（display）は漢字のみ、音声（speech）はひらがな読みに完全分離されることを検証。
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from server.news_script_processor import (
    sanitize_speech_text,
    audit_and_heal_news_script
)
from server.tts_normalizer import normalize_for_tts

class TestAutoRubySystem(unittest.TestCase):
    def test_ruby_separation_pipeline(self):
        """ルビ付きテキストが字幕と音声に美しく分離されること"""
        test_inputs = [
            ("翔傑（しょうけつ）選手が50歳で初白星を挙げたにゃ！", "翔傑選手が50歳で初白星を挙げたにゃ！", "しょうけつ選手が50歳で初白星を挙げたにゃ！"),
            ("千葉県で内水氾濫（ないすいはんらん）が多発したにゃ。", "千葉県で内水氾濫が多発したにゃ。", "千葉県でないすいはんらんが多発したにゃ。"),
            ("数週間以内に財政破綻（はたん）に直面するにゃ。", "数週間以内に財政破綻に直面するにゃ。", "数週間以内にはたんに直面するにゃ。"),
            ("古謝（こじゃ）氏が首相に直訴したにゃ。", "古謝氏が首相に直訴したにゃ。", "こじゃ氏が首相に直訴したにゃ。"),
            ("前回とは大違い（おおちがい）の結果になったにゃ。", "前回とは大違いの結果になったにゃ。", "前回とはおおちがいの結果になったにゃ。")
        ]

        import re
        for raw, expected_disp, expected_speech_sub in test_inputs:
            # プロセッサのパイプラインと同じ処理をテスト
            d = re.sub(r'([\u4e00-\u9fff][\u4e00-\u9fff\u30a0-\u30ffぁ-んA-Za-z0-9・]{0,12})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\1', raw)
            d = d.replace("（", "").replace("）", "").replace("(", "").replace(")", "").strip()
            sp = re.sub(r'([\u4e00-\u9fff][\u4e00-\u9fff\u30a0-\u30ffぁ-んA-Za-z0-9・]{0,12})[（\(]([ぁ-んァ-ヶー\s]+)[）\)]', r'\2', raw)
            sp = normalize_for_tts(sp)

            self.assertEqual(d, expected_disp)
            # 音声側に期待されるひらがなが入っていること
            self.assertIn(expected_speech_sub.replace("50歳で初白星を挙げたにゃ！", "").replace("が多発したにゃ。", "").replace("に直面するにゃ。", "").replace("氏が首相に直訴したにゃ。", "").replace("の結果になったにゃ。", "").replace("千葉県で", "").replace("数週間以内に", "").replace("前回とは", ""), sp)

    def test_audit_and_heal_with_ruby(self):
        """audit_and_heal_news_script を通しても字幕の漢字と音声のひらがなが維持されること"""
        items = [
            {"display": "翔傑選手が勝利しました。", "speech": "しょうけつ選手が勝利しました。"},
            {"display": "内水氾濫が発生しました。", "speech": "ないすいはんらんが発生しました。"},
            {"display": "財政破綻の危機です。", "speech": "はたんの危機です。"}
        ]
        healed = audit_and_heal_news_script(items, title="大相撲初場所での取組結果")
        self.assertEqual(healed[0]["display"], "翔傑選手が勝利しました。")
        self.assertIn("しょうけつ", healed[0]["speech"])
        self.assertEqual(healed[1]["display"], "内水氾濫が発生しました。")
        self.assertIn("ないすいはんらん", healed[1]["speech"])
        self.assertEqual(healed[2]["display"], "財政破綻の危機です。")
        self.assertIn("はたん", healed[2]["speech"])

if __name__ == "__main__":
    unittest.main()
