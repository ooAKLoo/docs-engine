'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { joinClassNames } from '../classnames.js';
/**
 * Right-rail chapter outline with scroll spy. Hosts pass headings from
 * collectHeadings(); Docs Engine owns the visuals and active-section tracking.
 */
export function DocumentOutline({ className, emptyLabel = '当前文档暂无章节标题。', headings, label = '本章', ...props }) {
    const [activeId, setActiveId] = useState(headings[0]?.id);
    useEffect(() => {
        if (headings.length === 0) {
            setActiveId(undefined);
            return;
        }
        function updateActiveHeading() {
            const nextId = readActiveHeadingId(headings);
            if (nextId)
                setActiveId(nextId);
        }
        updateActiveHeading();
        document.addEventListener('scroll', updateActiveHeading, { passive: true });
        window.addEventListener('resize', updateActiveHeading);
        window.addEventListener('hashchange', updateActiveHeading);
        return () => {
            document.removeEventListener('scroll', updateActiveHeading);
            window.removeEventListener('resize', updateActiveHeading);
            window.removeEventListener('hashchange', updateActiveHeading);
        };
    }, [headings]);
    return (_jsxs("nav", { ...props, className: joinClassNames('de-document-outline', className), "aria-label": label, children: [_jsx("p", { className: "de-document-outline__label", children: label }), headings.length === 0 ? (_jsx("p", { className: "de-document-outline__empty", children: emptyLabel })) : (_jsx("ol", { className: "de-document-outline__list", children: headings.map((heading) => (_jsx("li", { "data-level": heading.level, children: _jsx("a", { className: "de-document-outline__link", href: `#${heading.id}`, "aria-current": heading.id === activeId ? 'location' : undefined, children: _jsx(OutlineLinkText, { text: heading.text }) }) }, heading.id))) }))] }));
}
const outlineIndexPattern = /^(\d+(?:\.\d+)*)[.、)]?\s+(\S[\s\S]*)$/;
/** Splits a leading section number ("1 ", "2.3 ", "4. ") so wrapped lines hang under the title, not the number. */
export function splitOutlineIndex(text) {
    const match = outlineIndexPattern.exec(text);
    return match ? { index: match[1], title: match[2] } : { title: text };
}
function OutlineLinkText({ text }) {
    const { index, title } = splitOutlineIndex(text);
    if (!index)
        return _jsx(_Fragment, { children: text });
    return (_jsxs(_Fragment, { children: [_jsxs("span", { className: "de-document-outline__index", children: [index, " "] }), _jsx("span", { className: "de-document-outline__title", children: title })] }));
}
export function readActiveHeadingId(headings, offset = 96) {
    const hashId = window.location.hash.replace(/^#/, '');
    if (hashId && headings.some((heading) => heading.id === hashId)) {
        const hashed = document.getElementById(hashId);
        if (hashed && hashed.getBoundingClientRect().top <= offset + 8) {
            return hashId;
        }
    }
    let activeId = headings[0]?.id;
    for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (!element)
            continue;
        if (element.getBoundingClientRect().top <= offset) {
            activeId = heading.id;
        }
    }
    return activeId;
}
//# sourceMappingURL=DocumentOutline.js.map