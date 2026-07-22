import { jsx as _jsx } from "react/jsx-runtime";
import katex from 'katex';
import { joinClassNames } from '../classnames.js';
/**
 * A display-math block for documents. Rendering is synchronous and SSR-safe, so the same
 * mathematical typography is emitted on the server and after hydration.
 */
export function Formula({ className, compact = false, latex, ...props }) {
    const html = katex.renderToString(latex, {
        displayMode: true,
        output: 'htmlAndMathml',
        strict: 'ignore',
        throwOnError: false,
    });
    return (_jsx("div", { className: joinClassNames('de-formula', className), "data-compact": compact ? 'true' : undefined, ...props, children: _jsx("span", { dangerouslySetInnerHTML: { __html: html } }) }));
}
//# sourceMappingURL=Formula.js.map