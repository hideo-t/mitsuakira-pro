/**
 * 三晶プロダクション ─ 基本情報・通知先の設定
 * ============================================================
 * supporter-registration.gs と同じプロジェクトに追加するファイル。
 * payment_addition.gs と同じ扱いで、GASエディタに新しいファイルとして貼り付けます。
 *
 * このファイルが担当するもの
 *   1. settings シート（キー・値の1枚）の作成と読み書き
 *   2. 管理画面「基本情報設定」からの取得・保存
 *   3. 予約や会員登録が入ったときの、管理者への通知メール送信
 *
 * supporter-registration.gs 側に2行だけ追記が必要です。手順は
 * docs/SETTINGS_SETUP.md を参照してください。
 */

const SHEET_SETTINGS = 'settings';

/**
 * 設定項目の定義。ここが唯一の正で、シートも管理画面もこの配列から作られます。
 * 項目を増やすときは、この配列に1行足すだけで管理画面にも出ます。
 *
 *   key     … シートに保存されるキー。変更するとその設定は初期値に戻ります
 *   label   … 管理画面に出る項目名
 *   type    … text / email_list / tel / url / bool / textarea
 *   default … settings シートに何もないときの値
 *   note    … 管理画面の入力欄の下に出る補足
 */
const SETTINGS_DEFINITION = [
  // ---- 通知先（今回の主目的）----
  {
    group: '通知先',
    key: 'notify_reservation_to',
    label: '公演の申し込みが入ったときの通知先',
    type: 'email_list',
    default: '',
    note: '複数指定できます。カンマか改行で区切ってください。空にすると通知しません。'
  },
  {
    group: '通知先',
    key: 'notify_member_to',
    label: 'サポーター登録が完了したときの通知先',
    type: 'email_list',
    default: '',
    note: '複数指定できます。空にすると通知しません。'
  },
  {
    group: '通知先',
    key: 'notify_error_to',
    label: 'システムエラーの通知先',
    type: 'email_list',
    default: '',
    note: 'メール送信の失敗など、動かなくなったときの連絡先。担当者1名で十分です。'
  },
  {
    group: '通知先',
    key: 'notify_enabled',
    label: '通知メールを送る',
    type: 'bool',
    default: 'true',
    note: '一時的に止めたいときはオフにします。オフでも申込者への確認メールは送られます。'
  },

  // ---- 基本情報 ----
  {
    group: '基本情報',
    key: 'org_name',
    label: '事務所名',
    type: 'text',
    default: '三晶プロダクション',
    note: '通知メールの件名に使います。'
  },
  {
    group: '基本情報',
    key: 'contact_email',
    label: 'お問い合わせ先メールアドレス',
    type: 'text',
    default: '',
    note: 'お客様へ送るメールの末尾に載ります。空にすると、その行は出ません。上の通知先とは別のものです。'
  },
  {
    group: '基本情報',
    key: 'contact_phone',
    label: 'お問い合わせ先電話番号',
    type: 'tel',
    default: '',
    note: 'お客様へ送るメールの末尾に載ります。空にすると、その行は出ません。'
  },
  {
    group: '基本情報',
    key: 'site_url',
    label: 'サイトのURL',
    type: 'url',
    default: 'https://hideo-t.github.io/mitsuakira-pro',
    note: 'お客様へのメールと通知メールの末尾に載ります。空にするとコード側の既定値を使います。'
  },
  {
    group: '基本情報',
    key: 'line_url',
    label: 'LINE公式アカウントのURL',
    type: 'url',
    default: '',
    note: 'お客様へ送るメールの末尾に載ります。空にすると、その行は出ません。'
  },

  // ---- 運用 ----
  {
    group: '運用',
    key: 'reservation_note',
    label: '申し込み確認メールに添える一文',
    type: 'textarea',
    default: '',
    note: '公演の申し込み確認メールに、確定リンクの後ろで差し込まれます。当面の注意事項などにどうぞ。空なら何も出ません。'
  }
];

// ===== シートの用意 =====

/**
 * settings シートが無ければ作り、定義にあって行が無いキーを補充します。
 * 既存の値は書き換えません。
 */
function ensureSettingsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SETTINGS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.appendRow(['キー', '値', '項目名', '説明']);
    sheet.getRange(1, 1, 1, 4)
      .setFontWeight('bold')
      .setBackground('#1A2840')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 320);
    sheet.setColumnWidth(3, 260);
    sheet.setColumnWidth(4, 420);
  }

  const existing = {};
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) existing[String(values[i][0])] = true;
  }

  SETTINGS_DEFINITION.forEach(function (def) {
    if (!existing[def.key]) {
      sheet.appendRow([def.key, def.default, def.label, def.note]);
    }
  });

  return sheet;
}

// ===== 読み出し =====

/**
 * 設定をキーと値のオブジェクトで返します。GAS内部から使う用。
 * 定義にあってシートに無いキーは、初期値で埋めて返します。
 */
function getSettingsMap_() {
  const map = {};
  SETTINGS_DEFINITION.forEach(function (def) {
    map[def.key] = def.default;
  });

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) return map;

    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const key = String(values[i][0] || '').trim();
      if (key) map[key] = String(values[i][1] === null ? '' : values[i][1]).trim();
    }
  } catch (e) {
    console.error('getSettingsMap_ error:', e);
  }

  return map;
}

/**
 * 1件だけ取り出す近道。
 */
function getSetting_(key, fallback) {
  const v = getSettingsMap_()[key];
  return (v === undefined || v === '') ? (fallback === undefined ? '' : fallback) : v;
}

/**
 * 管理画面用。項目の定義と現在値をまとめて返します。
 * doGet から呼ばれ、認証は呼び出し側で済ませてあります。
 */
function getSettingsForAdmin() {
  ensureSettingsSheet_();
  const map = getSettingsMap_();

  return SETTINGS_DEFINITION.map(function (def) {
    return {
      group: def.group,
      key: def.key,
      label: def.label,
      type: def.type,
      note: def.note,
      value: map[def.key] === undefined ? def.default : map[def.key]
    };
  });
}

// ===== 保存 =====

/**
 * 管理画面からの保存。定義にあるキーだけを受け付けます。
 * 未知のキーは黙って捨てます（シートを壊されないように）。
 */
function saveSettings(data) {
  if (!verifyAdmin(data.adminEmail, data.adminPassword)) {
    return { success: false, message: 'Unauthorized' };
  }

  const incoming = data.settings || {};
  const known = {};
  SETTINGS_DEFINITION.forEach(function (def) { known[def.key] = def; });

  // 先に検証。1件でも不正なら何も書きません。
  const errors = [];
  Object.keys(incoming).forEach(function (key) {
    const def = known[key];
    if (!def) return;
    const raw = String(incoming[key] === null ? '' : incoming[key]).trim();
    if (raw === '') return;

    if (def.type === 'email_list') {
      const bad = parseRecipients_(raw).filter(function (a) { return !isValidEmail_(a); });
      if (bad.length) errors.push(def.label + '：メールアドレスの形式が正しくありません（' + bad.join(', ') + '）');
    } else if (def.type === 'url') {
      if (!/^https?:\/\//i.test(raw)) errors.push(def.label + '：http:// または https:// から始めてください');
    } else if (def.type === 'bool') {
      if (raw !== 'true' && raw !== 'false') errors.push(def.label + '：値が不正です');
    }
  });

  if (errors.length) {
    return { success: false, message: errors.join('\n') };
  }

  const sheet = ensureSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  const rowOf = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (key) rowOf[key] = i + 1;
  }

  let saved = 0;
  Object.keys(incoming).forEach(function (key) {
    const def = known[key];
    if (!def) return;
    const value = String(incoming[key] === null ? '' : incoming[key]).trim();

    if (rowOf[key]) {
      sheet.getRange(rowOf[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value, def.label, def.note]);
    }
    saved++;
  });

  return { success: true, message: saved + '件の設定を保存しました' };
}

// ===== 顧客向けメールへの差し込み =====

/**
 * 顧客に届くメールの署名。事務所名・サイト・連絡先を設定から組み立てる。
 * 未設定の項目は行ごと出さないので、空欄のまま運用しても不格好にならない。
 */
function mailSignature_() {
  const s = getSettingsMap_();
  const rule = '─────────────────────────';
  const lines = [rule, s.org_name || '三晶プロダクション'];

  // site_url が未設定のときは、コード側の SITE_URL 定数に落とす
  const url = s.site_url || (typeof SITE_URL !== 'undefined' ? SITE_URL : '');
  if (url) lines.push(url);

  if (s.contact_phone) lines.push('お電話　' + s.contact_phone);
  if (s.contact_email) lines.push('メール　' + s.contact_email);
  if (s.line_url) lines.push('LINE　' + s.line_url);

  lines.push(rule);
  return lines.join('\n');
}

