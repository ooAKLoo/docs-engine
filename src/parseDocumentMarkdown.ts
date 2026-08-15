import type {DocBlock} from './model.js';

export type ParseDocumentMarkdownResult = {
  blocks: DocBlock[];
  summary: string;
};

/**
 * Parse the shared Docs Engine markdown subset into DocBlocks. Hosts should not
 * reimplement this parser or guess extra block types from punctuation.
 */
export function parseDocumentMarkdown(markdown: string): ParseDocumentMarkdownResult {
  const lines = markdown.split(/\r?\n/);
  const blocks: DocBlock[] = [];
  const pendingParagraph: string[] = [];
  const pendingList: Array<{text: string}> = [];
  let pendingStatusOptions: string[] | undefined;
  let summary = '';
  let cursor = 0;

  function flushParagraph() {
    if (pendingParagraph.length === 0) return;
    const text = cleanInline(pendingParagraph.join(' '));
    blocks.push({type: 'paragraph', text});
    if (!summary) summary = text;
    pendingParagraph.length = 0;
  }

  function flushList() {
    if (pendingList.length === 0) return;
    blocks.push({type: 'list', items: pendingList.splice(0)});
  }

  function flushAll() {
    flushParagraph();
    flushList();
  }

  while (cursor < lines.length) {
    const line = lines[cursor].replace(/\s+$/g, '');
    const stripped = line.trim();

    if (!stripped) {
      flushAll();
      cursor += 1;
      continue;
    }

    const statusOptions = parseStatusOptionsComment(stripped);
    if (statusOptions) {
      flushAll();
      pendingStatusOptions = statusOptions;
      cursor += 1;
      continue;
    }

    if (isTableStart(lines, cursor)) {
      flushAll();
      const parsed = parseTable(lines, cursor, pendingStatusOptions);
      blocks.push(parsed.block);
      pendingStatusOptions = undefined;
      cursor = parsed.cursor;
      continue;
    }

    pendingStatusOptions = undefined;

    const video = parseVideoLine(stripped);
    if (video) {
      flushAll();
      blocks.push(video);
      cursor += 1;
      continue;
    }

    if (stripped === '$$') {
      flushAll();
      const parsed = parseFormula(lines, cursor);
      cursor = parsed.cursor;
      if (parsed.block) {
        blocks.push(parsed.block);
        if (!summary) summary = parsed.block.latex;
      }
      continue;
    }

    const image = parseImageLine(stripped);
    if (image) {
      flushAll();
      const images: Array<{src: string; alt: string}> = [];
      while (cursor < lines.length) {
        const imageLine = parseImageLine(lines[cursor].trim());
        if (!imageLine) break;
        images.push(imageLine);
        cursor += 1;
      }
      if (images.length >= 2) {
        blocks.push({type: 'imageGrid', images});
      } else {
        blocks.push(...images.map((item) => ({type: 'image' as const, ...item})));
      }
      continue;
    }

    const heading = stripped.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = cleanInline(heading[2]);
      if (!(level === 1 && blocks.length === 0)) {
        blocks.push({
          type: 'heading',
          level: Math.min(Math.max(level - 1, 1), 3) as 1 | 2 | 3,
          text,
        });
      }
      cursor += 1;
      continue;
    }

    const codeFence = stripped.match(/^```([A-Za-z0-9_-]+)?(?:\s+(.+))?$/);
    if (codeFence) {
      flushAll();
      cursor += 1;
      const codeLines: string[] = [];
      while (cursor < lines.length && !lines[cursor].trim().startsWith('```')) {
        codeLines.push(lines[cursor].replace(/\s+$/g, ''));
        cursor += 1;
      }
      if (cursor < lines.length) cursor += 1;
      const language = codeFence[1]?.toLowerCase();
      const body = codeLines.filter((item) => item.trim());
      if (language === 'mermaid' && body.length > 0) {
        blocks.push({
          type: 'diagram',
          syntax: 'mermaid',
          source: codeLines.join('\n').trim(),
          title: cleanInline(codeFence[2] || 'Mermaid 图表'),
        });
        continue;
      }
      if (body.length > 0) {
        blocks.push({
          type: 'code',
          code: codeLines.join('\n'),
          language,
        });
      }
      continue;
    }

    if (stripped.startsWith('>')) {
      flushAll();
      const quoteLines: string[] = [];
      while (cursor < lines.length && lines[cursor].trim().startsWith('>')) {
        const quote = lines[cursor].trim().slice(1).trim();
        if (quote) quoteLines.push(quote);
        cursor += 1;
      }
      if (quoteLines.length > 0) {
        const annotation = parseAnnotationQuote(quoteLines);
        if (annotation) {
          blocks.push(annotation);
          if (!summary) summary = annotation.text;
        } else {
          blocks.push({
            type: 'callout',
            variant: 'annotation',
            title: quoteLines[0],
            body: quoteLines.slice(1),
          });
          if (!summary) summary = quoteLines[0];
        }
      }
      continue;
    }

    const listItem = stripped.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      pendingList.push({text: cleanInline(listItem[1])});
      cursor += 1;
      continue;
    }

    if (/^-{3,}$/.test(stripped)) {
      flushAll();
      cursor += 1;
      continue;
    }

    flushList();
    pendingParagraph.push(stripped);
    cursor += 1;
  }

  flushAll();
  return {blocks, summary};
}

