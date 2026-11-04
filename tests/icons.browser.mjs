import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from 'playwright-core';
import {build} from 'vite';
import {DocumentBlock} from '../dist/components/DocumentBlock.js';
import {parseDocumentMarkdown} from '../dist/parseDocumentMarkdown.js';

const items = [
  {icon: 'camera', title: '**相机**工作流', description: '保存 `RAW` 原始素材。',
    note: '查看[验证证据](https://example.com/evidence)。'},
  {icon: 'backpack', title: '轻装出行', description: '减少设备与操作负担。'},
  {icon: 'smartphone', title: '随时整理', note: '只有备注时也保留字段语义。'},
  {icon: 'shield-check', title: '安全备份', description: '保留第二份副本。'},
];
const blocks = [
  {type: 'icons', layout: 'list', title: '三个购买假设', items: items.slice(0, 3)},
  ...[2, 3, 4].map((count) => ({type: 'icons', layout: 'columns', items: items.slice(0, count)})),
];
let browser;
let html;
let copyScript;

before(async () => {
  const [tokens, content, bundle] = await Promise.all([
    readFile(new URL('../styles/tokens.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/content.css', import.meta.url), 'utf8'),
    build({
      configFile: false,
      logLevel: 'silent',
      define: {'process.env.NODE_ENV': JSON.stringify('production')},
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(new URL('../src/components/DocumentCopy.tsx', import.meta.url)),
          formats: ['iife'],
          name: 'DocsEngineCopy',
        },
      },
    }),
  ]);
  const output = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((result) => result.output);
  copyScript = output.find((item) => item.type === 'chunk').code;
  html = `<!doctype html><html><head><style>${tokens}\n${content}</style></head>
    <body style="margin:0"><main class="de-root de-prose" style="padding:24px;font-family:sans-serif;background:var(--de-page)">
    ${blocks.map((block) => renderToStaticMarkup(createElement(DocumentBlock, {block}))).join('')}
    </main></body></html>`;
  browser = await chromium.launch({channel: 'chrome', headless: true});
});

after(async () => {
  await browser?.close();
});

async function openFixture(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(html);
  return page;
}

test('icons copy preserves explicit markers, field semantics and inline markdown', async (t) => {
  const page = await openFixture(t);
  await page.addScriptTag({content: copyScript});
  const markdown = await page.evaluate(() => {
    return window.DocsEngineCopy.serializeDocumentToMarkdown(document.querySelector('main'));
  });
  assert.deepEqual(parseDocumentMarkdown(markdown).blocks, blocks);
  assert.doesNotMatch(markdown, /<svg|<path|stroke|data-de-/);
});

for (const theme of ['light', 'dark']) {
  test(`icons align and stack at the 640px breakpoint in ${theme} theme`, async (t) => {
    const page = await openFixture(t);
    await page.locator('main').evaluate((root, theme) => root.setAttribute('data-theme', theme), theme);
    for (const width of [1000, 640, 639, 390]) {
      await page.setViewportSize({width, height: 1000});
      const metrics = await page.locator('.de-icons').evaluateAll((elements) => elements.map((block) => {
        const items = [...block.querySelectorAll('.de-icons__item')];
        const rects = items.map((item) => item.getBoundingClientRect());
        const icon = block.querySelector('.de-icons__icon');
        const title = block.querySelector('.de-icons__title');
        const note = block.querySelector('.de-icons__note');
        const style = getComputedStyle(block);
        return {
          layout: block.dataset.layout,
          widths: rects.map((rect) => rect.width),
          tops: rects.map((rect) => rect.top),
          borders: items.map((item) => getComputedStyle(item).borderTopWidth),
          iconSize: [icon.offsetWidth, icon.offsetHeight],
          iconColor: getComputedStyle(icon).color,
          titleColor: getComputedStyle(title).color,
          titleWeight: getComputedStyle(title).fontWeight,
          titleSize: parseFloat(getComputedStyle(title).fontSize),
          noteSize: parseFloat(getComputedStyle(note).fontSize),
          centered: getComputedStyle(items[0]).textAlign,
          background: style.backgroundColor,
          shadow: style.boxShadow,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      }));
      for (const block of metrics) {
        assert.deepEqual(block.iconSize, [20, 20]);
        assert.equal(block.iconColor, block.titleColor);
        assert.equal(block.titleWeight, '600');
        assert.ok(block.noteSize < block.titleSize);
        assert.equal(block.background, 'rgba(0, 0, 0, 0)');
        assert.equal(block.shadow, 'none');
        assert.equal(block.overflow, false);
        if (block.layout === 'list') {
          assert.deepEqual(block.borders, ['0px', '1px', '1px']);
        } else {
          assert.ok(block.widths.every((value) => Math.abs(value - block.widths[0]) < 1));
          assert.ok(block.borders.every((value) => value === '0px'));
          assert.equal(block.centered, 'center');
          if (width >= 640) assert.ok(block.tops.every((value) => value === block.tops[0]));
          else assert.ok(block.tops.every((value, index) => index === 0 || value > block.tops[index - 1]));
        }
      }
    }
  });
}
