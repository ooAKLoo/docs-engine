import {useState, type CSSProperties} from 'react';
import {
  Annotation,
  Callout,
  DiagramFrame,
  DocumentContent,
  Priority,
  ResourceLink,
  RiskGrid,
  RiskItem,
  Status,
  StatusEditor,
  StatusFieldEditor,
  type DiagramBoardLayout,
  type StatusOption,
  SummaryPanel,
  Table,
  Timeline,
  type TimelineItem,
  Transition,
  TransitionArrow,
  TransitionCard,
  TransitionCopy,
  TransitionLabel,
  TransitionTitle,
} from '../../src/index.js';

const mermaidSource = `flowchart LR
    child([孩子说话]) -->|音频| asr[ASR<br/>语音转文字]
    asr -->|识别文本| agent[LLM / Agent<br/>理解与生成]
    agent -->|回复文本| tts[TTS<br/>文字转语音]
    tts -->|音频流| toy([玩具说话])
    class child,toy deTeal
    class asr deBlue
    class agent dePurple
    class tts deOrange`;

const mixedLabelMermaidSource = `flowchart LR
    phone[智能手机普及] --> gps[GPS 普及]
    gps --> payment[移动支付普及]
    payment --> city[城市出行效率低]
    city --> uber[Uber 必然出现]
    class phone,gps,payment deBlue
    class city deOrange
    class uber deGreen`;

const unifiedBoardMermaidSource = `flowchart LR
    product([首批产品<br/>完成交付准备]) --> koc[7 名 KOC 测试<br/>真实家庭使用]
    koc --> retention{7 日留存达标？}
    retention -->|通过| early[约 70 名付费早鸟<br/>验证真实购买意愿]
    retention -->|未达标| optimize[优化产品体验<br/>功能、内容或外观]
    early --> payment{付费信号成立？}
    payment -->|通过| kol[KOL 推广<br/>场景化内容]
    payment -->|未成立| adjust[调整商业方案<br/>定位、价格和场景]
    kol --> production([大货生产<br/>铺设销售渠道])
    optimize -.优化后复测.-> koc
    adjust -.调整后复测.-> early
    class product,koc deBlue
    class retention,payment dePurple
    class early deTeal
    class optimize,adjust deOrange
    class kol,production deGreen
    class product,koc,early,kol,production,optimize,adjust deBoardDetail
    class early,optimize,adjust deBoardWide
    class retention deBoardGateOne
    class payment deBoardGateTwo`;

// The old SVG was designed, not auto-laid-out. Keep Mermaid as the semantic source,
// then give the native Board the same authored starting geometry and return routes.
const unifiedBoardLayout = {
  width: 1280,
  height: 470,
  nodes: {
    product: {position: {x: 104.31, y: 168.02}, width: 145.5, height: 77.6},
    koc: {position: {x: 301.22, y: 168.02}, width: 174.6, height: 87.3},
    retention: {position: {x: 519.47, y: 168.02}, width: 197.88, height: 135.8},
    early: {position: {x: 747.42, y: 168.02}, width: 194, height: 87.3},
    payment: {position: {x: 975.37, y: 168.02}, width: 197.88, height: 135.8},
    kol: {position: {x: 1174.22, y: 168.02}, width: 128.04, height: 81.48},
    optimize: {position: {x: 519.47, y: 330.01}, width: 203.7, height: 79.54},
    adjust: {position: {x: 975.37, y: 330.01}, width: 203.7, height: 79.54},
    production: {position: {x: 1174.22, y: 331.95}, width: 135.8, height: 75.66},
  },
  edges: [
    {
      sourceId: 'retention',
      targetId: 'early',
      label: '通过',
    },
    {
      sourceId: 'retention',
      targetId: 'optimize',
      label: '未达标',
      sourceSide: 'bottom',
      targetSide: 'top',
    },
    {
      sourceId: 'payment',
      targetId: 'kol',
      label: '通过',
    },
    {
      sourceId: 'payment',
      targetId: 'adjust',
      label: '未成立',
      sourceSide: 'bottom',
      targetSide: 'top',
    },
    {
      sourceId: 'kol',
      targetId: 'production',
      sourceSide: 'bottom',
      targetSide: 'top',
    },
    {
      sourceId: 'optimize',
      targetId: 'koc',
      label: '优化后复测',
      bareLabel: true,
      labelAlign: 'start',
      labelPosition: {x: 383.67, y: 431.68},
      points: [
        {x: 519.47, y: 379.78},
        {x: 519.47, y: 418.28},
        {x: 301.22, y: 418.28},
        {x: 301.22, y: 225.67},
      ],
      sourceSide: 'bottom',
      targetSide: 'bottom',
    },
    {
      sourceId: 'adjust',
      targetId: 'early',
      label: '调整后复测',
      bareLabel: true,
      labelAlign: 'start',
      labelPosition: {x: 825.02, y: 431.68},
      points: [
        {x: 975.37, y: 379.78},
        {x: 975.37, y: 418.28},
        {x: 747.42, y: 418.28},
        {x: 747.42, y: 225.67},
      ],
      sourceSide: 'bottom',
      targetSide: 'bottom',
    },
  ],
} satisfies DiagramBoardLayout;

