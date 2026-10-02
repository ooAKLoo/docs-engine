import assert from 'node:assert/strict';
import test from 'node:test';
import {importMermaid} from '../dist/components/MermaidImporter.js';
import {applyBoardLayout, validateBoardLayout} from '../dist/components/BoardLayout.js';
import {computeElkBoardLayout} from '../dist/components/BoardElkLayout.js';
import {refineBoardRoutes} from '../dist/components/BoardRouteRefine.js';

/**
 * Regression fixtures modelled on a production service topology document that
 * previously rendered with declaration-order group ranks, shared lanes and
 * detached fan-in trunks. Imports must now ship complete authored geometry
 * that passes the same validation an agent-authored board is held to.
 */

const productPathSource = `flowchart LR
    subgraph Clients["产品客户端"]
        device[硬件设备]
        app[家长客户端]
    end

    dns[example.com DNS]

    subgraph AppEcs["云主机 · region-a · 203.0.113.10"]
        nginx[Nginx<br/>TLS 与入口路由]
        server[Product Server<br/>127.0.0.1:9000]
        turn[Turn Detector<br/>127.0.0.1:9100]
    end

    subgraph ManagedState["同 VPC 托管状态"]
        postgres[PostgreSQL 16 HA<br/>app_product]
    end

    subgraph ExternalServices["外部实时能力"]
        asr[云端 ASR]
        llm[托管 / 兼容 LLM]
        tts[云端 TTS]
        firmware[固件发布服务<br/>203.0.113.20:9010]
    end

    device -->|OTA 与实时语音| dns
    app -->|HTTPS API| dns
    dns -->|A 记录| nginx
    nginx <-->|HTTP 与 WebSocket| server
    nginx -->|固件升级代理| firmware
    server -->|本地 HTTP predict| turn
    server -->|私网 TLS| postgres
    server -->|流式识别| asr
    server -->|流式生成| llm
    server -->|双向合成| tts`;

const managementPlaneSource = `flowchart LR
    staff[内部员工]
    sso[企业 IM SSO]
    access[Zero Trust Access]

    subgraph AppEcs["同一台云主机 · 管理面"]
        nginx[Nginx<br/>内部域名入口]
        portal[Internal Portal<br/>127.0.0.1:9004]
        docs[Docs Origin<br/>127.0.0.1:9003 / 9005]
        worker[Conversation Lab Worker<br/>无监听端口]
        tunnel[隧道客户端]
        legacyOps[兼容 Ops<br/>127.0.0.1:9002]
        server[Product Server<br/>127.0.0.1:9000]
    end

    internalDb[PostgreSQL<br/>app_internal]
    tos[私有 TOS]

    staff -->|internal.example.com| nginx
    nginx -->|登录校验与业务请求| portal
    portal -->|OAuth| sso
    nginx -->|受保护文档| docs
    portal -->|诊断与指标代理| server
    worker -->|领取与回报任务| portal
    portal -->|私网 TLS| internalDb
    worker -->|媒体上传| tos

    staff -->|旧 Ops 入口| access
    access -->|Tunnel| tunnel
    tunnel --> legacyOps
    legacyOps -->|受控诊断接口| server`;

async function importAndValidate(source) {
  const document = await importMermaid(source);
  const errors = validateBoardLayout(document, {requireEdgeRoutes: true})
    .filter(({severity}) => severity === 'error');
  return {document, errors};
}

for (const [name, source] of [
  ['产品热路径', productPathSource],
  ['内部管理面', managementPlaneSource],
]) {
  test(`imports the ${name} service topology with authored ELK geometry`, async () => {
    const {document, errors} = await importAndValidate(source);

    assert.ok(document.canvas, '导入结果必须携带 authored 画布尺寸');
    document.nodes.forEach((node) => {
      assert.ok(node.position, `节点 ${node.id} 必须携带 authored 位置`);
      assert.ok(node.width && node.height, `节点 ${node.id} 必须携带 authored 尺寸`);
    });
    document.edges.forEach((edge) => {
      if (edge.stroke === 'invisible') return;
      assert.ok((edge.points?.length ?? 0) >= 2, `连线 ${edge.id} 必须携带 authored 正交路线`);
      if (edge.label) {
        assert.ok(edge.labelPosition, `连线 ${edge.id} 的标签必须携带 authored 位置`);
      }
    });

    assert.deepEqual(
      errors.map(({code, message}) => `${code}: ${message}`),
      [],
      '自动布局结果必须通过 agent-authored 同级校验（无交叉、无共线、无穿卡）',
    );
  });
}

