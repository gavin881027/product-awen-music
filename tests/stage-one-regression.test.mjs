// 阶段一回归：只读验证收藏路径、UTF-8 读取、诊断页面无远端写入，以及历史配方加载保护。
// 本文件仅读取项目文件；不访问网络、不读取用户 localStorage、不使用任何真实凭据。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(projectRoot, relative), 'utf8');
const app = read('docs/index.html');
const pullPage = read('docs/pull-library.html');
const diagnosticPage = read('docs/push-test.html');
const legacyDiagnosticPage = read('docs/sync-check.html');

function base64Utf8(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}
function decodeBase64Utf8(value) {
  return new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0)));
}

test('阶段一：主应用将收藏读取统一为 docs/library.json 与 UTF-8 解码', () => {
  assert.match(app, /const LOCAL_LIB_KEY = 'awen_local_library_v1';/);
  assert.match(app, /const GH_LIB_PATH = 'docs\/library\.json';/);
  assert.match(app, /function decodeGitHubContent\(data\)/);
  assert.match(app, /return fromBase64Utf8\(data\.content\);/);
  assert.match(app, /function libraryItemsFromGitHub\(data\)/);
  assert.doesNotMatch(app, /JSON\.parse\(atob\(data\.content\.replace/);
  const sample = JSON.stringify({ version: 2, songs: [{ id: 'ALB-001', title: '雨后 Café · 中文' }] });
  assert.equal(decodeBase64Utf8(base64Utf8(sample)), sample, 'UTF-8 收藏内容必须无损往返');
});

test('阶段一：已保存的歌曲和专辑配方不在加载时被默认值重建', () => {
  assert.match(app, /const recipe = suno\.recipe\s*\?\s*normalizeSunoRecipe/);
  assert.match(app, /const sunoRecipe = tr\.sunoRecipe\s*\?\s*normalizeSunoRecipe/);
  assert.match(app, /Do not rebuild a persisted recipe on load/);
  assert.match(app, /A saved recipe is authoritative/);
});

test('阶段一：收藏导入页与主应用路径一致，并在冲突时拒绝写入', () => {
  assert.match(pullPage, /const GH_LIB_PATH = 'docs\/library\.json';/);
  assert.match(pullPage, /const DEFAULT_REPO = 'awenstudio\/product-awen-music';/);
  assert.match(diagnosticPage, /const DEFAULT_REPO = 'awenstudio\/product-awen-music';/);
  assert.match(pullPage, /const LOCAL_LIB_KEY = 'awen_local_library_v1';/);
  assert.doesNotMatch(pullPage, /awen_library/);
  assert.match(pullPage, /fromBase64Utf8/);
  assert.match(pullPage, /preview\.replaceChildren\(\)/);
  assert.doesNotMatch(pullPage, /\.innerHTML\s*=/);
  assert.match(pullPage, /同 syncId 内容冲突/);
  assert.match(pullPage, /localStorage\.setItem\(backupKey/);
  assert.match(pullPage, /localStorage\.setItem\(LOCAL_LIB_KEY/);
  assert.match(pullPage, /确认导入到 Awen 曲库/);
});

test('阶段一：两个诊断页不包含 GitHub 写入请求', () => {
  for (const [name, page] of [['push-test.html', diagnosticPage], ['sync-check.html', legacyDiagnosticPage]]) {
    assert.doesNotMatch(page, /method\s*:\s*['"](?:PUT|POST|PATCH|DELETE)['"]/i, `${name} 不得包含写方法`);
    assert.doesNotMatch(page, /test:\s*Awen 推送测试/i, `${name} 不得包含旧测试写入负载`);
    assert.doesNotMatch(page, /TEST-001/, `${name} 不得包含测试歌曲`);
  }
  assert.match(diagnosticPage, /const GH_LIB_PATH = 'docs\/library\.json';/);
  assert.match(diagnosticPage, /本次仅发送 GET 请求/);
});

test('阶段一：未运行构建脚本，主页面仍是直接维护入口', () => {
  const build = read('build.py');
  assert.match(build, /docs.*index\.html/);
  assert.match(app, /A saved recipe is authoritative/);
});
