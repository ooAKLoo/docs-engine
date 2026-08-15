'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { joinClassNames } from '../classnames.js';
/**
 * Left-rail document catalog. Hosts supply grouped links; Docs Engine owns the
 * visuals. Optional so Docusaurus hosts can keep their native sidebar.
 */
export function DocumentCatalog({ actions, className, currentId, groups, header, label = '目录', ...props }) {
    const currentRef = useRef(null);
    useEffect(() => {
        const node = currentRef.current;
        if (!node)
            return;
        const frame = window.requestAnimationFrame(() => {
            node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [currentId]);
    return (_jsxs("nav", { ...props, className: joinClassNames('de-document-catalog', className), "aria-label": label, children: [header ? _jsx("div", { className: "de-document-catalog__header", children: header }) : null, _jsxs("div", { className: "de-document-catalog__toolbar", children: [_jsx("p", { className: "de-document-catalog__label", children: label }), actions ? _jsx("div", { className: "de-document-catalog__actions", children: actions }) : null] }), _jsx("div", { className: "de-document-catalog__groups", children: groups.map((group) => (_jsxs("section", { className: "de-document-catalog__group", "aria-label": group.label, children: [_jsx("p", { className: "de-document-catalog__group-label", children: group.label }), group.items.length > 0 ? (_jsx("div", { className: "de-document-catalog__items", children: group.items.map((item) => (_jsx("a", { ref: item.id === currentId ? currentRef : undefined, className: "de-document-catalog__link", href: item.href, "aria-current": item.id === currentId ? 'page' : undefined, children: item.title }, item.id))) })) : null] }, group.key))) })] }));
}
//# sourceMappingURL=DocumentCatalog.js.map