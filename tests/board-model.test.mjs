import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyBoardOperation,
  detectBoardFeedbackEdgeIds,
} from '../dist/components/BoardModel.js';

const document = {
  direction: 'LR',
  edges: [
    {
      arrow: true,
      id: 'edge-a-b',
      label: '通过',
      sourceId: 'a',
      stroke: 'normal',
      targetId: 'b',
    },
  ],
  nodes: [
    {classes: [], id: 'a', label: '开始', shape: 'round', tone: 'blue'},
    {classes: [], id: 'b', label: '完成', shape: 'round', tone: 'green'},
  ],
  version: 1,
};

test('updates node content and geometry without changing unrelated Board objects', () => {
  const labelled = applyBoardOperation(document, {
    label: '准备开始',
    nodeId: 'a',
    type: 'update-node-label',
  });
  const positioned = applyBoardOperation(labelled, {
    nodeId: 'a',
    position: {x: 120, y: 80},
    type: 'update-node-position',
  });

  assert.equal(positioned.nodes[0].label, '准备开始');
  assert.deepEqual(positioned.nodes[0].position, {x: 120, y: 80});
  assert.equal(positioned.nodes[1], document.nodes[1]);
  assert.equal(positioned.edges[0], document.edges[0]);
});

test('persists created objects and manual routes in the canonical document', () => {
  const created = applyBoardOperation(document, {
    edge: {
      arrow: true,
      id: 'edge-b-c',
      label: '',
      sourceId: 'b',
      sourceSide: 'right',
      stroke: 'normal',
      targetId: 'c',
      targetSide: 'left',
    },
    node: {
      classes: [],
      id: 'c',
      label: '下一步',
      position: {x: 420, y: 80},
      shape: 'round',
      tone: 'green',
    },
    type: 'create-node-and-edge',
  });
  const routed = applyBoardOperation(created, {
    edgeId: 'edge-b-c',
    labelPosition: {x: 330, y: 60},
    points: [{x: 260, y: 80}, {x: 420, y: 80}],
    type: 'update-edge-route',
  });

  assert.equal(routed.nodes.at(-1)?.id, 'c');
  assert.deepEqual(routed.edges.at(-1)?.points, [{x: 260, y: 80}, {x: 420, y: 80}]);
  assert.deepEqual(routed.edges.at(-1)?.labelPosition, {x: 330, y: 60});
});

test('detects cycle-closing edges while preserving explicit routing roles', () => {
  const detected = detectBoardFeedbackEdgeIds([
    {
      id: 'a-b',
      sourceId: 'a',
      stroke: 'normal',
      targetId: 'b',
    },
    {
      id: 'b-c',
      sourceId: 'b',
      stroke: 'normal',
      targetId: 'c',
    },
    {
      id: 'c-a',
      sourceId: 'c',
      stroke: 'normal',
      targetId: 'a',
    },
    {
      id: 'explicit-flow',
      role: 'flow',
      sourceId: 'c',
      stroke: 'normal',
      targetId: 'b',
    },
    {
      id: 'explicit-feedback',
      role: 'feedback',
      sourceId: 'x',
      stroke: 'normal',
      targetId: 'y',
    },
  ]);

  assert.deepEqual([...detected], ['c-a', 'explicit-feedback']);
});
