'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { joinClassNames } from '../classnames.js';
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
export function DiagramFrame({ className, children, zoomable = true, viewerTitle, onClick, ...props }) {
    const dialogId = useId();
    const inlineFigureRef = useRef(null);
    const triggerRef = useRef(null);
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [placeholderHeight, setPlaceholderHeight] = useState(0);
    const accessibleTitle = viewerTitle ?? (typeof props['aria-label'] === 'string' ? props['aria-label'] : '图表预览');
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeViewer();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);
    const openViewer = () => {
        if (!zoomable)
            return;
        setPlaceholderHeight(inlineFigureRef.current?.getBoundingClientRect().height ?? 0);
        setZoom(1);
        setOpen(true);
    };
    const closeViewer = () => {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const handleFigureClick = (event) => {
        onClick?.(event);
        if (event.defaultPrevented || !zoomable)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('a, button, input, select, textarea'))
            return;
        openViewer();
    };
    const inlineFigure = (_jsxs("figure", { ref: inlineFigureRef, className: joinClassNames('de-diagram', className), "data-zoomable": zoomable ? 'true' : undefined, onClick: handleFigureClick, ...props, children: [zoomable ? (_jsx("button", { ref: triggerRef, type: "button", className: "de-diagram-expand", "aria-label": `放大查看：${accessibleTitle}`, title: "\u653E\u5927\u67E5\u770B\u56FE\u8868", onClick: (event) => {
                    event.stopPropagation();
                    openViewer();
                }, children: _jsx(Maximize2, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 }) })) : null, children] }));
    return (_jsxs(_Fragment, { children: [open ? (_jsx("div", { className: "de-diagram-placeholder", style: placeholderHeight > 0 ? { height: placeholderHeight } : undefined, "aria-hidden": "true" })) : (inlineFigure), mounted && open
                ? createPortal(_jsx("div", { className: "de-root de-prose de-diagram-viewer-overlay", onMouseDown: (event) => {
                        if (event.target === event.currentTarget)
                            closeViewer();
                    }, children: _jsxs("section", { className: "de-diagram-viewer-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": `${dialogId}-title`, children: [_jsxs("header", { className: "de-diagram-viewer-header", children: [_jsx("h2", { id: `${dialogId}-title`, className: "de-diagram-viewer-title", children: accessibleTitle }), _jsxs("div", { className: "de-diagram-viewer-toolbar", "aria-label": "\u56FE\u8868\u7F29\u653E\u63A7\u5236", children: [_jsx("button", { type: "button", "aria-label": "\u7F29\u5C0F\u56FE\u8868", title: "\u7F29\u5C0F", disabled: zoom <= MIN_ZOOM, onClick: () => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP)), children: _jsx(ZoomOut, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 }) }), _jsxs("output", { className: "de-diagram-viewer-zoom", "aria-live": "polite", children: [Math.round(zoom * 100), "%"] }), _jsx("button", { type: "button", "aria-label": "\u653E\u5927\u56FE\u8868", title: "\u653E\u5927", disabled: zoom >= MAX_ZOOM, onClick: () => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP)), children: _jsx(ZoomIn, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 }) }), _jsx("button", { type: "button", "aria-label": "\u6062\u590D\u56FE\u8868\u539F\u59CB\u6BD4\u4F8B", title: "\u6062\u590D 100%", disabled: zoom === 1, onClick: () => setZoom(1), children: _jsx(RotateCcw, { "aria-hidden": "true", size: 17, strokeWidth: 1.9 }) }), _jsx("span", { className: "de-diagram-viewer-divider", "aria-hidden": "true" }), _jsx("button", { type: "button", className: "de-diagram-viewer-close", "aria-label": "\u5173\u95ED\u56FE\u8868\u9884\u89C8", title: "\u5173\u95ED\uFF08Esc\uFF09", autoFocus: true, onClick: closeViewer, children: _jsx(X, { "aria-hidden": "true", size: 20, strokeWidth: 1.9 }) })] })] }), _jsx("div", { className: "de-diagram-viewer-canvas", children: _jsx("div", { className: "de-diagram-viewer-stage", style: { width: `${zoom * 100}%` }, children: _jsx("figure", { className: joinClassNames('de-diagram', 'de-diagram-viewer-figure', className), "data-viewer": "true", ...props, children: children }) }) })] }) }), document.body)
                : null] }));
}
//# sourceMappingURL=DiagramFrame.js.map