import { type HTMLAttributes, type ReactNode } from 'react';
export type DocumentFrameProps = HTMLAttributes<HTMLElement> & {
    catalog?: ReactNode;
    outline?: ReactNode;
    children: ReactNode;
    persistKey?: string;
    /**
     * When the frame stays mounted and this key changes, fade the main column
     * and chapter outline. Full-page remounts cannot interpolate; keep the
     * catalog and frame in a layout, then pass the current document id.
     */
    contentKey?: string;
};
/**
 * Optional three-column document chrome: catalog on the left, chapter outline
 * on the right. Hosts that already have a framework sidebar (Docusaurus) can
 * skip this component.
 */
export declare function DocumentFrame({ catalog, children, className, contentKey, outline, persistKey, ...props }: DocumentFrameProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DocumentFrame.d.ts.map