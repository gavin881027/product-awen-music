import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../docs/reliability.js');
const item = (id, title) => ({ id, title, type: 'album' });
function memory() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
}
test('保存后重新创建 store（刷新/重启）保留正文与待同步任务', () => {
  const storage = memory();
  R.createStore(storage, 'lib', 'a/b').save([item('1', '新标题')], ['1']);
  const reopened = R.createStore(storage, 'lib', 'a/b').read();
  assert.equal(reopened.songs[0].title, '新标题');
  assert.equal(reopened.sync.pending, true);
  assert.deepEqual(reopened.sync.statusIds, ['1']);
});
test('原子写入失败抛错且原数据完整，保留备份', () => {
  const storage = memory(), store = R.createStore(storage, 'lib', 'a/b');
  store.save([item('1', 'old')]);
  const before = storage.getItem('lib'), set = storage.setItem;
  storage.setItem = (key, value) => { if (key === 'lib') throw Error('quota'); set(key, value); };
  assert.throws(() => store.save([item('1', 'new')]), /quota/);
  assert.equal(storage.getItem('lib'), before);
  assert.equal(storage.getItem('lib.backup'), before);
});
test('同步失败与进程重启保留本地修改', () => {
  const storage = memory(), store = R.createStore(storage, 'lib', 'a/b');
  store.save([item('1', 'edited')]); store.failure();
  const fresh = R.createStore(storage, 'lib', 'a/b').read();
  assert.equal(fresh.songs[0].title, 'edited'); assert.equal(fresh.sync.pending, true);
});
test('旧 PUT 返回不能覆盖新编辑，也不能确认新编辑已同步', () => {
  const store = R.createStore(memory(), 'lib', 'a/b');
  const sent = [item('1', 'version1')]; store.save(sent);
  store.save([item('1', 'version2')]);
  const acknowledged = store.acknowledge(sent, 'sha1');
  assert.equal(acknowledged.songs[0].title, 'version2');
  assert.equal(acknowledged.sync.pending, true);
});
test('写入成功响应丢失后远端相同内容可确认，无须重复 PUT', () => {
  const store = R.createStore(memory(), 'lib', 'a/b');
  const sent = [item('1', 'value')]; store.save(sent); store.failure();
  const recovered = store.reconcile(sent);
  assert.equal(recovered.sync.pending, false);
  assert.equal(store.acknowledge(sent, 'sha').sync.pending, false);
});
test('不同标签页改不同记录保留双方；同一记录冲突保留两版', () => {
  const storage = memory();
  const a = R.createStore(storage, 'lib', 'a/b'); a.save([item('1', 'old'), item('2', 'old')]);
  const b = R.createStore(storage, 'lib', 'a/b');
  a.save([item('1', 'a'), item('2', 'old')]);
  b.save([item('1', 'old'), item('2', 'b')]);
  assert.deepEqual(b.read().songs.map(x => x.title), ['a', 'b']);
  assert.throws(() => a.save([item('1', 'a'), item('2', 'collision')]), /同时编辑/);
  const conflict = a.read().sync.conflicts[0];
  assert.equal(conflict.local.title, 'collision'); assert.equal(conflict.remote.title, 'b');
});
test('没有共同基线的历史差异不自动覆盖；冲突保存后重启仍可核对', () => {
  const storage = memory(), store = R.createStore(storage, 'lib', 'a/b');
  store.save([item('1', 'local')]); store.reconcile([item('1', 'remote')]);
  const reopened = R.createStore(storage, 'lib', 'a/b').read();
  assert.equal(reopened.songs[0].title, 'local');
  assert.equal(reopened.sync.conflicts[0].remote.title, 'remote');
});
test('基于共同基线检测双向变更与删除冲突', () => {
  const base = [item('1', 'old'), item('2', 'old')];
  const result = R.merge(base, [item('1', 'local')], [item('1', 'remote'), item('2', 'edited')]);
  assert.equal(result.conflicts.length, 2);
});
test('GitHub 大文件 content 为空时按 SHA 读取 blob，正确解码 Unicode', async () => {
  const text = JSON.stringify({ songs: [item('1', '中文 → 🌟')] });
  const urls = [];
  const fetcher = async url => { urls.push(url); return new Response(JSON.stringify(url.includes('/git/blobs/')
    ? { sha: 'abc', encoding: 'base64', content: Buffer.from(text).toString('base64') }
    : { sha: 'abc', encoding: 'none', content: '', size: 1200000 })); };
  const result = await R.readContent(fetcher, 'https://api.github.com/repos/a/b/contents/docs/library.json', 'fake');
  assert.equal(result.text, text); assert.match(urls[1], /git\/blobs\/abc$/);
});
test('成功响应截断不盲目重试 PUT，不泄漏响应正文', async () => {
  let calls = 0;
  await assert.rejects(R.githubJSON(async () => { calls++; return new Response('{'); }, 'PUT', 'mock', {}, 'fake'), /完整 JSON/);
  assert.equal(calls, 1);
});
test('单请求超时能退出，包括响应体等待', async () => {
  await assert.rejects(R.githubJSON((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Error('abort')));
  }), 'GET', 'mock', null, 'fake', { timeoutMs: 10 }), /超时/);
});
test('损坏本地文件不会被当空曲库覆盖', () => {
  const storage = memory(); storage.setItem('lib', '{');
  assert.throws(() => R.createStore(storage, 'lib', 'a/b'));
  assert.equal(storage.getItem('lib'), '{');
});
test('工作区旧标签页不能覆盖新保存，冲突分支可导出', () => {
  const storage = memory();
  storage.setItem('state', JSON.stringify({songs:[]}));
  const a = R.createWorkspaceStore(storage, 'state'), b = R.createWorkspaceStore(storage, 'state');
  a.save({songs:[item('1','new')]});
  assert.throws(() => b.save({songs:[item('1','stale')]}), /另一标签页/);
  assert.equal(JSON.parse(storage.getItem('state')).songs[0].title,'new');
});
test('工作区损坏记录不能被初始化覆盖', () => {
  const storage = memory(); storage.setItem('state','{');
  assert.throws(() => R.createWorkspaceStore(storage,'state').save({songs:[]}),/损坏/);
  assert.equal(storage.getItem('state'),'{');
});
test('审核操作在首次远端请求前持久化，重启重试保留原时间和原内容', () => {
  const storage = memory();
  const journal=R.createOperationJournal(storage,'ops');
  const first=journal.begin('repo:track:hash',{rawJson:'result-v1'});
  const retried=R.createOperationJournal(storage,'ops').begin('repo:track:hash',{rawJson:'new'});
  assert.deepEqual(retried,first);
  journal.finish(first);
  assert.equal(journal.begin(first.id,{}).status,'complete');
});
test('第二标签页仅推进编号不阻塞正文保存，保留较大编号', () => {
  const storage=memory();storage.setItem('state',JSON.stringify({songs:[item('1','old')],albums:[],seq:1}));
  const first=R.createWorkspaceStore(storage,'state');
  R.createWorkspaceStore(storage,'state').save({songs:[item('1','old')],albums:[],seq:2});
  first.save({songs:[item('1','new')],albums:[],seq:1});
  assert.equal(JSON.parse(storage.getItem('state')).seq,2);
  assert.equal(JSON.parse(storage.getItem('state')).songs[0].title,'new');
});
test('旧版正常保存产生的 writer 临时副本会清理，真实冲突分支保留', () => {
  const storage = memory();
  storage.setItem('lib', JSON.stringify({version:3,songs:[],sync:{repo:'a/b',base:null,pending:true,conflicts:[]}}));
  storage.setItem('lib.writer.legacy', 'large obsolete snapshot');
  storage.setItem('lib.writer.old.conflict.keep', 'rejected concurrent edit');
  R.createStore(storage, 'lib', 'a/b');
  assert.equal(storage.getItem('lib.writer.legacy'), null);
  assert.equal(storage.getItem('lib.writer.old.conflict.keep'), 'rejected concurrent edit');
});
test('正常曲库保存不再为每次编辑复制 writer 分支', () => {
  const storage = memory();
  R.createStore(storage, 'lib', 'a/b').save([item('1', 'value')]);
  assert.deepEqual([...Array(storage.length).keys()].map(index => storage.key(index))
    .filter(key => key.startsWith('lib.writer.')), []);
});
test('滚动备份空间不足不阻断主记录原子保存，并暴露降级状态', () => {
  const storage = memory();
  storage.setItem('state', JSON.stringify({songs:[item('1','old')],albums:[]}));
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === 'state.backup') throw new DOMException('quota', 'QuotaExceededError');
    originalSet(key, value);
  };
  const result = R.createWorkspaceStore(storage, 'state').save({songs:[item('1','new')],albums:[]});
  assert.equal(result.backupUpdated, false);
  assert.equal(JSON.parse(storage.getItem('state')).songs[0].title, 'new');
});
test('曲库备份空间不足仍保存主记录，并给出备份告警', () => {
  const storage = memory();
  storage.setItem('lib', JSON.stringify({version:3,songs:[item('1','old')],sync:{repo:'a/b',base:null,pending:true,conflicts:[]}}));
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === 'lib.backup') throw new DOMException('quota', 'QuotaExceededError');
    originalSet(key, value);
  };
  const store = R.createStore(storage, 'lib', 'a/b');
  store.save([item('1','new')]);
  assert.equal(store.read().songs[0].title, 'new');
  assert.match(store.getBackupWarning(), /空间不足/);
});
test('压缩存储无损还原 Unicode，并仅在实际缩小时替换主记录', () => {
  const storage = memory();
  const compact = R.createCompactingStorage(storage, ['state']);
  const raw = JSON.stringify({ title: '雨窗微光 → 🌧', prompt: 'warm tape saturation, '.repeat(50000) });
  compact.setItem('state', raw);
  assert.equal(compact.getItem('state'), raw);
  assert.ok(storage.getItem('state').length < raw.length / 2);
});
test('压缩曲库主记录可在重开后读取，避免重复 prompt 文本触发配额写入', () => {
  const storage = memory();
  const compact = R.createCompactingStorage(storage, ['lib', 'lib.backup']);
  const repeated = 'lo-fi study instrumental, warm tape saturation, '.repeat(30000);
  const first = R.createStore(compact, 'lib', 'a/b');
  first.save([item('1', repeated)]);
  const encoded = storage.getItem('lib');
  assert.ok(encoded.length < repeated.length / 2);
  assert.equal(R.createStore(compact, 'lib', 'a/b').read().songs[0].title, repeated);
});
test('大型本地与远端差异只保存冲突索引和 GitHub SHA，不复制整份远端曲库', () => {
  const storage = memory();
  const store = R.createStore(storage, 'lib', 'a/b');
  const local = [item('1', 'local-' + 'a'.repeat(300000))];
  const remote = [item('1', 'remote-' + 'b'.repeat(300000))];
  store.save(local);
  const reconciled = store.reconcile(remote, { repo: 'a/b', path: 'docs/library.json', sha: 'remote-file-sha' });
  assert.equal(reconciled.songs[0].title, local[0].title);
  assert.equal(reconciled.sync.base, null);
  assert.equal(reconciled.sync.remoteRef.sha, 'remote-file-sha');
  assert.equal(reconciled.sync.conflicts[0].compacted, true);
  assert.equal(reconciled.sync.conflicts[0].remoteHash, R.fingerprint(remote[0]));
  assert.doesNotMatch(storage.getItem('lib'), /remote-b/);
});
test('重复读取同一远端版本不累积相同冲突记录', () => {
  const store = R.createStore(memory(), 'lib', 'a/b');
  store.save([item('1', 'local-' + 'a'.repeat(300000))]);
  const remoteRef = { repo: 'a/b', path: 'docs/library.json', sha: 'same-remote-sha' };
  const remote = [item('1', 'remote-' + 'b'.repeat(300000))];
  store.reconcile(remote, remoteRef);
  const again = store.reconcile(remote, remoteRef);
  assert.equal(again.sync.conflicts.length, 1);
});
test('浏览器 PAT 写入测试只使用隔离分支，写后按 SHA 回读确认', async () => {
  const files = new Map();
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (url.endsWith('/git/ref/heads/main')) return new Response(JSON.stringify({ object: { sha: 'main-sha' } }));
    if (url.endsWith('/git/refs') && options.method === 'POST') return new Response(JSON.stringify({ ref: 'refs/heads/test' }), { status: 201 });
    if (url.includes('/contents/')) {
      const path = url.split('/contents/')[1].split('?')[0];
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        assert.equal(body.branch, 'test-audit');
        assert.equal(body.message, 'test: verify Awen browser PAT write path');
        const text = Buffer.from(body.content, 'base64').toString('utf8');
        files.set(path, { sha: 'file-sha', text });
        return new Response(JSON.stringify({ content: { sha: 'file-sha' } }));
      }
      const file = files.get(path);
      if (!file) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify({ sha: file.sha, encoding: 'base64', content: Buffer.from(file.text).toString('base64') }));
    }
    throw new Error(`unexpected request: ${url}`);
  };
  const result = await R.verifyGitHubWrite(fetcher, 'owner/repo', 'fake', {
    branch: 'test-audit', now: '2026-09-05T00:00:00Z', nonce: 'fixed',
  });
  assert.equal(result.sha, 'file-sha');
  assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(calls.some(call => call.url.includes('/contents/docs/library.json')), false);
});
