/**
 * Docusaurus theme entry point owned by Docs Engine.
 *
 * Register this package in `themes`; raw `mermaid` fenced blocks are then rendered by the
 * native Board component below, without `@docusaurus/theme-mermaid` or `mermaid.render()`.
 */
export default function docsEngineDocusaurusTheme() {
    return {
        name: 'ooakloo-docs-engine-docusaurus-theme',
        getThemePath() {
            return '../docusaurus-theme';
        },
    };
}
//# sourceMappingURL=docusaurus-theme.js.map