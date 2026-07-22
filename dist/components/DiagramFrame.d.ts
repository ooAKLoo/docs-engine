import type { HTMLAttributes } from 'react';
import { type DiagramBoardLayout, type DiagramCreatedEdge, type DiagramCreatedNode, type DiagramEdgeRoutePatch, type DiagramNodeChange, type DiagramNodePosition } from './MermaidBoard.js';
export type { DiagramAnchorSide, DiagramBoardEdgeLayout, DiagramBoardLayout, DiagramBoardNodeLayout, DiagramCreatedEdge, DiagramCreatedNode, DiagramEdgeRouteChange, DiagramEdgeRoutePatch, DiagramNodeChange, DiagramNodeChangeReason, DiagramNodeShape, DiagramNodeTone, DiagramNodePosition, } from './MermaidBoard.js';
export type DiagramBoardMode = 'view' | 'edit';
export type DiagramStructureChange = {
    edge: DiagramCreatedEdge;
    reason: 'create-edge';
} | {
    edge: DiagramCreatedEdge;
    node: DiagramCreatedNode;
    reason: 'create-node-and-edge';
} | {
    edgeId: string;
    reason: 'update-edge-route';
    route: DiagramEdgeRoutePatch;
};
export type DiagramMediaTransform = {
    position: DiagramNodePosition;
    scale: number;
};
export type DiagramMediaChange = DiagramMediaTransform & {
    reason: 'position' | 'scale';
};
export type DiagramFrameProps = HTMLAttributes<HTMLElement> & {
    /** Optional authored geometry for a Mermaid Board; preserves a designed diagram's initial layout. */
    boardLayout?: DiagramBoardLayout;
    /** Enable full-screen Board editing. Mermaid adds semantic node/edge editing; media adds move/scale. */
    editable?: boolean;
    /** Show an optional dotted grid in the inline and full-screen canvas. */
    grid?: boolean;
    /** Mode used when the board opens. Edit mode falls back to view when editable is false. */
    initialMode?: DiagramBoardMode;
    /** Mermaid source normalized into the single editable Board renderer. */
    mermaidSource?: string;
    /** Optional host-owned transform for a non-Mermaid image or SVG placed on the Board. */
    mediaTransform?: Partial<DiagramMediaTransform>;
    /** Receive local Mermaid edits so the host can persist them to its source of truth. */
    onDiagramChange?: (change: DiagramNodeChange) => void;
    /** Receive position and scale changes for a non-Mermaid image or SVG placed on the Board. */
    onDiagramMediaChange?: (change: DiagramMediaChange) => void;
    /** Receive edges and nodes created from the native Board connection handles. */
    onDiagramStructureChange?: (change: DiagramStructureChange) => void;
    /** Disable the shared full-screen viewer for a diagram that owns its own interaction. */
    zoomable?: boolean;
    /** Accessible title shown in the full-screen viewer. Falls back to aria-label. */
    viewerTitle?: string;
};
export declare function DiagramFrame({ className, children, boardLayout, editable, grid, initialMode, mermaidSource, mediaTransform: mediaTransformValue, zoomable, viewerTitle, onClick, onDoubleClick, onKeyDown, onDiagramChange, onDiagramMediaChange, onDiagramStructureChange, ...props }: DiagramFrameProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DiagramFrame.d.ts.map