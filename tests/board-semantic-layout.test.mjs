import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BoardCanvas} from '../dist/components/BoardCanvas.js';
import {importMermaid} from '../dist/components/MermaidImporter.js';

function renderDocument(document) {
  return renderToStaticMarkup(React.createElement(BoardCanvas, {
    accessibleLabel: '布局回归',
    document,
    editable: false,
    fitContent: true,
    panActive: false,
  }));
}

function edgePath(markup, id) {
  const edge = markup.match(
    new RegExp(`<g class="de-board__edge" data-de-edge-id="${id}"[\\s\\S]*?<\\/g>`),
  )?.[0] ?? '';
  return edge.match(/<path d="([^"]+)" class="de-board__edge-path"/u)?.[1] ?? '';
}

function edgeMarkup(markup, id) {
  return markup.match(
    new RegExp(`<g class="de-board__edge" data-de-edge-id="${id}"[\\s\\S]*?<\\/g>`),
  )?.[0] ?? '';
}

function linePoints(path) {
  return [...path.matchAll(
    /[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/gu,
  )].map((match) => ({x: Number(match[1]), y: Number(match[2])}));
}

function pathEndpoint(path) {
  const coordinates = (path.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
  return {
    x: coordinates.at(-2),
    y: coordinates.at(-1),
  };
}

function groupRectangles(markup) {
  return [...markup.matchAll(
    /<g class="de-board__group" data-de-group-id="([^"]+)"[^>]*><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/gu,
  )].map((match) => ({
    bottom: Number(match[3]) + Number(match[5]),
    id: match[1],
    left: Number(match[2]),
    right: Number(match[2]) + Number(match[4]),
    top: Number(match[3]),
  }));
}

test('lays out top-level architecture groups as non-overlapping semantic containers', async () => {
  const document = await importMermaid(`flowchart LR
    subgraph Access[接入与装配]
      bootstrap[组合根]
      gateway[设备网关]
      guardian[家长控制面]
    end
    subgraph Interaction[儿童交互]
      realtime[实时语音]
      experience[儿童体验]
      runtime[模型运行时]
    end
    subgraph Facts[稳定产品事实]
      data[(儿童数据)]
      library[(内容目录)]
      safety[儿童安全]
    end
    subgraph Support[观测与分析]
      analytics[(产品分析)]
      operations[运行观测]
    end
    gateway --> realtime
    realtime --> experience
    experience --> data
    experience --> library
    experience --> safety
    safety --> runtime
    guardian --> analytics
    realtime -. 技术事件 .-> operations`);
  const rectangles = groupRectangles(renderDocument(document));

  assert.deepEqual(rectangles.map(({id}) => id), ['Access', 'Interaction', 'Facts', 'Support']);
  rectangles.forEach((first, firstIndex) => {
    rectangles.slice(firstIndex + 1).forEach((second) => {
      const overlapsHorizontally = Math.min(first.right, second.right) > Math.max(first.left, second.left);
      const overlapsVertically = Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top);
      assert.equal(
        overlapsHorizontally && overlapsVertically,
        false,
        `${first.id} 与 ${second.id} 的容器不能重叠`,
      );
    });
  });
});

test('renders sequence participants on one header row and messages on distinct time rows', async () => {
  const document = await importMermaid(`sequenceDiagram
    autonumber
    participant App as 小程序
    participant WX as 微信
    participant API as Lula Server
    participant ESP as ESP32
    participant DB as Postgres Account Store
    App->>WX: wx.login 获取 code
    App->>API: POST /auth/wechat-login + code
    API->>DB: upsert user
    API-->>App: Lula App JWT
    App->>ESP: 写入设备凭证`);
  const markup = renderDocument(document);
  const actorPositions = [...markup.matchAll(
    /data-de-node-id="actor:[^"]+"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\)"/gu,
  )].map((match) => ({x: Number(match[1]), y: Number(match[2])}));
  const messageRows = [...markup.matchAll(
    /<path d="M [-\d.]+ ([-\d.]+)[^"]*" class="de-board__edge-path"/gu,
  )].map((match) => Number(match[1]));
  const lifelines = markup.match(/<g class="de-board__lifelines">([\s\S]*?)<\/g>/u)?.[1] ?? '';

  assert.equal(actorPositions.length, 5);
  assert.equal(new Set(actorPositions.map(({y}) => y)).size, 1);
  assert.deepEqual(actorPositions.map(({x}) => x), [...actorPositions.map(({x}) => x)].sort((a, b) => a - b));
  assert.equal((lifelines.match(/<line /gu) ?? []).length, 5);
  assert.equal(messageRows.length, 5);
  assert.equal(new Set(messageRows).size, 5);
  assert.deepEqual(messageRows, [...messageRows].sort((a, b) => a - b));
});

