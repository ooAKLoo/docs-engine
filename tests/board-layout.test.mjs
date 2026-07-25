import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyBoardLayout,
  assertBoardLayout,
  importMermaid,
  validateBoardLayout,
} from '../dist/agent.js';

test('publishes a headless Agent workflow for semantic import and authored geometry', async () => {
  const layout = {
    width: 520,
    height: 220,
    nodes: {
      a: {position: {x: 80, y: 100}, width: 100, height: 60},
      b: {position: {x: 260, y: 100}, width: 100, height: 60},
      c: {position: {x: 440, y: 100}, width: 100, height: 60},
    },
    edges: [
      {
        id: 'flow:0:a:b',
        sourceId: 'a',
        sourceSide: 'right',
        targetId: 'b',
        targetSide: 'left',
        points: [{x: 130, y: 100}, {x: 210, y: 100}],
      },
      {
        id: 'flow:1:b:c',
        sourceId: 'b',
        sourceSide: 'right',
        targetId: 'c',
        targetSide: 'left',
        points: [{x: 310, y: 100}, {x: 390, y: 100}],
      },
    ],
  };
  const document = await importMermaid(
    'flowchart LR\n  a[输入] --> b[处理]\n  b --> c[输出]',
    {layout},
  );

  assert.deepEqual(document.canvas, {height: 220, width: 520});
  assert.equal(document.nodes.find(({id}) => id === 'b')?.position?.x, 260);
  assert.deepEqual(
    validateBoardLayout(document, {requireEdgeRoutes: true}),
    [],
  );
  assert.equal(assertBoardLayout(document, {requireEdgeRoutes: true}), document);
});

test('applyBoardLayout can refine a canonical document after semantic import', async () => {
  const semantic = await importMermaid('flowchart LR\n  source[来源] --> target[目标]');
  const document = applyBoardLayout(semantic, {
    width: 420,
    height: 180,
    nodes: {
      source: {position: {x: 90, y: 90}, width: 100, height: 60},
      target: {position: {x: 330, y: 90}, width: 100, height: 60},
    },
    edges: [
      {
        sourceId: 'source',
        targetId: 'target',
        points: [{x: 140, y: 90}, {x: 280, y: 90}],
        sourceSide: 'right',
        targetSide: 'left',
      },
    ],
  });

  assert.deepEqual(document.nodes[0].position, {x: 90, y: 90});
  assert.deepEqual(document.edges[0].points, [
    {x: 140, y: 90},
    {x: 280, y: 90},
  ]);
});

test('reports node overlap, edge-node collision and shared route segments', () => {
  const document = {
    canvas: {width: 480, height: 340},
    direction: 'LR',
    edges: [
      {
        arrow: true,
        id: 'first',
        label: '',
        points: [
          {x: 120, y: 80},
          {x: 200, y: 80},
          {x: 200, y: 240},
          {x: 280, y: 240},
        ],
        sourceId: 'a',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'd',
        targetSide: 'left',
      },
      {
        arrow: true,
        id: 'second',
        label: '',
        points: [
          {x: 120, y: 240},
          {x: 240, y: 240},
          {x: 240, y: 80},
          {x: 280, y: 80},
        ],
        sourceId: 'c',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'b',
        targetSide: 'left',
      },
    ],
    nodes: [
      node('a', 80, 80),
      node('b', 320, 80),
      node('c', 80, 240),
      node('d', 320, 240),
      node('blocker', 200, 160),
      node('overlap', 215, 160),
    ],
    version: 1,
  };

  const diagnostics = validateBoardLayout(document, {
    edgeNodeClearance: 4,
    minimumNodeGap: 16,
    requireEdgeRoutes: true,
  });
  const codes = new Set(diagnostics.map(({code}) => code));

  assert.ok(codes.has('node-overlap'));
  assert.ok(codes.has('edge-node-collision'));
  assert.ok(codes.has('edge-overlap'));
  assert.throws(
    () => assertBoardLayout(document, {requireEdgeRoutes: true}),
    /Board authored layout 校验失败/u,
  );
});

test('reports non-orthogonal routes and missing authored geometry', () => {
  const document = {
    direction: 'LR',
    edges: [
      {
        arrow: true,
        id: 'diagonal',
        label: '',
        points: [{x: 100, y: 80}, {x: 280, y: 140}],
        sourceId: 'a',
        stroke: 'normal',
        targetId: 'b',
      },
    ],
    nodes: [
      node('a', 60, 80),
      {classes: [], id: 'b', label: 'b', shape: 'rect', tone: 'neutral'},
    ],
    version: 1,
  };

  const codes = new Set(validateBoardLayout(document).map(({code}) => code));
  assert.ok(codes.has('node-geometry-missing'));
  assert.ok(codes.has('edge-non-orthogonal'));
});

function node(id, x, y) {
  return {
    classes: [],
    height: 50,
    id,
    label: id,
    position: {x, y},
    shape: 'rect',
    tone: 'neutral',
    width: 80,
  };
}
