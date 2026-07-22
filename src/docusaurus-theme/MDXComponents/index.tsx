import Head from '@docusaurus/Head';
import MDXA from '@theme/MDXComponents/A';
import MDXDetails from '@theme/MDXComponents/Details';
import MDXHeading from '@theme/MDXComponents/Heading';
import MDXImg from '@theme/MDXComponents/Img';
import MDXLi from '@theme/MDXComponents/Li';
import MDXPre from '@theme/MDXComponents/Pre';
import MDXUl from '@theme/MDXComponents/Ul';
import Admonition from '@theme/Admonition';
import type {ComponentProps} from 'react';
import {docusaurusMdxComponents} from '../../adapters/docusaurus.js';
import Mermaid from '../Mermaid/index.js';

function Code(props: ComponentProps<'code'>) {
  return <code {...props} />;
}

/**
 * Docusaurus' theme-original alias points back to this file when Docs Engine is
 * the only custom theme. Compose the classic primitives explicitly instead.
 */
export default {
  Head,
  details: MDXDetails,
  Details: MDXDetails,
  // Docusaurus' MDXCode turns fenced code into its own CodeBlock. Since `pre`
  // below is already the Docs Engine renderer, keeping MDXCode would create a
  // second nested code surface whose Prism classes leak host styles inward.
  code: Code,
  a: MDXA,
  img: MDXImg,
  li: MDXLi,
  ul: MDXUl,
  h1: (props: Record<string, unknown>) => <MDXHeading as="h1" {...props} />,
  h2: (props: Record<string, unknown>) => <MDXHeading as="h2" {...props} />,
  h3: (props: Record<string, unknown>) => <MDXHeading as="h3" {...props} />,
  h4: (props: Record<string, unknown>) => <MDXHeading as="h4" {...props} />,
  h5: (props: Record<string, unknown>) => <MDXHeading as="h5" {...props} />,
  h6: (props: Record<string, unknown>) => <MDXHeading as="h6" {...props} />,
  admonition: Admonition,
  mermaid: Mermaid,
  // Retain the framework default component for composition; the shared map below
  // intentionally replaces `pre` with Docs Engine's code renderer.
  Pre: MDXPre,
  ...docusaurusMdxComponents,
};
