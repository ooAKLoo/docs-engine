import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function Transition({ className, ...props }) {
    return _jsx("div", { className: joinClassNames('de-transition', className), ...props });
}
export function TransitionCard({ className, target = false, ...props }) {
    return (_jsx("div", { className: joinClassNames('de-transition-card', target && 'de-transition-card--target', className), ...props }));
}
export function TransitionArrow({ className, ...props }) {
    return _jsx("span", { "aria-hidden": "true", className: joinClassNames('de-transition-arrow', className), ...props });
}
export function TransitionLabel({ className, ...props }) {
    return _jsx("span", { className: joinClassNames('de-transition-label', className), ...props });
}
export function TransitionTitle({ className, ...props }) {
    return _jsx("strong", { className: joinClassNames('de-transition-title', className), ...props });
}
export function TransitionCopy({ className, ...props }) {
    return _jsx("p", { className: joinClassNames('de-transition-copy', className), ...props });
}
//# sourceMappingURL=Transition.js.map