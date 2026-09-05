// Isolated Chromium profile. All GitHub / AI traffic is blocked or mocked.
// Run: AWEN_PLAYWRIGHT=/absolute/path/to/playwright/index.mjs node tests/browser-reliability.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.AWEN_PLAYWRIGHT).href);
const browser = await chromium.launch({ headless: true, ...(process.env.AWEN_BROWSER ? { executablePath: process.env.AWEN_BROWSER } : { channel: 'chrome' }) });
try {
  const context = await browser.newContext();
  await context.route('https://**', r => r.abort());
  await context.addInitScript(() => localStorage.setItem('awen_guide_seen_v1', '1'));
  let writes = 0;
  await context.route('https://api.github.com/**', route => {
    if (route.request().method() !== 'GET') writes++;
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"isolated outage"}' });
  });
  await context.route('**/api/llm', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/');
  await page.getByRole('button', { name: 'Album', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Album', exact: true }).click();
  // Seed test-only local storage using the app's actual template engine.
  await page.evaluate(() => {
    const built = window.AWEN.buildAlbum('day', window.AWEN.DEFAULTS, 3);
    const data = window.AWEN.fallbackAlbum('day', window.AWEN.DEFAULTS, built.recipes);
    data.tracks[0].lyrics += ' warm tape saturation and rainy-window focus'.repeat(12000);
    const album = { id: 'ALB-991', data, base: window.AWEN.DEFAULTS, status: 'Queued', starred: false };
    const state = JSON.stringify({ mode: 'album', albums: [album], songs: [] });
    localStorage.setItem('awen_matrix_state_v1', state);
    window.addEventListener('pagehide', () => localStorage.setItem('awen_matrix_state_v1', state));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Album', exact: true }).waitFor();
  await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  // The app's canonical-library recovery saves this oversized album locally
  // during boot; the card must remain readable and marked saved after reload.
  await page.locator('button[title="已收藏到曲库"]').waitFor();
  await page.reload();
  await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).waitFor();
  await page.locator('button[title="已收藏到曲库"]').waitFor();
  await page.getByRole('button', { name: '重试曲库同步', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /展开 3 首曲目 Prompt/ }).waitFor();
  // Disk failure must produce visible feedback and keep the prior bytes.
  const beforeFailure = await page.evaluate(() => localStorage.getItem('awen_local_library_v1'));
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'awen_local_library_v1') throw new DOMException('test quota', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Album status: Queued, click to cycle', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '本地保存未完成' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('awen_local_library_v1')), beforeFailure);
  assert.equal(writes, 0, 'No real or mocked business PUT was needed');
  assert.equal(errors.length, 0, errors.join('\n'));
  await context.close();
  console.log('PASS: actual React app render, template album, refresh, local status, quota feedback, previous bytes preserved; zero remote writes');
} finally { await browser.close(); }
