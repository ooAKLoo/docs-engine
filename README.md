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
- `src/components`：框架无关、SSR 安全的 React 语义组件。
- `src/model.ts`：两端共用的基础文档块模型；目录扫描、状态写回等业务字段仍由宿主扩展。
- React 作为 peer dependency，同时兼容 React 18 与 React 19。

### 飞书高亮块色系

`Callout` 支持飞书高亮块一致的 `red`、`orange`、`yellow`、`green`、`blue`、`purple`、`neutral` 七组浅色填充，并按本项目视觉规范统一取消描边。兼容别名 `brand`、`info`、`note` 分别映射为紫色、蓝色和中性灰，不影响已有调用。

### ChatGPT 风格代码块

`CodeBlock` 提供深色代码阅读区、语言标签、复制反馈和横向滚动；Docusaurus 适配器会将 Markdown `pre` 自动映射为该组件，普通行内 `code` 使用低对比中性底色。

## 宿主边界

- Lula 保留 Docusaurus、MDX、目录、Mermaid 配置和内容构建脚本。
- oVita 保留 Next.js、Markdown 文件读取、业务 DocBlock、状态编辑和写回 API。
- 两端统一导入 `@ooakloo/docs-engine/styles.css`，并在文档正文根节点添加 `de-root de-prose`，不再复制共享样式。

### Mermaid 11 原生画板渲染

交互式流程图把 Mermaid 11 flowchart 语法作为输入，但不调用 `mermaid.render()`，也不修补 Mermaid 生成的旧 SVG。组件通过 Mermaid 11 解析器取得节点与边的数据，再由共享的 Board renderer 统一完成布局、节点、文字、锚点和正交连线渲染，因此正文态和全屏态始终使用同一份图模型与视觉样式。

### 画板式图表查看与编辑

`DiagramFrame` 默认提供接近飞书画板的正文与全屏交互。正文预览会按图形实际边界和安全留白自适应高度，并以浅灰点阵作为画布背景，不显示额外外边框；鼠标停在正文画布内时，滚轮直接平移，`⌘ / Ctrl + 滚轮` 以指针位置为中心缩放；单击才进入无边画板。普通 SVG、PNG 与 Mermaid 共用全屏缩放能力，并支持 `Space + 左键`、右键拖动或 `H` 手型模式平移画布，以及滚轮平移、全览、恢复 100%、`Esc` 退出和键盘焦点约束。全屏点阵背景通过 `grid` 显式开启，默认与飞书画板一样保持纯色画布。

同时传入 `mermaidSource` 与 `editable` 后支持拖动节点、`Shift` 约束移动方向、自动对齐参考线、方向键微调、双击原地编辑文字，以及点击空白处取消选中。选择工具下可从空白处拖出选区，框中多个节点后拖动任一已选节点即可整组移动；按住 `Shift`、`⌘` 或 `Ctrl` 框选或点击节点可追加选择。文字编辑层与原节点的形状、填充色、尺寸、字号和对齐方式重合，不会切换成另一种输入框样式。

节点 hover 或选中时会显示上、右、下、左四个浅蓝连接点。从连接点拖动可实时拉出圆角正交箭头：松到已有节点会自动吸附并建立连线；松到空白处会在终点显示图形选择器，选择矩形、圆角矩形、全圆角矩形、圆形或菱形后创建新节点并保持连接。新增关系不会再参与 Mermaid 的 rank 排版，因此既有节点坐标保持不动；同一节点同一锚点的连线共享同一个起点，不会为了避让而沿节点边界上下分散。选中或 hover 连线会显示两个可拖动的中段控制点，用来直接改变正交路线。箭头和线身按独立几何裁切，入线与出线不会因为共用中心锚点而在箭头尖端露出残线。

对于由设计师精确编排过的 SVG，可继续用 Mermaid 作为语义来源，同时传入 `boardLayout` 固定原始节点坐标、尺寸、锚点、标签位置和回流路径；这样初始视觉不会被自动布局改写，打开画板后仍可拖动、原地编辑和继续调整连线。未传入 `boardLayout` 时仍使用自动排版。

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