test('keeps cross-group flow off internal anchors and separates a bidirectional branch', async () => {
  const document = await importMermaid(`flowchart LR
    subgraph Source[资产事实源]
      validate{Schema 通过？}
      collections[(运行集合)]
      review[人工修正]
    end
    subgraph Product[产品语义]
      catalog[目录 Port]
      selection[体验选择]
    end
    validate --> collections
    validate -- 退回 --> review
    review --> validate
    collections --> catalog
    catalog --> selection`);
  const markup = renderDocument(document);
  const edgeMarkup = (id) => markup.match(
    new RegExp(`<g class="de-board__edge" data-de-edge-id="${id}"[\\s\\S]*?<\\/g>`),
  )?.[0] ?? '';
  const path = (id) => edgeMarkup(id).match(
    /<path d="([^"]+)" class="de-board__edge-path"/u,
  )?.[1] ?? '';
  const crossGroup = edgeMarkup('flow:3:collections:catalog');
  const validateX = Number(markup.match(
    /data-de-node-id="validate"[^>]*transform="translate\(([-\d.]+)/u,
  )?.[1]);
  const routeXCoordinates = (value) => [...value.matchAll(/[ML] ([-\d.]+) [-\d.]+/gu)]
    .map((match) => Number(match[1]));
  const leftLaneX = routeXCoordinates(path('flow:1:validate:review'));
  const rightLaneX = routeXCoordinates(path('flow:2:review:validate'));

  assert.match(crossGroup, /data-source-side="right"/u);
  assert.match(crossGroup, /data-target-side="left"/u);
  assert.ok(Math.min(...leftLaneX) < validateX);
  assert.ok(Math.max(...rightLaneX) > validateX);
});

test('distributes coincident same-side ports instead of overpainting one shared shaft', () => {
  const document = {
    version: 1,
    direction: 'LR',
    diagramKind: 'flowchart',
    nodes: [
      {
        classes: [],
        height: 80,
        id: 'first',
        label: '第一来源',
        position: {x: 80, y: 160},
        shape: 'rect',
        tone: 'neutral',
        width: 100,
      },
      {
        classes: [],
        height: 80,
        id: 'second',
        label: '第二来源',
        position: {x: 250, y: 160},
        shape: 'rect',
        tone: 'neutral',
        width: 100,
      },
      {
        classes: [],
        height: 80,
        id: 'target',
        label: '共同目标',
        position: {x: 500, y: 160},
        shape: 'rect',
        tone: 'neutral',
        width: 120,
      },
    ],
    edges: [
      {
        arrow: false,
        id: 'first-target',
        label: '',
        sourceId: 'first',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'target',
        targetSide: 'left',
      },
      {
        arrow: false,
        id: 'second-target',
        label: '',
        sourceId: 'second',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'target',
        targetSide: 'left',
      },
    ],
  };
  const markup = renderDocument(document);
  const firstEndpoint = pathEndpoint(edgePath(markup, 'first-target'));
  const secondEndpoint = pathEndpoint(edgePath(markup, 'second-target'));

  assert.equal(firstEndpoint.x, secondEndpoint.x);
  assert.equal(firstEndpoint.y, 155);
  assert.equal(secondEndpoint.y, 165);
});

