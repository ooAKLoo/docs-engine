import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceBoardViewport,
  boardViewportHasSettled,
  dampBoardViewport,
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

test('damps viewport motion without overshoot and independently of frame rate', () => {
  const start = {x: 0, y: 0, scale: 1};
  const target = {x: -240, y: 120, scale: 2};
  const oneFrame = dampBoardViewport(start, target, 100);
  let manyFrames = start;
  for (let index = 0; index < 10; index += 1) {
    manyFrames = dampBoardViewport(manyFrames, target, 10);
  }

  assert.ok(oneFrame.x > target.x && oneFrame.x < start.x);
  assert.ok(oneFrame.y < target.y && oneFrame.y > start.y);
  assert.ok(oneFrame.scale > start.scale && oneFrame.scale < target.scale);
  assert.ok(Math.abs(oneFrame.x - manyFrames.x) < 1e-9);
  assert.ok(Math.abs(oneFrame.scale - manyFrames.scale) < 1e-9);
});

test('settles only when translation and scale are visually indistinguishable', () => {
  const target = {x: -240, y: 120, scale: 2};
  assert.equal(
    boardViewportHasSettled({x: -239.95, y: 119.95, scale: 1.9998}, target),
    true,
  );
  assert.equal(
    boardViewportHasSettled({x: -239, y: 119.95, scale: 1.9998}, target),
    false,
  );
});
