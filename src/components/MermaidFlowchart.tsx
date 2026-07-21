'use client';

import type {PointerEvent as ReactPointerEvent} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';

export type DiagramNodeChangeReason = 'label' | 'position';

export type DiagramNodePosition = {
  x: number;
  y: number;
};

export type DiagramNodeChange = {
  nodeId: string;
  label: string;
  position: DiagramNodePosition;
  reason: DiagramNodeChangeReason;
};

export type DiagramNodePatch = {
  label?: string;
  position?: DiagramNodePosition;
};

/** Fixed geometry for an authored Board node. Omit it to keep automatic Mermaid layout. */
export type DiagramBoardNodeLayout = {
  height?: number;
  position: DiagramNodePosition;
  width?: number;
};

/** Optional authored route/style for a Mermaid edge on the native Board. */
export type DiagramBoardEdgeLayout = {
  /** Render the edge label as the light, bare SVG-style annotation instead of a chip. */
  bareLabel?: boolean;
  label?: string;
  labelAlign?: 'start' | 'middle' | 'end';
  labelPosition?: DiagramNodePosition;
  points?: DiagramNodePosition[];
  sourceId: string;
  sourceSide?: DiagramAnchorSide;
  targetId: string;
  targetSide?: DiagramAnchorSide;
};

/**
 * An authored Board scene layered over Mermaid semantics. Mermaid still parses text,
 * nodes and relationships; this object supplies exact initial coordinates and routes.
 */
export type DiagramBoardLayout = {
  edges?: DiagramBoardEdgeLayout[];
  height: number;
  nodes: Record<string, DiagramBoardNodeLayout>;
  width: number;
};

export type MermaidEditRequest = {
  fontSize: number;
  nodeId: string;
  label: string;
  placeholder?: boolean;
  position: DiagramNodePosition;
  rect: DOMRect;
};

type FlowDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type DiagramNodeShape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond';
export type DiagramNodeTone = 'blue' | 'purple' | 'teal' | 'green' | 'orange' | 'neutral';
type FlowNodeShape = DiagramNodeShape;
type FlowNodeTone = DiagramNodeTone;

type ParsedFlowNode = {
  classes: string[];
  id: string;
  label: string;
  placeholder?: boolean;
  shape: FlowNodeShape;
  tone: FlowNodeTone;
};

type ParsedFlowEdge = {
  arrow: boolean;
  bareLabel?: boolean;
  id: string;
  label: string;
  labelAlign?: 'start' | 'middle' | 'end';
  sourceSide?: AnchorSide;
  sourceId: string;
  stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
  targetSide?: AnchorSide;
  targetId: string;
};

type ParsedFlowGraph = {
  direction: FlowDirection;
  edges: ParsedFlowEdge[];
  nodes: ParsedFlowNode[];
};

type LayoutNode = ParsedFlowNode & {
  height: number;
  position: DiagramNodePosition;
  width: number;
};

type LayoutGraph = {
  edges: ParsedFlowEdge[];
  height: number;
  nodes: LayoutNode[];
  width: number;
};

type AlignmentGuides = {
  x?: number;
  y?: number;
};

export type DiagramAnchorSide = 'top' | 'right' | 'bottom' | 'left';
type AnchorSide = DiagramAnchorSide;

type EdgeRoute = {
  arrowPoints?: string;
  label: DiagramNodePosition;
  path: string;
  points: DiagramNodePosition[];
  sourceSide: AnchorSide;
  targetSide: AnchorSide;
};

type DragSession = {
  nodeId: string;
  nodeIds: string[];
  pointerId: number;
  pointerStart: DOMPoint;
  positions: Map<string, DiagramNodePosition>;
  positionsStart: Map<string, DiagramNodePosition>;
};

type ConnectionDraft = {
  end: DiagramNodePosition;
  pointerId: number;
  sourceId: string;
  sourceSide: AnchorSide;
  targetId?: string;
  targetSide: AnchorSide;
};

type EdgeRouteHandle = {
  orientation: 'horizontal' | 'vertical';
  segmentIndex: number;
  x: number;
  y: number;
};

type EdgeRouteDragSession = {
  edgeId: string;
  handle: EdgeRouteHandle;
  initialPoints: DiagramNodePosition[];
  points: DiagramNodePosition[];
  pointerId: number;
};

export type DiagramCreatedNode = {
  id: string;
  label: string;
  position: DiagramNodePosition;
  placeholder?: boolean;
  shape: DiagramNodeShape;
  tone: DiagramNodeTone;
};

export type DiagramCreatedEdge = {
  id: string;
  sourceId: string;
  sourceSide: DiagramAnchorSide;
  targetId: string;
  targetSide: DiagramAnchorSide;
};

/** A manually adjusted orthogonal path. The first and last points stay attached to their nodes. */
export type DiagramEdgeRoutePatch = {
  label?: DiagramNodePosition;
  points: DiagramNodePosition[];
};

export type DiagramEdgeRouteChange = {
  edgeId: string;
  route: DiagramEdgeRoutePatch;
};

export type DiagramConnectRequest = Omit<DiagramCreatedEdge, 'id'>;

export type DiagramConnectionDropRequest = {
  clientX: number;
  clientY: number;
  position: DiagramNodePosition;
  sourceId: string;
  sourceSide: DiagramAnchorSide;
  targetSide: DiagramAnchorSide;
  tone: DiagramNodeTone;
};

export type MermaidFlowchartProps = {
  accessibleLabel: string;
  boardLayout?: DiagramBoardLayout;
  createdEdges?: DiagramCreatedEdge[];
  createdNodes?: DiagramCreatedNode[];
  edgePatches?: Map<string, DiagramEdgeRoutePatch>;
  editable: boolean;
  editingNodeId?: string;
  fitPatchedBounds?: boolean;
  onChange?: (change: DiagramNodeChange) => void;
  onConnect?: (request: DiagramConnectRequest) => void;
  onConnectionDrop?: (request: DiagramConnectionDropRequest) => void;
  onEdgeRouteChange?: (change: DiagramEdgeRouteChange) => void;
  onEditRequest?: (request: MermaidEditRequest) => void;
  onReady?: () => void;
  onSelectNode?: (nodeId: string | null, additive?: boolean) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  panActive: boolean;
  patches: Map<string, DiagramNodePatch>;
  revision: number;
  selectedEdgeId?: string | null;
  selectedNodeIds?: readonly string[];
  source: string;
};

const resolvedGraphs = new Map<string, ParsedFlowGraph>();
const pendingGraphs = new Map<string, Promise<ParsedFlowGraph>>();
let parseQueue: Promise<void> = Promise.resolve();
let mermaidInitialized = false;

