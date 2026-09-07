/**
 * イベント告知 一斉配信（メール / LINE）
 * -------------------------------------------------------------
 * 管理画面（admin.html）の「一斉配信」タブから POST で呼ばれる。
 * doPost の switch に  case 'broadcast': result = broadcastAnnouncement(data); break;
 * を追加して有効化する。
 *
 * 依存（すべて supporter-registration.gs 側のグローバル）:
 *   SPREADSHEET_ID / SHEET_MEMBERS / LINE_CHANNEL_ACCESS_TOKEN / verifyAdmin()
 *   ※ LINEトークンは supporter-registration.gs の定数を「参照」するだけ。
 *      この行以外でトークンの実値をここに書かないこと（公開リポジトリ対策）。
 *
 * 宛先の考え方（ユーザー指定＝全員）:
 *   メール : status==='active' かつ email がある全会員（BCCで一括、50件ずつ分割）
 *   LINE   : line_id を持つ全会員（multicast、500件ずつ分割）
 */

// 会員シートの列インデックス（0始まり）— supporter-registration.gs のヘッダ定義に一致
var BC_COL_EMAIL   = 3;  // email
var BC_COL_LINE_ID = 6;  // line_id
var BC_COL_STATUS  = 11; // status

// 予約(reservations)シートの列インデックス（0始まり）
var BC_RES_COL_EMAIL  = 5;   // email
var BC_RES_COL_STATUS = 10;  // status

/**
 * 一斉配信の本体。
 * @param {Object} data { action, email, password, channel, subject, body, testOnly }
 *   channel: 'email' | 'line' | 'both'
 * @return {Object} { success, message, emailCount, lineCount, errors }
 */
function broadcastAnnouncement(data) {
  // --- 認証 ---
  if (!verifyAdmin(data.email, data.password)) {
    return { success: false, message: 'Unauthorized' };
  }

  var channel = data.channel || 'both';
  var subject = (data.subject || '').toString();
  var body    = (data.body || '').toString();

  if (!body.trim()) {
    return { success: false, message: '本文が空です。' };
  }
  if ((channel === 'email' || channel === 'both') && !subject.trim()) {
    return { success: false, message: 'メール件名が空です。' };
  }

  // --- テスト送信：管理者本人のメール宛のみ（LINEは対象外） ---
  if (data.testOnly) {
    if (channel === 'line') {
      return { success: false, message: 'テスト送信はメールのみ対応です。本番配信でLINEに送られます。' };
    }
    try {
      MailApp.sendEmail({
        to: data.email,
        subject: '[テスト] ' + subject,
        body: '※これはテスト送信です。本番では全会員に配信されます。\n\n' + body
      });
      return { success: true, message: 'テストメールを ' + data.email + ' に送信しました。', emailCount: 1, lineCount: 0 };
    } catch (err) {
      return { success: false, message: 'テスト送信に失敗: ' + err.toString() };
    }
  }

  // --- 宛先収集（includeReservations=true なら予約者のメールも含める） ---
  var recipients = bcCollectRecipients_(data.includeReservations);
  var result = { success: true, emailCount: 0, lineCount: 0, errors: [] };

  // --- メール（BCCで一括、50件ずつ） ---
  if (channel === 'email' || channel === 'both') {
    var emails = recipients.emails;
    for (var i = 0; i < emails.length; i += 50) {
      var chunk = emails.slice(i, i + 50);
      try {
        MailApp.sendEmail({
          to: data.email,          // 表向きのTo＝管理者自身。実宛先はBCC。
          bcc: chunk.join(','),
          subject: subject,
          body: body
        });
        result.emailCount += chunk.length;
      } catch (err) {
        result.errors.push('email chunk ' + i + ': ' + err.toString());
      }
    }
  }

  // --- LINE（multicastで500件ずつ） ---
  if (channel === 'line' || channel === 'both') {
    var ids = recipients.lineIds;
    var lineText = (subject && (channel === 'both')) ? (subject + '\n\n' + body) : body;
    for (var j = 0; j < ids.length; j += 500) {
      var idChunk = ids.slice(j, j + 500);
      var sent = bcSendLineMulticast_(idChunk, lineText);
      if (sent.ok) {
        result.lineCount += idChunk.length;
      } else {
        result.errors.push('line chunk ' + j + ': ' + sent.message);
      }
    }
  }

  result.message = 'メール ' + result.emailCount + '件 / LINE ' + result.lineCount + '件に配信しました。'
    + (result.errors.length ? '（一部エラーあり）' : '');
  return result;
}

/**
 * 宛先を集める。会員(active)のメール＋LINE。
 * includeReservations=true のときは予約者(キャンセル以外)のメールも加える（LINEは会員のみ）。
 * @param {boolean} includeReservations
 * @return {Object} { emails: string[], lineIds: string[] }
 */
function bcCollectRecipients_(includeReservations) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var emails = [];
  var lineIds = [];
  var seenEmail = {};
  var seenLine = {};

  // --- 会員シート（active のみ） ---
  var sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var status = String(data[i][BC_COL_STATUS] || '').trim();
      if (status !== 'active') continue; // 有効会員のみ＝「全員」

      var email = String(data[i][BC_COL_EMAIL] || '').trim();
      if (email && email.indexOf('@') > 0 && !seenEmail[email]) {
        seenEmail[email] = true;
        emails.push(email);
      }
      var lineId = String(data[i][BC_COL_LINE_ID] || '').trim();
      if (lineId && !seenLine[lineId]) {
        seenLine[lineId] = true;
        lineIds.push(lineId);
      }
    }
  }

  // --- 予約シート（キャンセル以外の申込者メール） ---
  if (includeReservations) {
    var resSheet = ss.getSheetByName(SHEET_RESERVATIONS);
    if (resSheet) {
      var rdata = resSheet.getDataRange().getValues();
      for (var j = 1; j < rdata.length; j++) {
        var rstatus = String(rdata[j][BC_RES_COL_STATUS] || '').trim();
        if (rstatus === 'cancelled' || rstatus === 'canceled') continue;
        var remail = String(rdata[j][BC_RES_COL_EMAIL] || '').trim();
        if (remail && remail.indexOf('@') > 0 && !seenEmail[remail]) {
          seenEmail[remail] = true;
          emails.push(remail);
        }
      }
    }
  }

  return { emails: emails, lineIds: lineIds };
}

/**
 * LINE multicast（最大500件）。
 * @param {string[]} toIds
 * @param {string} text
 * @return {Object} { ok, message }
 */
function bcSendLineMulticast_(toIds, text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || LINE_CHANNEL_ACCESS_TOKEN === 'YOUR_LINE_CHANNEL_ACCESS_TOKEN') {
    return { ok: false, message: 'LINE token not configured' };
  }
  if (!toIds || toIds.length === 0) {
    return { ok: true, message: 'no recipients' };
  }
  var url = 'https://api.line.me/v2/bot/message/multicast';
  var payload = {
    to: toIds,
    messages: [{ type: 'text', text: text.substring(0, 4900) }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  if (code === 200) {
    return { ok: true, message: 'ok' };
  }
  return { ok: false, message: 'HTTP ' + code + ': ' + res.getContentText() };
}
