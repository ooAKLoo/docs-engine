import { type HTMLAttributes, type ReactNode } from 'react';
export type DocumentFrameProps = HTMLAttributes<HTMLElement> & {
    catalog?: ReactNode;
    outline?: ReactNode;
    children: ReactNode;
    persistKey?: string;
};
/**
 * Optional three-column document chrome: catalog on the left, chapter outline
 * on the right. Hosts that already have a framework sidebar (Docusaurus) can
 * skip this component.
 */
export declare function DocumentFrame({ catalog, children, className, outline, persistKey, ...props }: DocumentFrameProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DocumentFrame.d.ts.map