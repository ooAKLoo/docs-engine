import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assignDiagramEdgeLanes,
  calculateAdaptiveRankGaps,
  compactDiagramEdgeLabelMetrics,
  measureDiagramEdgeLabel,
  placeDiagramEdgeLabels,
  wrapDiagramText,
} from '../dist/components/BoardAutoLayout.js';

test('expands adjacent ranks until the entire edge label fits', () => {
  const label = measureDiagramEdgeLabel('2. 识别文本与上下文');
  const gaps = calculateAdaptiveRankGaps(3, true, [
    {label: '1. 说话', sourceRank: 0, targetRank: 1},
    {label: '2. 识别文本与上下文', sourceRank: 1, targetRank: 2},
  ]);

  assert.ok(gaps[1] >= label.width + 30);
  assert.ok(gaps[1] > gaps[0]);
});

test('prefers the browser-measured label box over fallback character estimates', () => {
  const gaps = calculateAdaptiveRankGaps(2, true, [
    {
      label: '字体相关标签',
      metrics: {height: 32, lines: ['字体相关标签'], width: 196},
      sourceRank: 0,
      targetRank: 1,
    },
  ]);

  assert.equal(gaps[0], 226);
});

test('includes route stubs and carrier clearance in the adaptive rank gap', () => {
  const gaps = calculateAdaptiveRankGaps(2, true, [
    {
      label: '双向消息',
      metrics: {height: 32, lines: ['双向消息'], width: 196},
      routePadding: 108,
      sourceRank: 0,
      targetRank: 1,
    },
  ]);

  assert.equal(gaps[0], 304);
});

test('reserves every direct-route endpoint and arrow clearance in rank spacing', () => {
  const gaps = calculateAdaptiveRankGaps(2, true, [
    {
      label: '通过',
      metrics: {height: 26, lines: ['通过'], width: 42},
      routePadding: 47,
      sourceRank: 0,
      targetRank: 1,
    },
  ], 0);

  assert.equal(gaps[0], 89);
});

test('assigns different lanes to forward and reverse messages', () => {
  const lanes = assignDiagramEdgeLanes([
    {id: 'request', sourceId: 'Child', targetId: 'Lula'},
    {id: 'response', sourceId: 'Lula', targetId: 'Child'},
    {id: 'unrelated', sourceId: 'Lula', targetId: 'Agent'},
  ]);

  assert.equal(lanes.get('request'), -1);
  assert.equal(lanes.get('response'), 1);
  assert.equal(lanes.has('unrelated'), false);
});

test('keeps automatic labels disjoint on the same carrier when line space remains', () => {
  const edges = [
    {id: 'first', label: '第一条消息', points: [{x: 0, y: 80}, {x: 420, y: 80}]},
    {id: 'second', label: '第二条消息', points: [{x: 0, y: 80}, {x: 420, y: 80}]},
  ];
  const placements = placeDiagramEdgeLabels(
    edges,
    [],
  );
  const first = placements.get('first');
  const second = placements.get('second');
  const firstRect = labelRectangle(edges[0], first);
  const secondRect = labelRectangle(edges[1], second);

  assert.equal(first.mode, 'inline');
  assert.equal(second.mode, 'inline');
  assert.equal(first.position.y, 80);
  assert.equal(second.position.y, 80);
  assert.equal(rectanglesOverlap(firstRect, secondRect), false);
  assert.ok(firstRect.left >= 6 && firstRect.right <= 414);
  assert.ok(secondRect.left >= 6 && secondRect.right <= 414);
});

test('binds a label to a segment that can actually contain it', () => {
  const edge = {
    id: 'carrier',
    label: '2. 识别文本与上下文',
    points: [
      {x: 0, y: 0},
      {x: 18, y: 0},
      {x: 18, y: 24},
      {x: 218, y: 24},
      {x: 218, y: 0},
    ],
  };
  const placement = placeDiagramEdgeLabels([edge], []).get(edge.id);
  const rectangle = labelRectangle(edge, placement);

  assert.equal(placement.segmentIndex, 2);
  assert.equal(placement.orientation, 'horizontal');
  assert.ok(rectangle.left >= 34);
  assert.ok(rectangle.right <= 202);
});

