import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceBoardViewport,
  boardViewportHasSettled,
  dampBoardViewport,
  normalizeBoardWheelDelta,
  isContinuousBoardWheel,
  boardWheelZoomFactor,
} from '../dist/components/BoardViewport.js';

test('recognizes pixel streams immediately and keeps coarse low-frequency wheel input discrete', () => {
  const stream = {lastTime: -Infinity, continuous: false};
  const wheel = (deltaY, timeStamp, deltaMode = 0) => isContinuousBoardWheel(
    {deltaX: 0, deltaY, deltaMode, timeStamp}, stream,
  );
  assert.equal(wheel(120, 0), false);
  assert.equal(wheel(120, 180), false);
  assert.equal(wheel(2, 400), true);
  assert.equal(wheel(150, 416), true);
  assert.equal(wheel(90, 500), true);
  assert.equal(wheel(120, 800), false);
  assert.equal(wheel(120, 816), true);
  assert.equal(wheel(3, 832, 1), false);
  assert.equal(wheel(1, 848, 2), false);
});

test('pinch exponential gain composes without event-size clipping; wheel gain retains its notch cap', () => {
  assert.ok(Math.abs(boardWheelZoomFactor(-2, true) ** 60 - Math.exp(1.2)) < 1e-12);
  assert.equal(boardWheelZoomFactor(-120, false), Math.exp(120 * 0.0018));
  assert.equal(boardWheelZoomFactor(-1200, false), boardWheelZoomFactor(-120, false));
  assert.ok(Math.abs(boardWheelZoomFactor(2, true) * boardWheelZoomFactor(-2, true) - 1) < 1e-12);
});

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
