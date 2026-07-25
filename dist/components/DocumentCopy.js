'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState, } from 'react';
import { joinClassNames } from '../classnames.js';
import { writeClipboardText } from './Clipboard.js';
function normalizeInlineWhitespace(value) {
    return value.replace(/[ \t\r\n]+/gu, ' ').trim();
}
function markdownFence(value) {
    const longest = Math.max(3, ...[...value.matchAll(/`+/gu)].map((match) => match[0].length + 1));
    return '`'.repeat(longest);
}
function shouldSkipElement(element) {
    return (element.hasAttribute('hidden') ||
        element.getAttribute('aria-hidden') === 'true' ||
        element.matches('button, script, style, noscript, svg, [data-de-copy-ignore], .hash-link, a.anchor'));
}
function serializeInlineChildren(element) {
    return Array.from(element.childNodes).map(serializeInlineNode).join('');
}
function serializeInlineNode(node) {
    if (node.nodeType === 3)
        return node.textContent ?? '';
    if (node.nodeType !== 1)
        return '';
    const element = node;
    if (shouldSkipElement(element))
        return '';
    const tag = element.tagName.toLowerCase();
    if (tag === 'br')
        return '\n';
    if (tag === 'img') {
        const alt = element.getAttribute('alt')?.trim() || '图片';
        const source = element.getAttribute('src') ?? '';
        return source ? `![${alt}](${source})` : alt;
    }
    const copy = normalizeInlineWhitespace(serializeInlineChildren(element));
    if (!copy)
        return '';
    if (tag === 'code') {
        const fence = markdownFence(copy);
        return `${fence}${copy}${fence}`;
    }
    if (tag === 'strong' || tag === 'b')
        return `**${copy}**`;
    if (tag === 'em' || tag === 'i')
        return `_${copy}_`;
    if (tag === 'del' || tag === 's')
        return `~~${copy}~~`;
    if (tag === 'a') {
        const href = element.getAttribute('href');
        return href ? `[${copy}](${href})` : copy;
    }
    return copy;
}
function serializeCodeBlock(element) {
    const code = element.querySelector('.de-code-block__pre code, pre code, pre')?.textContent ?? '';
    const language = (element.getAttribute('data-language') ??
        element.querySelector('.de-code-block__language')?.textContent ??
        '')
        .trim()
        .toLowerCase();
    const fence = markdownFence(code);
    return `${fence}${language === 'code' ? '' : language}\n${code.replace(/\n$/u, '')}\n${fence}`;
}
function serializeTable(element) {
    const table = element;
    const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => normalizeInlineWhitespace(serializeInlineChildren(cell))
        .replace(/\|/gu, '\\|')
        .replace(/\n/gu, '<br>')));
    if (rows.length === 0)
        return '';
    const columnCount = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [
        ...row,
        ...Array.from({ length: columnCount - row.length }, () => ''),
    ]);
    return [
        `| ${normalized[0].join(' | ')} |`,
        `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`,
        ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
}
function serializeList(element, depth = 0) {
    const ordered = element.tagName.toLowerCase() === 'ol';
    const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li');
    return items
        .flatMap((item, index) => {
        const nestedLists = Array.from(item.children).filter((child) => ['ol', 'ul'].includes(child.tagName.toLowerCase()));
        const content = normalizeInlineWhitespace(Array.from(item.childNodes)
            .filter((child) => child.nodeType !== 1 ||
            !['ol', 'ul'].includes(child.tagName.toLowerCase()))
            .map((child) => child.nodeType === 1 && child.tagName.toLowerCase() === 'p'
            ? serializeInlineChildren(child)
            : serializeInlineNode(child))
            .join(' '));
        const indent = '  '.repeat(depth);
        const marker = ordered ? `${index + 1}.` : '-';
        const line = `${indent}${marker} ${content}`.trimEnd();
        return [
            line,
            ...nestedLists
                .map((list) => serializeList(list, depth + 1))
                .filter(Boolean),
        ];
    })
        .join('\n');
}
function serializeBlockNode(node) {
    if (node.nodeType === 3)
        return normalizeInlineWhitespace(node.textContent ?? '');
    if (node.nodeType !== 1)
        return '';
    const element = node;
    if (element.matches('.de-diagram') &&
        element.querySelector('[data-de-board-semantic]')) {
        return element.querySelector('[data-de-board-semantic]')?.textContent?.trim() ?? '';
    }
    if (shouldSkipElement(element))
        return '';
    if (element.matches('.de-code-block'))
        return serializeCodeBlock(element);
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/u.test(tag)) {
        const level = Number(tag.slice(1));
        const copy = normalizeInlineWhitespace(serializeInlineChildren(element));
        return copy ? `${'#'.repeat(level)} ${copy}` : '';
    }
    if (tag === 'p')
        return normalizeInlineWhitespace(serializeInlineChildren(element));
    if (tag === 'pre')
        return serializeCodeBlock(element);
    if (tag === 'table')
        return serializeTable(element);
    if (tag === 'ul' || tag === 'ol')
        return serializeList(element);
    if (tag === 'blockquote') {
        return serializeContainer(element)
            .split('\n')
            .map((line) => `> ${line}`.trimEnd())
            .join('\n');
    }
    if (tag === 'hr')
        return '---';
    if (tag === 'img')
        return serializeInlineNode(element);
    if (tag === 'figure') {
        const copy = serializeContainer(element);
        return copy || serializeInlineChildren(element);
    }
    if (tag === 'details') {
        const summary = element.querySelector(':scope > summary');
        const summaryCopy = summary
            ? normalizeInlineWhitespace(serializeInlineChildren(summary))
            : '详情';
        const body = Array.from(element.childNodes)
            .filter((child) => child !== summary)
            .map(serializeBlockNode)
            .filter(Boolean)
            .join('\n\n');
        return [`**${summaryCopy}**`, body].filter(Boolean).join('\n\n');
    }
    return serializeContainer(element);
}
function serializeContainer(element) {
    return Array.from(element.childNodes)
        .map(serializeBlockNode)
        .filter(Boolean)
        .join('\n\n');
}
export function serializeDocumentToMarkdown(root) {
    const markdown = serializeContainer(root)
        .replace(/[ \t]+\n/gu, '\n')
        .replace(/\n[ \t]+/gu, '\n')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();
    return markdown ? `${markdown}\n` : '';
}
export function DocumentCopyButton({ className, copiedLabel = '已复制', copyLabel = '复制全文', errorLabel = '复制失败', onCopy, rootRef, ...props }) {
    const [state, setState] = useState('idle');
    const resetTimerRef = useRef();
    const label = state === 'copied' ? copiedLabel : state === 'error' ? errorLabel : copyLabel;
    useEffect(() => () => {
        if (resetTimerRef.current)
            clearTimeout(resetTimerRef.current);
    }, []);
    const handleCopy = async () => {
        const root = rootRef.current;
        if (!root)
            return;
        let nextState;
        try {
            const markdown = serializeDocumentToMarkdown(root);
            if (!markdown)
                throw new Error('Document content is empty');
            await writeClipboardText(markdown);
            onCopy?.(markdown);
            nextState = 'copied';
        }
        catch {
            nextState = 'error';
        }
        setState(nextState);
        if (resetTimerRef.current)
            clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => setState('idle'), nextState === 'error' ? 2400 : 1800);
    };
    return (_jsxs("button", { "aria-label": label, className: joinClassNames('de-document-copy', className), "data-de-copy-ignore": true, "data-state": state, onClick: handleCopy, title: "\u590D\u5236\u4E3A Markdown\uFF0C\u5305\u542B\u56FE\u8868\u8BED\u4E49", type: "button", ...props, children: [state === 'copied' ? (_jsx(Check, { "aria-hidden": "true", size: 15, strokeWidth: 2 })) : (_jsx(Copy, { "aria-hidden": "true", size: 15, strokeWidth: 1.9 })), _jsx("span", { "aria-live": "polite", children: label })] }));
}
//# sourceMappingURL=DocumentCopy.js.map