import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const styles = await readFile(new URL('../styles/content.css', import.meta.url), 'utf8');
const docusaurusAdapter = await readFile(
  new URL('../src/adapters/docusaurus.ts', import.meta.url),
  'utf8',
);

test('publishes stable package entry points', () => {
  assert.ok(packageJson.exports['.']);
  assert.equal(packageJson.exports['./styles.css'], './styles/index.css');
  assert.ok(packageJson.exports['./adapters/docusaurus']);
  assert.equal(packageJson.peerDependencies.react, '>=18 <20');
  assert.equal(packageJson.peerDependencies['react-dom'], '>=18 <20');
  assert.equal(packageJson.dependencies.motion, '^12.23.24');
});

test('keeps annotation and table visuals borderless', () => {
  assert.match(styles, /border-radius:\s*999px/);
  assert.match(styles, /--de-annotation-line/);
  assert.match(styles, /\.de-table-shell/);
  assert.match(styles, /\.de-table-scroll/);
  assert.match(styles, /\.de-table/);
  assert.match(styles, /border-bottom:\s*1px solid var\(--de-line\)/);
  assert.doesNotMatch(styles, /border-right:/);
  assert.doesNotMatch(styles, /:where\(\.de-prose\) table/);
});

test('wraps markdown tables with the shared table component', () => {
  assert.match(docusaurusAdapter, /table:\s*Table/);
});

test('uses the borderless shared Mermaid surface', () => {
  assert.match(styles, /\.de-mermaid/);
  assert.match(styles, /\.docusaurus-mermaid-container/);
  assert.match(docusaurusAdapter, /look:\s*'classic'/);
  assert.doesNotMatch(docusaurusAdapter, /look:\s*'neo'/);
});

test('normalizes Mermaid labels without clipping descenders or covering edge lines', () => {
  assert.match(styles, /--de-mermaid-edge-label-offset-y:\s*-0\.72rem/);
  assert.match(styles, /\.label foreignObject/);
  assert.match(styles, /overflow:\s*visible/);
  assert.match(styles, /:is\(\.nodeLabel, \.edgeLabel\) p\s*\{[^}]*margin:\s*0 !important/s);
  assert.match(styles, /\.edgeLabels > \.edgeLabel \.label > foreignObject/);
  assert.match(styles, /transform:\s*translateY\(var\(--de-mermaid-edge-label-offset-y\)\)/);
});

test('exports an editable status property with host-owned persistence', async () => {
  const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const statusEditor = await readFile(new URL('../src/components/StatusEditor.tsx', import.meta.url), 'utf8');
  const statusFieldEditor = await readFile(new URL('../src/components/StatusFieldEditor.tsx', import.meta.url), 'utf8');
  assert.match(index, /StatusEditor/);
  assert.match(index, /StatusFieldEditor/);
  assert.match(statusEditor, /allowCreate/);
  assert.match(statusEditor, /toggleWhenBinary/);
  assert.match(statusEditor, /onCreate/);
  assert.match(statusEditor, /onChange/);
  assert.match(statusEditor, /LazyMotion/);
  assert.match(statusEditor, /AnimatePresence/);
  assert.match(statusFieldEditor, /onOptionsChange/);
  assert.match(statusFieldEditor, /usedValues/);
  assert.match(statusFieldEditor, /LazyMotion/);
  assert.match(statusFieldEditor, /viewBox="0 0 12 12"/);
  assert.doesNotMatch(statusFieldEditor, /⌄/);
  assert.doesNotMatch(styles, /\.de-status-popover\s*\{[^}]*\bborder\s*:/s);
});
