/**
 * 三晶プロダクション 会員・イベント管理システム
 *
 * テーブル構造:
 * - members: サポーター会員マスタ
 * - events: イベントマスタ
 * - reservations: イベント申し込みDB
 * - email_log: メール送信ログ
 */

// ===== 設定 =====
const SPREADSHEET_ID = '1g4YHWYDamiUDf1ko4vyQ_l2-VOWfGgj3Wm1COes52l4';
const SITE_URL = 'https://hideo-t.github.io/mitsuakira-pro';
const LINE_URL = 'https://lin.ee/zMR1NuAF';

// シート名
const SHEET_MEMBERS = 'members';
const SHEET_EVENTS = 'events';
const SHEET_RESERVATIONS = 'reservations';
const SHEET_EMAIL_LOG = 'email_log';
const SHEET_ADMIN = '管理者マスタ';

// トークン有効期限（24時間）
const TOKEN_EXPIRY_HOURS = 24;

// ===== テスト用関数（権限承認用）=====
// GASエディタでこの関数を実行して、Gmail送信の権限を承認してください
function testEmailSend() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // email_logシートを作成
  let logSheet = ss.getSheetByName(SHEET_EMAIL_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_EMAIL_LOG);
    logSheet.appendRow(['log_id', 'to_email', 'to_name', 'subject', 'template', 'related_id', 'status', 'sent_at', 'error_message']);
    logSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    logSheet.setFrozenRows(1);
    console.log('email_logシートを作成しました');
  }

  // 管理者のメールアドレスを取得
  const adminSheet = ss.getSheetByName(SHEET_ADMIN);
  if (!adminSheet) {
    console.log('管理者マスタがありません');
    return;
  }

  const adminData = adminSheet.getDataRange().getValues();
  if (adminData.length < 2) {
    console.log('管理者データがありません');
    return;
  }

  const adminEmail = adminData[1][0]; // 最初の管理者のメールアドレス

  // テストメール送信
  try {
    GmailApp.sendEmail(adminEmail, '【テスト】三晶プロダクション メール送信テスト',
      'これはメール送信機能のテストです。\n\nこのメールが届いていれば、メール送信は正常に動作しています。');
    console.log('テストメールを送信しました: ' + adminEmail);

    // ログに記録
    logSheet.appendRow(['TEST-' + Date.now(), adminEmail, '管理者', 'テストメール', 'test', '', 'sent', new Date(), '']);
  } catch (e) {
    console.error('メール送信エラー: ' + e.toString());
    logSheet.appendRow(['TEST-' + Date.now(), adminEmail, '管理者', 'テストメール', 'test', '', 'error', new Date(), e.toString()]);
  }
}

// ===== テスト環境セットアップ =====
// GASエディタでこの関数を実行して、テストデータを作成します
function setupTestData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  console.log('テストデータセットアップ開始...');

  // ===== 1. eventsシートのセットアップ =====
  // 注意: カラム順序はsaveEvent/getPublicEventsと一致させる必要がある
  let eventsSheet = ss.getSheetByName(SHEET_EVENTS);
  if (!eventsSheet) {
    eventsSheet = ss.insertSheet(SHEET_EVENTS);
    eventsSheet.appendRow([
      'event_id', 'title', 'description', 'date', 'time_open', 'time_start', 'time_end',
      'venue_name', 'venue_address', 'venue_access', 'capacity', 'reserved_count', 'waitlist_count',
      'price_general', 'price_member', 'price_includes', 'accept_start', 'accept_end',
      'status', 'image_url', 'created_at', 'updated_at'
    ]);
    eventsSheet.getRange(1, 1, 1, 22).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    eventsSheet.setFrozenRows(1);
    console.log('eventsシートを作成しました');
  }

  // テストイベントを追加または更新
  const testEventId = 'EV-20260610-01';
  const eventsData = eventsSheet.getDataRange().getValues();
  let eventRowIndex = -1;

  for (let i = 1; i < eventsData.length; i++) {
    if (eventsData[i][0] === testEventId) {
      eventRowIndex = i + 1;
      break;
    }
  }

  // カラム順序: saveEventと同じ（22列）
  const testEventData = [
    testEventId,                                // 0: event_id
    '第1回落語【風と曼荼羅】',                      // 1: title
    '三晶プロダクション設立記念の第1回落語会です。',   // 2: description
    '2026-06-10',                               // 3: date
    '13:30',                                    // 4: time_open
    '14:00',                                    // 5: time_start
    '16:00',                                    // 6: time_end
    '白河市民会館 小ホール',                       // 7: venue_name
    '福島県白河市中田7-1',                        // 8: venue_address
    '白河駅から徒歩10分',                         // 9: venue_access
    50,                                         // 10: capacity
    0,                                          // 11: reserved_count
    0,                                          // 12: waitlist_count
    3000,                                       // 13: price_general
    2500,                                       // 14: price_member
    'ドリンク付き',                               // 15: price_includes
    '',                                         // 16: accept_start
    '',                                         // 17: accept_end
    'published',                                // 18: status
    '',                                         // 19: image_url
    new Date(),                                 // 20: created_at
    new Date()                                  // 21: updated_at
  ];

  if (eventRowIndex > 0) {
    // 既存イベントを更新
    eventsSheet.getRange(eventRowIndex, 1, 1, testEventData.length).setValues([testEventData]);
    console.log('テストイベントを更新しました: ' + testEventId);
  } else {
    // 新規追加
    eventsSheet.appendRow(testEventData);
    console.log('テストイベントを追加しました: ' + testEventId);
  }

  // ===== 2. reservationsシートのセットアップ =====
  let resSheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!resSheet) {
    resSheet = ss.insertSheet(SHEET_RESERVATIONS);
    resSheet.appendRow([
      'reservation_id', 'event_id', 'member_id', 'name', 'name_kana', 'email',
      'email_verified', 'phone', 'party_size', 'channel', 'status', 'is_member',
      'price_applied', 'wants_to_register', 'verification_token', 'token_expires_at',
      'reserved_at', 'confirmed_at', 'cancelled_at', 'cancel_reason', 'notes'
    ]);
    resSheet.getRange(1, 1, 1, 21).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    resSheet.setFrozenRows(1);
    console.log('reservationsシートを作成しました');
  }
  console.log('reservationsシート: 既存の予約データはそのまま保持');

  // ===== 3. membersシートのセットアップ =====
  let memSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!memSheet) {
    memSheet = ss.insertSheet(SHEET_MEMBERS);
    memSheet.appendRow([
      'member_id', 'name', 'name_kana', 'email', 'email_verified', 'phone',
      'line_id', 'line_name', 'region', 'referral', 'plan', 'status',
      'event_count', 'last_event_at', 'registered_at', 'verified_at',
      'verification_token', 'token_expires_at', 'notes'
    ]);
    memSheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    memSheet.setFrozenRows(1);
    console.log('membersシートを作成しました');
  }
  console.log('membersシート: 既存の会員データはそのまま保持');

  // ===== 4. email_logシートのセットアップ =====
  let logSheet = ss.getSheetByName(SHEET_EMAIL_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_EMAIL_LOG);
    logSheet.appendRow(['log_id', 'to_email', 'to_name', 'subject', 'template', 'related_id', 'status', 'sent_at', 'error_message']);
    logSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    logSheet.setFrozenRows(1);
    console.log('email_logシートを作成しました');
  }

  // ===== 5. debug_logシートをクリア =====
  let debugSheet = ss.getSheetByName('debug_log');
  if (debugSheet) {
    const lastRow = debugSheet.getLastRow();
    if (lastRow > 1) {
      debugSheet.deleteRows(2, lastRow - 1);
    }
    console.log('debug_logシートをクリアしました');
  }

  console.log('');
  console.log('===== テストデータセットアップ完了 =====');
  console.log('テストイベント: ' + testEventId);
  console.log('  - 定員: 50名');
  console.log('  - 予約数: 0');
  console.log('  - 一般料金: 3000円');
  console.log('  - 会員料金: 2500円');
  console.log('  - ステータス: published');
  console.log('');
  console.log('サイトからイベント申し込みをテストしてください。');
}

