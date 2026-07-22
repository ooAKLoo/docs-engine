import Head from '@docusaurus/Head';
import MDXA from '@theme/MDXComponents/A';
import MDXCode from '@theme/MDXComponents/Code';
import MDXDetails from '@theme/MDXComponents/Details';
import MDXHeading from '@theme/MDXComponents/Heading';
import MDXImg from '@theme/MDXComponents/Img';
import MDXLi from '@theme/MDXComponents/Li';
import MDXPre from '@theme/MDXComponents/Pre';
import MDXUl from '@theme/MDXComponents/Ul';
import Admonition from '@theme/Admonition';
import {docusaurusMdxComponents} from '../../adapters/docusaurus.js';
import Mermaid from '../Mermaid/index.js';

/**
 * Docusaurus' theme-original alias points back to this file when Docs Engine is
 * the only custom theme. Compose the classic primitives explicitly instead.
 */
export default {
  Head,
  details: MDXDetails,
  Details: MDXDetails,
  code: MDXCode,
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
