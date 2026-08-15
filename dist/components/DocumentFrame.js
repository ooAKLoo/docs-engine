'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { joinClassNames } from '../classnames.js';
/**
 * Optional three-column document chrome: catalog on the left, chapter outline
 * on the right. Hosts that already have a framework sidebar (Docusaurus) can
 * skip this component.
 */
export function DocumentFrame({ catalog, children, className, outline, persistKey = 'de-document-catalog-collapsed', ...props }) {
    const [collapsed, setCollapsed] = useState(false);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        setCollapsed(window.localStorage.getItem(persistKey) === 'true');
        setReady(true);
    }, [persistKey]);
    function setCatalogCollapsed(nextCollapsed) {
        setCollapsed(nextCollapsed);
        window.localStorage.setItem(persistKey, String(nextCollapsed));
    }
    return (_jsxs("div", { ...props, className: joinClassNames('de-document-frame', className), "data-catalog": catalog ? (collapsed ? 'collapsed' : 'open') : 'none', "data-outline": outline ? 'open' : 'none', children: [catalog && !collapsed ? (_jsxs("div", { className: "de-document-frame__catalog", children: [_jsx("button", { className: "de-document-frame__collapse", type: "button", onClick: () => setCatalogCollapsed(true), "aria-label": "\u6536\u8D77\u6587\u6863\u76EE\u5F55", title: "\u6536\u8D77\u6587\u6863\u76EE\u5F55", children: _jsx(PanelLeftClose, { size: 15, strokeWidth: 2.1 }) }), catalog] })) : null, ready && catalog && collapsed ? (_jsx("button", { className: "de-document-frame__expand", type: "button", onClick: () => setCatalogCollapsed(false), "aria-label": "\u6253\u5F00\u6587\u6863\u76EE\u5F55", title: "\u6253\u5F00\u6587\u6863\u76EE\u5F55", children: _jsx(PanelLeftOpen, { size: 17, strokeWidth: 2.2 }) })) : null, _jsx("div", { className: "de-document-frame__main", children: children }), outline ? _jsx("div", { className: "de-document-frame__outline", children: outline }) : null] }));
}
//# sourceMappingURL=DocumentFrame.js.map