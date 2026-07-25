import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import OriginalDocItemContent from '@theme-original/DocItem/Content';
import { useRef } from 'react';
import { DocumentCopyButton } from '../../../components/DocumentCopy.js';
/**
 * The document-level copy boundary belongs to Docs Engine so every Docusaurus
 * host gets the same semantic export when it upgrades the package.
 */
export default function DocItemContent(props) {
    const rootRef = useRef(null);
    return (_jsxs("div", { ref: rootRef, className: "de-root de-prose de-document-content", children: [_jsx(DocumentCopyButton, { rootRef: rootRef }), _jsx(OriginalDocItemContent, { ...props })] }));
}
//# sourceMappingURL=index.js.map