test('keeps ranks independent from container declaration order', async () => {
  // dns 在所有 subgraph 之后声明，却位于 Clients 与 AppEcs 之间的主链上。
  // 旧布局按声明序排 rank，会把 dns 甩到画布末端并产生跨图回头线。
  const {document} = await importAndValidate(productPathSource);
  const positionOf = (id) => document.nodes.find((node) => node.id === id).position;
  const device = positionOf('device');
  const dns = positionOf('dns');
  const nginx = positionOf('nginx');
  assert.ok(device.x < dns.x, '客户端应位于 DNS 上游');
  assert.ok(dns.x < nginx.x, 'DNS 应位于 Nginx 上游');
});

test('keeps explicitly authored layout untouched by the automatic engine', async () => {
  const layout = {
    height: 200,
    width: 400,
    nodes: {
      a: {position: {x: 80, y: 100}, width: 118, height: 54},
      b: {position: {x: 320, y: 100}, width: 118, height: 54},
    },
  };
  const document = await importMermaid('flowchart LR\n  a[甲] --> b[乙]', {layout});
  assert.deepEqual(document.canvas, {height: 200, width: 400});
  assert.deepEqual(document.nodes.find((node) => node.id === 'a').position, {x: 80, y: 100});
});

const groupedSources = (direction = 'LR') => `flowchart ${direction}
  subgraph sources [Sources]
    a[Source alpha<br/>Input records]
    b[Source beta<br/>Input history]
  end
  subgraph sinks [Sinks]
    c[Sink alpha]
    d[Sink beta]
    e[Sink gamma]
  end
  a --> c
  a --> e
  b --> c
  b --> d
  b --> e`;

const feedbackSource = `flowchart LR
  subgraph DeviceIn[Source group]
    a[Source] --> b[Filter<br/>Stage one]
    b --> c[Encoder]
  end
  subgraph Transport[Relay group]
    d[Relay<br/>Channel]
  end
  subgraph Runtime[Worker group]
    e[Worker one] --> f[Worker two<br/>Stage two]
    f --> g[Worker three]
    g --> h[Worker four]
  end
  subgraph DeviceOut[Sink group]
    i[Sink buffer] --> j[Sink]
  end
  c --> d --> e
  h --> d --> i
  i -.Feedback.-> b`;

const segments = (points) => points.slice(1).map((point, index) => [points[index], point]);

function countCrossings(edges) {
  let count = 0;
  edges.forEach((edge, i) => edges.slice(i + 1).forEach((other) => {
    for (const a of segments(edge.points)) {
      for (const b of segments(other.points)) {
        const ah = a[0].y === a[1].y;
        const bh = b[0].y === b[1].y;
        if (ah === bh) continue;
        const [h, v] = ah ? [a, b] : [b, a];
        if (v[0].x > Math.min(h[0].x, h[1].x) && v[0].x < Math.max(h[0].x, h[1].x)
          && h[0].y > Math.min(v[0].y, v[1].y) && h[0].y < Math.max(v[0].y, v[1].y)) count++;
      }
    }
  }));
  return count;
}

function assertTerminal(document, edge, source) {
  const id = source ? edge.sourceId : edge.targetId;
  const node = document.nodes.find((entry) => entry.id === id);
  const point = source ? edge.points[0] : edge.points.at(-1);
  const side = source ? edge.sourceSide : edge.targetSide;
  const dx = Math.abs(point.x - node.position.x);
  const dy = Math.abs(point.y - node.position.y);
  assert.ok(dx <= node.width / 2 + 0.01 && dy <= node.height / 2 + 0.01, `${edge.id} endpoint must touch ${id}`);
  if (side === 'left' || side === 'right') {
    assert.ok(Math.abs(point.x - node.position.x - (side === 'left' ? -1 : 1) * node.width / 2) < 0.01);
  } else {
    assert.ok(Math.abs(point.y - node.position.y - (side === 'top' ? -1 : 1) * node.height / 2) < 0.01);
  }
}

