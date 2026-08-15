import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function Annotation({ className, label, children, ...props }) {
    const classNames = joinClassNames('de-annotation', className);
    if (label != null && label !== '') {
        return (_jsxs("figure", { className: classNames, ...props, children: [_jsx("figcaption", { className: "de-annotation-label", children: label }), _jsx("p", { className: "de-annotation-line", children: children })] }));
    }
    return (_jsx("p", { className: classNames, ...props, children: children }));
}
//# sourceMappingURL=Annotation.js.map