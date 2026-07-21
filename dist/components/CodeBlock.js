'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, Copy } from 'lucide-react';
import { Children, isValidElement, useEffect, useRef, useState, } from 'react';
import { joinClassNames } from '../classnames.js';
function readText(node) {
    if (typeof node === 'string' || typeof node === 'number')
        return String(node);
    if (Array.isArray(node))
        return node.map(readText).join('');
    if (isValidElement(node))
        return readText(node.props.children);
    return '';
}
function languageFromClassName(className) {
    return className?.match(/(?:lang(?:uage)?)-([\w#+.-]+)/i)?.[1];
}
function inferLanguage(children, className) {
    const codeElement = Children.toArray(children).find((child) => isValidElement(child) && child.type === 'code');
    const childClassName = isValidElement(codeElement) && typeof codeElement.props.className === 'string'
        ? codeElement.props.className
        : undefined;
    return languageFromClassName(childClassName) ?? languageFromClassName(className);
}
async function copyText(value) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
}
export function CodeBlock({ children, className, code, copiedLabel = '已复制', copyLabel = '复制代码', language, onCopy, tabIndex = 0, ...props }) {
    const [copied, setCopied] = useState(false);
    const resetTimerRef = useRef();
    const content = code === undefined ? children : _jsx("code", { children: code });
    const codeText = code ?? readText(children).replace(/\n$/, '');
    const languageLabel = language ?? inferLanguage(children, className) ?? 'Code';
    useEffect(() => () => {
        if (resetTimerRef.current)
            clearTimeout(resetTimerRef.current);
    }, []);
    const handleCopy = async () => {
        await copyText(codeText);
        onCopy?.(codeText);
        setCopied(true);
        if (resetTimerRef.current)
            clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => setCopied(false), 1800);
    };
    return (_jsxs("div", { className: "de-code-block", "data-language": languageLabel.toLowerCase(), children: [_jsxs("div", { className: "de-code-block__toolbar", children: [_jsx("span", { className: "de-code-block__language", children: languageLabel }), _jsxs("button", { "aria-label": copied ? copiedLabel : copyLabel, className: "de-code-block__copy", onClick: handleCopy, type: "button", children: [copied ? _jsx(Check, { "aria-hidden": "true", size: 14 }) : _jsx(Copy, { "aria-hidden": "true", size: 14 }), _jsx("span", { "aria-live": "polite", children: copied ? copiedLabel : copyLabel })] })] }), _jsx("pre", { className: joinClassNames('de-code-block__pre', className), tabIndex: tabIndex, ...props, children: content })] }));
}
//# sourceMappingURL=CodeBlock.js.map