const initialTimelineItems: TimelineItem[] = [
  {
    id: 'research',
    title: 'Research and discovery',
    startDate: '2025-12-20',
    endDate: '2025-12-30',
    row: 0,
    notes: ['Hypothesis', 'User research', 'Competitive analysis', 'Interview questions', 'Survey questions'],
  },
  {
    id: 'define',
    title: 'Define',
    startDate: '2025-12-30',
    endDate: '2026-01-09',
    row: 1,
    notes: ['Interview', 'Survey', 'Persona card'],
  },
  {
    id: 'ideate',
    title: 'Ideate',
    startDate: '2026-01-09',
    endDate: '2026-01-20',
    row: 2,
    notes: ['Info architecture', 'User flow'],
  },
  {
    id: 'design',
    title: 'Design',
    startDate: '2026-01-20',
    endDate: '2026-02-12',
    row: 3,
    notes: ['Low wireframe', 'High wireframe', 'Prototype', 'Usability testing'],
  },
  {
    id: 'test',
    title: 'Test',
    startDate: '2026-01-31',
    endDate: '2026-02-12',
    row: 4,
    notes: ['UI', 'Case study'],
  },
];

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
        <a href="#typography">基础排版</a>
        <a href="#summary">摘要与判断</a>
        <a href="#callout">Callout</a>
        <a href="#badge">状态与优先级</a>
        <a href="#table">Table</a>
        <a href="#transition">转换关系</a>
        <a href="#check-grid">检查网格</a>
        <a href="#timeline">交互时间轴</a>
        <a href="#diagram">图表</a>
      </nav>

      <main>
        <section className="showcase-section" id="typography">
          <h2>一、基础排版</h2>
          <h3>正文、强调与链接</h3>
          <p>
            文档正文用于承载完整论述，支持<strong>加粗重点</strong>、<em>补充语气</em>、
            <code>inline code</code> 与 <a href="#table">页内链接</a>。
          </p>
          <h3>列表与引用</h3>
          <ul>
            <li>无序列表用于并列信息。</li>
            <li>每一项只表达一个清晰结论。</li>
          </ul>
          <ol>
            <li>有序列表用于步骤或优先顺序。</li>
            <li>复杂流程优先改用 Mermaid。</li>
          </ol>
          <blockquote>引用只用于来源原话或需要保留原始措辞的内容。</blockquote>
        </section>

        <section className="showcase-section" id="summary">
          <h2>二、摘要与关键判断</h2>
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
          <h2>三、Callout</h2>
          <Callout variant="brand">品牌型 Callout 用于需要适度强调的补充信息。</Callout>
          <Callout variant="info">信息型 Callout 用于背景、口径或阅读提示。</Callout>
          <Callout variant="note">备注型 Callout 用于次要说明。</Callout>
        </section>

        <section className="showcase-section" id="badge">
          <h2>四、状态与优先级</h2>
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
          <h3>可编辑状态属性</h3>
          <p>状态值在表头统一管理；列表单元格只从字段值中选择。字段只有两个值时，单击单元格即可来回切换。</p>
          <EditableStatusExample />
        </section>

        <section className="showcase-section" id="table">
          <h2>五、Table</h2>
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
          <h3>资源链接</h3>
          <p>资源链接统一使用浅灰色 Link2 图标，并保持图标和地址同行；窄屏由表格容器横向滚动。</p>
          <Table>
            <thead>
              <tr><th>入口</th><th>链接</th><th>用途</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>日志 / 记录入口</td>
                <td><ResourceLink href="http://115.190.136.178:8080/logs" /></td>
                <td>查看运行记录和交互记录</td>
              </tr>
              <tr>
                <td>产品体验 / 前端入口</td>
                <td><ResourceLink href="http://115.190.136.178:8081/" /></td>
                <td>体验当前产品页面</td>
              </tr>
            </tbody>
          </Table>
        </section>

        <section className="showcase-section" id="transition">
          <h2>六、转换关系</h2>
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
          <h2>七、检查项网格</h2>
          <RiskGrid>
            <RiskItem>内容必须是可判断的风险、约束或验收条件。</RiskItem>
            <RiskItem>使用中性灰背景，不增加边框和阴影。</RiskItem>
            <RiskItem>两列布局在窄屏下自动收敛为单列。</RiskItem>
            <RiskItem>普通工作进展不改写成检查卡片。</RiskItem>
          </RiskGrid>
        </section>

        <section className="showcase-section" id="timeline">
          <h2>八、交互时间轴</h2>
          <p>
            Timeline 复刻阶段式项目视图：拖动阶段条或两端时会实时变化，并自动吸附到日期刻度和其他阶段边界；双击轨道空白处新增，单击阶段选中后按 Del 删除。
          </p>
          <InteractiveTimelineExample />
        </section>

        <section className="showcase-section" id="diagram">
          <h2>九、图表</h2>
          <h3>Mermaid 流程图</h3>
          <p>
            Mermaid 用于工程流程、状态机和时序关系。下面的语音链路同时用于检查多行节点文案、英文下行字母和边标签的位置，颜色只编码节点角色。
          </p>
          <DiagramFrame
            editable
            mermaidSource={mermaidSource}
            aria-label="ASR 到 LLM 再到 TTS 的语音链路图"
          />
          <p>
            正文预览按图形内容和安全留白自适应高度；鼠标停在正文图表内即可滚轮平移，按住 ⌘ / Ctrl + 滚轮以指针为中心缩放；单击图表会直接进入无边画板。全屏选择工具下，从空白处拖动可框选多个节点，再拖动任一已选节点即可整组移动；Space + 左键、右键或手型工具用于平移。节点支持保持原样式的双击编辑。hover 节点会显示四向连接点，可拖到已有节点建立连线，或拖到空白处选择新图形；新增连线不会推动既有节点，同侧锚点共享起点。选中连线后可拖动两个中段控制点，手工调整圆角正交路径。
          </p>
          <h3>中英文混排节点</h3>
          <p>这张图用于回归检查“GPS 普及”等中英文混排标签，所有文字必须完整显示。</p>
          <DiagramFrame
            editable
            mermaidSource={mixedLabelMermaidSource}
            aria-label="中英文混排节点回归图"
          />
          <h3>统一画板对象</h3>
          <p>
            这张图保留原市场验证图的内容、分支和配色，但不再使用独立 SVG 图片。它由原生 Board 节点与连线构成：正文内可滚轮平移、⌘ / Ctrl + 滚轮缩放；打开画板后可选中、拖动、双击原地编辑，并从锚点创建或调整连线。
          </p>
          <DiagramFrame
            boardLayout={unifiedBoardLayout}
            editable
            mermaidSource={unifiedBoardMermaidSource}
            aria-label="用户反馈到实验决策的统一画板"
          />
        </section>
      </main>
    </DocumentContent>
  );
}

