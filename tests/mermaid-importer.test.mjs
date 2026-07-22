import assert from 'node:assert/strict';
import test from 'node:test';

import {importMermaid} from '../dist/components/MermaidImporter.js';

test('keeps authored flowchart labels and shapes when later edges use bare ids', async () => {
  const graph = await importMermaid(`flowchart LR
    product([首批产品<br/>完成交付准备]) --> koc[7 名 KOC 测试<br/>真实家庭使用]
    koc --> retention{7 日留存达标？}
    retention -->|通过| early[约 70 名付费早鸟<br/>验证真实购买意愿]
    early --> payment{付费信号成立？}
    payment -->|通过| kol[KOL 推广<br/>场景化内容]
    kol --> production([大货生产<br/>铺设销售渠道])`);

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.equal(graph.diagramKind, 'flowchart');
  assert.equal(nodes.get('koc')?.label, '7 名 KOC 测试\n真实家庭使用');
  assert.equal(nodes.get('retention')?.label, '7 日留存达标？');
  assert.equal(nodes.get('retention')?.shape, 'diamond');
  assert.equal(nodes.get('early')?.label, '约 70 名付费早鸟\n验证真实购买意愿');
  assert.equal(nodes.get('payment')?.label, '付费信号成立？');
  assert.equal(nodes.get('kol')?.label, 'KOL 推广\n场景化内容');
});

test('parses labelled feedback edges and chained flowchart edges', async () => {
  const graph = await importMermaid(`flowchart LR
    mic[麦克风] --> afe[音频前端] --> preroll[预录缓冲]
    optimize[优化产品体验] -.优化后复测.-> afe`);

  assert.deepEqual(
    graph.edges.map(({label, sourceId, stroke, targetId}) => ({label, sourceId, stroke, targetId})),
    [
      {label: '', sourceId: 'mic', stroke: 'normal', targetId: 'afe'},
      {label: '', sourceId: 'afe', stroke: 'normal', targetId: 'preroll'},
      {label: '优化后复测', sourceId: 'optimize', stroke: 'dotted', targetId: 'afe'},
    ],
  );
});

test('keeps dashed sequence arrows out of actor ids', async () => {
  const graph = await importMermaid(`sequenceDiagram
    participant Child as 孩子
    participant Lula as Lula 设备
    participant Agent as Companion Agent
    Child->>Lula: 说话
    Lula->>Agent: 识别文本与上下文
    Agent-->>Lula: 回复文本
    Lula-->>Child: 播放语音`);

  assert.deepEqual(
    graph.nodes.map(({id, label}) => ({id, label})),
    [
      {id: 'actor:Child', label: '孩子'},
      {id: 'actor:Lula', label: 'Lula 设备'},
      {id: 'actor:Agent', label: 'Companion Agent'},
    ],
  );
  assert.deepEqual(
    graph.edges.map(({sourceId, stroke, targetId}) => ({sourceId, stroke, targetId})),
    [
      {sourceId: 'actor:Child', stroke: 'normal', targetId: 'actor:Lula'},
      {sourceId: 'actor:Lula', stroke: 'normal', targetId: 'actor:Agent'},
      {sourceId: 'actor:Agent', stroke: 'dotted', targetId: 'actor:Lula'},
      {sourceId: 'actor:Lula', stroke: 'dotted', targetId: 'actor:Child'},
    ],
  );
});

test('normalizes every supported Mermaid syntax into the same Board graph model', async () => {
  const fixtures = [
    {
      kind: 'sequence',
      source: `sequenceDiagram
        participant U as 用户
        participant S as 服务
        U->>S: 请求
        S-->>U: 响应`,
    },
    {
      kind: 'state',
      source: `stateDiagram-v2
        [*] --> Idle
        state "处理中" as Running
        Idle --> Running : 开始
        Running --> [*] : 完成`,
    },
    {
      kind: 'class',
      source: `classDiagram
        class User {
          +String name
        }
        class Order
        User "1" --> "*" Order : owns`,
    },
    {
      kind: 'er',
      source: `erDiagram
        CUSTOMER {
          string name
        }
        ORDER {
          string id
        }
        CUSTOMER ||--o{ ORDER : places`,
    },
    {
      kind: 'gantt',
      source: `gantt
        title 发布计划
        dateFormat YYYY-MM-DD
        section 开发
        设计 :done, design, 2026-07-01, 2d
        实现 :active, impl, after design, 3d`,
    },
    {
      kind: 'git',
      source: `%%{init: {'gitGraph': {'mainBranchName': 'master'}} }%%
        gitGraph
        commit id: "Feature A"
        branch release-v1
        commit id: "RC 1"
        checkout master
        commit id: "Fix A"
        checkout release-v1
        cherry-pick id: "Fix A"`,
    },
    {
      kind: 'timeline',
      source: `timeline
        title 发布节奏
        2026-07 : 首发
        2026-08 : 稳定版`,
    },
    {
      kind: 'mindmap',
      source: `mindmap
        root((Docs Engine))
          Parser
          Board
            Editor`,
    },
    {
      kind: 'pie',
      source: `pie showData
        title 使用占比
        "Lula" : 70
        "oVita" : 30`,
    },
  ];

  for (const fixture of fixtures) {
    const graph = await importMermaid(fixture.source);
    assert.equal(graph.version, 1);
    assert.equal(graph.diagramKind, fixture.kind);
    assert.ok(graph.nodes.length > 0, `${fixture.kind} should create Board nodes`);
    assert.ok(graph.edges.length > 0, `${fixture.kind} should create Board edges`);
    assert.ok(graph.nodes.every((node) => node.id && node.label && node.shape && node.tone));
    assert.ok(graph.edges.every((edge) => edge.id && edge.sourceId && edge.targetId && edge.stroke));
  }
});

test('rejects syntax that has not been mapped to Board instead of falling back to another renderer', async () => {
  await assert.rejects(
    () => importMermaid('journey\n  title unsupported'),
    /尚未接入画板导入器/u,
  );
});

test('applies authored geometry during import and returns only a canonical BoardDocument', async () => {
  const document = await importMermaid('flowchart LR\n  a[开始] --> b[完成]', {
    layout: {
      height: 240,
      nodes: {a: {position: {x: 80, y: 120}}},
      width: 480,
    },
  });

  assert.deepEqual(document.canvas, {height: 240, width: 480});
  assert.deepEqual(document.nodes.find((node) => node.id === 'a')?.position, {x: 80, y: 120});
  assert.equal('source' in document, false);
});
