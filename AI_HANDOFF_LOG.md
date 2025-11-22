# AIタスク引継ぎログ

## プロジェクト概要
**TradeLog Pro** - FXトレード記録・分析・計算ツール（Vanilla JS + Supabase）

## 直近の変更内容 (Day 3 - Lot Calculator & Refactoring)

1.  **ロット計算機能 (`js/features/lot-calculator.js`)**
    *   **UI刷新**: カテゴリー選択（カード式）→ 銘柄選択（プルダウン）→ 計算フォームのフローに変更。
    *   **状態管理**: `state` オブジェクトによるリアクティブなUI更新（`render`関数）。
    *   **DOM構築**: `el` ヘルパー関数（`js/utils/dom.js`）を使用し、`innerHTML`依存を排除。
    *   **契約仕様**: `js/config/pairs-config.js` に通貨ペア・CFDの仕様（contractSize, pipValue等）を集約。
    *   **レート取得**: `js/services/rate-service.js` で無料API（Frankfurter, CoinGecko）を利用。キャッシュ機能付き。
    *   **計算ロジック**:
        *   **GOLD/Commodity**: 契約サイズ100、1ドル変動=15000円（150円換算）として計算。損切り幅はドル単位。
        *   **株式(日経225)**: 契約サイズ100（CFD）、1ポイント=100円。損切り幅は円/ポイント単位。
        *   **小数点処理**: GOLDは0.01ロット単位、Cryptoは0.0001単位などで丸め処理。
    *   **設定機能**: 口座タイプ（国内/海外/マイクロ）ごとの設定を `js/core/settings.js` と連携して復元。

2.  **CSS (`css/pages.css`)**
    *   ロット計算機用のスタイルを `.lot-calculator` スコープ配下に集約（他画面への影響防止）。
    *   計算結果のフォントサイズ調整、レスポンシブ対応。

3.  **リファクタリング & バグ修正**
    *   `app.js`: タブ切り替え時の初期化ロジック修正（設定タブの復元）。
    *   `dom.js`: `value`, `checked` 等のプロパティ設定ロジック改善。
    *   **編集履歴**: トレード記録の編集機能と履歴保存（Supabase `edit_history` column JSONB）。

## 次のアクション / 未実装項目

1.  **マスコット機能の拡充 (`js/features/mascot/`)**
    *   現状はプロトタイプ。アセット画像（`assets/images/mascot/`）の配備と、レベルアップ時の進化演出の実装が必要。
2.  **AI分析機能**
    *   プロンプト生成ロジックの改善（より具体的なアドバイス生成）。
3.  **テスト**
    *   計算ロジックのユニットテスト（特にエッジケース）。
4.  **モバイルUX**
    *   入力フォームのスクロール挙動などの微調整。

## ファイル構成メモ
*   `js/features/lot-calculator.js`: ロット計算のメインロジック & UI
*   `js/config/pairs-config.js`: 通貨ペア定義（ここを修正すれば計算の前提が変わる）
*   `js/services/rate-service.js`: レートAPI連携
*   `js/utils/dom.js`: DOM生成ヘルパー（Reactの`createElement`的な役割）

---
*Log generated: 2025-11-21*