// ===== テストデータのリセット =====
// 予約データと会員データをクリアしたい場合に実行
function resetTestData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // reservationsシートをクリア（ヘッダー以外）
  const resSheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (resSheet) {
    const lastRow = resSheet.getLastRow();
    if (lastRow > 1) {
      resSheet.deleteRows(2, lastRow - 1);
      console.log('reservationsシートをクリアしました');
    }
  }

  // membersシートをクリア（ヘッダー以外）
  const memSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (memSheet) {
    const lastRow = memSheet.getLastRow();
    if (lastRow > 1) {
      memSheet.deleteRows(2, lastRow - 1);
      console.log('membersシートをクリアしました');
    }
  }

  // email_logシートをクリア（ヘッダー以外）
  const logSheet = ss.getSheetByName(SHEET_EMAIL_LOG);
  if (logSheet) {
    const lastRow = logSheet.getLastRow();
    if (lastRow > 1) {
      logSheet.deleteRows(2, lastRow - 1);
      console.log('email_logシートをクリアしました');
    }
  }

  // イベントの予約数をリセット
  const eventsSheet = ss.getSheetByName(SHEET_EVENTS);
  if (eventsSheet) {
    const data = eventsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      eventsSheet.getRange(i + 1, 12).setValue(0); // reserved_count列
    }
    console.log('イベントの予約数をリセットしました');
  }

  // debug_logシートをクリア
  const debugSheet = ss.getSheetByName('debug_log');
  if (debugSheet) {
    const lastRow = debugSheet.getLastRow();
    if (lastRow > 1) {
      debugSheet.deleteRows(2, lastRow - 1);
      console.log('debug_logシートをクリアしました');
    }
  }

  console.log('');
  console.log('===== テストデータリセット完了 =====');
}

