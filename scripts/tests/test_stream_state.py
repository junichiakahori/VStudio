#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_stream_state.py - 配信状態管理システムの統合テスト
"""

import os
import sys
import json
import unittest
import subprocess

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PROJECT_ROOT)

from server.local_api_server import load_stream_state, save_stream_state, STREAM_STATE_FILE

class TestStreamState(unittest.TestCase):
    def setUp(self):
        # テスト前の状態を保存
        self.original_state = load_stream_state()

    def tearDown(self):
        # テスト後に元に戻す
        save_stream_state(self.original_state)

    def test_save_and_load(self):
        test_state = {
            "is_streaming": True,
            "stream_type": "news",
            "updated_at": "2026-11-10T12:00:00",
            "details": {
                "obs_streaming": True,
                "news_running": True,
                "radio_running": False,
                "title": "テストニュース配信"
            }
        }
        save_stream_state(test_state)
        loaded = load_stream_state()
        self.assertTrue(loaded["is_streaming"])
        self.assertEqual(loaded["stream_type"], "news")
        self.assertTrue(loaded["details"]["news_running"])

    def test_cli_tool(self):
        cli_path = os.path.join(PROJECT_ROOT, "scripts", "tools", "check_stream_state.py")

        # 1. 配信停止状態
        save_stream_state({
            "is_streaming": False,
            "stream_type": "none",
            "updated_at": "2026-11-10T12:00:00",
            "details": {}
        })
        res = subprocess.run([sys.executable, cli_path, "--env", "dev", "--quiet"])
        self.assertEqual(res.returncode, 0, "配信停止状態では終了コード0になるべき")

        # 2. 配信中状態
        save_stream_state({
            "is_streaming": True,
            "stream_type": "news",
            "updated_at": "2026-11-10T12:00:00",
            "details": {"news_running": True}
        })
        res = subprocess.run([sys.executable, cli_path, "--env", "dev", "--quiet"])
        self.assertEqual(res.returncode, 1, "配信中状態では終了コード1になるべき")

        # 3. CLIからの状態セット
        res = subprocess.run([sys.executable, cli_path, "--env", "dev", "--set", "false", "--quiet"])
        self.assertEqual(res.returncode, 0)
        loaded = load_stream_state()
        self.assertFalse(loaded["is_streaming"])

if __name__ == "__main__":
    unittest.main()
