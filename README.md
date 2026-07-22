# @ooakloo/docs-engine

Lula 与 oVita 共用的文档视觉与语义内核。它只负责跨项目稳定的部分，不接管宿主框架、路由、文档目录或业务 API。

## 样式总览

所有稳定组件与 Table 基准统一放在本仓库的 [`showcase/`](./showcase/) 中，不在 Lula 或 oVita 复制样例页面。

在线访问：<https://ooakloo.github.io/docs-engine/>

```bash
pnpm showcase
```

本地访问 `http://127.0.0.1:3200/`。

## 单一真源

- `styles/tokens.css`：颜色、排版与组件 token。
- `styles/content.css`：Annotation、Callout、Table、SummaryPanel、Status、Priority、RiskGrid、转换比较与图表容器。
- `ResourceLink`：带浅灰色 Link2 图标的资源入口，图标与地址固定同行，窄屏由表格容器横向滚动。
- `src/components`：框架无关、SSR 安全的 React 语义组件（包含 Formula、CodeBlock 与统一 Mermaid Board）。
- `src/model.ts`：两端共用的基础文档块模型；目录扫描、状态写回等业务字段仍由宿主扩展。
- React 作为 peer dependency，同时兼容 React 18 与 React 19。

### 飞书高亮块色系

`Callout` 支持飞书高亮块一致的 `red`、`orange`、`yellow`、`green`、`blue`、`purple`、`neutral` 七组浅色填充，并按本项目视觉规范统一取消描边。兼容别名 `brand`、`info`、`note` 分别映射为紫色、蓝色和中性灰，不影响已有调用。

### ChatGPT 风格代码块

`CodeBlock` 提供深色代码阅读区、语言标签、复制反馈和横向滚动；Docusaurus 适配器会将 Markdown `pre` 自动映射为该组件，普通行内 `code` 使用低对比中性底色。

代码阅读区以 `!important` 封装自身的深色表面，避免 Docusaurus、Next 或其他宿主的 `pre` 规则把内部代码区改回浅色圆角卡片。

### LaTeX 公式块

`Formula` 用 KaTeX 输出 SSR 安全的显示公式。公式采用透明背景、左对齐和 KaTeX 默认数学字形，浅色主题使用黑色墨色，不再混用 Quote / Callout 的卡片表面。公式语义必须由文档作者显式表达；运行时不会根据等号、乘号或引用块猜测内容类型：

```tsx
<Formula
  aria-label="用户体验等于连续性乘以上下文相关性"
  latex={String.raw`\text{用户体验} = \text{连续性} \times \text{上下文相关性}`}
/>
```

`>` 只表示来源原话或必须保留原始措辞的引用，不承担公式、提示或卡片的视觉语义。

### 文档创作 Skill

`skills/author-technical-docs` 指导 Agent 在写作阶段选择正文、公式、表格、代码、Callout、时间轴与原生图表。Skill 明确禁止依靠运行时文本特征猜测语义，并提供适用于 Lula、oVita 及其他依赖项目的结构决策、MDX 写法和发布前检查清单。

## 宿主边界

- Lula 保留 Docusaurus、目录与内容构建脚本；Docs Engine 拥有 Mermaid 和 MDX 组件映射。
- oVita 保留 Next.js、Markdown 文件读取、业务 DocBlock、状态编辑和写回 API。
- 两端统一导入 `@ooakloo/docs-engine/styles.css`，并在文档正文根节点添加 `de-root de-prose`，不再复制共享样式。

### Mermaid 统一 Board 渲染

Docs Engine 不调用 `mermaid.render()`，也不修补 Mermaid 生成的旧 SVG。`flowchart`、`sequenceDiagram`、`stateDiagram-v2`、`classDiagram`、`erDiagram`、`gantt`、`gitGraph`、`timeline`、`mindmap` 与 `pie` 全部先由包内解析器转换成同一种 Board 节点/连线模型，再交给唯一的 `MermaidBoard` 渲染和编辑。不存在按图表类型分流的第二套 SVG 渲染器；Board 使用 SVG 画布只是单一渲染器的内部实现。

对于 Docusaurus，包内主题同时接管 Markdown 的 `mermaid` fence 与 MDX 组件映射。首次接入只需在框架配置中注册该主题；这是 Docusaurus 的加载边界，包无法被 npm 自动发现。此后升级 Docs Engine 不再需要依赖方修改渲染器、MDX 映射或文档内容：

