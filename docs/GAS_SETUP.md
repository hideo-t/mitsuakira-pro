# 三晶プロダクション GAS セットアップガイド

## 概要

このドキュメントは、三晶プロダクションのイベント予約・サポーター登録システムの
Google Apps Script (GAS) セットアップ手順を記録したものです。

---

## 1. スプレッドシート構造

### 必要なシート

| シート名 | 用途 |
|---------|------|
| `events` | イベントマスタ（22列） |
| `reservations` | イベント予約DB（21列） |
| `members` | サポーター会員マスタ（19列） |
| `email_log` | メール送信ログ（9列） |
| `管理者マスタ` | 管理者認証情報（5列） |
| `debug_log` | デバッグログ（自動作成） |

### events シート カラム構造（重要）

```
0: event_id        - イベントID (EV-YYYYMMDD-NN)
1: title           - イベント名
2: description     - 説明
3: date            - 開催日 (YYYY-MM-DD)
4: time_open       - 開場時間
5: time_start      - 開演時間
6: time_end        - 終演時間
7: venue_name      - 会場名
8: venue_address   - 会場住所
9: venue_access    - アクセス情報
10: capacity       - 定員
11: reserved_count - 予約済み数
12: waitlist_count - キャンセル待ち数
13: price_general  - 一般料金
14: price_member   - 会員料金
15: price_includes - 料金に含まれるもの
16: accept_start   - 受付開始日
17: accept_end     - 受付終了日
18: status         - ステータス (draft/published/open/full/closed)
19: image_url      - 画像URL
20: created_at     - 作成日時
21: updated_at     - 更新日時
```

**注意**: `getPublicEvents()` は `status` をカラム18から読み取ります。
カラム順序を変更すると表示されなくなります。

---

## 2. 初期セットアップ手順

### Step 1: GASプロジェクト作成

1. Google Apps Script (https://script.google.com) を開く
2. 「新しいプロジェクト」を作成
3. `gas/supporter-registration.gs` の内容をコピー＆ペースト
4. プロジェクト名を「三晶プロダクション」などに変更

### Step 2: スプレ��ドシートIDの設定

```javascript
const SPREADSHEET_ID = 'あなたのスプレッドシートID';
```

スプレッドシートURLから取得:
`https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### Step 3: 管理者マスタの設定

スプレッドシートに「管理者マスタ」シートを作成:

| メールア��レス | パスワー�� | 名前 | 権限 | 作成日 |
|--------------|-----------|------|------|-------|
| admin@example.com | password123 | 管理者 | admin | 2026/05/02 |

**重要**: メールアドレスは実在するものを使用（GmailApp.sendEmailの送信元）

### Step 4: テストデータのセットアップ

GASエディタで以下の関数を実行:

```javascript
setupTestData()  // テストイベントと全シートを初���化
```

これにより:
- テストイベント `EV-20260610-01` が作成される
- 定員: 50名、予約数: 0
- 一般料金: 3000円、会員料金: 2500円
- ステータス: `published`

### Step 5: 権限の承認

GASエディタで以下の関数を実行して権限を承認:

```javascript
testEmailSend()  // Gmail送信権限を承認
```

初回実行時に「承認が必要です」と表示されるので、許可する。

---

## 3. デプロイ手順

### 新規デプロイ

1. GASエディタで「デプロイ」→「新しいデプロイ」
2. 種類: **ウェブアプリ**
3. 設定:
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユー��ー**: 全員
4. 「デプロイ」をクリック
5. URLをコピー

### index.html の更新

```javascript
const GAS_URL = '新しいデプロイURL';
```

### デプロイ確認（pingテスト）

ブラウザで以下にアクセス:
```
[GAS_URL]?action=ping
```

期待される応答:
```json
{"success":true,"message":"pong","timestamp":"..."}
```

---

## 4. トラブルシューティング

### イベントが表示されない

1. **eventsシートのカラム順序を確認**
   - `status` がカラム18（19列目）にあるか
   - `date` がカラム3（4列目）にあるか

2. **ステータスを確認**
   - `published`, `open`, `full` のみ表示される
   - `draft`, `closed` は表示されない

3. **日付を確認**
   - 過去のイベントは表示されない

### 予約できない（残席0）

1. **eventsシートの `reserved_count` を確認**
2. **`capacity` が設定されているか確認**
3. **resetTestData() を実行して予約数をリセット**

### メールが届かない

1. **管理者マスタのメールアドレスが実在するか確認**
2. **GASエディタで `testEmailSend()` を実行してテスト**
3. **迷惑メールフォルダを確認**

### debug_log の確認

問題発生時は `debug_log` シートを確認:
- `doPost_start` - POSTリクエスト受信
- `action` - 実行されたアクション
- `ERROR` - エラー詳細

---

## 5. 便利な関数

### setupTestData()
全シートを初期化し、テストイベントを作成

### resetTestData()
予約・会員・メールログをクリア、予約数をリセット

### testEmailSend()
メール送信テスト（権限承認用）

---

## 6. チャネル追跡（LINE/Web/Email）

### 予約データに記録される情報

`reservations` シートの `channel` カラムに流入経路を記録：

| チャネル | 説明 |
|---------|------|
| `web` | 通常のWebサイト経由（デフォルト） |
| `line` | LINE経由 |
| `email` | メール経由 |
| `sns` | SNS経由 |

### LINE経由の追跡方法

1. **URLパラメータ**: `?from=line`
   - LINEのリッチメニューやメッセージからのリンクに追加
   - 例: `https://hideo-t.github.io/mitsuakira-pro/?from=line#events`

2. **リファラー検出**
   - `line.me` または `lin.ee` からのリファラーを自動検出

### LINE公式アカウント設定

LINE Official Account Managerで設定：
1. **リッチメニュー** - イベントページへのリンクに `?from=line` を追加
2. **あいさつメッセージ** - サイトリンクに `?from=line` を追加
3. **自動応答** - 「イベント」「予約」等のキーワードで案内

---

## 7. 本番運用時の注意

1. **管理者マスタのパスワードを変更する**
2. **SPREADSHEET_ID を本番用に変更する**
3. **テストデータを削除する**
4. **debug_log シートを定期的にクリアする**

---

## 更新履歴

- 2026-05-02: 初��作成
  - カラム構造の不一致問題を解決
  - setupTestData/resetTestData関数を追加
  - デバッグログ機能を強化
