#!/usr/bin/env node
/**
 * GAS へのデプロイを1コマンドにまとめたもの。
 *
 *   npm run gas:deploy
 *
 * やること
 *   1. gas/*.gs の構文チェック（壊れたコードを本番に上げない）
 *   2. admin.html と index.html の GAS_URL が一致しているかの確認
 *   3. clasp push でコードを送る
 *   4. 既存のデプロイを新しいバージョンに差し替える
 *
 * 4がこのスクリプトの主目的。GASエディタで「デプロイを管理 → 編集 →
 * バージョン: 新バージョン」を手でやるのと同じことだが、ここを忘れると
 * コードを保存しても公開URLは古いままになる。手順から外せるようにした。
 *
 * 公開URLは変わらない。deploymentId を GAS_URL から取り出して、
 * 同じデプロイを更新しているため。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function die(message, hint) {
  console.error('\n  ' + message);
  if (hint) console.error('  → ' + hint);
  console.error('');
  process.exit(1);
}

function step(n, label) {
  console.log(`\n[${n}] ${label}`);
}

// ---------- 1. 構文チェック ----------
step(1, 'GAS ファイルの構文チェック');

const gasDir = join(ROOT, 'gas');
if (!existsSync(gasDir)) die('gas/ ディレクトリがありません。');

const gasFiles = readdirSync(gasDir).filter(f => f.endsWith('.gs'));
if (!gasFiles.length) die('gas/ に .gs ファイルがありません。');

let broken = 0;
for (const file of gasFiles) {
  try {
    new Script(readFileSync(join(gasDir, file), 'utf8'), { filename: file });
    console.log(`    OK   ${file}`);
  } catch (e) {
    broken++;
    console.log(`    NG   ${file}\n         ${e.message}`);
  }
}
if (broken) die(`${broken}件のファイルに構文エラーがあります。`, '直してからもう一度実行してください。デプロイはしていません。');

// ---------- 2. GAS_URL の確認 ----------
step(2, '公開URLの確認');

function readGasUrl(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) return null;
  const m = readFileSync(full, 'utf8').match(/const\s+GAS_URL\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

const urls = { 'admin.html': readGasUrl('admin.html'), 'index.html': readGasUrl('index.html') };
const found = Object.entries(urls).filter(([, v]) => v);

if (!found.length) die('admin.html にも index.html にも GAS_URL が見つかりません。');

const distinct = [...new Set(found.map(([, v]) => v))];
if (distinct.length > 1) {
  console.error('\n  admin.html と index.html の GAS_URL が食い違っています。');
  found.forEach(([f, v]) => console.error(`    ${f}: ${v}`));
  die('どちらが正しいか決めて、両方を揃えてから実行してください。');
}

const gasUrl = distinct[0];
const idMatch = gasUrl.match(/\/macros\/s\/([^/]+)\/exec/);
if (!idMatch) die(`GAS_URL の形式が想定と違います: ${gasUrl}`, '……/macros/s/<デプロイID>/exec の形である必要があります。');

const deploymentId = idMatch[1];
console.log(`    URL          ${gasUrl}`);
console.log(`    デプロイID   ${deploymentId.slice(0, 12)}…（このデプロイを更新します）`);

// ---------- 3. clasp の設定確認 ----------
step(3, 'clasp の設定を確認');

const claspPath = join(ROOT, '.clasp.json');
if (!existsSync(claspPath)) die('.clasp.json がありません。', 'docs/GAS_DEPLOY.md の「最初の1回だけ」を実行してください。');

const clasp = JSON.parse(readFileSync(claspPath, 'utf8'));
if (!clasp.scriptId || clasp.scriptId.startsWith('PUT_YOUR')) {
  die('.clasp.json の scriptId が未設定です。',
    'GASエディタのURL https://script.google.com/home/projects/<ここ>/edit から取って書き込んでください。');
}
if (!existsSync(join(gasDir, 'appsscript.json'))) {
  die('gas/appsscript.json がありません。',
    '先に npm run gas:pull を1回だけ実行してください。GAS側の設定を取り込みます（これをせずに push すると公開設定を上書きする恐れがあります）。');
}
console.log(`    scriptId     ${clasp.scriptId.slice(0, 12)}…`);
console.log(`    rootDir      ${clasp.rootDir || '.'}`);

// ---------- 4. push ----------
step(4, 'コードを GAS へ送信（clasp push）');
try {
  execFileSync(NPX, ['clasp', 'push', '-f'], { cwd: ROOT, stdio: 'inherit' });
} catch {
  die('push に失敗しました。', 'ログインが切れている場合は npm run gas:login を実行してください。');
}

// ---------- 5. デプロイ差し替え ----------
step(5, 'デプロイを新しいバージョンに差し替え');

let sha = '';
try {
  sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
} catch { /* git が無くても続行する */ }

const stamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const description = sha ? `${stamp} (${sha})` : stamp;

try {
  execFileSync(NPX, ['clasp', 'deploy', '-i', deploymentId, '-d', description], { cwd: ROOT, stdio: 'inherit' });
} catch {
  die('デプロイに失敗しました。',
    'deploymentId が正しいか確認してください（npx clasp deployments で一覧が出ます）。コードの push は済んでいます。');
}

console.log('\n========================================');
console.log('  デプロイしました');
console.log('  ' + description);
console.log('  URL は変わっていません：');
console.log('  ' + gasUrl);
console.log('========================================\n');
