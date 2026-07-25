import type { BoardDocument, BoardImportLayout } from './BoardModel.js';
export type BoardLayoutDiagnosticSeverity = 'error' | 'warning';
export type BoardLayoutDiagnosticCode = 'canvas-invalid' | 'duplicate-edge-id' | 'duplicate-node-id' | 'edge-crossing' | 'edge-node-collision' | 'edge-non-orthogonal' | 'edge-outside-canvas' | 'edge-overlap' | 'edge-reference-missing' | 'edge-route-invalid' | 'edge-route-missing' | 'label-node-collision' | 'node-gap' | 'node-geometry-missing' | 'node-overlap' | 'node-outside-canvas';
export type BoardLayoutDiagnostic = {
    code: BoardLayoutDiagnosticCode;
    edgeIds?: string[];
    message: string;
    nodeIds?: string[];
    severity: BoardLayoutDiagnosticSeverity;
};
export type BoardLayoutValidationOptions = {
    /** Clearance reserved around every non-terminal node while checking routes. */
    edgeNodeClearance?: number;
    /** Minimum visual gap between authored node rectangles. */
    minimumNodeGap?: number;
    /** Require every visible edge to provide an authored orthogonal route. */
    requireEdgeRoutes?: boolean;
    /** Require every node to provide position, width and height. */
    requireNodeGeometry?: boolean;
};
/** Merge exact authored geometry into a canonical BoardDocument. */
export declare function applyBoardLayout(document: BoardDocument, layout?: BoardImportLayout): BoardDocument;
/**
 * Validate geometry produced by an Agent or designer before it is persisted.
 *
 * Automatic edges may omit points by default. Set requireEdgeRoutes when an
 * authored board must own every route instead of allowing BoardCanvas to fill
 * missing geometry.
 */
export declare function validateBoardLayout(document: BoardDocument, options?: BoardLayoutValidationOptions): BoardLayoutDiagnostic[];
/** Throw when an authored layout contains any error-level diagnostic. */
export declare function assertBoardLayout(document: BoardDocument, options?: BoardLayoutValidationOptions): BoardDocument;
//# sourceMappingURL=BoardLayout.d.ts.map