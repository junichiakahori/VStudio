#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配信原稿の誤読・誤字・不自然表現に関する包括的自己修復テスト
- MUFG 等の頭字語読み
- 「男性さん」等の不自然な敬称誤爆防止
- 不要な解説括弧ルビ（しーぴーあい 等）の除去
- 「緊急事態非常事態」等の二重化一本化
- 特殊外国人名「周啓豪」等の正確な読み
- 助詞重複「〜が注目が集まる」の文法修復
- 「大（おお／だい）」の文脈別読み分け（大違い、大一番、大舞台、大人気ない等）
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from server.news_script_processor import (
    audit_and_heal_news_script,
    validate_news_script_quality
)
from server.tts_normalizer import normalize_for_tts

class TestExtendedReadingsHealing(unittest.TestCase):
    def test_acronym_readings(self):
        """MUFG, SMBC, CPI, FRB などの略語が正しく読まれること"""
        norm_mufg = normalize_for_tts("MUFGの株価が上昇しています。")
        self.assertIn("エムユーエフジー", norm_mufg)
        self.assertNotIn("マフグ", norm_mufg)

        norm_cpi = normalize_for_tts("米国のCPIが発表されました。")
        self.assertTrue("シーピーアイ" in norm_cpi or "しーぴーあい" in norm_cpi)

    def test_invalid_san_prevention(self):
        """「男性さん」「容疑者さん」などの一般名詞・被害者・加害者への敬称誤爆が防止されること"""
        items = [
            {"display": "水泳大会で男性さんが溺れました。", "speech": "水泳大会で男性さんが溺れました。"}
        ]
        healed = audit_and_heal_news_script(items)
        self.assertNotIn("男性さん", healed[0]["display"])
        self.assertNotIn("男性さん", healed[0]["speech"])
        self.assertIn("男性", healed[0]["display"])

    def test_ruby_bracket_removal_in_speech(self):
        """音声テキスト内の不要な解説ルビ括弧が除去され、字幕では保持されること"""
        items = [
            {
                "display": "消費者物価指数（しーぴーあい）が上昇しました。",
                "speech": "消費者物価指数（しーぴーあい）が上昇しました。"
            }
        ]
        healed = audit_and_heal_news_script(items)
        # 字幕は保持
        self.assertIn("（しーぴーあい）", healed[0]["display"])
        # 音声テキストからは除去されて重複読みを防ぐ
        self.assertNotIn("（しーぴーあい）", healed[0]["speech"])
        self.assertNotIn("しーぴーあい", healed[0]["speech"])

    def test_duplicated_word_consolidation(self):
        """「緊急事態非常事態」などの異常な単語二重化が自動一本化されること"""
        items = [
            {
                "display": "現地で緊急事態非常事態が宣言されました。",
                "speech": "現地できんきゅうじたいひじょうじたいが宣言されました。"
            }
        ]
        healed = audit_and_heal_news_script(items)
        self.assertNotIn("緊急事態非常事態", healed[0]["display"])
        self.assertIn("緊急事態", healed[0]["display"])
        self.assertNotIn("きんきゅうじたいひじょうじたい", healed[0]["speech"])
        self.assertIn("きんきゅうじたい", healed[0]["speech"])

    def test_foreign_player_reading(self):
        """「周啓豪」が「しゅうけいごう」と正しく読まれること"""
        items = [
            {"display": "周啓豪選手が勝利しました。", "speech": "周啓豪選手が勝利しました。"}
        ]
        healed = audit_and_heal_news_script(items, title="卓球世界大会決勝の試合結果")
        # 字幕は漢字維持（スポーツ文脈のため「選手」も維持）
        self.assertEqual("周啓豪選手が勝利しました。", healed[0]["display"])
        # 音声は「しゅうけいごう」へ補正
        self.assertIn("しゅうけいごう", healed[0]["speech"])

    def test_particle_duplication_grammar_fix(self):
        """「〜が注目が集まる」の助詞重複が文法修復されること"""
        items = [
            {
                "display": "今後の動向が注目が集まる展開となっています。",
                "speech": "今後の動向が注目が集まる展開となっています。"
            }
        ]
        healed = audit_and_heal_news_script(items)
        self.assertIn("動向に注目が集まる", healed[0]["display"])
        self.assertIn("動向に注目が集まる", healed[0]["speech"])

    def test_dai_vs_oo_contextual_readings(self):
        """「大（だい／おお）」の文脈依存読み分けが正常に機能すること"""
        # A. おお と読む和語複合語
        items = [
            {"display": "前回とは大違いの結果になりました。", "speech": "前回とは大違いの結果になりました。"},
            {"display": "決勝の大一番を迎えます。", "speech": "決勝の大一番を迎えます。"},
            {"display": "世界の大舞台で活躍しています。", "speech": "世界の大舞台で活躍しています。"},
            {"display": "そんなことで怒るのは大人気ない対応ですね。", "speech": "そんなことで怒るのは大人気ない対応ですね。"}
        ]
        healed = audit_and_heal_news_script(items)
        
        # 字幕は漢字表記のまま
        self.assertIn("大違い", healed[0]["display"])
        self.assertIn("大一番", healed[1]["display"])
        self.assertIn("大舞台", healed[2]["display"])
        self.assertIn("大人気ない", healed[3]["display"])

        # 音声は「おお」「おとなげ」に補正
        self.assertIn("おお違い", healed[0]["speech"])
        self.assertIn("おお一番", healed[1]["speech"])
        self.assertIn("おお舞台", healed[2]["speech"])
        self.assertIn("おとなげない", healed[3]["speech"])

        # B. だい と読む漢語熟語は「だい」のまま変化しない
        items_dai = [
            {"display": "大企業の業績が回復しています。", "speech": "大企業の業績が回復しています。"},
            {"display": "世界中で大人気のゲームです。", "speech": "世界中で大人気のゲームです。"}
        ]
        healed_dai = audit_and_heal_news_script(items_dai)
        self.assertIn("大企業", healed_dai[0]["speech"])
        self.assertIn("大人気", healed_dai[1]["speech"])
        self.assertNotIn("おお企業", healed_dai[0]["speech"])
        self.assertNotIn("おとなげ", healed_dai[1]["speech"])

if __name__ == "__main__":
    unittest.main()