test('snaps nearly aligned automatic endpoints onto one truly straight axis', () => {
  const document = {
    version: 1,
    direction: 'LR',
    diagramKind: 'flowchart',
    nodes: [
      {
        classes: [],
        height: 80,
        id: 'source',
        label: '来源',
        position: {x: 100, y: 100},
        shape: 'rect',
        tone: 'neutral',
        width: 120,
      },
      {
        classes: [],
        height: 80,
        id: 'target',
        label: '目标',
        position: {x: 320, y: 108},
        shape: 'rect',
        tone: 'neutral',
        width: 120,
      },
    ],
    edges: [
      {
        arrow: false,
        id: 'near-axis',
        label: '',
        sourceId: 'source',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'target',
        targetSide: 'left',
      },
    ],
  };
  const path = edgePath(renderDocument(document), 'near-axis');
  const direct = path.match(
    /^M (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) L (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)$/u,
  );

  assert.ok(direct, `近轴边应只有一条直线，实际为：${path}`);
  assert.equal(Number(direct[2]), 104);
  assert.equal(Number(direct[4]), 104);
});

test('keeps authored orthogonal routes unchanged by automatic near-axis snapping', () => {
  const document = {
    version: 1,
    direction: 'LR',
    diagramKind: 'flowchart',
    nodes: [
      {
        classes: [],
        height: 80,
        id: 'source',
        label: '来源',
        position: {x: 100, y: 100},
        shape: 'rect',
        tone: 'neutral',
        width: 120,
      },
      {
        classes: [],
        height: 80,
        id: 'target',
        label: '目标',
        position: {x: 320, y: 108},
        shape: 'rect',
        tone: 'neutral',
        width: 120,
      },
    ],
    edges: [
      {
        arrow: false,
        id: 'authored-route',
        label: '',
        points: [
          {x: 170, y: 100},
          {x: 200, y: 100},
          {x: 200, y: 140},
          {x: 230, y: 140},
          {x: 230, y: 108},
          {x: 246, y: 108},
        ],
        sourceId: 'source',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'target',
        targetSide: 'left',
      },
    ],
  };
  const path = edgePath(renderDocument(document), 'authored-route');

  assert.match(path, / 140(?: |$)/u);
  assert.equal(pathEndpoint(path).y, 108);
});

test('keeps authored centre pins fixed while separating automatic neighbours', () => {
  const document = {
    version: 1,
    direction: 'LR',
    diagramKind: 'flowchart',
    nodes: [
      {
        classes: [],
        height: 80,
        id: 'authored-source',
        label: '手工来源',
        position: {x: 80, y: 160},
        shape: 'rect',
        tone: 'neutral',
        width: 100,
      },
      {
        classes: [],
        height: 80,
        id: 'automatic-source',
        label: '自动来源',
        position: {x: 250, y: 160},
        shape: 'rect',
        tone: 'neutral',
        width: 100,
      },
      {
        classes: [],
        height: 80,
        id: 'target',
        label: '共同目标',
        position: {x: 500, y: 160},
        shape: 'rect',
        tone: 'neutral',
        width: 120,
      },
    ],
    edges: [
      {
        arrow: false,
        id: 'authored',
        label: '',
        points: [
          {x: 140, y: 160},
          {x: 180, y: 160},
          {x: 180, y: 190},
          {x: 426, y: 190},
          {x: 426, y: 160},
        ],
        sourceId: 'authored-source',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'target',
        targetSide: 'left',
      },
      {
        arrow: false,
        id: 'automatic',
        label: '',
        sourceId: 'automatic-source',
        sourceSide: 'right',
        stroke: 'normal',
        targetId: 'target',
        targetSide: 'left',
      },
    ],
  };
  const markup = renderDocument(document);

  assert.equal(pathEndpoint(edgePath(markup, 'authored')).y, 160);
  assert.equal(pathEndpoint(edgePath(markup, 'automatic')).y, 150);
});

