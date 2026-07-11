import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function RiskGrid({ className, ...props }) {
    return _jsx("div", { className: joinClassNames('de-check-grid', className), ...props });
}
export function RiskItem({ className, ...props }) {
    return _jsx("div", { className: joinClassNames('de-check-item', className), ...props });
}
//# sourceMappingURL=RiskGrid.js.map