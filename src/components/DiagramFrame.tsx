'use client';

import {
  ChevronDown,
  Eye,
  Hand,
  HelpCircle,
  Maximize2,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Workflow,
  X,
} from 'lucide-react';
import {AnimatePresence, domMax, LazyMotion, m, useReducedMotion} from 'motion/react';
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {joinClassNames} from '../classnames.js';
import {
  MermaidFlowchart,
  type DiagramConnectRequest,
  type DiagramConnectionDropRequest,
  type DiagramBoardLayout,
  type DiagramCreatedEdge,
  type DiagramCreatedNode,
  type DiagramEdgeRouteChange,
  type DiagramEdgeRoutePatch,
  type DiagramNodeChange,
  type DiagramNodePatch,
  type DiagramNodePosition,
  type DiagramNodeShape,
  type MermaidEditRequest,
} from './MermaidFlowchart.js';

export type {
  DiagramAnchorSide,
  DiagramBoardEdgeLayout,
  DiagramBoardLayout,
  DiagramBoardNodeLayout,
  DiagramCreatedEdge,
  DiagramCreatedNode,
  DiagramEdgeRouteChange,
  DiagramEdgeRoutePatch,
  DiagramNodeChange,
  DiagramNodeChangeReason,
  DiagramNodeShape,
  DiagramNodeTone,
  DiagramNodePosition,
} from './MermaidFlowchart.js';

export type DiagramBoardMode = 'view' | 'edit';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.2;
const QUICK_SHAPES: Array<{label: string; shape: DiagramNodeShape}> = [
  {label: '圆角矩形', shape: 'round'},
  {label: '矩形', shape: 'rect'},
  {label: '全圆角矩形', shape: 'stadium'},
  {label: '圆形', shape: 'circle'},
  {label: '菱形', shape: 'diamond'},
];
let boardElementSequence = 0;

type BoardViewport = {
  x: number;
  y: number;
  scale: number;
};

type ContentBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type BoardTool = 'select' | 'hand';

type PanSession = {
  lastX: number;
  lastY: number;
  pointerId: number;
};

type MarqueeSession = {
  additive: boolean;
  originX: number;
  originY: number;
  pointerId: number;
  selectionStart: string[];
};

type MarqueeRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type MediaTransform = {
  scale: number;
  x: number;
  y: number;
};

type MediaDragSession = {
  basis: number;
  mode: 'move' | 'scale';
  pointerId: number;
  pointerStart: {x: number; y: number};
  transformStart: MediaTransform;
};

type NodeEditorState = {
  fontSize: number;
  height: number;
  label: string;
  left: number;
  nodeId: string;
  placeholder?: boolean;
  position: DiagramNodePosition;
  top: number;
  width: number;
};

type ShapePickerState = DiagramConnectionDropRequest & {
  left: number;
  placement: 'left' | 'right';
  top: number;
};

export type DiagramStructureChange =
  | {edge: DiagramCreatedEdge; reason: 'create-edge'}
  | {edge: DiagramCreatedEdge; node: DiagramCreatedNode; reason: 'create-node-and-edge'}
  | {edgeId: string; reason: 'update-edge-route'; route: DiagramEdgeRoutePatch};

export type DiagramMediaTransform = {
  position: DiagramNodePosition;
  scale: number;
};

export type DiagramMediaChange = DiagramMediaTransform & {
  reason: 'position' | 'scale';
};

export type DiagramFrameProps = HTMLAttributes<HTMLElement> & {
  /** Optional authored geometry for a Mermaid Board; preserves a designed diagram's initial layout. */
  boardLayout?: DiagramBoardLayout;
  /** Enable full-screen Board editing. Mermaid adds semantic node/edge editing; media adds move/scale. */
  editable?: boolean;
  /** Show an optional dotted grid in the inline and full-screen canvas. */
  grid?: boolean;
  /** Mode used when the board opens. Edit mode falls back to view when editable is false. */
  initialMode?: DiagramBoardMode;
  /** Mermaid 11 flowchart source parsed into the native Board renderer. */
  mermaidSource?: string;
  /** Optional host-owned transform for a non-Mermaid image or SVG placed on the Board. */
  mediaTransform?: Partial<DiagramMediaTransform>;
  /** Receive local Mermaid edits so the host can persist them to its source of truth. */
  onDiagramChange?: (change: DiagramNodeChange) => void;
  /** Receive position and scale changes for a non-Mermaid image or SVG placed on the Board. */
  onDiagramMediaChange?: (change: DiagramMediaChange) => void;
  /** Receive edges and nodes created from the native Board connection handles. */
  onDiagramStructureChange?: (change: DiagramStructureChange) => void;
  /** Disable the shared full-screen viewer for a diagram that owns its own interaction. */
  zoomable?: boolean;
  /** Accessible title shown in the full-screen viewer. Falls back to aria-label. */
  viewerTitle?: string;
};

