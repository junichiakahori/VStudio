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

## 6. 配信スケジュール・テスト検証運用ルール（最重要）

- **配信スケジュール帯での本番直接編集・サーバー再起動の禁止**:
  - **朝の配信時間帯**: 毎日 `AM 6:00 〜 AM 10:00`
  - **夜の配信時間帯**: 毎日 `PM 6:00 〜 PM 11:00`
  - 上記の配信コアタイム中は、本番の稼働中ファイルへの直接修正やサーバー再起動を避け、安全なメンテナンス時間帯（`10:00 〜 18:00` または深夜）に実施すること。
- **本番配信とテスト環境の完全分離**:
  - **本番配信**: macOS ネイティブアプリ（独立ウィンドウ・OBS安定キャプチャ）で実施。
  - **動作検証・テスト**: Safari 等のブラウザ（`https://localhost:8443/...`）からアクセスして検証・デバッグを行うこと。

## 7. 本番環境（VStudio）と開発環境（VStudio-dev）の完全同期運用ルール

- **開発成果の本番完全同期の徹底**:
  - 開発・検証（Safari: `http://localhost:8444` / API: `8002`）で修正・リファクタリング・動作確認を行った成果物は、配信時間外の安全な時間帯に **必ず本番環境（`VStudio`）へ漏れなく完全適用・同期** すること。
  - Gitリポジトリ（`VStudio`）へのコミット・プッシュ時にも、本番と開発の両方のファイル構成に齟齬がないかを常に確認すること。

## 8. フロントエンド JavaScript のイベントバインド・DOM待機ルール

- **DOMContentLoaded および readyState による完全保護（最重要）**:
  - ボタン（`.onclick` / `.addEventListener`）、トグル、スライダーなどのDOM要素を初期化・バインドする処理は、スクリプト読み込みタイミングによる `null` 参照事故を絶対に防ぐため、必ず以下のパターンで実装すること：
    ```javascript
    function initUIComponents() {
      const btn = document.getElementById("target-btn");
      if (btn) { btn.onclick = () => { ... }; }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initUIComponents);
    } else {
      initUIComponents();
    }
    ```

## 9. ポップアップ（子ウィンドウ）と親画面（openerWin）の連携ルール

- **子ウィンドウ破棄による非同期タスク中断の防止（WebKit/Safari仕様）**:
  - ウィザード画面などの子ウィンドウから親ウィンドウ（`openerWin`）の処理（ニュース開始・ラジオ開始等）を実行する場合、子ウィンドウ側で非同期タイマー（`setTimeout`）を持ったまま `window.close()` を呼ぶと、WebKitのガベージコレクションによって非同期処理が強制終了される。
  - 親画面のアクションをキックする際は、**`window.close()` を呼ぶ直前に親ウィンドウのDOMボタン（`news-broadcast-start-btn` 等）を直接同期クリック（`.click()`）** するか、`localStorage` のポート別シグナル通信を併用して 100% 確実に親側で処理を実行させること。

## 10. Safari Web Audio API（効果音・BGM・音声）の再生制御ルール

- **共通 AudioContext の再利用と試聴テストボタンの常備**:
  - Safariでは、ユーザーの明示的なインタラクションなしに新しい `<audio>` 要素（HTML5 Audio）を非同期再生すると、Autoplay制限（`NotAllowedError`）で無音になる。
  - 効果音（SE: チャイム、シーン切り替え音等）の再生には、既に画面起動時にアンロックされている実績のある共通オーディオコンテキスト（`getVoicevoxAudioContext()`）を活用すること。
  - ウィザードやUIパネルには、ユーザーが事前に音声・チャイムを直接確認できる「試聴テストボタン」を必ず配置し、オーディオエンジンのアクティブ化を保証すること。

## 11. 1ファイル巨大化防止と専任モジュール化ルール（1ファイル 300〜500行以内）

- **単一責任の原則に基づくディレクトリ分割**:
  - 1つのJavaScriptファイルに数千行を詰め込むモノリシック構成を禁止し、責務ごとに 300〜500行以内の専用モジュールへ分割・管理すること。
  - **ニュース機能の分割例**:
    - `js/news/news-fetcher.js`: 20+ RSS取得・XMLパース・重複排除
    - `js/news/news-media-resolver.js`: メディア名正規化・見出しクリーンアップ
    - `js/news/news-state-manager.js`: 既読タイトル・進行ステート管理
    - `js/news/news-ui-board.js`: ニュースボード・アジェンダ描画
    - `js/news/news-audio-player.js`: SE再生・繋ぎセリフ生成
    - `js/news/news-list-popup.js`: 別窓一覧ポップアップ
    - `js/news/news-config-manager.js`: 時刻別挨拶・設定取得
    - `js/news/news-comment-interlude.js`: コメント挟み込み返信
    - `js/news-mode.js`: 各モジュールを統括する薄いコントローラー

