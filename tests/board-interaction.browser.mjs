import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

let server;
let browser;
let baseUrl;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../showcase', import.meta.url)),
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