for (const direction of ['LR', 'RL', 'TB', 'BT']) {
  test(`refines grouped bipartite routes in ${direction} without reversing or sharing lanes`, async () => {
    const {document, errors} = await importAndValidate(groupedSources(direction));
    const rawLayout = await computeElkBoardLayout(document, {refineRoutes: false});
    const rawDocument = applyBoardLayout(document, rawLayout);
    const rawErrors = validateBoardLayout(rawDocument).filter(({severity}) => severity === 'error');
    assert.deepEqual(document.nodes, rawDocument.nodes, 'refinement must preserve ELK node geometry');
    for (const edge of document.edges) {
      assert.ok(edge.points.length <= 4, `${edge.id} must have at most two bends`);
      assertTerminal(document, edge, true);
      assertTerminal(document, edge, false);
      const parts = segments(edge.points);
      parts.forEach(([a, b], index) => {
        assert.ok(a.x === b.x || a.y === b.y, 'every segment must be orthogonal');
        const following = parts[index + 2];
        if (!following) return;
        const [c, d] = following;
        assert.ok((b.x - a.x) * (d.x - c.x) >= 0 && (b.y - a.y) * (d.y - c.y) >= 0, 'route must not contain a U-turn');
      });
    }
    assert.ok(countCrossings(document.edges) <= 1);
    // The validator treats the existing bipartite crossing as an error. Keep
    // that diagnostic visible; refinement must not create any other errors.
    assert.ok(errors.every(({code}) => code === 'edge-crossing'));
    assert.ok(errors.length <= rawErrors.filter(({code}) => code === 'edge-crossing').length);
    const source = document.nodes.find(({id}) => id === 'a').position;
    const sink = document.nodes.find(({id}) => id === 'c').position;
    const axis = direction === 'LR' || direction === 'RL' ? 'x' : 'y';
    assert.ok((sink[axis] - source[axis]) * (direction === 'LR' || direction === 'TB' ? 1 : -1) > 0);
  });
}

test('uses feedback semantics for group ranks while retaining semantic arrow endpoints', async () => {
  const {document, errors} = await importAndValidate(feedbackSource);
  const groupCenter = (id) => {
    const group = document.groups.find((entry) => entry.id === id);
    const members = document.nodes.filter((node) => group.nodeIds.includes(node.id));
    return (Math.min(...members.map((node) => node.position.x - node.width / 2))
      + Math.max(...members.map((node) => node.position.x + node.width / 2))) / 2;
  };
  assert.ok(groupCenter('DeviceIn') < groupCenter('Transport'));
  assert.ok(groupCenter('Transport') < groupCenter('Runtime'));
  const feedback = document.edges.filter(({role}) => role === 'feedback');
  assert.deepEqual(feedback.map(({sourceId, targetId}) => [sourceId, targetId]), [['h', 'd'], ['i', 'b']]);
  for (const edge of feedback) {
    assert.equal(edge.arrow, true);
    assert.equal(edge.sourceArrow, false);
    assertTerminal(document, edge, true);
    assertTerminal(document, edge, false);
    assert.equal(edge.sourceSide, 'left');
    assert.equal(edge.targetSide, 'right');
  }
  assert.deepEqual(errors, []);
});

test('produces identical routes and labels across repeated imports', async () => {
  for (const source of [groupedSources(), groupedSources('TB'), feedbackSource]) {
    const first = await importMermaid(source);
    const second = await importMermaid(source);
    assert.deepEqual(first.edges, second.edges);
  }
});

test('keeps a grouped TB flow valid after refinement', async () => {
  const {document, errors} = await importAndValidate(`flowchart TB
    subgraph sources [Sources]
      a[Source alpha]
      b[Source beta]
    end
    subgraph sinks [Sinks]
      c[Sink alpha]
      d[Sink beta]
    end
    a --> c
    b --> c
    b --> d`);
  assert.deepEqual(errors, []);
  document.edges.forEach((edge) => {
    assert.ok(edge.points.length <= 4);
    assert.equal(edge.sourceSide, 'bottom');
    assert.equal(edge.targetSide, 'top');
    assert.ok(edge.points[0].y < edge.points.at(-1).y);
  });
});

