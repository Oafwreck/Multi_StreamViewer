# AGENTS.md

## 使用技術

- Vanilla HTML / CSS / ES Modules
- Node.js 20+（開発サーバー・テスト・ビルドのみ）
- 外部UIライブラリなし

## コマンド

- 起動: `npm start` → `http://localhost:4173`
- ビルド: `npm run build`（`dist/` を生成）
- 検証: `npm run lint` / `npm test` / `npm run check`

## 主要ディレクトリ

- `src/`: 画面、状態管理、配信URL解析、設定
- `tests/`: Node標準テスト
- `docs/`: 仕様と判断記録
- `reports/`: ブラウザで読む検証結果

## 調整値

- 上限、タイムアウト、保存キー: `src/config.js`
- 色、余白、文字、モーション: `tokens.css`

## 壊れやすい機能

- Twitch埋め込みは実行ホストと`parent`の一致が必須。
- YouTubeチャットはライブ配信のみ。ブラウザや配信者の埋め込み設定にも依存する。
- 選択切替でプレイヤーiframeを再生成しないこと。再生成すると再生位置が失われる。

## 実装ルール

- 配信プロバイダー差分は`src/providers.js`に閉じ込める。
- 状態変更は`src/store.js`経由。DOMを状態の保存先にしない。
- ユーザー入力をHTML文字列として挿入しない。
- 最大8画面とエラー・空・読込状態を維持する。