// ===== POSTリクエスト処理 =====
function doPost(e) {
  // 最初にデバッグログを書き込む（エラーも記録）
  let debugSheet = null;
  let ss = null;

  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    debugSheet = ss.getSheetByName('debug_log');
    if (!debugSheet) {
      debugSheet = ss.insertSheet('debug_log');
      debugSheet.appendRow(['timestamp', 'type', 'message']);
    }
    debugSheet.appendRow([new Date(), 'doPost_start', 'doPost called successfully']);
  } catch (debugError) {
    // スプレッドシートへのアクセスエラーをログに記録
    // Logger.logに出力（GASエディタの「実行ログ」で確認可能）
    Logger.log('Debug sheet error: ' + debugError.toString());
    // 続行可能な場合は続行
  }

  // postDataの確認
  if (!e || !e.postData) {
    if (debugSheet) {
      debugSheet.appendRow([new Date(), 'error', 'e or e.postData is null/undefined']);
    }
    Logger.log('doPost: e or e.postData is null');
    return ContentService.createTextOutput(JSON.stringify({success: false, message: 'No postData'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (debugSheet) {
    try {
      debugSheet.appendRow([new Date(), 'postData', e.postData.contents ? e.postData.contents.substring(0, 500) : 'empty']);
    } catch (logErr) {
      // ログエラーは無視
    }
  }

  try {
    const data = JSON.parse(e.postData.contents);
    let result;

    // アクションをログに記録
    if (debugSheet) {
      try {
        debugSheet.appendRow([new Date(), 'action', data.action]);
      } catch (logErr) {}
    }

    switch (data.action) {
      // イベント申し込み
      case 'submitReservation':
        if (debugSheet) {
          try { debugSheet.appendRow([new Date(), 'submitReservation', JSON.stringify(data).substring(0, 500)]); } catch (e) {}
        }
        result = submitReservation(data);
        if (debugSheet) {
          try { debugSheet.appendRow([new Date(), 'submitReservation_result', JSON.stringify(result).substring(0, 500)]); } catch (e) {}
        }
        break;

      // サポーター登録（新規）
      case 'submitMemberRegistration':
        result = submitMemberRegistration(data);
        break;

      // サポーター登録 Step1: メール認証送信
      case 'sendVerification':
        result = sendVerificationEmail(data);
        break;

      // サポーター登録 Step3: 詳細情報登録完了
      case 'completeRegistration':
        result = completeRegistration(data);
        break;

      // 管理者ログイン
      case 'adminLogin':
        result = adminLogin(data.email, data.password);
        break;

      // イベント保存（管理者用）
      case 'saveEvent':
        result = saveEvent(data);
        break;

      // イベント削除（管理者用）
      case 'deleteEvent':
        result = deleteEvent(data);
        break;

      default:
        throw new Error('Invalid action: ' + data.action);
    }

    // 成功結果をログに記録
    if (debugSheet) {
      try { debugSheet.appendRow([new Date(), 'result_success', JSON.stringify(result).substring(0, 300)]); } catch (e) {}
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // エラーをdebug_logに記録
    if (debugSheet) {
      try { debugSheet.appendRow([new Date(), 'ERROR', error.toString() + ' | Stack: ' + (error.stack || 'no stack')]); } catch (e) {}
    }
    Logger.log('doPost error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== GETリクエスト処理 =====
function doGet(e) {
  const action = e.parameter.action;
  const token = e.parameter.token;

  // テスト用ping（デプロイ確認用）
  // ブラウザで GAS_URL?action=ping にアクセスして動作確認
  if (action === 'ping') {
    // debug_logシートにも記録
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let debugSheet = ss.getSheetByName('debug_log');
      if (!debugSheet) {
        debugSheet = ss.insertSheet('debug_log');
        debugSheet.appendRow(['timestamp', 'type', 'message']);
      }
      debugSheet.appendRow([new Date(), 'ping', 'ping received via GET']);
    } catch (err) {
      // エラーは無視
    }
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'pong', timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // メール確認（予約）
  if (action === 'confirmReservation' && token) {
    return confirmReservation(token);
  }

  // メール確認（会員登録）
  if (action === 'confirmMember' && token) {
    return confirmMember(token);
  }

  // 公開イベント一覧取得
  if (action === 'getPublicEvents') {
    const events = getPublicEvents();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, events: events }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 管理者用：全イベント取得
  if (action === 'getEvents') {
    const email = e.parameter.email;
    const password = e.parameter.password;
    if (!verifyAdmin(email, password)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const events = getAllEvents();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, events: events }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 管理者用：予約一覧取得
  if (action === 'getReservations') {
    const email = e.parameter.email;
    const password = e.parameter.password;
    if (!verifyAdmin(email, password)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const eventId = e.parameter.eventId;
    const reservations = getReservations(eventId);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, reservations: reservations }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 管理者用：会員一覧取得
  if (action === 'getMembers') {
    const email = e.parameter.email;
    const password = e.parameter.password;
    if (!verifyAdmin(email, password)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const members = getMembers();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, members: members }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 会員ID検証
  if (action === 'verifyMemberId') {
    const memberId = e.parameter.memberId;
    const memberEmail = e.parameter.memberEmail;
    const result = verifyMemberId(memberId, memberEmail);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Mitsuakira Pro API v2' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== イベント申し込み処理 =====
function submitReservation(data) {
  console.log('submitReservation called with:', JSON.stringify(data));

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 予約シートを取得または作成
  let resSheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!resSheet) {
    resSheet = ss.insertSheet(SHEET_RESERVATIONS);
    resSheet.appendRow([
      'reservation_id', 'event_id', 'member_id', 'name', 'name_kana', 'email',
      'email_verified', 'phone', 'party_size', 'channel', 'status', 'is_member',
      'price_applied', 'wants_to_register', 'verification_token', 'token_expires_at',
      'reserved_at', 'confirmed_at', 'cancelled_at', 'cancel_reason', 'notes'
    ]);
    resSheet.getRange(1, 1, 1, 21).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    resSheet.setFrozenRows(1);
  }
  console.log('resSheet ready');

  // イベント情報を取得
  console.log('Getting event info for:', data.eventId);
  const eventInfo = getEventById(data.eventId);
  console.log('eventInfo:', JSON.stringify(eventInfo));
  if (!eventInfo) {
    console.log('Event not found');
    return { success: false, message: 'Event not found: ' + data.eventId };
  }

  // 残席チェック
  const remainingSeats = eventInfo.capacity - eventInfo.reserved_count;
  if (data.partySize > remainingSeats) {
    return { success: false, message: 'Not enough seats available', remainingSeats: remainingSeats };
  }

  // 会員ID検証（入力された場合）
  let isMember = false;
  let memberId = null;
  let priceApplied = eventInfo.price_general;

  if (data.memberId && data.memberId.trim()) {
    const memberCheck = verifyMemberId(data.memberId.trim(), data.email);
    if (memberCheck.valid) {
      isMember = true;
      memberId = data.memberId.trim();
      priceApplied = eventInfo.price_member || eventInfo.price_general;
    }
  }

  // 予約IDを生成
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd');
  const reservationId = generateReservationId(resSheet, dateStr);

  // トークン生成
  const token = generateToken();
  const tokenExpiry = new Date(now.getTime() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // 予約を仮登録
  resSheet.appendRow([
    reservationId,
    data.eventId,
    memberId,
    data.name,
    data.nameKana || '',
    data.email,
    false, // email_verified
    data.phone,
    data.partySize,
    data.channel || 'web',
    'pending', // status
    isMember,
    priceApplied,
    data.wantsToRegister || false,
    token,
    tokenExpiry,
    now,
    '', // confirmed_at
    '', // cancelled_at
    '', // cancel_reason
    '' // notes
  ]);

  // 会員登録も希望する場合、membersにも仮登録
  if (data.wantsToRegister && !isMember) {
    try {
      registerPendingMember({
        name: data.name,
        nameKana: data.nameKana,
        email: data.email,
        phone: data.phone,
        token: token,
        tokenExpiry: tokenExpiry
      });
    } catch (e) {
      console.error('registerPendingMember error:', e);
    }
  }

  // 確認メールを送信
  try {
    const priceNum = parseInt(priceApplied) || 0;
    const partySizeNum = parseInt(data.partySize) || 1;

    sendReservationConfirmationEmail({
      reservationId: reservationId,
      name: data.name,
      email: data.email,
      eventTitle: eventInfo.title,
      eventDate: eventInfo.date,
      eventTime: eventInfo.time_start || '',
      venueName: eventInfo.venue_name || '',
      partySize: partySizeNum,
      price: priceNum * partySizeNum,
      isMember: isMember,
      wantsToRegister: data.wantsToRegister,
      token: token,
      language: data.language || 'ja'
    });

    // メール送信ログ
    logEmail(data.email, data.name, '【三晶プロダクション】お申し込み確認', 'reservation_confirm', reservationId, 'sent');
  } catch (e) {
    console.error('Email send error:', e);
    logEmail(data.email, data.name, '【三晶プロダクション】お申し込み確認', 'reservation_confirm', reservationId, 'error: ' + e.toString());
  }

  return {
    success: true,
    reservationId: reservationId,
    message: 'Reservation submitted. Please check your email to confirm.',
    isMember: isMember,
    priceApplied: priceApplied
  };
}

// ===== 予約確認（メールリンククリック） =====
function confirmReservation(token) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const resSheet = ss.getSheetByName(SHEET_RESERVATIONS);

  if (!resSheet) {
    return createErrorPage('予約データが見つかりません。');
  }

  const data = resSheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][14] === token) { // verification_token
      const tokenExpiry = new Date(data[i][15]);
      const status = data[i][10];
      const email = data[i][5];
      const reservationId = data[i][0];
      const eventId = data[i][1];
      const partySize = data[i][8];
      const wantsToRegister = data[i][13];

      if (status === 'confirmed') {
        return createSuccessPage('既に予約が確定しています。', reservationId);
      }

      if (now > tokenExpiry) {
        return createErrorPage('確認リンクの有効期限が切れています。再度お申し込みください。');
      }

      // 予約を確定
      const row = i + 1;
      resSheet.getRange(row, 7).setValue(true); // email_verified
      resSheet.getRange(row, 11).setValue('confirmed'); // status
      resSheet.getRange(row, 18).setValue(now); // confirmed_at

      // イベントの予約数を更新
      updateEventReservedCount(eventId, partySize);

      // 会員登録も希望している場合、会員も確定
      if (wantsToRegister) {
        confirmMemberByEmail(email);
      }

      // 予約確定メールを送信
      const eventInfo = getEventById(eventId);
      sendReservationConfirmedEmail({
        reservationId: reservationId,
        name: data[i][3],
        email: email,
        eventTitle: eventInfo.title,
        eventDate: eventInfo.date,
        eventTime: eventInfo.time_start,
        venueName: eventInfo.venue_name,
        venueAddress: eventInfo.venue_address,
        partySize: partySize,
        price: data[i][12] * partySize
      });

      return createSuccessPage('ご予約が確定しました！確認メールをお送りしました。', reservationId);
    }
  }

  return createErrorPage('無効な確認リンクです。');
}

// ===== サポーター登録処理 =====
function submitMemberRegistration(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 会員シートを取得または作成
  let memSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!memSheet) {
    memSheet = ss.insertSheet(SHEET_MEMBERS);
    memSheet.appendRow([
      'member_id', 'name', 'name_kana', 'email', 'email_verified', 'phone',
      'line_id', 'line_name', 'region', 'referral', 'plan', 'status',
      'event_count', 'last_event_at', 'registered_at', 'verified_at',
      'verification_token', 'token_expires_at', 'notes'
    ]);
    memSheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    memSheet.setFrozenRows(1);
  }

  // メールアドレスの重複チェック
  const existingData = memSheet.getDataRange().getValues();
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][3] === data.email) {
      const status = existingData[i][11];
      if (status === 'active') {
        return { success: false, message: 'このメールアドレスは既に登録されています。' };
      }
      if (status === 'pending') {
        // 仮登録中 - トークンを再生成して再送信
        const token = generateToken();
        const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
        const row = i + 1;
        memSheet.getRange(row, 17).setValue(token);
        memSheet.getRange(row, 18).setValue(tokenExpiry);

        sendMemberConfirmationEmail({
          name: data.name,
          email: data.email,
          token: token,
          language: data.language || 'ja'
        });

        return { success: true, message: 'Confirmation email resent' };
      }
    }
  }

  // 会員IDを生成
  const memberId = generateMemberId(memSheet);
  const now = new Date();
  const token = generateToken();
  const tokenExpiry = new Date(now.getTime() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // 仮登録
  memSheet.appendRow([
    memberId,
    data.name,
    data.nameKana || '',
    data.email,
    false, // email_verified
    data.phone || '',
    '', // line_id
    '', // line_name
    data.region || '',
    data.referral || '',
    data.plan || 'free',
    'pending', // status
    0, // event_count
    '', // last_event_at
    now, // registered_at
    '', // verified_at
    token,
    tokenExpiry,
    '' // notes
  ]);

  // 確認メールを送信
  sendMemberConfirmationEmail({
    memberId: memberId,
    name: data.name,
    email: data.email,
    token: token,
    language: data.language || 'ja'
  });

  logEmail(data.email, data.name, '【三晶プロダクション】サポーター登録確認', 'member_confirm', memberId, 'sent');

  return {
    success: true,
    memberId: memberId,
    message: 'Registration submitted. Please check your email to confirm.'
  };
}

// ===== 会員確認（メールリンククリック） =====
function confirmMember(token) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const memSheet = ss.getSheetByName(SHEET_MEMBERS);

  if (!memSheet) {
    return createErrorPage('会員データが見つかりません。');
  }

  const data = memSheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][16] === token) { // verification_token
      const tokenExpiry = new Date(data[i][17]);
      const status = data[i][11];
      const memberId = data[i][0];

      if (status === 'active') {
        return createSuccessPage('既にサポーター登録が完了しています。', memberId);
      }

      if (now > tokenExpiry) {
        return createErrorPage('確認リンクの有効期限が切れています。再度登録してください。');
      }

      // 会員を確定
      const row = i + 1;
      memSheet.getRange(row, 5).setValue(true); // email_verified
      memSheet.getRange(row, 12).setValue('active'); // status
      memSheet.getRange(row, 16).setValue(now); // verified_at

      // 登録完了メールを送信
      sendMemberWelcomeEmail({
        memberId: memberId,
        name: data[i][1],
        email: data[i][3]
      });

      return createMemberSuccessPage(memberId, data[i][1]);
    }
  }

  return createErrorPage('無効な確認リンクです。');
}

// ===== 仮会員登録（イベント申込時） =====
function registerPendingMember(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let memSheet = ss.getSheetByName(SHEET_MEMBERS);

  if (!memSheet) {
    memSheet = ss.insertSheet(SHEET_MEMBERS);
    memSheet.appendRow([
      'member_id', 'name', 'name_kana', 'email', 'email_verified', 'phone',
      'line_id', 'line_name', 'region', 'referral', 'plan', 'status',
      'event_count', 'last_event_at', 'registered_at', 'verified_at',
      'verification_token', 'token_expires_at', 'notes'
    ]);
    memSheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    memSheet.setFrozenRows(1);
  }

  // 既存チェック
  const existingData = memSheet.getDataRange().getValues();
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][3] === data.email) {
      return; // 既に存在する場合はスキップ
    }
  }

  const memberId = generateMemberId(memSheet);
  const now = new Date();

  memSheet.appendRow([
    memberId,
    data.name,
    data.nameKana || '',
    data.email,
    false, // email_verified
    data.phone || '',
    '', '', '', '',
    'free',
    'pending',
    0, '',
    now, '',
    data.token,
    data.tokenExpiry,
    'イベント申込時に同時登録'
  ]);
}

