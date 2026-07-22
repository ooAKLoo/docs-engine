export type DiagramLabelMetrics = {
    height: number;
    lines: string[];
    width: number;
};
export type DiagramPoint = {
    x: number;
    y: number;
};
export type DiagramCollisionNode = {
    height: number;
    position: DiagramPoint;
    width: number;
};
export type DiagramCollisionEdge = {
    align?: 'end' | 'middle' | 'start';
    arrow?: boolean;
    bare?: boolean;
    id: string;
    label: string;
    lockedPosition?: DiagramPoint;
    metrics?: DiagramLabelMetrics;
    points: DiagramPoint[];
};
export type RankedDiagramEdge = {
    label: string;
    metrics?: DiagramLabelMetrics;
    /** Main-axis space consumed by endpoint gaps, route stubs and carrier clearance. */
    routePadding?: number;
    sourceRank: number;
    targetRank: number;
};
export type DiagramLabelPlacement = {
    maximumTextWidth: number;
    mode: 'floating' | 'inline' | 'locked';
    orientation: 'horizontal' | 'vertical';
    position: DiagramPoint;
    segmentIndex: number;
};
export type PairableDiagramEdge = {
    id: string;
    sourceId: string;
    targetId: string;
};
export declare const EDGE_LABEL_MAX_TEXT_WIDTH = 220;
/**
 * Deterministic SVG text measurement used before the browser paints the Board.
 * It errs slightly on the wide side so consumers do not depend on a system font.
 */
export declare function measureDiagramTextWidth(value: string, scale?: number): number;
/** Preserve explicit line breaks, then wrap CJK by character and Latin by word. */
export declare function wrapDiagramText(value: string, maximumWidth: number, scale?: number): string[];
export declare function measureDiagramEdgeLabel(value: string, bare?: boolean, maximumTextWidth?: number): DiagramLabelMetrics;
/** A floating label keeps only a small canvas cutout around the glyphs. */
export declare function compactDiagramEdgeLabelMetrics(metrics: DiagramLabelMetrics, bare?: boolean): DiagramLabelMetrics;
/** Adjacent labels own real whitespace between rank boxes; the gap is not fixed. */
export declare function calculateAdaptiveRankGaps(rankCount: number, horizontal: boolean, edges: RankedDiagramEdge[], baseGap?: number): number[];
/** A -> B and B -> A share a pair key and therefore receive different lanes. */
export declare function assignDiagramEdgeLanes(edges: PairableDiagramEdge[]): Map<string, number>;
/**
 * Reserve node and label rectangles, then select the lowest-collision candidate for
 * every automatic edge label. Explicit label positions are immutable reservations.
 */
export declare function placeDiagramEdgeLabels(edges: DiagramCollisionEdge[], nodes: DiagramCollisionNode[]): Map<string, DiagramLabelPlacement>;
//# sourceMappingURL=DiagramAutoLayout.d.ts.map