test('wraps to the selected carrier width without losing label content', () => {
  const edge = {
    id: 'wrapped',
    label: 'Companion Agent 识别文本与上下文',
    points: [{x: 0, y: 0}, {x: 108, y: 0}],
  };
  const placement = placeDiagramEdgeLabels([edge], []).get(edge.id);
  const metrics = measureDiagramEdgeLabel(edge.label, false, placement.maximumTextWidth);
  const rectangle = labelRectangle(edge, placement);

  assert.ok(placement.maximumTextWidth < 220);
  assert.ok(metrics.lines.length > 1);
  assert.equal(metrics.lines.join('').replaceAll(' ', ''), 'CompanionAgent识别文本与上下文');
  assert.ok(rectangle.left >= 6);
  assert.ok(rectangle.right <= 102);
});

test('reserves the arrowhead base from the terminal label carrier', () => {
  const edge = {
    arrow: true,
    id: 'arrow-carrier',
    label: '回复文本',
    points: [{x: 0, y: 0}, {x: 120, y: 0}],
  };
  const placement = placeDiagramEdgeLabels([edge], []).get(edge.id);
  const rectangle = labelRectangle(edge, placement);

  assert.ok(rectangle.left >= 6);
  assert.ok(rectangle.right <= 103);
});

test('uses compact floating labels on authored carriers that cannot expose their arrows', () => {
  const edges = [
    {
      arrow: true,
      id: 'retention-to-early',
      label: '通过',
      points: [{x: 623.5316, y: 168.02}, {x: 643.3778, y: 168.02}],
    },
    {
      arrow: true,
      id: 'payment-to-kol',
      label: '通过',
      points: [{x: 1080.0524, y: 168.02}, {x: 1102.3042, y: 168.02}],
    },
  ];
  const nodes = [
    {height: 135.8, position: {x: 519.47, y: 168.02}, width: 197.88},
    {height: 87.3, position: {x: 747.42, y: 168.02}, width: 194},
    {height: 135.8, position: {x: 975.37, y: 168.02}, width: 197.88},
    {height: 81.48, position: {x: 1174.22, y: 168.02}, width: 128.04},
  ];
  const placements = placeDiagramEdgeLabels(edges, nodes);

  edges.forEach((edge, index) => {
    const placement = placements.get(edge.id);
    const rectangle = labelRectangle(edge, placement);
    const sourceRectangle = nodeRectangle(nodes[index * 2]);
    const targetRectangle = nodeRectangle(nodes[index * 2 + 1]);
    const arrowRectangle = terminalArrowRectangle(edge.points);
    assert.equal(placement.mode, 'floating');
    assert.ok(Math.abs(placement.position.y - 168.02) >= 18);
    assert.ok(Math.abs(placement.position.y - 168.02) <= 24);
    assert.equal(rectanglesOverlap(rectangle, sourceRectangle), false);
    assert.equal(rectanglesOverlap(rectangle, targetRectangle), false);
    assert.equal(rectanglesOverlap(rectangle, arrowRectangle), false);
  });
});

test('treats every arrowhead as a hard label obstacle', () => {
  const arrow = {
    arrow: true,
    id: 'vertical-arrow',
    label: '',
    points: [{x: 90, y: -40}, {x: 90, y: 0}],
  };
  const labelledEdge = {
    id: 'crossing-label',
    label: '识别文本',
    points: [{x: 40, y: -5}, {x: 140, y: -5}],
  };
  const placement = placeDiagramEdgeLabels([arrow, labelledEdge], []).get(labelledEdge.id);
  const rectangle = labelRectangle(labelledEdge, placement);

  assert.equal(placement.mode, 'floating');
  assert.equal(rectanglesOverlap(rectangle, terminalArrowRectangle(arrow.points)), false);
});

