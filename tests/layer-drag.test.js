import test from 'node:test';
import assert from 'node:assert/strict';
import { StickerStage } from '../src/stage.js';

test('layer dragging continuously folds, reopens and rotates within safe bounds', () => {
  const stage = {};
  StickerStage.prototype.moveLayers.call(stage, 80, 120, 1, 0);
  assert.equal(stage.layerSpread, .5);
  assert.equal(stage.layerYaw, .4);
  StickerStage.prototype.moveLayers.call(stage, 1000, 300, .5, .4);
  assert.equal(stage.layerSpread, 0);
  assert.equal(stage.layerYaw, .8);
  StickerStage.prototype.moveLayers.call(stage, -1000, -300, 0, 0);
  assert.equal(stage.layerSpread, 1);
  assert.equal(stage.layerYaw, -.8);
});

test('layer button restores full expansion and neutral rotation', () => {
  const stage = { layerSpread: 0, layerYaw: .8 };
  StickerStage.prototype.setLayers.call(stage, true);
  assert.equal(stage.layers, true);
  assert.equal(stage.layerSpread, 1);
  assert.equal(stage.layerYaw, 0);
});
