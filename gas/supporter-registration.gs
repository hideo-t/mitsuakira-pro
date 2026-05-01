/**
 * 三晶プロダクション サポーター登録 - Google Apps Script
 * メール認証付き2段階登録
 *
 * 使い方:
 * 1. Google スプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを貼り付け
 * 4. SPREADSHEET_ID, SITE_URL を設定
 * 5. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 6. デプロイURLをHTMLのGAS_URLに設定
 */

// ===== 設定 =====
const SPREADSHEET_ID = '1g4YHWYDamiUDf1ko4vyQ_l2-VOWfGgj3Wm1COes52l4';
const SITE_URL = 'https://hideo-t.github.io/mitsuakira-pro';
const SHEET_NAME = 'サポーター登録';
const ADMIN_SHEET_NAME = '管理者マスタ';
const EVENT_SHEET_NAME = 'イベント';
const APPLICATION_SHEET_NAME = 'イベント申込';
const NOTIFICATION_EMAIL = ''; // 管理者通知メール（任意）

// トークンの有効期限（24時間）
const TOKEN_EXPIRY_HOURS = 24;

/**
 * POSTリクエストを処理
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result;

    switch (data.action) {
      case 'sendVerification':
        // Step 1: メール認証を送信
        result = sendVerificationEmail(data.email, data.language);
        break;

      case 'completeRegistration':
        // Step 3: 詳細登録を完了
        result = completeRegistration(data);
        break;

      case 'adminLogin':
        // 管理者ログイン
        result = adminLogin(data.email, data.password);
        break;

      case 'saveEvent':
        // イベント保存
        result = saveEvent(data);
        break;

      case 'applyEvent':
        // イベント申し込み
        result = applyEvent(data);
        break;

      default:
        throw new Error('Invalid action');
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエストを処理（メール認証リンク、イベント取得など）
 */
function doGet(e) {
  const token = e.parameter.token;
  const action = e.parameter.action;
  const email = e.parameter.email;
  const password = e.parameter.password;

  // イベント一覧取得
  if (action === 'getEvents') {
    if (!verifyAdmin(email, password)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const events = getEvents();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, events: events }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // サポーター一覧取得
  if (action === 'getSupporters') {
    if (!verifyAdmin(email, password)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const supporters = getSupporters();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, supporters: supporters }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 公開イベント一覧取得（認証不要）
  if (action === 'getPublicEvents') {
    const events = getPublicEvents();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, events: events }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // イベント申込一覧取得（管理者用）
  if (action === 'getApplications') {
    if (!verifyAdmin(email, password)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const eventId = e.parameter.eventId;
    const applications = getApplications(eventId);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, applications: applications }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // メール認証
  if (action === 'verify' && token) {
    // Step 2: メール認証を処理
    const result = verifyEmail(token);

    if (result.success) {
      // 認証成功 → 詳細登録ページへリダイレクト
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="refresh" content="0;url=${SITE_URL}?verified=true&token=${token}&email=${encodeURIComponent(result.email)}">
          <title>認証完了</title>
        </head>
        <body>
          <p>認証が完了しました。リダイレクトしています...</p>
          <p><a href="${SITE_URL}?verified=true&token=${token}&email=${encodeURIComponent(result.email)}">こちらをクリック</a></p>
        </body>
        </html>
      `);
    } else {
      // 認証失敗
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>認証エラー</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .error { color: #8B0A1A; }
          </style>
        </head>
        <body>
          <h1 class="error">認証エラー</h1>
          <p>${result.message}</p>
          <p><a href="${SITE_URL}#supporter">登録ページに戻る</a></p>
        </body>
        </html>
      `);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Mitsuakira Pro API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Step 1: 認証メールを送信
 */
function sendVerificationEmail(email, language) {
  if (!email || !isValidEmail(email)) {
    return { success: false, message: 'Invalid email address' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      '登録ID', '会員番号', '登録日時', 'ステータス', 'メールアドレス', '認証トークン', 'トークン有効期限',
      'サポート種別', '名前', '電話番号', '関心分野', 'メッセージ', '言語', '認証日時', '登録完了日時'
    ]);
    sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // 既存の未認証レコードをチェック
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === email && data[i][3] === '未認証') {
      // 既存の未認証レコードがある場合、トークンを再生成
      const newToken = generateToken();
      const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      sheet.getRange(i + 1, 6).setValue(newToken);
      sheet.getRange(i + 1, 7).setValue(newExpiry);

      sendVerificationMail(email, newToken, language);
      return { success: true, message: 'Verification email resent' };
    }
    if (data[i][4] === email && (data[i][3] === '認証済み' || data[i][3] === '登録完了')) {
      return { success: false, message: 'Email already registered', code: 'ALREADY_REGISTERED' };
    }
  }

  // 新規レコードを作成
  const token = generateToken();
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const registrationId = 'SUP-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    registrationId,
    '',  // 会員番号（登録完了時に発行）
    timestamp,
    '未認証',
    email,
    token,
    expiry,
    '', '', '', '', '',
    language || 'ja',
    '',
    ''
  ]);

  // 認証メールを送信
  sendVerificationMail(email, token, language);

  return { success: true, message: 'Verification email sent', registrationId: registrationId };
}

/**
 * Step 2: メール認証を処理
 */
function verifyEmail(token) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, message: 'Sheet not found' };
  }

  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === token) {
      const expiry = new Date(data[i][6]);
      const status = data[i][3];
      const email = data[i][4];

      if (status === '登録完了') {
        return { success: false, message: '既に登録が完了しています。' };
      }

      if (status === '認証済み') {
        return { success: true, email: email, message: 'Already verified' };
      }

      if (now > expiry) {
        return { success: false, message: '認証リンクの有効期限が切れています。再度登録してください。' };
      }

      // 認証成功 - ステータスを更新
      sheet.getRange(i + 1, 4).setValue('認証済み');
      sheet.getRange(i + 1, 14).setValue(Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

      return { success: true, email: email, message: 'Email verified' };
    }
  }

  return { success: false, message: '無効な認証リンクです。' };
}

