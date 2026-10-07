#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/tests/test_inline_greeting_validation.py
================================================
個別記事原稿内での不適切な挨拶（「皆さんこんにちは」「おはようございます」「こんばんは」等）の
ダブルチェック検知（放送事故防止）およびサニタイズ除去の単体検証テスト
"""

import os
import sys
import unittest
import re

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
sys.path.insert(0, BASE_DIR)

from server.news_script_processor import validate_news_script_quality


class TestInlineGreetingValidation(unittest.TestCase):
    """個別記事原稿内の挨拶検知・放送事故防止テスト"""

    def test_greeting_minna_konnichiwa_rejected(self):
        """「皆さんこんにちはにゃ！」を含む原稿がダブルチェックでNG判定されること"""
        text = (
            "スタメン発表のニュース、皆さんこんにちはにゃ！"
            "青森県の高校野球準決勝の試合で、横浜と花巻東のスタメンが発表されましたにゃ。"
            "横浜は3年生の右腕投手が先発マウンドへ向かいましたにゃ。"
            "花巻東も強力な打線で対抗し、熱い試合展開が期待されるんだにゃ！"
        )
        is_ok, err_msg = validate_news_script_quality(
            text, title="横浜と花巻東のスタメン発表", article_context="高校野球準決勝が行われました。"
        )
        self.assertFalse(is_ok, "皆さんこんにちはを含む原稿が承認されてしまいました")
        self.assertIn("不適切な挨拶", err_msg)

    def test_greeting_fans_konnichiwa_rejected(self):
        """「ファンの皆さん、こんにちはにゃ！」を含む原稿がダブルチェックでNG判定されること"""
        text = (
            "オーバーウォッチのファンの皆さん、こんにちはにゃ！"
            "今週から待望の新シーズンがスタートし、新サポートヒーローが登場しましたにゃ。"
            "新マップや既存ヒーローのリワークなど、盛りだくさんのコンテンツが用意されていますにゃ。"
            "新しいシーズンをみんなで思い切り楽しんでほしいにゃ！"
        )
        is_ok, err_msg = validate_news_script_quality(
            text, title="オーバーウォッチ新シーズン開幕", article_context="新シーズンがスタートしました。"
        )
        self.assertFalse(is_ok, "ファンの皆さんこんにちはを含む原稿が承認されてしまいました")
        self.assertIn("不適切な挨拶", err_msg)

    def test_greeting_ohayo_rejected(self):
        """「おはようございます」を含む原稿がダブルチェックでNG判定されること"""
        text = (
            "おはようございますにゃ！最新の経済指標が発表されましたにゃ。"
            "消費者物価指数は前年同月比で上昇し、市場の予想を上回る結果となりましたにゃ。"
            "今後の金融政策にも注目が集まりそうだにゃ。"
            "これからの動きをしっかり見守っていきたいにゃ！"
        )
        is_ok, err_msg = validate_news_script_quality(
            text, title="最新の経済指標発表", article_context="物価指数が上昇しました。"
        )
        self.assertFalse(is_ok, "おはようございますを含む原稿が承認されてしまいました")
        self.assertIn("不適切な挨拶", err_msg)

    def test_greeting_konbanwa_rejected(self):
        """「リスナーの皆さん、こんばんは！」を含む原稿がダブルチェックでNG判定されること"""
        text = (
            "リスナーの皆さん、こんばんはにゃ！夜の速報ニュースをお届けしますにゃ。"
            "国際宇宙ステーションから無事に補給船が帰還しましたにゃ。"
            "実験サンプルも無事回収されたとのことなんだにゃ。"
            "宇宙開発の進歩は本当に素晴らしい成果だにゃ！"
        )
        is_ok, err_msg = validate_news_script_quality(
            text, title="補給船が無事帰還", article_context="宇宙ステーションから帰還しました。"
        )
        self.assertFalse(is_ok, "こんばんはを含む原稿が承認されてしまいました")
        self.assertIn("不適切な挨拶", err_msg)

    def test_normal_script_without_greeting_passed(self):
        """挨拶を含まない正常な原稿はダブルチェックをパスすること"""
        text = (
            "青森県の高校野球準決勝の試合で、横浜と花巻東のスタメンが発表されましたにゃ。"
            "横浜は3年生の右腕投手が先発マウンドへ向かいましたにゃ。"
            "一方の花巻東も強力な打線で対抗し、両チームとも積極的な攻撃を見せましたにゃ。"
            "これからの展開がとても楽しみな試合になりそうだにゃ！"
        )
        is_ok, err_msg = validate_news_script_quality(
            text, title="横浜と花巻東のスタメン発表", article_context="高校野球準決勝が行われました。"
        )
        self.assertTrue(is_ok, f"正常な原稿が不当に拒絶されました: {err_msg}")

    def test_legitimate_quoted_greeting_in_article_passed(self):
        """元記事自体に挨拶文が含まれる正当な話題（映画名やセリフ引用等）は誤爆拒絶されないこと"""
        text = (
            "山田洋次監督の新作映画『こんにちは、母さん』の舞台挨拶が行われましたにゃ。"
            "主演の吉永小百合さんや大泉洋さんが登壇し、撮影の思い出を語りましたにゃ。"
            "会場は温かい拍手と笑顔に包まれ、大盛況となったんだにゃ。"
            "心温まる家族の物語に期待が高まるにゃ！"
        )
        is_ok, err_msg = validate_news_script_quality(
            text, title="映画『こんにちは、母さん』舞台挨拶", article_context="映画『こんにちは、母さん』の舞台挨拶が行われました。"
        )
        self.assertTrue(is_ok, f"正当な作品名『こんにちは、母さん』が誤爆拒絶されました: {err_msg}")

    def test_clean_inline_greetings_strips_unwanted_greetings(self):
        """実例の不要な挨拶が clean_inline_greetings で綺麗に切除されること"""
        from server.news_script_processor import clean_inline_greetings

        # 実例1: 横浜と花巻東
        text1 = "スタメン発表のニュース、皆さんこんにちはにゃ！青森県の高校野球準決勝の試合で、横浜と花巻東のスタメンが発表されましたにゃ。"
        cleaned1 = clean_inline_greetings(text1, title="横浜と花巻東スタメン発表", article_context="高校野球準決勝")
        self.assertNotIn("こんにちは", cleaned1)
        self.assertIn("横浜と花巻東のスタメンが発表されましたにゃ。", cleaned1)

        # 実例2: オーバーウォッチ
        text2 = "オーバーウォッチのファンの皆さん、こんにちはにゃ！今週から待望のシーズン5がスタートしましたにゃ。"
        cleaned2 = clean_inline_greetings(text2, title="オーバーウォッチ新シーズン", article_context="新シーズン開幕")
        self.assertNotIn("こんにちは", cleaned2)
        self.assertIn("今週から待望のシーズン5がスタートしましたにゃ。", cleaned2)

        # 実例3: 映画『こんにちは、母さん』は保護されること
        text3 = "映画『こんにちは、母さん』の舞台挨拶が行われましたにゃ。"
        cleaned3 = clean_inline_greetings(text3, title="映画『こんにちは、母さん』舞台挨拶", article_context="映画『こんにちは、母さん』")
        self.assertIn("こんにちは、母さん", cleaned3)


if __name__ == "__main__":
    unittest.main()
