import { type HTMLAttributes } from 'react';
import type { HeadingLink } from '../model.js';
export type DocumentOutlineProps = HTMLAttributes<HTMLElement> & {
    headings: HeadingLink[];
    label?: string;
    emptyLabel?: string;
};
/**
 * Right-rail chapter outline with scroll spy. Hosts pass headings from
 * collectHeadings(); Docs Engine owns the visuals and active-section tracking.
 */
export declare function DocumentOutline({ className, emptyLabel, headings, label, ...props }: DocumentOutlineProps): import("react/jsx-runtime").JSX.Element;
export declare function readActiveHeadingId(headings: HeadingLink[], offset?: number): string;
//# sourceMappingURL=DocumentOutline.d.ts.map