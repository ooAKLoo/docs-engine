import { Annotation } from '../components/Annotation.js';
import { Callout } from '../components/Callout.js';
import { DiagramFrame } from '../components/DiagramFrame.js';
import { Priority } from '../components/Priority.js';
import { ResourceLink } from '../components/ResourceLink.js';
import { RiskGrid, RiskItem } from '../components/RiskGrid.js';
import { Status } from '../components/Status.js';
import { SummaryPanel } from '../components/SummaryPanel.js';
import { Table } from '../components/Table.js';
import { TableScroll } from '../components/TableScroll.js';
import { Timeline } from '../components/Timeline.js';
import { Transition, TransitionArrow, TransitionCard, TransitionCopy, TransitionLabel, TransitionTitle } from '../components/Transition.js';
export declare const docusaurusMdxComponents: {
    Annotation: typeof Annotation;
    Callout: typeof Callout;
    DiagramFrame: typeof DiagramFrame;
    Priority: typeof Priority;
    ResourceLink: typeof ResourceLink;
    RiskGrid: typeof RiskGrid;
    RiskItem: typeof RiskItem;
    Status: typeof Status;
    SummaryPanel: typeof SummaryPanel;
    table: typeof Table;
    TableScroll: typeof TableScroll;
    Timeline: typeof Timeline;
    Transition: typeof Transition;
    TransitionArrow: typeof TransitionArrow;
    TransitionCard: typeof TransitionCard;
    TransitionCopy: typeof TransitionCopy;
    TransitionLabel: typeof TransitionLabel;
    TransitionTitle: typeof TransitionTitle;
};
export declare const mermaidThemeConfig: {
    readonly theme: {
        readonly light: "base";
        readonly dark: "dark";
    };
    readonly options: {
        readonly look: "classic";
        readonly htmlLabels: false;
        readonly fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif";
        readonly flowchart: {
            readonly curve: "rounded";
            readonly padding: 18;
            readonly nodeSpacing: 42;
            readonly rankSpacing: 52;
            readonly useMaxWidth: true;
        };
        readonly themeVariables: {
            readonly primaryColor: "#E9EDFF";
            readonly primaryTextColor: "#3F3F73";
            readonly primaryBorderColor: "transparent";
            readonly secondaryColor: "#E5F8F7";
            readonly tertiaryColor: "#EEE7FF";
            readonly lineColor: "#A8A0FF";
            readonly textColor: "#3F3F73";
            readonly clusterBkg: "#F7F8FA";
            readonly clusterBorder: "transparent";
            readonly edgeLabelBackground: "#F8FAFC";
            readonly fontSize: "14px";
            readonly fontWeight: 650;
        };
    };
};
//# sourceMappingURL=docusaurus.d.ts.map