// 审核导入恢复回归：只在 VM 内运行实际函数片段，所有 GitHub 调用均为 Mock。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
function part(startNeedle, endNeedle) {
  const start = html.indexOf(startNeedle); const end = html.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `missing ${startNeedle}`);
  return html.slice(start, end);
}

function makeResult(review) {
  return {
    id: review.id, sourceHash: review.sourceHash, decision: 'approve',
    scores: { focus: 8, dynamicStability: 8, vocalSafety: 10, warmth: 8, loopability: 8 },
    revised: { lyricsRoute: 'instrumental', structurePrompt: '', style: 'felt piano, warm tape', exclude: 'vocals, singing, spoken word, harsh percussion, sudden dynamics, crisp, polished', title: 'Mock Track' },
    changes: [], risks: [], summary: '',
  };
}

function createReviewVm({ manifestFailure = false } = {}) {
  const review = { id: 'MOCK-T01', key: 'MOCK-T01-hash', sourceHash: 'hash', reviewCount: 0, title: 'Mock Track', submittedAt: '2026-09-11T00:00:00.000Z' };
  const files = new Map(); const calls = []; let updates = 0;
  const code = [
    part('function validatePromptReviewResult(', '/* ---------- tooltip component'),
    part('function renderApprovedReviewMarkdown(', 'function validatePromptReviewResult('),
    part('  async function writeReviewFile(', '  function isGitHubWriteConflict('),
    part('  function promptReviewResultSignature(', '  function albumReviewFailureText('),
    part('  async function applyPromptReview(', '  async function adoptPromptReviewRevision('),
  ].join('\n');
  const context = vm.createContext({
    SUNO_EXCLUDE_DEFAULT: 'vocals, singing, spoken word, harsh percussion, sudden dynamics, crisp, polished',
    reviewSafeText: value => String(value || '').trim(),
    reviewListMarkdown: items => Array.isArray(items) && items.length ? items.map(item => `- ${item}`).join('\n') : '- 无',
    findPromptReviewSubject: () => ({ ai: { title: 'Mock Track', suno: { recipe: { workspace: 'Mock' } } }, promptReview: review }),
    reviewRepoReady: () => true,
    readReviewFile: async file => files.has(file) ? { text: files.get(file), sha: 'mock-sha' } : null,
    reviewGhFetch: async (method, file, body) => { calls.push({ method, file }); files.set(file, body.content); return { content: { sha: 'mock-sha' } }; },
    toBase64Utf8: text => text,
    isGitHubWriteConflict: error => error?.status === 409,
    normalizeSunoRecipe: recipe => ({ ...recipe }),
    upsertReviewManifest: async () => { if (manifestFailure) { const error = new Error('mock manifest unavailable'); error.status = 503; throw error; } },
    updatePromptReviewSubject: () => { updates += 1; }, pushToast: () => {}, setTimeout,
  });
  vm.runInContext(code, context);
  return { context, review, files, calls, get updates() { return updates; } };
}

test('相同审核 JSON 在部分成功后可安全重试，而不是因动态 reviewedAt 报冲突', async () => {
  const fixture = createReviewVm({ manifestFailure: true });
  const raw = JSON.stringify(makeResult(fixture.review));
  let first; let second;
  assert.equal(await fixture.context.applyPromptReview(fixture.review.id, raw, { silent: true, onError: error => { first = error; } }), false);
  assert.equal(first.status, 503, String(first?.stack || first));
  const callsAfterFirst = fixture.calls.length;
  assert.equal(await fixture.context.applyPromptReview(fixture.review.id, raw, { silent: true, onError: error => { second = error; } }), false);
  assert.equal(second.status, 503, 'retry reaches the remaining manifest step instead of false conflict');
  assert.equal(fixture.calls.length, callsAfterFirst, 'identical immutable artifacts are not written twice');
  assert.equal(fixture.updates, 0);
});

test('GitHub request timeout, per-track progress, and per-track archive display are wired', () => {
  assert.match(html, /const GH_REQUEST_TIMEOUT_MS = 30000;/);
  assert.match(html, /const controller = new AbortController\(\)/);
  assert.match(html, /signal: controller\.signal/);
  assert.match(html, /GitHub 请求超时/);
  assert.match(html, /async function applyAlbumPromptReviews\(albumId, rawJson, options = \{\}\)/);
  assert.match(html, /reportProgress\(`正在应用第 \$\{completed\}/);
  assert.match(html, /第 \$\{completed\}\/\$\{pending\.length\} 首未完成/);
  assert.match(html, /const \[applyProgress, setApplyProgress\] = React\.useState\(''\)/);
  assert.match(html, /hasAppliedPromptAudit\(tr\.promptReview\) \? \(/);
  assert.doesNotMatch(html, /\{hasAppliedAlbumAudit \? \(/);
});
