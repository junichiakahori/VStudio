#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server/youtube_comment_server.py のネスト平坦化リファクタリング検証用ユニットテスト
"""

import unittest
import ast
import os
import sys

# テスト対象モジュールのインポート
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from server.youtube_comment_server import (
    _extract_channel_name_from_html,
    parse_youtube_html_stats,
    resolve_youtube_video_id,
    _extract_port_from_arg,
    _parse_cli_port,
    safe_terminate_chat,
    _resolve_single_emoji,
    decode_youtube_emojis
)

class TestYouTubeCommentServerRefactor(unittest.TestCase):

    def test_nesting_depth_rule23(self):
        """AGENTS.md ルール23: ネスト深さが最大3階層以下であることを検証"""
        target_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../server/youtube_comment_server.py"))
        with open(target_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read())

        nesting_nodes = (ast.If, ast.For, ast.While, ast.Try, ast.With)
        violations = []

        def check_nesting(node, current_depth=0, func_name="<module>"):
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    check_nesting(child, 0, child.name)
                elif isinstance(child, nesting_nodes):
                    new_depth = current_depth + 1
                    if new_depth > 3:
                        violations.append((func_name, child.lineno, new_depth, type(child).__name__))
                    check_nesting(child, new_depth, func_name)
                else:
                    check_nesting(child, current_depth, func_name)

        check_nesting(tree)
        self.assertEqual(len(violations), 0, f"Nesting violations found: {violations}")

    def test_extract_channel_name_from_html(self):
        """HTMLからのチャンネル名抽出テスト"""
        html_og = '<html><head><meta property="og:title" content="テストチャンネル"></head></html>'
        self.assertEqual(_extract_channel_name_from_html(html_og), "テストチャンネル")

        html_title = '<html><head><title>公式チャンネル - YouTube</title></head></html>'
        self.assertEqual(_extract_channel_name_from_html(html_title), "公式チャンネル")

        html_none = '<html><head></head></html>'
        self.assertIsNone(_extract_channel_name_from_html(html_none))

    def test_parse_youtube_html_stats(self):
        """HTML統計パーサーテスト"""
        sample_html = '''
        ytInitialPlayerResponse = {"videoDetails": {"viewCount": "10500"}};</script>
        "videoViewCountRenderer": {"viewCount": {"runs": [{"text": "456"}, {"text": "人が視聴中"}]}}}
        "likeCount": "123"
        "videoSecondaryInfoRenderer": {"subscriberCountText": {"label": "チャンネル登録者数 10万人"}}
        '''
        cv, tv, lk, sb = parse_youtube_html_stats(sample_html)
        self.assertEqual(cv, "456")
        self.assertEqual(tv, "10,500")
        self.assertEqual(lk, "123")
        self.assertEqual(sb, "チャンネル登録者数 10万人")

    def test_resolve_youtube_video_id(self):
        """動画ID解決ロジックテスト"""
        import server.youtube_comment_server as ycs
        old_client = ycs.youtube_api_client
        try:
            # API自動検出を無効化してURLパースを単体検証
            ycs.youtube_api_client = None

            # 直接ID
            vid, info = resolve_youtube_video_id("dQw4w9WgXcQ")
            self.assertEqual(vid, "dQw4w9WgXcQ")

            # watch URL
            vid, info = resolve_youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
            self.assertEqual(vid, "dQw4w9WgXcQ")

            # 短縮 URL
            vid, info = resolve_youtube_video_id("https://youtu.be/dQw4w9WgXcQ")
            self.assertEqual(vid, "dQw4w9WgXcQ")

            # 空文字列
            vid, info = resolve_youtube_video_id("")
            self.assertEqual(vid, "")
        finally:
            ycs.youtube_api_client = old_client

    def test_port_parsing(self):
        """CLIおよび環境変数からのポートパーステスト"""
        self.assertEqual(_extract_port_from_arg("--port", "8778"), 8778)
        self.assertEqual(_extract_port_from_arg("--port=8779", None), 8779)
        self.assertIsNone(_extract_port_from_arg("--other", "1234"))

        # argv からの解決
        port = _parse_cli_port(["script.py", "--port", "9000"], {}, default_port=8768)
        self.assertEqual(port, 9000)

        # env からの解決
        port = _parse_cli_port(["script.py"], {"PORT": "9001"}, default_port=8768)
        self.assertEqual(port, 9001)

        # デフォルト値
        port = _parse_cli_port(["script.py"], {}, default_port=8768)
        self.assertEqual(port, 8768)

    def test_safe_terminate_chat(self):
        """safe_terminate_chat の安全性テスト"""
        # None を渡してもエラーにならないこと
        safe_terminate_chat(None)

        # 例外を投げるオブジェクトでもキャッチされること
        class BadChat:
            def terminate(self):
                raise RuntimeError("Failed to terminate")
        safe_terminate_chat(BadChat())

    def test_emoji_decoding(self):
        """YouTube絵文字ショートコード復元テスト"""
        text = "こんにちは :front_facing_baby_chick: :sparkles:"
        decoded = decode_youtube_emojis(text)
        self.assertIn("🐥", decoded)
        self.assertIn("✨", decoded)

if __name__ == "__main__":
    unittest.main()