function cleanInline(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseImageLine(line: string) {
  const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!image) return null;
  return {
    src: image[2].trim(),
    alt: cleanInline(image[1]),
  };
}

function parseVideoLine(line: string): Extract<DocBlock, {type: 'video'}> | null {
  const video = line.match(/^@\[video\]\(([^\s)]+)(?:\s+"([^"]+)")?\)$/i);
  if (!video) return null;
  return {
    type: 'video',
    src: video[1].trim(),
    title: cleanInline(video[2] || '访谈视频'),
  };
}

function isTableSeparator(line: string) {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines: string[], index: number) {
  if (index + 1 >= lines.length) return false;
  return lines[index].trimStart().startsWith('|') && isTableSeparator(lines[index + 1]);
}

function parseTable(
  lines: string[],
  index: number,
  statusOptions?: string[],
): {block: Extract<DocBlock, {type: 'table'}>; cursor: number} {
  const rows: string[][] = [];
  let cursor = index;

  while (cursor < lines.length && lines[cursor].trimStart().startsWith('|')) {
    if (!isTableSeparator(lines[cursor])) {
      rows.push(splitMarkdownTableLine(lines[cursor]).map(cleanInline));
    }
    cursor += 1;
  }

  const headerWidth = rows[0]?.length ?? 0;
  const normalizedRows = rows.map((row, rowIndex) => {
    if (rowIndex === 0 || row.length === headerWidth) return row;
    if (row.length > headerWidth) {
      return row.slice(0, headerWidth - 1).concat(row.slice(headerWidth - 1).join(' | '));
    }
    return row.concat(Array.from({length: headerWidth - row.length}, () => ''));
  });

  return {
    block: {
      type: 'table',
      headers: normalizedRows[0] ?? [],
      rows: normalizedRows.slice(1),
      ...(statusOptions ? {statusOptions} : {}),
    },
    cursor,
  };
}

function parseStatusOptionsComment(line: string) {
  const match = line.match(/^<!--\s*docs-engine:status-options\s+(.+?)\s*-->$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) return null;

    const seen = new Set<string>();
    return parsed.flatMap((rawValue) => {
      const value = rawValue.trim();
      if (!value || value.length > 80 || /[|\r\n]/.test(value) || seen.has(value)) return [];
      seen.add(value);
      return [value];
    });
  } catch {
    return null;
  }
}

function splitMarkdownTableLine(line: string) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function parseAnnotationQuote(quoteLines: string[]): Extract<DocBlock, {type: 'annotation'}> | null {
  const mark = quoteLines[0]?.match(/^\[!annotation\](?:\s+(.*))?$/i);
  if (!mark) return null;

  const rest = mark[1]?.trim() ?? '';
  const following = quoteLines.slice(1).filter(Boolean);
  if (following.length > 0) {
    return {
      type: 'annotation',
      ...(rest ? {label: rest.replace(/[：:]+$/u, '')} : {}),
      text: following.join('\n'),
    };
  }
  if (!rest) return null;
  return {type: 'annotation', text: rest};
}

function parseFormula(lines: string[], index: number): {
  block: Extract<DocBlock, {type: 'formula'}> | null;
  cursor: number;
} {
  const latexLines: string[] = [];
  let cursor = index + 1;

  while (cursor < lines.length && lines[cursor].trim() !== '$$') {
    latexLines.push(lines[cursor]);
    cursor += 1;
  }
  if (cursor < lines.length) cursor += 1;

  const latex = latexLines.join('\n').trim();
  if (!latex) return {block: null, cursor};

  const compact = latex.includes('\\small') || latex.includes('\\textnormal');
  return {
    block: {
      type: 'formula',
      latex,
      ...(compact ? {compact: true} : {}),
    },
    cursor,
  };
}
