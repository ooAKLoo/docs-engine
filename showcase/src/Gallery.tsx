import {useEffect, useId, useState, type CSSProperties} from 'react';
import mermaid from 'mermaid';
import {
  Annotation,
  Callout,
  DiagramFrame,
  DocumentContent,
  Priority,
  RiskGrid,
  RiskItem,
  Status,
  SummaryPanel,
  Table,
  Transition,
  TransitionArrow,
  TransitionCard,
  TransitionCopy,
  TransitionLabel,
  TransitionTitle,
} from '../../src/index.js';
import {mermaidThemeConfig} from '../../src/adapters/docusaurus.js';

const mermaidSource = `flowchart LR
    start([开始验证]) --> collect[采集真实数据]
    collect --> decision{达到门槛？}
    decision -- 是 --> store[(沉淀结论)]
    store --> done([进入下一阶段])
    decision -- 否 --> improve[优化产品]
    improve --> collect`;

export function Gallery() {
  return (
    <DocumentContent className="showcase-page">
      <header className="showcase-header">
        <p className="showcase-eyebrow">@ooakloo/docs-engine</p>
        <h1>文档引擎样式总览</h1>
        <p>
          本页直接调用共享仓库的 React 组件和 CSS，是 Lula 与 oVita 的视觉基准，不加载任何宿主项目样式。
        </p>
      </header>

      <nav className="showcase-nav" aria-label="样式目录">
        <a href="#summary">摘要与判断</a>
        <a href="#callout">Callout</a>
        <a href="#badge">状态与优先级</a>
        <a href="#table">Table</a>
        <a href="#transition">转换关系</a>
        <a href="#check-grid">检查网格</a>
        <a href="#diagram">图表</a>
      </nav>

      <main>
        <section className="showcase-section" id="summary">
          <h2>一、摘要与关键判断</h2>
          <SummaryPanel>
            <h2>整体结论</h2>
            <p>SummaryPanel 用于文档级摘要；标题、正文和背景都由共享引擎维护。</p>
          </SummaryPanel>
          <Annotation>本期判断：Annotation 是加粗正文，不是标题，不生成目录锚点。</Annotation>
          <Annotation>
            多行 Annotation 用于验证圆头竖线会随内容高度自然伸展，同时保持 3px 宽度和中性灰色。
          </Annotation>
        </section>

        <section className="showcase-section" id="callout">
          <h2>二、Callout</h2>
          <Callout variant="brand">品牌型 Callout 用于需要适度强调的补充信息。</Callout>
          <Callout variant="info">信息型 Callout 用于背景、口径或阅读提示。</Callout>
          <Callout variant="note">备注型 Callout 用于次要说明。</Callout>
        </section>

        <section className="showcase-section" id="badge">
          <h2>三、状态与优先级</h2>
          <p>状态与优先级是 Table 中的独立属性，统一采用低饱和、无边框语义标签。</p>
          <Table>
            <thead>
              <tr>
                <th>属性</th>
                <th>值</th>
                <th>渲染示例</th>
                <th>含义</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>状态</td><td><code>done</code></td><td><Status tone="done">已完成</Status></td><td>达到验收结果</td></tr>
              <tr><td>状态</td><td><code>progress</code></td><td><Status tone="progress">进行中</Status></td><td>正在推进</td></tr>
              <tr><td>状态</td><td><code>todo</code></td><td><Status tone="todo">待处理</Status></td><td>等待开始</td></tr>
              <tr><td>状态</td><td><code>neutral</code></td><td><Status tone="neutral">未设置</Status></td><td>暂无明确语义</td></tr>
              <tr><td>优先级</td><td><code>p0</code></td><td><Priority level="p0">P0</Priority></td><td>当前必须完成</td></tr>
              <tr><td>优先级</td><td><code>p1</code></td><td><Priority level="p1">P1</Priority></td><td>下一顺位推进</td></tr>
              <tr><td>优先级</td><td><code>p2</code></td><td><Priority level="p2">P2</Priority></td><td>可延后处理</td></tr>
            </tbody>
          </Table>
        </section>

        <section className="showcase-section" id="table">
          <h2>四、Table</h2>
          <p>所有 Table 统一透明背景、无外框、无纵线、无阴影，只保留横向分隔线。</p>
          <Table>
            <thead>
              <tr><th>工作线</th><th>状态</th><th>当前结果</th><th>下一步</th></tr>
            </thead>
            <tbody>
              <tr><td>软件</td><td><Status tone="done">核心完成</Status></td><td>账户与主要功能已实现</td><td>接入正式服务器</td></tr>
              <tr><td>硬件</td><td><Status tone="progress">商务确认</Status></td><td>功能样机验证正常</td><td>锁定首批物料</td></tr>
              <tr><td>市场</td><td><Status tone="todo">待验证</Status></td><td>已建立种子用户名单</td><td>验证 7 日留存</td></tr>
            </tbody>
          </Table>
          <h3>宽表格与滚动</h3>
          <div style={{'--de-table-min-width': '1040px'} as CSSProperties}>
            <Table>
              <thead>
                <tr><th>编号</th><th>类型</th><th>状态</th><th>优先级</th><th>当前信号</th><th>验证方式</th><th>决策条件</th><th>归属</th></tr>
              </thead>
              <tbody>
                <tr><td>001</td><td>产品</td><td><Status tone="progress">验证中</Status></td><td><Priority level="p0">P0</Priority></td><td>愿意持续开口</td><td>家庭连续使用</td><td>7 日留存达标</td><td>产品组</td></tr>
                <tr><td>002</td><td>商业</td><td><Status tone="todo">待验证</Status></td><td><Priority level="p1">P1</Priority></td><td>表达付费意愿</td><td>预付款或押金</td><td>真实付费成立</td><td>市场组</td></tr>
              </tbody>
            </Table>
          </div>
        </section>

        <section className="showcase-section" id="transition">
          <h2>五、转换关系</h2>
          <Transition>
            <TransitionCard>
              <TransitionLabel>原方案 · 竞争拥挤</TransitionLabel>
              <TransitionTitle>通用 AI 玩具</TransitionTitle>
              <TransitionCopy>价值表达依赖硬件形态，容易进入同质化比价。</TransitionCopy>
            </TransitionCard>
            <TransitionArrow>➜</TransitionArrow>
            <TransitionCard target>
              <TransitionLabel>目标方案 · 价值明确</TransitionLabel>
              <TransitionTitle>AI 英语陪练机</TransitionTitle>
              <TransitionCopy>围绕自然英语习得形成可理解输入、主动开口和持续表达。</TransitionCopy>
            </TransitionCard>
          </Transition>
        </section>

        <section className="showcase-section" id="check-grid">
          <h2>六、检查项网格</h2>
          <RiskGrid>
            <RiskItem>内容必须是可判断的风险、约束或验收条件。</RiskItem>
            <RiskItem>使用中性灰背景，不增加边框和阴影。</RiskItem>
            <RiskItem>两列布局在窄屏下自动收敛为单列。</RiskItem>
            <RiskItem>普通工作进展不改写成检查卡片。</RiskItem>
          </RiskGrid>
        </section>

        <section className="showcase-section" id="diagram">
          <h2>七、图表</h2>
          <p>DiagramFrame 提供统一宽度与留白，Mermaid 使用共享主题配置。</p>
          <DiagramFrame>
            <MermaidExample />
          </DiagramFrame>
        </section>
      </main>
    </DocumentContent>
  );
}

function MermaidExample() {
  const reactId = useId();
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;
    const renderId = `docs-engine-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      ...mermaidThemeConfig.options,
    });

    void mermaid.render(renderId, mermaidSource).then((result) => {
      if (!cancelled) setSvg(result.svg);
    });

    return () => {
      cancelled = true;
    };
  }, [reactId]);

  return <div className="showcase-mermaid" aria-label="市场验证流程图" dangerouslySetInnerHTML={{__html: svg}} />;
}
