import { Annotation } from '../components/Annotation.js';
import { Callout } from '../components/Callout.js';
import { DiagramFrame } from '../components/DiagramFrame.js';
import { Priority } from '../components/Priority.js';
import { RiskGrid, RiskItem } from '../components/RiskGrid.js';
import { Status } from '../components/Status.js';
import { SummaryPanel } from '../components/SummaryPanel.js';
import { TableScroll } from '../components/TableScroll.js';
import { Transition, TransitionArrow, TransitionCard, TransitionCopy, TransitionLabel, TransitionTitle } from '../components/Transition.js';
export declare const docusaurusMdxComponents: {
    Annotation: typeof Annotation;
    Callout: typeof Callout;
    DiagramFrame: typeof DiagramFrame;
    Priority: typeof Priority;
    RiskGrid: typeof RiskGrid;
    RiskItem: typeof RiskItem;
    Status: typeof Status;
    SummaryPanel: typeof SummaryPanel;
    TableScroll: typeof TableScroll;
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
        readonly look: "neo";
        readonly htmlLabels: true;
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
        };
    };
};
//# sourceMappingURL=docusaurus.d.ts.map