export function MermaidFlowchart({
  accessibleLabel,
  boardLayout,
  createdEdges = [],
  createdNodes = [],
  edgePatches = new Map(),
  editable,
  editingNodeId,
  fitPatchedBounds = false,
  onChange,
  onConnect,
  onConnectionDrop,
  onEdgeRouteChange,
  onEditRequest,
  onReady,
  onSelectNode,
  onSelectEdge,
  panActive,
  patches,
  revision,
  selectedEdgeId = null,
  selectedNodeIds = [],
  source,
}: MermaidFlowchartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const connectionDraftRef = useRef<ConnectionDraft | null>(null);
  const edgeRouteDragRef = useRef<EdgeRouteDragSession | null>(null);
  const [parsedGraph, setParsedGraph] = useState<ParsedFlowGraph | null>(
    () => resolvedGraphs.get(source) ?? null,
  );
  const [parseError, setParseError] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activePortNodeId, setActivePortNodeId] = useState<string | null>(null);
  const [activePositions, setActivePositions] = useState<Map<string, DiagramNodePosition> | null>(
    null,
  );
  const [guides, setGuides] = useState<AlignmentGuides>({});
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [activeEdgeRoute, setActiveEdgeRoute] = useState<DiagramEdgeRouteChange | null>(null);

  useEffect(() => {
    let cancelled = false;
    setParseError('');
    const cached = resolvedGraphs.get(source);
    if (cached) {
      setParsedGraph(cached);
      return;
    }
    setParsedGraph(null);
    void parseMermaidFlowchart(source)
      .then((graph) => {
        if (!cancelled) setParsedGraph(graph);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setParseError(error instanceof Error ? error.message : 'Mermaid 流程图解析失败');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const layout = useMemo(() => {
    if (!parsedGraph) return null;
    // Keep Mermaid's initial rank layout immutable. Board-created nodes and edges are
    // placed on top of it, otherwise every new relationship would re-rank existing nodes.
    const graph = ensureLayoutNodePositions(
      appendBoardElements(
        layoutFlowGraph(parsedGraph, patches, boardLayout),
        createdNodes,
        createdEdges,
        patches,
      ),
    );
    if (!activePositions || !dragRef.current) return graph;
    return {
      ...graph,
      nodes: graph.nodes.map((node) => {
        const position = activePositions.get(node.id);
        return position ? {...node, position} : node;
      }),
    };
  }, [activePositions, boardLayout, createdEdges, createdNodes, parsedGraph, patches, revision]);

  const displayBounds = useMemo(() => {
    if (!layout) return {height: 120, left: 0, top: 0, width: 320};
    // A designed Board scene owns its intentional whitespace (for example the
    // feedback lane beneath a flow). Do not crop it down to node-only bounds.
    if (boardLayout && createdNodes.length === 0) {
      return {height: boardLayout.height, left: 0, top: 0, width: boardLayout.width};
    }
    if (!fitPatchedBounds && createdNodes.length === 0) {
      return {height: layout.height, left: 0, top: 0, width: layout.width};
    }
    return getLayoutBounds(layout.nodes, 42);
  }, [boardLayout, createdNodes.length, fitPatchedBounds, layout]);

  useEffect(() => {
    if (parsedGraph) onReady?.();
  }, [onReady, parsedGraph]);

  const requestEdit = (node: LayoutNode, element: SVGGElement) => {
    if (!editable || panActive) return;
    onSelectNode?.(node.id);
    const matrix = element.ownerSVGElement?.getScreenCTM();
    const shape = element.querySelector<SVGGraphicsElement>('.de-board-flowchart__node-shape');
    onEditRequest?.({
      fontSize: 14 * (matrix ? Math.hypot(matrix.a, matrix.b) : 1),
      nodeId: node.id,
      label: node.label,
      placeholder: node.placeholder,
      position: {...node.position},
      rect: shape?.getBoundingClientRect() ?? element.getBoundingClientRect(),
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGGElement>, node: LayoutNode) => {
    if (!editable || panActive || event.button !== 0) return;
    const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const currentSelection = selectedNodeIds.includes(node.id)
      ? [...selectedNodeIds]
      : additive
        ? [...selectedNodeIds, node.id]
        : [node.id];
    const positionsStart = new Map<string, DiagramNodePosition>();
    currentSelection.forEach((nodeId) => {
      const selectedNode = layout?.nodes.find((candidate) => candidate.id === nodeId);
      if (selectedNode) positionsStart.set(nodeId, {...selectedNode.position});
    });
    dragRef.current = {
      nodeId: node.id,
      nodeIds: [...positionsStart.keys()],
      pointerId: event.pointerId,
      pointerStart: point,
      positions: new Map(positionsStart),
      positionsStart,
    };
    onSelectNode?.(node.id, additive);
    setActivePositions(new Map(positionsStart));
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !layout) return;
    const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    let deltaX = point.x - drag.pointerStart.x;
    let deltaY = point.y - drag.pointerStart.y;
    if (event.shiftKey) {
      if (Math.abs(deltaX) >= Math.abs(deltaY)) deltaY = 0;
      else deltaX = 0;
    }
    const movingNode = layout.nodes.find((node) => node.id === drag.nodeId);
    const primaryStart = drag.positionsStart.get(drag.nodeId);
    if (!movingNode || !primaryStart) return;
    const selectedIds = new Set(drag.nodeIds);
    const snappingNodes = layout.nodes.filter(
      (candidate) => candidate.id === movingNode.id || !selectedIds.has(candidate.id),
    );
    const snapped = snapNodePosition(snappingNodes, movingNode, {
      x: primaryStart.x + deltaX,
      y: primaryStart.y + deltaY,
    });
    const snappedDelta = {
      x: snapped.position.x - primaryStart.x,
      y: snapped.position.y - primaryStart.y,
    };
    const nextPositions = new Map(
      [...drag.positionsStart].map(([nodeId, position]) => [
        nodeId,
        {x: position.x + snappedDelta.x, y: position.y + snappedDelta.y},
      ]),
    );
    drag.positions = nextPositions;
    setActivePositions(nextPositions);
    setGuides(snapped.guides);
  };

  const finishDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nextPositions = drag.positions;
    const primaryStart = drag.positionsStart.get(drag.nodeId);
    const primaryEnd = nextPositions.get(drag.nodeId);
    const dragDelta =
      primaryStart && primaryEnd
        ? {x: primaryEnd.x - primaryStart.x, y: primaryEnd.y - primaryStart.y}
        : {x: 0, y: 0};
    const moved = Math.abs(dragDelta.x) >= 0.5 || Math.abs(dragDelta.y) >= 0.5;
    const selectedIds = new Set(drag.nodeIds);
    const routeChanges: DiagramEdgeRouteChange[] = [];
    if (moved && layout) {
      const initialPatches = resolveInitialEdgePatches(layout.edges, boardLayout);
      layout.edges.forEach((edge) => {
        if (!selectedIds.has(edge.sourceId) || !selectedIds.has(edge.targetId)) return;
        const patch = edgePatches.get(edge.id) ?? initialPatches.get(edge.id);
        if (!patch) return;
        routeChanges.push({edgeId: edge.id, route: translateEdgeRoutePatch(patch, dragDelta)});
      });
    }
    dragRef.current = null;
    setActivePositions(null);
    setGuides({});
    drag.nodeIds.forEach((nodeId) => {
      const positionStart = drag.positionsStart.get(nodeId);
      const nextPosition = nextPositions.get(nodeId);
      const movedNode = layout?.nodes.find((candidate) => candidate.id === nodeId);
      if (!positionStart || !nextPosition || !movedNode) return;
      if (
        Math.abs(nextPosition.x - positionStart.x) < 0.5 &&
        Math.abs(nextPosition.y - positionStart.y) < 0.5
      ) {
        return;
      }
      onChange?.({
        nodeId,
        label: movedNode.label,
        position: nextPosition,
        reason: 'position',
      });
    });
    routeChanges.forEach((change) => onEdgeRouteChange?.(change));
  };

  const cancelDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setActivePositions(null);
    setGuides({});
  };

  const beginConnection = (
    event: ReactPointerEvent<SVGGElement>,
    node: LayoutNode,
    side: AnchorSide,
  ) => {
    if (!editable || panActive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const end = anchorPoint(node, side, 0, 14);
    const draft: ConnectionDraft = {
      end,
      pointerId: event.pointerId,
      sourceId: node.id,
      sourceSide: side,
      targetSide: oppositeSide(side),
    };
    connectionDraftRef.current = draft;
    setConnectionDraft(draft);
    onSelectNode?.(node.id);
  };

  const moveConnection = (event: ReactPointerEvent<SVGGElement>) => {
    const draft = connectionDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId || !layout) return;
    const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    const targetElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<SVGGElement>('[data-de-node-id]');
    const targetId = targetElement?.dataset.deNodeId;
    const targetNode =
      targetId && targetId !== draft.sourceId
        ? layout.nodes.find((node) => node.id === targetId)
        : undefined;
    const targetSide = targetNode
      ? nearestAnchorSide(targetNode, point)
      : resolveDraftTargetSide(
          layout.nodes.find((node) => node.id === draft.sourceId),
          point,
        );
    const next: ConnectionDraft = {
      ...draft,
      end: point,
      targetId: targetNode?.id,
      targetSide,
    };
    connectionDraftRef.current = next;
    setConnectionDraft(next);
  };

  const finishConnection = (event: ReactPointerEvent<SVGGElement>) => {
    const draft = connectionDraftRef.current;
    if (!draft || draft.pointerId !== event.pointerId || !layout) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const sourceNode = layout.nodes.find((node) => node.id === draft.sourceId);
    if (draft.targetId) {
      onConnect?.({
        sourceId: draft.sourceId,
        sourceSide: draft.sourceSide,
        targetId: draft.targetId,
        targetSide: draft.targetSide,
      });
      onSelectNode?.(draft.targetId);
    } else if (sourceNode) {
      onConnectionDrop?.({
        clientX: event.clientX,
        clientY: event.clientY,
        position: draft.end,
        sourceId: draft.sourceId,
        sourceSide: draft.sourceSide,
        targetSide: draft.targetSide,
        tone: sourceNode.tone,
      });
    }
    connectionDraftRef.current = null;
    setConnectionDraft(null);
    setHoveredNodeId(null);
    setActivePortNodeId(null);
  };

  const cancelConnection = (event: ReactPointerEvent<SVGGElement>) => {
    if (connectionDraftRef.current?.pointerId !== event.pointerId) return;
    connectionDraftRef.current = null;
    setConnectionDraft(null);
    setHoveredNodeId(null);
    setActivePortNodeId(null);
  };

  const selectEdge = (event: ReactPointerEvent<SVGGElement>, edgeId: string) => {
    if (!editable || panActive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectEdge?.(edgeId);
  };

  const beginEdgeRouteDrag = (
    event: ReactPointerEvent<SVGGElement>,
    edgeId: string,
    handle: EdgeRouteHandle,
    points: DiagramNodePosition[],
  ) => {
    if (!editable || panActive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const copiedPoints = points.map((point) => ({...point}));
    edgeRouteDragRef.current = {
      edgeId,
      handle,
      initialPoints: copiedPoints,
      points: copiedPoints,
      pointerId: event.pointerId,
    };
    setActiveEdgeRoute({edgeId, route: {points: copiedPoints}});
    onSelectEdge?.(edgeId);
  };

  const moveEdgeRouteDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = edgeRouteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    const points = moveRouteSegment(drag.points, drag.handle, point);
    drag.points = points;
    setActiveEdgeRoute({edgeId: drag.edgeId, route: {points}});
  };

  const finishEdgeRouteDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = edgeRouteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    edgeRouteDragRef.current = null;
    setActiveEdgeRoute(null);
    if (!sameRoutePoints(drag.initialPoints, drag.points)) {
      onEdgeRouteChange?.({edgeId: drag.edgeId, route: {points: drag.points}});
    }
  };

  const cancelEdgeRouteDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (edgeRouteDragRef.current?.pointerId !== event.pointerId) return;
    edgeRouteDragRef.current = null;
    setActiveEdgeRoute(null);
  };

  if (parseError) {
    return (
      <div className="de-board-flowchart de-board-flowchart--error" role="img" aria-label={accessibleLabel}>
        <strong>暂时无法渲染这张流程图</strong>
        <span>{parseError}</span>
      </div>
    );
  }

  if (!layout) {
    return (
      <div
        className="de-board-flowchart de-board-flowchart--loading"
        role="img"
        aria-label={accessibleLabel}
      >
        <span>正在构建画板…</span>
      </div>
    );
  }

  const nodesById = new Map(layout.nodes.map((node) => [node.id, node]));
  const routePatches = new Map(resolveInitialEdgePatches(layout.edges, boardLayout));
  edgePatches.forEach((patch, edgeId) => routePatches.set(edgeId, patch));
  const activeDrag = dragRef.current;
  if (activeDrag) {
    const primaryStart = activeDrag.positionsStart.get(activeDrag.nodeId);
    const primaryEnd = activeDrag.positions.get(activeDrag.nodeId);
    if (primaryStart && primaryEnd) {
      const delta = {x: primaryEnd.x - primaryStart.x, y: primaryEnd.y - primaryStart.y};
      const selectedIds = new Set(activeDrag.nodeIds);
      layout.edges.forEach((edge) => {
        if (!selectedIds.has(edge.sourceId) || !selectedIds.has(edge.targetId)) return;
        const patch = routePatches.get(edge.id);
        if (patch) routePatches.set(edge.id, translateEdgeRoutePatch(patch, delta));
      });
    }
  }
  if (activeEdgeRoute) routePatches.set(activeEdgeRoute.edgeId, activeEdgeRoute.route);
  const routedEdges = routeGraphEdges(layout.nodes, layout.edges, routePatches);
  const draftSource = connectionDraft ? nodesById.get(connectionDraft.sourceId) : undefined;
  const draftTarget = connectionDraft?.targetId
    ? nodesById.get(connectionDraft.targetId)
    : undefined;
  const draftRoute =
    connectionDraft && draftSource
      ? routeDraftConnection(draftSource, draftTarget, connectionDraft, layout.nodes)
      : null;
  const guideBounds = getLayoutBounds(layout.nodes, 34);

  return (
    <div
      className="de-board-flowchart"
      data-authored-layout={boardLayout ? 'true' : undefined}
      role="img"
      aria-label={accessibleLabel}
    >
      <svg
        ref={svgRef}
        className="de-board-flowchart__svg"
        viewBox={`${format(displayBounds.left)} ${format(displayBounds.top)} ${format(displayBounds.width)} ${format(displayBounds.height)}`}
        aria-hidden="true"
      >
        <g className="de-board-flowchart__edges">
          {routedEdges.map(({edge, route}) => {
            const sourceNode = nodesById.get(edge.sourceId);
            const targetNode = nodesById.get(edge.targetId);
            if (!sourceNode || !targetNode || edge.stroke === 'invisible') return null;
            const edgeSelected = selectedEdgeId === edge.id;
            const labelAlign = edge.labelAlign ?? 'middle';
            const labelTextWidth = measureTextWidth(edge.label);
            const labelPaddingX = edge.bareLabel ? 7 : 9;
            const labelBoxWidth = labelTextWidth + labelPaddingX * 2;
            const labelBoxX =
              labelAlign === 'start'
                ? -labelPaddingX
                : labelAlign === 'end'
                  ? -labelTextWidth - labelPaddingX
                  : -labelBoxWidth / 2;
            const showEdgeHandles =
              editable && !panActive && (edgeSelected || hoveredEdgeId === edge.id);
            return (
              <g
                key={edge.id}
                className="de-board-flowchart__edge"
                data-de-edge-id={edge.id}
                data-feedback={isFeedbackEdge(edge) ? 'true' : undefined}
                data-selected={edgeSelected ? 'true' : undefined}
                onPointerDown={(event) => selectEdge(event, edge.id)}
                onPointerEnter={() => {
                  if (editable && !panActive) setHoveredEdgeId(edge.id);
                }}
                onPointerLeave={() => {
                  if (!edgeRouteDragRef.current) {
                    setHoveredEdgeId((current) => (current === edge.id ? null : current));
                  }
                }}
              >
                <path d={route.path} className="de-board-flowchart__edge-hit" />
                <path
                  d={route.path}
                  className="de-board-flowchart__edge-path"
                  data-edge-id={edge.id}
                  data-feedback={isFeedbackEdge(edge) ? 'true' : undefined}
                  data-source-id={edge.sourceId}
                  data-target-id={edge.targetId}
                  data-stroke={edge.stroke}
                  data-source-side={route.sourceSide}
                  data-target-side={route.targetSide}
                />
                {route.arrowPoints ? (
                  <polygon
                    className="de-board-flowchart__arrow"
                    data-edge-id={edge.id}
                    data-feedback={isFeedbackEdge(edge) ? 'true' : undefined}
                    points={route.arrowPoints}
                  />
                ) : null}
                {edge.label ? (
                  <g
                    className="de-board-flowchart__edge-label"
                    data-bare={edge.bareLabel ? 'true' : undefined}
                    data-feedback={isFeedbackEdge(edge) ? 'true' : undefined}
                    transform={`translate(${format(route.label.x)} ${format(route.label.y)})`}
                  >
                    <rect
                      x={labelBoxX}
                      y={edge.bareLabel ? -11 : -13}
                      width={labelBoxWidth}
                      height={edge.bareLabel ? 22 : 26}
                      rx={edge.bareLabel ? 7 : 8}
                    />
                    <text textAnchor={labelAlign} dominantBaseline="central">
                      {edge.label}
                    </text>
                  </g>
                ) : null}
                {showEdgeHandles ? (
                  <g className="de-board-flowchart__edge-handles" aria-hidden="true">
                    {getRouteSegmentHandles(route.points).map((handle) => (
                      <g
                        key={`${edge.id}-${handle.segmentIndex}`}
                        className="de-board-flowchart__edge-handle"
                        data-orientation={handle.orientation}
                        transform={`translate(${format(handle.x)} ${format(handle.y)})`}
                        onPointerDown={(event) =>
                          beginEdgeRouteDrag(event, edge.id, handle, route.points)
                        }
                        onPointerMove={moveEdgeRouteDrag}
                        onPointerUp={finishEdgeRouteDrag}
                        onPointerCancel={cancelEdgeRouteDrag}
                      >
                        <circle className="de-board-flowchart__edge-handle-hit" r="12" />
                        <circle className="de-board-flowchart__edge-handle-dot" r="4.5" />
                      </g>
                    ))}
                  </g>
                ) : null}
              </g>
            );
          })}
          {draftRoute ? (
            <g className="de-board-flowchart__connection-preview" aria-hidden="true">
              <path d={draftRoute.path} className="de-board-flowchart__edge-path" />
              {draftRoute.arrowPoints ? (
                <polygon
                  className="de-board-flowchart__arrow"
                  points={draftRoute.arrowPoints}
                />
              ) : null}
            </g>
          ) : null}
        </g>

        {guides.x !== undefined || guides.y !== undefined ? (
          <g className="de-board-flowchart__guides">
            {guides.x !== undefined ? (
              <line
                x1={guides.x}
                x2={guides.x}
                y1={guideBounds.top}
                y2={guideBounds.top + guideBounds.height}
              />
            ) : null}
            {guides.y !== undefined ? (
              <line
                x1={guideBounds.left}
                x2={guideBounds.left + guideBounds.width}
                y1={guides.y}
                y2={guides.y}
              />
            ) : null}
          </g>
        ) : null}

        <g className="de-board-flowchart__nodes">
          {layout.nodes.map((node) => {
            const selected = selectedNodeIds.includes(node.id);
            const editing = editingNodeId === node.id;
            const badge = resolveNodeBadge(node.classes);
            const badgeWidth = badge ? measureBadgeWidth(badge) : 0;
            const detailLabel = hasBoardClass(node.classes, 'deBoardDetail');
            const showPorts =
              editable &&
              !panActive &&
              !editing &&
              (
                (selected && selectedNodeIds.length === 1) ||
                hoveredNodeId === node.id ||
                activePortNodeId === node.id ||
                connectionDraft?.targetId === node.id
              );
            return (
              <g
                key={node.id}
                className="de-board-flowchart__node"
                data-de-node-id={node.id}
                data-selected={selected ? 'true' : undefined}
                data-editing={editing ? 'true' : undefined}
                data-connect-target={connectionDraft?.targetId === node.id ? 'true' : undefined}
                data-badge={badge ?? undefined}
                data-detail={detailLabel ? 'true' : undefined}
                data-placeholder={node.placeholder ? 'true' : undefined}
                data-tone={node.tone}
                transform={`translate(${format(node.position.x)} ${format(node.position.y)})`}
                role={editable ? 'button' : undefined}
                tabIndex={editable ? 0 : undefined}
                aria-label={editable ? `流程节点：${node.label}。拖动可移动，双击可编辑。` : undefined}
                onPointerEnter={() => {
                  if (editable && !panActive) setHoveredNodeId(node.id);
                }}
                onPointerLeave={(event) => {
                  const relatedTarget = event.relatedTarget;
                  if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
                  if (!connectionDraftRef.current) setHoveredNodeId((current) => (current === node.id ? null : current));
                }}
                onPointerDown={(event) => handlePointerDown(event, node)}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={cancelDrag}
                onDoubleClick={(event) => {
                  if (!editable || panActive) return;
                  event.preventDefault();
                  event.stopPropagation();
                  requestEdit(node, event.currentTarget);
                }}
                onKeyDown={(event) => {
                  if (!editable || panActive) return;
                  if (event.key === 'Enter' || event.key === 'F2') {
                    event.preventDefault();
                    requestEdit(node, event.currentTarget);
                    return;
                  }
                  const amount = event.shiftKey ? 1 : 8;
                  const delta =
                    event.key === 'ArrowLeft'
                      ? {x: -amount, y: 0}
                      : event.key === 'ArrowRight'
                        ? {x: amount, y: 0}
                        : event.key === 'ArrowUp'
                          ? {x: 0, y: -amount}
                          : event.key === 'ArrowDown'
                            ? {x: 0, y: amount}
                            : null;
                  if (!delta) return;
                  event.preventDefault();
                  onSelectNode?.(node.id);
                  const keyboardSelection = selected
                    ? layout.nodes.filter((candidate) => selectedNodeIds.includes(candidate.id))
                    : [node];
                  keyboardSelection.forEach((selectedNode) => {
                    onChange?.({
                      nodeId: selectedNode.id,
                      label: selectedNode.label,
                      position: {
                        x: selectedNode.position.x + delta.x,
                        y: selectedNode.position.y + delta.y,
                      },
                      reason: 'position',
                    });
                  });
                }}
              >
                <NodeShape node={node} />
                <text
                  className="de-board-flowchart__node-label"
                  textAnchor="middle"
                  transform={badge ? 'translate(0 8)' : undefined}
                >
                  {node.label.split('\n').map((line, index, lines) => (
                    <tspan
                      key={`${node.id}-${index}`}
                      x="0"
                      dy={index === 0 ? `${-(lines.length - 1) * 0.58}em` : '1.16em'}
                    >
                      {line || ' '}
                    </tspan>
                  ))}
                </text>
                {badge ? (
                  <g className="de-board-flowchart__node-badge" aria-hidden="true">
                    <rect
                      x={-badgeWidth / 2}
                      y={-node.height / 2 + 29}
                      width={badgeWidth}
                      height={28}
                      rx={8}
                    />
                    <text x={0} y={-node.height / 2 + 43} textAnchor="middle">
                      {badge}
                    </text>
                  </g>
                ) : null}
                {showPorts ? (
                  <g className="de-board-flowchart__ports" aria-hidden="true">
                    {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                      const point = anchorPoint(node, side, 0, 16);
                      return (
                        <g
                          key={side}
                          className="de-board-flowchart__port"
                          data-side={side}
                          transform={`translate(${format(point.x - node.position.x)} ${format(point.y - node.position.y)})`}
                          onPointerEnter={() => {
                            setHoveredNodeId(node.id);
                            setActivePortNodeId(node.id);
                          }}
                          onPointerLeave={(event) => {
                            const relatedTarget = event.relatedTarget;
                            if (relatedTarget instanceof Node && event.currentTarget.parentElement?.parentElement?.contains(relatedTarget)) {
                              return;
                            }
                            if (!connectionDraftRef.current) {
                              setActivePortNodeId((current) => (current === node.id ? null : current));
                            }
                          }}
                          onPointerDown={(event) => {
                            setActivePortNodeId(node.id);
                            beginConnection(event, node, side);
                          }}
                          onPointerMove={moveConnection}
                          onPointerUp={finishConnection}
                          onPointerCancel={cancelConnection}
                        >
                          <circle className="de-board-flowchart__port-hit" r="13" />
                          <circle className="de-board-flowchart__port-dot" r="5" />
                        </g>
                      );
                    })}
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function NodeShape({node}: {node: LayoutNode}) {
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  if (node.shape === 'diamond') {
    return (
      <path
        className="de-board-flowchart__node-shape"
        d={roundedDiamondPath(halfWidth, halfHeight)}
      />
    );
  }
  if (node.shape === 'circle') {
    return (
      <ellipse
        className="de-board-flowchart__node-shape"
        cx="0"
        cy="0"
        rx={halfWidth}
        ry={halfHeight}
      />
    );
  }
  return (
    <rect
      className="de-board-flowchart__node-shape"
      x={-halfWidth}
      y={-halfHeight}
      width={node.width}
      height={node.height}
      rx={node.shape === 'stadium' ? halfHeight : node.shape === 'round' || hasBoardClass(node.classes, 'deBoardDetail') ? 18 : 12}
      ry={node.shape === 'stadium' ? halfHeight : node.shape === 'round' || hasBoardClass(node.classes, 'deBoardDetail') ? 18 : 12}
    />
  );
}

async function parseMermaidFlowchart(source: string): Promise<ParsedFlowGraph> {
  const resolved = resolvedGraphs.get(source);
  if (resolved) return resolved;
  const pending = pendingGraphs.get(source);
  if (pending) return pending;

  let resolveRequest!: (graph: ParsedFlowGraph) => void;
  let rejectRequest!: (error: unknown) => void;
  const request = new Promise<ParsedFlowGraph>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  pendingGraphs.set(source, request);

  parseQueue = parseQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const module = await import('mermaid');
        const mermaid = module.default;
        if (!mermaidInitialized) {
          mermaid.initialize({startOnLoad: false, securityLevel: 'strict'});
          mermaidInitialized = true;
        }
        const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
        const db = diagram.db as unknown as {
          getDirection?: () => string | undefined;
          getEdges?: () => Array<{
            classes?: string[];
            end: string;
            id?: string;
            labelType?: string;
            start: string;
            stroke?: string;
            text?: string;
            type?: string;
          }>;
          getVertices?: () => Map<
            string,
            {
              classes?: string[];
              id: string;
              text?: string;
              type?: string;
            }
          >;
        };
        if (!db.getVertices || !db.getEdges) {
          throw new Error('当前仅支持 Mermaid 11 flowchart 语法');
        }
        const nodes = [...db.getVertices().values()].map<ParsedFlowNode>((vertex) => {
          const classes = vertex.classes ?? [];
          return {
            classes,
            id: vertex.id,
            label: normalizeLabel(vertex.text ?? vertex.id),
            shape: resolveShape(vertex.type),
            tone: resolveTone(classes),
          };
        });
        const edges = db.getEdges().map<ParsedFlowEdge>((edge, index) => ({
          arrow: edge.type !== 'open',
          id: edge.id ?? `${edge.start}-${edge.end}-${index}`,
          label: normalizeLabel(edge.text ?? ''),
          sourceId: edge.start,
          stroke: resolveStroke(edge.stroke),
          targetId: edge.end,
        }));
        const direction = resolveDirection(db.getDirection?.());
        const graph = {direction, edges, nodes} satisfies ParsedFlowGraph;
        resolvedGraphs.set(source, graph);
        resolveRequest(graph);
      } catch (error) {
        rejectRequest(error);
      } finally {
        pendingGraphs.delete(source);
      }
    });

  return request;
}

function layoutFlowGraph(
  graph: ParsedFlowGraph,
  patches: Map<string, DiagramNodePatch>,
  boardLayout?: DiagramBoardLayout,
): LayoutGraph {
  const measuredNodes = graph.nodes.map((node) => {
    const patch = patches.get(node.id);
    const label = patch?.label ?? node.label;
    const authoredNode = boardLayout?.nodes[node.id];
    const measured = measureNode(label, node.shape, node.classes);
    const size = {
      height: authoredNode?.height ?? measured.height,
      width: authoredNode?.width ?? measured.width,
    };
    return {...node, label, placeholder: node.placeholder && patch?.label === undefined, ...size};
  });
  // Dotted return edges are visual feedback loops. They must not turn an
  // otherwise forward flow into a cyclic rank graph and reshuffle the cards.
  const edges = applyBoardEdgeLayout(graph.edges, boardLayout);
  const ranks = assignRanks(measuredNodes, edges.filter((edge) => !isFeedbackEdge(edge)));
  const groups = new Map<number, typeof measuredNodes>();
  measuredNodes.forEach((node) => {
    const rank = ranks.get(node.id) ?? 0;
    const group = groups.get(rank) ?? [];
    group.push(node);
    groups.set(rank, group);
  });
  const sortedRanks = [...groups.keys()].sort((first, second) => first - second);
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL';
  const rankGap = 106;
  const nodeGap = 62;
  const margin = 42;
  const rankPrimarySizes = sortedRanks.map((rank) =>
    Math.max(...(groups.get(rank) ?? []).map((node) => (horizontal ? node.width : node.height))),
  );
  const rankCrossSizes = sortedRanks.map((rank) => {
    const group = groups.get(rank) ?? [];
    return (
      group.reduce((sum, node) => sum + (horizontal ? node.height : node.width), 0) +
      Math.max(0, group.length - 1) * nodeGap
    );
  });
  const crossSize = Math.max(1, ...rankCrossSizes);
  const primarySize =
    rankPrimarySizes.reduce((sum, size) => sum + size, 0) +
    Math.max(0, rankPrimarySizes.length - 1) * rankGap;
  const automaticWidth = (horizontal ? primarySize : crossSize) + margin * 2;
  const automaticHeight = (horizontal ? crossSize : primarySize) + margin * 2;
  const width = boardLayout?.width ?? automaticWidth;
  const height = boardLayout?.height ?? automaticHeight;
  const positions = new Map<string, DiagramNodePosition>();
  let primaryCursor = margin;

  sortedRanks.forEach((rank, rankIndex) => {
    const group = groups.get(rank) ?? [];
    const rankSize = rankPrimarySizes[rankIndex];
    const primaryCenter = primaryCursor + rankSize / 2;
    let crossCursor = margin + (crossSize - rankCrossSizes[rankIndex]) / 2;
    group.forEach((node) => {
      const nodeCrossSize = horizontal ? node.height : node.width;
      const crossCenter = crossCursor + nodeCrossSize / 2;
      positions.set(
        node.id,
        horizontal
          ? {x: primaryCenter, y: crossCenter}
          : {x: crossCenter, y: primaryCenter},
      );
      crossCursor += nodeCrossSize + nodeGap;
    });
    primaryCursor += rankSize + rankGap;
  });

  const nodes = measuredNodes.map<LayoutNode>((node) => {
    const base = positions.get(node.id) ?? {x: margin + node.width / 2, y: margin + node.height / 2};
    const oriented =
      graph.direction === 'RL'
        ? {x: width - base.x, y: base.y}
        : graph.direction === 'BT'
          ? {x: base.x, y: height - base.y}
          : base;
    return {
      ...node,
      position: patches.get(node.id)?.position ?? boardLayout?.nodes[node.id]?.position ?? oriented,
    };
  });

  return {edges, height, nodes, width};
}

function applyBoardEdgeLayout(edges: ParsedFlowEdge[], boardLayout?: DiagramBoardLayout) {
  if (!boardLayout?.edges?.length) return edges;
  return edges.map((edge) => {
    const layout = findBoardEdgeLayout(edge, boardLayout);
    if (!layout) return edge;
    return {
      ...edge,
      bareLabel: layout.bareLabel ?? edge.bareLabel,
      labelAlign: layout.labelAlign ?? edge.labelAlign,
      sourceSide: layout.sourceSide ?? edge.sourceSide,
      targetSide: layout.targetSide ?? edge.targetSide,
    };
  });
}

function resolveInitialEdgePatches(edges: ParsedFlowEdge[], boardLayout?: DiagramBoardLayout) {
  const patches = new Map<string, DiagramEdgeRoutePatch>();
  if (!boardLayout?.edges?.length) return patches;
  edges.forEach((edge) => {
    const layout = findBoardEdgeLayout(edge, boardLayout);
    if (!layout?.points?.length && !layout?.labelPosition) return;
    patches.set(edge.id, {
      ...(layout.labelPosition ? {label: layout.labelPosition} : null),
      ...(layout.points?.length ? {points: layout.points} : {points: []}),
    });
  });
  return patches;
}

function findBoardEdgeLayout(edge: ParsedFlowEdge, boardLayout: DiagramBoardLayout) {
  return boardLayout.edges?.find(
    (layout) =>
      layout.sourceId === edge.sourceId &&
      layout.targetId === edge.targetId &&
      (layout.label === undefined || layout.label === edge.label),
  );
}

function appendBoardElements(
  base: LayoutGraph,
  createdNodes: DiagramCreatedNode[],
  createdEdges: DiagramCreatedEdge[],
  patches: Map<string, DiagramNodePatch>,
): LayoutGraph {
  const knownNodeIds = new Set(base.nodes.map((node) => node.id));
  const nodes = [
    ...base.nodes,
    ...createdNodes
      .filter((node) => !knownNodeIds.has(node.id))
      .map<LayoutNode>((node) => {
        const patch = patches.get(node.id);
        const label = patch?.label ?? node.label;
        return {
          classes: [],
          id: node.id,
          label,
          placeholder: node.placeholder && patch?.label === undefined,
          position: patch?.position ?? node.position,
          shape: node.shape,
          tone: node.tone,
          ...measureNode(label, node.shape),
        };
      }),
  ];
  const bounds = getLayoutBounds(nodes, 42);
  return {
    edges: [
      ...base.edges,
      ...createdEdges.map<ParsedFlowEdge>((edge) => ({
        arrow: true,
        id: edge.id,
        label: '',
        sourceId: edge.sourceId,
        sourceSide: edge.sourceSide,
        stroke: 'normal',
        targetId: edge.targetId,
        targetSide: edge.targetSide,
      })),
    ],
    height: Math.max(base.height, bounds.height + Math.max(0, -bounds.top)),
    nodes,
    width: Math.max(base.width, bounds.width + Math.max(0, -bounds.left)),
  };
}

function ensureLayoutNodePositions(graph: LayoutGraph): LayoutGraph {
  let repairedNodes = 0;
  const nodes = graph.nodes.map((node) => {
    if (isFinitePosition(node.position)) return node;
    const fallback = {
      x: graph.width + 96 + repairedNodes * (node.width + 42),
      y: Math.max(84, graph.height / 2),
    };
    repairedNodes += 1;
    return {...node, position: fallback};
  });
  return repairedNodes > 0 ? {...graph, nodes} : graph;
}

function isFinitePosition(value: DiagramNodePosition | undefined): value is DiagramNodePosition {
  return value !== undefined && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function assignRanks(nodes: ParsedFlowNode[], edges: ParsedFlowEdge[]) {
  const ranks = new Map(nodes.map((node) => [node.id, 0]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  edges.forEach((edge) => {
    if (!incoming.has(edge.targetId) || !outgoing.has(edge.sourceId)) return;
    incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
    outgoing.get(edge.sourceId)?.push(edge.targetId);
  });
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    visited.add(id);
    (outgoing.get(id) ?? []).forEach((targetId) => {
      ranks.set(targetId, Math.max(ranks.get(targetId) ?? 0, (ranks.get(id) ?? 0) + 1));
      incoming.set(targetId, (incoming.get(targetId) ?? 1) - 1);
      if (incoming.get(targetId) === 0) queue.push(targetId);
    });
  }
  nodes.forEach((node, index) => {
    if (!visited.has(node.id)) ranks.set(node.id, Math.max(ranks.get(node.id) ?? 0, index));
  });
  return ranks;
}

function routeDraftConnection(
  source: LayoutNode,
  target: LayoutNode | undefined,
  draft: ConnectionDraft,
  obstacles: LayoutNode[],
) {
  if (target) {
    return routeEdge(
      source,
      target,
      draft.sourceSide,
      draft.targetSide,
      0,
      0,
      0,
      true,
      obstacles,
    );
  }
  const targetVector = sideVector(draft.targetSide);
  const virtualTarget: LayoutNode = {
    classes: [],
    height: 0,
    id: '__connection-draft-target__',
    label: '',
    position: {
      x: draft.end.x - targetVector.x * 14,
      y: draft.end.y - targetVector.y * 14,
    },
    shape: 'rect',
    tone: 'neutral',
    width: 0,
  };
  return routeEdge(
    source,
    virtualTarget,
    draft.sourceSide,
    draft.targetSide,
    0,
    0,
    0,
    true,
    obstacles,
  );
}

function nearestAnchorSide(node: LayoutNode, point: DiagramNodePosition): AnchorSide {
  const normalizedX = (point.x - node.position.x) / Math.max(1, node.width / 2);
  const normalizedY = (point.y - node.position.y) / Math.max(1, node.height / 2);
  if (Math.abs(normalizedX) >= Math.abs(normalizedY)) return normalizedX >= 0 ? 'right' : 'left';
  return normalizedY >= 0 ? 'bottom' : 'top';
}

function resolveDraftTargetSide(
  source: LayoutNode | undefined,
  point: DiagramNodePosition,
): AnchorSide {
  if (!source) return 'left';
  const deltaX = point.x - source.position.x;
  const deltaY = point.y - source.position.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? 'left' : 'right';
  return deltaY >= 0 ? 'top' : 'bottom';
}

function oppositeSide(side: AnchorSide): AnchorSide {
  if (side === 'top') return 'bottom';
  if (side === 'right') return 'left';
  if (side === 'bottom') return 'top';
  return 'right';
}

type RoutedEdgeCandidate = {
  edge: ParsedFlowEdge;
  index: number;
  source: LayoutNode;
  sourceOffset: number;
  sourceSide: AnchorSide;
  target: LayoutNode;
  targetOffset: number;
  targetSide: AnchorSide;
};

function routeGraphEdges(
  nodes: LayoutNode[],
  edges: ParsedFlowEdge[],
  edgePatches: Map<string, DiagramEdgeRoutePatch>,
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const candidates = edges.flatMap<RoutedEdgeCandidate>((edge, index) => {
    if (edge.stroke === 'invisible') return [];
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    if (!source || !target) return [];
    const sides = resolveAnchorSides(source, target);
    return [
      {
        edge,
        index,
        source,
        sourceOffset: 0,
        sourceSide: edge.sourceSide ?? sides.source,
        target,
        targetOffset: 0,
        targetSide: edge.targetSide ?? sides.target,
      },
    ];
  });

  const portGroups = new Map<
    string,
    Array<{
      candidate: RoutedEdgeCandidate;
      node: LayoutNode;
      projection: number;
      role: 'source' | 'target';
      side: AnchorSide;
    }>
  >();

  const addPort = (
    candidate: RoutedEdgeCandidate,
    node: LayoutNode,
    neighbor: LayoutNode,
    side: AnchorSide,
    role: 'source' | 'target',
  ) => {
    const key = `${node.id}:${side}`;
    const group = portGroups.get(key) ?? [];
    group.push({
      candidate,
      node,
      projection:
        side === 'top' || side === 'bottom' ? neighbor.position.x : neighbor.position.y,
      role,
      side,
    });
    portGroups.set(key, group);
  };

  candidates.forEach((candidate) => {
    addPort(candidate, candidate.source, candidate.target, candidate.sourceSide, 'source');
    addPort(candidate, candidate.target, candidate.source, candidate.targetSide, 'target');
  });

  // A Board anchor is a shared pin. Parallel edges intentionally leave from the
  // exact same point instead of gaining per-edge padding along the node boundary.
  portGroups.forEach((ports) => {
    ports.forEach((port) => {
      if (port.role === 'source') port.candidate.sourceOffset = 0;
      else port.candidate.targetOffset = 0;
    });
  });

  return candidates.map((candidate) => ({
    edge: candidate.edge,
    route: applyEdgeRoutePatch(
      routeEdge(
        candidate.source,
        candidate.target,
        candidate.sourceSide,
        candidate.targetSide,
        candidate.sourceOffset,
        candidate.targetOffset,
        candidate.source.id === candidate.target.id ? candidate.index : 0,
        candidate.edge.arrow,
        nodes,
      ),
      edgePatches.get(candidate.edge.id),
      candidate.edge.arrow,
    ),
  }));
}

function resolveAnchorSides(source: LayoutNode, target: LayoutNode) {
  if (source.id === target.id) {
    return {source: 'right' as const, target: 'top' as const};
  }
  const deltaX = target.position.x - source.position.x;
  const deltaY = target.position.y - source.position.y;
  const horizontalScore = Math.abs(deltaX) / Math.max(1, (source.width + target.width) / 2);
  const verticalScore = Math.abs(deltaY) / Math.max(1, (source.height + target.height) / 2);
  if (horizontalScore >= verticalScore) {
    return deltaX >= 0
      ? {source: 'right' as const, target: 'left' as const}
      : {source: 'left' as const, target: 'right' as const};
  }
  return deltaY >= 0
    ? {source: 'bottom' as const, target: 'top' as const}
    : {source: 'top' as const, target: 'bottom' as const};
}

function routeEdge(
  source: LayoutNode,
  target: LayoutNode,
  sourceSide: AnchorSide,
  targetSide: AnchorSide,
  sourceOffset: number,
  targetOffset: number,
  laneIndex: number,
  arrow: boolean,
  obstacles: LayoutNode[],
): EdgeRoute {
  const sourceGap = 10;
  const targetGap = 14;
  if (source.id === target.id) {
    const right = source.position.x + source.width / 2;
    const top = source.position.y - source.height / 2;
    const points = [
      {x: right + sourceGap, y: source.position.y - 10},
      {x: right + 58 + (laneIndex % 4) * 6, y: source.position.y - 10},
      {x: right + 58 + (laneIndex % 4) * 6, y: top - 48},
      {x: source.position.x, y: top - 48},
      {x: source.position.x, y: top - targetGap},
    ];
    return finalizeEdgeRoute(points, arrow, sourceSide, targetSide);
  }

  const rawStart = anchorPoint(source, sourceSide, sourceOffset, 0);
  const rawTip = anchorPoint(target, targetSide, targetOffset, 0);
  if (isDirectFacingRoute(rawStart, rawTip, sourceSide, targetSide)) {
    const clearance = Math.max(0, distanceAlongSide(rawStart, rawTip, sourceSide));
    // Keep a visible shaft on close neighbouring cards while retaining a gap at
    // both anchors. Fixed 10/14 px stubs would otherwise consume the whole gap.
    const directSourceGap = Math.min(sourceGap, Math.max(2, clearance * 0.16));
    const directTargetGap = Math.min(targetGap, Math.max(4, clearance * 0.22));
    return finalizeEdgeRoute(
      [
        anchorPoint(source, sourceSide, sourceOffset, directSourceGap),
        anchorPoint(target, targetSide, targetOffset, directTargetGap),
      ],
      arrow,
      sourceSide,
      targetSide,
    );
  }
  const start = anchorPoint(source, sourceSide, sourceOffset, sourceGap);
  const tip = anchorPoint(target, targetSide, targetOffset, targetGap);
  const sourceVector = sideVector(sourceSide);
  const targetVector = sideVector(targetSide);
  const approach = 32 + (laneIndex % 3) * 5;
  const sourceStub = {
    x: start.x + sourceVector.x * approach,
    y: start.y + sourceVector.y * approach,
  };
  const targetStub = {
    x: tip.x + targetVector.x * approach,
    y: tip.y + targetVector.y * approach,
  };
  const sourceHorizontal = sourceSide === 'left' || sourceSide === 'right';
  const targetHorizontal = targetSide === 'left' || targetSide === 'right';
  const obstacleRoute = findObstacleAvoidingRoute(
    sourceStub,
    targetStub,
    obstacles,
    sourceSide,
    targetSide,
    14 + (laneIndex % 3) * 3,
  );
  let points: DiagramNodePosition[];

  if (obstacleRoute) {
    points = [start, ...obstacleRoute, tip];
  } else if (sourceHorizontal !== targetHorizontal) {
    points = sourceHorizontal
      ? [start, sourceStub, {x: targetStub.x, y: sourceStub.y}, targetStub, tip]
      : [start, sourceStub, {x: sourceStub.x, y: targetStub.y}, targetStub, tip];
  } else if (sourceHorizontal) {
    const facing =
      (sourceSide === 'right' && targetSide === 'left' && sourceStub.x <= targetStub.x) ||
      (sourceSide === 'left' && targetSide === 'right' && sourceStub.x >= targetStub.x);
    if (facing) {
      const middleX = (sourceStub.x + targetStub.x) / 2;
      points = [
        start,
        sourceStub,
        {x: middleX, y: sourceStub.y},
        {x: middleX, y: targetStub.y},
        targetStub,
        tip,
      ];
    } else if (sourceSide === targetSide) {
      const laneX =
        sourceSide === 'right'
          ? Math.max(sourceStub.x, targetStub.x) + approach
          : Math.min(sourceStub.x, targetStub.x) - approach;
      points = [
        start,
        sourceStub,
        {x: laneX, y: sourceStub.y},
        {x: laneX, y: targetStub.y},
        targetStub,
        tip,
      ];
    } else {
      const laneY =
        source.position.y <= target.position.y
          ? Math.min(sourceStub.y, targetStub.y) - approach
          : Math.max(sourceStub.y, targetStub.y) + approach;
      points = [
        start,
        sourceStub,
        {x: sourceStub.x, y: laneY},
        {x: targetStub.x, y: laneY},
        targetStub,
        tip,
      ];
    }
  } else {
    const facing =
      (sourceSide === 'bottom' && targetSide === 'top' && sourceStub.y <= targetStub.y) ||
      (sourceSide === 'top' && targetSide === 'bottom' && sourceStub.y >= targetStub.y);
    if (facing) {
      const middleY = (sourceStub.y + targetStub.y) / 2;
      points = [
        start,
        sourceStub,
        {x: sourceStub.x, y: middleY},
        {x: targetStub.x, y: middleY},
        targetStub,
        tip,
      ];
    } else if (sourceSide === targetSide) {
      const laneY =
        sourceSide === 'bottom'
          ? Math.max(sourceStub.y, targetStub.y) + approach
          : Math.min(sourceStub.y, targetStub.y) - approach;
      points = [
        start,
        sourceStub,
        {x: sourceStub.x, y: laneY},
        {x: targetStub.x, y: laneY},
        targetStub,
        tip,
      ];
    } else {
      const laneX =
        source.position.x <= target.position.x
          ? Math.min(sourceStub.x, targetStub.x) - approach
          : Math.max(sourceStub.x, targetStub.x) + approach;
      points = [
        start,
        sourceStub,
        {x: laneX, y: sourceStub.y},
        {x: laneX, y: targetStub.y},
        targetStub,
        tip,
      ];
    }
  }

  return finalizeEdgeRoute(points, arrow, sourceSide, targetSide);
}

function isDirectFacingRoute(
  start: DiagramNodePosition,
  tip: DiagramNodePosition,
  sourceSide: AnchorSide,
  targetSide: AnchorSide,
) {
  if (oppositeSide(sourceSide) !== targetSide) return false;
  if (sourceSide === 'left') return Math.abs(start.y - tip.y) < 0.1 && tip.x <= start.x;
  if (sourceSide === 'right') return Math.abs(start.y - tip.y) < 0.1 && tip.x >= start.x;
  if (sourceSide === 'top') return Math.abs(start.x - tip.x) < 0.1 && tip.y <= start.y;
  return Math.abs(start.x - tip.x) < 0.1 && tip.y >= start.y;
}

function distanceAlongSide(start: DiagramNodePosition, end: DiagramNodePosition, side: AnchorSide) {
  const direction = sideVector(side);
  return (end.x - start.x) * direction.x + (end.y - start.y) * direction.y;
}

type RouteRectangle = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type RouteNeighbor = {
  direction: 1 | 2;
  distance: number;
  index: number;
};

function findObstacleAvoidingRoute(
  start: DiagramNodePosition,
  end: DiagramNodePosition,
  nodes: LayoutNode[],
  sourceSide: AnchorSide,
  targetSide: AnchorSide,
  clearance: number,
) {
  const routeWindow = {
    left: Math.min(start.x, end.x) - 180,
    right: Math.max(start.x, end.x) + 180,
    top: Math.min(start.y, end.y) - 180,
    bottom: Math.max(start.y, end.y) + 180,
  };
  const rectangles = nodes
    .map<RouteRectangle>((node) => ({
      left: node.position.x - node.width / 2 - clearance,
      right: node.position.x + node.width / 2 + clearance,
      top: node.position.y - node.height / 2 - clearance,
      bottom: node.position.y + node.height / 2 + clearance,
    }))
    .filter(
      (rectangle) =>
        rectangle.right >= routeWindow.left &&
        rectangle.left <= routeWindow.right &&
        rectangle.bottom >= routeWindow.top &&
        rectangle.top <= routeWindow.bottom,
    );
  const xValues = uniqueCoordinates([
    start.x,
    end.x,
    ...rectangles.flatMap((rectangle) => [rectangle.left, rectangle.right]),
  ]);
  const yValues = uniqueCoordinates([
    start.y,
    end.y,
    ...rectangles.flatMap((rectangle) => [rectangle.top, rectangle.bottom]),
  ]);
  const points: DiagramNodePosition[] = [];
  const pointIndexes = new Map<string, number>();
  yValues.forEach((y) => {
    xValues.forEach((x) => {
      const point = {x, y};
      if (rectangles.some((rectangle) => pointInsideRectangle(point, rectangle))) return;
      pointIndexes.set(pointKey(point), points.length);
      points.push(point);
    });
  });
  const startIndex = pointIndexes.get(pointKey(start));
  const endIndex = pointIndexes.get(pointKey(end));
  if (startIndex === undefined || endIndex === undefined) return null;

  const neighbors = Array.from({length: points.length}, () => [] as RouteNeighbor[]);
  const connectVisible = (indexes: number[], direction: 1 | 2) => {
    indexes.sort((first, second) =>
      direction === 1
        ? points[first].x - points[second].x
        : points[first].y - points[second].y,
    );
    for (let index = 1; index < indexes.length; index += 1) {
      const first = indexes[index - 1];
      const second = indexes[index];
      if (!segmentAvoidsRectangles(points[first], points[second], rectangles)) continue;
      const distance =
        Math.abs(points[first].x - points[second].x) +
        Math.abs(points[first].y - points[second].y);
      neighbors[first].push({direction, distance, index: second});
      neighbors[second].push({direction, distance, index: first});
    }
  };
  yValues.forEach((y) => {
    connectVisible(
      points.flatMap((point, index) => (Math.abs(point.y - y) < 0.05 ? [index] : [])),
      1,
    );
  });
  xValues.forEach((x) => {
    connectVisible(
      points.flatMap((point, index) => (Math.abs(point.x - x) < 0.05 ? [index] : [])),
      2,
    );
  });

  const horizontalSource = sourceSide === 'left' || sourceSide === 'right';
  const horizontalTarget = targetSide === 'left' || targetSide === 'right';
  const sourceDirection: 1 | 2 = horizontalSource ? 1 : 2;
  const targetDirection: 1 | 2 = horizontalTarget ? 1 : 2;
  const stateCount = points.length * 2;
  const distances = new Float64Array(stateCount);
  distances.fill(Number.POSITIVE_INFINITY);
  const previousStates = new Int32Array(stateCount);
  previousStates.fill(-1);
  const startState = startIndex * 2 + sourceDirection - 1;
  distances[startState] = 0;
  const queue: Array<{cost: number; state: number}> = [];
  pushRouteQueue(queue, {cost: 0, state: startState});
  const bendCost = 34;

  while (queue.length > 0) {
    const current = popRouteQueue(queue);
    if (!current || current.cost !== distances[current.state]) continue;
    const pointIndex = Math.floor(current.state / 2);
    const direction = (current.state % 2) + 1;
    neighbors[pointIndex].forEach((neighbor) => {
      const nextState = neighbor.index * 2 + neighbor.direction - 1;
      const nextCost =
        current.cost + neighbor.distance + (direction === neighbor.direction ? 0 : bendCost);
      if (nextCost >= distances[nextState]) return;
      distances[nextState] = nextCost;
      previousStates[nextState] = current.state;
      pushRouteQueue(queue, {cost: nextCost, state: nextState});
    });
  }

  const endStates = ([1, 2] as const).map((direction) => {
    const state = endIndex * 2 + direction - 1;
    return {
      cost: distances[state] + (direction === targetDirection ? 0 : bendCost),
      state,
    };
  });
  const bestEnd = endStates.sort((first, second) => first.cost - second.cost)[0];
  if (!Number.isFinite(bestEnd.cost)) return null;
  const routed: DiagramNodePosition[] = [];
  let state = bestEnd.state;
  while (state >= 0) {
    routed.push(points[Math.floor(state / 2)]);
    if (state === startState) break;
    state = previousStates[state];
  }
  if (state !== startState) return null;
  routed.reverse();
  return normalizeOrthogonalPoints(routed);
}

function uniqueCoordinates(values: number[]) {
  return [...new Set(values.map((value) => format(value)))].sort((first, second) => first - second);
}

function pointKey(point: DiagramNodePosition) {
  return `${format(point.x)}:${format(point.y)}`;
}

function pointInsideRectangle(point: DiagramNodePosition, rectangle: RouteRectangle) {
  const epsilon = 0.05;
  return (
    point.x > rectangle.left + epsilon &&
    point.x < rectangle.right - epsilon &&
    point.y > rectangle.top + epsilon &&
    point.y < rectangle.bottom - epsilon
  );
}

function segmentAvoidsRectangles(
  start: DiagramNodePosition,
  end: DiagramNodePosition,
  rectangles: RouteRectangle[],
) {
  const epsilon = 0.05;
  if (Math.abs(start.y - end.y) < epsilon) {
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    return rectangles.every(
      (rectangle) =>
        start.y <= rectangle.top + epsilon ||
        start.y >= rectangle.bottom - epsilon ||
        right <= rectangle.left + epsilon ||
        left >= rectangle.right - epsilon,
    );
  }
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  return rectangles.every(
    (rectangle) =>
      start.x <= rectangle.left + epsilon ||
      start.x >= rectangle.right - epsilon ||
      bottom <= rectangle.top + epsilon ||
      top >= rectangle.bottom - epsilon,
  );
}

function pushRouteQueue(
  queue: Array<{cost: number; state: number}>,
  item: {cost: number; state: number},
) {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].cost <= item.cost) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = item;
}

function popRouteQueue(queue: Array<{cost: number; state: number}>) {
  const first = queue[0];
  const last = queue.pop();
  if (!first || !last || queue.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= queue.length) break;
    const child = right < queue.length && queue[right].cost < queue[left].cost ? right : left;
    if (queue[child].cost >= last.cost) break;
    queue[index] = queue[child];
    index = child;
  }
  queue[index] = last;
  return first;
}

function getRouteSegmentHandles(points: DiagramNodePosition[]): EdgeRouteHandle[] {
  const handles = points
    .slice(0, -1)
    .map((start, segmentIndex) => {
      const end = points[segmentIndex + 1];
      const horizontal = Math.abs(start.y - end.y) < 0.1;
      const vertical = Math.abs(start.x - end.x) < 0.1;
      if (!horizontal && !vertical) return null;
      // Endpoint stubs remain automatic so their side/gap constraint is never broken.
      if (segmentIndex < 1 || segmentIndex > points.length - 3) return null;
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length < 20) return null;
      return {
        orientation: horizontal ? ('horizontal' as const) : ('vertical' as const),
        segmentIndex,
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        length,
      };
    })
    .filter((handle): handle is EdgeRouteHandle & {length: number} => Boolean(handle))
    .sort((first, second) => second.length - first.length)
    .slice(0, 2)
    .map(({length: _length, ...handle}) => handle);
  return handles;
}

function moveRouteSegment(
  points: DiagramNodePosition[],
  handle: EdgeRouteHandle,
  point: DiagramNodePosition,
) {
  const next = points.map((routePoint) => ({...routePoint}));
  const start = next[handle.segmentIndex];
  const end = next[handle.segmentIndex + 1];
  if (!start || !end) return next;
  if (handle.orientation === 'horizontal') {
    start.y = point.y;
    end.y = point.y;
  } else {
    start.x = point.x;
    end.x = point.x;
  }
  return next;
}

function sameRoutePoints(first: DiagramNodePosition[], second: DiagramNodePosition[]) {
  return (
    first.length === second.length &&
    first.every(
      (point, index) =>
        Math.abs(point.x - second[index].x) < 0.1 && Math.abs(point.y - second[index].y) < 0.1,
    )
  );
}

function finalizeEdgeRoute(
  points: DiagramNodePosition[],
  arrow: boolean,
  sourceSide: AnchorSide,
  targetSide: AnchorSide,
): EdgeRoute {
  const normalized = normalizeOrthogonalPoints(points);
  const label = polylineMidpoint(normalized);
  if (!arrow || normalized.length < 2) {
    return {label, path: orthogonalPath(normalized), points: normalized, sourceSide, targetSide};
  }
  const tip = normalized.at(-1);
  const previous = normalized.at(-2);
  if (!tip || !previous) {
    return {label, path: orthogonalPath(normalized), points: normalized, sourceSide, targetSide};
  }
  const segmentLength = Math.hypot(tip.x - previous.x, tip.y - previous.y);
  if (segmentLength < 1) {
    return {label, path: orthogonalPath(normalized), points: normalized, sourceSide, targetSide};
  }
  const direction = {
    x: (tip.x - previous.x) / segmentLength,
    y: (tip.y - previous.y) / segmentLength,
  };
  const arrowLength = Math.min(11, Math.max(6, segmentLength * 0.58));
  const halfWidth = arrowLength * 0.52;
  const base = {
    x: tip.x - direction.x * arrowLength,
    y: tip.y - direction.y * arrowLength,
  };
  const shaftPoints = normalizeOrthogonalPoints([...normalized.slice(0, -1), base]);
  const left = {x: base.x - direction.y * halfWidth, y: base.y + direction.x * halfWidth};
  const right = {x: base.x + direction.y * halfWidth, y: base.y - direction.x * halfWidth};
  return {
    arrowPoints: [tip, left, right]
      .map((point) => `${format(point.x)},${format(point.y)}`)
      .join(' '),
    label,
    path: orthogonalPath(shaftPoints),
    points: normalized,
    sourceSide,
    targetSide,
  };
}

function applyEdgeRoutePatch(
  automatic: EdgeRoute,
  patch: DiagramEdgeRoutePatch | undefined,
  arrow: boolean,
): EdgeRoute {
  if (!patch) return automatic;
  if (patch.points.length < 2 || automatic.points.length < 2) {
    return patch.label ? {...automatic, label: patch.label} : automatic;
  }
  const start = automatic.points[0];
  const end = automatic.points.at(-1);
  if (!start || !end) return patch.label ? {...automatic, label: patch.label} : automatic;
  const points = normalizeOrthogonalPoints([start, ...patch.points.slice(1, -1), end]);
  if (!isOrthogonalRoute(points)) return patch.label ? {...automatic, label: patch.label} : automatic;
  const route = finalizeEdgeRoute(points, arrow, automatic.sourceSide, automatic.targetSide);
  return patch.label ? {...route, label: patch.label} : route;
}

function translateEdgeRoutePatch(
  patch: DiagramEdgeRoutePatch,
  delta: DiagramNodePosition,
): DiagramEdgeRoutePatch {
  return {
    ...(patch.label
      ? {label: {x: patch.label.x + delta.x, y: patch.label.y + delta.y}}
      : null),
    points: patch.points.map((point) => ({x: point.x + delta.x, y: point.y + delta.y})),
  };
}

function isOrthogonalRoute(points: DiagramNodePosition[]) {
  return points.slice(1).every((point, index) => {
    const previous = points[index];
    return Math.abs(point.x - previous.x) < 0.1 || Math.abs(point.y - previous.y) < 0.1;
  });
}

function normalizeOrthogonalPoints(points: DiagramNodePosition[]) {
  const deduplicated = points.filter(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - points[index - 1].x) >= 0.1 ||
      Math.abs(point.y - points[index - 1].y) >= 0.1,
  );
  const normalized: DiagramNodePosition[] = [];
  deduplicated.forEach((point) => {
    const previous = normalized.at(-1);
    const beforePrevious = normalized.at(-2);
    if (
      previous &&
      beforePrevious &&
      ((Math.abs(beforePrevious.x - previous.x) < 0.1 && Math.abs(previous.x - point.x) < 0.1) ||
        (Math.abs(beforePrevious.y - previous.y) < 0.1 && Math.abs(previous.y - point.y) < 0.1))
    ) {
      normalized[normalized.length - 1] = point;
    } else {
      normalized.push(point);
    }
  });
  return normalized;
}

function portOffsetLimit(node: LayoutNode, side: AnchorSide) {
  const halfSpan = side === 'top' || side === 'bottom' ? node.width / 2 : node.height / 2;
  const inset = node.shape === 'circle' || node.shape === 'diamond' ? halfSpan * 0.38 : 16;
  return Math.max(0, halfSpan - inset);
}

function anchorPoint(node: LayoutNode, side: AnchorSide, requestedOffset: number, gap: number) {
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  const offset = clamp(requestedOffset, -portOffsetLimit(node, side), portOffsetLimit(node, side));
  let boundary: DiagramNodePosition;
  if (side === 'top' || side === 'bottom') {
    let boundaryY = halfHeight;
    if (node.shape === 'circle') {
      boundaryY = halfHeight * Math.sqrt(Math.max(0, 1 - (offset * offset) / (halfWidth * halfWidth)));
    } else if (node.shape === 'diamond') {
      boundaryY = halfHeight * (1 - Math.min(1, Math.abs(offset) / halfWidth));
    }
    boundary = {
      x: node.position.x + offset,
      y: node.position.y + (side === 'bottom' ? boundaryY : -boundaryY),
    };
  } else {
    let boundaryX = halfWidth;
    if (node.shape === 'circle') {
      boundaryX = halfWidth * Math.sqrt(Math.max(0, 1 - (offset * offset) / (halfHeight * halfHeight)));
    } else if (node.shape === 'diamond') {
      boundaryX = halfWidth * (1 - Math.min(1, Math.abs(offset) / halfHeight));
    }
    boundary = {
      x: node.position.x + (side === 'right' ? boundaryX : -boundaryX),
      y: node.position.y + offset,
    };
  }
  const vector = sideVector(side);
  return {x: boundary.x + vector.x * gap, y: boundary.y + vector.y * gap};
}

function sideVector(side: AnchorSide) {
  if (side === 'top') return {x: 0, y: -1};
  if (side === 'right') return {x: 1, y: 0};
  if (side === 'bottom') return {x: 0, y: 1};
  return {x: -1, y: 0};
}

function orthogonalPath(points: DiagramNodePosition[]) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${format(points[0].x)} ${format(points[0].y)} L ${format(points[1].x)} ${format(points[1].y)}`;
  }
  const commands = [`M ${format(points[0].x)} ${format(points[0].y)}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incomingLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(10, incomingLength / 2, outgoingLength / 2);
    if (radius < 0.5) {
      commands.push(`L ${format(corner.x)} ${format(corner.y)}`);
      continue;
    }
    const before = {
      x: corner.x + ((previous.x - corner.x) / incomingLength) * radius,
      y: corner.y + ((previous.y - corner.y) / incomingLength) * radius,
    };
    const after = {
      x: corner.x + ((next.x - corner.x) / outgoingLength) * radius,
      y: corner.y + ((next.y - corner.y) / outgoingLength) * radius,
    };
    const incoming = {x: corner.x - previous.x, y: corner.y - previous.y};
    const outgoing = {x: next.x - corner.x, y: next.y - corner.y};
    const sweep = incoming.x * outgoing.y - incoming.y * outgoing.x > 0 ? 1 : 0;
    commands.push(
      `L ${format(before.x)} ${format(before.y)} A ${format(radius)} ${format(radius)} 0 0 ${sweep} ${format(after.x)} ${format(after.y)}`,
    );
  }
  const end = points.at(-1);
  if (end) commands.push(`L ${format(end.x)} ${format(end.y)}`);
  return commands.join(' ');
}