```ts
themes: ['@ooakloo/docs-engine/adapters/docusaurus-theme'],
```

迁移后应移除 `@docusaurus/theme-mermaid`、旧的 `themeConfig.mermaid` 和任何宿主自建 `mermaid.render()` 包装器，确保运行时只有 Docs Engine 一个渲染器。

### 画板式图表查看与编辑

`DiagramFrame` 默认提供接近飞书画板的正文与全屏交互。正文预览会按节点、完整路线、箭头和标签的实际渲染边界执行内容级取景，并补充自适应安全留白；全屏则保留设计稿 `boardLayout` 的作者画布与有意留白。正文以浅灰点阵作为画布背景，不显示额外外边框；鼠标停在正文画布内时，滚轮直接平移，`⌘ / Ctrl + 滚轮` 以指针位置为中心缩放；单击才进入无边画板。普通 SVG、PNG 与 Mermaid 共用全屏缩放能力，并支持 `Space + 左键`、右键拖动或 `H` 手型模式平移画布，以及滚轮平移、全览、恢复 100%、`Esc` 退出和键盘焦点约束。全屏点阵背景通过 `grid` 显式开启，默认与飞书画板一样保持纯色画布。

同时传入 `mermaidSource` 与 `editable` 后支持拖动节点、`Shift` 约束移动方向、自动对齐参考线、方向键微调、双击原地编辑文字，以及点击空白处取消选中。选择工具下可从空白处拖出选区，框中多个节点后拖动任一已选节点即可整组移动；按住 `Shift`、`⌘` 或 `Ctrl` 框选或点击节点可追加选择。文字编辑层与原节点的形状、填充色、尺寸、字号和对齐方式重合，不会切换成另一种输入框样式。

节点 hover 或选中时会显示上、右、下、左四个浅蓝连接点。从连接点拖动可实时拉出圆角正交箭头：松到已有节点会自动吸附并建立连线；松到空白处会在终点显示图形选择器，选择矩形、圆角矩形、全圆角矩形、圆形或菱形后创建新节点并保持连接。新增关系不会再参与 Mermaid 的 rank 排版，因此既有节点坐标保持不动；同一节点同一锚点的连线共享同一个起点，不会为了避让而沿节点边界上下分散。选中或 hover 连线会显示两个可拖动的中段控制点，用来直接改变正交路线。箭头和线身按独立几何裁切，入线与出线不会因为共用中心锚点而在箭头尖端露出残线。

未传入 `boardLayout` 时，统一 Board 会在首次排版中测量节点与边标签的真实占位，并把端点留白、折线 stub、箭头长度与双向轨道共同计入 rank 间距。路由完成后，标签只会绑定到沿线方向足以承载自身的线段；较短但仍可承载的区域会触发完整文本换行，而不是截断语义。若设计稿或人工路线短到无法同时容纳胶囊和箭头，Board 会改用紧邻连线的 compact 浮签，并把所有箭头几何作为硬避让区，不会用白底盖住箭头。节点、标签和已占用标签矩形共同参与候选评分，同一对节点的往返连线会分配到不同轨道。所有线身和箭头先绘制，所有标签及其不透明底色随后统一绘制，因此后出现的连线也不会盖住先出现的文字。

对于由设计师精确编排过的图，可继续用 Mermaid 作为语义来源，同时传入 `boardLayout` 固定节点坐标、尺寸、锚点、标签位置和回流路径；自动避碰把显式位置视为不可移动约束，不会替用户重新摆放。打开画板后仍可拖动、原地编辑和继续调整连线。

组件在当前会话内保留编辑结果。宿主通过 `onDiagramChange` 持久化文字和位置，通过 `onDiagramStructureChange` 持久化新建节点与连线；不传 `mermaidSource` 的 SVG/PNG 也可设置 `editable`，在全屏画板中选中、移动、缩放，并通过 `onDiagramMediaChange` 持久化对象变换：

