import type { BoardDocument, BoardImportLayout } from './BoardModel.js';
/** Kinds whose relationships form a general graph and benefit from layered layout. */
export declare function supportsElkBoardLayout(kind: BoardDocument['diagramKind']): kind is "flowchart" | "state" | "class" | "er";
/**
 * Compute authored-quality geometry for an imported diagram with ELK layered:
 * container-aware layer assignment, crossing minimisation, orthogonal routing
 * with separated lanes and inline label reservations. Returns undefined when
 * the engine is unavailable or the result is incomplete, so callers can fall
 * back to the built-in automatic layout.
 */
export declare function computeElkBoardLayout(document: BoardDocument): Promise<BoardImportLayout | undefined>;
//# sourceMappingURL=BoardElkLayout.d.ts.map