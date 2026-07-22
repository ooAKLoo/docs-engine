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
- `src/components`：框架无关、SSR 安全的 React 语义组件（包含 Formula、CodeBlock、Board 与导入器）。
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

- Lula 保留 Docusaurus、目录与内容构建脚本；Docs Engine 拥有 Board、Mermaid 导入和 MDX 组件映射。
- oVita 保留 Next.js、Markdown 文件读取、业务 DocBlock、状态编辑和写回 API。
- 两端统一导入 `@ooakloo/docs-engine/styles.css`，并在文档正文根节点添加 `de-root de-prose`，不再复制共享样式。

### Board-first 图表架构

`BoardDocument` 是渲染、编辑和持久化唯一认可的图表模型，完整包含节点、连线、锚点、路线、位置与画布尺寸。`BoardCanvas` 只读取 `BoardDocument`，不读取 Mermaid 文本，也不存在第二套按语法类型分流的 SVG 渲染器。

Mermaid 只是便于作者和 Agent 输入的导入格式。`importMermaid()` 把 `flowchart`、`sequenceDiagram`、`stateDiagram-v2`、`classDiagram`、`erDiagram`、`gantt`、`gitGraph`、`timeline`、`mindmap` 与 `pie` 一次性转换成 `BoardDocument`；转换完成后，渲染和编辑链路不再依赖原始文本。Docs Engine 不安装 Mermaid 包、不调用 `mermaid.render()`，也不修补第三方 SVG。

对于 Docusaurus，包内主题同时接管 Markdown 的 `mermaid` fence 与 MDX 组件映射。首次接入只需在框架配置中注册该主题；这是 Docusaurus 的加载边界，包无法被 npm 自动发现。此后升级 Docs Engine 不再需要依赖方修改渲染器、MDX 映射或文档内容：

```ts
themes: ['@ooakloo/docs-engine/adapters/docusaurus-theme'],
```

迁移后应移除 `@docusaurus/theme-mermaid`、旧的 `themeConfig.mermaid` 和任何宿主自建 `mermaid.render()` 包装器，确保运行时只有 Docs Engine 一个渲染器。

### 画板查看、编辑与持久化

`Board` 默认提供接近飞书画板的正文与全屏交互。正文预览按节点、完整路线、箭头和标签的实际渲染边界执行内容级取景；全屏保留文档中的作者画布与有意留白。正文内可滚轮平移，`⌘ / Ctrl + 滚轮` 以指针为中心缩放；全屏支持 `Space + 左键`、右键拖动或手型工具平移、全览、恢复 100%、`Esc` 退出和键盘焦点约束。

传入 `document`、`defaultDocument` 或 `importSource` 后默认启用编辑。节点支持拖动、对齐、框选、成组移动和双击原地编辑；连接点支持建立关系和创建新图形；连线控制点支持调整圆角正交路径。只有显式设置 `editable={false}` 才进入只读画板。

节点 hover 或选中时会显示上、右、下、左四个浅蓝连接点。从连接点拖动可实时拉出圆角正交箭头：松到已有节点会自动吸附并建立连线；松到空白处会在终点显示图形选择器，选择矩形、圆角矩形、全圆角矩形、圆形或菱形后创建新节点并保持连接。新增关系不会再参与 Mermaid 的 rank 排版，因此既有节点坐标保持不动；同一节点同一锚点的连线共享同一个起点，不会为了避让而沿节点边界上下分散。选中或 hover 连线会显示两个可拖动的中段控制点，用来直接改变正交路线。箭头和线身按独立几何裁切，入线与出线不会因为共用中心锚点而在箭头尖端露出残线。

首次自动排版会测量节点和边标签真实占位，并把端点留白、折线、箭头和双向轨道共同计入层级间距。标签只会绑定到足以承载自身的线段；必要时完整换行或改用紧邻连线的浮签。节点、标签、箭头和既有标签共同参与碰撞评分，线身与箭头先绘制，标签背景最后绘制，避免文字、线段和箭头互相覆盖。

非受控用法由组件在会话内保存下一份 `BoardDocument`；受控用法通过唯一的 `onDocumentChange` 接收完整文档并持久化。无需再分别拼接“节点补丁”“新建连线”和“路线补丁”：

```tsx
<Board
  document={document}
  aria-label="用户旅程图"
  onDocumentChange={({document: next}) => saveBoardDocument(next)}
/>

<Board
  importSource={{format: 'mermaid', source}}
  aria-label="从 Mermaid 导入的可编辑画板"
/>
```

设计师精确编排的 Mermaid 可把 `layout` 放进 `importSource`，导入器会把坐标、尺寸、锚点和路线直接合并进新文档。之后这些几何信息与 Mermaid 无关，仍可由同一个 Board 继续编辑。已有独立交互的内容可显式设置 `zoomable={false}`。

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
