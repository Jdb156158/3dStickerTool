import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundProgress } from '../src/background.js';

test('local background removal reports resource downloads and inference distinctly', () => {
  assert.match(backgroundProgress('fetch:model', 40, 80), /50%/);
  assert.match(backgroundProgress('fetch:wasm', 0, 0), /0%/);
  assert.match(backgroundProgress('compute:inference', 1, 4), /本机/);
  assert.match(backgroundProgress('compute:encode', 4, 4), /透明主体/);
});
