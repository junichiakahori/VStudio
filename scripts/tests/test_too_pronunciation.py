#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_too_pronunciation.py
「東奥」「東奥日報」「東奥義塾」のTTS読み上げ正規化および
原稿再チェック（audit_and_heal_news_script）での誤読自己修復テスト
"""

import os
import sys
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from server.tts_normalizer import normalize_for_tts
from server.news_script_processor import audit_and_heal_news_script

class TestTooPronunciation(unittest.TestCase):

    def test_normalize_for_tts_too(self):
        """normalize_for_tts で東奥が『とうおう』に正規化されることを検証"""
        tests = [
            ("東奥日報によると、青森県内でイベントが開催された。", "とうおうにっぽう"),
            ("東奥義塾高校の試合結果が報じられました。", "とうおうぎじゅく"),
            ("東奥地域の伝統的な行事です。", "とうおう")
        ]
        for src, expected in tests:
            res = normalize_for_tts(src)
            print(f"[TTS正規化] '{src}' ➔ '{res}'")
            self.assertIn(expected, res)
            self.assertNotIn("ひがしおく", res)

    def test_audit_and_heal_too_misreading(self):
        """原稿再チェック（audit_and_heal_news_script）で万が一『ひがしおく』が発生しても『とうおう』へ自己修復されることを検証"""
        items = [
            {
                "display": "東奥日報によると、大雪の影響で交通機関に乱れが出ているとのことですにゃ。",
                "speech": "ひがしおくにっぽうによると、おおゆきのえいきょうでこうつうきかんにみだれがでているとのことですにゃ。"
            },
            {
                "display": "東奥義塾が春のセンバツ出場を決めました！",
                "speech": "ひがしおくぎじゅくがはるのせんばつしゅつじょうをきめました！"
            },
            {
                "display": "東奥の歴史について詳しく解説されています。",
                "speech": "ひがしおくのれきしについてくわしくかいせつされています。"
            }
        ]
        healed = audit_and_heal_news_script(items, "東奥 ニュース")
        for idx, it in enumerate(healed):
            print(f"[自己修復後 #{idx}] 表示: {it['display']} / 音声: {it['speech']}")
            self.assertNotIn("ひがしおく", it["speech"])
            self.assertIn("とうおう", it["speech"])

if __name__ == '__main__':
    unittest.main()
