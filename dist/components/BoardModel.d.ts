export type BoardDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type BoardAnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type BoardNodeShape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond';
export type BoardNodeTone = 'blue' | 'purple' | 'teal' | 'green' | 'orange' | 'neutral';
export type BoardDiagramKind = 'flowchart' | 'sequence' | 'state' | 'class' | 'er' | 'gantt' | 'git' | 'timeline' | 'mindmap' | 'pie';
export type BoardPoint = {
    x: number;
    y: number;
};
export type BoardNode = {
    classes: string[];
    height?: number;
    id: string;
    label: string;
    placeholder?: boolean;
    position?: BoardPoint;
    shape: BoardNodeShape;
    tone: BoardNodeTone;
    width?: number;
};
export type BoardEdge = {
    arrow: boolean;
    bareLabel?: boolean;
    id: string;
    label: string;
    labelAlign?: 'start' | 'middle' | 'end';
    labelPosition?: BoardPoint;
    /** User-created relationship; excluded from automatic rank calculation. */
    manual?: boolean;
    points?: BoardPoint[];
    sourceId: string;
    sourceSide?: BoardAnchorSide;
    stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
    targetId: string;
    targetSide?: BoardAnchorSide;
};
export type BoardCanvasSize = {
    height: number;
    width: number;
};
/**
 * The only persisted diagram model understood by the renderer and editor.
 * Import formats such as Mermaid are discarded after they are converted into this document.
 */
export type BoardDocument = {
    canvas?: BoardCanvasSize;
    diagramKind?: BoardDiagramKind;
    direction: BoardDirection;
    edges: BoardEdge[];
    nodes: BoardNode[];
    version: 1;
};
export type BoardImportNodeLayout = {
    height?: number;
    position: BoardPoint;
    width?: number;
};
export type BoardImportEdgeLayout = {
    bareLabel?: boolean;
    label?: string;
    labelAlign?: 'start' | 'middle' | 'end';
    labelPosition?: BoardPoint;
    points?: BoardPoint[];
    sourceId: string;
    sourceSide?: BoardAnchorSide;
    targetId: string;
    targetSide?: BoardAnchorSide;
};
/** Exact geometry optionally applied while importing authored source into a BoardDocument. */
export type BoardImportLayout = BoardCanvasSize & {
    edges?: BoardImportEdgeLayout[];
    nodes: Record<string, BoardImportNodeLayout>;
};
export type BoardImportSource = {
    format: 'mermaid';
    layout?: BoardImportLayout;
    source: string;
};
export type BoardDocumentChangeReason = 'import' | 'node-label' | 'node-position' | 'create-edge' | 'create-node-and-edge' | 'edge-route';
export type BoardDocumentChange = {
    document: BoardDocument;
    edgeId?: string;
    nodeId?: string;
    operation?: BoardOperation;
    reason: BoardDocumentChangeReason;
};
export type BoardOperation = {
    label: string;
    nodeId: string;
    type: 'update-node-label';
} | {
    nodeId: string;
    position: BoardPoint;
    type: 'update-node-position';
} | {
    edge: BoardEdge;
    type: 'create-edge';
} | {
    edge: BoardEdge;
    node: BoardNode;
    type: 'create-node-and-edge';
} | {
    edgeId: string;
    labelPosition?: BoardPoint;
    points: BoardPoint[];
    type: 'update-edge-route';
};
/** Pure reducer used by every Board editing surface and suitable for host-side persistence. */
export declare function applyBoardOperation(document: BoardDocument, operation: BoardOperation): BoardDocument;
//# sourceMappingURL=BoardModel.d.ts.map