```tsx
<DiagramFrame
  editable
  mermaidSource={source}
  boardLayout={{
    width: 1280,
    height: 470,
    nodes: {decision: {position: {x: 520, y: 166}, width: 204, height: 140}},
    edges: [{
      sourceId: 'retry', targetId: 'test', sourceSide: 'bottom', targetSide: 'bottom',
      points: [{x: 520, y: 380}, {x: 520, y: 424}, {x: 320, y: 424}, {x: 320, y: 225}],
    }],
  }}
  aria-label="用户旅程图"
  onDiagramChange={(change) => saveDiagramNodeChange(change)}
  onDiagramStructureChange={(change) => saveDiagramStructureChange(change)}
/>

<DiagramFrame
  editable
  aria-label="市场验证路径图"
  mediaTransform={marketDiagramTransform}
  onDiagramMediaChange={(change) => saveDiagramMediaChange(change)}
>
  <img src="/market-validation-path.svg" alt="市场验证路径图" />
</DiagramFrame>
```

`onDiagramChange` 会返回 `nodeId`、最新 `label`、画布坐标 `position` 和变更原因 `label | position`；`onDiagramStructureChange` 会返回新节点、连线及其固定锚点方向，或 `update-edge-route` 的 `edgeId` 与正交路径点；`onDiagramMediaChange` 会返回普通图形的 `position`、`scale` 与变更原因 `position | scale`。把返回的 `position` 与 `scale` 传回 `mediaTransform`，即可由宿主在刷新后恢复图形位置。不需要编辑的 Mermaid 或媒体只需不传 `editable`，仍保留正文和全屏的缩放与平移能力。

已有独立交互的图表可以显式设置 `zoomable={false}`。

### 交互式项目时间轴

`Timeline` 用于阶段式项目视图，视觉上采用日期虚线网格、错层圆角阶段条和阶段事项列表。编辑模式下，阶段条会在拖动或缩放过程中实时变化，并自动吸附到日期刻度及其他阶段边界；双击轨道空白处可新增阶段，单击阶段选中后按 `Del` 删除。键盘方向键用于逐日移动，`Shift + 方向键` 调整结束日期。组件只负责交互和视觉，持久化仍由宿主通过回调完成：

```tsx
const [items, setItems] = useState<TimelineItem[]>([
  {
    id: 'research',
    title: 'Research and discovery',
    startDate: '2025-12-20',
    endDate: '2025-12-30',
    row: 0,
    notes: ['Hypothesis', 'User research'],
  },
]);

<Timeline
  startDate="2025-12-20"
  endDate="2026-02-12"
  items={items}
  editable
  onItemsChange={setItems}
/>
```

`startDate`、`endDate` 和阶段日期均使用 `YYYY-MM-DD`，结束日期按包含当天计算。新增阶段默认持续 7 天，可通过 `newItemTitle` 和 `newItemDurationDays` 调整；也可分别使用 `onItemCreate`、`onItemDelete` 接入后端操作。右上角可直接选择月、周、日三档时间尺度，并定位今天；今天不在可视范围时会明确显示“起点”。阶段超出可视日期范围时会裁切显示，底部事项会对齐到最近的日期虚线。

### 可编辑状态属性

`StatusFieldEditor` 放在表头，负责字段值的新增与删除；`StatusEditor` 只放在单元格中选择已有值。宿主通过回调决定如何写回自己的 Markdown、数据库或 API。

```tsx
<StatusFieldEditor
  label="状态"
  options={[{value: '待开始', tone: 'todo'}, {value: '已完成', tone: 'done'}]}
  editable
  onOptionsChange={(nextOptions) => saveStatusOptions(nextOptions)}
/>

<StatusEditor
  value={status}
  options={statusOptions}
  editable
  toggleWhenBinary
  onChange={(next) => saveStatus(next)}
/>
```

二值字段开启 `toggleWhenBinary` 后，单击单元格即在两个值之间切换；字段值管理始终从表头进入。

## 本地联调

两个宿主在独立仓库发布前可使用 `file:` 依赖；正式使用时必须固定 Git tag 对应的提交或不可变包版本，不能追踪可变的 `latest`。公开仓库统一通过 HTTPS tarball 安装，避免 CI 和部署服务器依赖 SSH 凭证。

```json
{
  "dependencies": {
    "@ooakloo/docs-engine": "https://codeload.github.com/ooAKLoo/docs-engine/tar.gz/v0.6.1"
  }
}
```

文档内容变化不需要发布本包；只有共享语义、组件或视觉规范变化时才升级版本。
