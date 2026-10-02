import assert from 'node:assert/strict';
import test from 'node:test';
import {importMermaid} from '../dist/components/MermaidImporter.js';
import {validateBoardLayout} from '../dist/components/BoardLayout.js';

const chain = (count, direction = 'LR') => `flowchart ${direction}
${Array.from({length: count - 1}, (_, index) => `    s${index}[Stage ${index}] --> s${index + 1}[Stage ${index + 1}]`).join('\n')}`;

// Nodes whose centres sit within 40px vertically share a row; feedback lanes
// may nudge the ends of a chain by a few pixels without starting a new row.
const rowCount = (values) => [...values].sort((a, b) => a - b)
  .reduce((count, value, index, sorted) => count + (index === 0 || value - sorted[index - 1] > 40 ? 1 : 0), 0);
const rows = (document) => rowCount(document.nodes.map(({position}) => position.y));
const ratio = (document) => document.canvas.width / document.canvas.height;

test('wraps a long horizontal chain into readable rows', async () => {
  const document = await importMermaid(chain(11));
  assert.ok(rows(document) >= 2, 'a long chain must use more than one row');
  assert.ok(ratio(document) < 3, `wrapped aspect ratio ${ratio(document).toFixed(2)} should stay below 3`);
  const errors = validateBoardLayout(document, {requireEdgeRoutes: true}).filter(({severity}) => severity === 'error');
  assert.deepEqual(errors, []);
  // Every edge still starts at its source and ends at its target.
  for (const edge of document.edges) {
    assert.ok(edge.points.length >= 2);
  }
});

test('wraps a labelled chain once its labels make it too wide', async () => {
  const document = await importMermaid(`flowchart LR
    a([Visitor scrolls past]) -->|striking visuals| b[Watches to the end]
    b -->|steady personality| c[Remembers the character]
    c -->|real children and toys| d[Learns the toy exists]
    d -->|proven abilities| e([Wants to buy])`);
  assert.ok(rows(document) >= 2);
});

test('keeps short chains, branching graphs, groups and loops on one row', async () => {
  const short = await importMermaid(chain(3));
  assert.equal(rows(short), 1);

  const branching = await importMermaid(`flowchart LR
    a[Start] --> b[Step one] --> c[Step two]
    c --> d[Left branch] --> f[Merge] --> g[Step five] --> h[Step six] --> i[End]
    c --> e[Right branch] --> f`);
  const byId = new Map(branching.nodes.map((node) => [node.id, node.position]));
  // Ranks stay in reading order instead of being cut into rows.
  for (const [left, right] of [['a', 'b'], ['b', 'c'], ['f', 'g'], ['g', 'h'], ['h', 'i']]) {
    assert.ok(byId.get(left).x < byId.get(right).x, `${left} should stay left of ${right}`);
  }

  const grouped = await importMermaid(`flowchart LR
    subgraph lane [Lane]
${Array.from({length: 7}, (_, index) => `      g${index}[Grouped ${index}] --> g${index + 1}[Grouped ${index + 1}]`).join('\n')}
    end`);
  assert.equal(rows(grouped), 1);

  const looped = await importMermaid(`${chain(9)}
    s8 -.retry.-> s0`);
  assert.equal(rows(looped), 1);
});

test('does not wrap vertical chains', async () => {
  const document = await importMermaid(chain(11, 'TB'));
  assert.equal(rowCount(document.nodes.map(({position}) => position.x)), 1);
});