## 12. フロントエンド設計・モジュール分割・正規表現の再発防止ルール（最重要）

- **WebKit / Safari 特有のグローバル変数重複・シャドウイング構文エラーの完全防止**:
  - 非モジュールスクリプト（`<script src="...">`）環境では、同一グローバルスコープまたは `window` プロパティと同名の変数を `let` や `const` で重複宣言すると、WebKit（Safari）エンジンでは `SyntaxError: Can't create duplicate variable that shadows a global property` が発生し、**スクリプト全体が1文字も実行されずに即死・破棄** される。
  - モジュール間を跨ぐ共有変数や設定定数は、ローカルの `let`/`const` 宣言を避け、必ず `window.xxx = window.xxx || ...;` 形式で定義・参照すること。

- **関数シグネチャ・インターフェースのユニバーサル互換設計**:
  - 複数モジュールや旧コードから呼び出される共通関数（例: `isInvalidNewsVideoArticle`）を切り出す際は、引数の型（オブジェクト `{title, description}` 渡し vs 個別引数 `(title, desc)` 渡し）の不一致による事故を絶対に防ぐため、以下のユニバーサル互換パターンで実装すること：
    ```javascript
    function isInvalidNewsVideoArticle(arg1, arg2) {
      let title = typeof arg1 === "object" && arg1 !== null ? (arg1.title || "") : (typeof arg1 === "string" ? arg1 : "");
      let desc = typeof arg1 === "object" && arg1 !== null ? (arg1.description || "") : (typeof arg2 === "string" ? arg2 : "");
      if (!title) return true;
      ...
    }
    ```

- **過剰・広範な正規表現によるデータ全滅（誤爆除外）の絶対禁止**:
  - ニュース記事やコメントの除外フィルターに、`/配信中/i` や `/動画/i` などの一般的すぎる単語を単独で登録してはならない（本文内の「〜より配信中」等の通常メタ情報にヒットして全件0件になる事故を招く）。
  - 除外正規表現は必ず `/【動画】/i`, `/動画配信中/i`, `/動画をご覧ください/i` のように、文脈が限定された確実なパターンのみを指定すること。

- **推測回答の禁止と実データ・実ログによる検証の徹底**:
  - 不具合が発生した際は、推測や仮説のみでユーザーに回答・対応することを厳禁とする。必ず `logs/browser_console.log` の実ログ、実際のAPIレスポンス、実際のデータを通した単体・結合テストを実行し、100% 事実を確認した上で回答・修正を行うこと。

- **ブラウザスタックトレースのクエリ欠落仕様への対応**:
  - ブラウザの `(new Error()).stack` は、ファイルパスから `?v=X.X` を削ぎ落として出力する仕様であるため、バージョンログ追跡には DOM の `script[src]` からクエリを自動逆引き結合するエンジン（`getScriptVersion`）を維持すること。

## 13. UIコンポーネント・オーバーレイ要素のドラッグ操作性・初期化の永続ルール

- **全画面オーバーレイ・フローティングボードの `draggable.js` 一元登録義務（最重要）**:
  - 画面上に配置されるすべてのフローティングUI（時計、統計、コメントビューア、字幕テロップ、ニュースボード、トピックス/アジェンダボード等）は、必ず `js/draggable.js` の `initDraggableElements()` に登録すること。
  - 各要素には、掴みやすいドラッグハンドル（ヘッダー部、または専用ハンドル `⋮⋮`）と、画面位置を次回以降も復元する `storageKeyPrefix`（`localStorage` キー）を必ず設定すること。

- **モジュール分割時の「インタラクション操作」脱落防止**:
  - UIの描画処理（例: `news-ui-board.js`）を専任モジュールへ切り出す際、描画ロジック（DOM生成・テキスト差し替え）のみに集中して、ドラッグ移動・リサイズ・クリックイベント等の「操作系バインド」が脱落する事故を絶対に起こさないこと。
  - モジュール分割時は、表示・更新だけでなく「ユーザー操作（ドラッグ・クリック）」が維持されているかを必ず結合テストで確認すること。

- **動的表示・遅延表示要素に対する冪等ドラッグ初期化**:
  - 起動時に `display: none` で隠れており、配信開始やニュース読み上げ時に動的に表示される要素についても、`data-draggable-init="true"` による多重バインド防止（冪等性）を保ちつつ、表示開始時に 100% ドラッグ操作が効く状態を保証すること。

## 14. サーバープロセス管理・ポート停止におけるクライアント保護ルール（最重要）

