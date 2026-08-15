import type { DocBlock } from './model.js';
export type ParseDocumentMarkdownResult = {
    blocks: DocBlock[];
    summary: string;
};
/**
 * Parse the shared Docs Engine markdown subset into DocBlocks. Hosts should not
 * reimplement this parser or guess extra block types from punctuation.
 */
export declare function parseDocumentMarkdown(markdown: string): ParseDocumentMarkdownResult;
//# sourceMappingURL=parseDocumentMarkdown.d.ts.map