import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DocumentBlock} from '../dist/components/DocumentBlock.js';
import {knownIconNames} from '../dist/agent.js';
import {parseDocumentMarkdown} from '../dist/parseDocumentMarkdown.js';
import {serializeDocBlock} from '../dist/serializeDocumentMarkdown.js';
import {collectHeadings} from '../dist/collectHeadings.js';

test('parses labeled annotations, quotes, formulas and mermaid through one public parser', () => {
  const {blocks} = parseDocumentMarkdown(`
# Title

> [!annotation] 用户购买原因
> 我获得一种新的能力。

> 来源原话。

$$
\\text{海量生活} \\times \\text{轻装若行}
$$

\`\`\`mermaid 商业循环
flowchart LR
  a --> b
\`\`\`
`);

  assert.equal(blocks[0]?.type, 'annotation');
  assert.deepEqual(blocks[0], {
    type: 'annotation',
    label: '用户购买原因',
    text: '我获得一种新的能力。',
  });
  assert.equal(blocks[1]?.type, 'callout');
  assert.equal(blocks[1] && blocks[1].type === 'callout' ? blocks[1].title : '', '来源原话。');
  assert.equal(blocks[2]?.type, 'formula');
  assert.equal(blocks[2] && blocks[2].type === 'formula' ? blocks[2].latex.includes('海量生活') : false, true);
  assert.equal(blocks[3]?.type, 'diagram');
});

test('round-trips a labeled annotation back to the explicit markdown marker', () => {
  const lines = serializeDocBlock({
    type: 'annotation',
    label: '用户购买原因',
    text: '我太麻烦了。',
  });
  assert.deepEqual(
    parseDocumentMarkdown(lines.join('\n')).blocks,
    [{type: 'annotation', label: '用户购买原因', text: '我太麻烦了。'}],
  );
});

test('collects heading ids from the shared slugifier', () => {
  const headings = collectHeadings([
    {type: 'heading', level: 1, text: '能力增强（Capability）'},
    {type: 'heading', level: 2, text: '能力增强（Capability）'},
  ]);
  assert.equal(headings[0]?.id, '能力增强-capability');
  assert.equal(headings[1]?.id, '能力增强-capability-2');
});

test('parses icons list with a title, optional fields and multiline notes', () => {
  const {blocks, summary} = parseDocumentMarkdown(`
> [!icons] 三个购买假设
> - camera | A · **拍摄**与\`RAW\`
> 使用[工作流](/workflow)备份素材。
> 优先开展原型验证。
> 继续收集**证据**。
> - backpack | B · 轻装出行
> 少带设备。
> - smartphone | C · 随时整理
`);
  assert.deepEqual(blocks, [{
    type: 'icons', layout: 'list', title: '三个购买假设', items: [
      {icon: 'camera', title: 'A · **拍摄**与`RAW`', description: '使用[工作流](/workflow)备份素材。',
        note: '优先开展原型验证。 继续收集**证据**。'},
      {icon: 'backpack', title: 'B · 轻装出行', description: '少带设备。'},
      {icon: 'smartphone', title: 'C · 随时整理'},
    ],
  }]);
  assert.equal(summary, '三个购买假设');
});

for (const layout of ['list', 'columns']) {
  for (const title of [undefined, '**素材工作流**']) {
    test(`round-trips ${layout} icons ${title ? 'with' : 'without'} a block title`, () => {
      const block = {
        type: 'icons', layout, ...(title ? {title} : {}), items: [
          {icon: 'hard-drive', title: '**Storage**', description: '保存 `RAW`。',
            note: '查看[资源](https://example.com/assets)。'},
          {icon: 'search', title: 'Discovery', description: '找到素材。'},
          {icon: 'cloud', title: 'Delivery'},
          {icon: 'unknown-icon', title: '待定', note: '只有备注。'},
        ],
      };
      const markdown = serializeDocBlock(block).join('\n');
      assert.ok(markdown.includes(`> [!icons${layout === 'columns' ? ':columns' : ''}]`));
      assert.deepEqual(parseDocumentMarkdown(markdown).blocks, [block]);
      assert.equal(parseDocumentMarkdown(markdown).summary, title ?? '**Storage**');
    });
  }
}

