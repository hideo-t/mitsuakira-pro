/**
 * 三晶プロダクション サポーター登録 - Google Apps Script
 *
 * 使い方:
 * 1. Google スプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを貼り付け
 * 4. SPREADSHEET_ID を実際のスプレッドシートIDに変更
 * 5. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 6. デプロイURLをHTMLのGAS_URLに設定
 */

// スプレッドシートID（URLの /d/ と /edit の間の文字列）
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// シート名
const SHEET_NAME = 'サポーター登録';

// 通知先メールアドレス（空欄の場合は通知なし）
const NOTIFICATION_EMAIL = '';

/**
 * POSTリクエストを処理
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // スプレッドシートに保存
    const result = saveToSheet(data);

    // メール通知（設定されている場合）
    if (NOTIFICATION_EMAIL) {
      sendNotification(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Registration saved', id: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエスト（CORS preflight対応）
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Supporter Registration API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * スプレッドシートにデータを保存
 */
function saveToSheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // ヘッダー行を追加
    sheet.appendRow([
      '登録ID',
      '登録日時',
      'サポート種別',
      '名前',
      'メールアドレス',
      '電話番号',
      '関心分野',
      'メッセージ',
      '言語',
      'ステータス'
    ]);
    // ヘッダー行のスタイル設定
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // 登録IDを生成
  const registrationId = 'SUP-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd') + '-' + (sheet.getLastRow());

  // 日時をフォーマット
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

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
    'international': '海外展開',
    '': '未選択'
  };

  // 行を追加
  sheet.appendRow([
    registrationId,
    timestamp,
    supportTypeMap[data.supportType] || data.supportType,
    data.name,
    data.email,
    data.phone || '',
    interestMap[data.interest] || data.interest || '',
    data.message || '',
    data.language === 'ja' ? '日本語' : 'English',
    '新規'
  ]);

  // 列幅を自動調整（初回のみ）
  if (sheet.getLastRow() === 2) {
    sheet.autoResizeColumns(1, 10);
  }

  return registrationId;
}

/**
 * 管理者に通知メールを送信
 */
function sendNotification(data) {
  const supportTypeMap = {
    'personal': '個人サポーター',
    'corporate': '法人・企業',
    'volunteer': 'ボランティア'
  };

  const subject = `【三晶プロダクション】新規サポーター登録: ${data.name}`;

  const body = `
新しいサポーター登録がありました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 登録情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

サポート種別: ${supportTypeMap[data.supportType] || data.supportType}
お名前: ${data.name}
メールアドレス: ${data.email}
電話番号: ${data.phone || '(未入力)'}
関心分野: ${data.interest || '(未選択)'}

■ メッセージ
${data.message || '(なし)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

登録日時: ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')}
言語: ${data.language === 'ja' ? '日本語' : 'English'}

スプレッドシートで確認:
https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}
`;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

/**
 * テスト用関数
 */
function testSaveToSheet() {
  const testData = {
    supportType: 'personal',
    name: 'テスト太郎',
    email: 'test@example.com',
    phone: '090-1234-5678',
    interest: 'contest',
    message: 'テストメッセージです。',
    language: 'ja'
  };

  const result = saveToSheet(testData);
  Logger.log('Registration ID: ' + result);
}
