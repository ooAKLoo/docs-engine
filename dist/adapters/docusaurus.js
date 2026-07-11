import { Annotation } from '../components/Annotation.js';
import { Callout } from '../components/Callout.js';
import { DiagramFrame } from '../components/DiagramFrame.js';
import { Priority } from '../components/Priority.js';
import { RiskGrid, RiskItem } from '../components/RiskGrid.js';
import { Status } from '../components/Status.js';
import { SummaryPanel } from '../components/SummaryPanel.js';
import { Table } from '../components/Table.js';
import { TableScroll } from '../components/TableScroll.js';
import { Transition, TransitionArrow, TransitionCard, TransitionCopy, TransitionLabel, TransitionTitle, } from '../components/Transition.js';
export const docusaurusMdxComponents = {
    Annotation,
    Callout,
    DiagramFrame,
    Priority,
    RiskGrid,
    RiskItem,
    Status,
    SummaryPanel,
    table: Table,
    TableScroll,
    Transition,
    TransitionArrow,
    TransitionCard,
    TransitionCopy,
    TransitionLabel,
    TransitionTitle,
};
export const mermaidThemeConfig = {
    theme: {
        light: 'base',
        dark: 'dark',
    },
    options: {
        look: 'classic',
        htmlLabels: true,
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        flowchart: {
            curve: 'rounded',
            padding: 18,
            nodeSpacing: 42,
            rankSpacing: 52,
            useMaxWidth: true,
        },
        themeVariables: {
            primaryColor: '#E9EDFF',
            primaryTextColor: '#3F3F73',
            primaryBorderColor: 'transparent',
            secondaryColor: '#E5F8F7',
            tertiaryColor: '#EEE7FF',
            lineColor: '#A8A0FF',
            textColor: '#3F3F73',
            clusterBkg: '#F7F8FA',
            clusterBorder: 'transparent',
            edgeLabelBackground: '#F8FAFC',
            fontSize: '14px',
        },
    },
};
//# sourceMappingURL=docusaurus.js.map