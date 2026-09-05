// Isolated Chromium profile. All GitHub / AI traffic is blocked or mocked.
// Run: AWEN_PLAYWRIGHT=/absolute/path/to/playwright/index.mjs node tests/browser-reliability.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.AWEN_PLAYWRIGHT).href);
const browser = await chromium.launch({ headless: true, ...(process.env.AWEN_BROWSER ? { executablePath: process.env.AWEN_BROWSER } : { channel: 'chrome' }) });
try {
  const context = await browser.newContext();
  await context.route('https://**', r => r.abort());
  await context.addInitScript(() => {
    localStorage.setItem('awen_guide_seen_v1', '1');
    localStorage.setItem('awen_ai_provider_v1', JSON.stringify({
      preset: 'deepseek-official-v4-flash', label: 'DeepSeek 官方 · V4 Flash',
      protocol: 'responses', baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash', apiKey: 'test-only-key'
    }));
  });
  let writes = 0;
  await context.route('https://api.github.com/**', route => {
    if (route.request().method() !== 'GET') writes++;
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"isolated outage"}' });
  });
  let providerPosts = 0;
  await context.route('**/api/llm', route => {
    providerPosts++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output_text: '{"ok":true}' }) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/');
  await page.getByRole('button', { name: 'Album', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Album', exact: true }).click();
  // The settings test sends the exact minimal provider probe through the
  // actual local proxy route. The isolated route above returns a fixed JSON.
  await page.getByRole('button', { name: '⚙', exact: true }).click();
  await page.getByRole('button', { name: '测试 Provider 连接', exact: true }).click();
  try {
    await page.getByText('连接成功：DeepSeek 官方 · V4 Flash').waitFor();
  } catch (error) {
    const messages = await page.locator('.settings-error, .settings-stored').allTextContents();
    throw new Error(`Provider test did not confirm success: ${messages.join(' | ')}`);
  }
  assert.equal(providerPosts, 1, 'The Provider test sends exactly one probe');
  await page.getByRole('button', { name: '×', exact: true }).first().click();
  // Seed test-only local storage using the app's actual template engine.
  await page.evaluate(() => {
    const built = window.AWEN.buildAlbum('day', window.AWEN.DEFAULTS, 3);
    const data = window.AWEN.fallbackAlbum('day', window.AWEN.DEFAULTS, built.recipes);
    data.tracks[0].lyrics += ' warm tape saturation and rainy-window focus'.repeat(12000);
    const album = { id: 'ALB-991', data, base: window.AWEN.DEFAULTS, status: 'Queued', starred: false };
    const recovered = { id: 'ALB-992', data: structuredClone(data), base: window.AWEN.DEFAULTS, status: 'Draft', starred: false };
    recovered.data.album = 'Workspace-only recovery album';
    const state = JSON.stringify({ mode: 'album', albums: [album, recovered], songs: [] });
    // A prior non-empty base used to prevent recovery, after which loading the
    // library silently replaced the two-album shelf with this one record.
    localStorage.setItem('awen_local_library_v1', JSON.stringify({ version: 3, songs: [{
      id: album.id, type: 'album', title: data.album, axisLabel: 'Day Arc',
      status: 'Queued', base: window.AWEN.DEFAULTS, albumSnapshot: { ...album, starred: true }, sunoRecipes: []
    }], sync: { repo: 'awenstudio/product-awen-music', base: [], pending: false, conflicts: [] } }));
    localStorage.setItem('awen_matrix_state_v1', state);
    window.addEventListener('pagehide', () => localStorage.setItem('awen_matrix_state_v1', state));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Album', exact: true }).waitFor();
  await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).first().waitFor();
  assert.equal(await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).count(), 2,
    'Background reconciliation must retain the workspace-only Album');
  // A manual Album status must win over the older shelf value and survive a
  // reload; this is the exact card control exposed by the status tooltip.
  await page.getByRole('button', { name: 'Album status: Queued, click to cycle', exact: true }).click();
  try {
    await page.getByRole('button', { name: 'Album status: Published, click to cycle', exact: true }).waitFor();
  } catch (error) {
    const statuses = await page.locator('.status').allTextContents();
    const notices = await page.locator('[role="status"], [role="alert"]').allTextContents();
    throw new Error(`Status did not persist: ${statuses.join(' | ')} / ${notices.join(' | ')}`);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  // The app's canonical-library recovery saves this oversized album locally
  // during boot; the card must remain readable and marked saved after reload.
  await page.locator('button[title="已收藏到曲库"]').first().waitFor();
  await page.reload();
  await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).first().waitFor();
  await page.locator('button[title="已收藏到曲库"]').first().waitFor();
  await page.getByRole('button', { name: 'Album status: Published, click to cycle', exact: true }).waitFor();
  await page.getByRole('button', { name: '重试曲库同步', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).first().waitFor();
  const recoveryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出本地备份 / 冲突明细', exact: true }).click();
  const recoveryFile = await recoveryDownload;
  assert.equal(recoveryFile.suggestedFilename(), 'awen-local-recovery.json');
  await page.getByRole('alert').filter({ hasText: '本地恢复包已开始下载' }).waitFor();
  // Disk failure must produce visible feedback and keep the prior bytes.
  const beforeFailure = await page.evaluate(() => localStorage.getItem('awen_local_library_v1'));
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'awen_local_library_v1') throw new DOMException('test quota', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Album status: Published, click to cycle', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '本地保存未完成' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('awen_local_library_v1')), beforeFailure);
  assert.equal(writes, 0, 'No real or mocked business PUT was needed');
  assert.equal(errors.length, 0, errors.join('\n'));
  await context.close();
  console.log('PASS: actual React app render, template album, refresh, local status, quota feedback, previous bytes preserved; zero remote writes');
} finally { await browser.close(); }
