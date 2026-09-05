# GAS のデプロイ手順

Google Apps Script のコードを、**コピー＆ペーストなしで**更新するための手順。

いままでは GAS エディタを開いてファイルを貼り替え、さらに「デプロイを管理 →
編集 → バージョン: 新バージョン」を手でやる必要があった。
**このバージョン切り替えを忘れると、コードを保存しても公開URLは古いまま**という
分かりにくい失敗が起きる。それを1コマンドにまとめてある。

```bash
npm run gas:deploy
```

---

## 最初の1回だけ

### 1. 依存パッケージを入れる

```bash
npm install
```

### 2. Google にログインする

```bash
npm run gas:login
```

ブラウザが開くので、**GASプロジェクトの持ち主のアカウント**で承認する。
認証情報はホームディレクトリの `.clasprc.json` に保存される。
このファイルは絶対にコミットしないこと（`.gitignore` 済み）。

### 3. スクリプトIDを設定する

GAS エディタを開き、URLからIDを取る。

```
https://script.google.com/home/projects/【この部分がスクリプトID】/edit
```

`.clasp.json` の `PUT_YOUR_SCRIPT_ID_HERE` を、そのIDに書き換える。

```json
{
  "scriptId": "1AbC...実際のID...XyZ",
  "rootDir": "gas"
}
```

### 4. GAS側の設定を取り込む

```bash
npm run gas:pull
```

`gas/appsscript.json` が作られる。これは GAS プロジェクトの設定
（タイムゾーン、公開範囲、必要な権限）で、**push のときに一緒に送られる**。

> **先に pull すること。** これをせずに push すると、こちらが持っていない
> 設定ファイルで GAS 側の公開範囲を上書きしてしまい、
> 一般公開だったWebアプリが「自分だけ」に変わる恐れがある。

pull で取れた `gas/appsscript.json` と、既存の `.gs` ファイルの差分を確認して、
問題なければコミットしておく。

---

## ふだんの更新

```bash
npm run gas:deploy
```

このコマンドが順に行うこと。

| | 内容 | 失敗したら |
|---|---|---|
| 1 | `gas/*.gs` の構文チェック | **デプロイせずに停止**。壊れたコードは本番に上がらない |
| 2 | `admin.html` と `index.html` の `GAS_URL` が一致するか確認 | 食い違っていたら停止 |
| 3 | `.clasp.json` と `appsscript.json` の確認 | 未設定なら、何をすべきかを表示して停止 |
| 4 | `clasp push` でコード送信 | ログイン切れなら再ログインを促す |
| 5 | 既存デプロイを新バージョンに差し替え | 直前の push は済んでいるので、5だけ再実行できる |

**公開URLは変わらない。** `GAS_URL` からデプロイIDを取り出し、同じデプロイを
更新しているため。`admin.html` や `index.html` の書き換えは不要。

デプロイの説明文には、日時と git のコミットハッシュが入る。
「いつのコードが動いているか」を GAS の画面から追える。

---

## そのほかのコマンド

```bash
npm run gas:push          # 送るだけ。デプロイは差し替えない（動作は変わらない）
npm run gas:pull          # GAS側の変更を手元に取り込む
npm run gas:deployments   # デプロイの一覧とIDを見る
npm run gas:open          # GASエディタをブラウザで開く
```

---

## 気をつけること

**GAS 側で直接編集したら、必ず `npm run gas:pull` してから作業する。**
先に push すると、GAS 側の編集を上書きして消してしまう。

**`npm run gas:push` だけでは公開URLに反映されない。** push はコードを置くだけ。
公開されているのは「デプロイされたバージョン」で、これは
`npm run gas:deploy` が差し替える。迷ったら `gas:deploy` を使えばよい。

**`.clasprc.json` はコミットしない。** これは Google の認証トークンそのもので、
漏れると GAS プロジェクトを他人が書き換えられる。`.gitignore` に入れてあるが、
`git add -f` などで無理に追加しないこと。

**デプロイIDとスクリプトIDは別物。**
- スクリプトID … プロジェクトの識別子。`.clasp.json` に書く
- デプロイID … 公開URL `…/macros/s/【ここ】/exec` の部分。差し替えの対象

---

## うまくいかないとき

| 症状 | 対処 |
|---|---|
| `scriptId が未設定です` | 上の「最初の1回だけ」の3 |
| `gas/appsscript.json がありません` | `npm run gas:pull` を1回実行 |
| `push に失敗しました` | `npm run gas:login` で入り直す |
| `GAS_URL が食い違っています` | `admin.html` と `index.html` のどちらが正しいか決めて揃える |
| デプロイしたのに反映されない | ブラウザのキャッシュ。管理画面を強制再読み込み（Ctrl+Shift+R） |
| 構文エラーで止まる | 表示されたファイルと行を直す。**この時点では何も送信していない** |
