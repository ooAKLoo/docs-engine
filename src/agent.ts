/**
 * Headless authoring entry point for Codex and other document agents.
 *
 * This entry deliberately excludes React components. Agents can parse semantic
 * Mermaid, apply exact geometry, validate the result and persist one canonical
 * BoardDocument before a host renders it.
 */
export {detectMermaidDiagramKind, importMermaid} from './components/MermaidImporter.js';
export {parseDocumentMarkdown} from './parseDocumentMarkdown.js';
export {serializeDocBlock} from './serializeDocumentMarkdown.js';
export {collectHeadings, slugifyHeading} from './collectHeadings.js';
export {
  applyBoardLayout,
  assertBoardLayout,
  validateBoardLayout,
  type BoardLayoutDiagnostic,
  type BoardLayoutDiagnosticCode,
  type BoardLayoutDiagnosticSeverity,
  type BoardLayoutValidationOptions,
} from './components/BoardLayout.js';
export {serializeBoardDocument} from './components/BoardModel.js';
export type {
  BoardAnchorSide,
  BoardCanvasSize,
  BoardDiagramKind,
  BoardDirection,
  BoardDocument,
  BoardEdge,
  BoardEdgeRole,
  BoardGroup,
  BoardImportEdgeLayout,
  BoardImportLayout,
  BoardImportNodeLayout,
  BoardMarkdownOptions,
  BoardNode,
  BoardNodeShape,
  BoardNodeTone,
  BoardPoint,
} from './components/BoardModel.js';