function polylineMidpoint(points: DiagramNodePosition[]) {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return {length: Math.hypot(point.x - start.x, point.y - start.y), start, end: point};
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = total / 2;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }
    remaining -= segment.length;
  }
  return points.at(-1) ?? {x: 0, y: 0};
}

function snapNodePosition(
  nodes: LayoutNode[],
  movingNode: LayoutNode,
  requested: DiagramNodePosition,
) {
  const threshold = 6;
  let bestX: {distance: number; guide: number; offset: number} | undefined;
  let bestY: {distance: number; guide: number; offset: number} | undefined;
  const movingX = [requested.x - movingNode.width / 2, requested.x, requested.x + movingNode.width / 2];
  const movingY = [requested.y - movingNode.height / 2, requested.y, requested.y + movingNode.height / 2];
  nodes.forEach((candidate) => {
    if (candidate.id === movingNode.id) return;
    const candidateX = [
      candidate.position.x - candidate.width / 2,
      candidate.position.x,
      candidate.position.x + candidate.width / 2,
    ];
    const candidateY = [
      candidate.position.y - candidate.height / 2,
      candidate.position.y,
      candidate.position.y + candidate.height / 2,
    ];
    movingX.forEach((movingValue) => {
      candidateX.forEach((candidateValue) => {
        const offset = candidateValue - movingValue;
        const distance = Math.abs(offset);
        if (distance <= threshold && (!bestX || distance < bestX.distance)) {
          bestX = {distance, guide: candidateValue, offset};
        }
      });
    });
    movingY.forEach((movingValue) => {
      candidateY.forEach((candidateValue) => {
        const offset = candidateValue - movingValue;
        const distance = Math.abs(offset);
        if (distance <= threshold && (!bestY || distance < bestY.distance)) {
          bestY = {distance, guide: candidateValue, offset};
        }
      });
    });
  });
  return {
    guides: {x: bestX?.guide, y: bestY?.guide} satisfies AlignmentGuides,
    position: {
      x: requested.x + (bestX?.offset ?? 0),
      y: requested.y + (bestY?.offset ?? 0),
    },
  };
}

