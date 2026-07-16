import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link2 } from 'lucide-react';
import { joinClassNames } from '../classnames.js';
/**
 * External or operational resource link with a stable icon and no-wrap layout.
 * Long links expand the table and rely on the shared table shell for horizontal scrolling.
 */
export function ResourceLink({ children, className, href, ...props }) {
    return (_jsxs("a", { className: joinClassNames('de-resource-link', className), href: href, ...props, children: [_jsx(Link2, { "aria-hidden": "true", className: "de-resource-link__icon", focusable: "false", size: 15, strokeWidth: 1.8 }), _jsx("span", { className: "de-resource-link__label", children: children ?? href })] }));
}
//# sourceMappingURL=ResourceLink.js.map