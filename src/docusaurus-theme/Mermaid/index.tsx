import {Board} from '../../components/Board.js';

type MermaidProps = {
  value: string;
};

/** Docusaurus swizzle target for every Markdown `mermaid` fence. */
export default function Mermaid({value}: MermaidProps) {
  return <Board aria-label="可编辑画板" importSource={{format: 'mermaid', source: value}} />;
}
