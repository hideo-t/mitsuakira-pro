<<<<<<< HEAD
# 三昌プロダクション 公式サイト（仮公開版）

> 白河から、落語のモンスターを。

落語家・三遊亭円左衛門が福島県白河市に開く落語道場・芸能事務所「三昌プロダクション（みつあきら）」の公式サイト（仮公開版）。

## 構成

- `index.html` ─ メインHTML（CSS/JSすべて埋め込みのスタンドアロン構成）
- `.nojekyll` ─ GitHub Pagesでの誤処理を回避

## 仕様

- **読み**：みつあきら
- **キャッチコピー**：白河から、落語のモンスターを。
- **コーポレートメッセージ**：一富士　二鷹　三遊亭円左衛門
- **対応言語**：日本語／英語（画面右上で切替）
- **デザイン**：和モダン（緋色 / 江戸紺 / 生成り）、明朝体ベース
- **対応端末**：レスポンシブ（PC・タブレット・スマートフォン）

## ローカル確認

```bash
# Pythonで簡易サーバー起動
python3 -m http.server 8000
# http://localhost:8000 を開く
```

または `index.html` をブラウザで直接開けば動きます。

## GitHub Pages へのデプロイ手順

### 1. GitHub にリポジトリを作成

GitHub上で空のリポジトリを作成（推奨名：`mitsuakira-pro`）。

### 2. ローカルから push

```bash
cd mitsuakira-pro
git init
git add .
git commit -m "feat: 三昌プロダクション 仮サイト初版"
git branch -M main
git remote add origin https://github.com/hideo-t/mitsuakira-pro.git
git push -u origin main
```

### 3. GitHub Pages を有効化

1. リポジトリの **Settings** → **Pages** へ
2. **Source** で `Deploy from a branch` を選択
3. **Branch** を `main` / `(root)` に設定して **Save**
4. 数十秒待つと `https://hideo-t.github.io/mitsuakira-pro/` で公開される

### 4. （任意）独自ドメインを設定

`mitsuakira-pro.jp` などのドメインを取得済みの場合：

- リポジトリのルートに `CNAME` ファイルを追加し、内容にドメイン名を1行で記載
- ドメインのDNS設定で、CNAMEレコードを `hideo-t.github.io` に向ける
- GitHub Pages の Settings で Custom domain を入力

## 仮公開版の制約

本サイトはあくまで「仮公開版」のため、以下は未実装です：

- お問い合わせフォーム（実装は本公開時）
- 公演スケジュール（コンテンツ追加待ち）
- コンテスト応募フォーム（2026年9月予定）
- 物販・会員制度ページ（第2段階で追加）
- 中国語繁体字版（第2段階で追加）
- 過去公演動画ギャラリー

## クレジット

- 設計・実装：高橋秀夫（三昌プロダクション 外部パートナー）
- 監修：三遊亭円左衛門（取締役）／菊池（副代表）

## ライセンス

本サイトのコンテンツの著作権は三昌プロダクションに帰属します。

---

&copy; 2026 SANSHO PRODUCTION
=======
# mitsuakira-pro
>>>>>>> 2a50ef2812e67839f614a8f7a340b360fa2776bd
