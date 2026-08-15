import {markdownInlineToPlainText} from './markdown.js';
import type {DocBlock, HeadingLink} from './model.js';

export function slugifyHeading(text: string): string {
  return markdownInlineToPlainText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function collectHeadings(blocks: DocBlock[]): HeadingLink[] {
  const seen = new Map<string, number>();
  return blocks
    .filter((block): block is Extract<DocBlock, {type: 'heading'}> => block.type === 'heading')
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