function refinementFixture() {
  const document = {
    version: 1,
    diagramKind: 'flowchart',
    direction: 'LR',
    nodes: ['a', 'b'].map((id) => ({id, label: id, shape: 'rect', classes: [], tone: 'blue'})),
    edges: [{id: 'a-b', sourceId: 'a', targetId: 'b', label: '', arrow: true, stroke: 'normal'}],
  };
  const layout = {
    width: 500,
    height: 400,
    nodes: {
      a: {position: {x: 80, y: 100}, width: 80, height: 60},
      b: {position: {x: 400, y: 100}, width: 80, height: 60},
    },
    edges: [{
      id: 'a-b', sourceId: 'a', targetId: 'b', sourceSide: 'right', targetSide: 'left',
      points: [{x: 120, y: 100}, {x: 160, y: 100}, {x: 160, y: 180}, {x: 300, y: 180}, {x: 300, y: 100}, {x: 360, y: 100}],
    }],
  };
  return {document, layout};
}

function addBlocker(document, layout, id, position, width, height) {
  document.nodes.push({id, label: id, shape: 'rect', classes: [], tone: 'blue'});
  layout.nodes[id] = {position, width, height};
}

test('relocates a refined label to the longest main-axis segment without mutating input', () => {
  const {document, layout} = refinementFixture();
  document.edges[0].label = 'Link';
  layout.edges[0].labelPosition = {x: 230, y: 180};
  const original = structuredClone(layout);
  const refined = refineBoardRoutes(document, layout);
  assert.deepEqual(layout, original);
  assert.equal(refined.edges[0].points.length, 2);
  assert.deepEqual(refined.edges[0].labelPosition, {x: 240, y: 100});
  assert.deepEqual(validateBoardLayout(applyBoardLayout(document, refined)), []);
});

test('retains a detour when every shortcut would hit a non-terminal node', () => {
  const {document, layout} = refinementFixture();
  addBlocker(document, layout, 'blocker', {x: 240, y: 100}, 60, 70);
  const refined = refineBoardRoutes(document, layout);
  assert.deepEqual(refined.edges, layout.edges);
  assert.deepEqual(validateBoardLayout(applyBoardLayout(document, refined)), []);
});

test('retains a detour around an unrelated nested group even when its nodes are clear', () => {
  const {document, layout} = refinementFixture();
  // The unrelated member is below all possible shortcuts, but its group
  // header occupies the shortcut corridor. Nested chrome must also count.
  addBlocker(document, layout, 'member', {x: 240, y: 170}, 30, 20);
  document.groups = [
    {id: 'outer', label: 'Outer', nodeIds: []},
    {id: 'inner', label: 'Inner', nodeIds: ['member'], parentId: 'outer'},
  ];
  layout.edges[0].points = [
    {x: 120, y: 100}, {x: 140, y: 100}, {x: 140, y: 40},
    {x: 330, y: 40}, {x: 330, y: 100}, {x: 360, y: 100},
  ];
  assert.deepEqual(refineBoardRoutes(document, layout).edges, layout.edges);
});

test('keeps the original route when the relocated label would collide with another label', () => {
  const {document, layout} = refinementFixture();
  document.edges[0].label = 'Link';
  layout.edges[0].labelPosition = {x: 230, y: 180};
  addBlocker(document, layout, 'c', {x: 80, y: 250}, 80, 60);
  addBlocker(document, layout, 'd', {x: 80, y: 350}, 80, 60);
  document.edges.push({id: 'c-d', sourceId: 'c', targetId: 'd', label: 'Reserved\nLabel\nArea', arrow: true, stroke: 'normal'});
  layout.edges.push({id: 'c-d', sourceId: 'c', targetId: 'd', sourceSide: 'bottom', targetSide: 'top', points: [{x: 80, y: 280}, {x: 80, y: 320}], labelPosition: {x: 240, y: 100}});
  assert.deepEqual(refineBoardRoutes(document, layout).edges, layout.edges);
});

test('slides ports to keep separate lanes and at least ten pixels between shared-side ports', () => {
  const {document, layout} = refinementFixture();
  document.edges.push({...document.edges[0], id: 'parallel'});
  layout.edges.push({...layout.edges[0], id: 'parallel', points: [{x: 120, y: 100}, {x: 360, y: 100}]});
  const refined = refineBoardRoutes(document, layout);
  const first = refined.edges[0].points;
  const second = refined.edges[1].points;
  assert.equal(first.length, 2);
  assert.ok(Math.abs(first[0].y - second[0].y) >= 10);
  assert.ok(Math.abs(first.at(-1).y - second.at(-1).y) >= 10);
  assert.deepEqual(validateBoardLayout(applyBoardLayout(document, refined)), []);
});

