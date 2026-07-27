import assert from 'node:assert/strict';
import test from 'node:test';
import {importMermaid} from '../dist/components/MermaidImporter.js';
import {validateBoardLayout} from '../dist/components/BoardLayout.js';

/**
 * Regression fixtures from the Lula production-service-topology document that
 * previously rendered with declaration-order group ranks, shared lanes and
 * detached fan-in trunks. Imports must now ship complete authored geometry
 * that passes the same validation an agent-authored board is held to.
 */

const productPathSource = `flowchart LR
    subgraph Clients["产品客户端"]
        device[哇布硬件]
        app[家长客户端]
    end

    dns[verboo.top DNS]

    subgraph AppEcs["火山 ECS · cn-beijing · 115.191.19.240"]
        nginx[Nginx<br/>TLS 与入口路由]
        server[Product Server<br/>127.0.0.1:8080]
        turn[Turn Detector<br/>127.0.0.1:8788]
    end

    subgraph ManagedState["同 VPC 托管状态"]
        postgres[PostgreSQL 16 HA<br/>lula_product]
    end

    subgraph ExternalServices["外部实时能力"]
        asr[火山 ASR]
        llm[方舟 / 兼容 LLM]
        tts[火山 TTS]
        firmware[固件发布服务<br/>14.103.183.47:8010]
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
    feishu[飞书企业 SSO]
    cloudflare[Cloudflare Access]

    subgraph AppEcs["同一台火山 ECS · 管理面"]
        nginx[Nginx<br/>内部域名入口]
        portal[Internal Portal<br/>127.0.0.1:8084]
        docs[Docs Origin<br/>127.0.0.1:8083 / 8085]
        worker[Conversation Lab Worker<br/>无监听端口]
        tunnel[cloudflared]
        legacyOps[兼容 Ops<br/>127.0.0.1:8082]
        server[Product Server<br/>127.0.0.1:8080]
    end

    internalDb[PostgreSQL<br/>lula_internal]
    tos[私有 TOS]

    staff -->|internal.verboo.top| nginx
    nginx -->|登录校验与业务请求| portal
    portal -->|OAuth| feishu
    nginx -->|受保护文档| docs
    portal -->|诊断与指标代理| server
    worker -->|领取与回报任务| portal
    portal -->|私网 TLS| internalDb
    worker -->|媒体上传| tos

    staff -->|旧 Ops 入口| cloudflare
    cloudflare -->|Tunnel| tunnel
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
  test(`imports the Lula ${name} topology with authored ELK geometry`, async () => {
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
