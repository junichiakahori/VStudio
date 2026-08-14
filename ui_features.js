// ui_features.js
// HMRエントリーポイント: このファイルが変更されたとき、
// live2d-app.js 側の bindUIEvents() が再実行される。
// UIバインド処理の実体は live2d-app.js の bindUIEvents() 関数にある。

export const UI_FEATURES_VERSION = Date.now();

export function notifyReady() {
    // live2d-app.js が HMR で このモジュールを受け取ったとき呼ばれる
    if (window.__rebindUI) {
        window.__rebindUI();
    }
}