test('bundles the Lula fan-in into one shared trunk and keeps blocked vertical flow outside nodes', async () => {
  const document = await importMermaid(`flowchart LR
    subgraph facts[儿童事实]
        memory[(长期记忆与画像)]
    end
    subgraph session[当前连接]
        conversation[(真实已播短期上下文)]
        activity[(当前活动与播放状态)]
    end
    subgraph experience[陪伴体验]
        selector[按当前话题选择上下文]
        context[Companion Context Pack]
        prompt[稳定人格与交流原则]
        agent[Companion Agent]
    end
    memory -->|相关事实| selector
    conversation -->|最近对话| selector
    activity -->|正在做什么| selector
    selector --> context
    context --> agent
    prompt --> agent
    agent --> plan[Generation Plan]`);
  const markup = renderDocument(document);
  const trunk = markup.match(
    /<g class="de-board__edge-trunk"[^>]*data-de-bundle-key="fan-in:selector:left"[^>]*data-edge-ids="([^"]+)"[^>]*>([\s\S]*?)<\/g>/u,
  );

  assert.ok(trunk, '三条 selector 输入应生成共享主干');
  assert.equal(
    trunk[1],
    'flow:0:memory:selector flow:1:conversation:selector flow:2:activity:selector',
  );
  assert.equal((markup.match(/class="de-board__edge-trunk"/gu) ?? []).length, 1);
  assert.equal((markup.match(/data-de-bundle-key="fan-in:selector:left"/gu) ?? []).length, 2);
  for (const id of [
    'flow:0:memory:selector',
    'flow:1:conversation:selector',
    'flow:2:activity:selector',
  ]) {
    assert.doesNotMatch(markup, new RegExp(`<polygon[^>]*data-edge-id="${id}"`, 'u'));
  }

  const branchEndpoints = [
    edgePath(markup, 'flow:0:memory:selector'),
    edgePath(markup, 'flow:1:conversation:selector'),
    edgePath(markup, 'flow:2:activity:selector'),
  ].map(pathEndpoint);
  assert.equal(new Set(branchEndpoints.map(({x}) => x)).size, 1);
  assert.equal(new Set(branchEndpoints.map(({y}) => y)).size, 3);

  const blocked = edgeMarkup(markup, 'flow:4:context:agent');
  const direct = edgePath(markup, 'flow:5:prompt:agent');
  assert.match(blocked, /data-source-side="left"/u);
  assert.match(blocked, /data-target-side="left"/u);
  assert.match(direct, /^M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+$/u);
});

test('routes structurally detected Lula feedback edges on distinct outer lanes', async () => {
  const document = await importMermaid(`flowchart LR
    dialogue[收集并脱敏优秀对话] --> principle[提炼交流原则]
    principle --> cases[建立多轮评测集]
    cases --> experiment[调整 Prompt、Context Policy 或模型参数]
    experiment --> batch[批量运行候选版本]
    batch --> review[人工抽检儿童视角与自然度]
    review --> release{达到发布门槛？}
    release -->|是| online[按 Prompt 版本上线]
    release -->|否| experiment
    online --> observe[观察连续性、打断与重复回答]
    observe -.形成新案例.-> cases`);
  const markup = renderDocument(document);
  const firstFeedback = edgeMarkup(markup, 'flow:7:release:experiment');
  const secondFeedback = edgeMarkup(markup, 'flow:9:observe:cases');

  for (const edge of [firstFeedback, secondFeedback]) {
    assert.match(edge, /data-feedback="true"/u);
    assert.match(edge, /data-source-side="bottom"/u);
    assert.match(edge, /data-target-side="bottom"/u);
  }

  const firstLane = Math.max(
    ...linePoints(edgePath(markup, 'flow:7:release:experiment')).map(({y}) => y),
  );
  const secondLane = Math.max(
    ...linePoints(edgePath(markup, 'flow:9:observe:cases')).map(({y}) => y),
  );
  assert.equal(secondLane - firstLane, 24);

  for (const id of [
    'flow:0:dialogue:principle',
    'flow:1:principle:cases',
    'flow:2:cases:experiment',
    'flow:3:experiment:batch',
    'flow:4:batch:review',
    'flow:5:review:release',
    'flow:6:release:online',
    'flow:8:online:observe',
  ]) {
    assert.match(
      edgePath(markup, id),
      /^M [-\d.]+ (-?\d+(?:\.\d+)?) L [-\d.]+ \1$/u,
      `${id} 应保持单条水平主流程`,
    );
  }
});
