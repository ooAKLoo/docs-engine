import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
/**
 * Docusaurus/MDX table adapter. oVita keeps its richer TableBlock wrapper,
 * but both hosts share the same `de-table` visual contract.
 */
export function Table({ className, ...props }) {
    return (_jsx("div", { className: "de-table-shell", children: _jsx("div", { className: "de-table-scroll", children: _jsx("table", { className: joinClassNames('de-table', className), ...props }) }) }));
}
//# sourceMappingURL=Table.js.map