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
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SITE_URL = 'https://hideo-t.github.io/mitsuakira-pro';
const SHEET_NAME = 'サポーター登録';
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
 * GETリクエストを処理（メール認証リンク）
 */
function doGet(e) {
  const token = e.parameter.token;
  const action = e.parameter.action;

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
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Supporter Registration API' }))
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
      '登録ID', '登録日時', 'ステータス', 'メールアドレス', '認証トークン', 'トークン有効期限',
      'サポート種別', '名前', '電話番号', '関心分野', 'メッセージ', '言語', '認証日時', '登録完了日時'
    ]);
    sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // 既存の未認証レコードをチェック
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === email && data[i][2] === '未認証') {
      // 既存の未認証レコードがある場合、トークンを再生成
      const newToken = generateToken();
      const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      sheet.getRange(i + 1, 5).setValue(newToken);
      sheet.getRange(i + 1, 6).setValue(newExpiry);

      sendVerificationMail(email, newToken, language);
      return { success: true, message: 'Verification email resent' };
    }
    if (data[i][3] === email && (data[i][2] === '認証済み' || data[i][2] === '登録完了')) {
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
    if (data[i][4] === token) {
      const expiry = new Date(data[i][5]);
      const status = data[i][2];
      const email = data[i][3];

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
      sheet.getRange(i + 1, 3).setValue('認証済み');
      sheet.getRange(i + 1, 13).setValue(Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

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
    if (sheetData[i][4] === data.token && sheetData[i][3] === data.email) {
      const status = sheetData[i][2];

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

      // 詳細情報を更新
      const row = i + 1;
      sheet.getRange(row, 3).setValue('登録完了');
      sheet.getRange(row, 7).setValue(supportTypeMap[data.supportType] || data.supportType);
      sheet.getRange(row, 8).setValue(data.name);
      sheet.getRange(row, 9).setValue(data.phone || '');
      sheet.getRange(row, 10).setValue(interestMap[data.interest] || data.interest || '');
      sheet.getRange(row, 11).setValue(data.message || '');
      sheet.getRange(row, 14).setValue(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

      // 管理者通知
      if (NOTIFICATION_EMAIL) {
        sendAdminNotification(data, sheetData[i][0]);
      }

      return { success: true, message: 'Registration completed', registrationId: sheetData[i][0] };
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
 * 管理者通知メールを送信
 */
function sendAdminNotification(data, registrationId) {
  const supportTypeMap = {
    'personal': '個人サポーター',
    'corporate': '法人・企業',
    'volunteer': 'ボランティア'
  };

  const subject = `【三晶プロダクション】新規サポーター登録完了: ${data.name}`;

  const body = `
新しいサポーター登録が完了しました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 登録情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
