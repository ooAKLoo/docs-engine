import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {boardProfilerPlugin, installBoardMetrics, measurePinch} from './board-performance-utils.mjs';

let server;
let browser;
let baseUrl;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../showcase', import.meta.url)),
    plugins: [boardProfilerPlugin],
    server: {host: '127.0.0.1', port: 0},
  });
  await server.listen(0);
  baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({channel: 'chrome', headless: true});
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openBoard(t, viewport = {width: 1280, height: 900}) {
  const page = await browser.newPage({viewport});
  t.after(() => page.close());
  await installBoardMetrics(page);
  await page.goto(baseUrl);
  const board = page.locator('#diagram > .de-diagram').first();
  await board.locator('.de-board__node').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await board.scrollIntoViewIfNeeded();
  const stage = board.locator('.de-diagram-inline-stage');
  const canvas = board.locator('.de-diagram-inline-canvas');
  const reset = board.getByRole('button', {name: /^回到原位：/});
  const initialTransform = await stage.evaluate((element) => getComputedStyle(element).transform);
  return {page, board, stage, canvas, reset, initialTransform};
}

async function assertRestored({page, stage, initialTransform}) {
  await page.waitForFunction(
    ({initialTransform}) => {
      const stage = document.querySelector('#diagram .de-diagram-inline-stage');
      return getComputedStyle(stage).transform === initialTransform;
    },
    {initialTransform},
  );
  // A cancelled frame or zoom animation must not move the content again.
  await page.waitForTimeout(350);
  assert.equal(await stage.evaluate((element) => getComputedStyle(element).transform), initialTransform);
  assert.equal(await page.getByRole('dialog').count(), 0);
}

test('recovers a Board scrolled out of view without changing its document', async (t) => {
  const view = await openBoard(t);
  const {page, board, canvas, reset} = view;
  const content = await board.locator('[data-de-board-semantic]').textContent();
  const node = board.locator('.de-board__node').first();
  const initialNode = await node.boundingBox();
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(360, 3000);
  await page.waitForFunction(() => {
    const stage = document.querySelector('#diagram .de-diagram-inline-stage');
    return new DOMMatrixReadOnly(getComputedStyle(stage).transform).f < -2000;
  });
  assert.ok((await node.boundingBox()).y < rect.y);
  await reset.click();
  await assertRestored(view);
  const restoredNode = await node.boundingBox();
  const restoredCanvas = await canvas.boundingBox();
  assert.ok(Math.abs((restoredNode.x - restoredCanvas.x) - (initialNode.x - rect.x)) < 1);
  assert.ok(Math.abs((restoredNode.y - restoredCanvas.y) - (initialNode.y - rect.y)) < 1);
  assert.equal(await board.locator('[data-de-board-semantic]').textContent(), content);
  assert.equal(await board.locator('.de-diagram-inline-toolbar').evaluate(
    (element) => getComputedStyle(element).borderWidth,
  ), '0px');

  await board.getByRole('button', {name: /^全屏打开画板：/}).click();
  await page.getByRole('dialog').waitFor();
  const borders = await page.locator('.de-diagram-board-float').evaluateAll(
    (elements) => elements.map((element) => getComputedStyle(element).borderWidth),
  );
  assert.ok(borders.length > 0);
  assert.ok(borders.every((border) => border === '0px'));
  await page.keyboard.press('Escape');
});

