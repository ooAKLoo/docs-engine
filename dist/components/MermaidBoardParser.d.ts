export type DiagramDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type DiagramAnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type DiagramNodeShape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond';
export type DiagramNodeTone = 'blue' | 'purple' | 'teal' | 'green' | 'orange' | 'neutral';
export type MermaidBoardKind = 'flowchart' | 'sequence' | 'state' | 'class' | 'er' | 'gantt' | 'git' | 'timeline' | 'mindmap' | 'pie';
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
    sourceSide?: DiagramAnchorSide;
    sourceId: string;
    stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
    targetSide?: DiagramAnchorSide;
    targetId: string;
};
export type ParsedDiagramGraph = {
    direction: DiagramDirection;
    edges: ParsedDiagramEdge[];
    kind: MermaidBoardKind;
    nodes: ParsedDiagramNode[];
};
export declare function parseMermaidBoard(source: string): Promise<ParsedDiagramGraph>;
export declare function diagramKind(source: string): MermaidBoardKind | 'unsupported';
//# sourceMappingURL=MermaidBoardParser.d.ts.map