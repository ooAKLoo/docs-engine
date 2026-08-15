import { markdownInlineToPlainText } from './markdown.js';
export function slugifyHeading(text) {
    return markdownInlineToPlainText(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
}
export function collectHeadings(blocks) {
    const seen = new Map();
    return blocks
        .filter((block) => block.type === 'heading')
        .map((block) => {
        const baseId = slugifyHeading(block.text) || 'section';
        const count = seen.get(baseId) ?? 0;
        seen.set(baseId, count + 1);
        return {
            id: count === 0 ? baseId : `${baseId}-${count + 1}`,
            level: block.level,
            text: markdownInlineToPlainText(block.text),
        };
    });
}
//# sourceMappingURL=collectHeadings.js.map