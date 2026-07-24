import type { BoardAnchorSide, BoardDiagramKind, BoardDirection, BoardDocument, BoardEdgeRole, BoardGroup, BoardImportLayout, BoardNodeShape, BoardNodeTone } from './BoardModel.js';
type DiagramDirection = BoardDirection;
type DiagramAnchorSide = BoardAnchorSide;
type DiagramNodeShape = BoardNodeShape;
type DiagramNodeTone = BoardNodeTone;
type MermaidDiagramKind = BoardDiagramKind;
export type ParsedDiagramNode = {
    classes: string[];
    id: string;
    label: string;
    placeholder?: boolean;
    shape: DiagramNodeShape;
    tone: DiagramNodeTone;
};
export type ParsedDiagramEdge = {
    arrow: boolean;
    bareLabel?: boolean;
    id: string;
    label: string;
    labelAlign?: 'start' | 'middle' | 'end';
    role?: BoardEdgeRole;
    sourceSide?: DiagramAnchorSide;
    sourceId: string;
    stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
    targetSide?: DiagramAnchorSide;
    targetId: string;
};
export type ParsedDiagramGraph = {
    direction: DiagramDirection;
    edges: ParsedDiagramEdge[];
    groups?: BoardGroup[];
    kind: MermaidDiagramKind;
    nodes: ParsedDiagramNode[];
};
export declare function importMermaid(source: string, options?: {
    layout?: BoardImportLayout;
}): Promise<BoardDocument>;
export declare function detectMermaidDiagramKind(source: string): MermaidDiagramKind | 'unsupported';
export {};
//# sourceMappingURL=MermaidImporter.d.ts.map