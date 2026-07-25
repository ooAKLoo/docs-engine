import {useDoc} from '@docusaurus/plugin-content-docs/client';
import type {Props} from '@theme/DocItem/Content';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import {useRef, type ReactNode} from 'react';
import {DocumentCopyButton} from '../../../components/DocumentCopy.js';

/**
 * Compose the stable Docusaurus DocItem primitives directly. A package theme
 * cannot safely use @theme-original here: hosts may already wrap this same
 * component, which makes the alias resolve back into the wrapper chain.
 */
function useSyntheticTitle() {
  const {metadata, frontMatter, contentTitle} = useDoc();
  return !frontMatter.hide_title && typeof contentTitle === 'undefined'
    ? metadata.title
    : null;
}

export default function DocItemContent({children}: Props): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const syntheticTitle = useSyntheticTitle();

  return (
    <div ref={rootRef} className="de-root de-prose de-document-content">
      <DocumentCopyButton rootRef={rootRef} />
      <div className="theme-doc-markdown markdown">
        {syntheticTitle ? (
          <header>
            <Heading as="h1">{syntheticTitle}</Heading>
          </header>
        ) : null}
        <MDXContent>{children}</MDXContent>
      </div>
    </div>
  );
}
