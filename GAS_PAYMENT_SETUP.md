# 支払い方法機能 — GAS & スプレッドシート設定手順

クライアント側（モーダル確認画面）は実装済み (`index.html` の `renderPaymentBlock`)。
本ドキュメントは Google Apps Script とスプレッドシート側の追加設定手順。

---

## 1. スプレッドシート(events シート)に2列追加

events シートに以下のカラムを追加：

| カラム名 | 内容 | 例 |
|---|---|---|
| `payment_methods` | 支払い方法（カンマ区切り） | `cash` / `cash,paypay` / `cash,paypay,credit` |
| `payment_note` | 補足テキスト | `お釣りのないようご準備ください` |

### テストデータ
イベント `EV-20260610-01` の行に以下を設定：

```
payment_methods: cash
payment_note:    お釣りのないようご準備ください
```

---

## 2. GAS — getEvents() に2フィールド追加

イベント一覧を返す関数で、新カラムを event オブジェクトに含める。

```javascript
function getEvents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('events');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const data = rows.slice(1);

  return data.map(row => {
    const ev = {};
    headers.forEach((h, i) => { ev[h] = row[i]; });
    return {
      event_id:        ev.event_id,
      title:           ev.title,
      date:            ev.date,
      time_start:      ev.time_start,
      time_end:        ev.time_end,
      venue:           ev.venue,
      price_general:   ev.price_general,
      price_member:    ev.price_member,
      capacity:        ev.capacity,
      description:     ev.description,
      // ↓追加
      payment_methods: ev.payment_methods || '',
      payment_note:    ev.payment_note || '',
    };
  });
}
```

---

## 3. GAS — 確認メール / 確定メール に支払いセクション追加

両メールテンプレートに以下のヘルパーを追加：

```javascript
/**
 * 支払い方法表記を日本語に変換
 */
function buildPaymentSection(event) {
  const labelMap = {
    cash:   '💴 現金',
    paypay: '📱 PayPay',
    credit: '💳 クレジットカード',
  };
  const methodsStr = String(event.payment_methods || '').trim();
  const note = String(event.payment_note || '').trim();

  let lines = [];
  lines.push('');
  lines.push('■ お支払いについて');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (methodsStr) {
    const methods = methodsStr.split(',')
      .map(s => s.trim().toLowerCase())
      .map(m => labelMap[m] || m)
      .filter(Boolean)
      .join(' / ');
    lines.push('お支払い方法: ' + methods);
  }
  if (note) {
    lines.push('※ ' + note);
  }
  lines.push('料金は当日会場にてお支払いください。');
  lines.push('');

  return lines.join('\n');
}
```

### 確認メール（メール認証 → 仮登録時）
```javascript
function sendConfirmationEmail(email, event, reservation) {
  // ...既存処理...

  const body = [
    'この度はお申し込みいただきありがとうございます。',
    '',
    '以下の内容で仮予約を承りました。',
    '',
    '■ イベント情報',
    'イベント名: ' + event.title,
    '日時: ' + formatDate(event.date) + ' ' + event.time_start,
    '会場: ' + event.venue,
    '',
    '■ お申し込み内容',
    'お名前: ' + reservation.name,
    '人数: ' + reservation.partySize + '名',
    // ...
    buildPaymentSection(event),  // ←追加
    '',
    '※ 24時間以内に下記リンクをクリックして予約を確定してください:',
    confirmUrl,
  ].join('\n');

  MailApp.sendEmail({ to: email, subject: '【三晶プロダクション】仮予約のご確認', body: body });
}
```

### 確定メール（リンククリック後）
```javascript
function sendConfirmedEmail(email, event, reservation) {
  const body = [
    'ご予約が確定いたしました。',
    '',
    '■ イベント情報',
    'イベント名: ' + event.title,
    '日時: ' + formatDate(event.date) + ' ' + event.time_start,
    '会場: ' + event.venue,
    '',
    '■ お申し込み内容',
    'お名前: ' + reservation.name,
    '人数: ' + reservation.partySize + '名',
    // ...
    buildPaymentSection(event),  // ←追加
    '',
    '当日お気をつけてお越しください。',
  ].join('\n');

  MailApp.sendEmail({ to: email, subject: '【三晶プロダクション】ご予約確定のお知らせ', body: body });
}
```

---

## 4. デプロイ後の動作確認

1. **シート確認** — events シートの `EV-20260610-01` 行に `payment_methods=cash`, `payment_note=お釣りのないようご準備ください` が入っていること
2. **GAS デプロイ** — Apps Script エディタで「デプロイ」→ 既存のウェブアプリを更新
3. **サイトでテスト** —
   - https://hideo-t.github.io/mitsuakira-pro/#events を開く
   - EV-20260610-01 を選んで申込モーダル開く
   - 入力 → 確認画面で「■ お支払いについて」セクションが表示されることを確認
4. **メール確認** — 仮予約メール、確定メール両方に「■ お支払いについて」が含まれることを確認

---

## 拡張例

複数の支払い方法を許可する場合：

```
payment_methods: cash,paypay
payment_note: PayPay は QRコード提示でお支払いいただけます
```

→ サイト確認画面に 💴現金 と 📱PayPay の2バッジ表示、注意書きも表示。

---

## トラブルシュート

| 症状 | 原因 | 対応 |
|---|---|---|
| 確認画面に支払いセクションが出ない | event.payment_methods が空 | シート確認、GAS getEvents() がフィールドを返してるか確認 |
| アイコンが ? になる | `cash` 以外の未対応キー | PAYMENT_LABELS マップに追加 |
| メールに支払い情報が出ない | GAS の buildPaymentSection() が呼ばれてない | sendConfirmationEmail / sendConfirmedEmail を更新 |