test('normalizes duplicate and collinear points without changing straight geometry', () => {
  const {document, layout} = refinementFixture();
  layout.edges[0].points = [{x: 120, y: 100}, {x: 160, y: 100}, {x: 160, y: 100}, {x: 300, y: 100}, {x: 360, y: 100}];
  const refined = refineBoardRoutes(document, layout);
  assert.deepEqual(refined.edges[0].points, [{x: 120, y: 100}, {x: 360, y: 100}]);
});

for (const diagramKind of ['class', 'er']) {
  test(`preserves the existing ${diagramKind} layout branch`, async () => {
    const {document} = refinementFixture();
    document.diagramKind = diagramKind;
    document.edges[0].role = 'feedback';
    const layout = await computeElkBoardLayout(document);
    document.edges[0].role = 'flow';
    const raw = await computeElkBoardLayout(document, {refineRoutes: false});
    assert.deepEqual(layout, raw, 'flow-specific routing must not change other diagram kinds');
  });
}

const reorderedGroupedSources = (direction) => `flowchart ${direction}
  subgraph sources [Sources]
    a[Source alpha<br/>Input records]
    b[Source beta<br/>Input history]
  end
  subgraph sinks [Sinks]
    c[Sink alpha]
    e[Sink gamma]
    d[Sink beta]
  end
  a --> c
  a --> e
  b --> c
  b --> e
  b --> d`;

function segmentLength([a, b]) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function assertClearEndpoints(edges) {
  for (const edge of edges) {
    const parts = segments(edge.points);
    assert.ok(segmentLength(parts[0]) >= (edge.sourceArrow ? 24 : 16) - 0.01);
    if (edge.arrow) assert.ok(segmentLength(parts.at(-1)) >= 24 - 0.01);
  }
  for (let first = 0; first < edges.length; first++) {
    for (let second = first + 1; second < edges.length; second++) {
      const a = edges[first];
      const b = edges[second];
      for (const firstPart of segments(a.points)) {
        for (const secondPart of segments(b.points)) {
          const firstHorizontal = firstPart[0].y === firstPart[1].y;
          const secondHorizontal = secondPart[0].y === secondPart[1].y;
          if (firstHorizontal === secondHorizontal) continue;
          const [h, v] = firstHorizontal ? [firstPart, secondPart] : [secondPart, firstPart];
          const point = {x: v[0].x, y: h[0].y};
          if (point.x < Math.min(h[0].x, h[1].x) || point.x > Math.max(h[0].x, h[1].x)) continue;
          if (point.y < Math.min(v[0].y, v[1].y) || point.y > Math.max(v[0].y, v[1].y)) continue;
          for (const endpoint of [a.points[0], a.points.at(-1), b.points[0], b.points.at(-1)]) {
            assert.ok(segmentLength([point, endpoint]) >= 24 - 0.01,
              `${a.id} / ${b.id}: crossing must stay clear of both endpoints`);
          }
        }
      }
    }
  }
}

function totalBends(edges) {
  return edges.reduce((sum, edge) => {
    const orientations = segments(edge.points)
      .filter((part) => segmentLength(part) > 0.01)
      .map(([a, b]) => Math.abs(a.x - b.x) < 0.01 ? 'vertical' : 'horizontal');
    return sum + orientations.filter((axis, index) => index > 0 && axis !== orientations[index - 1]).length;
  }, 0);
}

for (const direction of ['LR', 'RL', 'TB', 'BT']) {
  test(`keeps arrow approaches clear in the reordered ${direction} bipartite graph`, async () => {
    const document = await importMermaid(reorderedGroupedSources(direction));
    const rawLayout = await computeElkBoardLayout(document, {refineRoutes: false});
    const raw = applyBoardLayout(document, rawLayout);
    assertClearEndpoints(document.edges);
    assert.ok(countCrossings(document.edges) <= 1);
    assert.ok(totalBends(document.edges) <= totalBends(raw.edges));
    assert.deepEqual(document.nodes, raw.nodes);
    const errors = validateBoardLayout(document).filter(({severity}) => severity === 'error');
    const rawErrors = validateBoardLayout(raw).filter(({severity}) => severity === 'error');
    assert.ok(errors.every(({code}) => code === 'edge-crossing'));
    assert.ok(errors.length <= rawErrors.length);
    const repeated = await importMermaid(reorderedGroupedSources(direction));
    assert.deepEqual(document.edges, repeated.edges);
  });
}

