import type { AnchorHTMLAttributes, ReactNode } from 'react';
export type ResourceLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> & {
    children?: ReactNode;
    href: string;
};
/**
 * External or operational resource link with a stable icon and no-wrap layout.
 * Long links expand the table and rely on the shared table shell for horizontal scrolling.
 */
export declare function ResourceLink({ children, className, href, ...props }: ResourceLinkProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ResourceLink.d.ts.map