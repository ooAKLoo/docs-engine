import type { HTMLAttributes } from 'react';
import { type DiagramNodePosition } from './BoardCanvas.js';
import type { BoardDocument, BoardDocumentChange, BoardImportSource } from './BoardModel.js';
export type BoardMode = 'view' | 'edit';
export type BoardMediaTransform = {
    position: DiagramNodePosition;
    scale: number;
};
export type BoardMediaChange = BoardMediaTransform & {
    reason: 'position' | 'scale';
};
export type BoardProps = HTMLAttributes<HTMLElement> & {
    /** Controlled canonical document. Import formats never reach the renderer. */
    document?: BoardDocument;
    /** Initial canonical document for an uncontrolled Board. */
    defaultDocument?: BoardDocument;
    /** Convenience input converted once into a canonical BoardDocument. */
    importSource?: BoardImportSource;
    /** Enable editing. Canonical and imported Boards are editable by default. */
    editable?: boolean;
    /** Show an optional dotted grid in the inline and full-screen canvas. */
    grid?: boolean;
    /** Mode used when the board opens. Edit mode falls back to view when editable is false. */
    initialMode?: BoardMode;
    /** Optional host-owned transform for an image or SVG placed on the Board. */
    mediaTransform?: Partial<BoardMediaTransform>;
    /** Receive every canonical document mutation for persistence. */
    onDocumentChange?: (change: BoardDocumentChange) => void;
    /** Receive position and scale changes for a media object. */
    onMediaChange?: (change: BoardMediaChange) => void;
    /** Disable the shared full-screen viewer for a diagram that owns its own interaction. */
    zoomable?: boolean;
    /** Accessible title shown in the full-screen viewer. Falls back to aria-label. */
    viewerTitle?: string;
};
export declare function Board({ className, children, document: controlledDocument, defaultDocument, importSource, editable, grid, initialMode, mediaTransform: mediaTransformValue, zoomable, viewerTitle, onClick, onDoubleClick, onKeyDown, onDocumentChange, onMediaChange, ...props }: BoardProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Board.d.ts.map