function getLayoutBounds(nodes: LayoutNode[], padding: number) {
  if (nodes.length === 0) return {height: 120, left: 0, top: 0, width: 320};
  const left = Math.min(...nodes.map((node) => node.position.x - node.width / 2)) - padding;
  const right = Math.max(...nodes.map((node) => node.position.x + node.width / 2)) + padding;
  const top = Math.min(...nodes.map((node) => node.position.y - node.height / 2)) - padding;
  const bottom = Math.max(...nodes.map((node) => node.position.y + node.height / 2)) + padding;
  return {height: bottom - top, left, top, width: right - left};
}

function measureNode(label: string, shape: FlowNodeShape, classes: string[] = []) {
  const detailLabel = hasBoardClass(classes, 'deBoardDetail');
  const gate = resolveNodeBadge(classes);
  const wideCard = hasBoardClass(classes, 'deBoardWide');
  const lines = label.split('\n');
  const contentWidth = Math.max(
    ...lines.map((line, index) => measureTextWidth(line) * (detailLabel && index > 0 ? 0.86 : 1)),
    36,
  );
  const minimumWidth = gate ? 204 : wideCard ? 200 : detailLabel ? 150 : shape === 'stadium' ? 92 : 118;
  const baseWidth = Math.max(minimumWidth, Math.min(240, contentWidth + (detailLabel ? 46 : 38)));
  const baseHeight = gate ? 140 : Math.max(detailLabel ? 82 : 54, lines.length * 20 + (detailLabel ? 34 : 24));
  if (shape === 'circle' || shape === 'diamond') {
    if (shape === 'diamond' && gate) return {height: baseHeight, width: baseWidth};
    const diameter = Math.max(baseWidth, baseHeight + 22);
    return {height: diameter, width: diameter};
  }
  return {height: baseHeight, width: baseWidth};
}

