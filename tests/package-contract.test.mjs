import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles/content.css', import.meta.url), 'utf8');
const docusaurusAdapter = await readFile(
  new URL('../src/adapters/docusaurus.ts', import.meta.url),
  'utf8',
);
const model = await readFile(new URL('../src/model.ts', import.meta.url), 'utf8');

test('publishes stable package entry points', () => {
  assert.ok(packageJson.exports['.']);
  assert.equal(packageJson.exports['./styles.css'], './styles/index.css');
  assert.ok(packageJson.exports['./adapters/docusaurus']);
  assert.equal(packageJson.peerDependencies.react, '>=18 <20');
  assert.equal(packageJson.peerDependencies['react-dom'], '>=18 <20');
  assert.equal(packageJson.dependencies.motion, '^12.23.24');
  assert.equal(packageJson.dependencies['lucide-react'], '^1.24.0');
  assert.equal(packageJson.dependencies.mermaid, '^11.16.0');
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

test('exports a no-wrap resource link with the shared Link2 icon', async () => {
  const resourceLink = await readFile(new URL('../src/components/ResourceLink.tsx', import.meta.url), 'utf8');
  assert.match(index, /ResourceLink/);
  assert.match(docusaurusAdapter, /ResourceLink/);
  assert.match(resourceLink, /Link2/);
  assert.match(styles, /\.de-resource-link/);
  assert.match(styles, /white-space:\s*nowrap/);
  assert.match(styles, /--de-resource-link-icon/);
});

test('uses the borderless shared Mermaid surface', () => {
  assert.match(styles, /\.de-mermaid/);
  assert.match(styles, /\.docusaurus-mermaid-container/);
  assert.match(docusaurusAdapter, /look:\s*'classic'/);
  assert.doesNotMatch(docusaurusAdapter, /look:\s*'neo'/);
});

test('provides a shared accessible full-screen diagram viewer', async () => {
  const diagramFrame = await readFile(
    new URL('../src/components/DiagramFrame.tsx', import.meta.url),
    'utf8',
  );
  const mermaidFlowchart = await readFile(
    new URL('../src/components/MermaidFlowchart.tsx', import.meta.url),
    'utf8',
  );
  assert.match(diagramFrame, /createPortal/);
  assert.match(diagramFrame, /aria-modal="true"/);
  assert.match(diagramFrame, /event\.key === 'Escape'/);
  assert.match(diagramFrame, /zoomable\?: boolean/);
  assert.match(diagramFrame, /editable\?: boolean/);
  assert.match(diagramFrame, /boardLayout\?: DiagramBoardLayout/);
  assert.match(diagramFrame, /onDiagramChange/);
  assert.match(diagramFrame, /onDiagramMediaChange/);
  assert.match(diagramFrame, /mediaTransform\?: Partial<DiagramMediaTransform>/);
  assert.match(diagramFrame, /onDiagramStructureChange/);
  assert.match(diagramFrame, /LazyMotion/);
  assert.match(diagramFrame, /addEventListener\('wheel', handleWheel, \{passive: false\}\)/);
  assert.match(diagramFrame, /addEventListener\('wheel', handleInlineWheel, \{passive: false\}\)/);
  assert.doesNotMatch(diagramFrame, /onWheel=\{handleWheel\}/);
  assert.match(diagramFrame, /event\.button === 2/);
  assert.match(diagramFrame, /type MarqueeSession/);
  assert.match(diagramFrame, /rectanglesIntersect/);
  assert.match(diagramFrame, /de-diagram-selection-marquee/);
  assert.match(diagramFrame, /selectedNodeIds/);
  assert.match(diagramFrame, /event\.key\.toLowerCase\(\) === 'h'/);
  assert.match(diagramFrame, /mermaidSource\?: string/);
  assert.match(diagramFrame, /openViewer\(canEdit \? 'edit' : 'view'\)/);
  assert.match(diagramFrame, /打开画板/);
  assert.match(mermaidFlowchart, /import\('mermaid'\)/);
  assert.match(mermaidFlowchart, /getDiagramFromText/);
  assert.match(mermaidFlowchart, /onPointerMove/);
  assert.match(mermaidFlowchart, /onDoubleClick/);
  assert.match(mermaidFlowchart, /routeEdge/);
  assert.match(mermaidFlowchart, /orthogonalPath/);
  assert.match(mermaidFlowchart, /sourceGap = 10/);
  assert.match(mermaidFlowchart, /targetGap = 14/);
  assert.match(mermaidFlowchart, /routeGraphEdges/);
  assert.match(mermaidFlowchart, /appendBoardElements/);
  assert.match(mermaidFlowchart, /findObstacleAvoidingRoute/);
  assert.match(mermaidFlowchart, /portGroups/);
  assert.match(mermaidFlowchart, /sourceOffset = 0/);
  assert.match(mermaidFlowchart, /targetOffset = 0/);
  assert.match(mermaidFlowchart, /arrowPoints/);
  assert.match(mermaidFlowchart, / A \$\{format\(radius\)\}/);
  assert.match(mermaidFlowchart, /snapNodePosition/);
  assert.match(mermaidFlowchart, /positionsStart/);
  assert.match(mermaidFlowchart, /selectedNodeIds/);
  assert.match(mermaidFlowchart, /translateEdgeRoutePatch/);
  assert.match(mermaidFlowchart, /beginConnection/);
  assert.match(mermaidFlowchart, /onConnectionDrop/);
  assert.match(mermaidFlowchart, /onEdgeRouteChange/);
  assert.match(mermaidFlowchart, /getRouteSegmentHandles/);
  assert.match(mermaidFlowchart, /moveRouteSegment/);
  assert.match(mermaidFlowchart, /resolveNodeBadge/);
  assert.match(mermaidFlowchart, /roundedDiamondPath/);
  assert.match(mermaidFlowchart, /isFeedbackEdge/);
  assert.match(mermaidFlowchart, /resolveInitialEdgePatches/);
  assert.match(mermaidFlowchart, /isDirectFacingRoute/);
  assert.match(mermaidFlowchart, /de-board-flowchart__port/);
  assert.doesNotMatch(mermaidFlowchart, /cubicPoint/);
  assert.doesNotMatch(mermaidFlowchart, /markerEnd/);
  assert.match(styles, /\.de-diagram-inline-toolbar/);
  assert.match(styles, /\.de-diagram-inline-stage/);
  assert.match(styles, /\.de-diagram-media-item/);
  assert.match(styles, /\.de-diagram-media-scale-handle/);
  assert.doesNotMatch(styles, /\.de-diagram-inline-canvas[^}]*\.de-board-flowchart[^}]*min-height/s);
  assert.match(styles, /\.de-diagram-viewer-overlay/);
  assert.match(styles, /\.de-diagram-board-brand/);
  assert.match(styles, /\.de-diagram-board-zoom/);
  assert.match(styles, /\.de-diagram-viewer-stage/);
  assert.match(styles, /\.de-diagram-node-editor/);
  assert.match(styles, /\.de-diagram-shape-picker/);
  assert.match(styles, /\.de-diagram-selection-marquee/);
  assert.match(styles, /\.de-board-flowchart__port-dot/);
  assert.match(styles, /\.de-board-flowchart__connection-preview/);
  assert.match(styles, /\.de-board-flowchart__guides/);
  assert.match(styles, /\.de-board-flowchart__edge-path/);
  assert.match(styles, /\.de-board-flowchart__edge-handle/);
  assert.match(styles, /\.de-board-flowchart__node-badge/);
  assert.match(styles, /\.de-board-flowchart__edge\[data-feedback='true'\]/);
  assert.match(styles, /\.de-board-flowchart__edge-label\[data-bare='true'\]/);
  assert.match(styles, /overflow:\s*visible !important/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(index, /DiagramStructureChange/);
  assert.match(index, /DiagramMediaChange/);
  assert.match(index, /DiagramMediaTransform/);
  assert.match(index, /DiagramEdgeRoutePatch/);
  assert.match(index, /DiagramBoardLayout/);
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
  assert.doesNotMatch(styles, /\.de-timeline__bar-delete/);
  assert.match(styles, /--de-timeline-grid/);
  assert.match(styles, /touch-action:\s*none/);
});

test('uses native SVG Mermaid labels with layout typography defined before measurement', () => {
  assert.match(docusaurusAdapter, /htmlLabels:\s*false/);
  assert.match(docusaurusAdapter, /fontWeight:\s*650/);
  assert.doesNotMatch(styles, /foreignObject/);
  assert.doesNotMatch(styles, /span\.nodeLabel/);
  assert.doesNotMatch(styles, /--de-mermaid-edge-label-offset-y/);
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
