import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import { useRef } from 'react';
import { DocumentCopyButton } from '../../../components/DocumentCopy.js';
/**
 * Compose the stable Docusaurus DocItem primitives directly. A package theme
 * cannot safely use @theme-original here: hosts may already wrap this same
 * component, which makes the alias resolve back into the wrapper chain.
 */
function useSyntheticTitle() {
    const { metadata, frontMatter, contentTitle } = useDoc();
    return !frontMatter.hide_title && typeof contentTitle === 'undefined'
        ? metadata.title
        : null;
}
export default function DocItemContent({ children }) {
    const rootRef = useRef(null);
    const syntheticTitle = useSyntheticTitle();
    return (_jsxs("div", { ref: rootRef, className: "de-root de-prose de-document-content", children: [_jsx(DocumentCopyButton, { rootRef: rootRef }), _jsxs("div", { className: "theme-doc-markdown markdown", children: [syntheticTitle ? (_jsx("header", { children: _jsx(Heading, { as: "h1", children: syntheticTitle }) })) : null, _jsx(MDXContent, { children: children })] })] }));
}
//# sourceMappingURL=index.js.map