function roundedDiamondPath(halfWidth: number, halfHeight: number) {
  return [
    `M 0 ${-halfHeight}`,
    `Q ${halfWidth * 0.088} ${-halfHeight} ${halfWidth * 0.186} ${-halfHeight * 0.886}`,
    `L ${halfWidth * 0.882} ${-halfHeight * 0.214}`,
    `Q ${halfWidth} ${-halfHeight * 0.114} ${halfWidth} 0`,
    `Q ${halfWidth} ${halfHeight * 0.114} ${halfWidth * 0.882} ${halfHeight * 0.214}`,
    `L ${halfWidth * 0.186} ${halfHeight * 0.886}`,
    `Q ${halfWidth * 0.088} ${halfHeight} 0 ${halfHeight}`,
    `Q ${-halfWidth * 0.088} ${halfHeight} ${-halfWidth * 0.186} ${halfHeight * 0.886}`,
    `L ${-halfWidth * 0.882} ${halfHeight * 0.214}`,
    `Q ${-halfWidth} ${halfHeight * 0.114} ${-halfWidth} 0`,
    `Q ${-halfWidth} ${-halfHeight * 0.114} ${-halfWidth * 0.882} ${-halfHeight * 0.214}`,
    `L ${-halfWidth * 0.186} ${-halfHeight * 0.886}`,
    `Q ${-halfWidth * 0.088} ${-halfHeight} 0 ${-halfHeight}`,
    'Z',
  ].join(' ');
}