// ===== メールで会員を確定 =====
function confirmMemberByEmail(email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const memSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!memSheet) return;

  const data = memSheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === email && data[i][11] === 'pending') {
      const row = i + 1;
      const memberId = data[i][0];
      const memberName = data[i][1] || '会員';

      memSheet.getRange(row, 5).setValue(true); // email_verified
      memSheet.getRange(row, 12).setValue('active'); // status
      memSheet.getRange(row, 16).setValue(now); // verified_at

      // 会員登録完了メールを送信
      try {
        sendMemberWelcomeEmail({
          memberId: memberId,
          name: memberName,
          email: email
        });
      } catch (e) {
        console.error('confirmMemberByEmail sendMemberWelcomeEmail error:', e);
      }
      break;
    }
  }
}

// ===== サポーター登録 Step1: 認証メール送信 =====
function sendVerificationEmail(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 仮会員シートを取得または作成
  let memSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!memSheet) {
    memSheet = ss.insertSheet(SHEET_MEMBERS);
    memSheet.appendRow([
      'member_id', 'name', 'name_kana', 'email', 'email_verified', 'phone',
      'line_id', 'line_name', 'region', 'referral', 'plan', 'status',
      'event_count', 'last_event_at', 'registered_at', 'verified_at',
      'verification_token', 'token_expires_at', 'notes'
    ]);
    memSheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    memSheet.setFrozenRows(1);
  }

  const now = new Date();
  const token = generateToken();
  const tokenExpiry = new Date(now.getTime() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // 既存メールアドレスチェック
  const existingData = memSheet.getDataRange().getValues();
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][3] === data.email) {
      const status = existingData[i][11];
      if (status === 'active') {
        return { success: false, message: 'このメールアドレスは既に登録されています。' };
      }
      if (status === 'pending') {
        // トークンを更新して再送信
        const row = i + 1;
        memSheet.getRange(row, 17).setValue(token);
        memSheet.getRange(row, 18).setValue(tokenExpiry);

        // 確認メール（詳細登録ページへのリンク）を送信
        sendStep2VerificationEmail({
          email: data.email,
          token: token,
          language: data.language || 'ja'
        });

        return { success: true, message: 'Verification email resent' };
      }
    }
  }

  // 新規仮登録（メールアドレスのみ）
  const memberId = generateMemberId(memSheet);
  memSheet.appendRow([
    memberId,
    '', // name - 後で入力
    '', // name_kana
    data.email,
    false, // email_verified
    '', // phone
    '', '', '', '',
    'free',
    'pending',
    0, '',
    now, '',
    token,
    tokenExpiry,
    'Step1: メール認証待ち'
  ]);

  // 確認メールを送信
  sendStep2VerificationEmail({
    email: data.email,
    token: token,
    language: data.language || 'ja'
  });

  return { success: true, message: 'Verification email sent' };
}