/**
 * 申し込み確認メールに添える一文。未設定なら何も出さない（区切り線も出ない）。
 */
function reservationNoteBlock_() {
  const note = getSetting_('reservation_note', '');
  if (!note) return '';
  return '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + note + '\n\n';
}

// ===== 通知メール =====

/**
 * 「a@example.com, b@example.com」も改行区切りも受け付けて配列にします。
 */
function parseRecipients_(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;\n\r]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; });
}

function isValidEmail_(address) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

/**
 * 設定された宛先に通知を送ります。
 *
 * kind は 'reservation' / 'member' / 'error' のいずれか。
 * 宛先が未設定なら、何もせず false を返します（エラーにはしません）。
 * 通知の失敗が本来の処理を巻き添えにしないよう、例外は外に出しません。
 */
function notifyAdmins_(kind, subject, body) {
  try {
    const settings = getSettingsMap_();

    if (String(settings.notify_enabled) === 'false') return false;

    const keyOf = {
      reservation: 'notify_reservation_to',
      member: 'notify_member_to',
      error: 'notify_error_to'
    };
    const settingKey = keyOf[kind];
    if (!settingKey) return false;

    const recipients = parseRecipients_(settings[settingKey]).filter(isValidEmail_);
    if (!recipients.length) return false;

    const orgName = settings.org_name || '三晶プロダクション';

    GmailApp.sendEmail(
      recipients.join(','),
      '【' + orgName + '】' + subject,
      body
    );
    return true;
  } catch (e) {
    console.error('notifyAdmins_ error:', e);
    return false;
  }
}

/**
 * 予約が入ったときの通知。submitReservation から呼ばれます。
 */
function notifyReservation_(info) {
  const lines = [
    '公演の申し込みが入りました。',
    '',
    '受付番号 : ' + (info.reservationId || ''),
    'お名前   : ' + (info.name || ''),
    'メール   : ' + (info.email || ''),
    '公演     : ' + (info.eventTitle || ''),
    '開催日   : ' + (info.eventDate || ''),
    '人数     : ' + (info.partySize || 1) + '名',
    '金額     : ' + (info.price || 0) + '円',
    'サポーター: ' + (info.isMember ? 'はい' : 'いいえ'),
    '',
    '一覧は管理画面の「イベント申込」から確認できます。',
    getSetting_('site_url', '')
  ];
  return notifyAdmins_('reservation', '申し込み：' + (info.eventTitle || '公演'), lines.join('\n'));
}

/**
 * サポーター登録が完了したときの通知。completeRegistration から呼ばれます。
 */
function notifyMemberRegistered_(info) {
  const lines = [
    'サポーター登録が完了しました。',
    '',
    '会員番号 : ' + (info.memberId || ''),
    'お名前   : ' + (info.name || ''),
    'メール   : ' + (info.email || ''),
    '登録日   : ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
    '',
    '一覧は管理画面の「サポーター一覧」から確認できます。',
    getSetting_('site_url', '')
  ];
  return notifyAdmins_('member', 'サポーター登録：' + (info.name || ''), lines.join('\n'));
}

// ===== 動作確認用 =====

/**
 * GASエディタでこの関数を実行すると、設定した通知先に
 * テストメールを1通ずつ送ります。宛先が正しいかの確認に使ってください。
 */
function testNotificationRecipients() {
  ensureSettingsSheet_();
  const settings = getSettingsMap_();
  const result = [];

  [['reservation', '申し込み通知'], ['member', 'サポーター登録通知'], ['error', 'エラー通知']]
    .forEach(function (pair) {
      const kind = pair[0];
      const label = pair[1];
      const sent = notifyAdmins_(
        kind,
        'テスト送信（' + label + '）',
        'これは通知先の確認メールです。このメールが届いていれば、' + label + 'の宛先設定は正しく動いています。'
      );
      result.push(label + '：' + (sent ? '送信しました' : '宛先が未設定、または通知がオフです'));
    });

  const message = result.join('\n');
  console.log(message);
  return message;
}