- **`lsof -i :PORT` によるブラウザ・クライアント巻き添え強制終了（クラッシュ）の絶対禁止**:
  - `lsof -i :PORT` は、サーバー（LISTEN）だけでなく、WebSocketやHTTPで接続しているクライアント（Safari、Chrome、macOS ネイティブアプリの WebKit プロセス `com.apple...`）の PID もすべて出力する。
  - 単純に `lsof -t -i :PORT` の結果を `kill -9` すると、**接続中だった配信ブラウザ画面やネイティブアプリ本体が直接強制終了（画面リロード・クラッシュ）され、最悪の放送事故** を引き起こす。
  - サーバープロセスの停止には、必ず以下のいずれかの安全な手法を義務付ける：
    1. スクリプト名によるピンポイント停止: `pkill -9 -f "python3.*${script_name}"`
    2. ポート停止時は必ず `-sTCP:LISTEN` かつ `COMMAND` 名が `python` や `node` であることを確認し、ブラウザ（WebKit/Safari/Chrome/Electron）の PID を 100% 除外・保護すること。

## 15. AITuber リスナー管理（CRM）・コメント日付記録システム設計規約

- **チャンネルIDをマスターキーとするリスナー台帳（`data/users/listeners.json`）の永続管理**:
  - ハンドル名（`@handle`）や表示名の揺らぎに左右されないよう、YouTubeチャンネルID（またはTikTokユーザーID）を一意の主キーとする。
  - 以下の属性を確実に蓄積・更新すること：
    1. `userId`: チャンネルID / ユーザーID
    2. `displayName`: 最新の表示名（例: 毛玉雀）
    3. `handle`: ハンドル名（例: @毛玉雀）
    4. `firstSeen`: 初回コメント日時（YYYY-MM-DD HH:MM:SS）
    5. `lastSeen`: 最終コメント日時（YYYY-MM-DD HH:MM:SS）
    6. `activeDates`: コメントしてくれた日付一覧の配列（`["2026-09-03", ...]`）
    7. `visitDaysCount`: 通算来訪日数
    8. `totalComments`: 累計コメント数
    9. `recentComments`: 直近コメント（日付・本文）の配列（最大20件）
  - これにより、「初見」「常連」「久しぶり」「連続来訪」のインテリジェントな認知・AI返信を実現する。

## 16. ニュースURLキャッシュの日付管理・自動ローテーション規約

- **`data/article_urls.json` の日付管理型（直近2日保持）ローテーション**:
  - ニュース記事は日次で入れ替わるため、無制限に溜め込まず「当日＋前日」の2日間のみを保持する構造（`{ "YYYY-MM-DD": { "タイトル": "URL" } }`）で管理する。
  - 2日以上前の古い日付キーは自動的に破棄し、常に数百件（数十KB）の超軽量状態を維持すること。
  - コメント返信などの非ニュース記事タイトルがURLキャッシュに混入することを恒久的に防止すること。

## 17. YouTubeコメント絵文字・スタンプの自動復元規約

- **ショートコード（`:front_facing_baby_chick:` 等）のUnicode絵文字（🐥）への完全自動デコード**:
  - YouTube Live Chat（pytchat）から受信したメッセージに含まれる絵文字ショートコードを検知し、即座に対応するUnicode絵文字記号（例: `:front_facing_baby_chick:` ➔ `🐥`, `:sparkles:` ➔ `✨`）へ復元すること。
  - これにより、画面上のコメントビューアに英字コードが露出するのを防ぎ、VOICEVOXやAI返信が不自然な英単語を読み上げる事故を完全に防止する。
- **カスタムスタンプ（メンバー限定絵文字等）の画像インライン表示**:
  - チャンネル独自のカスタム絵文字については画像URLを保持し、コメントビューア上で崩れずに表示できる構造を維持すること。

## 18. ブロッキングダイアログ（alert/confirm/prompt）の完全禁止と非同期トースト通知の徹底（最重要）

- **ブラウザ標準ダイアログ（`alert()`, `confirm()`, `prompt()`）のコードベース全体での完全禁止**:
  - `alert()` や `confirm()` などの同期ブロッキングダイアログは、JavaScriptのメインスレッドを停止させ、タイマー、WebSocket通信、Live2Dアニメーション、配信処理、画面更新のすべてをフリーズ・停止させるため、**一切の使用を永久に禁止** する。
  - ユーザーへの操作完了、保存成功、入力エラー、通知表示には、必ず画面の動きを止めない **非同期トースト通知（`showWizardToast`, `showNotification` 等）** やインラインの視覚的フィードバック（ボタンテキストの一時変化など）を使用すること。
  - 各HTML画面（`wizard.html`、`live2d.html` 等）では、万が一のライブラリや未検知呼び出しに備えて `window.alert` をトースト通知へ自動リダイレクトする安全保護機構を常備すること。