for (const mode of ['inline', 'fullscreen']) {
  async function openSurface(t) {
    const view = await openBoard(t);
    if (mode === 'fullscreen') {
      // The inline toolbar only accepts pointer events while the Board is hovered.
      await view.board.hover();
      await view.board.getByRole('button', {name: /^全屏打开画板：/}).click();
      await view.page.getByRole('dialog').waitFor();
    }
    await view.page.waitForTimeout(1200);
    const prefix = mode === 'inline' ? '#diagram .de-diagram-inline' : '.de-diagram-viewer';
    return {...view, canvasSelector: `${prefix}-canvas`, stageSelector: `${prefix}-stage`};
  }

  test(`${mode}: pinch reaches its target next frame with no React commits or damping tail`, async (t) => {
    const {page, canvasSelector, stageSelector} = await openSurface(t);
    assert.ok(await page.evaluate(() => window.__boardMetrics.canvasCommits) > 0,
      'Profiler must have observed the initial BoardCanvas mount');
    const result = await measurePinch(page, canvasSelector, stageSelector);
    const expected = Math.min(4, result.initialScale * Math.exp(60 * 2 * 0.01));
    assert.ok(Math.abs(result.nextFrameScale - expected) < 0.00001, JSON.stringify(result));
    assert.equal(result.nextFrameScale, result.settledScale);
    assert.equal(result.commits, 0);
    assert.equal(result.canvasCommits, 0);
    assert.equal(result.commitsIncludingSettle, 1);
    assert.equal(result.canvasCommitsIncludingSettle, 0);
    assert.equal(await page.locator(stageSelector).first().evaluate((el) => el.style.willChange), '');
  });

  test(`${mode}: pixel pan batches events into one transform write and preserves pointer zoom anchoring`, async (t) => {
    const {page, canvasSelector, stageSelector} = await openSurface(t);
    const result = await page.evaluate(async ({canvasSelector, stageSelector}) => {
      const canvas = document.querySelector(canvasSelector);
      const stage = document.querySelector(stageSelector);
      const rect = canvas.getBoundingClientRect();
      const read = () => new DOMMatrixReadOnly(getComputedStyle(stage).transform);
      const before = read();
      window.__boardMetrics.commits = window.__boardMetrics.canvasCommits = 0;
      const point = {x: rect.width * 0.7, y: rect.height * 0.3};
      let writes = 0;
      const observer = new MutationObserver((mutations) => { writes += mutations.length; });
      // Count style writes after promotion; only the rAF should write transform.
      canvas.dispatchEvent(new WheelEvent('wheel', {deltaX: 2, deltaY: 3}));
      observer.observe(stage, {attributes: true, attributeFilter: ['style']});
      for (let i = 0; i < 9; i++) canvas.dispatchEvent(new WheelEvent('wheel', {deltaX: 2, deltaY: 3}));
      await new Promise(requestAnimationFrame);
      await Promise.resolve();
      observer.disconnect();
      const panned = read();
      canvas.dispatchEvent(new WheelEvent('wheel', {
        ctrlKey: true, deltaY: -2, clientX: rect.left + point.x, clientY: rect.top + point.y,
      }));
      await new Promise(requestAnimationFrame);
      const zoomed = read();
      return {dx: panned.e - before.e, dy: panned.f - before.f, writes, ...window.__boardMetrics,
        anchorX: (point.x - zoomed.e) / zoomed.a - (point.x - panned.e) / panned.a,
        anchorY: (point.y - zoomed.f) / zoomed.a - (point.y - panned.f) / panned.a};
    }, {canvasSelector, stageSelector});
    assert.ok(Math.abs(result.dx + 20) < 0.001);
    assert.ok(Math.abs(result.dy + 30) < 0.001);
    assert.equal(result.writes, 1);
    assert.equal(result.commits, 0);
    assert.equal(result.canvasCommits, 0);
    assert.ok(Math.abs(result.anchorX) < 0.01);
    assert.ok(Math.abs(result.anchorY) < 0.01);
  });

  for (const modifier of ['metaKey', 'ctrlKey']) {
    test(`${mode}: a discrete ${modifier} wheel notch retains a short smooth transition`, async (t) => {
      const {page, canvasSelector, stageSelector} = await openSurface(t);
      const result = await page.evaluate(async ({canvasSelector, stageSelector, modifier}) => {
        const canvas = document.querySelector(canvasSelector);
        const stage = document.querySelector(stageSelector);
        const rect = canvas.getBoundingClientRect();
        const read = () => new DOMMatrixReadOnly(getComputedStyle(stage).transform).a;
        const initial = read();
        window.__boardMetrics.commits = window.__boardMetrics.canvasCommits = 0;
        canvas.dispatchEvent(new WheelEvent('wheel', {
          [modifier]: true, deltaY: -120,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        }));
        await new Promise(requestAnimationFrame);
        const first = read();
        await new Promise((resolve) => setTimeout(resolve, 350));
        return {initial, first, settled: read(), hint: stage.style.willChange, ...window.__boardMetrics};
      }, {canvasSelector, stageSelector, modifier});
      const expected = Math.min(4, result.initial * Math.exp(120 * 0.0018));
      assert.ok(result.first > result.initial && result.first < expected);
      assert.ok(Math.abs(result.settled - expected) < 0.00001);
      assert.equal(result.hint, '');
      assert.equal(result.commits, 1);
      assert.equal(result.canvasCommits, 0);
    });
  }
}

