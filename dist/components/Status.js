import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function Status({ className, tone = 'neutral', ...props }) {
    return _jsx("span", { className: joinClassNames('de-badge', className), "data-kind": "status", "data-value": tone, ...props });
}
//# sourceMappingURL=Status.js.map