import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function DocumentContent({ className, ...props }) {
    return _jsx("div", { className: joinClassNames('de-root', 'de-prose', className), ...props });
}
//# sourceMappingURL=DocumentContent.js.map