export function DiagramFrame({
  className,
  children,
  boardLayout,
  editable = false,
  grid = false,
  initialMode,
  mermaidSource,
  mediaTransform: mediaTransformValue,
  zoomable = true,
  viewerTitle,
  onClick,
  onDoubleClick,
  onKeyDown,
  onDiagramChange,
  onDiagramMediaChange,
  onDiagramStructureChange,
  ...props
}: DiagramFrameProps) {
  const canEdit = editable;
  const dialogId = useId();
  const inlineFigureRef = useRef<HTMLElement>(null);
  const inlineCanvasRef = useRef<HTMLDivElement>(null);
  const viewerFigureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editorInputRef = useRef<HTMLTextAreaElement>(null);
  const mediaItemRef = useRef<HTMLDivElement>(null);
  const nodePatchesRef = useRef(new Map<string, DiagramNodePatch>());
  const edgePatchesRef = useRef(new Map<string, DiagramEdgeRoutePatch>());
  const createdNodesRef = useRef<DiagramCreatedNode[]>([]);
  const createdEdgesRef = useRef<DiagramCreatedEdge[]>([]);
  const viewportRef = useRef<BoardViewport>({x: 0, y: 0, scale: 1});
  const inlineViewportRef = useRef<BoardViewport>({x: 0, y: 0, scale: 1});
  const panSessionRef = useRef<PanSession | null>(null);
  const marqueeSessionRef = useRef<MarqueeSession | null>(null);
  const spacePressedRef = useRef(false);
  const boardToolRef = useRef<BoardTool>(canEdit ? 'select' : 'hand');
  const hasFittedRef = useRef(false);
  const mediaDragRef = useRef<MediaDragSession | null>(null);
  const mediaTransformRef = useRef<MediaTransform>(resolveMediaTransform(mediaTransformValue));
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const [viewport, setViewport] = useState<BoardViewport>(viewportRef.current);
  const [inlineViewport, setInlineViewport] = useState<BoardViewport>(inlineViewportRef.current);
  const [boardMode, setBoardMode] = useState<DiagramBoardMode>(
    canEdit && initialMode !== 'view' ? 'edit' : 'view',
  );
  const [boardTool, setBoardToolState] = useState<BoardTool>(canEdit ? 'select' : 'hand');
  const [diagramRevision, setDiagramRevision] = useState(0);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [mediaSelected, setMediaSelected] = useState(false);
  const [mediaTransform, setMediaTransform] = useState<MediaTransform>(mediaTransformRef.current);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editor, setEditor] = useState<NodeEditorState | null>(null);
  const [shapePicker, setShapePicker] = useState<ShapePickerState | null>(null);
  const accessibleTitle =
    viewerTitle ?? (typeof props['aria-label'] === 'string' ? props['aria-label'] : '图表预览');

  const updateViewport = useCallback(
    (update: BoardViewport | ((current: BoardViewport) => BoardViewport)) => {
      setViewport((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        viewportRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateInlineViewport = useCallback(
    (update: BoardViewport | ((current: BoardViewport) => BoardViewport)) => {
      setInlineViewport((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        inlineViewportRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateMediaTransform = useCallback(
    (update: MediaTransform | ((current: MediaTransform) => MediaTransform)) => {
      setMediaTransform((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        mediaTransformRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!mediaTransformValue) return;
    updateMediaTransform(resolveMediaTransform(mediaTransformValue, mediaTransformRef.current));
  }, [
    mediaTransformValue?.position?.x,
    mediaTransformValue?.position?.y,
    mediaTransformValue?.scale,
    updateMediaTransform,
  ]);

  const setBoardTool = useCallback((tool: BoardTool) => {
    boardToolRef.current = tool;
    setBoardToolState(tool);
    if (tool === 'hand') {
      marqueeSessionRef.current = null;
      setMarqueeRect(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setMediaSelected(false);
      setShapePicker(null);
    }
  }, []);

  const measureContentBounds = useCallback((): ContentBounds | null => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return null;
    const diagramElements = Array.from(
      stage.querySelectorAll<Element>(
        'svg .de-board-flowchart__node, svg .de-board-flowchart__edge-label, svg .node, svg .edgeLabel',
      ),
    );
    const candidates =
      diagramElements.length > 0
        ? diagramElements
        : Array.from(stage.querySelectorAll<Element>('.de-diagram-media-item, img, svg'));
    const rects = candidates
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 || rect.height > 0);
    if (rects.length === 0) {
      return {height: stage.offsetHeight, left: 0, top: 0, width: stage.offsetWidth};
    }

    const canvasRect = canvas.getBoundingClientRect();
    const current = viewportRef.current;
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return {
      left: (left - canvasRect.left - current.x) / current.scale,
      top: (top - canvasRect.top - current.y) / current.scale,
      width: (right - left) / current.scale,
      height: (bottom - top) / current.scale,
    };
  }, []);

  const centerAtScale = useCallback(
    (scale: number) => {
      const canvas = canvasRef.current;
      const bounds = measureContentBounds();
      if (!canvas || !bounds) return;
      updateViewport({
        x: (canvas.clientWidth - bounds.width * scale) / 2 - bounds.left * scale,
        y: (canvas.clientHeight - bounds.height * scale) / 2 - bounds.top * scale,
        scale,
      });
    },
    [measureContentBounds, updateViewport],
  );

  const fitView = useCallback(() => {
    const canvas = canvasRef.current;
    const bounds = measureContentBounds();
    if (!canvas || !bounds || bounds.width < 2 || bounds.height < 2) return;
    const horizontalPadding = Math.min(260, Math.max(96, canvas.clientWidth * 0.18));
    const verticalPadding = Math.min(176, Math.max(96, canvas.clientHeight * 0.18));
    const scale = clamp(
      Math.min(
        (canvas.clientWidth - horizontalPadding) / bounds.width,
        (canvas.clientHeight - verticalPadding) / bounds.height,
        1.2,
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    updateViewport({
      x: (canvas.clientWidth - bounds.width * scale) / 2 - bounds.left * scale,
      y: (canvas.clientHeight - bounds.height * scale) / 2 - bounds.top * scale,
      scale,
    });
    hasFittedRef.current = true;
  }, [measureContentBounds, updateViewport]);

  const zoomAt = useCallback(
    (nextScale: number, clientX?: number, clientY?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const current = viewportRef.current;
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      const rect = canvas.getBoundingClientRect();
      const pointX = clientX === undefined ? rect.width / 2 : clientX - rect.left;
      const pointY = clientY === undefined ? rect.height / 2 : clientY - rect.top;
      const contentX = (pointX - current.x) / current.scale;
      const contentY = (pointY - current.y) / current.scale;
      updateViewport({
        x: pointX - contentX * scale,
        y: pointY - contentY * scale,
        scale,
      });
    },
    [updateViewport],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      zoomAt(viewportRef.current.scale * factor);
    },
    [zoomAt],
  );

  const closeViewer = useCallback(() => {
    marqueeSessionRef.current = null;
    setMarqueeRect(null);
    setEditor(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setMediaSelected(false);
    setShapePicker(null);
    setModeMenuOpen(false);
    setZoomMenuOpen(false);
    setHelpOpen(false);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openViewer = useCallback(
    (requestedMode?: DiagramBoardMode) => {
      if (!zoomable) return;
      const fallbackMode = canEdit && initialMode !== 'view' ? 'edit' : 'view';
      setBoardMode(canEdit ? (requestedMode ?? fallbackMode) : 'view');
      setBoardTool(canEdit ? 'select' : 'hand');
      marqueeSessionRef.current = null;
      setMarqueeRect(null);
      setPlaceholderHeight(inlineFigureRef.current?.getBoundingClientRect().height ?? 0);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setMediaSelected(false);
      setShapePicker(null);
      hasFittedRef.current = false;
      updateViewport({x: 0, y: 0, scale: 1});
      setOpen(true);
    },
    [canEdit, initialMode, setBoardTool, updateViewport, zoomable],
  );

  const handleEditRequest = useCallback((request: MermaidEditRequest) => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const scale = viewportRef.current.scale;
    setEditor({
      fontSize: request.fontSize / scale,
      nodeId: request.nodeId,
      label: request.label,
      placeholder: request.placeholder,
      position: request.position,
      left: (request.rect.left - stageRect.left) / scale,
      top: (request.rect.top - stageRect.top) / scale,
      width: request.rect.width / scale,
      height: request.rect.height / scale,
    });
  }, []);

  const handleSelectNode = useCallback((nodeId: string | null, additive = false) => {
    setSelectedNodeIds((current) => {
      if (!nodeId) return [];
      if (current.includes(nodeId)) return current;
      return additive ? [...current, nodeId] : [nodeId];
    });
    if (nodeId) {
      setSelectedEdgeId(null);
      setMediaSelected(false);
      setShapePicker(null);
    }
  }, []);

  const handleSelectEdge = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) {
      setSelectedNodeIds([]);
      setMediaSelected(false);
      setShapePicker(null);
    }
  }, []);

  const handleConnect = useCallback(
    (request: DiagramConnectRequest) => {
      const edge: DiagramCreatedEdge = {...request, id: createBoardElementId('edge')};
      createdEdgesRef.current = [...createdEdgesRef.current, edge];
      setDiagramRevision((current) => current + 1);
      onDiagramStructureChange?.({edge, reason: 'create-edge'});
    },
    [onDiagramStructureChange],
  );

  const handleEdgeRouteChange = useCallback(
    (change: DiagramEdgeRouteChange) => {
      edgePatchesRef.current.set(change.edgeId, change.route);
      setDiagramRevision((current) => current + 1);
      onDiagramStructureChange?.({
        edgeId: change.edgeId,
        reason: 'update-edge-route',
        route: change.route,
      });
    },
    [onDiagramStructureChange],
  );

  const handleConnectionDrop = useCallback((request: DiagramConnectionDropRequest) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    setEditor(null);
    setShapePicker({
      ...request,
      left: request.clientX - canvasRect.left,
      placement: request.clientX > canvasRect.right - 300 ? 'left' : 'right',
      top: request.clientY - canvasRect.top,
    });
  }, []);

  const createConnectedShape = useCallback(
    (shape: DiagramNodeShape) => {
      if (!shapePicker) return;
      const node: DiagramCreatedNode = {
        id: createBoardElementId('node'),
        label: '输入文本',
        placeholder: true,
        position: shapePicker.position,
        shape,
        tone: shapePicker.tone,
      };
      const edge: DiagramCreatedEdge = {
        id: createBoardElementId('edge'),
        sourceId: shapePicker.sourceId,
        sourceSide: shapePicker.sourceSide,
        targetId: node.id,
        targetSide: shapePicker.targetSide,
      };
      createdNodesRef.current = [...createdNodesRef.current, node];
      createdEdgesRef.current = [...createdEdgesRef.current, edge];
      nodePatchesRef.current.set(node.id, {position: node.position});
      setSelectedNodeIds([node.id]);
      setSelectedEdgeId(null);
      setMediaSelected(false);
      setShapePicker(null);
      setDiagramRevision((current) => current + 1);
      onDiagramStructureChange?.({edge, node, reason: 'create-node-and-edge'});
    },
    [onDiagramStructureChange, shapePicker],
  );

  const commitEditor = useCallback(() => {
    if (!editor) return;
    const label = editor.label.trim();
    if (!label) {
      setEditor(null);
      return;
    }
    const previous = nodePatchesRef.current.get(editor.nodeId);
    const position = previous?.position ?? editor.position;
    nodePatchesRef.current.set(editor.nodeId, {...previous, label});
    setDiagramRevision((current) => current + 1);
    onDiagramChange?.({
      nodeId: editor.nodeId,
      label,
      position,
      reason: 'label',
    });
    setEditor(null);
  }, [editor, onDiagramChange]);

  const cancelEditor = useCallback(() => {
    setEditor(null);
  }, []);

  const handleDiagramNodeChange = useCallback(
    (change: DiagramNodeChange) => {
      const previous = nodePatchesRef.current.get(change.nodeId);
      nodePatchesRef.current.set(change.nodeId, {
        ...previous,
        ...(change.reason === 'label' ? {label: change.label} : null),
        ...(change.reason === 'position' ? {position: change.position} : null),
      });
      setDiagramRevision((current) => current + 1);
      onDiagramChange?.(change);
    },
    [onDiagramChange],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const frame = requestAnimationFrame(() => {
      const input = editorInputRef.current;
      input?.focus();
      if (editor.placeholder) input?.select();
      else input?.setSelectionRange(input.value.length, input.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, [editor?.nodeId]);

  useEffect(() => {
    if (boardMode === 'edit') return;
    setEditor(null);
    marqueeSessionRef.current = null;
    setMarqueeRect(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setMediaSelected(false);
    setShapePicker(null);
  }, [boardMode]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.target instanceof Element && event.target.closest('.de-diagram-node-editor')) return;
        if (modeMenuOpen || zoomMenuOpen || helpOpen || shapePicker) {
          event.preventDefault();
          setModeMenuOpen(false);
          setZoomMenuOpen(false);
          setHelpOpen(false);
          setShapePicker(null);
          return;
        }
        event.preventDefault();
        closeViewer();
        return;
      }

      if (event.key === 'Tab') {
        trapDialogFocus(event, dialogRef.current);
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        spacePressedRef.current = true;
        setSpacePressed(true);
        return;
      }
      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setBoardTool(boardToolRef.current === 'hand' ? 'select' : 'hand');
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomBy(ZOOM_FACTOR);
      } else if (event.key === '-') {
        event.preventDefault();
        zoomBy(1 / ZOOM_FACTOR);
      } else if (event.key === '0' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        centerAtScale(1);
      } else if (event.key === '1' && event.shiftKey) {
        event.preventDefault();
        fitView();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spacePressedRef.current = false;
      panSessionRef.current = null;
      setSpacePressed(false);
      setIsPanning(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      spacePressedRef.current = false;
      panSessionRef.current = null;
    };
  }, [
    centerAtScale,
    closeViewer,
    fitView,
    helpOpen,
    modeMenuOpen,
    open,
    setBoardTool,
    shapePicker,
    zoomBy,
    zoomMenuOpen,
  ]);

  useEffect(() => {
    if (!open) return;
    let firstFrame = requestAnimationFrame(() => {
      firstFrame = requestAnimationFrame(fitView);
    });
    const stage = stageRef.current;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (!hasFittedRef.current) fitView();
          });
    if (stage) observer?.observe(stage);
    return () => {
      cancelAnimationFrame(firstFrame);
      observer?.disconnect();
    };
  }, [fitView, open]);

  const handleFigureClick = (event: ReactMouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !zoomable) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input, select, textarea')) return;
    openViewer(canEdit ? 'edit' : 'view');
  };

  const handleFigureDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    onDoubleClick?.(event);
    if (event.defaultPrevented || !zoomable) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input, select, textarea')) return;
    event.preventDefault();
    openViewer(canEdit ? 'edit' : 'view');
  };

  const handleFigureKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !zoomable) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      openViewer(canEdit ? 'edit' : 'view');
    }
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    setZoomMenuOpen(false);
    if (event.ctrlKey || event.metaKey) {
      zoomAt(
        viewportRef.current.scale * Math.exp(-event.deltaY * 0.0025),
        event.clientX,
        event.clientY,
      );
      return;
    }
    updateViewport((current) => ({
      ...current,
      x: current.x - (event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX),
      y: current.y - (event.shiftKey ? 0 : event.deltaY),
    }));
  }, [updateViewport, zoomAt]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, {passive: false});
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel, open]);

  const handleInlineWheel = useCallback(
    (event: WheelEvent) => {
      if (!zoomable) return;
      event.preventDefault();
      const canvas = inlineCanvasRef.current;
      if (!canvas) return;
      if (event.ctrlKey || event.metaKey) {
        const current = inlineViewportRef.current;
        const rect = canvas.getBoundingClientRect();
        const pointX = event.clientX - rect.left;
        const pointY = event.clientY - rect.top;
        const scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0025), MIN_ZOOM, MAX_ZOOM);
        const contentX = (pointX - current.x) / current.scale;
        const contentY = (pointY - current.y) / current.scale;
        updateInlineViewport({
          x: pointX - contentX * scale,
          y: pointY - contentY * scale,
          scale,
        });
        return;
      }
      updateInlineViewport((current) => ({
        ...current,
        x: current.x - (event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX),
        y: current.y - (event.shiftKey ? 0 : event.deltaY),
      }));
    },
    [updateInlineViewport, zoomable],
  );

  useEffect(() => {
    if (open || !zoomable) return;
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleInlineWheel, {passive: false});
    return () => canvas.removeEventListener('wheel', handleInlineWheel);
  }, [handleInlineWheel, open, zoomable]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    setModeMenuOpen(false);
    setZoomMenuOpen(false);
    setHelpOpen(false);
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, a, input, textarea, [role="menu"]')) return;
    const interactiveElement = target?.closest(
      '[data-de-node-id], [data-de-edge-id], [data-de-media-item]',
    );
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const canStartMarquee =
      event.button === 0 &&
      canEdit &&
      boardMode === 'edit' &&
      Boolean(mermaidSource) &&
      boardToolRef.current === 'select' &&
      !spacePressedRef.current &&
      !interactiveElement;

    if (canStartMarquee) {
      event.preventDefault();
      const canvasRect = event.currentTarget.getBoundingClientRect();
      const originX = clamp(event.clientX - canvasRect.left, 0, canvasRect.width);
      const originY = clamp(event.clientY - canvasRect.top, 0, canvasRect.height);
      event.currentTarget.setPointerCapture(event.pointerId);
      marqueeSessionRef.current = {
        additive,
        originX,
        originY,
        pointerId: event.pointerId,
        selectionStart: [...selectedNodeIds],
      };
      if (!additive) setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setMediaSelected(false);
      setShapePicker(null);
      setEditor(null);
      setMarqueeRect({height: 0, left: originX, top: originY, width: 0});
      return;
    }

    if (!interactiveElement) {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setMediaSelected(false);
      setShapePicker(null);
    }

    const shouldPan =
      event.button === 2 ||
      (event.button === 0 &&
        (boardToolRef.current === 'hand' ||
          spacePressedRef.current ||
          (!mermaidSource && !interactiveElement)));
    if (!shouldPan) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
    };
    setIsPanning(true);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const marqueeSession = marqueeSessionRef.current;
    if (marqueeSession?.pointerId === event.pointerId) {
      const canvasRect = event.currentTarget.getBoundingClientRect();
      const currentX = clamp(event.clientX - canvasRect.left, 0, canvasRect.width);
      const currentY = clamp(event.clientY - canvasRect.top, 0, canvasRect.height);
      setMarqueeRect(rectFromPoints(marqueeSession.originX, marqueeSession.originY, currentX, currentY));
      return;
    }
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - session.lastX;
    const deltaY = event.clientY - session.lastY;
    session.lastX = event.clientX;
    session.lastY = event.clientY;
    updateViewport((current) => ({...current, x: current.x + deltaX, y: current.y + deltaY}));
  };

  const finishCanvasInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const marqueeSession = marqueeSessionRef.current;
    if (marqueeSession?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const canvasRect = event.currentTarget.getBoundingClientRect();
      const currentX = clamp(event.clientX - canvasRect.left, 0, canvasRect.width);
      const currentY = clamp(event.clientY - canvasRect.top, 0, canvasRect.height);
      const selectionRect = rectFromPoints(
        marqueeSession.originX,
        marqueeSession.originY,
        currentX,
        currentY,
      );
      if (cancelled) {
        setSelectedNodeIds(marqueeSession.selectionStart);
      } else if (selectionRect.width >= 3 || selectionRect.height >= 3) {
        const screenSelection = {
          bottom: canvasRect.top + selectionRect.top + selectionRect.height,
          left: canvasRect.left + selectionRect.left,
          right: canvasRect.left + selectionRect.left + selectionRect.width,
          top: canvasRect.top + selectionRect.top,
        };
        const selectedByMarquee = Array.from(
          event.currentTarget.querySelectorAll<SVGGElement>('[data-de-node-id]'),
        )
          .filter((element) => rectanglesIntersect(screenSelection, element.getBoundingClientRect()))
          .map((element) => element.dataset.deNodeId)
          .filter((nodeId): nodeId is string => Boolean(nodeId));
        setSelectedNodeIds(
          marqueeSession.additive
            ? [...new Set([...marqueeSession.selectionStart, ...selectedByMarquee])]
            : selectedByMarquee,
        );
      }
      marqueeSessionRef.current = null;
      setMarqueeRect(null);
      return;
    }

    if (panSessionRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panSessionRef.current = null;
    setIsPanning(false);
  };

  const beginMediaInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    mode: MediaDragSession['mode'],
  ) => {
    if (!canEdit || boardMode !== 'edit' || boardToolRef.current !== 'select' || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = mediaItemRef.current?.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    mediaDragRef.current = {
      basis: Math.max(180, Math.min(rect?.width ?? 180, rect?.height ?? 180)),
      mode,
      pointerId: event.pointerId,
      pointerStart: {x: event.clientX, y: event.clientY},
      transformStart: {...mediaTransformRef.current},
    };
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setMediaSelected(true);
  };

  const moveMediaInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const session = mediaDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const scale = viewportRef.current.scale;
    const deltaX = (event.clientX - session.pointerStart.x) / scale;
    const deltaY = (event.clientY - session.pointerStart.y) / scale;
    if (session.mode === 'move') {
      updateMediaTransform({...session.transformStart, x: session.transformStart.x + deltaX, y: session.transformStart.y + deltaY});
      return;
    }
    const factor = 1 + (deltaX + deltaY) / session.basis;
    updateMediaTransform({...session.transformStart, scale: clamp(session.transformStart.scale * factor, 0.2, 4)});
  };

  const finishMediaInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const session = mediaDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mediaDragRef.current = null;
    const transform = mediaTransformRef.current;
    onDiagramMediaChange?.({
      position: {x: transform.x, y: transform.y},
      reason: session.mode === 'move' ? 'position' : 'scale',
      scale: transform.scale,
    });
  };

  const cancelMediaInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    if (mediaDragRef.current?.pointerId !== event.pointerId) return;
    mediaDragRef.current = null;
  };

  const editModeActive = canEdit && boardMode === 'edit';
  const canvasPanActive = boardTool === 'hand' || spacePressed;

  const inlineFigure = (
    <figure
      ref={inlineFigureRef}
      className={joinClassNames('de-diagram', className)}
      data-editable={canEdit ? 'true' : undefined}
      data-grid={grid ? 'true' : undefined}
      data-zoomable={zoomable ? 'true' : undefined}
      tabIndex={zoomable ? 0 : undefined}
      onClick={handleFigureClick}
      onDoubleClick={handleFigureDoubleClick}
      onKeyDown={handleFigureKeyDown}
      {...props}
    >
      {zoomable ? (
        <div className="de-diagram-inline-toolbar" aria-label="画板操作">
          <button
            ref={triggerRef}
            type="button"
            className="de-diagram-inline-entry"
            aria-label={`${canEdit ? '编辑' : '查看'}画板：${accessibleTitle}`}
            onClick={(event) => {
              event.stopPropagation();
              openViewer(canEdit ? 'edit' : 'view');
            }}
          >
            {canEdit ? (
              <PenLine aria-hidden="true" size={18} strokeWidth={1.9} />
            ) : (
              <Eye aria-hidden="true" size={18} strokeWidth={1.9} />
            )}
            <span>{canEdit ? '编辑' : '查看'}</span>
          </button>
          <span className="de-diagram-inline-divider" aria-hidden="true" />
          <button
            type="button"
            aria-label={`全屏打开画板：${accessibleTitle}`}
            title="全屏打开"
            onClick={(event) => {
              event.stopPropagation();
              openViewer(canEdit ? 'edit' : 'view');
            }}
          >
            <Maximize2 aria-hidden="true" size={18} strokeWidth={1.9} />
          </button>
        </div>
      ) : null}
      <div ref={inlineCanvasRef} className="de-diagram-inline-canvas">
        <div
          className="de-diagram-inline-stage"
          style={{
            transform: `translate3d(${inlineViewport.x}px, ${inlineViewport.y}px, 0) scale(${inlineViewport.scale})`,
          }}
        >
          {mermaidSource ? (
            <MermaidFlowchart
              accessibleLabel={accessibleTitle}
              boardLayout={boardLayout}
              createdEdges={createdEdgesRef.current}
              createdNodes={createdNodesRef.current}
              edgePatches={edgePatchesRef.current}
              editable={false}
              fitPatchedBounds
              panActive={false}
              patches={nodePatchesRef.current}
              revision={diagramRevision}
              source={mermaidSource}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </figure>
  );

  const canvasStyle = {
    '--de-diagram-grid-size': `${22 * viewport.scale}px`,
    '--de-diagram-grid-x': `${viewport.x}px`,
    '--de-diagram-grid-y': `${viewport.y}px`,
  } as CSSProperties;

  return (
    <>
      {open ? (
        <div
          className="de-diagram-placeholder"
          style={placeholderHeight > 0 ? {height: placeholderHeight} : undefined}
          aria-hidden="true"
        />
      ) : (
        inlineFigure
      )}

      {mounted
        ? createPortal(
            <LazyMotion features={domMax} strict>
              <AnimatePresence>
                {open ? (
                  <m.div
                    key="diagram-board"
                    className="de-root de-prose de-diagram-viewer-overlay"
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                    transition={{duration: prefersReducedMotion ? 0 : 0.14}}
                  >
                    <m.section
                      ref={dialogRef}
                      className="de-diagram-viewer-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby={`${dialogId}-title`}
                      initial={{opacity: 0}}
                      animate={{opacity: 1}}
                      exit={{opacity: 0}}
                      transition={{duration: prefersReducedMotion ? 0 : 0.16}}
                    >
                      <h2 id={`${dialogId}-title`} className="de-diagram-a11y-title">
                        {accessibleTitle}
                      </h2>

                      <div className="de-diagram-board-brand de-diagram-board-float">
                        <button type="button" autoFocus onClick={closeViewer} aria-label="退出画板">
                          <X aria-hidden="true" size={20} strokeWidth={1.9} />
                          <span>退出</span>
                        </button>
                        <span className="de-diagram-board-divider" aria-hidden="true" />
                        <span className="de-diagram-board-identity">
                          <span className="de-diagram-board-mark" aria-hidden="true">
                            <Workflow size={17} strokeWidth={2.1} />
                          </span>
                          <span>画板</span>
                        </span>
                      </div>

                      <div className="de-diagram-board-mode-wrap">
                        <div className="de-diagram-board-mode de-diagram-board-float">
                          <span className="de-diagram-board-title" title={accessibleTitle}>
                            {accessibleTitle}
                          </span>
                          <span className="de-diagram-board-divider" aria-hidden="true" />
                          {canEdit ? (
                            <button
                              type="button"
                              aria-expanded={modeMenuOpen}
                              aria-haspopup="menu"
                              onClick={() => setModeMenuOpen((current) => !current)}
                            >
                              {editModeActive ? (
                                <PenLine aria-hidden="true" size={18} strokeWidth={1.9} />
                              ) : (
                                <Eye aria-hidden="true" size={18} strokeWidth={1.9} />
                              )}
                              <span>{editModeActive ? '编辑' : '浏览'}</span>
                              <ChevronDown aria-hidden="true" size={15} strokeWidth={1.9} />
                            </button>
                          ) : (
                            <span className="de-diagram-board-readonly">
                              <Eye aria-hidden="true" size={18} strokeWidth={1.9} />
                              <span>浏览</span>
                            </span>
                          )}
                        </div>
                        <AnimatePresence>
                          {modeMenuOpen ? (
                            <m.div
                              className="de-diagram-board-menu de-diagram-board-mode-menu"
                              role="menu"
                              initial={{opacity: 0, y: -4}}
                              animate={{opacity: 1, y: 0}}
                              exit={{opacity: 0, y: -4}}
                              transition={{duration: prefersReducedMotion ? 0 : 0.12}}
                            >
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={boardMode === 'edit'}
                                onClick={() => {
                                  setBoardMode('edit');
                                  setBoardTool('select');
                                  setModeMenuOpen(false);
                                }}
                              >
                                <PenLine aria-hidden="true" size={17} />
                                <span>
                                  <strong>编辑</strong>
                                  <small>
                                    {mermaidSource ? '拖动节点并修改文字' : '拖动并缩放图形'}
                                  </small>
                                </span>
                              </button>
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={boardMode === 'view'}
                                onClick={() => {
                                  setBoardMode('view');
                                  setBoardTool('hand');
                                  setModeMenuOpen(false);
                                }}
                              >
                                <Eye aria-hidden="true" size={17} />
                                <span>
                                  <strong>浏览</strong>
                                  <small>仅缩放和平移画布</small>
                                </span>
                              </button>
                            </m.div>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      <nav
                        className="de-diagram-board-tools de-diagram-board-float"
                        aria-label="画板工具"
                      >
                        {editModeActive ? (
                          <button
                            type="button"
                            aria-label="选择工具"
                            aria-pressed={boardTool === 'select'}
                            title="选择"
                            onClick={() => setBoardTool('select')}
                          >
                            <MousePointer2 aria-hidden="true" size={20} strokeWidth={1.8} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label="手型移动工具"
                          aria-keyshortcuts="H"
                          aria-pressed={boardTool === 'hand'}
                          title="移动画布（H）"
                          onClick={() => setBoardTool(boardTool === 'hand' ? 'select' : 'hand')}
                        >
                          <Hand aria-hidden="true" size={20} strokeWidth={1.8} />
                        </button>
                      </nav>

                      <m.div
                        ref={canvasRef}
                        className="de-diagram-viewer-canvas"
                        data-grid={grid ? 'true' : undefined}
                        data-pan-active={canvasPanActive ? 'true' : undefined}
                        data-panning={isPanning ? 'true' : undefined}
                        data-selecting={marqueeRect ? 'true' : undefined}
                        style={canvasStyle}
                        onContextMenu={(event) => event.preventDefault()}
                        onPointerDown={handleCanvasPointerDown}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={finishCanvasInteraction}
                        onPointerCancel={(event) => finishCanvasInteraction(event, true)}
                      >
                        <div
                          ref={stageRef}
                          className="de-diagram-viewer-stage"
                          style={{
                            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
                          }}
                        >
                          <figure
                            ref={viewerFigureRef}
                            className={joinClassNames(
                              'de-diagram',
                              'de-diagram-viewer-figure',
                              className,
                            )}
                            data-editable={editModeActive ? 'true' : undefined}
                            data-viewer="true"
                            {...props}
                          >
                            {mermaidSource ? (
                              <MermaidFlowchart
                                accessibleLabel={accessibleTitle}
                                boardLayout={boardLayout}
                                createdEdges={createdEdgesRef.current}
                                createdNodes={createdNodesRef.current}
                                edgePatches={edgePatchesRef.current}
                                editable={editModeActive}
                                editingNodeId={editor?.nodeId}
                                onChange={handleDiagramNodeChange}
                                onConnect={handleConnect}
                                onConnectionDrop={handleConnectionDrop}
                                onEdgeRouteChange={handleEdgeRouteChange}
                                onEditRequest={handleEditRequest}
                                onReady={() => {
                                  if (!hasFittedRef.current) requestAnimationFrame(fitView);
                                }}
                                onSelectNode={handleSelectNode}
                                onSelectEdge={handleSelectEdge}
                                panActive={canvasPanActive}
                                patches={nodePatchesRef.current}
                                revision={diagramRevision}
                                selectedEdgeId={selectedEdgeId}
                                selectedNodeIds={selectedNodeIds}
                                source={mermaidSource}
                              />
                            ) : (
                              <div
                                ref={mediaItemRef}
                                className="de-diagram-media-item"
                                data-de-media-item="true"
                                data-selected={mediaSelected ? 'true' : undefined}
                                style={{
                                  transform: `translate3d(${mediaTransform.x}px, ${mediaTransform.y}px, 0) scale(${mediaTransform.scale})`,
                                }}
                                onPointerDown={(event) => beginMediaInteraction(event, 'move')}
                                onPointerMove={moveMediaInteraction}
                                onPointerUp={finishMediaInteraction}
                                onPointerCancel={cancelMediaInteraction}
                              >
                                {children}
                                {editModeActive && mediaSelected && !canvasPanActive ? (
                                  <span
                                    className="de-diagram-media-scale-handle"
                                    aria-label="调整图片或图形大小"
                                    role="button"
                                    tabIndex={0}
                                    onPointerDown={(event) => beginMediaInteraction(event, 'scale')}
                                  />
                                ) : null}
                              </div>
                            )}
                          </figure>

                          <AnimatePresence>
                            {editor ? (
                              <div
                                key={editor.nodeId}
                                className="de-diagram-node-editor"
                                style={{
                                  left: editor.left,
                                  top: editor.top,
                                  width: editor.width,
                                  height: editor.height,
                                }}
                                onBlur={(event) => {
                                  if (!event.currentTarget.contains(event.relatedTarget)) commitEditor();
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                              >
                                <textarea
                                  ref={editorInputRef}
                                  value={editor.label}
                                  aria-label="编辑节点文字"
                                  style={{
                                    fontSize: editor.fontSize,
                                    paddingTop: Math.max(
                                      0,
                                      (editor.height -
                                        editor.label.split('\n').length * editor.fontSize * 1.2) /
                                        2,
                                    ),
                                  }}
                                  onChange={(event) =>
                                    setEditor((current) =>
                                      current ? {...current, label: event.target.value} : current,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    event.stopPropagation();
                                    if (event.key === 'Escape') {
                                      event.preventDefault();
                                      cancelEditor();
                                    } else if (
                                      event.key === 'Enter' &&
                                      (event.metaKey || event.ctrlKey)
                                    ) {
                                      event.preventDefault();
                                      commitEditor();
                                    }
                                  }}
                                />
                              </div>
                            ) : null}
                          </AnimatePresence>
                        </div>

                        {marqueeRect ? (
                          <div
                            className="de-diagram-selection-marquee"
                            aria-hidden="true"
                            style={{
                              height: marqueeRect.height,
                              left: marqueeRect.left,
                              top: marqueeRect.top,
                              width: marqueeRect.width,
                            }}
                          />
                        ) : null}

                        {shapePicker ? (
                          <m.div
                              key={`${shapePicker.sourceId}-${shapePicker.clientX}-${shapePicker.clientY}`}
                              className="de-diagram-shape-picker"
                              data-placement={shapePicker.placement}
                              role="menu"
                              aria-label="选择要创建的图形"
                              style={{left: shapePicker.left, top: shapePicker.top}}
                              initial={{opacity: 0}}
                              animate={{opacity: 1}}
                              transition={{duration: prefersReducedMotion ? 0 : 0.12}}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              {QUICK_SHAPES.map((option) => (
                                <button
                                  key={option.shape}
                                  type="button"
                                  role="menuitem"
                                  aria-label={`创建${option.label}`}
                                  title={option.label}
                                  onClick={() => createConnectedShape(option.shape)}
                                >
                                  <ShapeGlyph shape={option.shape} />
                                </button>
                              ))}
                          </m.div>
                        ) : null}
                      </m.div>

                      <div className="de-diagram-board-zoom-wrap">
                        <AnimatePresence>
                          {helpOpen ? (
                            <m.div
                              className="de-diagram-board-help-popover"
                              initial={{opacity: 0, y: 4}}
                              animate={{opacity: 1, y: 0}}
                              exit={{opacity: 0, y: 4}}
                              transition={{duration: prefersReducedMotion ? 0 : 0.12}}
                            >
                              <strong>移动与缩放</strong>
                              <span>H 或手型工具：拖动画布</span>
                              <span>Space + 左键拖动，或直接右键拖动</span>
                              <span>⌘ / Ctrl + 滚轮：以指针为中心缩放</span>
                            </m.div>
                          ) : null}
                        </AnimatePresence>
                        <AnimatePresence>
                          {zoomMenuOpen ? (
                            <m.div
                              className="de-diagram-board-menu de-diagram-board-zoom-menu"
                              role="menu"
                              initial={{opacity: 0, y: 4}}
                              animate={{opacity: 1, y: 0}}
                              exit={{opacity: 0, y: 4}}
                              transition={{duration: prefersReducedMotion ? 0 : 0.12}}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  centerAtScale(1);
                                  setZoomMenuOpen(false);
                                }}
                              >
                                <span>缩放至 100%</span>
                                <kbd>⌘ / Ctrl + 0</kbd>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  fitView();
                                  setZoomMenuOpen(false);
                                }}
                              >
                                <span>全览</span>
                                <kbd>Shift + 1</kbd>
                              </button>
                            </m.div>
                          ) : null}
                        </AnimatePresence>
                        <div className="de-diagram-board-zoom de-diagram-board-float">
                          <button
                            type="button"
                            aria-label="手型移动工具"
                            aria-keyshortcuts="H"
                            aria-pressed={boardTool === 'hand'}
                            title="移动画布（H）"
                            onClick={() => setBoardTool(boardTool === 'hand' ? 'select' : 'hand')}
                          >
                            <Hand aria-hidden="true" size={20} strokeWidth={1.8} />
                          </button>
                          <span className="de-diagram-board-divider" aria-hidden="true" />
                          <button
                            type="button"
                            aria-label="缩小画板"
                            title="缩小（-）"
                            disabled={viewport.scale <= MIN_ZOOM}
                            onClick={() => zoomBy(1 / ZOOM_FACTOR)}
                          >
                            <Minus aria-hidden="true" size={20} strokeWidth={1.8} />
                          </button>
                          <button
                            type="button"
                            className="de-diagram-board-zoom-value"
                            aria-label={`当前缩放 ${Math.round(viewport.scale * 100)}%，打开缩放菜单`}
                            aria-expanded={zoomMenuOpen}
                            aria-haspopup="menu"
                            onClick={() => setZoomMenuOpen((current) => !current)}
                          >
                            {Math.round(viewport.scale * 100)}%
                          </button>
                          <button
                            type="button"
                            aria-label="放大画板"
                            title="放大（+）"
                            disabled={viewport.scale >= MAX_ZOOM}
                            onClick={() => zoomBy(ZOOM_FACTOR)}
                          >
                            <Plus aria-hidden="true" size={20} strokeWidth={1.8} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="de-diagram-board-help de-diagram-board-float"
                          aria-label="查看画板操作帮助"
                          aria-expanded={helpOpen}
                          onClick={() => setHelpOpen((current) => !current)}
                        >
                          <HelpCircle aria-hidden="true" size={20} strokeWidth={1.8} />
                        </button>
                      </div>
                    </m.section>
                  </m.div>
                ) : null}
              </AnimatePresence>
            </LazyMotion>,
            document.body,
          )
        : null}
    </>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rectFromPoints(x1: number, y1: number, x2: number, y2: number): MarqueeRect {
  return {
    height: Math.abs(y2 - y1),
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
  };
}

function rectanglesIntersect(
  first: {bottom: number; left: number; right: number; top: number},
  second: {bottom: number; left: number; right: number; top: number},
) {
  return (
    first.left <= second.right &&
    first.right >= second.left &&
    first.top <= second.bottom &&
    first.bottom >= second.top
  );
}

function resolveMediaTransform(
  value: Partial<DiagramMediaTransform> | undefined,
  fallback: MediaTransform = {scale: 1, x: 0, y: 0},
): MediaTransform {
  const position = value?.position;
  return {
    scale:
      typeof value?.scale === 'number' && Number.isFinite(value.scale)
        ? clamp(value.scale, 0.2, 4)
        : fallback.scale,
    x:
      typeof position?.x === 'number' && Number.isFinite(position.x) ? position.x : fallback.x,
    y:
      typeof position?.y === 'number' && Number.isFinite(position.y) ? position.y : fallback.y,
  };
}

function createBoardElementId(prefix: 'edge' | 'node') {
  boardElementSequence += 1;
  return `de-${prefix}-${Date.now().toString(36)}-${boardElementSequence.toString(36)}`;
}

function ShapeGlyph({shape}: {shape: DiagramNodeShape}) {
  return (
    <svg viewBox="0 0 30 24" aria-hidden="true">
      {shape === 'diamond' ? (
        <path d="M15 2 28 12 15 22 2 12Z" />
      ) : shape === 'circle' ? (
        <ellipse cx="15" cy="12" rx="10" ry="10" />
      ) : (
        <rect
          x="2"
          y="4"
          width="26"
          height="16"
          rx={shape === 'stadium' ? 8 : shape === 'round' ? 5 : 1.5}
        />
      )}
    </svg>
  );
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (!dialog) return;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden && element.getClientRects().length > 0);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
