import {Annotation} from '../components/Annotation.js';
import {Callout} from '../components/Callout.js';
import {CodeBlock} from '../components/CodeBlock.js';
import {DiagramFrame} from '../components/DiagramFrame.js';
import {Formula} from '../components/Formula.js';
import {Priority} from '../components/Priority.js';
import {ResourceLink} from '../components/ResourceLink.js';
import {RiskGrid, RiskItem} from '../components/RiskGrid.js';
import {Status} from '../components/Status.js';
import {SummaryPanel} from '../components/SummaryPanel.js';
import {Table} from '../components/Table.js';
import {TableScroll} from '../components/TableScroll.js';
import {Timeline} from '../components/Timeline.js';
import {
  Transition,
  TransitionArrow,
  TransitionCard,
  TransitionCopy,
  TransitionLabel,
  TransitionTitle,
} from '../components/Transition.js';

export const docusaurusMdxComponents = {
  Annotation,
  Callout,
  CodeBlock,
  DiagramFrame,
  Formula,
  Priority,
  ResourceLink,
  RiskGrid,
  RiskItem,
  Status,
  SummaryPanel,
  pre: CodeBlock,
  table: Table,
  TableScroll,
  Timeline,
  Transition,
  TransitionArrow,
  TransitionCard,
  TransitionCopy,
  TransitionLabel,
  TransitionTitle,
};
