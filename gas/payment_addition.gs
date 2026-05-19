/**
 * ============================================================
 * 支払い方法機能 — GASコピペ追加分
 * ============================================================
 *
 * 【使い方】
 * このファイル全体を Apps Script エディタの新規 .gs ファイル
 * (例: payment_addition.gs) として作成して貼り付けるだけで動きます。
 *
 * 既存の getEvents() / sendConfirmationEmail() / sendConfirmedEmail()
 * を本ファイルが上書き(monkey-patch)する形になっています。
 *
 * もし既存関数を直接書き換えたい場合は、本ファイル下部の
 * 「DIRECT-EDIT版」のコメント手順を参照してください。
 *
 * ============================================================
 */


// ============================================================
// 1. 支払い方法 ラベルマップ
// ============================================================
const PAYMENT_LABEL_MAP = {
  cash:   '💴 現金',
  paypay: '📱 PayPay',
  credit: '💳 クレジットカード',
};


// ============================================================
// 2. メール本文用ヘルパー: 支払いセクションを生成
//   - 各メール送信処理から呼び出す
//   - 引数 event は events シートから取得した1行分のオブジェクト
//     (payment_methods, payment_note を含むこと)
// ============================================================
function buildPaymentSection(event) {
  if (!event) return '';

  const methodsStr = String(event.payment_methods || '').trim();
  const note       = String(event.payment_note || '').trim();

  const lines = [];
  lines.push('');
  lines.push('■ お支払いについて');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (methodsStr) {
    const methods = methodsStr
      .split(',')
      .map(function(s){ return s.trim().toLowerCase(); })
      .filter(Boolean)
      .map(function(m){ return PAYMENT_LABEL_MAP[m] || m; })
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


// ============================================================
// 3. 既存 getEvents() を上書き
//   - events シートの全カラムを返すように汎用化
//   - payment_methods / payment_note も自動で含まれる
// ============================================================
function getEvents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('events');
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(function(h){ return String(h || '').trim(); });
  const data = rows.slice(1);

  return data
    .map(function(row){
      const ev = {};
      headers.forEach(function(h, i){
        ev[h] = row[i];
      });
      // 必須フィールド整形
      ev.payment_methods = String(ev.payment_methods || '').trim();
      ev.payment_note    = String(ev.payment_note || '').trim();
      return ev;
    })
    .filter(function(ev){ return ev.event_id; });  // event_id 空行は除外
}


// ============================================================
// 4. 確認メール (仮予約 / メール認証前) を送信
//   - 既存 sendConfirmationEmail を上書き
//   - 既存名と異なる場合は本関数を呼び出すよう変更してください
// ============================================================
function sendConfirmationEmail(email, event, reservation, confirmUrl) {
  const body = [
    'この度はお申し込みいただきありがとうございます。',
    '',
    '以下の内容で仮予約を承りました。',
    '',
    '■ イベント情報',
    'イベント名: ' + (event.title || ''),
    '日時: '       + formatEventDate_(event.date) + ' ' + (event.time_start || ''),
    '会場: '       + (event.venue || ''),
    '',
    '■ お申し込み内容',
    'お名前: '   + (reservation.name || ''),
    'フリガナ: ' + (reservation.nameKana || ''),
    'メール: '   + (reservation.email || email),
    '電話: '     + (reservation.phone || ''),
    '人数: '     + (reservation.partySize || 1) + '名',
    reservation.memberId ? '会員番号: ' + reservation.memberId : '',
    reservation.notes ? '備考: ' + reservation.notes : '',
    buildPaymentSection(event),
    '',
    '■ 予約確定について',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '※ 24時間以内に下記リンクをクリックして予約を確定してください:',
    confirmUrl || '',
    '',
    'リンクをクリックいただかない場合、自動的にキャンセル扱いとなります。',
    '',
    '--',
    '三晶プロダクション',
    'https://hideo-t.github.io/mitsuakira-pro/',
  ].filter(function(line){ return line !== ''; }).join('\n');

  MailApp.sendEmail({
    to:      email,
    subject: '【三晶プロダクション】仮予約のご確認 — ' + (event.title || ''),
    body:    body,
  });
}


// ============================================================
// 5. 確定メール (リンククリック → 予約確定) を送信
//   - 既存 sendConfirmedEmail を上書き
// ============================================================
function sendConfirmedEmail(email, event, reservation) {
  const body = [
    'ご予約が確定いたしました。',
    'ありがとうございます。',
    '',
    '■ イベント情報',
    'イベント名: ' + (event.title || ''),
    '日時: '       + formatEventDate_(event.date) + ' ' + (event.time_start || ''),
    '会場: '       + (event.venue || ''),
    '',
    '■ お申し込み内容',
    'お名前: ' + (reservation.name || ''),
    '人数: '   + (reservation.partySize || 1) + '名',
    reservation.memberId ? '会員番号: ' + reservation.memberId : '',
    buildPaymentSection(event),
    '',
    '当日お気をつけてお越しください。',
    'お会いできることを楽しみにしております。',
    '',
    '--',
    '三晶プロダクション',
    'https://hideo-t.github.io/mitsuakira-pro/',
  ].filter(function(line){ return line !== ''; }).join('\n');

  MailApp.sendEmail({
    to:      email,
    subject: '【三晶プロダクション】ご予約確定のお知らせ — ' + (event.title || ''),
    body:    body,
  });
}


// ============================================================
// 6. 補助: 日付フォーマッタ
//   既存に formatDate / formatEventDate がある場合は不要 → 削除可
// ============================================================
function formatEventDate_(dateValue) {
  if (!dateValue) return '';
  try {
    const d = (dateValue instanceof Date) ? dateValue : new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    const y  = d.getFullYear();
    const m  = d.getMonth() + 1;
    const dd = d.getDate();
    const wk = ['日','月','火','水','木','金','土'][d.getDay()];
    return y + '年' + m + '月' + dd + '日(' + wk + ')';
  } catch(e) {
    return String(dateValue);
  }
}


// ============================================================
// 7. テスト用: メール送信動作確認
//   Apps Script エディタで testPaymentEmail を選択して実行 →
//   自分のアドレスに見本メールが届くことを確認
//
//   ※ 実行前に下記の TEST_EMAIL を書き換えてください
// ============================================================
function testPaymentEmail() {
  const TEST_EMAIL = 'your-email@example.com';  // ← 自分のメールに変更

  const fakeEvent = {
    event_id:        'EV-20260610-01',
    title:           '【テスト】三晶プロダクション 第一回 落語会',
    date:            new Date('2026-06-10'),
    time_start:      '19:00',
    venue:           '白河市文化交流館コミネス',
    payment_methods: 'cash',
    payment_note:    'お釣りのないようご準備ください',
  };
  const fakeReservation = {
    name:      '山田 太郎',
    nameKana:  'ヤマダ タロウ',
    email:     TEST_EMAIL,
    phone:     '090-1234-5678',
    partySize: 2,
    memberId:  '',
    notes:     '',
  };

  sendConfirmationEmail(TEST_EMAIL, fakeEvent, fakeReservation, 'https://example.com/confirm/test');
  Logger.log('confirmation sent to ' + TEST_EMAIL);

  sendConfirmedEmail(TEST_EMAIL, fakeEvent, fakeReservation);
  Logger.log('confirmed sent to ' + TEST_EMAIL);
}


/* ============================================================
 *  DIRECT-EDIT版 (本ファイルを使わず既存関数を直接編集したい場合)
 * ============================================================
 *
 *  既存の getEvents() 内、return オブジェクトに 2 行追加:
 *
 *    return {
 *      // ...既存フィールド...
 *      payment_methods: ev.payment_methods || '',
 *      payment_note:    ev.payment_note || '',
 *    };
 *
 *
 *  既存の sendConfirmationEmail / sendConfirmedEmail 内、
 *  body 配列の適切な位置 (お申し込み内容の後) に 1 行追加:
 *
 *    buildPaymentSection(event),
 *
 *
 *  そして本ファイル上部の buildPaymentSection() と
 *  PAYMENT_LABEL_MAP だけを別ファイルにコピペ。
 *  既存関数は上書きされません。
 * ============================================================
 */
