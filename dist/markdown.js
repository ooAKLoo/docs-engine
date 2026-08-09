/**
 * Extract the visible text from a Markdown inline fragment.
 *
 * This is intentionally scoped to inline syntax used by headings and labels.
 * It is not a Markdown parser and must not be used to convert full documents.
 */
export function markdownInlineToPlainText(value) {
    let text = value;
    text = text.replace(/!\[([^\]]*)\]\((?:\\.|[^)])*\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\((?:\\.|[^)])*\)/g, '$1');
    text = text.replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, '$1');
    text = text.replace(/(`+)([\s\S]*?)\1/g, '$2');
    for (let pass = 0; pass < 3; pass += 1) {
        text = text
            .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
            .replace(/___([^_\n]+)___/g, '$1')
            .replace(/\*\*([^*\n]+)\*\*/g, '$1')
            .replace(/__([^_\n]+)__/g, '$1')
            .replace(/~~([^~\n]+)~~/g, '$1')
            .replace(/(^|[\s([{>])\*([^*\n]+)\*(?=$|[\s)\]},.!?;:，。！？；：])/g, '$1$2')
            .replace(/(^|[\s([{>])_([^_\n]+)_(?=$|[\s)\]},.!?;:，。！？；：])/g, '$1$2');
    }
    return text
        .replace(/<[^>]+>/g, '')
        .replace(/^(?:\*{1,3}|_{1,3}|~~)\s*/, '')
        .replace(/\s*(?:\*{1,3}|_{1,3}|~~)$/, '')
        .replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}
//# sourceMappingURL=markdown.js.map