test('repairs a short arrow approach without requiring fewer bends', () => {
  const {document, layout} = refinementFixture();
  layout.nodes.b.position.y = 200;
  layout.edges[0].points = [
    {x: 120, y: 100}, {x: 350, y: 100}, {x: 350, y: 200}, {x: 360, y: 200},
  ];
  const refined = refineBoardRoutes(document, layout);
  assert.equal(totalBends(refined.edges), totalBends(layout.edges));
  assertClearEndpoints([{...document.edges[0], ...refined.edges[0]}]);
  assert.deepEqual(validateBoardLayout(applyBoardLayout(document, refined)), []);
});

test('reserves twenty-four pixels at both ends of a bidirectional edge', () => {
  const {document, layout} = refinementFixture();
  document.edges[0].sourceArrow = true;
  layout.nodes.b.position.y = 200;
  layout.edges[0].points = [
    {x: 120, y: 100}, {x: 140, y: 100}, {x: 140, y: 200}, {x: 360, y: 200},
  ];
  const refined = refineBoardRoutes(document, layout);
  assertClearEndpoints([{...document.edges[0], ...refined.edges[0]}]);
  assert.equal(totalBends(refined.edges), 2);
});

function addVerticalRoute(document, layout, x, startY, endY) {
  addBlocker(document, layout, 'c', {x, y: startY - 10}, 20, 20);
  addBlocker(document, layout, 'd', {x, y: endY + 10}, 20, 20);
  document.edges.push({
    id: 'c-d', sourceId: 'c', targetId: 'd', label: '', arrow: true, stroke: 'normal',
  });
  layout.edges.push({
    id: 'c-d', sourceId: 'c', targetId: 'd', sourceSide: 'bottom', targetSide: 'top',
    points: [{x, y: startY}, {x, y: endY}],
  });
}

test('keeps a shortcut away from both endpoints of an occupied route', () => {
  const {document, layout} = refinementFixture();
  addVerticalRoute(document, layout, 240, 90, 200);
  const refined = applyBoardLayout(document, refineBoardRoutes(document, layout));
  assert.equal(refined.edges[0].points.length, 2);
  assertClearEndpoints(refined.edges);
  assert.ok(refined.edges[0].points[0].y >= 114);
  assert.ok(refined.edges[0].points[0].y <= 176);
});

test('retains the ELK route when a repair would require changing its approach side', () => {
  const {document, layout} = refinementFixture();
  addVerticalRoute(document, layout, 130, 40, 260);
  const refined = applyBoardLayout(document, refineBoardRoutes(document, layout));
  assert.deepEqual(refined.edges[0].points, layout.edges[0].points);
  assert.equal(refined.edges[0].sourceSide, 'right');
  assert.equal(refined.edges[0].targetSide, 'left');
  refined.edges.forEach((edge) => {
    assertTerminal(refined, edge, true);
    assertTerminal(refined, edge, false);
  });
  assert.ok(countCrossings(refined.edges) <= countCrossings(layout.edges));
});

const gapEdgeOrders = [
  [['a', 'f'], ['a', 'c'], ['b', 'f'], ['b', 'c'], ['b', 's']],
  [['b', 's'], ['b', 'c'], ['b', 'f'], ['a', 'c'], ['a', 'f']],
  [['b', 'c'], ['a', 'f'], ['b', 's'], ['a', 'c'], ['b', 'f']],
];

function gapPermutationSource(direction, edgeOrder, nodeOrder) {
  const sinks = {
    f: 'f[Sink first]',
    c: 'c[Sink second]',
    s: 's[Sink third]',
  };
  return `flowchart ${direction}
    subgraph sources [Sources]
      a[Source alpha<br/>Input records]
      b[Source beta<br/>Input history]
    end
    subgraph sinks [Sinks]
      ${nodeOrder.map((id) => sinks[id]).join('\n      ')}
    end
    ${edgeOrder.map(([source, target]) => `${source} --> ${target}`).join('\n    ')}`;
}

