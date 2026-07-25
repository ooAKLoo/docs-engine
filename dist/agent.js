/**
 * Headless authoring entry point for Codex and other document agents.
 *
 * This entry deliberately excludes React components. Agents can parse semantic
 * Mermaid, apply exact geometry, validate the result and persist one canonical
 * BoardDocument before a host renders it.
 */
export { detectMermaidDiagramKind, importMermaid } from './components/MermaidImporter.js';
export { applyBoardLayout, assertBoardLayout, validateBoardLayout, } from './components/BoardLayout.js';
export { serializeBoardDocument } from './components/BoardModel.js';
//# sourceMappingURL=agent.js.map