function InteractiveTimelineExample() {
  const [items, setItems] = useState<TimelineItem[]>(initialTimelineItems);

  return (
    <Timeline
      startDate="2025-12-20"
      endDate="2026-02-12"
      items={items}
      editable
      onItemsChange={setItems}
    />
  );
}

function EditableStatusExample() {
  const [status, setStatus] = useState('进行中');
  const [options, setOptions] = useState<StatusOption[]>([
    {value: '待开始', tone: 'todo' as const},
    {value: '进行中', tone: 'progress' as const},
    {value: '已完成', tone: 'done' as const},
  ]);
  const [binaryStatus, setBinaryStatus] = useState('未验证');
  const [binaryOptions, setBinaryOptions] = useState<StatusOption[]>([
    {value: '未验证', tone: 'todo'},
    {value: '已验证', tone: 'done'},
  ]);

  return (
    <Table>
      <thead>
        <tr>
          <th>属性</th>
          <th>
            <StatusFieldEditor
              label="状态"
              options={options}
              usedValues={[status]}
              editable
              onOptionsChange={setOptions}
            />
          </th>
          <th>
            <StatusFieldEditor
              label="二值状态"
              options={binaryOptions}
              usedValues={[binaryStatus]}
              editable
              onOptionsChange={setBinaryOptions}
            />
          </th>
          <th>交互说明</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>状态</td>
          <td>
            <StatusEditor
              value={status}
              options={options}
              editable
              label="示例状态"
              onChange={(next) => setStatus(next)}
            />
          </td>
          <td>
            <StatusEditor
              value={binaryStatus}
              options={binaryOptions}
              editable
              toggleWhenBinary
              label="示例二值状态"
              onChange={(next) => setBinaryStatus(next)}
            />
          </td>
          <td>点击表头管理字段值；二值单元格不打开下拉，直接切换。</td>
        </tr>
      </tbody>
    </Table>
  );
}
