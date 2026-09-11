// Awen Core API contract — no DOM, localStorage, network, GitHub or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIMS, BPM, DEFAULTS, ALBUM_AXES,
  fallbackPrompt, buildAlbum, fallbackAlbum, randomSelection, anchorDims,
} from '../core/awen-core.mjs';

test('Awen Core exports immutable algorithm configuration without browser globals', () => {
  assert.ok(Array.isArray(DIMS) && DIMS.length >= 6);
  assert.deepEqual(BPM.values, [55, 58, 60, 62, 65, 68, 70]);
  assert.equal(DEFAULTS.environment, 'Library');
  assert.ok(Array.isArray(ALBUM_AXES) && ALBUM_AXES.some(axis => axis.key === 'day'));
  assert.equal(typeof globalThis.window, 'undefined');
});

test('fallbackPrompt returns a usable deterministic local recipe', () => {
  const selection = { ...DEFAULTS, environment: 'Rainy Window', mood: 'Focused', bpm: 62 };
  const prompt = fallbackPrompt(selection);
  assert.equal(prompt.title, 'Rain on the Glass');
  assert.match(prompt.suno.style, /62 bpm/);
  assert.match(prompt.suno.exclude, /vocals/);
  assert.match(prompt.cover, /Rainy Window/i);
});

test('album API preserves requested count and axis invariants', () => {
  const selection = { ...DEFAULTS, environment: 'Library', mood: 'Calm' };
  const { axis, recipes } = buildAlbum('day', selection, 8);
  assert.equal(axis.key, 'day');
  assert.equal(recipes.length, 8);
  assert.ok(recipes.every(recipe => recipe.environment === 'Library'));
  assert.ok(new Set(recipes.map(recipe => recipe.time)).size > 1);
  assert.ok(anchorDims('day').includes('environment'));
  assert.ok(!anchorDims('day').includes('time'));
  const album = fallbackAlbum('day', selection, recipes);
  assert.equal(album.tracks.length, 8);
  assert.ok(album.album.includes('Library'));
});

test('randomSelection only returns documented matrix values', () => {
  const selection = randomSelection();
  for (const dim of DIMS) assert.ok(dim.options.includes(selection[dim.key]), `${dim.key} must be a documented option`);
  assert.ok(BPM.values.includes(selection.bpm));
});
