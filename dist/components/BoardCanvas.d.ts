import { type BoardAnchorSide, type BoardDocument, type BoardNodeShape, type BoardNodeTone, type BoardPoint } from './BoardModel.js';
type DiagramAnchorSide = BoardAnchorSide;
type DiagramNodeShape = BoardNodeShape;
type DiagramNodeTone = BoardNodeTone;
export type DiagramNodeChangeReason = 'label' | 'position';
export type DiagramNodePosition = BoardPoint;
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
export type BoardEditRequest = {
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
export type BoardCanvasProps = {
    accessibleLabel: string;
    document: BoardDocument;
    editable: boolean;
    editingNodeId?: string;
    fitContent?: boolean;
    onChange?: (change: DiagramNodeChange) => void;
    onConnect?: (request: DiagramConnectRequest) => void;
    onConnectionDrop?: (request: DiagramConnectionDropRequest) => void;
    onEdgeRouteChange?: (change: DiagramEdgeRouteChange) => void;
    onEditRequest?: (request: BoardEditRequest) => void;
    onReady?: () => void;
    onSelectNode?: (nodeId: string | null, additive?: boolean) => void;
    onSelectEdge?: (edgeId: string | null) => void;
    panActive: boolean;
    selectedEdgeId?: string | null;
    selectedNodeIds?: readonly string[];
};
export declare function BoardCanvas({ accessibleLabel, document: boardDocument, editable, editingNodeId, fitContent, onChange, onConnect, onConnectionDrop, onEdgeRouteChange, onEditRequest, onReady, onSelectNode, onSelectEdge, panActive, selectedEdgeId, selectedNodeIds, }: BoardCanvasProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=BoardCanvas.d.ts.map