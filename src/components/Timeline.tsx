'use client';

import {CalendarDays} from 'lucide-react';
import {domMax, LazyMotion, m, useReducedMotion, type PanInfo} from 'motion/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {joinClassNames} from '../classnames.js';
import type {TimelineItem, TimelineScale} from '../model.js';

const DAY_IN_MS = 86_400_000;
const ROW_HEIGHT = 58;
const BAR_TOP_OFFSET = 14;
const SNAP_THRESHOLD_PX = 10;
const NOTE_ROW_HEIGHT = 20;
const NOTE_GROUP_GAP = 12;
const SCALE_ORDER: readonly TimelineScale[] = ['month', 'week', 'day'];
const SCALE_SETTINGS: Record<TimelineScale, {dayWidth: number; tickStep: number; label: string}> = {
  month: {dayWidth: 10, tickStep: 30, label: '月'},
  week: {dayWidth: 24, tickStep: 7, label: '周'},
  day: {dayWidth: 56, tickStep: 1, label: '日'},
};

export type TimelineChangeReason =
  | 'move'
  | 'resize-start'
  | 'resize-end'
  | 'keyboard'
  | 'create'
  | 'delete';

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

type TimelineTick = {
  date: string;
  label: string;
  offsetDays: number;
};

type TimelineNoteLayout = {
  item: TimelineItem;
  notes: string[];
  tickIndex: number;
  top: number;
};

type TimelineBarProps = {
  item: TimelineItem;
  rangeStart: string;
  rangeEnd: string;
  dayWidth: number;
  top: number;
  editable: boolean;
  deletable: boolean;
  selected: boolean;
  snapOffsets: readonly number[];
  onSelect: (item: TimelineItem) => void;
  onCommit: (item: TimelineItem, reason: TimelineChangeReason) => void;
  onDelete: (item: TimelineItem) => void;
  onSnapGuideChange: (offset?: number) => void;
};

type TimelineInteractionKind = 'move' | 'resize-start' | 'resize-end';

type TimelineInteraction = {
  kind: TimelineInteractionKind;
  deltaDays: number;
  guideOffset?: number;
};

