import { type DiagramAnchorSide, type DiagramNodeShape, type DiagramNodeTone } from './MermaidBoardParser.js';
export type { DiagramAnchorSide, DiagramNodeShape, DiagramNodeTone, } from './MermaidBoardParser.js';
export type DiagramNodeChangeReason = 'label' | 'position';
export type DiagramNodePosition = {
    x: number;
    y: number;
};
export type DiagramNodeChange = {
    nodeId: string;
    label: string;
    position: DiagramNodePosition;
    reason: DiagramNodeChangeReason;
};
export type DiagramNodePatch = {
    label?: string;
    position?: DiagramNodePosition;
};
/** Fixed geometry for an authored Board node. Omit it to keep automatic Mermaid layout. */
export type DiagramBoardNodeLayout = {
    height?: number;
    position: DiagramNodePosition;
    width?: number;
};
/** Optional authored route/style for a Mermaid edge on the native Board. */
export type DiagramBoardEdgeLayout = {
    /** Render the edge label as the light, bare SVG-style annotation instead of a chip. */
    bareLabel?: boolean;
    label?: string;
    labelAlign?: 'start' | 'middle' | 'end';
    labelPosition?: DiagramNodePosition;
    points?: DiagramNodePosition[];
    sourceId: string;
    sourceSide?: DiagramAnchorSide;
    targetId: string;
    targetSide?: DiagramAnchorSide;
};
/**
 * An authored Board scene layered over Mermaid semantics. Mermaid still parses text,
 * nodes and relationships; this object supplies exact initial coordinates and routes.
 */
export type DiagramBoardLayout = {
    edges?: DiagramBoardEdgeLayout[];
    height: number;
    nodes: Record<string, DiagramBoardNodeLayout>;
    width: number;
};
export type MermaidEditRequest = {
    fontSize: number;
    nodeId: string;
    label: string;
    placeholder?: boolean;
    position: DiagramNodePosition;
    rect: DOMRect;
};
export type DiagramCreatedNode = {
    id: string;
    label: string;
    position: DiagramNodePosition;
    placeholder?: boolean;
    shape: DiagramNodeShape;
    tone: DiagramNodeTone;
};
export type DiagramCreatedEdge = {
    id: string;
    sourceId: string;
    sourceSide: DiagramAnchorSide;
    targetId: string;
    targetSide: DiagramAnchorSide;
};
/** A manually adjusted orthogonal path. The first and last points stay attached to their nodes. */
export type DiagramEdgeRoutePatch = {
    label?: DiagramNodePosition;
    points: DiagramNodePosition[];
};
export type DiagramEdgeRouteChange = {
    edgeId: string;
    route: DiagramEdgeRoutePatch;
};
export type DiagramConnectRequest = Omit<DiagramCreatedEdge, 'id'>;
export type DiagramConnectionDropRequest = {
    clientX: number;
    clientY: number;
    position: DiagramNodePosition;
    sourceId: string;
    sourceSide: DiagramAnchorSide;
    targetSide: DiagramAnchorSide;
    tone: DiagramNodeTone;
};
export type MermaidBoardProps = {
    accessibleLabel: string;
    boardLayout?: DiagramBoardLayout;
    createdEdges?: DiagramCreatedEdge[];
    createdNodes?: DiagramCreatedNode[];
    edgePatches?: Map<string, DiagramEdgeRoutePatch>;
    editable: boolean;
    editingNodeId?: string;
    fitPatchedBounds?: boolean;
    onChange?: (change: DiagramNodeChange) => void;
    onConnect?: (request: DiagramConnectRequest) => void;
    onConnectionDrop?: (request: DiagramConnectionDropRequest) => void;
    onEdgeRouteChange?: (change: DiagramEdgeRouteChange) => void;
    onEditRequest?: (request: MermaidEditRequest) => void;
    onReady?: () => void;
    onSelectNode?: (nodeId: string | null, additive?: boolean) => void;
    onSelectEdge?: (edgeId: string | null) => void;
    panActive: boolean;
    patches: Map<string, DiagramNodePatch>;
    revision: number;
    selectedEdgeId?: string | null;
    selectedNodeIds?: readonly string[];
    source: string;
};
export declare function MermaidBoard({ accessibleLabel, boardLayout, createdEdges, createdNodes, edgePatches, editable, editingNodeId, fitPatchedBounds, onChange, onConnect, onConnectionDrop, onEdgeRouteChange, onEditRequest, onReady, onSelectNode, onSelectEdge, panActive, patches, revision, selectedEdgeId, selectedNodeIds, source, }: MermaidBoardProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=MermaidBoard.d.ts.map