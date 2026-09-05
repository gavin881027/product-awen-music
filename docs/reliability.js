/* Local durability and GitHub transport. No credentials are stored here. */
(function (root) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const COMPACT_PREFIX = 'awen-lz78-v1:';
  // localStorage counts UTF-16 code units and gives a whole origin a small
  // shared quota. LZ78 keeps this synchronous (the persistence callers need a
  // definite result before showing success), preserves every code unit, and
  // only replaces a value when it is actually shorter than the original.
  function packText(text) {
    const input = String(text);
    const dictionary = new Map();
    const output = [];
    let phrase = '';
    let nextCode = 1;
    for (let index = 0; index < input.length; index += 1) {
      const character = input.charAt(index);
      const candidate = phrase + character;
      if (dictionary.has(candidate)) {
        phrase = candidate;
        continue;
      }
      output.push(String.fromCharCode(phrase ? dictionary.get(phrase) : 0), character);
      if (nextCode === 0xffff) {
        dictionary.clear();
        nextCode = 1;
      }
      dictionary.set(candidate, nextCode);
      nextCode += 1;
      phrase = '';
    }
    if (phrase) output.push(String.fromCharCode(0xffff), String.fromCharCode(dictionary.get(phrase)));
    const packed = output.join('');
    return packed.length + COMPACT_PREFIX.length < input.length ? COMPACT_PREFIX + packed : input;
  }
  function unpackText(value) {
    if (typeof value !== 'string' || !value.startsWith(COMPACT_PREFIX)) return value;
    const input = value.slice(COMPACT_PREFIX.length);
    if (input.length % 2) throw new Error('本地压缩记录不完整；已停止覆盖，请导出恢复包。');
    const dictionary = [''];
    const output = [];
    let nextCode = 1;
    for (let index = 0; index < input.length; index += 2) {
      const prefix = input.charCodeAt(index);
      const suffix = input.charCodeAt(index + 1);
      if (prefix === 0xffff) {
        if (!dictionary[suffix]) throw new Error('本地压缩记录损坏；已停止覆盖，请导出恢复包。');
        output.push(dictionary[suffix]);
        continue;
      }
      const base = prefix ? dictionary[prefix] : '';
      if (base === undefined) throw new Error('本地压缩记录损坏；已停止覆盖，请导出恢复包。');
      const phrase = base + String.fromCharCode(suffix);
      output.push(phrase);
      if (nextCode === 0xffff) {
        dictionary.length = 1;
        nextCode = 1;
      }
      dictionary[nextCode] = phrase;
      nextCode += 1;
    }
    return output.join('');
  }
  function createCompactingStorage(storage, keys) {
    const compactKeys = new Set(keys || []);
    return {
      get length() { return storage.length; },
      key(index) { return storage.key(index); },
      getItem(key) {
        const value = storage.getItem(key);
        return compactKeys.has(key) ? unpackText(value) : value;
      },
      setItem(key, value) { storage.setItem(key, compactKeys.has(key) ? packText(value) : value); },
      removeItem(key) { storage.removeItem(key); },
    };
  }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
      .filter(key => value[key] !== undefined).map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  const equal = (a, b) => stable(a) === stable(b);
  function fingerprint(value) {
    const text = stable(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  // localStorage is deliberately only the local working copy. Keeping a second
  // full cloud snapshot plus every conflicting version here can turn one
  // otherwise valid library write into a quota error. Small libraries retain
  // rich three-way bases; larger ones retain immutable GitHub references and
  // per-item hashes. The local version remains in `songs`, while the remote
  // version remains addressable by its GitHub file SHA and repository history.
  const SYNC_SNAPSHOT_MAX_CHARS = 256 * 1024;
  const SYNC_CONFLICT_MAX_CHARS = 128 * 1024;
  function boundedSnapshot(items) {
    if (!Array.isArray(items)) return null;
    return JSON.stringify(items).length <= SYNC_SNAPSHOT_MAX_CHARS ? clone(items) : null;
  }
  function boundedConflicts(conflicts, remoteRef) {
    const seen = new Set();
    const list = (conflicts || []).filter(conflict => {
      const key = [conflict.id,
        conflict.baseHash || (conflict.base ? fingerprint(conflict.base) : ''),
        conflict.localHash || (conflict.local ? fingerprint(conflict.local) : ''),
        conflict.remoteHash || (conflict.remote ? fingerprint(conflict.remote) : ''),
        conflict.remoteRef?.sha || remoteRef?.sha || ''].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (JSON.stringify(list).length <= SYNC_CONFLICT_MAX_CHARS) return list;
    return list.map(({ id, base, local, remote }) => ({
      id,
      compacted: true,
      baseHash: base ? fingerprint(base) : null,
      localHash: local ? fingerprint(local) : null,
      remoteHash: remote ? fingerprint(remote) : null,
      remoteRef: remoteRef || null,
    }));
  }
  function cleanupProvisionalWriterKeys(storage, key) {
    if (typeof storage.key !== 'function' || typeof storage.removeItem !== 'function') return 0;
    const prefix = key + '.writer.';
    const removable = [];
    for (let index = 0; index < storage.length; index += 1) {
      const candidate = storage.key(index);
      // Keys containing ".conflict." are the only writer records that hold a
      // rejected concurrent edit. Plain writer keys were temporary snapshots
      // written before every normal save and are safe to remove.
      if (candidate?.startsWith(prefix) && !candidate.includes('.conflict.')) removable.push(candidate);
    }
    removable.forEach(candidate => storage.removeItem(candidate));
    return removable.length;
  }
  function updateBackup(storage, key, previous, next) {
    if (!previous || previous === next) return true;
    try {
      storage.setItem(key + '.backup', previous);
      return true;
    } catch {
      // Keep the older backup. The primary key is still a single atomic
      // replacement and must not be blocked merely because a second full copy
      // does not fit in the browser quota.
      return false;
    }
  }
  function merge(base, local, remote) {
    const maps = [base || [], local, remote].map(items => new Map(items.map(item => [item.id, item])));
    const items = [], conflicts = [];
    for (const id of new Set([...maps[0].keys(), ...maps[1].keys(), ...maps[2].keys()])) {
      const [b, l, r] = maps.map(map => map.get(id));
      let chosen;
      if (equal(l, r)) chosen = l;
      else if (base !== null && equal(l, b)) chosen = r;
      else if (base !== null && equal(r, b)) chosen = l;
      else if (base === null && (!l || !r)) chosen = l || r;
      else { chosen = l; conflicts.push({ id, base: b || null, local: l || null, remote: r || null }); }
      if (chosen) items.push(chosen);
    }
    return { items, conflicts };
  }
  function createStore(storage, key, repo) {
    cleanupProvisionalWriterKeys(storage, key);
    const empty = () => ({ version: 3, songs: [], sync: { repo, base: null, pending: true, conflicts: [] } });
    function read() {
      const raw = storage.getItem(key);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.songs) || parsed.songs.some(item => !item || typeof item.id !== 'string' || !item.id) ||
          new Set(parsed.songs.map(item => item.id)).size !== parsed.songs.length) throw new Error('本地曲库格式损坏；已停止写入，请导出备份。');
      if (parsed.sync?.repo !== repo) parsed.sync = { repo, base: null, pending: true, conflicts: [] };
      return parsed;
    }
    let seen = read();
    let backupUpdated = true;
    function commit(next) {
      const previous = storage.getItem(key);
      const raw = JSON.stringify(next);
      // Back up the complete pre-write record when space permits. Failure to
      // rotate the backup does not turn a successful primary save into loss.
      backupUpdated = updateBackup(storage, key, previous, raw);
      storage.setItem(key, raw); // atomic single-key replacement; may throw quota errors
      seen = clone(next);
      return next;
    }
    return {
      read,
      getBackupWarning() { return backupUpdated ? '' : '自动备份空间不足，已保留较早备份。'; },
      save(items, statusIds = []) {
        const disk = read();
        const combined = merge(seen.songs, items, disk.songs);
        const remoteRef = disk.sync.remoteRef || null;
        const conflicts = boundedConflicts([...(disk.sync.conflicts || []), ...combined.conflicts], remoteRef);
        const next = { version: 3, songs: combined.items, sync: { ...disk.sync,
          base: boundedSnapshot(disk.sync.base), remoteRef, pending: true, conflicts,
          statusIds: [...new Set([...(disk.sync.statusIds || []), ...statusIds])], error: null } };
        commit(next);
        if (combined.conflicts.length) throw new Error('检测到其他标签页同时编辑；双方版本已保留，请导出同步备份核对。');
        return next;
      },
      reconcile(remote, remoteRef = null) {
        const disk = read();
        const combined = merge(disk.sync.base, disk.songs, remote);
        const base = boundedSnapshot(remote);
        return commit({ version: 3, songs: combined.items, sync: { ...disk.sync,
          base, remoteRef: base ? null : remoteRef,
          pending: !equal(combined.items, remote),
          // GitHub already retains every earlier remote blob by SHA. Persist
          // the current unresolved pair only; appending the same conflict on
          // every reload both exhausts localStorage and turns one conflict
          // into an ever-growing count.
          conflicts: boundedConflicts(combined.conflicts, remoteRef) } });
      },
      acknowledge(sent, sha) {
        const disk = read(); // never restore the earlier request snapshot over current edits
        const unchanged = equal(disk.songs, sent);
        const base = boundedSnapshot(sent);
        return commit({ ...disk, sync: { ...disk.sync, base,
          remoteRef: base ? null : { sha, itemCount: sent.length, retainedAt: new Date().toISOString() }, sha,
          pending: !unchanged, statusIds: unchanged ? [] : disk.sync.statusIds,
          error: null, confirmedAt: new Date().toISOString() } });
      },
      failure() {
        const disk = read();
        return commit({ ...disk, sync: { ...disk.sync, pending: true, error: '远端未确认；本地版本保留，可重试。' } });
      },
    };
  }
  // A separate key per writer retains the latest branch even if two browser
  // processes interleave a read/modify/write. Never stores provider settings.
  function writerId() { return root.crypto?.randomUUID?.() || Math.random().toString(36).slice(2); }
  function recordChanges(before, after) {
    const a = new Map((before || []).map(item => [item.id, item]));
    const b = new Map((after || []).map(item => [item.id, item]));
    return [...new Set([...a.keys(), ...b.keys()])].filter(id => !equal(a.get(id), b.get(id)))
      .map(id => ({ id, before: a.get(id) || null, after: b.get(id) || null }));
  }
  function createWorkspaceStore(storage, key) {
    cleanupProvisionalWriterKeys(storage, key);
    let seen = storage.getItem(key);
    const branch = key + '.writer.' + writerId();
    const preservedConflicts = new Set();
    let backupUpdated = true;
    let initial;
    try { initial = JSON.parse(seen) || {}; } catch { initial = {}; }
    return {
      save(snapshot) {
        let raw = JSON.stringify(snapshot);
        const current = storage.getItem(key);
        if (raw === current) { seen = current; return { backupUpdated }; }
        const recovery = { version: 1, songs: recordChanges(initial.songs, snapshot.songs),
          albums: recordChanges(initial.albums, snapshot.albums) };
        if (current !== seen) {
          let previous, disk;
          try { previous = JSON.parse(seen) || {}; disk = JSON.parse(current) || {}; } catch {}
          // Opening another tab can advance the ID allocator without editing
          // any prompt. Do not reject a real edit for that metadata-only write.
          if (!previous || !disk || !equal(previous.songs, disk.songs) || !equal(previous.albums, disk.albums))
          {
            // A later pagehide flush must not replace the rejected edit's
            // recovery branch with the older UI snapshot.
            const conflictText = JSON.stringify(recovery);
            if (!preservedConflicts.has(conflictText)) {
              storage.setItem(branch + '.conflict.' + writerId(), conflictText);
              preservedConflicts.add(conflictText);
            }
            throw new Error('另一标签页已保存不同工作区；当前编辑已保留在恢复包中，请先核对，未覆盖其他版本。');
          }
          const merged = { ...snapshot };
          for (const field of Object.keys(disk)) {
            if (!equal(previous[field], disk[field]) && equal(previous[field], snapshot[field])) merged[field] = disk[field];
          }
          raw = JSON.stringify(merged);
        }
        if (current) {
          try {
            const parsed = JSON.parse(current);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
                parsed.songs && !Array.isArray(parsed.songs) || parsed.albums && !Array.isArray(parsed.albums)) throw new Error('schema');
          }
          catch { throw new Error('原工作区损坏；已保留原字节和当前编辑，请导出恢复包。'); }
          backupUpdated = updateBackup(storage, key, current, raw);
        }
        storage.setItem(key, raw);
        seen = raw;
        return { backupUpdated };
      },
    };
  }
  function createOperationJournal(storage, prefix) {
    const keyFor = id => prefix + '.' + encodeURIComponent(id);
    const list = () => Array.from({ length: storage.length }, (_, i) => storage.key(i))
      .filter(key => key?.startsWith(prefix + '.')).map(key => JSON.parse(storage.getItem(key)));
    return {
      list,
      begin(id, payload) {
        const key = keyFor(id), existing = storage.getItem(key);
        if (existing) return JSON.parse(existing);
        const operation = { id, payload: clone(payload), createdAt: new Date().toISOString(), status: 'pending' };
        storage.setItem(key, JSON.stringify(operation));
        return operation;
      },
      finish(operation) { storage.setItem(keyFor(operation.id), JSON.stringify({ ...operation, status: 'complete' })); },
    };
  }
  async function githubJSON(fetcher, method, url, body, token, { signal, timeoutMs = 25000 } = {}) {
    const ctrl = new AbortController();
    const abort = () => ctrl.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const res = await fetcher(url, { method, signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const text = await res.text();
      if (!res.ok) {
        const error = new Error(`GitHub ${res.status}：请求未成功。`);
        error.status = res.status;
        if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') error.message = 'GitHub API 限流，请稍后重试。';
        throw error;
      }
      try { return JSON.parse(text); }
      catch { throw new Error('GitHub 响应不是完整 JSON；尚不能确认写入结果。'); }
    } catch (error) {
      // Never blindly retry a PUT: the server may have accepted it. Callers
      // reconcile by GET and compare bytes on the next attempt.
      if (ctrl.signal.aborted) throw new Error('GitHub 请求超时；写入结果尚未确认，请重试核对。');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async function readContent(fetcher, url, token) {
    const data = await githubJSON(fetcher, 'GET', url, null, token);
    if (!data.sha) throw new Error('GitHub 文件响应缺少 SHA，已停止同步。');
    if (data.encoding === 'base64' && typeof data.content === 'string' && data.content) {
      const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), c => c.charCodeAt(0));
      return { sha: data.sha, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
    }
    // Contents API may omit base64 for files larger than 1 MB. Pin raw GET
    // to the blob SHA, so a branch update between requests cannot mix versions.
    const blob = await githubJSON(fetcher, 'GET', url.replace(/\/contents\/.*$/, '/git/blobs/' + data.sha), null, token);
    if (blob.sha !== data.sha || blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new Error('GitHub 文件内容不完整，已停止同步。');
    return { sha: data.sha, text: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(blob.content.replace(/\s/g, '')), c => c.charCodeAt(0))) };
  }
  function toBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  async function verifyGitHubWrite(fetcher, repo, token, {
    branch = 'codex-reliability-audit-20260905',
    path = 'reliability-audit/browser-pat-write.json',
    now = new Date().toISOString(),
    nonce = writerId(),
  } = {}) {
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo || '')) throw new Error('GitHub 仓库格式无效。');
    if (!token) throw new Error('当前浏览器没有可用的 GitHub PAT。');
    const rootUrl = `https://api.github.com/repos/${repo}`;
    const mainRef = await githubJSON(fetcher, 'GET', `${rootUrl}/git/ref/heads/main`, null, token);
    if (!mainRef?.object?.sha) throw new Error('GitHub main 分支响应缺少提交 SHA。');
    let createdBranch = false;
    try {
      await githubJSON(fetcher, 'POST', `${rootUrl}/git/refs`, {
        ref: `refs/heads/${branch}`, sha: mainRef.object.sha,
      }, token);
      createdBranch = true;
    } catch (error) {
      if (error.status !== 422) throw error;
      const existingRef = await githubJSON(fetcher, 'GET', `${rootUrl}/git/ref/heads/${encodeURIComponent(branch)}`, null, token);
      if (!existingRef?.object?.sha) throw new Error('测试分支已存在，但无法确认其提交。');
    }
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const contentUrl = `${rootUrl}/contents/${encodedPath}`;
    let existing = null;
    try { existing = await readContent(fetcher, `${contentUrl}?ref=${encodeURIComponent(branch)}`, token); }
    catch (error) { if (error.status !== 404) throw error; }
    const text = JSON.stringify({ schemaVersion: 1, purpose: 'browser PAT write verification', repo, branch, verifiedAt: now, nonce }, null, 2) + '\n';
    const response = await githubJSON(fetcher, 'PUT', contentUrl, {
      message: 'test: verify Awen browser PAT write path', branch,
      content: toBase64Utf8(text), ...(existing?.sha ? { sha: existing.sha } : {}),
    }, token);
    if (!response?.content?.sha) throw new Error('GitHub 未返回测试文件确认 SHA。');
    const confirmed = await readContent(fetcher, `${contentUrl}?ref=${encodeURIComponent(branch)}`, token);
    if (confirmed.text !== text || confirmed.sha !== response.content.sha) throw new Error('GitHub 测试文件回读与写入内容不一致。');
    return { repo, branch, path, sha: confirmed.sha, createdBranch };
  }
  const api = { stable, equal, fingerprint, packText, unpackText, createCompactingStorage, merge, cleanupProvisionalWriterKeys, createStore, createWorkspaceStore, createOperationJournal, githubJSON, readContent, verifyGitHubWrite };
  if (typeof module !== 'undefined') module.exports = api;
  root.AwenReliability = api;
})(typeof window === 'undefined' ? globalThis : window);