test('fullscreen retains Space, right-button and hand-tool panning, grid tracking and Escape focus return', async (t) => {
  const {page, board} = await openBoard(t);
  const trigger = board.getByRole('button', {name: /^全屏打开画板：/});
  await board.hover();
  await trigger.click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(1200);
  const canvas = page.locator('.de-diagram-viewer-canvas');
  const stage = page.locator('.de-diagram-viewer-stage');
  const rect = await canvas.boundingBox();
  const read = () => stage.evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return {x: matrix.e, y: matrix.f};
  });
  for (const input of ['space', 'right', 'hand']) {
    if (input === 'space') await page.keyboard.down('Space');
    if (input === 'hand') {
      await page.locator('.de-diagram-board-tools').getByRole('button', {name: '手型移动工具', exact: true}).click();
    }
    await page.mouse.move(rect.x + rect.width - 80, rect.y + rect.height / 2);
    const before = await read();
    await page.mouse.down({button: input === 'right' ? 'right' : 'left'});
    await page.mouse.move(rect.x + rect.width - 40, rect.y + rect.height / 2 + 25, {steps: 4});
    await page.mouse.up({button: input === 'right' ? 'right' : 'left'});
    if (input === 'space') await page.keyboard.up('Space');
    await page.waitForTimeout(180);
    const after = await read();
    assert.ok(Math.abs(after.x - before.x - 40) < 0.01, input);
    assert.ok(Math.abs(after.y - before.y - 25) < 0.01, input);
    const grid = await canvas.evaluate((el) => ({
      x: parseFloat(el.style.getPropertyValue('--de-diagram-grid-x')),
      y: parseFloat(el.style.getPropertyValue('--de-diagram-grid-y')),
    }));
    assert.ok(Math.abs(grid.x - after.x) < 0.01);
    assert.ok(Math.abs(grid.y - after.y) < 0.01);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state: 'hidden'});
  assert.equal(await trigger.evaluate((el) => document.activeElement === el), true);
});

test('reset cancels pending pan and zoom frames and remains keyboard accessible', async (t) => {
  const view = await openBoard(t, {width: 390, height: 844});
  const {page, board, canvas, reset} = view;
  const rect = await canvas.boundingBox();
  await canvas.dispatchEvent('wheel', {
    deltaY: -120,
    ctrlKey: true,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
  });
  await page.waitForFunction(() => {
    const stage = document.querySelector('#diagram .de-diagram-inline-stage');
    return new DOMMatrixReadOnly(getComputedStyle(stage).transform).a > 1.05;
  });
  // Dispatch a new gesture and reset in the same task, before its frame runs.
  await board.evaluate((element) => {
    const canvas = element.querySelector('.de-diagram-inline-canvas');
    canvas.dispatchEvent(new WheelEvent('wheel', {deltaY: -120, ctrlKey: true}));
    canvas.dispatchEvent(new WheelEvent('wheel', {deltaX: 160, deltaY: 1800}));
    element.querySelector('button[title="恢复初始位置和缩放"]').click();
  });
  await assertRestored(view);

  for (const key of ['Enter', 'Space']) {
    await canvas.dispatchEvent('wheel', {deltaX: 200, deltaY: 1600});
    await page.waitForFunction(() => {
      const stage = document.querySelector('#diagram .de-diagram-inline-stage');
      return new DOMMatrixReadOnly(getComputedStyle(stage).transform).f < -1000;
    });
    await reset.focus();
    await reset.press(key);
    await assertRestored(view);
  }
});
