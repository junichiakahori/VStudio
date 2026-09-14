#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
「方（かた／ほう）」の文脈依存読み分け・自己修復テスト
- 人を指す「かた」（〜という方、通行人の方、遭われた方、偉大な方等）が「かた」に補正されること
- 助言・比較・方向・複合語の「ほう」（〜した方がいい、あっちの方、一方、使い方等）が誤変換されないこと
- 字幕（display）は漢字「方」を100%維持し、音声（speech）側のみ「かた」に補正されること
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from server.tts_normalizer import apply_person_kata_rules, normalize_for_tts
from server.news_script_processor import audit_and_heal_news_script

class TestPersonKataHealing(unittest.TestCase):
    def test_toiu_kata_readings(self):
        """「〜という方」が正しく「というかた」に補正されること"""
        cases = [
            ("張本勲さんという方、ご存じですかにゃ？", "張本勲さんというかた"),
            ("玉置さんという方が、傘寿を迎えられたにゃ。", "玉置さんというかたが"),
            ("江橋香織さんという方が野球部を支えています。", "江橋香織さんというかたが"),
            ("値上がりで手が出ないという方も多いにゃ。", "手が出ないというかたも多いにゃ。")
        ]
        for text, expected in cases:
            res = apply_person_kata_rules(text)
            self.assertIn(expected, res)

    def test_noun_kata_readings(self):
        """人物名詞＋「の方」が正しく「のかた」に補正されること"""
        cases = [
            ("通行人の方の治療費が3900万円に上った。", "通行人のかたの"),
            ("ファンの方々に感謝を伝えたにゃ。", "ファンのかた々に"),
            ("被災者の方々の支援に繋がります。", "被災者のかた々の"),
            ("一般の方からも多くの応募がありました。", "一般のかたからも")
        ]
        for text, expected in cases:
            res = apply_person_kata_rules(text)
            self.assertIn(expected, res)

    def test_verb_kata_readings(self):
        """動詞連体形＋「方」が正しく「かた」に補正されること"""
        cases = [
            ("被害に遭われた方にお見舞いを申し上げます。", "遭われたかたに"),
            ("事故で亡くなられた方に哀悼の意を表します。", "亡くなられたかたに"),
            ("イベントに参加された方にお話を聞きました。", "参加されたかたに"),
            ("伝統を伝えてくれた方で、功績は大きいにゃ。", "伝えてくれたかたで")
        ]
        for text, expected in cases:
            res = apply_person_kata_rules(text)
            self.assertIn(expected, res)

    def test_adjective_kata_readings(self):
        """形容動詞＋「な方」が正しく「なかた」に補正されること"""
        cases = [
            ("野球界に大きな影響を与えた偉大な方だったにゃ。", "偉大なかた"),
            ("親切な方々に助けられました。", "親切なかた々に"),
            ("各界で著名な方が登壇されました。", "著名なかたが")
        ]
        for text, expected in cases:
            res = apply_person_kata_rules(text)
            self.assertIn(expected, res)

    def test_hou_protection(self):
        """「ほう」文脈（助言・比較・方向・熟語）が誤って「かた」に変換されないこと"""
        hou_cases = [
            "朝は時間に余裕を持った行動をした方がいいにゃ！",
            "必要な準備をしておいた方がいいにゃ。",
            "あっちの方を見てください。",
            "使い方によってはとても便利です。",
            "一方では批判の声も上がっています。",
            "今後の基本方針が決定されました。",
            "多方面からの支援が行われています。",
            "雨の日でも楽しむ方法を考えようにゃ！",
            "これはイラン側の見方なんだにゃ。"
        ]
        for text in hou_cases:
            res = apply_person_kata_rules(text)
            # 「かた」が含まれていない（または元からあった「使い方」等の単語以外に余計な「かた」が増えていない）
            if "使い方" in text:
                self.assertEqual(res, text)
            else:
                self.assertNotIn("かた", res, f"誤変換発生: {text} ➔ {res}")

    def test_audit_and_heal_display_speech_separation(self):
        """audit_and_heal_news_script で字幕（display）は漢字「方」を維持し、音声（speech）側のみ「かた」になること"""
        items = [
            {"display": "張本勲さんという方をご存じですか？", "speech": "張本勲さんという方をご存じですか？"},
            {"display": "通行人の方の治療費が支払われました。", "speech": "通行人の方の治療費が支払われました。"},
            {"display": "朝は早めに出発した方がいいですね。", "speech": "朝は早めに出発した方がいいですね。"}
        ]
        healed = audit_and_heal_news_script(items)

        # 1. 張本勲さんという方
        self.assertIn("という方", healed[0]["display"])
        self.assertIn("というかた", healed[0]["speech"])

        # 2. 通行人の方
        self.assertIn("通行人の方", healed[1]["display"])
        self.assertIn("通行人のかた", healed[1]["speech"])

        # 3. 出発した方がいい（「ほう」はそのまま維持）
        self.assertIn("した方がいい", healed[2]["display"])
        self.assertIn("した方がいい", healed[2]["speech"])
        self.assertNotIn("したかたがいい", healed[2]["speech"])

if __name__ == "__main__":
    unittest.main()
