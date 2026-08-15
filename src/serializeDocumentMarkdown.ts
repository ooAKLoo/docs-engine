import type {DocBlock} from './model.js';

export function serializeDocBlock(block: DocBlock): string[] {
  switch (block.type) {
    case 'heading':
      return ['', `${'#'.repeat(block.level + 1)} ${block.text}`];
    case 'paragraph':
      return ['', block.text];
    case 'list':
      return ['', ...block.items.map((item) => `- ${item.text}`)];
    case 'code':
      return ['', `\`\`\`${block.language ?? ''}`, block.code, '```'];
    case 'formula':
      return ['', '$$', block.latex, '$$'];
    case 'image':
      return ['', `![${block.alt}](${block.src})`, ...(block.caption ? ['', block.caption] : [])];
    case 'imageGrid':
      return ['', ...block.images.map((image) => `![${image.alt}](${image.src})`)];
    case 'video':
      return ['', `@[video](${block.src} "${block.title.replace(/"/g, '&quot;')}")`];
    case 'diagram':
      return ['', `\`\`\`mermaid${block.title ? ` ${block.title}` : ''}`, block.source, '```'];
    case 'annotation':
      return [
        '',
        ...(block.label
          ? [`> [!annotation] ${block.label}`, `> ${block.text}`]
          : [`> [!annotation] ${block.text}`]),
      ];
    case 'callout':
      return ['', ...[block.title, ...block.body].filter(Boolean).map((line) => `> ${line}`)];
    case 'table':
      return [
        '',
        `| ${block.headers.map(escapeMarkdownTableCell).join(' | ')} |`,
        `| ${block.headers.map(() => '---').join(' | ')} |`,
        ...block.rows.map(
          (row) =>
            `| ${block.headers.map((_, index) => escapeMarkdownTableCell(row[index] ?? '')).join(' | ')} |`,
        ),
      ];
    case 'timeline':
      return ['', `Timeline ${block.startDate}–${block.endDate}`];
    default:
      return [];
  }
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
