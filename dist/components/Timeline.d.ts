import { type HTMLAttributes } from 'react';
import type { TimelineItem, TimelineScale } from '../model.js';
export type TimelineChangeReason = 'move' | 'resize-start' | 'resize-end' | 'keyboard' | 'create' | 'delete';
export type TimelineChangeMeta = {
    itemId: string;
    reason: TimelineChangeReason;
};
export type TimelineProps = Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'title'> & {
    /** Small label above the title, matching the visual language of the reference layout. */
    eyebrow?: string;
    /** Timeline title. */
    title?: string;
    /** First visible date, formatted as YYYY-MM-DD. */
    startDate: string;
    /** Last visible date, formatted as YYYY-MM-DD. */
    endDate: string;
    /** Timeline stages. Dates are inclusive. */
    items: readonly TimelineItem[];
    /** Allow pointer and keyboard date editing. */
    editable?: boolean;
    /** Controlled time density. */
    scale?: TimelineScale;
    /** Initial density when scale is uncontrolled. */
    defaultScale?: TimelineScale;
    /** Text shown beside the compact toolbar. */
    toolsLabel?: string;
    /** Called after a stage is selected. */
    onItemSelect?: (item: TimelineItem) => void;
    /** Called with the changed stage only. */
    onItemChange?: (item: TimelineItem, meta: TimelineChangeMeta) => void;
    /** Called with a complete immutable item collection. */
    onItemsChange?: (items: TimelineItem[], meta: TimelineChangeMeta) => void;
    /** Called after a stage is created by clicking an empty track. */
    onItemCreate?: (item: TimelineItem, meta: TimelineChangeMeta) => void;
    /** Called after the selected stage is deleted. */
    onItemDelete?: (item: TimelineItem, meta: TimelineChangeMeta) => void;
    /** Title assigned to a stage created from the empty track. */
    newItemTitle?: string;
    /** Inclusive duration assigned to a newly created stage. */
    newItemDurationDays?: number;
    /** Called when the user changes the time density. */
    onScaleChange?: (scale: TimelineScale) => void;
};
export declare function Timeline({ eyebrow, title, startDate, endDate, items, editable, scale, defaultScale, toolsLabel, onItemSelect, onItemChange, onItemsChange, onItemCreate, onItemDelete, newItemTitle, newItemDurationDays, onScaleChange, className, style, ...props }: TimelineProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Timeline.d.ts.map