// ===== Step2確認メール送信 =====
function sendStep2VerificationEmail(info) {
  const verifyUrl = `${SITE_URL}?verified=true&token=${info.token}&email=${encodeURIComponent(info.email)}#supporter`;

  const subject = '【三晶プロダクション】メール認証のお願い';

  const body = `
三晶プロダクション サポーター登録

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ メール認証
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下のリンクをクリックして、登録を続けてください。
（24時間以内にクリックしないと無効になります）

▼ 登録を続ける
${verifyUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※このメールに心当たりがない場合は、このメールを破棄してください。

─────────────────────────
三晶プロダクション
${SITE_URL}
─────────────────────────
`;

  GmailApp.sendEmail(info.email, subject, body);
}

// ===== サポーター登録 Step3: 詳細情報登録完了 =====
function completeRegistration(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const memSheet = ss.getSheetByName(SHEET_MEMBERS);

  if (!memSheet) {
    return { success: false, message: 'Member sheet not found' };
  }

  const sheetData = memSheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][3] === data.email && sheetData[i][16] === data.token) {
      const tokenExpiry = new Date(sheetData[i][17]);
      const status = sheetData[i][11];
      const memberId = sheetData[i][0];

      if (status === 'active') {
        return { success: false, message: 'Already registered' };
      }

      if (now > tokenExpiry) {
        return { success: false, message: 'Token expired' };
      }

      // 詳細情報を更新して登録完了
      const row = i + 1;
      memSheet.getRange(row, 2).setValue(data.name); // name
      memSheet.getRange(row, 5).setValue(true); // email_verified
      memSheet.getRange(row, 6).setValue(data.phone || ''); // phone
      memSheet.getRange(row, 11).setValue(data.supportType || 'free'); // plan
      memSheet.getRange(row, 12).setValue('active'); // status
      memSheet.getRange(row, 16).setValue(now); // verified_at
      memSheet.getRange(row, 19).setValue(data.message || ''); // notes

      // 登録完了メールを送信
      try {
        sendMemberWelcomeEmail({
          memberId: memberId,
          name: data.name || '会員',
          email: data.email
        });
      } catch (e) {
        console.error('completeRegistration sendMemberWelcomeEmail error:', e);
      }

      return { success: true, memberId: memberId, message: 'Registration complete' };
    }
  }

  return { success: false, message: 'Invalid token or email' };
}