export function Timeline({
  eyebrow = 'Journey highlights',
  title = 'Timeline',
  startDate,
  endDate,
  items,
  editable = false,
  scale,
  defaultScale = 'week',
  toolsLabel = '时间尺度',
  onItemSelect,
  onItemChange,
  onItemsChange,
  onItemCreate,
  onItemDelete,
  newItemTitle = '新阶段',
  newItemDurationDays = 7,
  onScaleChange,
  className,
  style,
  ...props
}: TimelineProps) {
  const rangeStart = parseDateOnly(startDate);
  const rangeEnd = parseDateOnly(endDate);
  const totalDays = differenceInDays(rangeStart, rangeEnd) + 1;

  if (totalDays < 1) {
    throw new RangeError('Timeline endDate must be on or after startDate.');
  }

  const [internalScale, setInternalScale] = useState<TimelineScale>(defaultScale);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [snapGuideOffset, setSnapGuideOffset] = useState<number>();
  const createdItemCounter = useRef(0);
  const activeScale = scale ?? internalScale;
  const settings = SCALE_SETTINGS[activeScale];
  const dayWidth = Math.max(settings.dayWidth, 920 / totalDays);
  const canvasWidth = Math.ceil(totalDays * dayWidth);
  const rowCount = Math.max(1, ...items.map((item, index) => (item.row ?? index) + 1));
  const trackHeight = rowCount * ROW_HEIGHT + 24;
  const notesTop = trackHeight + 42;
  const scrollRef = useRef<HTMLDivElement>(null);
  const canEdit = editable && Boolean(onItemChange || onItemsChange);
  const canCreate = editable && Boolean(onItemCreate || onItemsChange);
  const canDelete = editable && Boolean(onItemDelete || onItemsChange);

  const ticks = useMemo(
    () => createTicks(startDate, endDate, activeScale, settings.tickStep),
    [activeScale, endDate, settings.tickStep, startDate],
  );

  const notesLayout = createTimelineNotesLayout(
    items,
    startDate,
    endDate,
    rangeStart,
    totalDays,
    ticks,
  );
  const canvasHeight = notesTop + Math.max(64, notesLayout.height + 34);

  const snapOffsets = useMemo(() => {
    const offsets = new Set<number>([0, totalDays]);
    ticks.forEach((tick) => offsets.add(tick.offsetDays));
    items.forEach((item) => {
      const itemStart = differenceInDays(rangeStart, parseDateOnly(item.startDate));
      const itemEndBoundary = differenceInDays(rangeStart, parseDateOnly(item.endDate)) + 1;
      if (itemStart >= 0 && itemStart <= totalDays) offsets.add(itemStart);
      if (itemEndBoundary >= 0 && itemEndBoundary <= totalDays) offsets.add(itemEndBoundary);
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

  const selectScale = (nextScale: TimelineScale) => {
    if (nextScale === activeScale) return;
    if (scale === undefined) setInternalScale(nextScale);
    onScaleChange?.(nextScale);
  };

  const focusToday = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const target = todayOffset ?? 0;
    scroll.scrollTo({
      left: Math.max(0, target - scroll.clientWidth / 2),
      behavior: 'smooth',
    });
  };

  const selectItem = (item: TimelineItem) => {
    setSelectedItemId(item.id);
    onItemSelect?.(item);
  };

  const commitItem = (nextItem: TimelineItem, reason: TimelineChangeReason) => {
    const meta = {itemId: nextItem.id, reason};
    onItemChange?.(nextItem, meta);
    onItemsChange?.(
      items.map((item) => (item.id === nextItem.id ? nextItem : item)),
      meta,
    );
  };

  const deleteItem = (item: TimelineItem) => {
    if (!canDelete) return;
    const meta = {itemId: item.id, reason: 'delete' as const};
    onItemDelete?.(item, meta);
    onItemsChange?.(
      items.filter((candidate) => candidate.id !== item.id),
      meta,
    );
    setSelectedItemId(undefined);
    setSnapGuideOffset(undefined);
  };

  const createItem = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!canCreate) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.de-timeline__bar, .de-timeline__notes')) return;

    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const pointerY = event.clientY - bounds.top;
    if (pointerY < BAR_TOP_OFFSET || pointerY >= trackHeight) return;

    const rawOffset = clamp((event.clientX - bounds.left) / dayWidth, 0, totalDays - 1);
    const nearestSnapOffset = findNearestSnapOffset(rawOffset, snapOffsets, dayWidth);
    const startOffset = clamp(nearestSnapOffset ?? Math.round(rawOffset), 0, totalDays - 1);
    const requestedDuration = Math.max(1, Math.round(newItemDurationDays));
    const endOffset = Math.min(totalDays - 1, startOffset + requestedDuration - 1);
    const preferredRow = clamp(
      Math.floor((pointerY - BAR_TOP_OFFSET) / ROW_HEIGHT),
      0,
      Math.max(0, rowCount - 1),
    );
    const row = findAvailableRow(items, startOffset, endOffset, preferredRow, rangeStart);
    const item: TimelineItem = {
      id: `timeline-${Date.now().toString(36)}-${createdItemCounter.current++}`,
      title: newItemTitle,
      startDate: toDateOnly(addDays(rangeStart, startOffset)),
      endDate: toDateOnly(addDays(rangeStart, endOffset)),
      row,
    };
    const meta = {itemId: item.id, reason: 'create' as const};
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
  } as CSSProperties;

  return (
    <article
      className={joinClassNames('de-timeline', className)}
      style={{...rootStyle, ...style}}
      aria-label={`${title}，${formatLongDate(startDate)}至${formatLongDate(endDate)}`}
      {...props}
    >
      <header className="de-timeline__header">
        <div className="de-timeline__heading">
          <span className="de-timeline__eyebrow">{eyebrow}</span>
          <strong className="de-timeline__title">{title}</strong>
        </div>
        <div className="de-timeline__header-side">
          <span className="de-timeline__count" aria-label={`共 ${items.length} 个阶段`}>
            {String(items.length).padStart(2, '0')}/
          </span>
          <div className="de-timeline__tools" role="toolbar" aria-label="时间轴工具">
            <span>{toolsLabel}</span>
            <div className="de-timeline__scale-options" role="group" aria-label="选择时间尺度">
              {SCALE_ORDER.map((scaleOption) => {
                const label = SCALE_SETTINGS[scaleOption].label;
                return (
                  <button
                    key={scaleOption}
                    type="button"
                    aria-label={`按${label}查看`}
                    aria-pressed={activeScale === scaleOption}
                    title={`按${label}查看`}
                    onClick={() => selectScale(scaleOption)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="de-timeline__today-action"
              aria-label={todayOffset === undefined ? '回到时间轴起点' : '定位到今天'}
              title={todayOffset === undefined ? '回到起点' : '定位到今天'}
              onClick={focusToday}
            >
              <CalendarDays aria-hidden="true" size={15} strokeWidth={1.8} />
              <span>{todayOffset === undefined ? '起点' : '今天'}</span>
            </button>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="de-timeline__scroll" tabIndex={0} aria-label="可横向滚动的项目时间轴">
        <div
          className="de-timeline__canvas"
          data-creatable={canCreate ? 'true' : undefined}
          onDoubleClick={createItem}
        >
          {ticks.map((tick) => (
            <div
              key={tick.date}
              className="de-timeline__tick"
              style={{left: tick.offsetDays * dayWidth}}
              aria-hidden="true"
            >
              <span>{tick.label}</span>
            </div>
          ))}

          {todayOffset !== undefined ? (
            <div className="de-timeline__today" style={{left: todayOffset}} aria-hidden="true">
              <span>今天</span>
            </div>
          ) : null}

          {snapGuideOffset !== undefined ? (
            <div
              className="de-timeline__snap-guide"
              style={{left: snapGuideOffset * dayWidth}}
              aria-hidden="true"
            />
          ) : null}

          <LazyMotion features={domMax} strict>
            {items.map((item, index) => (
              <TimelineBar
                key={item.id}
                item={item}
                rangeStart={startDate}
                rangeEnd={endDate}
                dayWidth={dayWidth}
                top={(item.row ?? index) * ROW_HEIGHT + BAR_TOP_OFFSET}
                editable={canEdit && !item.locked}
                deletable={canDelete && !item.locked}
                selected={selectedItemId === item.id}
                snapOffsets={snapOffsets}
                onSelect={selectItem}
                onCommit={commitItem}
                onDelete={deleteItem}
                onSnapGuideChange={setSnapGuideOffset}
              />
            ))}
          </LazyMotion>

          <div className="de-timeline__axis" aria-hidden="true" />

          {notesLayout.entries.map(({item, notes, tickIndex, top}) => {
            const alignedTick = ticks[tickIndex];
            const nextTick = ticks[tickIndex + 1];
            const left = alignedTick.offsetDays * dayWidth;
            const availableWidth = ((nextTick?.offsetDays ?? totalDays) - alignedTick.offsetDays) * dayWidth;
            return (
              <ul
                key={`${item.id}-notes`}
                className="de-timeline__notes"
                style={{left, top: notesTop + top, width: clamp(availableWidth, 132, 260)}}
                aria-label={`${item.title}事项`}
              >
                {notes.map((note, noteIndex) => (
                  <li key={`${item.id}-note-${noteIndex}`} title={note}>
                    {note}
                  </li>
                ))}
              </ul>
            );
          })}
        </div>
      </div>
      {canEdit || canCreate || canDelete ? (
        <p className="de-timeline__hint">
          拖动阶段调整日期，拖动两端调整持续时间；双击空白处新增，单击阶段后按 Del 删除
        </p>
      ) : null}
    </article>
  );
}

function TimelineBar({
  item,
  rangeStart,
  rangeEnd,
  dayWidth,
  top,
  editable,
  deletable,
  selected,
  snapOffsets,
  onSelect,
  onCommit,
  onDelete,
  onSnapGuideChange,
}: TimelineBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [interaction, setInteraction] = useState<TimelineInteraction>();
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
  } else if (interaction?.kind === 'resize-start') {
    previewStart = addDays(start, interaction.deltaDays);
  } else if (interaction?.kind === 'resize-end') {
    previewEnd = addDays(end, interaction.deltaDays);
  }

  const visibleStart = maxDate(previewStart, rangeStartDate);
  const visibleEnd = minDate(previewEnd, rangeEndDate);

  if (visibleEnd.getTime() < visibleStart.getTime()) return null;

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

  const shiftItem = (deltaDays: number, reason: TimelineChangeReason) => {
    if (deltaDays === 0) return;
    const nextStart = addDays(start, deltaDays);
    const nextEnd = addDays(end, deltaDays);
    if (nextStart < rangeStartDate || nextEnd > rangeEndDate) return;
    onCommit(
      {...item, startDate: toDateOnly(nextStart), endDate: toDateOnly(nextEnd)},
      reason,
    );
  };

  const resizeStart = (deltaDays: number) => {
    if (deltaDays === 0) return;
    const nextStart = addDays(start, deltaDays);
    if (nextStart < rangeStartDate || nextStart > end) return;
    onCommit({...item, startDate: toDateOnly(nextStart)}, 'resize-start');
  };

  const resizeEnd = (deltaDays: number, reason: TimelineChangeReason = 'resize-end') => {
    if (deltaDays === 0) return;
    const nextEnd = addDays(end, deltaDays);
    if (nextEnd < start || nextEnd > rangeEndDate) return;
    onCommit({...item, endDate: toDateOnly(nextEnd)}, reason);
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && deletable && selected) {
      event.preventDefault();
      onDelete(item);
      return;
    }
    if (!editable || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const deltaDays = event.key === 'ArrowLeft' ? -1 : 1;
    if (event.shiftKey) resizeEnd(deltaDays, 'keyboard');
    else shiftItem(deltaDays, 'keyboard');
  };

  const resolveInteraction = (kind: TimelineInteractionKind, info: PanInfo) =>
    resolveTimelineInteraction({
      kind,
      offsetX: info.offset.x,
      dayWidth,
      startOffset,
      endBoundaryOffset,
      totalDays,
      snapOffsets,
    });

  const beginInteraction = (kind: TimelineInteractionKind) => {
    setInteraction({kind, deltaDays: 0});
    onSnapGuideChange(undefined);
  };

  const updateInteraction = (kind: TimelineInteractionKind, info: PanInfo) => {
    const nextInteraction = resolveInteraction(kind, info);
    setInteraction(nextInteraction);
    onSnapGuideChange(nextInteraction.guideOffset);
  };

  const finishInteraction = (kind: TimelineInteractionKind, info: PanInfo) => {
    const nextInteraction = resolveInteraction(kind, info);
    setInteraction(undefined);
    onSnapGuideChange(undefined);
    if (kind === 'move') shiftItem(nextInteraction.deltaDays, 'move');
    else if (kind === 'resize-start') resizeStart(nextInteraction.deltaDays);
    else resizeEnd(nextInteraction.deltaDays);
  };

  return (
    <m.div
      className="de-timeline__bar"
      data-editable={editable ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      data-interacting={interaction ? 'true' : undefined}
      style={{left, top, width}}
      animate={prefersReducedMotion ? undefined : {scale: interaction ? 1.015 : 1}}
      transition={{duration: 0.12, ease: [0.2, 0.8, 0.2, 1]}}
    >
      <m.button
        type="button"
        className="de-timeline__bar-body"
        aria-label={bodyLabel}
        aria-keyshortcuts={keyboardShortcuts}
        title={editable ? `${bodyLabel}。拖动可调整日期` : bodyLabel}
        onPointerDown={() => onSelect(item)}
        onKeyDown={handleKeyboard}
        onClick={(event) => {
          if (event.detail === 0) onSelect(item);
        }}
        onPanStart={editable ? () => beginInteraction('move') : undefined}
        onPan={editable ? (_event, info) => updateInteraction('move', info) : undefined}
        onPanEnd={editable ? (_event, info) => finishInteraction('move', info) : undefined}
      >
        <span>{item.title}</span>
        {item.meta ? <small>{item.meta}</small> : null}
      </m.button>

      {editable ? (
        <>
          <m.button
            type="button"
            className="de-timeline__resize de-timeline__resize--start"
            aria-label={`调整${item.title}的开始日期`}
            title="调整开始日期"
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onSelect(item);
            }}
            onClick={(event) => event.stopPropagation()}
            onPanStart={() => beginInteraction('resize-start')}
            onPan={(_event, info) => updateInteraction('resize-start', info)}
            onPanEnd={(_event, info) => finishInteraction('resize-start', info)}
          />
          <m.button
            type="button"
            className="de-timeline__resize de-timeline__resize--end"
            aria-label={`调整${item.title}的结束日期`}
            title="调整结束日期"
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onSelect(item);
            }}
            onClick={(event) => event.stopPropagation()}
            onPanStart={() => beginInteraction('resize-end')}
            onPan={(_event, info) => updateInteraction('resize-end', info)}
            onPanEnd={(_event, info) => finishInteraction('resize-end', info)}
          />
        </>
      ) : null}

    </m.div>
  );
}

function resolveTimelineInteraction({
  kind,
  offsetX,
  dayWidth,
  startOffset,
  endBoundaryOffset,
  totalDays,
  snapOffsets,
}: {
  kind: TimelineInteractionKind;
  offsetX: number;
  dayWidth: number;
  startOffset: number;
  endBoundaryOffset: number;
  totalDays: number;
  snapOffsets: readonly number[];
}): TimelineInteraction {
  const durationDays = endBoundaryOffset - startOffset;
  const rawDeltaDays = offsetX / dayWidth;
  let minimumDelta: number;
  let maximumDelta: number;
  let movingEdges: number[];

  if (kind === 'move') {
    minimumDelta = -startOffset;
    maximumDelta = totalDays - endBoundaryOffset;
    movingEdges = [startOffset, endBoundaryOffset];
  } else if (kind === 'resize-start') {
    minimumDelta = -startOffset;
    maximumDelta = durationDays - 1;
    movingEdges = [startOffset];
  } else {
    minimumDelta = -(durationDays - 1);
    maximumDelta = totalDays - endBoundaryOffset;
    movingEdges = [endBoundaryOffset];
  }

  const roundedDelta = clamp(Math.round(rawDeltaDays), minimumDelta, maximumDelta);
  let snappedDelta = roundedDelta;
  let guideOffset: number | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const edge of movingEdges) {
    for (const snapOffset of snapOffsets) {
      const candidateDelta = snapOffset - edge;
      if (candidateDelta < minimumDelta || candidateDelta > maximumDelta) continue;
      const distance = Math.abs(candidateDelta - rawDeltaDays) * dayWidth;
      if (distance <= SNAP_THRESHOLD_PX && distance < closestDistance) {
        closestDistance = distance;
        snappedDelta = candidateDelta;
        guideOffset = snapOffset;
      }
    }
  }

  return {kind, deltaDays: snappedDelta, guideOffset};
}

function findNearestSnapOffset(
  rawOffset: number,
  snapOffsets: readonly number[],
  dayWidth: number,
): number | undefined {
  let nearestOffset: number | undefined;
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

function findNearestTickIndex(offset: number, ticks: readonly TimelineTick[]): number {
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

function createTimelineNotesLayout(
  items: readonly TimelineItem[],
  startDate: string,
  endDate: string,
  rangeStart: Date,
  totalDays: number,
  ticks: readonly TimelineTick[],
): {entries: TimelineNoteLayout[]; height: number} {
  const stackHeights = new Map<number, number>();
  const entries: TimelineNoteLayout[] = [];
  let height = 0;

  for (const item of items) {
    const notes = item.notes;
    if (!notes?.length || !isItemVisible(item, startDate, endDate)) continue;

    const itemStartOffset = clamp(
      differenceInDays(rangeStart, parseDateOnly(item.startDate)),
      0,
      totalDays - 1,
    );
    const tickIndex = findNearestTickIndex(itemStartOffset, ticks);
    const top = stackHeights.get(tickIndex) ?? 0;
    const blockHeight = Math.max(NOTE_ROW_HEIGHT, notes.length * NOTE_ROW_HEIGHT);
    stackHeights.set(tickIndex, top + blockHeight + NOTE_GROUP_GAP);
    height = Math.max(height, top + blockHeight);
    entries.push({item, notes, tickIndex, top});
  }

  return {entries, height};
}

function findAvailableRow(
  items: readonly TimelineItem[],
  startOffset: number,
  endOffset: number,
  preferredRow: number,
  rangeStart: Date,
): number {
  const maxExistingRow = Math.max(0, ...items.map((item, index) => item.row ?? index));
  const candidateRows = [
    ...Array.from({length: maxExistingRow - preferredRow + 2}, (_, index) => preferredRow + index),
    ...Array.from({length: preferredRow}, (_, index) => index),
  ];

  for (const row of candidateRows) {
    const overlaps = items.some((item, index) => {
      if ((item.row ?? index) !== row) return false;
      const itemStart = differenceInDays(rangeStart, parseDateOnly(item.startDate));
      const itemEnd = differenceInDays(rangeStart, parseDateOnly(item.endDate));
      return startOffset <= itemEnd && endOffset >= itemStart;
    });
    if (!overlaps) return row;
  }

  return maxExistingRow + 1;
}

function createTicks(
  startDate: string,
  endDate: string,
  scale: TimelineScale,
  tickStep: number,
): TimelineTick[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const ticks: TimelineTick[] = [];
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

function parseDateOnly(value: string): Date {
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

function toDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * DAY_IN_MS);
}

function differenceInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_IN_MS);
}

function firstDayOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function formatTick(date: Date, scale: TimelineScale): string {
  return new Intl.DateTimeFormat('en-US', {
    month: scale === 'month' ? 'long' : 'short',
    day: scale === 'month' ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateOnly(value));
}

function isWithinRange(value: string, start: string, end: string): boolean {
  return value >= start && value <= end;
}

function isItemVisible(item: TimelineItem, start: string, end: string): boolean {
  return item.endDate >= start && item.startDate <= end;
}

function minDate(left: Date, right: Date): Date {
  return left < right ? left : right;
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
