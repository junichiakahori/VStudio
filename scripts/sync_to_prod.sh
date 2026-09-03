#!/bin/bash
# =====================================================================
# sync_to_prod.sh: VStudio-dev から VStudio（本番）への安全同期スクリプト
# =====================================================================

set -e

DEV_DIR="/Users/junichiakahori/Documents/Antigravity/VStudio-dev"
PROD_DIR="/Users/junichiakahori/Documents/Antigravity/VStudio"

echo "=========================================================="
echo "🚀 VStudio-dev ➔ VStudio 本番同期プロセスを開始します"
echo "=========================================================="

if [ ! -d "$DEV_DIR" ] || [ ! -d "$PROD_DIR" ]; then
    echo "❌ ディレクトリが見つかりません。"
    exit 1
fi

# 1. ソースコードディレクトリ・ファイルの同期（ポート設定や機密ファイル・ログ・データは除外）
echo "📦 1. 専任モジュール・スクリプト・HTML・CSSの同期中..."

rsync -av --delete "$DEV_DIR/js/" "$PROD_DIR/js/"
rsync -av --delete "$DEV_DIR/views/" "$PROD_DIR/views/"
rsync -av --delete "$DEV_DIR/css/" "$PROD_DIR/css/"
rsync -av --delete --exclude="__pycache__" "$DEV_DIR/server/" "$PROD_DIR/server/"
rsync -av --delete "$DEV_DIR/scripts/" "$PROD_DIR/scripts/" 2>/dev/null || true

# AGENTS.md と主要設定（vite.config.js のポート差分は維持）の同期
if [ -f "$DEV_DIR/AGENTS.md" ]; then
    cp "$DEV_DIR/AGENTS.md" "$PROD_DIR/AGENTS.md"
fi

echo "✅ 2. ソースコードの同期が完了しました。"

# 2. 構文チェック
echo "🔍 3. 同期後ファイルの構文チェックを実行中..."
cd "$PROD_DIR"
node --check js/audio-voicevox.js
node --check js/wizard/wizard-core.js
node --check js/wizard/wizard-youtube-api.js
node --check js/wizard/wizard-finish.js
python3 -m py_compile server/local_api_server.py server/tts_normalizer.py

echo "=========================================================="
echo "🎉 本番環境への同期および検証がすべて完了しました！"
echo "   配信時間外の安全なタイミングで API サーバー等を再起動してください。"
echo "=========================================================="