// ===== イベント関連 =====
function getEventById(eventId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eventId) {
      return {
        event_id: data[i][0],
        title: data[i][1],
        description: data[i][2],
        date: formatDate(data[i][3]),
        time_open: formatTime(data[i][4]),
        time_start: formatTime(data[i][5]),
        time_end: formatTime(data[i][6]),
        venue_name: data[i][7],
        venue_address: data[i][8],
        venue_access: data[i][9],
        capacity: data[i][10],
        reserved_count: data[i][11] || 0,
        waitlist_count: data[i][12] || 0,
        price_general: data[i][13],
        price_member: data[i][14],
        price_includes: data[i][15],
        accept_start: data[i][16],
        accept_end: data[i][17],
        status: data[i][18],
        image_url: data[i][19],
        created_at: data[i][20],
        updated_at: data[i][21]
      };
    }
  }
  return null;
}

function getPublicEvents() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const events = [];
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const status = data[i][18];
    if (status === 'open' || status === 'full' || status === 'published') {
      const eventDate = new Date(data[i][3]);
      if (eventDate >= now) {
        events.push({
          event_id: data[i][0],
          title: data[i][1],
          description: data[i][2],
          date: formatDate(data[i][3]),
          time_open: formatTime(data[i][4]),
          time_start: formatTime(data[i][5]),
          venue_name: data[i][7],
          venue_address: data[i][8],
          capacity: data[i][10],
          reserved_count: data[i][11] || 0,
          price_general: data[i][13],
          price_member: data[i][14],
          price_includes: data[i][15],
          status: status,
          image_url: data[i][19]
        });
      }
    }
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

function getAllEvents() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const events = [];

  for (let i = 1; i < data.length; i++) {
    events.push({
      event_id: data[i][0],
      title: data[i][1],
      description: data[i][2],
      date: formatDate(data[i][3]),
      time_open: formatTime(data[i][4]),
      time_start: formatTime(data[i][5]),
      time_end: formatTime(data[i][6]),
      venue_name: data[i][7],
      venue_address: data[i][8],
      venue_access: data[i][9],
      capacity: data[i][10],
      reserved_count: data[i][11] || 0,
      waitlist_count: data[i][12] || 0,
      price_general: data[i][13],
      price_member: data[i][14],
      price_includes: data[i][15],
      accept_start: data[i][16],
      accept_end: data[i][17],
      status: data[i][18],
      image_url: data[i][19],
      created_at: data[i][20],
      updated_at: data[i][21]
    });
  }

  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  return events;
}

// ===== 管理者用：会員一覧取得 =====
function getMembers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const members = [];

  for (let i = 1; i < data.length; i++) {
    members.push({
      member_id: data[i][0],
      name: data[i][1],
      name_kana: data[i][2],
      email: data[i][3],
      email_verified: data[i][4],
      phone: data[i][5],
      region: data[i][8],
      plan: data[i][10],
      status: data[i][11],
      event_count: data[i][12],
      registered_at: data[i][14]
    });
  }

  return members;
}

// ===== 管理者用：予約一覧取得 =====
function getReservations(eventId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const reservations = [];

  // イベント情報を取得（タイトルと日付を含めるため）
  const eventsSheet = ss.getSheetByName(SHEET_EVENTS);
  const eventsData = eventsSheet ? eventsSheet.getDataRange().getValues() : [];
  const eventMap = {};
  for (let i = 1; i < eventsData.length; i++) {
    eventMap[eventsData[i][0]] = {
      title: eventsData[i][1],
      date: formatDate(eventsData[i][3])
    };
  }

  for (let i = 1; i < data.length; i++) {
    const resEventId = data[i][1];

    // eventIdでフィルタリング（指定された場合）
    if (eventId && resEventId !== eventId) continue;

    const eventInfo = eventMap[resEventId] || { title: '不明', date: '' };

    reservations.push({
      reservation_id: data[i][0],
      event_id: resEventId,
      event_title: eventInfo.title,
      event_date: eventInfo.date,
      member_id: data[i][2],
      name: data[i][3],
      name_kana: data[i][4],
      email: data[i][5],
      email_verified: data[i][6],
      phone: data[i][7],
      party_size: data[i][8],
      channel: data[i][9],
      status: data[i][10],
      is_member: data[i][11],
      reserved_at: data[i][16],
      confirmed_at: data[i][17],
      notes: data[i][20]
    });
  }

  // 予約日時で降順ソート
  reservations.sort((a, b) => new Date(b.reserved_at || 0) - new Date(a.reserved_at || 0));
  return reservations;
}

function updateEventReservedCount(eventId, addCount) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eventId) {
      const currentCount = data[i][11] || 0;
      const newCount = currentCount + addCount;
      const capacity = data[i][10];
      const row = i + 1;

      sheet.getRange(row, 12).setValue(newCount); // reserved_count

      // 満席チェック
      if (newCount >= capacity) {
        sheet.getRange(row, 19).setValue('full'); // status
      }
      break;
    }
  }
}

