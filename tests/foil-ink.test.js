import test from 'node:test';
import assert from 'node:assert/strict';
import { separateFoilInk } from '../src/stickers.js';

function wordmark() {
  const width = 20, height = 16, data = new Uint8ClampedArray(width * height * 4);
  const set = (x, y, rgb) => data.set([...rgb, 255], (y * width + x) * 4);
  for (let y = 2; y < 14; y++) for (let x = 2; x < 18; x++) {
    set(x, y, x === 2 || x === 17 || y === 2 || y === 13 ? [245, 245, 245] : [18, 20, 24]);
  }
  for (let y = 5; y < 11; y++) for (let x = 5; x < 15; x++) set(x, y, [120, 210, 255]);
  set(7, 7, [255, 255, 255]); // White sparkle inside the letter.
  set(8, 7, [130, 130, 130]); // Neutral shading inside the letter.
  set(10, 8, [18, 20, 24]); // Black letter counter stays printed.
  set(2, 6, [120, 210, 255]); // Coloured reflection on the exterior trim.
  return { width, height, data };
}

test('whole letter window removes neutral highlights but keeps counters, outlines and outer trim', () => {
  const pixels = wordmark();
  separateFoilInk(pixels);
  const alpha = (x, y) => pixels.data[(y * pixels.width + x) * 4 + 3];
  for (const [x, y] of [[5, 5], [7, 7], [8, 7], [14, 10]]) assert.equal(alpha(x, y), 0);
  for (const [x, y] of [[10, 8], [4, 7], [2, 6], [2, 2]]) assert.equal(alpha(x, y), 255);
  assert.equal(alpha(0, 0), 0);
});

test('neutral trim is not mistaken for a foil letter', () => {
  const pixels = wordmark();
  for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 200;
  const original = pixels.data.slice();
  separateFoilInk(pixels);
  assert.deepEqual(pixels.data, original);
});
