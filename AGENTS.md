# VStudio 開発・UI設計 永続ルール

## 1. UIテキスト・レイアウトの厳格ルール（最重要）

- **不自然な改行・文字切れの絶対禁止**:
  - 日本語UIのラベル、スイッチ、ボタン、見出しなどを追加・編集する際、単語や助詞の途中での不自然な折り返しを絶対に発生させないこと。
  - スイッチラベルやボタンなどのインラインUIには、適切な `white-space: nowrap;` や `word-break: keep-all;` を指定し、パネル幅（約300px）に収まる自然でスマートな文言（例: `📡 OBS配信を同時に開始`）を採用すること。
  - カードやオーバーレイ枠（アジェンダボード、ニュースボード等）を配置する際は、最長のテキスト（例:「エンタメ・カルチャー」「IT・テクノロジー」）が入っても末尾が `...` で途切れたり枠外にはみ出したりしない十分な幅とパディングを最初から設計すること。

- **パネル内コンポーネント（スイッチ・ボタン）の共通設計パターンの厳格遵守**:
  - 設定トグルは必ず既存の `.switch-label` + `<span class="slider round"></span>` 形式（テキスト左、スライダ右端）で統一すること。
  - スイッチラベルには長文説明を入れず、10〜14文字程度の端的なラベル（例: `💖 配信リアクション演出`、`💬 リアルタイム字幕テロップを表示`）にすること。
  - アクションボタン（テスト実行等）を設置する場合は、タイトル行に無理に詰め込まず、下段に独立した `width: 100%;` または明確なパディングを持つボタンとして配置すること。

- **CSS・JSキャッシュ対策**:
  - CSS / JS / HTML を更新した際は、必ず `views/live2d.html` などのクエリパラメータ（例: `/css/live2d-styles.css?v=X.X`, `/js/live2d-app.js?v=X.X`）をインクリメントして即時反映させること。

## 2. プロジェクトディレクトリ構造と配置ルール（最重要）

プロジェクトのルート直下を常にミニマルに保ち、各ファイルは責務ごとの専用ディレクトリへ配置・管理すること。

- **`server/` (バックエンドサーバー & サービスモジュール)**:
  - `local_api_server.py`: APIルーター本体（約300行。ビジネスロジックは持たず専任モジュールへディスパッチ）
  - `news_script_processor.py`: ニュース原稿生成・プロンプト構築・ファクト照合・字幕/音声分離
  - `news_crawler.py`: ニュース記事本文スクレイピング・RSS事前キャッシュ
  - `tts_normalizer.py`: TTS用テキスト正規化・Wikipedia読み動的解決・残存漢字ひらがな化
  - `voicevox_client.py`: VOICEVOX通信・音声合成・アクセントカナ整形
  - `log_manager.py`: ログ管理・日次/サイズ別自動ローテーション
  - `youtube_api_helper.py`: YouTube OAuth認証・配信枠作成/更新・サムネイル送信
  - `youtube_comment_server.py` / `tiktok_comment_server.py`: コメント取得WebSocketサーバー
- **`views/` (HTML画面テンプレート)**:
  - `live2d.html`, `ui_panel.html`, `wizard.html`, `log_console.html`, `news_list.html` 等の全HTMLを集約（Vite透過ルーティングにより `/live2d.html` 等で直接アクセス可能）
- **`js/` & `js/lib/` (フロントエンドスクリプト & 外部ライブラリ)**:
  - `live2d-app.js`, `ai_features.js`, `idle_phrases.js`, `chat-client.js` 等の機能別JS
  - `js/lib/`: `pixi.min.js`, `live2dcubismcore.min.js`, `pixi-live2d-display.min.js` 等のサードパーティライブラリ
- **`css/` (スタイルシート)**:
  - `live2d-styles.css`
- **`data/` (原稿データ・キャッシュ・設定)**:
  - `news_script*.txt`, `radio_script*.txt`, `prompts.json`, `article_urls.json`, `hiragana_data.json` 等
- **`config/` (認証情報・証明書・機密設定)**:
  - `client_secret.json`, `token.pickle`, `*.pem` （※ Git管理外 / `.gitignore` 必須）
- **`scripts/` (スクリプト・ツール)**:
  - `scripts/build_app.sh`: macOSネイティブアプリビルドスクリプト
  - `scripts/tests/`: 単体テスト・検証用スクリプト
  - `scripts/tools/`: 辞書加工・データ生成ツール

## 3. コード設計・品質・保守性ルール

- **ハードコーディングの禁止とスマートな共通設計**:
  - 固有名詞や特定の文字列をソースコード内に場当たり的にハードコーディングすることを禁止する。
  - ルールベースの正規化、辞書データ（`dict/`, `data/`）、動的API解決（Wikipedia等）、またはLLMプロンプト設計を活用して汎用的に解決すること。
- **ルーターとロジックの分離**:
  - APIサーバー（`server/local_api_server.py`）に長大な処理やビジネスロジックを直接記述せず、必ず `server/` 配下の専任モジュールに関数として切り出して呼び出すこと。
- **UTF-8 エンコーディングの徹底**:
  - すべての JavaScript / HTML / CSS / Python ファイルは UTF-8 で記述・保存すること。

## 4. システム・ポート構成

- **Vite Dev Server**: `8443` (HTTPS / フロントエンド & 透過ルーティング)
- **server/local_api_server.py**: `8001` (HTTP: APIサーバー)
- **server/youtube_comment_server.py**: `8768` (WebSocket: YouTubeコメント)
- **server/tiktok_comment_server.py**: `8767` (WebSocket: TikTokコメント)

## 5. 配信中のファイル編集・Vite自動監視の永続ルール（最重要）

- **配信中のフロントエンドコード編集の厳格禁止**:
  - OBS配信中・番組進行中は、画面へのエラーオーバーレイ表示や意図しない影響を防ぐため、フロントエンド（JS / HTML / CSS）ファイルの編集を絶対に行わないこと。
- **Viteの自動監視・エラーオーバーレイの完全無効化**:
  - `vite.config.js` では `hmr: false`、`watch: { ignored: ['**'] }` を維持し、ブラウザへの自動リロードやエラー画面のポップアップを恒久的に遮断すること。