/**
 * Step 3: 詳細登録を完了
 */
function completeRegistration(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, message: 'Sheet not found' };
  }

  const sheetData = sheet.getDataRange().getValues();

  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][5] === data.token && sheetData[i][4] === data.email) {
      const status = sheetData[i][3];

      if (status !== '認証済み') {
        return { success: false, message: 'Email not verified or already completed' };
      }

      // サポート種別を日本語に変換
      const supportTypeMap = {
        'personal': '個人サポーター',
        'corporate': '法人・企業',
        'volunteer': 'ボランティア'
      };

      // 関心分野を日本語に変換
      const interestMap = {
        'all': 'すべての活動',
        'contest': '落語コンテスト',
        'dojo': '落語道場',
        'event': '公演・イベント',
        'international': '海外展開'
      };

      // 会員番号を発行
      const memberNumber = generateMemberNumber(sheet);

      // 詳細情報を更新
      const row = i + 1;
      sheet.getRange(row, 2).setValue(memberNumber);  // 会員番号
      sheet.getRange(row, 4).setValue('登録完了');
      sheet.getRange(row, 8).setValue(supportTypeMap[data.supportType] || data.supportType);
      sheet.getRange(row, 9).setValue(data.name);
      sheet.getRange(row, 10).setValue(data.phone || '');
      sheet.getRange(row, 11).setValue(interestMap[data.interest] || data.interest || '');
      sheet.getRange(row, 12).setValue(data.message || '');
      sheet.getRange(row, 15).setValue(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

      // 登録完了メールを送信
      sendCompletionEmail(data.email, data.name, memberNumber, sheetData[i][0], data.language || 'ja');

      // 管理者通知
      if (NOTIFICATION_EMAIL) {
        sendAdminNotification(data, sheetData[i][0], memberNumber);
      }

      return { success: true, message: 'Registration completed', registrationId: sheetData[i][0], memberNumber: memberNumber };
    }
  }

  return { success: false, message: 'Registration not found' };
}

