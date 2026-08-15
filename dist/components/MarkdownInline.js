import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ResourceLink } from './ResourceLink.js';
const inlineTokenPattern = /(\*\*[^*\n]+?\*\*|\[[^\]\n]+\]\((?:https?:\/\/|\/|#)[^)]+\)|`[^`\n]+`|https?:\/\/[^\s<>"']+)/gi;
const markdownLinkPattern = /^\[([^\]\n]+)\]\(((?:https?:\/\/|\/|#)[^)]+)\)$/i;
const trailingUrlPunctuation = /[),.;:!?，。；：！？、）\]]+$/;
export function MarkdownInline({ text }) {
    const tokens = Array.from(text.matchAll(inlineTokenPattern));
    if (tokens.length === 0)
        return text;
    let lastIndex = 0;
    return (_jsxs(_Fragment, { children: [tokens.map((match, index) => {
                const token = match[0];
                const start = match.index ?? 0;
                const prefix = text.slice(lastIndex, start);
                lastIndex = start + token.length;
                if (token.startsWith('`') && token.endsWith('`')) {
                    return (_jsxs("span", { children: [prefix, _jsx("code", { children: token.slice(1, -1) })] }, `${token}-${index}`));
                }
                if (token.startsWith('**') && token.endsWith('**')) {
                    return (_jsxs("span", { children: [prefix, _jsx("strong", { children: _jsx(MarkdownInline, { text: token.slice(2, -2) }) })] }, `${token}-${index}`));
                }
                const markdownLink = token.match(markdownLinkPattern);
                if (markdownLink) {
                    const [, label, href] = markdownLink;
                    return (_jsxs("span", { children: [prefix, /^https?:\/\//i.test(href) ? (_jsx(ResourceLink, { href: href, target: "_blank", rel: "noopener noreferrer", title: href, children: label })) : (_jsx("a", { href: href, title: href, children: label }))] }, `${href}-${index}`));
                }
                const trailingMatch = token.match(trailingUrlPunctuation);
                const trailing = trailingMatch?.[0] ?? '';
                const href = trailing ? token.slice(0, -trailing.length) : token;
                return (_jsxs("span", { children: [prefix, _jsx(ResourceLink, { href: href, target: "_blank", rel: "noopener noreferrer", title: href, children: formatLinkLabel(href) }), trailing] }, `${href}-${index}`));
            }), text.slice(lastIndex)] }));
}
function formatLinkLabel(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const compactPath = pathParts.length > 0
            ? `/${pathParts.slice(0, 2).join('/')}${pathParts.length > 2 ? '/...' : ''}`
            : '';
        return `${host}${compactPath}`;
    }
    catch {
        return url.length > 54 ? `${url.slice(0, 51)}...` : url;
    }
}
//# sourceMappingURL=MarkdownInline.js.map