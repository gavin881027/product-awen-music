// 阶段二回归：同步文档迁移、删除标记、并发写入和审核文件中断恢复的无网络契约。
// 所有数据均为虚构样例；本测试只读源码并在进程内模拟同步算法。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const pull = fs.readFileSync(path.join(root, 'docs/pull-library.html'), 'utf8');

function normalize(value = {}) {
  return {
    version: 3,
    songs: (value.songs || []).map(item => ({ ...item, syncId: item.syncId, updatedAt: item.updatedAt || '' })),
    tombstones: (value.tombstones || []).map(row => ({ syncId: row.syncId, deletedAt: row.deletedAt || '' })),
  };
}
function merge(remoteValue, localValue) {
  const remote = normalize(remoteValue); const local = normalize(localValue);
  const items = new Map();
  for (const item of [...remote.songs, ...local.songs]) {
    const previous = items.get(item.syncId);
    if (!previous || item.updatedAt >= previous.updatedAt) items.set(item.syncId, item);
  }
  const tombstones = new Map();
  for (const row of [...remote.tombstones, ...local.tombstones]) {
    const previous = tombstones.get(row.syncId);
    if (!previous || row.deletedAt >= previous.deletedAt) tombstones.set(row.syncId, row);
  }
  return {
    version: 3,
    songs: [...items.values()].filter(item => {
      const deletedAt = tombstones.get(item.syncId)?.deletedAt || '';
      return !deletedAt || item.updatedAt > deletedAt;
    }),
    tombstones: [...tombstones.values()],
  };
}

test('阶段二：相同展示 ID 的不同设备收藏由 syncId 共存', () => {
  const out = merge(
    { songs: [{ id: 'ALB-001', title: 'Remote Album', syncId: 'lib-remote', updatedAt: '2026-09-10T10:00:00.000Z' }] },
    { songs: [{ id: 'ALB-001', title: 'Local Album', syncId: 'lib-local', updatedAt: '2026-09-10T11:00:00.000Z' }] },
  );
  assert.equal(out.songs.length, 2);
  assert.deepEqual(new Set(out.songs.map(item => item.syncId)), new Set(['lib-remote', 'lib-local']));
});

test('阶段二：较新的同一 syncId 修改获保留，删除标记防止旧副本复活', () => {
  const newer = merge(
    { songs: [{ id: 'ALB-001', syncId: 'lib-a', title: 'old', updatedAt: '2026-09-10T10:00:00.000Z' }] },
    { songs: [{ id: 'ALB-001', syncId: 'lib-a', title: 'new', updatedAt: '2026-09-10T11:00:00.000Z' }] },
  );
  assert.equal(newer.songs[0].title, 'new');
  const deleted = merge(
    { songs: [{ id: 'ALB-001', syncId: 'lib-a', updatedAt: '2026-09-10T10:00:00.000Z' }] },
    { tombstones: [{ syncId: 'lib-a', deletedAt: '2026-09-10T12:00:00.000Z' }] },
  );
  assert.equal(deleted.songs.length, 0);
  assert.equal(deleted.tombstones[0].syncId, 'lib-a');
});

test('阶段二：晚于删除时间的明确新版本可重新出现', () => {
  const out = merge(
    { tombstones: [{ syncId: 'lib-a', deletedAt: '2026-09-10T12:00:00.000Z' }] },
    { songs: [{ id: 'ALB-001', syncId: 'lib-a', title: 'restored', updatedAt: '2026-09-10T13:00:00.000Z' }] },
  );
  assert.equal(out.songs.length, 1);
  assert.equal(out.songs[0].title, 'restored');
});

test('阶段二：主应用含队列、SHA 冲突重读重试与 v3 文档迁移', () => {
  assert.match(app, /const LIBRARY_SCHEMA_VERSION = 3;/);
  assert.match(app, /function createLibrarySyncId\(/);
  assert.match(app, /function mergeLibraryDocuments\(/);
  assert.match(app, /tombstones/);
  assert.match(app, /const librarySyncQueueRef = React\.useRef\(Promise\.resolve\(\)\)/);
  assert.match(app, /function isLibraryWriteConflict\(error\)/);
  assert.match(app, /error\?\.status === 409 \|\| error\?\.status === 422/);
  assert.match(app, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(app, /await readRemoteLibraryDocument\(\)/);
  assert.match(app, /await enqueueLibrarySync\(\(\) => syncLibraryDocument/);
});

test('阶段二：审核写入先读、同内容跳过、不同不可变内容拒绝覆盖', () => {
  assert.match(app, /async function writeReviewFile\(path, text, message, sha, options = \{\}\)/);
  assert.match(app, /let current = await readReviewFile\(path\)/);
  assert.match(app, /if \(current\?\.text === desired\) return \{ skipped: true, sha: current\.sha \}/);
  assert.match(app, /if \(current && !mutable\)/);
  assert.match(app, /审核文件已存在且内容不同/);
  assert.match(app, /\{ mutable: true \}/);
  assert.match(app, /if \(!remote\) \{\s*await writeReviewFile\(review\.sourcePath/s);
});

test('阶段二：导入页迁移 v2 数据并按 syncId 处理冲突和删除记录', () => {
  assert.match(pull, /const LIBRARY_SCHEMA_VERSION = 3;/);
  assert.match(pull, /function legacySyncId\(item\)/);
  assert.match(pull, /function mergeDocuments\(remote, local\)/);
  assert.match(pull, /远端删除记录/);
  assert.match(pull, /同 syncId 内容冲突/);
  assert.match(pull, /JSON\.stringify\(state\.mergedDocument\)/);
  assert.doesNotMatch(pull, /validateLibrary\(/);
});
