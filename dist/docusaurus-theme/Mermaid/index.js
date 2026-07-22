import { jsx as _jsx } from "react/jsx-runtime";
import { Board } from '../../components/Board.js';
/** Docusaurus swizzle target for every Markdown `mermaid` fence. */
export default function Mermaid({ value }) {
    return _jsx(Board, { "aria-label": "\u53EF\u7F16\u8F91\u753B\u677F", importSource: { format: 'mermaid', source: value } });
}
//# sourceMappingURL=index.js.map