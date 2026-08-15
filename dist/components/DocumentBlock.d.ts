import type { ReactNode } from 'react';
import type { DocBlock } from '../model.js';
export type DocumentBlockProps = {
    block: DocBlock;
    headingId?: string;
    renderInline?: (text: string) => ReactNode;
    renderBlock?: (block: DocBlock, fallback: ReactNode) => ReactNode;
};
export declare function DocumentBlock({ block, headingId, renderInline, renderBlock, }: DocumentBlockProps): ReactNode;
//# sourceMappingURL=DocumentBlock.d.ts.map