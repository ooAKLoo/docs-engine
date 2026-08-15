import type { HTMLAttributes, ReactNode } from 'react';
import type { DocumentNavGroup } from '../documentNav.js';
export type DocumentCatalogProps = HTMLAttributes<HTMLElement> & {
    groups: DocumentNavGroup[];
    currentId?: string;
    label?: string;
    header?: ReactNode;
    actions?: ReactNode;
};
/**
 * Left-rail document catalog. Hosts supply grouped links; Docs Engine owns the
 * visuals. Optional so Docusaurus hosts can keep their native sidebar.
 */
export declare function DocumentCatalog({ actions, className, currentId, groups, header, label, ...props }: DocumentCatalogProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DocumentCatalog.d.ts.map