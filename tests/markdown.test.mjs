import assert from 'node:assert/strict';
import test from 'node:test';

import {markdownInlineToPlainText} from '../dist/markdown.js';

test('extracts plain text for table-of-contents labels', () => {
  assert.equal(
    markdownInlineToPlainText('**Model Moat** 与 `Full Context`'),
    'Model Moat 与 Full Context',
  );
  assert.equal(
    markdownInlineToPlainText('[Rova Connect](/product/connect) 与 ![Rova 标志](/logo.png)'),
    'Rova Connect 与 Rova 标志',
  );
  assert.equal(markdownInlineToPlainText('~~旧定义~~ → *新定义*'), '旧定义 → 新定义');
  assert.equal(markdownInlineToPlainText('**未闭合的标题'), '未闭合的标题');
  assert.equal(markdownInlineToPlainText('另一个未闭合的标题**'), '另一个未闭合的标题');
});

test('preserves literal punctuation and unescapes markdown punctuation', () => {
  assert.equal(markdownInlineToPlainText('C_* API 与 price\\_usd'), 'C_* API 与 price_usd');
  assert.equal(
    markdownInlineToPlainText('Shared Intelligence × Private Context'),
    'Shared Intelligence × Private Context',
  );
});
