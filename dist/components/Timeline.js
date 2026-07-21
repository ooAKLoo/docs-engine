'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CalendarDays } from 'lucide-react';
import { domMax, LazyMotion, m, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, } from 'react';
import { joinClassNames } from '../classnames.js';
const DAY_IN_MS = 86_400_000;
const ROW_HEIGHT = 58;
const BAR_TOP_OFFSET = 14;
const SNAP_THRESHOLD_PX = 10;
const NOTE_ROW_HEIGHT = 20;
const NOTE_GROUP_GAP = 12;
const SCALE_ORDER = ['month', 'week', 'day'];
const SCALE_SETTINGS = {
    month: { dayWidth: 10, tickStep: 30, label: '月' },
    week: { dayWidth: 24, tickStep: 7, label: '周' },
    day: { dayWidth: 56, tickStep: 1, label: '日' },
};
export function Timeline({ eyebrow = 'Journey highlights', title = 'Timeline', startDate, endDate, items, editable = false, scale, defaultScale = 'week', toolsLabel = '时间尺度', onItemSelect, onItemChange, onItemsChange, onItemCreate, onItemDelete, newItemTitle = '新阶段', newItemDurationDays = 7, onScaleChange, className, style, ...props }) {
    const rangeStart = parseDateOnly(startDate);
    const rangeEnd = parseDateOnly(endDate);
    const totalDays = differenceInDays(rangeStart, rangeEnd) + 1;
    if (totalDays < 1) {
        throw new RangeError('Timeline endDate must be on or after startDate.');
    }
    const [internalScale, setInternalScale] = useState(defaultScale);
    const [selectedItemId, setSelectedItemId] = useState();
    const [snapGuideOffset, setSnapGuideOffset] = useState();
    const createdItemCounter = useRef(0);
    const activeScale = scale ?? internalScale;
    const settings = SCALE_SETTINGS[activeScale];
    const dayWidth = Math.max(settings.dayWidth, 920 / totalDays);
    const canvasWidth = Math.ceil(totalDays * dayWidth);
    const rowCount = Math.max(1, ...items.map((item, index) => (item.row ?? index) + 1));
    const trackHeight = rowCount * ROW_HEIGHT + 24;
    const notesTop = trackHeight + 42;
    const scrollRef = useRef(null);
    const canEdit = editable && Boolean(onItemChange || onItemsChange);
    const canCreate = editable && Boolean(onItemCreate || onItemsChange);
    const canDelete = editable && Boolean(onItemDelete || onItemsChange);
    const ticks = useMemo(() => createTicks(startDate, endDate, activeScale, settings.tickStep), [activeScale, endDate, settings.tickStep, startDate]);
    const notesLayout = createTimelineNotesLayout(items, startDate, endDate, rangeStart, totalDays, ticks);
    const canvasHeight = notesTop + Math.max(64, notesLayout.height + 34);
    const snapOffsets = useMemo(() => {
        const offsets = new Set([0, totalDays]);
        ticks.forEach((tick) => offsets.add(tick.offsetDays));
        items.forEach((item) => {
            const itemStart = differenceInDays(rangeStart, parseDateOnly(item.startDate));
            const itemEndBoundary = differenceInDays(rangeStart, parseDateOnly(item.endDate)) + 1;
            if (itemStart >= 0 && itemStart <= totalDays)
                offsets.add(itemStart);
            if (itemEndBoundary >= 0 && itemEndBoundary <= totalDays)
                offsets.add(itemEndBoundary);
        });
        return [...offsets].sort((left, right) => left - right);
    }, [items, rangeStart, ticks, totalDays]);
    useEffect(() => {
        if (selectedItemId && !items.some((item) => item.id === selectedItemId)) {
            setSelectedItemId(undefined);
        }
    }, [items, selectedItemId]);
    const today = toDateOnly(new Date());
    const todayOffset = isWithinRange(today, startDate, endDate)
        ? differenceInDays(rangeStart, parseDateOnly(today)) * dayWidth
        : undefined;
    const selectScale = (nextScale) => {
        if (nextScale === activeScale)
            return;
        if (scale === undefined)
            setInternalScale(nextScale);
        onScaleChange?.(nextScale);
    };
    const focusToday = () => {
        const scroll = scrollRef.current;
        if (!scroll)
            return;
        const target = todayOffset ?? 0;
        scroll.scrollTo({
            left: Math.max(0, target - scroll.clientWidth / 2),
            behavior: 'smooth',
        });
    };
    const selectItem = (item) => {
        setSelectedItemId(item.id);
        onItemSelect?.(item);
    };
    const commitItem = (nextItem, reason) => {
        const meta = { itemId: nextItem.id, reason };
        onItemChange?.(nextItem, meta);
        onItemsChange?.(items.map((item) => (item.id === nextItem.id ? nextItem : item)), meta);
    };
    const deleteItem = (item) => {
        if (!canDelete)
            return;
        const meta = { itemId: item.id, reason: 'delete' };
        onItemDelete?.(item, meta);
        onItemsChange?.(items.filter((candidate) => candidate.id !== item.id), meta);
        setSelectedItemId(undefined);
        setSnapGuideOffset(undefined);
    };
    const createItem = (event) => {
        if (!canCreate)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('.de-timeline__bar, .de-timeline__notes'))
            return;
        const canvas = event.currentTarget;
        const bounds = canvas.getBoundingClientRect();
        const pointerY = event.clientY - bounds.top;
        if (pointerY < BAR_TOP_OFFSET || pointerY >= trackHeight)
            return;
        const rawOffset = clamp((event.clientX - bounds.left) / dayWidth, 0, totalDays - 1);
        const nearestSnapOffset = findNearestSnapOffset(rawOffset, snapOffsets, dayWidth);
        const startOffset = clamp(nearestSnapOffset ?? Math.round(rawOffset), 0, totalDays - 1);
        const requestedDuration = Math.max(1, Math.round(newItemDurationDays));
        const endOffset = Math.min(totalDays - 1, startOffset + requestedDuration - 1);
        const preferredRow = clamp(Math.floor((pointerY - BAR_TOP_OFFSET) / ROW_HEIGHT), 0, Math.max(0, rowCount - 1));
        const row = findAvailableRow(items, startOffset, endOffset, preferredRow, rangeStart);
        const item = {
            id: `timeline-${Date.now().toString(36)}-${createdItemCounter.current++}`,
            title: newItemTitle,
            startDate: toDateOnly(addDays(rangeStart, startOffset)),
            endDate: toDateOnly(addDays(rangeStart, endOffset)),
            row,
        };
        const meta = { itemId: item.id, reason: 'create' };
        setSelectedItemId(item.id);
        onItemSelect?.(item);
        onItemCreate?.(item, meta);
        onItemsChange?.([...items, item], meta);
    };
    const rootStyle = {
        '--de-timeline-canvas-width': `${canvasWidth}px`,
        '--de-timeline-canvas-height': `${canvasHeight}px`,
        '--de-timeline-track-height': `${trackHeight}px`,
        '--de-timeline-notes-top': `${notesTop}px`,
    };
    return (_jsxs("article", { className: joinClassNames('de-timeline', className), style: { ...rootStyle, ...style }, "aria-label": `${title}，${formatLongDate(startDate)}至${formatLongDate(endDate)}`, ...props, children: [_jsxs("header", { className: "de-timeline__header", children: [_jsxs("div", { className: "de-timeline__heading", children: [_jsx("span", { className: "de-timeline__eyebrow", children: eyebrow }), _jsx("strong", { className: "de-timeline__title", children: title })] }), _jsxs("div", { className: "de-timeline__header-side", children: [_jsxs("span", { className: "de-timeline__count", "aria-label": `共 ${items.length} 个阶段`, children: [String(items.length).padStart(2, '0'), "/"] }), _jsxs("div", { className: "de-timeline__tools", role: "toolbar", "aria-label": "\u65F6\u95F4\u8F74\u5DE5\u5177", children: [_jsx("span", { children: toolsLabel }), _jsx("div", { className: "de-timeline__scale-options", role: "group", "aria-label": "\u9009\u62E9\u65F6\u95F4\u5C3A\u5EA6", children: SCALE_ORDER.map((scaleOption) => {
                                            const label = SCALE_SETTINGS[scaleOption].label;
                                            return (_jsx("button", { type: "button", "aria-label": `按${label}查看`, "aria-pressed": activeScale === scaleOption, title: `按${label}查看`, onClick: () => selectScale(scaleOption), children: label }, scaleOption));
                                        }) }), _jsxs("button", { type: "button", className: "de-timeline__today-action", "aria-label": todayOffset === undefined ? '回到时间轴起点' : '定位到今天', title: todayOffset === undefined ? '回到起点' : '定位到今天', onClick: focusToday, children: [_jsx(CalendarDays, { "aria-hidden": "true", size: 15, strokeWidth: 1.8 }), _jsx("span", { children: todayOffset === undefined ? '起点' : '今天' })] })] })] })] }), _jsx("div", { ref: scrollRef, className: "de-timeline__scroll", tabIndex: 0, "aria-label": "\u53EF\u6A2A\u5411\u6EDA\u52A8\u7684\u9879\u76EE\u65F6\u95F4\u8F74", children: _jsxs("div", { className: "de-timeline__canvas", "data-creatable": canCreate ? 'true' : undefined, onDoubleClick: createItem, children: [ticks.map((tick) => (_jsx("div", { className: "de-timeline__tick", style: { left: tick.offsetDays * dayWidth }, "aria-hidden": "true", children: _jsx("span", { children: tick.label }) }, tick.date))), todayOffset !== undefined ? (_jsx("div", { className: "de-timeline__today", style: { left: todayOffset }, "aria-hidden": "true", children: _jsx("span", { children: "\u4ECA\u5929" }) })) : null, snapGuideOffset !== undefined ? (_jsx("div", { className: "de-timeline__snap-guide", style: { left: snapGuideOffset * dayWidth }, "aria-hidden": "true" })) : null, _jsx(LazyMotion, { features: domMax, strict: true, children: items.map((item, index) => (_jsx(TimelineBar, { item: item, rangeStart: startDate, rangeEnd: endDate, dayWidth: dayWidth, top: (item.row ?? index) * ROW_HEIGHT + BAR_TOP_OFFSET, editable: canEdit && !item.locked, deletable: canDelete && !item.locked, selected: selectedItemId === item.id, snapOffsets: snapOffsets, onSelect: selectItem, onCommit: commitItem, onDelete: deleteItem, onSnapGuideChange: setSnapGuideOffset }, item.id))) }), _jsx("div", { className: "de-timeline__axis", "aria-hidden": "true" }), notesLayout.entries.map(({ item, notes, tickIndex, top }) => {
                            const alignedTick = ticks[tickIndex];
                            const nextTick = ticks[tickIndex + 1];
                            const left = alignedTick.offsetDays * dayWidth;
                            const availableWidth = ((nextTick?.offsetDays ?? totalDays) - alignedTick.offsetDays) * dayWidth;
                            return (_jsx("ul", { className: "de-timeline__notes", style: { left, top: notesTop + top, width: clamp(availableWidth, 132, 260) }, "aria-label": `${item.title}事项`, children: notes.map((note, noteIndex) => (_jsx("li", { title: note, children: note }, `${item.id}-note-${noteIndex}`))) }, `${item.id}-notes`));
                        })] }) }), canEdit || canCreate || canDelete ? (_jsx("p", { className: "de-timeline__hint", children: "\u62D6\u52A8\u9636\u6BB5\u8C03\u6574\u65E5\u671F\uFF0C\u62D6\u52A8\u4E24\u7AEF\u8C03\u6574\u6301\u7EED\u65F6\u95F4\uFF1B\u53CC\u51FB\u7A7A\u767D\u5904\u65B0\u589E\uFF0C\u5355\u51FB\u9636\u6BB5\u540E\u6309 Del \u5220\u9664" })) : null] }));
}
function TimelineBar({ item, rangeStart, rangeEnd, dayWidth, top, editable, deletable, selected, snapOffsets, onSelect, onCommit, onDelete, onSnapGuideChange, }) {
    const prefersReducedMotion = useReducedMotion();
    const [interaction, setInteraction] = useState();
    const start = parseDateOnly(item.startDate);
    const end = parseDateOnly(item.endDate);
    const rangeStartDate = parseDateOnly(rangeStart);
    const rangeEndDate = parseDateOnly(rangeEnd);
    const totalDays = differenceInDays(rangeStartDate, rangeEndDate) + 1;
    const startOffset = differenceInDays(rangeStartDate, start);
    const endBoundaryOffset = differenceInDays(rangeStartDate, end) + 1;
    let previewStart = start;
    let previewEnd = end;
    if (interaction?.kind === 'move') {
        previewStart = addDays(start, interaction.deltaDays);
        previewEnd = addDays(end, interaction.deltaDays);
    }
    else if (interaction?.kind === 'resize-start') {
        previewStart = addDays(start, interaction.deltaDays);
    }
    else if (interaction?.kind === 'resize-end') {
        previewEnd = addDays(end, interaction.deltaDays);
    }
    const visibleStart = maxDate(previewStart, rangeStartDate);
    const visibleEnd = minDate(previewEnd, rangeEndDate);
    if (visibleEnd.getTime() < visibleStart.getTime())
        return null;
    const left = differenceInDays(rangeStartDate, visibleStart) * dayWidth;
    const width = (differenceInDays(visibleStart, visibleEnd) + 1) * dayWidth;
    const bodyLabel = `${item.title}，${formatLongDate(toDateOnly(previewStart))}至${formatLongDate(toDateOnly(previewEnd))}`;
    const keyboardShortcuts = editable
        ? deletable
            ? 'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Delete Backspace'
            : 'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight'
        : deletable
            ? 'Delete Backspace'
            : undefined;
    const shiftItem = (deltaDays, reason) => {
        if (deltaDays === 0)
            return;
        const nextStart = addDays(start, deltaDays);
        const nextEnd = addDays(end, deltaDays);
        if (nextStart < rangeStartDate || nextEnd > rangeEndDate)
            return;
        onCommit({ ...item, startDate: toDateOnly(nextStart), endDate: toDateOnly(nextEnd) }, reason);
    };
    const resizeStart = (deltaDays) => {
        if (deltaDays === 0)
            return;
        const nextStart = addDays(start, deltaDays);
        if (nextStart < rangeStartDate || nextStart > end)
            return;
        onCommit({ ...item, startDate: toDateOnly(nextStart) }, 'resize-start');
    };
    const resizeEnd = (deltaDays, reason = 'resize-end') => {
        if (deltaDays === 0)
            return;
        const nextEnd = addDays(end, deltaDays);
        if (nextEnd < start || nextEnd > rangeEndDate)
            return;
        onCommit({ ...item, endDate: toDateOnly(nextEnd) }, reason);
    };
    const handleKeyboard = (event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && deletable && selected) {
            event.preventDefault();
            onDelete(item);
            return;
        }
        if (!editable || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight'))
            return;
        event.preventDefault();
        const deltaDays = event.key === 'ArrowLeft' ? -1 : 1;
        if (event.shiftKey)
            resizeEnd(deltaDays, 'keyboard');
        else
            shiftItem(deltaDays, 'keyboard');
    };
    const resolveInteraction = (kind, info) => resolveTimelineInteraction({
        kind,
        offsetX: info.offset.x,
        dayWidth,
        startOffset,
        endBoundaryOffset,
        totalDays,
        snapOffsets,
    });
    const beginInteraction = (kind) => {
        setInteraction({ kind, deltaDays: 0 });
        onSnapGuideChange(undefined);
    };
    const updateInteraction = (kind, info) => {
        const nextInteraction = resolveInteraction(kind, info);
        setInteraction(nextInteraction);
        onSnapGuideChange(nextInteraction.guideOffset);
    };
    const finishInteraction = (kind, info) => {
        const nextInteraction = resolveInteraction(kind, info);
        setInteraction(undefined);
        onSnapGuideChange(undefined);
        if (kind === 'move')
            shiftItem(nextInteraction.deltaDays, 'move');
        else if (kind === 'resize-start')
            resizeStart(nextInteraction.deltaDays);
        else
            resizeEnd(nextInteraction.deltaDays);
    };
    return (_jsxs(m.div, { className: "de-timeline__bar", "data-editable": editable ? 'true' : undefined, "data-selected": selected ? 'true' : undefined, "data-interacting": interaction ? 'true' : undefined, style: { left, top, width }, animate: prefersReducedMotion ? undefined : { scale: interaction ? 1.015 : 1 }, transition: { duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }, children: [_jsxs(m.button, { type: "button", className: "de-timeline__bar-body", "aria-label": bodyLabel, "aria-keyshortcuts": keyboardShortcuts, title: editable ? `${bodyLabel}。拖动可调整日期` : bodyLabel, onPointerDown: () => onSelect(item), onKeyDown: handleKeyboard, onClick: (event) => {
                    if (event.detail === 0)
                        onSelect(item);
                }, onPanStart: editable ? () => beginInteraction('move') : undefined, onPan: editable ? (_event, info) => updateInteraction('move', info) : undefined, onPanEnd: editable ? (_event, info) => finishInteraction('move', info) : undefined, children: [_jsx("span", { children: item.title }), item.meta ? _jsx("small", { children: item.meta }) : null] }), editable ? (_jsxs(_Fragment, { children: [_jsx(m.button, { type: "button", className: "de-timeline__resize de-timeline__resize--start", "aria-label": `调整${item.title}的开始日期`, title: "\u8C03\u6574\u5F00\u59CB\u65E5\u671F", onPointerDown: (event) => {
                            event.stopPropagation();
                            onSelect(item);
                        }, onClick: (event) => event.stopPropagation(), onPanStart: () => beginInteraction('resize-start'), onPan: (_event, info) => updateInteraction('resize-start', info), onPanEnd: (_event, info) => finishInteraction('resize-start', info) }), _jsx(m.button, { type: "button", className: "de-timeline__resize de-timeline__resize--end", "aria-label": `调整${item.title}的结束日期`, title: "\u8C03\u6574\u7ED3\u675F\u65E5\u671F", onPointerDown: (event) => {
                            event.stopPropagation();
                            onSelect(item);
                        }, onClick: (event) => event.stopPropagation(), onPanStart: () => beginInteraction('resize-end'), onPan: (_event, info) => updateInteraction('resize-end', info), onPanEnd: (_event, info) => finishInteraction('resize-end', info) })] })) : null] }));
}
function resolveTimelineInteraction({ kind, offsetX, dayWidth, startOffset, endBoundaryOffset, totalDays, snapOffsets, }) {
    const durationDays = endBoundaryOffset - startOffset;
    const rawDeltaDays = offsetX / dayWidth;
    let minimumDelta;
    let maximumDelta;
    let movingEdges;
    if (kind === 'move') {
        minimumDelta = -startOffset;
        maximumDelta = totalDays - endBoundaryOffset;
        movingEdges = [startOffset, endBoundaryOffset];
    }
    else if (kind === 'resize-start') {
        minimumDelta = -startOffset;
        maximumDelta = durationDays - 1;
        movingEdges = [startOffset];
    }
    else {
        minimumDelta = -(durationDays - 1);
        maximumDelta = totalDays - endBoundaryOffset;
        movingEdges = [endBoundaryOffset];
    }
    const roundedDelta = clamp(Math.round(rawDeltaDays), minimumDelta, maximumDelta);
    let snappedDelta = roundedDelta;
    let guideOffset;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const edge of movingEdges) {
        for (const snapOffset of snapOffsets) {
            const candidateDelta = snapOffset - edge;
            if (candidateDelta < minimumDelta || candidateDelta > maximumDelta)
                continue;
            const distance = Math.abs(candidateDelta - rawDeltaDays) * dayWidth;
            if (distance <= SNAP_THRESHOLD_PX && distance < closestDistance) {
                closestDistance = distance;
                snappedDelta = candidateDelta;
                guideOffset = snapOffset;
            }
        }
    }
    return { kind, deltaDays: snappedDelta, guideOffset };
}
function findNearestSnapOffset(rawOffset, snapOffsets, dayWidth) {
    let nearestOffset;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const snapOffset of snapOffsets) {
        const distance = Math.abs(snapOffset - rawOffset) * dayWidth;
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestOffset = snapOffset;
        }
    }
    return nearestDistance <= SNAP_THRESHOLD_PX ? nearestOffset : undefined;
}
function findNearestTickIndex(offset, ticks) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    ticks.forEach((tick, index) => {
        const distance = Math.abs(tick.offsetDays - offset);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });
    return nearestIndex;
}
function createTimelineNotesLayout(items, startDate, endDate, rangeStart, totalDays, ticks) {
    const stackHeights = new Map();
    const entries = [];
    let height = 0;
    for (const item of items) {
        const notes = item.notes;
        if (!notes?.length || !isItemVisible(item, startDate, endDate))
            continue;
        const itemStartOffset = clamp(differenceInDays(rangeStart, parseDateOnly(item.startDate)), 0, totalDays - 1);
        const tickIndex = findNearestTickIndex(itemStartOffset, ticks);
        const top = stackHeights.get(tickIndex) ?? 0;
        const blockHeight = Math.max(NOTE_ROW_HEIGHT, notes.length * NOTE_ROW_HEIGHT);
        stackHeights.set(tickIndex, top + blockHeight + NOTE_GROUP_GAP);
        height = Math.max(height, top + blockHeight);
        entries.push({ item, notes, tickIndex, top });
    }
    return { entries, height };
}
function findAvailableRow(items, startOffset, endOffset, preferredRow, rangeStart) {
    const maxExistingRow = Math.max(0, ...items.map((item, index) => item.row ?? index));
    const candidateRows = [
        ...Array.from({ length: maxExistingRow - preferredRow + 2 }, (_, index) => preferredRow + index),
        ...Array.from({ length: preferredRow }, (_, index) => index),
    ];
    for (const row of candidateRows) {
        const overlaps = items.some((item, index) => {
            if ((item.row ?? index) !== row)
                return false;
            const itemStart = differenceInDays(rangeStart, parseDateOnly(item.startDate));
            const itemEnd = differenceInDays(rangeStart, parseDateOnly(item.endDate));
            return startOffset <= itemEnd && endOffset >= itemStart;
        });
        if (!overlaps)
            return row;
    }
    return maxExistingRow + 1;
}
function createTicks(startDate, endDate, scale, tickStep) {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    const ticks = [];
    let cursor = start;
    while (cursor <= end) {
        ticks.push({
            date: toDateOnly(cursor),
            label: formatTick(cursor, scale),
            offsetDays: differenceInDays(start, cursor),
        });
        cursor = scale === 'month' ? firstDayOfNextMonth(cursor) : addDays(cursor, tickStep);
    }
    return ticks;
}
function parseDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TypeError(`Invalid timeline date "${value}". Expected YYYY-MM-DD.`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (toDateOnly(date) !== value) {
        throw new TypeError(`Invalid timeline date "${value}".`);
    }
    return date;
}
function toDateOnly(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function addDays(date, amount) {
    return new Date(date.getTime() + amount * DAY_IN_MS);
}
function differenceInDays(start, end) {
    return Math.round((end.getTime() - start.getTime()) / DAY_IN_MS);
}
function firstDayOfNextMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
function formatTick(date, scale) {
    return new Intl.DateTimeFormat('en-US', {
        month: scale === 'month' ? 'long' : 'short',
        day: scale === 'month' ? undefined : 'numeric',
        timeZone: 'UTC',
    }).format(date);
}
function formatLongDate(value) {
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(parseDateOnly(value));
}
function isWithinRange(value, start, end) {
    return value >= start && value <= end;
}
function isItemVisible(item, start, end) {
    return item.endDate >= start && item.startDate <= end;
}
function minDate(left, right) {
    return left < right ? left : right;
}
function maxDate(left, right) {
    return left > right ? left : right;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
//# sourceMappingURL=Timeline.js.map