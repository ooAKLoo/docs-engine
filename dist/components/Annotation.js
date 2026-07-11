import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function Annotation({ className, ...props }) {
    return _jsx("p", { className: joinClassNames('de-annotation', className), ...props });
}
//# sourceMappingURL=Annotation.js.map