function assertRouteBounds(document, rawLayout) {
  const rawById = new Map(rawLayout.edges.map((edge) => [edge.id, edge]));
  for (const edge of document.edges) {
    const raw = rawById.get(edge.id);
    assert.equal(edge.sourceSide, raw.sourceSide, `${edge.id}: preserve source side`);
    assert.equal(edge.targetSide, raw.targetSide, `${edge.id}: preserve target side`);
    const length = (points) => segments(points).reduce((sum, part) => sum + segmentLength(part), 0);
    assert.ok(length(edge.points) <= Math.max(length(raw.points) * 1.25, length(raw.points) + 48) + 0.01);
  }
}

for (const direction of ['LR', 'TB']) {
  test(`jointly allocates ${direction} gap channels independently of edge declaration order`, async () => {
    // Edge statement order must not change the geometry. Node declaration
    // order is the author's reading order and only breaks ranking ties, so
    // each node order is compared with itself; all six must stay clean.
    for (const nodeOrder of [['f', 'c', 's'], ['f', 's', 'c']]) {
      let expectedNodes;
      let expectedBends;
      for (const edgeOrder of gapEdgeOrders) {
        const source = gapPermutationSource(direction, edgeOrder, nodeOrder);
        const document = await importMermaid(source);
        const raw = await computeElkBoardLayout(document, {refineRoutes: false});
        assertRouteBounds(document, raw);
        assertClearEndpoints(document.edges);
        assert.ok(countCrossings(document.edges) <= 1);
        for (const edge of document.edges) {
          assert.ok(edge.points.length <= 4, `${edge.sourceId} -> ${edge.targetId}: at most two bends`);
          const parts = segments(edge.points);
          parts.slice(2).forEach(([c, d], index) => {
            const [a, b] = parts[index];
            assert.ok((b.x - a.x) * (d.x - c.x) >= 0 && (b.y - a.y) * (d.y - c.y) >= 0);
          });
        }
        const nodes = Object.fromEntries(document.nodes.map((node) => [node.id, node.position]));
        const bends = Object.fromEntries(document.edges.map((edge) => [
          `${edge.sourceId}:${edge.targetId}`, edge.points.length - 2,
        ]));
        if (expectedNodes) {
          assert.deepEqual(nodes, expectedNodes);
          assert.deepEqual(bends, expectedBends);
        } else {
          expectedNodes = nodes;
          expectedBends = bends;
        }
        const repeated = await importMermaid(source);
        assert.deepEqual(document.edges, repeated.edges);
      }
    }
  });
}

test('never changes ELK endpoint sides or exceeds the bounded route length', async () => {
  for (const source of [feedbackSource, groupedSources('RL'), groupedSources('BT'), reorderedGroupedSources('LR')]) {
    const document = await importMermaid(source);
    const raw = await computeElkBoardLayout(document, {refineRoutes: false});
    assertRouteBounds(document, raw);
  }
});

test('treats the measured group title as an obstacle even for its own edges', () => {
  const {document, layout} = refinementFixture();
  document.direction = 'TB';
  // The source's top title is on its incoming side, while the target title
  // blocks the tempting straight route. The original lane goes beside it.
  document.groups = [{id: 'target', label: 'Reserved title', nodeIds: ['b']}];
  layout.nodes.a = {position: {x: 370, y: 80}, width: 40, height: 40};
  layout.nodes.b = {position: {x: 400, y: 280}, width: 160, height: 60};
  layout.edges[0] = {
    ...layout.edges[0], sourceSide: 'bottom', targetSide: 'top',
    points: [
      {x: 370, y: 100}, {x: 370, y: 150},
      {x: 450, y: 150}, {x: 450, y: 250},
    ],
  };
  const refined = refineBoardRoutes(document, layout);
  // Canvas: group left=296, top=206; title baseline=(314,230). With
  // clearance, its text occupies x=306..413 and y=210..241. All possible
  // straight source ports lie inside that text region.
  assert.ok(refined.edges[0].points.length > 2);
  for (const [a, b] of segments(refined.edges[0].points)) {
    if (a.x !== b.x) continue;
    assert.ok(a.x < 306 || a.x > 413 || Math.max(a.y, b.y) < 210 || Math.min(a.y, b.y) > 241);
  }
  assertRouteBounds(applyBoardLayout(document, refined), layout);
});