function saveEvent(data) {
  if (!verifyAdmin(data.adminEmail, data.adminPassword)) {
    return { success: false, message: 'Unauthorized' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_EVENTS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EVENTS);
    sheet.appendRow([
      'event_id', 'title', 'description', 'date', 'time_open', 'time_start', 'time_end',
      'venue_name', 'venue_address', 'venue_access', 'capacity', 'reserved_count', 'waitlist_count',
      'price_general', 'price_member', 'price_includes', 'accept_start', 'accept_end',
      'status', 'image_url', 'created_at', 'updated_at'
    ]);
    sheet.getRange(1, 1, 1, 22).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  if (data.eventId) {
    // 更新
    const sheetData = sheet.getDataRange().getValues();
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === data.eventId) {
        const row = i + 1;
        sheet.getRange(row, 2).setValue(data.title);
        sheet.getRange(row, 3).setValue(data.description || '');
        sheet.getRange(row, 4).setValue(data.date);
        sheet.getRange(row, 5).setValue(data.timeOpen || '');
        sheet.getRange(row, 6).setValue(data.timeStart);
        sheet.getRange(row, 7).setValue(data.timeEnd || '');
        sheet.getRange(row, 8).setValue(data.venueName);
        sheet.getRange(row, 9).setValue(data.venueAddress);
        sheet.getRange(row, 10).setValue(data.venueAccess || '');
        sheet.getRange(row, 11).setValue(data.capacity);
        sheet.getRange(row, 14).setValue(data.priceGeneral);
        sheet.getRange(row, 15).setValue(data.priceMember || '');
        sheet.getRange(row, 16).setValue(data.priceIncludes || '');
        sheet.getRange(row, 19).setValue(data.status);
        sheet.getRange(row, 20).setValue(data.imageUrl || '');
        sheet.getRange(row, 22).setValue(now);
        return { success: true, eventId: data.eventId };
      }
    }
    return { success: false, message: 'Event not found' };
  } else {
    // 新規作成
    const eventId = generateEventId(data.date);
    sheet.appendRow([
      eventId,
      data.title,
      data.description || '',
      data.date,
      data.timeOpen || '',
      data.timeStart,
      data.timeEnd || '',
      data.venueName,
      data.venueAddress,
      data.venueAccess || '',
      data.capacity,
      0, // reserved_count
      0, // waitlist_count
      data.priceGeneral,
      data.priceMember || '',
      data.priceIncludes || '',
      '', // accept_start
      '', // accept_end
      data.status || 'draft',
      data.imageUrl || '',
      now,
      now
    ]);
    return { success: true, eventId: eventId };
  }
}

function deleteEvent(data) {
  if (!verifyAdmin(data.adminEmail, data.adminPassword)) {
    return { success: false, message: 'Unauthorized' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) {
    return { success: false, message: 'Events sheet not found' };
  }

  const sheetData = sheet.getDataRange().getValues();
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][0] === data.eventId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Event deleted' };
    }
  }

  return { success: false, message: 'Event not found' };
}

// ===== 会員ID検証 =====
function verifyMemberId(memberId, email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet) return { valid: false };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === memberId && data[i][3] === email && data[i][11] === 'active') {
      return { valid: true, name: data[i][1] };
    }
  }
  return { valid: false };
}

// ===== 予約・会員一覧取得 =====
function getReservations(eventId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const reservations = [];

  for (let i = 1; i < data.length; i++) {
    if (!eventId || data[i][1] === eventId) {
      reservations.push({
        reservation_id: data[i][0],
        event_id: data[i][1],
        member_id: data[i][2],
        name: data[i][3],
        email: data[i][5],
        email_verified: data[i][6],
        phone: data[i][7],
        party_size: data[i][8],
        channel: data[i][9],
        status: data[i][10],
        is_member: data[i][11],
        price_applied: data[i][12],
        reserved_at: data[i][16],
        confirmed_at: data[i][17]
      });
    }
  }

  return reservations;
}

function getMembers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const members = [];

  for (let i = 1; i < data.length; i++) {
    members.push({
      member_id: data[i][0],
      name: data[i][1],
      email: data[i][3],
      email_verified: data[i][4],
      phone: data[i][5],
      plan: data[i][10],
      status: data[i][11],
      event_count: data[i][12],
      registered_at: data[i][14],
      verified_at: data[i][15]
    });
  }

  return members;
}

// ===== 管理者認証 =====
function adminLogin(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email and password required' };
  }
  if (verifyAdmin(email, password)) {
    return { success: true };
  }
  return { success: false, message: 'Invalid credentials' };
}

