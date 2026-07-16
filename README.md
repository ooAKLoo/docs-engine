# @ooakloo/docs-engine

Lula 与 oVita 共用的文档视觉与语义内核。它只负责跨项目稳定的部分，不接管宿主框架、路由、文档目录或业务 API。

## 样式总览

所有稳定组件与 Table 基准统一放在本仓库的 [`showcase/`](./showcase/) 中，不在 Lula 或 oVita 复制样例页面。

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

## 宿主边界

- Lula 保留 Docusaurus、MDX、目录、Mermaid 配置和内容构建脚本。
- oVita 保留 Next.js、Markdown 文件读取、业务 DocBlock、状态编辑和写回 API。
- 两端统一导入 `@ooakloo/docs-engine/styles.css`，并在文档正文根节点添加 `de-root de-prose`，不再复制共享样式。

### Mermaid 标签兼容

共享样式会重置 Mermaid `foreignObject` 内部继承自宿主的段落 margin 和行高，避免 `Agent` 等包含下行字母的文案被裁切；流程图边标签默认统一显示在连线上方。个别图需要恢复 Mermaid 的居中标签时，可以在图表容器上覆盖：

```css
.my-mermaid {
  --de-mermaid-edge-label-offset-y: 0px;
}
```

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
    "@ooakloo/docs-engine": "https://codeload.github.com/ooAKLoo/docs-engine/tar.gz/v0.5.2"
  }
}
```

文档内容变化不需要发布本包；只有共享语义、组件或视觉规范变化时才升级版本。
