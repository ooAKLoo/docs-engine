'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Annotation } from './Annotation.js';
import { Board } from './Board.js';
import { Callout } from './Callout.js';
import { CodeBlock } from './CodeBlock.js';
import { Formula } from './Formula.js';
import { MarkdownInline } from './MarkdownInline.js';
import { Table } from './Table.js';
import { Video } from './Video.js';
export function DocumentBlock({ block, headingId, renderInline, renderBlock, }) {
    const fallback = renderStandardBlock(block, headingId, renderInline ?? defaultInline);
    return renderBlock ? renderBlock(block, fallback) : fallback;
}
function defaultInline(text) {
    return _jsx(MarkdownInline, { text: text });
}
function renderStandardBlock(block, headingId, renderInline) {
    switch (block.type) {
        case 'heading': {
            const Tag = `h${Math.min(block.level + 1, 4)}`;
            return (_jsx(Tag, { id: headingId, children: renderInline(block.text) }));
        }
        case 'paragraph':
            return (_jsx("p", { "data-tone": block.tone, children: renderInline(block.text) }));
        case 'list':
            return (_jsx("ul", { children: block.items.map((item, index) => (_jsx("li", { "data-muted": item.muted ? 'true' : undefined, "data-strong": item.strong ? 'true' : undefined, children: item.strong ? _jsx("strong", { children: renderInline(item.text) }) : renderInline(item.text) }, `${item.text}-${index}`))) }));
        case 'code':
            return _jsx(CodeBlock, { code: block.code, language: block.language });
        case 'formula':
            return _jsx(Formula, { latex: block.latex, compact: block.compact });
        case 'image':
            return (_jsxs("figure", { className: "de-image", children: [_jsx("img", { src: block.src, alt: block.alt, loading: "lazy" }), block.caption ? _jsx("figcaption", { children: block.caption }) : null] }));
        case 'imageGrid':
            return (_jsx("div", { className: "de-image-grid", "data-image-count": block.images.length, children: block.images.map((image, index) => (_jsxs("figure", { className: "de-image-grid__item", children: [_jsx("img", { src: image.src, alt: image.alt, loading: "lazy" }), image.caption || image.alt ? (_jsx("figcaption", { children: image.caption || image.alt })) : null] }, `${image.src}-${index}`))) }));
        case 'video':
            return _jsx(Video, { src: block.src, title: block.title, poster: block.poster });
        case 'diagram':
            return (_jsx(Board, { "aria-label": block.title, importSource: { format: 'mermaid', source: block.source }, viewerTitle: block.title }));
        case 'annotation':
            return _jsx(Annotation, { label: block.label, children: renderInline(block.text) });
        case 'callout':
            if (block.variant === 'annotation') {
                const lines = [block.title, ...block.body].filter(Boolean);
                return (_jsx("blockquote", { children: lines.map((line, index) => (_jsx("p", { children: renderInline(line) }, `${line}-${index}`))) }));
            }
            return (_jsxs(Callout, { variant: block.variant, children: [block.title ? _jsx("p", { children: _jsx("strong", { children: renderInline(block.title) }) }) : null, block.body.map((line, index) => (_jsx("p", { children: renderInline(line) }, `${line}-${index}`)))] }));
        case 'table':
            return (_jsxs(Table, { children: [_jsx("thead", { children: _jsx("tr", { children: block.headers.map((header) => (_jsx("th", { children: renderInline(header) }, header))) }) }), _jsx("tbody", { children: block.rows.map((row, rowIndex) => (_jsx("tr", { children: block.headers.map((header, cellIndex) => (_jsx("td", { children: renderInline(row[cellIndex] ?? '') }, `${header}-${cellIndex}`))) }, rowIndex))) })] }));
        case 'timeline':
            return null;
        default:
            return null;
    }
}
//# sourceMappingURL=DocumentBlock.js.map