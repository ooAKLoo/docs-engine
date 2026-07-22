import { jsx as _jsx } from "react/jsx-runtime";
import { DiagramFrame } from '../../components/DiagramFrame.js';
/** Docusaurus swizzle target for every Markdown `mermaid` fence. */
export default function Mermaid({ value }) {
    return _jsx(DiagramFrame, { "aria-label": "Mermaid \u56FE\u8868", mermaidSource: value });
}
//# sourceMappingURL=index.js.map