test('contains start- and end-aligned label backgrounds including their padding', () => {
  for (const align of ['start', 'end']) {
    const edge = {
      align,
      id: align,
      label: '边标签',
      points: [{x: 0, y: 0}, {x: 160, y: 0}],
    };
    const placement = placeDiagramEdgeLabels([edge], []).get(edge.id);
    const rectangle = labelRectangle(edge, placement);
    assert.ok(rectangle.left >= 6, `${align} label must keep its left padding on the carrier`);
    assert.ok(rectangle.right <= 154, `${align} label must keep its right padding on the carrier`);
  }
});

test('never moves an explicitly positioned label even when it overlaps a node', () => {
  const lockedPosition = {x: 24, y: 36};
  const placements = placeDiagramEdgeLabels(
    [{id: 'locked', label: '人工位置', lockedPosition, points: [{x: 0, y: 0}, {x: 100, y: 0}]}],
    [{height: 80, position: lockedPosition, width: 160}],
  );

  assert.equal(placements.get('locked').mode, 'locked');
  assert.deepEqual(placements.get('locked').position, lockedPosition);
});

test('wraps mixed text without dropping content', () => {
  const lines = wrapDiagramText('Companion Agent 识别文本与上下文', 92);
  assert.ok(lines.length > 1);
  assert.equal(lines.join('').replaceAll(' ', ''), 'CompanionAgent识别文本与上下文');
});

test('breaks a single long machine token instead of overflowing its node', () => {
  const lines = wrapDiagramText('CompanionAgentWithoutSpaces', 60);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), 'CompanionAgentWithoutSpaces');
});

function labelRectangle(edge, placement) {
  const naturalMetrics = measureDiagramEdgeLabel(edge.label, edge.bare, placement.maximumTextWidth);
  const metrics = placement.mode === 'floating'
    ? compactDiagramEdgeLabelMetrics(naturalMetrics, edge.bare)
    : naturalMetrics;
  const paddingX = placement.mode === 'floating' ? 2 : edge.bare ? 7 : 9;
  const left =
    edge.align === 'start'
      ? placement.position.x - paddingX
      : edge.align === 'end'
        ? placement.position.x - metrics.width + paddingX
        : placement.position.x - metrics.width / 2;
  return {
    bottom: placement.position.y + metrics.height / 2,
    left,
    right: left + metrics.width,
    top: placement.position.y - metrics.height / 2,
  };
}

function nodeRectangle(node) {
  return {
    bottom: node.position.y + node.height / 2,
    left: node.position.x - node.width / 2,
    right: node.position.x + node.width / 2,
    top: node.position.y - node.height / 2,
  };
}

function terminalArrowRectangle(points) {
  const tip = points.at(-1);
  const start = points.at(-2);
  const segmentLength = Math.hypot(tip.x - start.x, tip.y - start.y);
  const direction = {
    x: (tip.x - start.x) / segmentLength,
    y: (tip.y - start.y) / segmentLength,
  };
  const arrowLength = Math.min(11, Math.max(6, segmentLength * 0.58));
  const halfWidth = arrowLength * 0.52;
  const base = {
    x: tip.x - direction.x * arrowLength,
    y: tip.y - direction.y * arrowLength,
  };
  const arrowPoints = [
    tip,
    {x: base.x - direction.y * halfWidth, y: base.y + direction.x * halfWidth},
    {x: base.x + direction.y * halfWidth, y: base.y - direction.x * halfWidth},
  ];
  return {
    bottom: Math.max(...arrowPoints.map((point) => point.y)) + 2,
    left: Math.min(...arrowPoints.map((point) => point.x)) - 2,
    right: Math.max(...arrowPoints.map((point) => point.x)) + 2,
    top: Math.min(...arrowPoints.map((point) => point.y)) - 2,
  };
}

function rectanglesOverlap(first, second) {
  return (
    Math.min(first.right, second.right) > Math.max(first.left, second.left) &&
    Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top)
  );
}