/**
 * 認証メールを送信
 */
function sendVerificationMail(email, token, language) {
  const gasUrl = ScriptApp.getService().getUrl();
  const verifyUrl = `${gasUrl}?action=verify&token=${token}`;

  const isJapanese = language === 'ja';

  const subject = isJapanese
    ? '【三晶プロダクション】サポーター登録のご確認'
    : '【Mitsu Akira Production】Supporter Registration Verification';

  const body = isJapanese
    ? `
三晶プロダクションにサポーター登録いただきありがとうございます。

以下のリンクをクリックして、メールアドレスの認証を完了してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▼ 認証リンク（24時間有効）
${verifyUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

認証後、詳細情報の登録ページが表示されます。

※このメールに心当たりがない場合は、このメールを破棄してください。

─────────────────────────
三晶プロダクション
${SITE_URL}
─────────────────────────
`
    : `
Thank you for registering as a supporter of Mitsu Akira Production.

Please click the link below to verify your email address.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▼ Verification Link (Valid for 24 hours)
${verifyUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After verification, you will be directed to complete your registration.

※If you did not request this, please ignore this email.

─────────────────────────
Mitsu Akira Production
${SITE_URL}
─────────────────────────
`;

  GmailApp.sendEmail(email, subject, body);
}

/**
 * 登録完了メールを送信
 */
function sendCompletionEmail(email, name, memberNumber, registrationId, language) {
  const isJapanese = language === 'ja';

  const subject = isJapanese
    ? `【三晶プロダクション】サポーター登録完了 - 会員番号: ${memberNumber}`
    : `【Mitsu Akira Production】Registration Complete - Member No: ${memberNumber}`;

  const body = isJapanese
    ? `
${name} 様

この度は三晶プロダクションのサポーターにご登録いただき、
誠にありがとうございます。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 会員情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  会員番号: ${memberNumber}
  登録ID: ${registrationId}
  メールアドレス: ${email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

上記の会員番号は、今後のお問い合わせやイベント参加時に
ご利用いただく場合がございます。大切に保管してください。

今後、以下のような情報をお届けいたします：

・落語コンテストの開催情報
・落語道場の稽古・イベント情報
・公演スケジュールのご案内
・サポーター限定の特別企画

白河から世界へ、落語の未来を共に創っていただけることを
心より嬉しく思います。

今後ともどうぞよろしくお願いいたします。

─────────────────────────
三晶プロダクション
${SITE_URL}

〒961-0905
福島県白河市道場小路 31-14
─────────────────────────
`
    : `
Dear ${name},

Thank you for registering as a supporter of Mitsu Akira Production.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ Member Information
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Member Number: ${memberNumber}
  Registration ID: ${registrationId}
  Email: ${email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please keep your member number safe. You may need it
for inquiries or event participation.

As a supporter, you will receive:

・Rakugo Contest announcements
・Dojo practice and event information
・Performance schedules
・Exclusive supporter benefits

We are delighted to have you join us in creating
the future of Rakugo, from Shirakawa to the world.

Thank you for your support.

─────────────────────────
Mitsu Akira Production
${SITE_URL}

31-14 Dojo-koji, Shirakawa,
Fukushima 961-0905, Japan
─────────────────────────
`;

  GmailApp.sendEmail(email, subject, body);
}

/**
 * 管理者通知メールを送信
 */
