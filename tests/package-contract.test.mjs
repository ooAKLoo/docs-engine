import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles/content.css', import.meta.url), 'utf8');
const tokens = await readFile(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const docusaurusAdapter = await readFile(
  new URL('../src/adapters/docusaurus.ts', import.meta.url),
  'utf8',
);
const showcase = await readFile(new URL('../showcase/src/Gallery.tsx', import.meta.url), 'utf8');
const model = await readFile(new URL('../src/model.ts', import.meta.url), 'utf8');

test('publishes stable package entry points', () => {
  assert.ok(packageJson.exports['.']);
  assert.equal(packageJson.exports['./styles.css'], './styles/index.css');
  assert.ok(packageJson.exports['./adapters/docusaurus']);
  assert.ok(packageJson.exports['./adapters/docusaurus-theme']);
  assert.ok(packageJson.files.includes('skills'));
  assert.equal(packageJson.peerDependencies.react, '>=18 <20');
  assert.equal(packageJson.peerDependencies['react-dom'], '>=18 <20');
  assert.equal(packageJson.dependencies.motion, '^12.23.24');
  assert.equal(packageJson.dependencies['lucide-react'], '^1.24.0');
  assert.equal(packageJson.dependencies.mermaid, undefined);
  assert.equal(packageJson.dependencies.katex, '^0.16.47');
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

test('shares one semantic palette between callouts, statuses and priorities', () => {
  for (const tone of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'neutral']) {
    assert.match(model, new RegExp(`\\| '${tone}'`));
    assert.match(tokens, new RegExp(`--de-callout-${tone}-background`));
  }
  for (const tone of ['neutral', 'done', 'progress', 'warning', 'danger']) {
    assert.match(tokens, new RegExp(`--de-status-${tone}-background`));
    assert.match(tokens, new RegExp(`--de-status-${tone}-ink`));
  }
  assert.doesNotMatch(tokens, /--de-callout-[a-z]+-border/);
  assert.match(styles, /\.de-callout\s*\{[^}]*border:\s*0;/s);
  assert.match(tokens, /--de-callout-green-background:\s*var\(--de-status-done-background\)/);
  assert.match(tokens, /--de-callout-blue-background:\s*var\(--de-status-progress-background\)/);
  assert.match(tokens, /--de-callout-red-background:\s*var\(--de-status-danger-background\)/);
  assert.match(tokens, /--de-callout-orange-background:\s*var\(--de-status-warning-background\)/);
  assert.match(tokens, /--de-callout-neutral-background:\s*var\(--de-status-neutral-background\)/);
  assert.match(styles, /\.de-callout:is\(\[data-variant='blue'\], \[data-variant='info'\]\)/);
  assert.match(styles, /\.de-callout:is\(\[data-variant='purple'\], \[data-variant='brand'\]\)/);
  assert.match(styles, /\.de-callout:is\(\[data-variant='neutral'\], \[data-variant='note'\]\)/);
});

test('exports a ChatGPT-style code block with language and copy controls', async () => {
  const codeBlock = await readFile(
    new URL('../src/components/CodeBlock.tsx', import.meta.url),
    'utf8',
  );
  assert.match(index, /CodeBlock/);
  assert.match(docusaurusAdapter, /pre:\s*CodeBlock/);
  assert.match(codeBlock, /de-code-block__toolbar/);
  assert.match(codeBlock, /navigator\.clipboard/);
  assert.match(codeBlock, /copyLabel = '复制代码'/);
  assert.match(styles, /\.de-code-block__pre/);
  assert.match(styles, /--de-code-background/);
  assert.match(styles, /:not\(pre\) > code/);
  assert.match(styles, /\.de-code-block \.de-code-block__pre/);
  assert.match(styles, /!important/);
});

test('exports an explicit native LaTeX formula block without guessing prose semantics', async () => {
  const formula = await readFile(new URL('../src/components/Formula.tsx', import.meta.url), 'utf8');
  assert.match(index, /Formula/);
  assert.match(formula, /katex\.renderToString/);
  assert.match(docusaurusAdapter, /Formula/);
  assert.doesNotMatch(docusaurusAdapter, /relationToLatex/);
  assert.doesNotMatch(docusaurusAdapter, /blockquote:/);
  assert.match(tokens, /--de-formula-ink:\s*#111111/);
  assert.doesNotMatch(tokens, /--de-formula-background/);
  assert.match(styles, /\.de-formula/);
  assert.match(styles, /\.de-formula\s*\{[^}]*background:\s*transparent;[^}]*text-align:\s*left;/s);
  assert.match(styles, /\.de-formula \.katex-display\s*\{[^}]*text-align:\s*left;/s);
  assert.doesNotMatch(styles, /\.de-formula\s*\{[^}]*border-radius:/s);
});

test('shows the explicit KaTeX formula in the visual showcase', () => {
  assert.match(showcase, /id="formula"/);
  assert.match(showcase, /<Formula/);
  assert.match(showcase, /String\.raw`\\text\{用户体验\}/);
  assert.match(showcase, /aria-label="用户体验等于跨渠道连续性/);
});

test('keeps the Urban and Uber Board demo in the visual showcase', () => {
  assert.match(showcase, /urbanUberMermaidSource/);
  assert.match(showcase, /GPS 普及/);
  assert.match(showcase, /Uber 必然出现/);
  assert.match(showcase, /Urban \/ Uber 因果链路/);
});

test('wraps markdown tables with the shared table component', () => {
  assert.match(docusaurusAdapter, /table:\s*Table/);
});

test('exports a no-wrap resource link with the shared Link2 icon', async () => {
  const resourceLink = await readFile(new URL('../src/components/ResourceLink.tsx', import.meta.url), 'utf8');
  assert.match(index, /ResourceLink/);
  assert.match(docusaurusAdapter, /ResourceLink/);
  assert.match(resourceLink, /Link2/);
  assert.match(styles, /\.de-resource-link/);
  assert.match(styles, /white-space:\s*nowrap/);
  assert.match(styles, /--de-resource-link-icon/);
});

test('publishes a native Docusaurus Mermaid Board theme', async () => {
  const docusaurusTheme = await readFile(
    new URL('../src/adapters/docusaurus-theme.ts', import.meta.url),
    'utf8',
  );
  const mermaidTheme = await readFile(
    new URL('../src/docusaurus-theme/Mermaid/index.tsx', import.meta.url),
    'utf8',
  );
  const mdxTheme = await readFile(
    new URL('../src/docusaurus-theme/MDXComponents/index.tsx', import.meta.url),
    'utf8',
  );
  assert.match(docusaurusTheme, /getThemePath/);
  assert.match(mermaidTheme, /<Board/);
  assert.match(mermaidTheme, /importSource=\{\{format: 'mermaid', source: value\}\}/);
  assert.match(mdxTheme, /docusaurusMdxComponents/);
  assert.doesNotMatch(mermaidTheme, /mermaid\.render/);
  assert.doesNotMatch(docusaurusAdapter, /mermaidThemeConfig/);
});

test('uses BoardDocument as the only editable diagram model', async () => {
  const mermaidComponentFiles = (await readdir(
    new URL('../src/components/', import.meta.url),
  )).filter((file) => file.startsWith('Mermaid')).sort();
  const board = await readFile(
    new URL('../src/components/Board.tsx', import.meta.url),
    'utf8',
  );
  const boardCanvas = await readFile(
    new URL('../src/components/BoardCanvas.tsx', import.meta.url),
    'utf8',
  );
  const boardModel = await readFile(
    new URL('../src/components/BoardModel.ts', import.meta.url),
    'utf8',
  );
  const mermaidImporter = await readFile(
    new URL('../src/components/MermaidImporter.ts', import.meta.url),
    'utf8',
  );
  assert.deepEqual(mermaidComponentFiles, ['MermaidImporter.ts']);
  assert.match(boardModel, /export type BoardDocument/);
  assert.match(boardModel, /version: 1/);
  assert.match(boardModel, /nodes: BoardNode\[\]/);
  assert.match(boardModel, /edges: BoardEdge\[\]/);
  assert.match(board, /document\?: BoardDocument/);
  assert.match(board, /defaultDocument\?: BoardDocument/);
  assert.match(board, /importSource\?: BoardImportSource/);
  assert.match(board, /onDocumentChange\?: \(change: BoardDocumentChange\)/);
  assert.doesNotMatch(board, /mermaidSource|onDiagramChange|onDiagramStructureChange/);
  assert.match(board, /importMermaid\(importSource\.source/);
  assert.match(board, /<BoardCanvas/);
  assert.match(boardCanvas, /document: BoardDocument/);
  assert.doesNotMatch(boardCanvas, /importMermaid|parseMermaid|source: string/);
  assert.match(mermaidImporter, /Promise<BoardDocument>/);
  for (const parser of ['parseFlowchart', 'parseSequence', 'parseState', 'parseEntities', 'parseGantt', 'parseGitGraph', 'parseTimeline', 'parseMindmap', 'parsePie']) {
    assert.match(mermaidImporter, new RegExp(`function ${parser}`));
  }
  assert.doesNotMatch(mermaidImporter, /renderSequence|renderState|renderGantt|<svg/u);
  assert.doesNotMatch(mermaidImporter, /import\('mermaid'\)|getDiagramFromText/);
  assert.match(board, /createPortal/);
  assert.match(board, /aria-modal="true"/);
  assert.match(board, /type MarqueeSession/);
  assert.match(boardCanvas, /onPointerMove/);
  assert.match(boardCanvas, /onDoubleClick/);
  assert.match(boardCanvas, /routeGraphEdges/);
  assert.match(boardCanvas, /placeDiagramEdgeLabels/);
  assert.match(boardCanvas, /getEmbeddedDiagramBounds/);
  assert.match(boardCanvas, /preserveAspectRatio="xMidYMid meet"/);
  assert.ok(
    boardCanvas.indexOf('className="de-board__edges"') <
      boardCanvas.indexOf('className="de-board__arrows"'),
    'all edge shafts must render before all arrowheads',
  );
  assert.ok(
    boardCanvas.indexOf('className="de-board__arrows"') <
      boardCanvas.indexOf('className="de-board__edge-labels"'),
    'all arrowheads must render before all opaque edge labels',
  );
  assert.match(boardCanvas, /findObstacleAvoidingRoute/);
  assert.match(boardCanvas, /snapNodePosition/);
  assert.match(boardCanvas, /beginConnection/);
  assert.match(boardCanvas, /moveRouteSegment/);
  assert.doesNotMatch(boardCanvas, /markerEnd/);
  assert.match(styles, /\.de-diagram-inline-toolbar/);
  assert.match(styles, /\.de-diagram-inline-stage/);
  assert.match(styles, /\.de-board__edge-label\[data-floating='true'\] rect/);
  assert.doesNotMatch(styles, /\.de-native-mermaid|\.de-board-flowchart/);
  assert.match(styles, /\.de-diagram-media-item/);
  assert.match(styles, /\.de-diagram-media-scale-handle/);
  assert.doesNotMatch(styles, /\.de-diagram-inline-canvas[^}]*\.de-board[^}]*min-height/s);
  assert.match(styles, /\.de-diagram-viewer-overlay/);
  assert.match(styles, /\.de-diagram-board-brand/);
  assert.match(styles, /\.de-diagram-board-zoom/);
  assert.match(styles, /\.de-diagram-viewer-stage/);
  assert.match(styles, /\.de-diagram-node-editor/);
  assert.match(styles, /\.de-diagram-shape-picker/);
  assert.match(styles, /\.de-diagram-selection-marquee/);
  assert.match(styles, /\.de-board__port-dot/);
  assert.match(styles, /\.de-board__connection-preview/);
  assert.match(styles, /\.de-board__guides/);
  assert.match(styles, /\.de-board__edge-path/);
  assert.match(styles, /\.de-board__edge-handle/);
  assert.match(styles, /\.de-board__node-badge/);
  assert.match(styles, /\.de-board__edge\[data-feedback='true'\]/);
  assert.match(styles, /\.de-board__edge-label\[data-bare='true'\]/);
  assert.match(styles, /overflow:\s*visible !important/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(index, /BoardDocument/);
  assert.match(index, /BoardDocumentChange/);
  assert.match(index, /BoardImportSource/);
  assert.match(index, /importMermaid/);
  assert.doesNotMatch(index, /DiagramFrame|DiagramBoardLayout/);
});

test('exports an interactive host-controlled timeline', async () => {
  const timeline = await readFile(
    new URL('../src/components/Timeline.tsx', import.meta.url),
    'utf8',
  );
  assert.match(index, /Timeline/);
  assert.match(model, /type TimelineItem/);
  assert.match(model, /type: 'timeline'/);
  assert.match(docusaurusAdapter, /Timeline/);
  assert.match(timeline, /LazyMotion/);
  assert.match(timeline, /domMax/);
  assert.match(timeline, /onPan=/);
  assert.match(timeline, /resolveTimelineInteraction/);
  assert.match(timeline, /createTimelineNotesLayout/);
  assert.match(timeline, /stackHeights/);
  assert.match(timeline, /onItemsChange/);
  assert.match(timeline, /onItemCreate/);
  assert.match(timeline, /onItemDelete/);
  assert.match(timeline, /onDoubleClick=\{createItem\}/);
  assert.match(timeline, /event\.key === 'Delete'/);
  assert.match(timeline, /aria-pressed=\{activeScale === scaleOption\}/);
  assert.match(timeline, /时间尺度/);
  assert.match(timeline, /aria-keyshortcuts/);
  assert.match(styles, /\.de-timeline__bar/);
  assert.match(styles, /\.de-timeline__snap-guide/);
  assert.match(styles, /--de-timeline-column-gutter:\s*10px/);
  assert.match(styles, /padding:\s*0 0 0 var\(--de-timeline-column-gutter\)/);
  assert.doesNotMatch(styles, /\.de-timeline__bar-delete/);
  assert.match(styles, /--de-timeline-grid/);
  assert.match(styles, /touch-action:\s*none/);
});

test('routes the Docusaurus Mermaid theme into the single Board renderer', async () => {
  const docusaurusMermaid = await readFile(
    new URL('../src/docusaurus-theme/Mermaid/index.tsx', import.meta.url),
    'utf8',
  );
  assert.match(docusaurusMermaid, /<Board/);
  assert.match(docusaurusMermaid, /aria-label="可编辑画板"/);
  assert.match(docusaurusMermaid, /format: 'mermaid'/);
  assert.match(docusaurusMermaid, /source: value/);
  assert.doesNotMatch(docusaurusMermaid, /mermaidSource/);
  assert.doesNotMatch(docusaurusMermaid, /Mermaid 图表/);
  assert.doesNotMatch(docusaurusMermaid, /mermaid\.render/);
  assert.doesNotMatch(styles, /docusaurus-mermaid-container/);
});

test('exports an editable status property with host-owned persistence', async () => {
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
