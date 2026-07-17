import type { HTMLAttributes } from 'react';
export type DiagramFrameProps = HTMLAttributes<HTMLElement> & {
    /** Disable the shared full-screen viewer for a diagram that owns its own interaction. */
    zoomable?: boolean;
    /** Accessible title shown in the full-screen viewer. Falls back to aria-label. */
    viewerTitle?: string;
};
export declare function DiagramFrame({ className, children, zoomable, viewerTitle, onClick, ...props }: DiagramFrameProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DiagramFrame.d.ts.map