import OriginalDocItemContent from '@theme-original/DocItem/Content';
import type {Props} from '@theme/DocItem/Content';
import {useRef, type ReactNode} from 'react';
import {DocumentCopyButton} from '../../../components/DocumentCopy.js';

/**
 * The document-level copy boundary belongs to Docs Engine so every Docusaurus
 * host gets the same semantic export when it upgrades the package.
 */
export default function DocItemContent(props: Props): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="de-root de-prose de-document-content">
      <DocumentCopyButton rootRef={rootRef} />
      <OriginalDocItemContent {...props} />
    </div>
  );
}
