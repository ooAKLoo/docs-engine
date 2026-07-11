import { jsx as _jsx } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
export function Callout({ className, variant = 'note', ...props }) {
    return _jsx("aside", { className: joinClassNames('de-callout', className), "data-variant": variant, ...props });
}
//# sourceMappingURL=Callout.js.map