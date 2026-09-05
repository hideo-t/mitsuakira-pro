# 三晶プロダクション 公式サイト

> 白河から、落語のモンスターを。

落語家・三遊亭円左衛門が福島県白河市に開く落語道場・芸能事務所「三晶プロダクション（みつあきら）」の公式サイト。

**公開URL** ─ https://hideo-t.github.io/mitsuakira-pro/

## 構成

```
index.html      サイト本体（CSS/JSすべて埋め込みのスタンドアロン構成）
admin.html      管理画面（イベント／申込／サポーター／基本情報設定）
gallery.html    写真ギャラリー
gas/            Google Apps Script。予約・会員登録・通知メールの実体
docs/           セットアップ手順
scripts/        デプロイ自動化
images/         写真素材
.nojekyll       GitHub Pages での誤処理を回避
```

サイトは静的HTML、データの保存とメール送信は Google Apps Script と
スプレッドシートが担当している。サーバーもデータベースも要らない。

## 仕様

- **読み**：みつあきら
- **英語表記**：Mitsuakira Production
- **キャッチコピー**：白河から、落語のモンスターを。
- **コーポレートメッセージ**：一富士　二鷹　三遊亭円左衛門
- **対応言語**：日本語／英語（画面右上で切替）
- **デザイン**：和モダン（緋色 / 江戸紺 / 生成り）、明朝体ベース
- **対応端末**：レスポンシブ（PC・タブレット・スマートフォン）

## ローカル確認

```bash
npm run serve
# http://localhost:8000 を開く
```

または `index.html` をブラウザで直接開いても動く。

## サイトのデプロイ（GitHub Pages）

`main` に push すれば自動で反映される。設定は Settings → Pages で
`Deploy from a branch` / `main` / `(root)`。

独自ドメインを使う場合は、ルートに `CNAME` を置き、DNS の CNAME レコードを
`hideo-t.github.io` に向けて、Settings → Pages の Custom domain に入力する。

## GAS のデプロイ

**HTMLの push とは別**。GAS 側は clasp で送る。

```bash
npm run gas:deploy
```

構文チェック → push → 既存デプロイの差し替え、までを1コマンドで行う。
**公開URLは変わらない。** 手順と初回設定は [docs/GAS_DEPLOY.md](docs/GAS_DEPLOY.md)。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/GAS_DEPLOY.md](docs/GAS_DEPLOY.md) | clasp の初回設定とデプロイ手順 |
| [docs/SETTINGS_SETUP.md](docs/SETTINGS_SETUP.md) | 管理画面「基本情報設定」と通知先の使い方 |
| [docs/GAS_SETUP.md](docs/GAS_SETUP.md) | GAS とスプレッドシートの初期構築 |
| [GAS_PAYMENT_SETUP.md](GAS_PAYMENT_SETUP.md) | 決済まわり |

## 未実装

- お問い合わせフォーム
- コンテスト応募フォーム（2027年9月予定）
- 物販ページ
- 中国語繁体字版
- 過去公演動画ギャラリー

## 既知の課題

- `gas/supporter-registration.gs` に LINE のチャネルアクセストークンが直書きされている。
  このリポジトリは public のため、**トークンの再発行と、スクリプトプロパティへの移動が必要**。
- 管理画面のパスワードが `localStorage` に平文で保存され、GAS への問い合わせでは
  URLのクエリ文字列に載る。
- `images/` の写真が無圧縮（10枚で約3.3MB）。

## クレジット

- 設計・実装：高橋秀夫（三晶プロダクション 外部パートナー）
- 監修：三遊亭円左衛門（取締役）／菊池（副代表）

## ライセンス

本サイトのコンテンツの著作権は三晶プロダクションに帰属します。

---

&copy; 2026 Mitsuakira Production