function hasBoardClass(classes: string[], className: string) {
  return classes.some((value) => value.toLowerCase() === className.toLowerCase());
}

function resolveNodeBadge(classes: string[]) {
  if (hasBoardClass(classes, 'deBoardGateOne')) return '门槛 01';
  if (hasBoardClass(classes, 'deBoardGateTwo')) return '门槛 02';
  return null;
}

function measureBadgeWidth(value: string) {
  const textWidth = [...value].reduce((width, character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === ' ') return width + 3.8;
    return width + (codePoint > 0xff ? 11 : /[A-Z0-9]/.test(character) ? 6.5 : 5.8);
  }, 0);
  return Math.max(68, Math.ceil(textWidth + 24));
}

function isFeedbackEdge(edge: ParsedFlowEdge) {
  return edge.stroke === 'dotted' && /复测|反馈|回流|迭代/.test(edge.label);
}

function measureTextWidth(value: string) {
  return [...value].reduce((width, character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return width + (codePoint > 0xff ? 14 : /[A-Z0-9]/.test(character) ? 8.2 : 7.2);
  }, 0);
}

function clientPointToSvg(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix.inverse());
}

function normalizeLabel(value: string) {
  const withBreaks = value.replace(/<br\s*\/?\s*>/gi, '\n');
  const withoutMarkup = withBreaks
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/^['"]|['"]$/g, '');
  if (typeof document === 'undefined') return withoutMarkup.trim();
  const textarea = document.createElement('textarea');
  textarea.innerHTML = withoutMarkup;
  return textarea.value.trim();
}

function resolveDirection(value: string | undefined): FlowDirection {
  return value === 'RL' || value === 'TB' || value === 'TD' || value === 'BT'
    ? value === 'TD'
      ? 'TB'
      : value
    : 'LR';
}

function resolveShape(value: string | undefined): FlowNodeShape {
  if (value === 'diamond' || value === 'diam') return 'diamond';
  if (value === 'circle' || value === 'doublecircle' || value === 'ellipse') return 'circle';
  if (value === 'stadium' || value === 'terminal') return 'stadium';
  if (value === 'round' || value === 'rounded') return 'round';
  return 'rect';
}

function resolveTone(classes: string[]): FlowNodeTone {
  const value = classes.join(' ').toLowerCase();
  if (value.includes('purple')) return 'purple';
  if (value.includes('teal')) return 'teal';
  if (value.includes('green')) return 'green';
  if (value.includes('orange')) return 'orange';
  if (value.includes('blue')) return 'blue';
  return 'neutral';
}

function resolveStroke(value: string | undefined): ParsedFlowEdge['stroke'] {
  return value === 'thick' || value === 'dotted' || value === 'invisible' ? value : 'normal';
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function format(value: number | undefined | null) {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Number(safeValue.toFixed(2));
}
