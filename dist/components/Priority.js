import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function Priority({ className, level = 'p1', ...props }) {
    return _jsx("span", { className: joinClassNames('de-badge', className), "data-kind": "priority", "data-value": level, ...props });
}
//# sourceMappingURL=Priority.js.map