import assert from 'node:assert/strict';
import test from 'node:test';
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
