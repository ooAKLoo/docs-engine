// Run baseline first: node tests/board-performance.mjs --baseline 8685b8f
// Then run the working tree: node tests/board-performance.mjs
// Only Board/BoardViewport are substituted, preserving other worktree changes.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {boardProfilerPlugin, installBoardMetrics, measurePinch} from './board-performance-utils.mjs';

const baseline = process.argv[2] === '--baseline' ? process.argv[3] : undefined;
if (process.argv[2] && !baseline) throw new Error('Usage: board-performance.mjs [--baseline <git-ref>]');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const baselineSources = new Map(baseline ? ['Board.tsx', 'BoardViewport.ts'].map((file) => [
  `/src/components/${file}`,
  execFileSync('git', ['show', `${baseline}:src/components/${file}`], {cwd: projectRoot, encoding: 'utf8'}),
]) : []);
const server = await createServer({
  root: fileURLToPath(new URL('../showcase', import.meta.url)),
  plugins: [{
    name: 'board-baseline-snapshot', enforce: 'pre',
    transform(_source, id) {
      for (const [suffix, source] of baselineSources) if (id.endsWith(suffix)) return source;
    },
  }, boardProfilerPlugin],
  server: {host: '127.0.0.1', port: 0},
});
let browser;
try {
  await server.listen(0);
  browser = await chromium.launch({channel: 'chrome', headless: true});
  const results = [];
  for (const mode of ['inline', 'fullscreen']) {
    for (let run = 0; run < 3; run++) {
      const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 1});
      await installBoardMetrics(page);
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
      const board = page.locator('#diagram > .de-diagram').first();
      await board.locator('.de-board__node').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await board.scrollIntoViewIfNeeded();
      if (mode === 'fullscreen') {
        await board.hover();
        await board.getByRole('button', {name: /^全屏打开画板：/}).click();
        await page.getByRole('dialog').waitFor();
      }
      await page.waitForTimeout(1200);
      const prefix = mode === 'inline' ? '#diagram .de-diagram-inline' : '.de-diagram-viewer';
      results.push({mode, run: run + 1, ...await measurePinch(page, `${prefix}-canvas`, `${prefix}-stage`)});
      await page.close();
    }
  }
  console.log(JSON.stringify({environment: {
    revision: baseline ?? 'working tree',
    platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model,
    browser: browser.version(), node: process.version,
    viewport: '1280x900 / DPR 1', server: 'Vite development / React 18 StrictMode / headless Chrome',
    sample: '3 runs per mode; 60 ctrlKey wheel events; deltaY=-2; 16ms timers',
  }, results}, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