function verifyAdmin(email, password) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_ADMIN);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ADMIN);
    sheet.appendRow(['メールアドレス', 'パスワード', '名前', '権限', '作成日']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
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

// ===== メール送信 =====
function sendReservationConfirmationEmail(info) {
  if (!info || !info.email || !info.token) {
    console.error('sendReservationConfirmationEmail: invalid info', JSON.stringify(info));
    throw new Error('Invalid email info');
  }

  const gasUrl = ScriptApp.getService().getUrl();
  const confirmUrl = `${gasUrl}?action=confirmReservation&token=${info.token}`;

  const subject = '【三晶プロダクション】お申し込み確認';

  const body = `
${info.name} 様

イベントへのお申し込みありがとうございます。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ご予約内容（仮予約）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

イベント: ${info.eventTitle}
開催日: ${info.eventDate} ${info.eventTime}
会場: ${info.venueName}
参加人数: ${info.partySize}名
料金: ${info.price.toLocaleString()}円

申込番号: ${info.reservationId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 予約を確定するには
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下のリンクをクリックして、予約を確定してください。
（24時間以内にクリックしないと予約は無効になります）

▼ 予約を確定する
${confirmUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${info.wantsToRegister ? `
■ サポーター登録について

予約確定と同時にサポーター会員登録も完了します。
次回公演の先行案内などをお届けいたします。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}
※このメールに心当たりがない場合は、このメールを破棄してください。

─────────────────────────
三晶プロダクション
${SITE_URL}
─────────────────────────
`;

  GmailApp.sendEmail(info.email, subject, body);
}

function sendReservationConfirmedEmail(info) {
  const subject = '【三晶プロダクション】ご予約確定のお知らせ';

  const body = `
${info.name} 様

ご予約が確定しました。
当日のご来場を心よりお待ちしております。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ご予約内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

申込番号: ${info.reservationId}
イベント: ${info.eventTitle}
開催日: ${info.eventDate} ${info.eventTime}
会場: ${info.venueName}
住所: ${info.venueAddress}
参加人数: ${info.partySize}名
料金: ${info.price.toLocaleString()}円

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

当日は開場時間に合わせてお越しください。

キャンセルをご希望の場合は、お早めにご連絡ください。

─────────────────────────
三晶プロダクション
${SITE_URL}

〒961-0905
福島県白河市道場小路 31-14
─────────────────────────
`;

  GmailApp.sendEmail(info.email, subject, body);
}

function sendMemberConfirmationEmail(info) {
  const gasUrl = ScriptApp.getService().getUrl();
  const confirmUrl = `${gasUrl}?action=confirmMember&token=${info.token}`;

  const subject = '【三晶プロダクション】サポーター登録確認';

  const body = `
${info.name} 様

サポーター登録のお申し込みありがとうございます。

以下のリンクをクリックして、登録を完了してください。
（24時間以内にクリックしないと登録は無効になります）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▼ 登録を完了する
${confirmUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※このメールに心当たりがない場合は、このメールを破棄してください。

─────────────────────────
三晶プロダクション
${SITE_URL}
─────────────────────────
`;

  GmailApp.sendEmail(info.email, subject, body);
}

function sendMemberWelcomeEmail(info) {
  if (!info || !info.email || !info.memberId) {
    console.error('sendMemberWelcomeEmail: invalid info', JSON.stringify(info));
    throw new Error('Invalid member info');
  }

  const subject = `【三晶プロダクション】サポーター登録完了 - 会員番号: ${info.memberId}`;

  const body = `
${info.name} 様

三晶プロダクションのサポーターにご登録いただき、
誠にありがとうございます。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 会員情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

会員番号: ${info.memberId}
メールアドレス: ${info.email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

上記の会員番号は、イベント申し込み時に
会員価格が適用されます。大切に保管してください。

今後、以下のような情報をお届けいたします：
・落語会の先行案内
・サポーター限定イベント情報
・その他お得な情報

白河から世界へ、落語の未来を共に創っていただけることを
心より嬉しく思います。

─────────────────────────
三晶プロダクション
${SITE_URL}

〒961-0905
福島県白河市道場小路 31-14
─────────────────────────
`;

  GmailApp.sendEmail(info.email, subject, body);
}

// ===== メール送信ログ =====
function logEmail(toEmail, toName, subject, template, relatedId, status) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_EMAIL_LOG);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EMAIL_LOG);
    sheet.appendRow(['log_id', 'to_email', 'to_name', 'subject', 'template', 'related_id', 'status', 'sent_at', 'error_message']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const logId = 'LOG-' + Date.now();
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([logId, toEmail, toName, subject, template, relatedId, status, now, '']);
}

// ===== ユーティリティ =====
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateMemberId(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;

  for (let i = 1; i < data.length; i++) {
    const id = data[i][0];
    if (id && typeof id === 'string' && id.startsWith('MP-')) {
      const num = parseInt(id.substring(3), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  return 'MP-' + String(maxNum + 1).padStart(4, '0');
}

function generateEventId(date) {
  const dateStr = date.replace(/-/g, '');
  return 'EV-' + dateStr + '-01';
}

function generateReservationId(sheet, dateStr) {
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;

  for (let i = 1; i < data.length; i++) {
    const id = data[i][0];
    if (id && typeof id === 'string' && id.startsWith('RS-' + dateStr)) {
      const num = parseInt(id.split('-')[2], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  return 'RS-' + dateStr + '-' + String(maxNum + 1).padStart(3, '0');
}

function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(value);
}

function formatTime(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Tokyo', 'HH:mm');
  }
  return String(value);
}

// ===== HTML生成 =====
function createErrorPage(message) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>エラー - 三晶プロダクション</title>
      <style>
        body { font-family: "Noto Sans JP", sans-serif; text-align: center; padding: 50px 20px; background: #F5F0E8; }
        .error { color: #8B0A1A; }
        h1 { font-size: 24px; margin-bottom: 20px; }
        p { color: #555; line-height: 1.8; }
        a { color: #8B0A1A; }
      </style>
    </head>
    <body>
      <h1 class="error">エラー</h1>
      <p>${message}</p>
      <p><a href="${SITE_URL}">サイトに戻る</a></p>
    </body>
    </html>
  `);
}

function createSuccessPage(message, id) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>完了 - 三晶プロダクション</title>
      <style>
        body { font-family: "Noto Sans JP", sans-serif; text-align: center; padding: 50px 20px; background: #F5F0E8; }
        .success { color: #2A5C3D; }
        h1 { font-size: 24px; margin-bottom: 20px; }
        p { color: #555; line-height: 1.8; }
        .id { font-family: monospace; color: #8B0A1A; font-size: 18px; }
        a { color: #8B0A1A; }
      </style>
    </head>
    <body>
      <h1 class="success">✅ ${message}</h1>
      ${id ? `<p class="id">${id}</p>` : ''}
      <p><a href="${SITE_URL}">サイトに戻る</a></p>
    </body>
    </html>
  `);
}

function createMemberSuccessPage(memberId, name) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>サポーター登録完了 - 三晶プロダクション</title>
      <style>
        body { font-family: "Noto Sans JP", sans-serif; text-align: center; padding: 50px 20px; background: #F5F0E8; }
        .success { color: #2A5C3D; }
        h1 { font-size: 24px; margin-bottom: 20px; }
        p { color: #555; line-height: 1.8; }
        .member-id { font-family: monospace; color: #8B0A1A; font-size: 24px; font-weight: bold; padding: 20px; background: white; margin: 20px auto; max-width: 300px; }
        a { color: #8B0A1A; }
        .btn { display: inline-block; padding: 15px 30px; background: #8B0A1A; color: white; text-decoration: none; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1 class="success">🎉 サポーター登録完了</h1>
      <p>${name} 様</p>
      <p>サポーター登録が完了しました。</p>
      <p>会員番号:</p>
      <div class="member-id">${memberId}</div>
      <p>この会員番号はイベント申し込み時に<br>会員価格が適用されます。</p>
      <a href="${SITE_URL}" class="btn">サイトに戻る</a>
    </body>
    </html>
  `);
}

// ===== テスト関数 =====
function testSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // イベントシートを作成
  let eventSheet = ss.getSheetByName(SHEET_EVENTS);
  if (!eventSheet) {
    eventSheet = ss.insertSheet(SHEET_EVENTS);
    eventSheet.appendRow([
      'event_id', 'title', 'description', 'date', 'time_open', 'time_start', 'time_end',
      'venue_name', 'venue_address', 'venue_access', 'capacity', 'reserved_count', 'waitlist_count',
      'price_general', 'price_member', 'price_includes', 'accept_start', 'accept_end',
      'status', 'image_url', 'created_at', 'updated_at'
    ]);
    eventSheet.getRange(1, 1, 1, 22).setFontWeight('bold').setBackground('#1A2840').setFontColor('#FFFFFF');
    eventSheet.setFrozenRows(1);
  }

  Logger.log('Setup complete');
}