function sendAdminNotification(data, registrationId, memberNumber) {
  const supportTypeMap = {
    'personal': '個人サポーター',
    'corporate': '法人・企業',
    'volunteer': 'ボランティア'
  };

  const subject = `【三晶プロダクション】新規サポーター登録: ${memberNumber} ${data.name}`;

  const body = `
新しいサポーター登録が完了しました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 登録情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

会員番号: ${memberNumber}
登録ID: ${registrationId}
サポート種別: ${supportTypeMap[data.supportType] || data.supportType}
お名前: ${data.name}
メールアドレス: ${data.email}
電話番号: ${data.phone || '(未入力)'}
関心分野: ${data.interest || '(未選択)'}

■ メッセージ
${data.message || '(なし)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

スプレッドシートで確認:
https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}
`;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

/**
 * 会員番号を生成
 */
function generateMemberNumber(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNumber = 0;

  // 既存の会員番号から最大値を取得
  for (let i = 1; i < data.length; i++) {
    const memberNum = data[i][1];  // 会員番号列
    if (memberNum && typeof memberNum === 'string' && memberNum.startsWith('M-')) {
      const num = parseInt(memberNum.substring(2), 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  // 次の番号を生成（4桁ゼロ埋め）
  const nextNumber = maxNumber + 1;
  return 'M-' + String(nextNumber).padStart(4, '0');
}

/**
 * トークンを生成
 */
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * メールアドレスのバリデーション
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * テスト用関数
 */
function testSendVerification() {
  const result = sendVerificationEmail('test@example.com', 'ja');
  Logger.log(result);
}

// ============================================
// 管理者認証
// ============================================

/**
 * 管理者ログイン
 */
function adminLogin(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email and password required' };
  }

  if (verifyAdmin(email, password)) {
    return { success: true, message: 'Login successful' };
  }

  return { success: false, message: 'Invalid credentials' };
}

/**
 * 管理者認証を確認
 */
function verifyAdmin(email, password) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ADMIN_SHEET_NAME);

  // 管理者シートがない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(ADMIN_SHEET_NAME);
    sheet.appendRow(['メールアドレス', 'パスワード', '名前', '権限', '作成日']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    // デフォルト管理者を追加（初回のみ）
    sheet.appendRow(['admin@mitsuakira.com', 'admin123', '管理者', 'admin', Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd')]);
    return false;
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === password) {
      return true;
    }
  }

  return false;
}

// ============================================
// イベント管理
// ============================================

/**
 * イベントを保存
 */
function saveEvent(data) {
  // 管理者認証
  if (!verifyAdmin(data.adminEmail, data.adminPassword)) {
    return { success: false, message: 'Unauthorized' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(EVENT_SHEET_NAME);

  // イベントシートがない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(EVENT_SHEET_NAME);
    sheet.appendRow([
      'イベントID', '作成日', 'ステータス', 'イベント名', '開催日', '開場', '開演',
      '会場名', '住所', '会場URL', '地図URL', '料金', '定員',
      '出演者', '演目', '連絡先', '特典・備考', '更新日'
    ]);
    sheet.getRange(1, 1, 1, 18).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  if (data.eventId) {
    // 既存イベントを更新
    const sheetData = sheet.getDataRange().getValues();
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === data.eventId) {
        const row = i + 1;
        sheet.getRange(row, 3).setValue(data.status || 'draft');
        sheet.getRange(row, 4).setValue(data.title);
        sheet.getRange(row, 5).setValue(data.date);
        sheet.getRange(row, 6).setValue(data.openTime);
        sheet.getRange(row, 7).setValue(data.startTime);
        sheet.getRange(row, 8).setValue(data.venue);
        sheet.getRange(row, 9).setValue(data.address);
        sheet.getRange(row, 10).setValue(data.venueUrl);
        sheet.getRange(row, 11).setValue(data.mapUrl);
        sheet.getRange(row, 12).setValue(data.price);
        sheet.getRange(row, 13).setValue(data.capacity);
        sheet.getRange(row, 14).setValue(data.performer);
        sheet.getRange(row, 15).setValue(data.program);
        sheet.getRange(row, 16).setValue(data.contact);
        sheet.getRange(row, 17).setValue(data.special);
        sheet.getRange(row, 18).setValue(now);
        return { success: true, message: 'Event updated', eventId: data.eventId };
      }
    }
    return { success: false, message: 'Event not found' };
  } else {
    // 新規イベントを作成
    const eventId = generateEventId(sheet);
    sheet.appendRow([
      eventId,
      now,
      data.status || 'draft',
      data.title,
      data.date,
      data.openTime,
      data.startTime,
      data.venue,
      data.address,
      data.venueUrl,
      data.mapUrl,
      data.price,
      data.capacity,
      data.performer,
      data.program,
      data.contact,
      data.special,
      now
    ]);
    return { success: true, message: 'Event created', eventId: eventId };
  }
}

/**
 * イベントIDを生成
 */
function generateEventId(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNumber = 0;

  for (let i = 1; i < data.length; i++) {
    const eventId = data[i][0];
    if (eventId && typeof eventId === 'string' && eventId.startsWith('EV-')) {
      const num = parseInt(eventId.substring(3), 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  return 'EV-' + String(nextNumber).padStart(4, '0');
}

/**
 * 全イベントを取得（管理者用）
 */
function getEvents() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(EVENT_SHEET_NAME);

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const events = [];

  for (let i = 1; i < data.length; i++) {
    events.push({
      id: data[i][0],
      createdAt: data[i][1],
      status: data[i][2],
      title: data[i][3],
      date: data[i][4],
      openTime: data[i][5],
      startTime: data[i][6],
      venue: data[i][7],
      address: data[i][8],
      venueUrl: data[i][9],
      mapUrl: data[i][10],
      price: data[i][11],
      capacity: data[i][12],
      performer: data[i][13],
      program: data[i][14],
      contact: data[i][15],
      special: data[i][16],
      updatedAt: data[i][17]
    });
  }

  // 開催日の降順でソート
  events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return events;
}

/**
 * 公開イベントを取得（一般用）
 */
function getPublicEvents() {
  const events = getEvents();
  return events.filter(ev => ev.status === 'published');
}

/**
 * サポーター一覧を取得（管理者用）
 */
function getSupporters() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const supporters = [];

  for (let i = 1; i < data.length; i++) {
    supporters.push({
      registrationId: data[i][0],
      memberNumber: data[i][1],
      registeredAt: data[i][2],
      status: data[i][3],
      email: data[i][4],
      supportType: data[i][7],
      name: data[i][8],
      phone: data[i][9],
      interest: data[i][10],
      message: data[i][11]
    });
  }

  return supporters;
}

// ============================================
// イベント申し込み
// ============================================

/**
 * イベント申し込みを処理
 */
function applyEvent(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(APPLICATION_SHEET_NAME);

  // 申込シートがない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(APPLICATION_SHEET_NAME);
    sheet.appendRow([
      '申込ID', '申込日時', 'イベントID', 'イベント名', '開催日', '会場',
      '申込方法', '会員番号', '名前', 'メールアドレス', '電話番号', '参加人数', '備考', 'ステータス'
    ]);
    sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // 申込IDを生成
  const applicationId = generateApplicationId(sheet);
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  // 名前を取得（会員の場合はメールから検索）
  let name = data.name || '';
  if (data.applyMethod === 'member' && data.memberNumber) {
    const memberInfo = getMemberByNumber(data.memberNumber, data.email);
    if (memberInfo) {
      name = memberInfo.name;
    }
  }

  // データを保存
  sheet.appendRow([
    applicationId,
    timestamp,
    data.eventId,
    data.eventTitle,
    data.eventDate,
    data.eventVenue,
    data.applyMethod === 'member' ? 'サポーター会員' : '一般',
    data.memberNumber || '',
    name,
    data.email,
    data.phone || '',
    data.attendees || '1',
    data.notes || '',
    '受付済'
  ]);

  // 確認メールを送信
  sendApplicationConfirmation(data, applicationId);

  // 管理者通知
  if (NOTIFICATION_EMAIL) {
    sendApplicationNotification(data, applicationId, name);
  }

  return { success: true, applicationId: applicationId };
}

/**
 * 申込IDを生成
 */
function generateApplicationId(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNumber = 0;

  for (let i = 1; i < data.length; i++) {
    const appId = data[i][0];
    if (appId && typeof appId === 'string' && appId.startsWith('AP-')) {
      const num = parseInt(appId.substring(3), 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return 'AP-' + String(maxNumber + 1).padStart(5, '0');
}

/**
 * 会員番号から会員情報を取得
 */
function getMemberByNumber(memberNumber, email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === memberNumber && data[i][4] === email) {
      return {
        memberNumber: data[i][1],
        name: data[i][8],
        email: data[i][4]
      };
    }
  }
  return null;
}

/**
 * イベント申込確認メールを送信
 */
function sendApplicationConfirmation(data, applicationId) {
  const isJapanese = data.language === 'ja';
  const name = data.name || data.memberNumber || 'お客様';

  const subject = isJapanese
    ? `【三晶プロダクション】イベント申込受付: ${data.eventTitle}`
    : `【Mitsu Akira Production】Event Application Confirmed: ${data.eventTitle}`;

  const body = isJapanese
    ? `
${name} 様

イベントへのお申し込みを受け付けました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 申込内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

申込番号: ${applicationId}
イベント: ${data.eventTitle}
開催日: ${data.eventDate}
会場: ${data.eventVenue}
参加人数: ${data.attendees || 1}名

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

当日は開場時間に合わせてお越しください。
ご来場を心よりお待ちしております。

※ご不明点がございましたら、公式LINEまたは
  メールにてお問い合わせください。

─────────────────────────
三晶プロダクション
${SITE_URL}
─────────────────────────
`
    : `
Dear ${name},

Your event application has been received.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ Application Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Application No: ${applicationId}
Event: ${data.eventTitle}
Date: ${data.eventDate}
Venue: ${data.eventVenue}
Attendees: ${data.attendees || 1}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please arrive at the venue by the opening time.
We look forward to seeing you!

─────────────────────────
Mitsu Akira Production
${SITE_URL}
─────────────────────────
`;

  GmailApp.sendEmail(data.email, subject, body);
}

/**
 * イベント申込管理者通知を送信
 */
function sendApplicationNotification(data, applicationId, name) {
  const subject = `【三晶プロダクション】イベント申込: ${data.eventTitle}`;

  const body = `
新しいイベント申込がありました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 申込情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

申込番号: ${applicationId}
イベント: ${data.eventTitle}
開催日: ${data.eventDate}

申込方法: ${data.applyMethod === 'member' ? 'サポーター会員' : '一般'}
${data.memberNumber ? `会員番号: ${data.memberNumber}` : ''}
お名前: ${name || '(未登録)'}
メール: ${data.email}
${data.phone ? `電話: ${data.phone}` : ''}
参加人数: ${data.attendees || 1}名

${data.notes ? `■ 備考\n${data.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

スプレッドシートで確認:
https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}
`;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

/**
 * イベント申込一覧を取得
 */
function getApplications(eventId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(APPLICATION_SHEET_NAME);

  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const applications = [];

  for (let i = 1; i < data.length; i++) {
    // eventIdが指定されている場合はフィルタリング
    if (eventId && data[i][2] !== eventId) continue;

    applications.push({
      applicationId: data[i][0],
      appliedAt: data[i][1],
      eventId: data[i][2],
      eventTitle: data[i][3],
      eventDate: data[i][4],
      venue: data[i][5],
      method: data[i][6],
      memberNumber: data[i][7],
      name: data[i][8],
      email: data[i][9],
      phone: data[i][10],
      attendees: data[i][11],
      notes: data[i][12],
      status: data[i][13]
    });
  }

  return applications;
}

/**
 * 管理者シートを初期化（テスト用）
 */
function initAdminSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ADMIN_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(ADMIN_SHEET_NAME);
  } else {
    sheet.clear();
  }

  sheet.appendRow(['メールアドレス', 'パスワード', '名前', '権限', '作成日']);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // デフォルト管理者
  sheet.appendRow(['admin@mitsuakira.com', 'admin123', '管理者', 'admin', Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd')]);

  Logger.log('Admin sheet initialized');
}
