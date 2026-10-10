import test from 'node:test';
import assert from 'node:assert/strict';
import { StickerStage } from '../src/stage.js';

test('sticker zoom supports enlargement, reduction, limits and reset', () => {
  const stage = { zoom: 1 };
  for (const [input, expected] of [[1.5, 1.5], [.7, .7], [4, 2], [.1, .5], [1, 1]]) {
    StickerStage.prototype.setZoom.call(stage, input);
    assert.equal(stage.zoom, expected);
  }
});