test('parses explicit columns and respects surrounding paragraph and quote boundaries', () => {
  const {blocks} = parseDocumentMarkdown(`正文。

> [!icons:columns]
> - hard-drive | Storage
> 保存。
> - search | Discovery
> 发现。

> 原始引用。

结尾。`);
  assert.deepEqual(blocks, [
    {type: 'paragraph', text: '正文。'},
    {type: 'icons', layout: 'columns', items: [
      {icon: 'hard-drive', title: 'Storage', description: '保存。'},
      {icon: 'search', title: 'Discovery', description: '发现。'},
    ]},
    {type: 'callout', variant: 'annotation', title: '原始引用。', body: []},
    {type: 'paragraph', text: '结尾。'},
  ]);
});

test('falls back to the existing callout for icons markers without valid entries', () => {
  for (const marker of ['[!icons]', '[!icons:columns] 标题']) {
    const body = ['没有条目。', '- camera 缺少分隔符', '- camera |', '- Not_Kebab | 非法名称'];
    assert.deepEqual(parseDocumentMarkdown([marker, ...body].map((line) => `> ${line}`).join('\n')).blocks,
      [{type: 'callout', variant: 'annotation', title: marker, body}]);
  }
  assert.equal(parseDocumentMarkdown('> - camera | 普通引用').blocks[0].type, 'callout');
  assert.equal(parseDocumentMarkdown('- camera | 普通列表').blocks[0].type, 'list');
  assert.equal(parseDocumentMarkdown('> [!icons:other]\n> - camera | 标题').blocks[0].type, 'callout');
});

test('renders icons fields with MarkdownInline and preserves host inline overrides', () => {
  const block = {type: 'icons', layout: 'list', items: [{icon: 'camera',
    title: '**相机**', description: '`RAW`', note: '[资料](/reference)'}]};
  const html = renderToStaticMarkup(createElement(DocumentBlock, {block}));
  assert.match(html, /<strong>相机<\/strong>/);
  assert.match(html, /<code>RAW<\/code>/);
  assert.match(html, /<a href="\/reference"/);
  assert.match(html, /width="20" height="20"/);
  assert.match(html, /stroke-width="1.75"/);
  assert.match(html, /class="de-icons__icon" aria-hidden="true"/);
  assert.doesNotMatch(html, /class="de-icons__label"/);
  const custom = renderToStaticMarkup(createElement(DocumentBlock, {
    block, renderInline: (text) => createElement('mark', null, text),
  }));
  assert.match(custom, /<mark>\*\*相机\*\*<\/mark>/);
});

test('exports the explicit icon whitelist and renders every registered icon', () => {
  const required = 'users target flag message-circle megaphone hard-drive search sparkles wallet cpu camera backpack smartphone shield-check feather clock map-pin lock cloud folder image film music zap heart triangle-alert book-open list-checks check x scale refresh-cw eye timer'.split(' ');
  assert.deepEqual([...knownIconNames].sort(), required.sort());
  assert.ok(Object.isFrozen(knownIconNames));
  for (const icon of knownIconNames) {
    const html = renderToStaticMarkup(createElement(DocumentBlock, {block: {
      type: 'icons', layout: 'list', items: [{icon, title: icon}],
    }}));
    assert.match(html, /<svg /, icon);
  }
});

test('preserves unknown icon names, leaves an empty slot, and warns once per name only in development', () => {
  const originalWarn = console.warn;
  const originalEnvironment = process.env.NODE_ENV;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  const render = (icon) => renderToStaticMarkup(createElement(DocumentBlock, {block: {
    type: 'icons', layout: 'list', items: [{icon, title: '未知图标'}],
  }}));
  try {
    process.env.NODE_ENV = 'development';
    const markdown = '> [!icons]\n> - missing-lucide-icon | 未知图标';
    const block = parseDocumentMarkdown(markdown).blocks[0];
    assert.equal(block.items[0].icon, 'missing-lucide-icon');
    assert.equal(serializeDocBlock(block).join('\n').trim(), markdown);
    assert.match(render(block.items[0].icon), /class="de-icons__icon" aria-hidden="true"><\/span>/);
    render(block.items[0].icon);
    render('constructor');
    render('constructor');
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /missing-lucide-icon/);
    process.env.NODE_ENV = 'production';
    assert.doesNotMatch(render('another-missing-icon'), /<svg /);
    assert.equal(warnings.length, 2);
  } finally {
    console.warn = originalWarn;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
});
