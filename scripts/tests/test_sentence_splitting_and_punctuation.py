#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_sentence_splitting_and_punctuation.py
文分割処理（split_sentences_safely）、助詞マッチガード、
孤立語尾マージ、および不自然な「。にゃ。」「！分断」防止の単体テスト
"""

import unittest
from server.news_script_processor import (
    split_sentences_safely,
    inspect_and_correct_pronunciation,
    audit_and_heal_news_script
)

class TestSentenceSplittingAndPunctuation(unittest.TestCase):

    def test_split_sentences_no_inline_exclamation_split(self):
        """文中のインライン感嘆符（！）で文が細切れに分断されないことを検証"""
        text = "素晴らしいですね！今後の活躍も楽しみですにゃ。"
        parts = split_sentences_safely(text)
        self.assertEqual(len(parts), 1)
        self.assertEqual(parts[0], "素晴らしいですね！今後の活躍も楽しみですにゃ。")

    def test_split_sentences_with_newline_or_space_exclamation(self):
        """感嘆符の直後に改行や空白＋次文がある場合は適切に分割されることを検証"""
        text = "素晴らしい活躍ですね！\n今後の展開にも注目したいところですにゃ。"
        parts = split_sentences_safely(text)
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0], "素晴らしい活躍ですね！")
        self.assertEqual(parts[1], "今後の展開にも注目したいところですにゃ。")

    def test_split_sentences_double_punctuation_nya(self):
        """「。にゃ。」や「！にゃ！」などの二重句読点が正規化され、語尾が孤立しないことを検証"""
        text = "試合に勝利した。にゃ。感動したのだ。"
        parts = split_sentences_safely(text)
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0], "試合に勝利したにゃ。")
        self.assertEqual(parts[1], "感動したのだ。")

    def test_split_sentences_brand_exclamation_protected(self):
        """Yahoo! などのブランド名感嘆符で誤分割されないことを検証"""
        text = "Yahoo!ニュースによると、大谷選手がホームランを放ちました！すごいですね。"
        parts = split_sentences_safely(text)
        self.assertEqual(len(parts), 1)
        self.assertIn("Yahoo!ニュース", parts[0])

    def test_inspect_and_correct_isolated_nya_merge(self):
        """単独の「にゃ！」が助詞「に」として誤爆せず、直前の文へ綺麗にマージされることを検証"""
        raw_sentences = [
            "これは、1・0％程度に引き上げた6月会合以来3カ月ぶりの利上げとなる。",
            "にゃ！"
        ]
        items = inspect_and_correct_pronunciation(raw_sentences, "日銀 金利")
        self.assertEqual(len(items), 1)
        disp = items[0]["display"]
        self.assertNotIn("。 にゃ", disp)
        self.assertNotIn("。にゃ", disp)
        self.assertTrue(disp.endswith("利上げとなるにゃ！") or disp.endswith("利上げとなるにゃ。"))

    def test_audit_and_heal_weird_nya_punctuations(self):
        """audit_and_heal_news_script での「。にゃ。」や二重にゃの自動修復を検証"""
        items = [
            {
                "display": "特に、影響を与えていると聞きましたにゃ。 にゃ！",
                "speech": "とくに、えいきょうをおよぼしているとききましたにゃ。 にゃ！"
            },
            {
                "display": "試合に勝利した。にゃ。",
                "speech": "しあいにしょうりした。にゃ。"
            }
        ]
        healed = audit_and_heal_news_script(items, "ニュース")
        self.assertNotIn("にゃ。 にゃ", healed[0]["display"])
        self.assertNotIn("。 にゃ", healed[0]["display"])
        self.assertTrue(healed[0]["display"].endswith("にゃ！"))
        self.assertEqual(healed[1]["display"], "試合に勝利したにゃ。")

if __name__ == '__main__':
    unittest.main()
