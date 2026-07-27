import type { BoardNodeShape } from './BoardModel.js';
export declare function hasBoardClass(classes: string[], className: string): boolean;
export declare function resolveNodeBadge(classes: string[]): "门槛 01" | "门槛 02" | null;
export declare function measureBadgeWidth(value: string): number;
/**
 * Deterministic node sizing shared by the renderer and every automatic layout,
 * so authored geometry produced before paint matches the painted card exactly.
 */
export declare function measureNode(label: string, shape: BoardNodeShape, classes?: string[], authoredWidth?: number): {
    height: number;
    textLines: string[];
    width: number;
};
//# sourceMappingURL=BoardNodeMetrics.d.ts.map