import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceBoardViewport,
  normalizeBoardWheelDelta,
} from '../dist/components/BoardViewport.js';

test('publishes every viewport update synchronously for continuous gestures', () => {
  const viewportRef = {current: {x: 0, y: 0, scale: 1}};

  const first = advanceBoardViewport(
    viewportRef,
    (current) => ({...current, scale: current.scale * 1.05}),
  );
  const second = advanceBoardViewport(
    viewportRef,
    (current) => ({...current, scale: current.scale * 1.05}),
  );

  assert.equal(first.scale, 1.05);
  assert.equal(second.scale, 1.1025);
  assert.equal(viewportRef.current, second);
});

test('normalizes line and page wheel deltas before pan or zoom', () => {
  assert.equal(normalizeBoardWheelDelta(2, 0, 900), 2);
  assert.equal(normalizeBoardWheelDelta(2, 1, 900), 32);
  assert.equal(normalizeBoardWheelDelta(2, 2, 900), 1800);
});
