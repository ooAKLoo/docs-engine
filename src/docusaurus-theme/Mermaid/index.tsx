import {DiagramFrame} from '../../components/DiagramFrame.js';

type MermaidProps = {
  value: string;
};

/** Docusaurus swizzle target for every Markdown `mermaid` fence. */
export default function Mermaid({value}: MermaidProps) {
  return <DiagramFrame aria-label="Mermaid 图表" mermaidSource={value} />;
}
