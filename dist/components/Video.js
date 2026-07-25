import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { joinClassNames } from '../classnames.js';
/**
 * A storage-agnostic document video primitive. It deliberately accepts only a
 * playable URL: hosts own authorization, CDN/object-store selection, and URL
 * renewal, while Docs Engine owns the document semantics and player rendering.
 */
export function Video({ className, poster, src, title, ...props }) {
    return (_jsxs("figure", { className: joinClassNames('de-video', className), children: [_jsx("video", { "aria-label": title, controls: true, playsInline: true, poster: poster, preload: "metadata", src: src, ...props }), _jsx("figcaption", { children: title })] }));
}
//# sourceMappingURL=Video.js.map