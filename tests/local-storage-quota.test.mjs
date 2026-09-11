// localStorage quota regression: source-only checks; no browser storage or network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'docs/restore-today.html'), 'utf8');

test('state persistence strips only disposable cover previews', () => {
  assert.match(app, /function compactAlbumForStorage\(album\)/);
  assert.match(app, /const \{ previewDataUrl, \.\.\.coverAsset \} = album\.coverAsset/);
  assert.match(app, /albums: \(snapshot\?\.albums \|\| \[\]\)\.map\(compactAlbumForStorage\)/);
  assert.match(app, /JSON\.stringify\(compactSnapshotForStorage\(snapshot\)\)/);
  assert.match(app, /album\.coverAsset\?\.previewDataUrl \|\| album\.coverAsset\?\.downloadUrl/);
});

test('current state saves before best-effort backup so backup quota cannot block favourites', () => {
  const start = app.indexOf('function persistState(snapshot)');
  const end = app.indexOf('  React.useLayoutEffect', start);
  assert.ok(start >= 0 && end > start);
  const persistence = app.slice(start, end);
  const currentWrite = persistence.indexOf('localStorage.setItem(STORE_KEY, next)');
  const backupWrite = persistence.indexOf('localStorage.setItem(STORE_BACKUP_KEY, compactStoredSnapshot(previous))');
  assert.ok(currentWrite >= 0 && backupWrite > currentWrite, 'current state must be written before backup');
  assert.match(persistence, /catch \(backupError\) \{\}/);
  assert.match(persistence, /本地状态保存失败：浏览器存储空间不足/);
});

test('recovery page downloads a backup instead of accumulating timestamped localStorage snapshots', () => {
  assert.match(recovery, /function downloadStateBackup\(text\)/);
  assert.match(recovery, /downloadStateBackup\(previousText\)/);
  assert.match(recovery, /function compactState\(state\)/);
  assert.match(recovery, /JSON\.stringify\(compactState\(next\)\)/);
  assert.doesNotMatch(recovery, /backup_before_recovery_\$\{Date\.now\(\)\}/);
});
