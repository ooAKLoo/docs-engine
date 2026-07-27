'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assignDiagramEdgeLanes, calculateAdaptiveRankGaps, compactDiagramEdgeLabelMetrics, measureDiagramEdgeLabel, measureDiagramTextWidth, placeDiagramEdgeLabels, } from './BoardAutoLayout.js';
import { detectBoardFeedbackEdgeIds, } from './BoardModel.js';
import { hasBoardClass, measureBadgeWidth, measureNode, resolveNodeBadge, } from './BoardNodeMetrics.js';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const DIRECT_ROUTE_LABEL_RESERVE = 47;
const PAIRED_ROUTE_LABEL_RESERVE = 108;
const PAIRED_LANE_BASE_OFFSET = 32;
const PAIRED_LANE_STEP = 30;
const EDGE_SOURCE_PORT_GAP = 10;
const EDGE_TARGET_PORT_GAP = 16;
const MICRO_JOG_THRESHOLD = 16;
const EDGE_BUNDLE_TRUNK_LENGTH = 42;
const EDGE_BUNDLE_MINIMUM_TRUNK_LENGTH = 18;
const EDGE_BUNDLE_ROUTE_LABEL_RESERVE = DIRECT_ROUTE_LABEL_RESERVE + EDGE_BUNDLE_TRUNK_LENGTH;
const ORTHOGONAL_CORNER_RADIUS = 10;
const EDGE_BUNDLE_CORNER_LEG = ORTHOGONAL_CORNER_RADIUS * 2;
const FEEDBACK_LANE_GAP = 24;
export function BoardCanvas({ accessibleLabel, document: boardDocument, editable, editingNodeId, fitContent = false, onChange, onConnect, onConnectionDrop, onEdgeRouteChange, onEditRequest, onReady, onSelectNode, onSelectEdge, panActive, selectedEdgeId = null, selectedNodeIds = [], }) {
    const svgRef = useRef(null);
    const dragRef = useRef(null);
    const connectionDraftRef = useRef(null);
    const edgeRouteDragRef = useRef(null);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [activePortNodeId, setActivePortNodeId] = useState(null);
    const [activePositions, setActivePositions] = useState(null);
    const [guides, setGuides] = useState({});
    const [connectionDraft, setConnectionDraft] = useState(null);
    const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
    const [activeEdgeRoute, setActiveEdgeRoute] = useState(null);
    const [measuredEdgeLabels, setMeasuredEdgeLabels] = useState(() => new Map());
    const recordEdgeLabelMeasurement = useCallback((edgeId, label, metrics) => {
        setMeasuredEdgeLabels((current) => {
            const previous = current.get(edgeId);
            // The measured box feeds auto-layout, which can in turn choose another
            // wrapping width for this same label. Keep the first measured wrapping
            // stable for a source label so a short carrier cannot oscillate between
            // two line-break strategies and trigger nested React updates.
            if (previous?.label === label && !sameTextLines(previous.lines, metrics.lines)) {
                return current;
            }
            if (previous?.label === label &&
                Math.abs(previous.width - metrics.width) < 0.25 &&
                Math.abs(previous.height - metrics.height) < 0.25 &&
                sameTextLines(previous.lines, metrics.lines)) {
                return current;
            }
            const next = new Map(current);
            next.set(edgeId, { ...metrics, label });
            return next;
        });
    }, []);
    const layout = useMemo(() => {
        const graph = ensureLayoutNodePositions(layoutDiagramGraph(boardDocument, new Map(), documentLayout(boardDocument), measuredEdgeLabels));
        if (!activePositions || !dragRef.current)
            return graph;
        const nodes = graph.nodes.map((node) => {
            const position = activePositions.get(node.id);
            return position ? { ...node, position } : node;
        });
        return {
            ...graph,
            groups: layoutBoardGroups(boardDocument.groups ?? [], nodes),
            nodes,
        };
    }, [activePositions, boardDocument, measuredEdgeLabels]);
    const boardLayout = documentLayout(boardDocument);
    const displayBounds = useMemo(() => {
        if (!layout)
            return { height: 120, left: 0, top: 0, width: 320 };
        // A designed Board scene owns its intentional whitespace in the viewer.
        // The inline preview applies a content fit later through fitContent.
        if (boardLayout?.width && boardLayout.height) {
            return { height: boardLayout.height, left: 0, top: 0, width: boardLayout.width };
        }
        if (!fitContent) {
            return { height: layout.height, left: 0, top: 0, width: layout.width };
        }
        return getLayoutBounds(layout.nodes, 42, layout.groups);
    }, [boardLayout, fitContent, layout]);
    useEffect(() => {
        onReady?.();
    }, [boardDocument, onReady]);
    const requestEdit = (node, element) => {
        if (!editable || panActive)
            return;
        onSelectNode?.(node.id);
        const matrix = element.ownerSVGElement?.getScreenCTM();
        const shape = element.querySelector('.de-board__node-shape');
        onEditRequest?.({
            fontSize: 14 * (matrix ? Math.hypot(matrix.a, matrix.b) : 1),
            nodeId: node.id,
            label: node.label,
            placeholder: node.placeholder,
            position: { ...node.position },
            rect: shape?.getBoundingClientRect() ?? element.getBoundingClientRect(),
        });
    };
    const handlePointerDown = (event, node) => {
        if (!editable || panActive || event.button !== 0)
            return;
        const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
        if (!point)
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        const currentSelection = selectedNodeIds.includes(node.id)
            ? [...selectedNodeIds]
            : additive
                ? [...selectedNodeIds, node.id]
                : [node.id];
        const positionsStart = new Map();
        currentSelection.forEach((nodeId) => {
            const selectedNode = layout?.nodes.find((candidate) => candidate.id === nodeId);
            if (selectedNode)
                positionsStart.set(nodeId, { ...selectedNode.position });
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
    const handlePointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || !layout)
            return;
        const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
        if (!point)
            return;
        let deltaX = point.x - drag.pointerStart.x;
        let deltaY = point.y - drag.pointerStart.y;
        if (event.shiftKey) {
            if (Math.abs(deltaX) >= Math.abs(deltaY))
                deltaY = 0;
            else
                deltaX = 0;
        }
        const movingNode = layout.nodes.find((node) => node.id === drag.nodeId);
        const primaryStart = drag.positionsStart.get(drag.nodeId);
        if (!movingNode || !primaryStart)
            return;
        const selectedIds = new Set(drag.nodeIds);
        const snappingNodes = layout.nodes.filter((candidate) => candidate.id === movingNode.id || !selectedIds.has(candidate.id));
        const snapped = snapNodePosition(snappingNodes, movingNode, {
            x: primaryStart.x + deltaX,
            y: primaryStart.y + deltaY,
        });
        const snappedDelta = {
            x: snapped.position.x - primaryStart.x,
            y: snapped.position.y - primaryStart.y,
        };
        const nextPositions = new Map([...drag.positionsStart].map(([nodeId, position]) => [
            nodeId,
            { x: position.x + snappedDelta.x, y: position.y + snappedDelta.y },
        ]));
        drag.positions = nextPositions;
        setActivePositions(nextPositions);
        setGuides(snapped.guides);
    };
    const finishDrag = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        const nextPositions = drag.positions;
        const primaryStart = drag.positionsStart.get(drag.nodeId);
        const primaryEnd = nextPositions.get(drag.nodeId);
        const dragDelta = primaryStart && primaryEnd
            ? { x: primaryEnd.x - primaryStart.x, y: primaryEnd.y - primaryStart.y }
            : { x: 0, y: 0 };
        const moved = Math.abs(dragDelta.x) >= 0.5 || Math.abs(dragDelta.y) >= 0.5;
        const selectedIds = new Set(drag.nodeIds);
        const routeChanges = [];
        if (moved && layout) {
            const initialPatches = resolveInitialEdgePatches(layout.edges, boardLayout);
            layout.edges.forEach((edge) => {
                if (!selectedIds.has(edge.sourceId) || !selectedIds.has(edge.targetId))
                    return;
                const patch = initialPatches.get(edge.id);
                if (!patch)
                    return;
                routeChanges.push({ edgeId: edge.id, route: translateEdgeRoutePatch(patch, dragDelta) });
            });
        }
        dragRef.current = null;
        setActivePositions(null);
        setGuides({});
        drag.nodeIds.forEach((nodeId) => {
            const positionStart = drag.positionsStart.get(nodeId);
            const nextPosition = nextPositions.get(nodeId);
            const movedNode = layout?.nodes.find((candidate) => candidate.id === nodeId);
            if (!positionStart || !nextPosition || !movedNode)
                return;
            if (Math.abs(nextPosition.x - positionStart.x) < 0.5 &&
                Math.abs(nextPosition.y - positionStart.y) < 0.5) {
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
    const cancelDrag = (event) => {
        if (dragRef.current?.pointerId !== event.pointerId)
            return;
        dragRef.current = null;
        setActivePositions(null);
        setGuides({});
    };
    const beginConnection = (event, node, side) => {
        if (!editable || panActive || event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const end = anchorPoint(node, side, 0, 14);
        const draft = {
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
    const moveConnection = (event) => {
        const draft = connectionDraftRef.current;
        if (!draft || draft.pointerId !== event.pointerId || !layout)
            return;
        const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
        if (!point)
            return;
        const targetElement = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest('[data-de-node-id]');
        const targetId = targetElement?.dataset.deNodeId;
        const targetNode = targetId && targetId !== draft.sourceId
            ? layout.nodes.find((node) => node.id === targetId)
            : undefined;
        const targetSide = targetNode
            ? nearestAnchorSide(targetNode, point)
            : resolveDraftTargetSide(layout.nodes.find((node) => node.id === draft.sourceId), point);
        const next = {
            ...draft,
            end: point,
            targetId: targetNode?.id,
            targetSide,
        };
        connectionDraftRef.current = next;
        setConnectionDraft(next);
    };
    const finishConnection = (event) => {
        const draft = connectionDraftRef.current;
        if (!draft || draft.pointerId !== event.pointerId || !layout)
            return;
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
        }
        else if (sourceNode) {
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
    const cancelConnection = (event) => {
        if (connectionDraftRef.current?.pointerId !== event.pointerId)
            return;
        connectionDraftRef.current = null;
        setConnectionDraft(null);
        setHoveredNodeId(null);
        setActivePortNodeId(null);
    };
    const selectEdge = (event, edgeId) => {
        if (!editable || panActive || event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        onSelectEdge?.(edgeId);
    };
    const beginEdgeRouteDrag = (event, edgeId, handle, points) => {
        if (!editable || panActive || event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const copiedPoints = points.map((point) => ({ ...point }));
        edgeRouteDragRef.current = {
            edgeId,
            handle,
            initialPoints: copiedPoints,
            points: copiedPoints,
            pointerId: event.pointerId,
        };
        setActiveEdgeRoute({ edgeId, route: { points: copiedPoints } });
        onSelectEdge?.(edgeId);
    };
    const moveEdgeRouteDrag = (event) => {
        const drag = edgeRouteDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        const point = clientPointToSvg(svgRef.current, event.clientX, event.clientY);
        if (!point)
            return;
        const points = moveRouteSegment(drag.points, drag.handle, point);
        drag.points = points;
        setActiveEdgeRoute({ edgeId: drag.edgeId, route: { points } });
    };
    const finishEdgeRouteDrag = (event) => {
        const drag = edgeRouteDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        edgeRouteDragRef.current = null;
        setActiveEdgeRoute(null);
        if (!sameRoutePoints(drag.initialPoints, drag.points)) {
            onEdgeRouteChange?.({ edgeId: drag.edgeId, route: { points: drag.points } });
        }
    };
    const cancelEdgeRouteDrag = (event) => {
        if (edgeRouteDragRef.current?.pointerId !== event.pointerId)
            return;
        edgeRouteDragRef.current = null;
        setActiveEdgeRoute(null);
    };
    const nodesById = new Map(layout.nodes.map((node) => [node.id, node]));
    const routePatches = new Map(resolveInitialEdgePatches(layout.edges, boardLayout));
    const activeDrag = dragRef.current;
    if (activeDrag) {
        const primaryStart = activeDrag.positionsStart.get(activeDrag.nodeId);
        const primaryEnd = activeDrag.positions.get(activeDrag.nodeId);
        if (primaryStart && primaryEnd) {
            const delta = { x: primaryEnd.x - primaryStart.x, y: primaryEnd.y - primaryStart.y };
            const selectedIds = new Set(activeDrag.nodeIds);
            layout.edges.forEach((edge) => {
                if (!selectedIds.has(edge.sourceId) || !selectedIds.has(edge.targetId))
                    return;
                const patch = routePatches.get(edge.id);
                if (patch)
                    routePatches.set(edge.id, translateEdgeRoutePatch(patch, delta));
            });
        }
    }
    if (activeEdgeRoute)
        routePatches.set(activeEdgeRoute.edgeId, activeEdgeRoute.route);
    const routedGraph = routeGraphEdges(layout.nodes, layout.edges, routePatches, measuredEdgeLabels, boardDocument.diagramKind, boardDocument.direction);
    const routedEdges = routedGraph.edges;
    const routedTrunks = routedGraph.trunks;
    const editedContentBounds = getRenderedDiagramBounds(layout.nodes, routedEdges, 42, layout.groups);
    const renderedDisplayBounds = fitContent
        ? getEmbeddedDiagramBounds(layout.nodes, routedEdges, layout.groups)
        : boardLayout?.width && boardLayout.height
            ? unionDiagramBounds({ height: boardLayout.height, left: 0, top: 0, width: boardLayout.width }, editedContentBounds)
            : displayBounds;
    const draftSource = connectionDraft ? nodesById.get(connectionDraft.sourceId) : undefined;
    const draftTarget = connectionDraft?.targetId
        ? nodesById.get(connectionDraft.targetId)
        : undefined;
    const draftRoute = connectionDraft && draftSource
        ? routeDraftConnection(draftSource, draftTarget, connectionDraft, layout.nodes)
        : null;
    const guideBounds = getLayoutBounds(layout.nodes, 34, layout.groups);
    return (_jsx("div", { className: "de-board", "data-authored-layout": boardLayout ? 'true' : undefined, role: "img", "aria-label": accessibleLabel, children: _jsxs("svg", { ref: svgRef, className: "de-board__svg", viewBox: `${format(renderedDisplayBounds.left)} ${format(renderedDisplayBounds.top)} ${format(renderedDisplayBounds.width)} ${format(renderedDisplayBounds.height)}`, preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true", children: [layout.groups.length > 0 ? (_jsx("g", { className: "de-board__groups", children: layout.groups.map((group) => (_jsxs("g", { className: "de-board__group", "data-de-group-id": group.id, "data-tone": group.tone ?? 'neutral', children: [_jsx("rect", { x: group.bounds.left, y: group.bounds.top, width: group.bounds.right - group.bounds.left, height: group.bounds.bottom - group.bounds.top, rx: "18", ry: "18" }), _jsx("text", { x: group.bounds.left + 18, y: group.bounds.top + 24, children: group.label })] }, group.id))) })) : null, boardDocument.diagramKind === 'sequence' ? (_jsx("g", { className: "de-board__lifelines", children: layout.nodes.map((node) => (_jsx("line", { x1: node.position.x, x2: node.position.x, y1: node.position.y + node.height / 2 + 10, y2: layout.height - 28 }, `${node.id}:lifeline`))) })) : null, _jsxs("g", { className: "de-board__edges", children: [routedTrunks.map((trunk) => (_jsx("g", { className: "de-board__edge-trunk", "data-de-bundle-key": trunk.key, "data-edge-ids": trunk.edgeIds.join(' '), children: _jsx("path", { d: trunk.path, className: "de-board__edge-path", "data-stroke": trunk.stroke }) }, trunk.key))), routedEdges.map(({ edge, route }) => {
                            const sourceNode = nodesById.get(edge.sourceId);
                            const targetNode = nodesById.get(edge.targetId);
                            if (!sourceNode || !targetNode || edge.stroke === 'invisible')
                                return null;
                            const edgeSelected = selectedEdgeId === edge.id;
                            const showEdgeHandles = editable && !panActive && (edgeSelected || hoveredEdgeId === edge.id);
                            return (_jsxs("g", { className: "de-board__edge", "data-de-edge-id": edge.id, "data-feedback": isFeedbackEdge(edge) ? 'true' : undefined, "data-selected": edgeSelected ? 'true' : undefined, onPointerDown: (event) => selectEdge(event, edge.id), onPointerEnter: () => {
                                    if (editable && !panActive)
                                        setHoveredEdgeId(edge.id);
                                }, onPointerLeave: () => {
                                    if (!edgeRouteDragRef.current) {
                                        setHoveredEdgeId((current) => (current === edge.id ? null : current));
                                    }
                                }, children: [_jsx("path", { d: route.path, className: "de-board__edge-hit" }), _jsx("path", { d: route.path, className: "de-board__edge-path", "data-edge-id": edge.id, "data-feedback": isFeedbackEdge(edge) ? 'true' : undefined, "data-source-id": edge.sourceId, "data-target-id": edge.targetId, "data-stroke": edge.stroke, "data-source-side": route.sourceSide, "data-target-side": route.targetSide }), showEdgeHandles ? (_jsx("g", { className: "de-board__edge-handles", "aria-hidden": "true", children: getRouteSegmentHandles(route.points).map((handle) => (_jsxs("g", { className: "de-board__edge-handle", "data-orientation": handle.orientation, transform: `translate(${format(handle.x)} ${format(handle.y)})`, onPointerDown: (event) => beginEdgeRouteDrag(event, edge.id, handle, route.points), onPointerMove: moveEdgeRouteDrag, onPointerUp: finishEdgeRouteDrag, onPointerCancel: cancelEdgeRouteDrag, children: [_jsx("circle", { className: "de-board__edge-handle-hit", r: "12" }), _jsx("circle", { className: "de-board__edge-handle-dot", r: "4.5" })] }, `${edge.id}-${handle.segmentIndex}`))) })) : null] }, edge.id));
                        }), draftRoute ? (_jsx("g", { className: "de-board__connection-preview", "aria-hidden": "true", children: _jsx("path", { d: draftRoute.path, className: "de-board__edge-path" }) })) : null] }), _jsxs("g", { className: "de-board__arrows", children: [routedTrunks.map((trunk) => trunk.sourceArrowPoints ? (_jsx("polygon", { className: "de-board__arrow", "data-arrow-end": "source", "data-de-bundle-key": trunk.key, "data-edge-ids": trunk.edgeIds.join(' '), points: trunk.sourceArrowPoints }, `${trunk.key}:source`)) : null), routedTrunks.map((trunk) => trunk.arrowPoints ? (_jsx("polygon", { className: "de-board__arrow", "data-de-bundle-key": trunk.key, "data-edge-ids": trunk.edgeIds.join(' '), points: trunk.arrowPoints }, trunk.key)) : null), routedEdges.map(({ edge, route }) => route.sourceArrowPoints && edge.stroke !== 'invisible' ? (_jsx("polygon", { className: "de-board__arrow", "data-arrow-end": "source", "data-edge-id": edge.id, "data-feedback": isFeedbackEdge(edge) ? 'true' : undefined, points: route.sourceArrowPoints }, `${edge.id}:source`)) : null), routedEdges.map(({ edge, route }) => route.arrowPoints && edge.stroke !== 'invisible' ? (_jsx("polygon", { className: "de-board__arrow", "data-arrow-end": "target", "data-edge-id": edge.id, "data-feedback": isFeedbackEdge(edge) ? 'true' : undefined, points: route.arrowPoints }, edge.id)) : null), draftRoute?.arrowPoints ? (_jsx("g", { className: "de-board__connection-preview", children: _jsx("polygon", { className: "de-board__arrow", points: draftRoute.arrowPoints }) })) : null] }), _jsx("g", { className: "de-board__edge-labels", children: routedEdges.map(({ edge, route }) => edge.label && edge.stroke !== 'invisible' ? (_jsx(BoardEdgeLabel, { edge: edge, onMeasure: recordEdgeLabelMeasurement, route: route }, edge.id)) : null) }), guides.x !== undefined || guides.y !== undefined ? (_jsxs("g", { className: "de-board__guides", children: [guides.x !== undefined ? (_jsx("line", { x1: guides.x, x2: guides.x, y1: guideBounds.top, y2: guideBounds.top + guideBounds.height })) : null, guides.y !== undefined ? (_jsx("line", { x1: guideBounds.left, x2: guideBounds.left + guideBounds.width, y1: guides.y, y2: guides.y })) : null] })) : null, _jsx("g", { className: "de-board__nodes", children: layout.nodes.map((node) => {
                        const selected = selectedNodeIds.includes(node.id);
                        const editing = editingNodeId === node.id;
                        const badge = resolveNodeBadge(node.classes);
                        const badgeWidth = badge ? measureBadgeWidth(badge) : 0;
                        const detailLabel = hasBoardClass(node.classes, 'deBoardDetail');
                        const showPorts = editable &&
                            !panActive &&
                            !editing &&
                            ((selected && selectedNodeIds.length === 1) ||
                                hoveredNodeId === node.id ||
                                activePortNodeId === node.id ||
                                connectionDraft?.targetId === node.id);
                        return (_jsxs("g", { className: "de-board__node", "data-de-node-id": node.id, "data-selected": selected ? 'true' : undefined, "data-editing": editing ? 'true' : undefined, "data-connect-target": connectionDraft?.targetId === node.id ? 'true' : undefined, "data-badge": badge ?? undefined, "data-detail": detailLabel ? 'true' : undefined, "data-placeholder": node.placeholder ? 'true' : undefined, "data-tone": node.tone, transform: `translate(${format(node.position.x)} ${format(node.position.y)})`, role: editable ? 'button' : undefined, tabIndex: editable ? 0 : undefined, "aria-label": editable ? `图表节点：${node.label}。拖动可移动，双击可编辑。` : undefined, onPointerEnter: () => {
                                if (editable && !panActive)
                                    setHoveredNodeId(node.id);
                            }, onPointerLeave: (event) => {
                                const relatedTarget = event.relatedTarget;
                                if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget))
                                    return;
                                if (!connectionDraftRef.current)
                                    setHoveredNodeId((current) => (current === node.id ? null : current));
                            }, onPointerDown: (event) => handlePointerDown(event, node), onPointerMove: handlePointerMove, onPointerUp: finishDrag, onPointerCancel: cancelDrag, onDoubleClick: (event) => {
                                if (!editable || panActive)
                                    return;
                                event.preventDefault();
                                event.stopPropagation();
                                requestEdit(node, event.currentTarget);
                            }, onKeyDown: (event) => {
                                if (!editable || panActive)
                                    return;
                                if (event.key === 'Enter' || event.key === 'F2') {
                                    event.preventDefault();
                                    requestEdit(node, event.currentTarget);
                                    return;
                                }
                                const amount = event.shiftKey ? 1 : 8;
                                const delta = event.key === 'ArrowLeft'
                                    ? { x: -amount, y: 0 }
                                    : event.key === 'ArrowRight'
                                        ? { x: amount, y: 0 }
                                        : event.key === 'ArrowUp'
                                            ? { x: 0, y: -amount }
                                            : event.key === 'ArrowDown'
                                                ? { x: 0, y: amount }
                                                : null;
                                if (!delta)
                                    return;
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
                            }, children: [_jsx(NodeShape, { node: node }), _jsx("text", { className: "de-board__node-label", textAnchor: "middle", transform: badge ? 'translate(0 8)' : undefined, children: node.textLines.map((line, index, lines) => (_jsx("tspan", { x: "0", dy: index === 0 ? `${-(lines.length - 1) * 0.58}em` : '1.16em', children: line || ' ' }, `${node.id}-${index}`))) }), badge ? (_jsxs("g", { className: "de-board__node-badge", "aria-hidden": "true", children: [_jsx("rect", { x: -badgeWidth / 2, y: -node.height / 2 + 29, width: badgeWidth, height: 28, rx: 8 }), _jsx("text", { x: 0, y: -node.height / 2 + 43, textAnchor: "middle", children: badge })] })) : null, showPorts ? (_jsx("g", { className: "de-board__ports", "aria-hidden": "true", children: ['top', 'right', 'bottom', 'left'].map((side) => {
                                        const point = anchorPoint(node, side, 0, 16);
                                        return (_jsxs("g", { className: "de-board__port", "data-side": side, transform: `translate(${format(point.x - node.position.x)} ${format(point.y - node.position.y)})`, onPointerEnter: () => {
                                                setHoveredNodeId(node.id);
                                                setActivePortNodeId(node.id);
                                            }, onPointerLeave: (event) => {
                                                const relatedTarget = event.relatedTarget;
                                                if (relatedTarget instanceof Node && event.currentTarget.parentElement?.parentElement?.contains(relatedTarget)) {
                                                    return;
                                                }
                                                if (!connectionDraftRef.current) {
                                                    setActivePortNodeId((current) => (current === node.id ? null : current));
                                                }
                                            }, onPointerDown: (event) => {
                                                setActivePortNodeId(node.id);
                                                beginConnection(event, node, side);
                                            }, onPointerMove: moveConnection, onPointerUp: finishConnection, onPointerCancel: cancelConnection, children: [_jsx("circle", { className: "de-board__port-hit", r: "13" }), _jsx("circle", { className: "de-board__port-dot", r: "5" })] }, side));
                                    }) })) : null] }, node.id));
                    }) })] }) }));
}
function BoardEdgeLabel({ edge, onMeasure, route, }) {
    const textRef = useRef(null);
    const [measuredBounds, setMeasuredBounds] = useState(null);
    const labelAlign = edge.labelAlign ?? 'middle';
    const naturalMetrics = measureDiagramEdgeLabel(edge.label, edge.bareLabel, route.labelMaximumTextWidth);
    const floating = route.labelMode === 'floating';
    const metrics = floating
        ? compactDiagramEdgeLabelMetrics(naturalMetrics, edge.bareLabel)
        : naturalMetrics;
    const naturalPaddingX = edge.bareLabel ? 7 : 9;
    const naturalPaddingY = edge.bareLabel ? 3 : 5;
    const labelPaddingX = floating ? 2 : naturalPaddingX;
    const labelPaddingY = floating ? 1 : naturalPaddingY;
    const fallbackBoxX = labelAlign === 'start'
        ? -labelPaddingX
        : labelAlign === 'end'
            ? -metrics.width + labelPaddingX
            : -metrics.width / 2;
    const linesKey = metrics.lines.join('\n');
    const measurementKey = `${edge.label}\u0000${labelAlign}\u0000${edge.bareLabel ? 'bare' : 'pill'}\u0000${floating ? 'floating' : 'inline'}\u0000${linesKey}`;
    const activeBounds = measuredBounds?.key === measurementKey ? measuredBounds : null;
    const labelBoxX = activeBounds ? activeBounds.x - labelPaddingX : fallbackBoxX;
    const labelBoxY = activeBounds ? activeBounds.y - labelPaddingY : -metrics.height / 2;
    const labelBoxWidth = activeBounds ? activeBounds.width + labelPaddingX * 2 : metrics.width;
    const labelBoxHeight = activeBounds ? activeBounds.height + labelPaddingY * 2 : metrics.height;
    useIsomorphicLayoutEffect(() => {
        let cancelled = false;
        const measure = () => {
            const element = textRef.current;
            if (cancelled || !element)
                return;
            const bounds = element.getBBox();
            if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0)
                return;
            const nextBounds = {
                height: bounds.height,
                key: measurementKey,
                width: bounds.width,
                x: bounds.x,
                y: bounds.y,
            };
            setMeasuredBounds((current) => current?.key === nextBounds.key &&
                Math.abs(current.width - nextBounds.width) < 0.25 &&
                Math.abs(current.height - nextBounds.height) < 0.25 &&
                Math.abs(current.x - nextBounds.x) < 0.25 &&
                Math.abs(current.y - nextBounds.y) < 0.25
                ? current
                : nextBounds);
            onMeasure(edge.id, edge.label, {
                height: bounds.height + naturalPaddingY * 2,
                lines: metrics.lines,
                width: bounds.width + naturalPaddingX * 2,
            });
        };
        measure();
        const fonts = typeof document === 'undefined' ? undefined : document.fonts;
        const handleFontsLoaded = () => measure();
        fonts?.addEventListener('loadingdone', handleFontsLoaded);
        void fonts?.ready.then(measure);
        return () => {
            cancelled = true;
            fonts?.removeEventListener('loadingdone', handleFontsLoaded);
        };
    }, [edge.id, edge.label, labelAlign, linesKey, measurementKey, naturalPaddingX, naturalPaddingY, onMeasure]);
    return (_jsxs("g", { className: "de-board__edge-label", "data-bare": edge.bareLabel ? 'true' : undefined, "data-feedback": isFeedbackEdge(edge) ? 'true' : undefined, "data-floating": floating ? 'true' : undefined, transform: `translate(${format(route.label.x)} ${format(route.label.y)})`, children: [_jsx("rect", { x: labelBoxX, y: labelBoxY, width: labelBoxWidth, height: labelBoxHeight, rx: floating ? 3 : edge.bareLabel ? 7 : 8 }), _jsx("text", { ref: textRef, textAnchor: labelAlign, dominantBaseline: "central", children: metrics.lines.map((line, index, lines) => (_jsx("tspan", { x: "0", dy: index === 0 ? `${-(lines.length - 1) * 0.67}em` : '1.34em', children: line || ' ' }, `${edge.id}-label-${index}`))) })] }));
}
function NodeShape({ node }) {
    const halfWidth = node.width / 2;
    const halfHeight = node.height / 2;
    if (node.shape === 'diamond') {
        return (_jsx("path", { className: "de-board__node-shape", d: roundedDiamondPath(halfWidth, halfHeight) }));
    }
    if (node.shape === 'circle') {
        return (_jsx("ellipse", { className: "de-board__node-shape", cx: "0", cy: "0", rx: halfWidth, ry: halfHeight }));
    }
    return (_jsx("rect", { className: "de-board__node-shape", x: -halfWidth, y: -halfHeight, width: node.width, height: node.height, rx: node.shape === 'stadium' ? halfHeight : node.shape === 'round' || hasBoardClass(node.classes, 'deBoardDetail') ? 18 : 12, ry: node.shape === 'stadium' ? halfHeight : node.shape === 'round' || hasBoardClass(node.classes, 'deBoardDetail') ? 18 : 12 }));
}
function documentLayout(document) {
    const nodes = Object.fromEntries(document.nodes.flatMap((node) => node.position
        ? [[node.id, { height: node.height, position: node.position, width: node.width }]]
        : []));
    const edges = document.edges.flatMap((edge) => edge.points?.length || edge.labelPosition || edge.sourceSide || edge.targetSide
        ? [{
                bareLabel: edge.bareLabel,
                id: edge.id,
                label: edge.label,
                labelAlign: edge.labelAlign,
                labelPosition: edge.labelPosition,
                points: edge.points,
                sourceId: edge.sourceId,
                sourceSide: edge.sourceSide,
                targetId: edge.targetId,
                targetSide: edge.targetSide,
            }]
        : []);
    if (!document.canvas && Object.keys(nodes).length === 0 && edges.length === 0)
        return undefined;
    return {
        edges,
        height: document.canvas?.height,
        nodes,
        width: document.canvas?.width,
    };
}
function layoutDiagramGraph(graph, patches, boardLayout, measuredEdgeLabels = new Map()) {
    const measuredNodes = graph.nodes.map((node) => {
        const patch = patches.get(node.id);
        const label = patch?.label ?? node.label;
        const authoredNode = boardLayout?.nodes[node.id];
        const measured = measureNode(label, node.shape, node.classes, authoredNode?.width);
        const size = {
            height: authoredNode?.height ?? measured.height,
            width: authoredNode?.width ?? measured.width,
        };
        return {
            ...node,
            label,
            placeholder: node.placeholder && patch?.label === undefined,
            textLines: measured.textLines,
            ...size,
        };
    });
    const feedbackEdgeIds = graph.diagramKind === 'flowchart'
        ? detectBoardFeedbackEdgeIds(graph.edges)
        : new Set();
    const semanticEdges = graph.edges.map((edge) => ({
        ...edge,
        role: edge.role ?? (feedbackEdgeIds.has(edge.id) ? 'feedback' : 'flow'),
    }));
    // Cycle-closing edges are routed outside the main flow and must not reshuffle
    // the forward rank graph.
    const edges = applyBoardEdgeLayout(semanticEdges, boardLayout);
    if (graph.diagramKind === 'sequence') {
        return layoutSequenceDiagramGraph(measuredNodes, edges, graph.groups ?? [], boardLayout, measuredEdgeLabels);
    }
    if (hasGroupLayout(graph.groups ?? [], measuredNodes)) {
        return layoutGroupedDiagramGraph(measuredNodes, edges, graph.groups ?? [], graph.direction, patches, boardLayout, measuredEdgeLabels);
    }
    const flowEdges = edges.filter((edge) => !isFeedbackEdge(edge));
    const ranks = assignRanks(measuredNodes, flowEdges.filter((edge) => !edge.manual));
    const groups = new Map();
    measuredNodes.forEach((node) => {
        const rank = ranks.get(node.id) ?? 0;
        const group = groups.get(rank) ?? [];
        group.push(node);
        groups.set(rank, group);
    });
    const groupOrderByNode = new Map();
    (graph.groups ?? []).forEach((group, index) => {
        group.nodeIds.forEach((nodeId) => groupOrderByNode.set(nodeId, index));
    });
    groups.forEach((group) => {
        group.sort((first, second) => (groupOrderByNode.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
            (groupOrderByNode.get(second.id) ?? Number.MAX_SAFE_INTEGER));
    });
    const sortedRanks = [...groups.keys()].sort((first, second) => first - second);
    const horizontal = graph.direction === 'LR' || graph.direction === 'RL';
    const nodeGap = 62;
    const primaryMargin = 42;
    const pairLanes = assignDiagramEdgeLanes(flowEdges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
    })));
    const maximumPairLane = Math.max(0, ...[...pairLanes.values()].map((lane) => Math.abs(lane)));
    const pairLaneOffset = maximumPairLane > 0 ? pairedLaneOffset(maximumPairLane) : 0;
    const bundledEdgeIds = edgeBundleIdsForRankSpacing(flowEdges, graph.direction);
    const maximumLabelCrossSize = Math.max(0, ...flowEdges.map((edge) => {
        const metrics = naturalEdgeLabelMetrics(edge, measuredEdgeLabels);
        return horizontal ? metrics.height : metrics.width;
    }));
    const crossMargin = Math.max(42, pairLaneOffset + maximumLabelCrossSize / 2 + (maximumPairLane > 0 ? 18 : 0));
    const rankPrimarySizes = sortedRanks.map((rank) => Math.max(...(groups.get(rank) ?? []).map((node) => (horizontal ? node.width : node.height))));
    const rankCrossSizes = sortedRanks.map((rank) => {
        const group = groups.get(rank) ?? [];
        return (group.reduce((sum, node) => sum + (horizontal ? node.height : node.width), 0) +
            Math.max(0, group.length - 1) * nodeGap);
    });
    const rankIndexes = new Map(sortedRanks.map((rank, index) => [rank, index]));
    const rankGaps = calculateAdaptiveRankGaps(sortedRanks.length, horizontal, flowEdges.flatMap((edge) => {
        const sourceRank = rankIndexes.get(ranks.get(edge.sourceId) ?? 0);
        const targetRank = rankIndexes.get(ranks.get(edge.targetId) ?? 0);
        if (sourceRank === undefined || targetRank === undefined)
            return [];
        return [{
                label: edge.label,
                metrics: naturalEdgeLabelMetrics(edge, measuredEdgeLabels),
                // Direct routes consume only anchor clearances. A paired route also owns
                // two 22 px stubs plus the rounded corners around its carrier segment.
                // Bundled routes additionally give part of the rank gap to their shared
                // collector, so labels must reserve that trunk before nodes are placed.
                routePadding: pairLanes.has(edge.id)
                    ? PAIRED_ROUTE_LABEL_RESERVE
                    : bundledEdgeIds.has(edge.id)
                        ? EDGE_BUNDLE_ROUTE_LABEL_RESERVE
                        : DIRECT_ROUTE_LABEL_RESERVE,
                sourceRank,
                targetRank,
            }];
    }));
    const crossSize = Math.max(1, ...rankCrossSizes);
    const primarySize = rankPrimarySizes.reduce((sum, size) => sum + size, 0) +
        rankGaps.reduce((sum, gap) => sum + gap, 0);
    const automaticWidth = (horizontal ? primarySize + primaryMargin * 2 : crossSize + crossMargin * 2);
    const automaticHeight = (horizontal ? crossSize + crossMargin * 2 : primarySize + primaryMargin * 2);
    const width = boardLayout?.width ?? automaticWidth;
    const height = boardLayout?.height ?? automaticHeight;
    const positions = new Map();
    let primaryCursor = primaryMargin;
    sortedRanks.forEach((rank, rankIndex) => {
        const group = groups.get(rank) ?? [];
        const rankSize = rankPrimarySizes[rankIndex];
        const primaryCenter = primaryCursor + rankSize / 2;
        let crossCursor = crossMargin + (crossSize - rankCrossSizes[rankIndex]) / 2;
        group.forEach((node) => {
            const nodeCrossSize = horizontal ? node.height : node.width;
            const crossCenter = crossCursor + nodeCrossSize / 2;
            positions.set(node.id, horizontal
                ? { x: primaryCenter, y: crossCenter }
                : { x: crossCenter, y: primaryCenter });
            crossCursor += nodeCrossSize + nodeGap;
        });
        primaryCursor += rankSize + (rankGaps[rankIndex] ?? 0);
    });
    const nodes = measuredNodes.map((node) => {
        const base = positions.get(node.id) ?? (horizontal
            ? { x: primaryMargin + node.width / 2, y: crossMargin + node.height / 2 }
            : { x: crossMargin + node.width / 2, y: primaryMargin + node.height / 2 });
        const oriented = graph.direction === 'RL'
            ? { x: width - base.x, y: base.y }
            : graph.direction === 'BT'
                ? { x: base.x, y: height - base.y }
                : base;
        return {
            ...node,
            position: patches.get(node.id)?.position ?? boardLayout?.nodes[node.id]?.position ?? oriented,
        };
    });
    return {
        edges,
        groups: layoutBoardGroups(graph.groups ?? [], nodes),
        height,
        nodes,
        width,
    };
}
function hasGroupLayout(groups, nodes) {
    const topLevelGroups = groups.filter((group) => !group.parentId);
    if (topLevelGroups.length < 2)
        return false;
    const groupedNodeIds = new Set(groups.flatMap((group) => group.nodeIds));
    return groupedNodeIds.size >= Math.max(2, Math.ceil(nodes.length * 0.5));
}
function layoutGroupedDiagramGraph(measuredNodes, edges, groups, direction, patches, boardLayout, measuredEdgeLabels) {
    const horizontal = direction === 'LR' || direction === 'RL';
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const childrenByGroup = new Map();
    groups.forEach((group) => {
        if (!group.parentId || !groupById.has(group.parentId))
            return;
        const children = childrenByGroup.get(group.parentId) ?? [];
        children.push(group);
        childrenByGroup.set(group.parentId, children);
    });
    const topLevelGroups = groups.filter((group) => !group.parentId || !groupById.has(group.parentId));
    const collectNodeIds = (group) => [
        ...group.nodeIds,
        ...(childrenByGroup.get(group.id) ?? []).flatMap(collectNodeIds),
    ];
    const topGroupNodeIds = new Map(topLevelGroups.map((group) => [group.id, [...new Set(collectNodeIds(group))]]));
    const rootGroupByNode = new Map();
    topLevelGroups.forEach((group) => {
        (topGroupNodeIds.get(group.id) ?? []).forEach((nodeId) => {
            if (!rootGroupByNode.has(nodeId))
                rootGroupByNode.set(nodeId, group.id);
        });
    });
    const ungrouped = measuredNodes.filter((node) => !rootGroupByNode.has(node.id));
    const units = [
        ...topLevelGroups.map((group, index) => ({
            id: group.id,
            index,
            nodes: measuredNodes.filter((node) => rootGroupByNode.get(node.id) === group.id),
        })),
        ...(ungrouped.length > 0 ? [{ id: '__ungrouped__', index: topLevelGroups.length, nodes: ungrouped }] : []),
    ].filter((unit) => unit.nodes.length > 0);
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const unitByNode = new Map();
    units.forEach((unit) => unit.nodes.forEach((node) => unitByNode.set(node.id, unit.id)));
    // Mermaid subgraphs are semantic containers. Rank those containers first,
    // then lay out their members inside them. Backward/cyclic dependencies are
    // routed as feedback edges and never stretch or interleave the containers.
    const ranks = new Map(units.map((unit) => [unit.id, 0]));
    for (let pass = 0; pass < units.length; pass += 1) {
        let changed = false;
        edges.forEach((edge) => {
            if (isFeedbackEdge(edge))
                return;
            const sourceId = unitByNode.get(edge.sourceId);
            const targetId = unitByNode.get(edge.targetId);
            if (!sourceId || !targetId || sourceId === targetId)
                return;
            const source = unitById.get(sourceId);
            const target = unitById.get(targetId);
            if (!source || !target || source.index >= target.index)
                return;
            const next = Math.max(ranks.get(targetId) ?? 0, (ranks.get(sourceId) ?? 0) + 1);
            if (next !== ranks.get(targetId)) {
                ranks.set(targetId, next);
                changed = true;
            }
        });
        if (!changed)
            break;
    }
    const layoutEdges = edges.map((edge) => {
        if (isFeedbackEdge(edge))
            return edge;
        const sourceId = unitByNode.get(edge.sourceId);
        const targetId = unitByNode.get(edge.targetId);
        if (!sourceId || !targetId || sourceId === targetId)
            return edge;
        const source = unitById.get(sourceId);
        const target = unitById.get(targetId);
        if (!source || !target)
            return edge;
        const sourceRank = ranks.get(sourceId) ?? 0;
        const targetRank = ranks.get(targetId) ?? 0;
        const forward = sourceRank < targetRank ||
            (sourceRank === targetRank && source.index < target.index);
        const sides = groupedFlowSides(direction, forward);
        return {
            ...edge,
            sourceSide: edge.sourceSide ?? sides.source,
            targetSide: edge.targetSide ?? sides.target,
        };
    });
    const nodeGap = 34;
    const groupGap = 46;
    const groupHorizontalPadding = 24;
    const groupTopPadding = 44;
    const groupBottomPadding = 22;
    const margin = 42;
    const groupedByRank = new Map();
    units.forEach((unit) => {
        const rank = ranks.get(unit.id) ?? 0;
        const list = groupedByRank.get(rank) ?? [];
        list.push(unit);
        groupedByRank.set(rank, list);
    });
    const sortedRanks = [...groupedByRank.keys()].sort((first, second) => first - second);
    const unitSize = new Map(units.map((unit) => {
        const memberPrimary = Math.max(...unit.nodes.map((node) => horizontal ? node.width : node.height));
        const memberCross = unit.nodes.reduce((sum, node) => sum + (horizontal ? node.height : node.width), 0) + Math.max(0, unit.nodes.length - 1) * nodeGap;
        return [unit.id, {
                cross: memberCross + groupTopPadding + groupBottomPadding,
                primary: memberPrimary + groupHorizontalPadding * 2,
            }];
    }));
    const rankPrimarySizes = sortedRanks.map((rank) => Math.max(...(groupedByRank.get(rank) ?? []).map((unit) => unitSize.get(unit.id)?.primary ?? 0)));
    const rankCrossSizes = sortedRanks.map((rank) => {
        const rankUnits = groupedByRank.get(rank) ?? [];
        return rankUnits.reduce((sum, unit) => sum + (unitSize.get(unit.id)?.cross ?? 0), 0) +
            Math.max(0, rankUnits.length - 1) * groupGap;
    });
    const rankIndexes = new Map(sortedRanks.map((rank, index) => [rank, index]));
    const rankGaps = calculateAdaptiveRankGaps(sortedRanks.length, horizontal, layoutEdges.filter((edge) => !isFeedbackEdge(edge)).flatMap((edge) => {
        const sourceUnit = unitByNode.get(edge.sourceId);
        const targetUnit = unitByNode.get(edge.targetId);
        const sourceRank = sourceUnit === undefined ? undefined : rankIndexes.get(ranks.get(sourceUnit) ?? 0);
        const targetRank = targetUnit === undefined ? undefined : rankIndexes.get(ranks.get(targetUnit) ?? 0);
        if (sourceRank === undefined || targetRank === undefined || sourceRank === targetRank)
            return [];
        return [{
                label: edge.label,
                metrics: naturalEdgeLabelMetrics(edge, measuredEdgeLabels),
                routePadding: PAIRED_ROUTE_LABEL_RESERVE,
                sourceRank,
                targetRank,
            }];
    }), 136);
    const crossSize = Math.max(1, ...rankCrossSizes);
    const primarySize = rankPrimarySizes.reduce((sum, size) => sum + size, 0) +
        rankGaps.reduce((sum, gap) => sum + gap, 0);
    const automaticWidth = horizontal ? primarySize + margin * 2 : crossSize + margin * 2;
    const automaticHeight = horizontal ? crossSize + margin * 2 : primarySize + margin * 2;
    const width = boardLayout?.width ?? automaticWidth;
    const height = boardLayout?.height ?? automaticHeight;
    const positions = new Map();
    let primaryCursor = margin;
    sortedRanks.forEach((rank, rankIndex) => {
        const rankUnits = groupedByRank.get(rank) ?? [];
        const rankPrimary = rankPrimarySizes[rankIndex];
        const primaryCenter = primaryCursor + rankPrimary / 2;
        let crossCursor = margin + (crossSize - rankCrossSizes[rankIndex]) / 2;
        rankUnits.forEach((unit) => {
            const size = unitSize.get(unit.id);
            let memberCursor = crossCursor + groupTopPadding;
            unit.nodes.forEach((node) => {
                const memberCross = horizontal ? node.height : node.width;
                const crossCenter = memberCursor + memberCross / 2;
                positions.set(node.id, horizontal
                    ? { x: primaryCenter, y: crossCenter }
                    : { x: crossCenter, y: primaryCenter });
                memberCursor += memberCross + nodeGap;
            });
            crossCursor += size.cross + groupGap;
        });
        primaryCursor += rankPrimary + (rankGaps[rankIndex] ?? 0);
    });
    const nodes = measuredNodes.map((node) => {
        const base = positions.get(node.id) ?? { x: margin + node.width / 2, y: margin + node.height / 2 };
        const oriented = direction === 'RL'
            ? { x: width - base.x, y: base.y }
            : direction === 'BT'
                ? { x: base.x, y: height - base.y }
                : base;
        return {
            ...node,
            position: patches.get(node.id)?.position ?? boardLayout?.nodes[node.id]?.position ?? oriented,
        };
    });
    return {
        edges: layoutEdges,
        groups: layoutBoardGroups(groups, nodes),
        height,
        nodes,
        width,
    };
}
function groupedFlowSides(direction, forward) {
    if (direction === 'RL') {
        return forward
            ? { source: 'left', target: 'right' }
            : { source: 'right', target: 'left' };
    }
    if (direction === 'TB') {
        return forward
            ? { source: 'bottom', target: 'top' }
            : { source: 'top', target: 'bottom' };
    }
    if (direction === 'BT') {
        return forward
            ? { source: 'top', target: 'bottom' }
            : { source: 'bottom', target: 'top' };
    }
    return forward
        ? { source: 'right', target: 'left' }
        : { source: 'left', target: 'right' };
}
function layoutSequenceDiagramGraph(measuredNodes, edges, groups, boardLayout, measuredEdgeLabels) {
    const marginX = 56;
    const actorY = 58;
    const actorGap = 248;
    const firstMessageY = 154;
    const messageGap = Math.max(68, ...edges.map((edge) => naturalEdgeLabelMetrics(edge, measuredEdgeLabels).height + 34));
    const automaticWidth = Math.max(320, marginX * 2 +
        measuredNodes.reduce((sum, node) => sum + node.width, 0) +
        Math.max(0, measuredNodes.length - 1) * actorGap);
    const width = boardLayout?.width ?? automaticWidth;
    const height = boardLayout?.height ?? firstMessageY + Math.max(1, edges.length) * messageGap + 48;
    let cursor = marginX;
    const nodes = measuredNodes.map((node) => {
        const automaticPosition = { x: cursor + node.width / 2, y: actorY };
        cursor += node.width + actorGap;
        return {
            ...node,
            position: boardLayout?.nodes[node.id]?.position ?? automaticPosition,
        };
    });
    return {
        edges,
        groups: layoutBoardGroups(groups, nodes),
        height,
        nodes,
        width,
    };
}
function applyBoardEdgeLayout(edges, boardLayout) {
    if (!boardLayout?.edges?.length)
        return edges;
    const layouts = matchBoardEdgeLayouts(edges, boardLayout);
    return edges.map((edge) => {
        const layout = layouts.get(edge.id);
        if (!layout)
            return edge;
        return {
            ...edge,
            bareLabel: layout.bareLabel ?? edge.bareLabel,
            labelAlign: layout.labelAlign ?? edge.labelAlign,
            sourceSide: layout.sourceSide ?? edge.sourceSide,
            targetSide: layout.targetSide ?? edge.targetSide,
        };
    });
}
function resolveInitialEdgePatches(edges, boardLayout) {
    const patches = new Map();
    if (!boardLayout?.edges?.length)
        return patches;
    const layouts = matchBoardEdgeLayouts(edges, boardLayout);
    edges.forEach((edge) => {
        const layout = layouts.get(edge.id);
        if (!layout?.points?.length && !layout?.labelPosition)
            return;
        patches.set(edge.id, {
            ...(layout.labelPosition ? { label: layout.labelPosition } : null),
            ...(layout.points?.length ? { points: layout.points } : { points: [] }),
        });
    });
    return patches;
}
function matchBoardEdgeLayouts(edges, boardLayout) {
    const layouts = boardLayout.edges ?? [];
    const matched = new Map();
    const used = new Set();
    edges.forEach((edge) => {
        const index = layouts.findIndex((layout, layoutIndex) => !used.has(layoutIndex) && layout.id !== undefined && layout.id === edge.id);
        if (index < 0)
            return;
        matched.set(edge.id, layouts[index]);
        used.add(index);
    });
    edges.forEach((edge) => {
        if (matched.has(edge.id))
            return;
        const candidates = layouts.flatMap((layout, index) => !used.has(index) &&
            layout.id === undefined &&
            layout.sourceId === edge.sourceId &&
            layout.targetId === edge.targetId
            ? [{ index, layout }]
            : []);
        const selected = candidates.find(({ layout }) => layout.label === edge.label) ??
            candidates.find(({ layout }) => layout.label === undefined) ??
            candidates[0];
        if (!selected)
            return;
        matched.set(edge.id, selected.layout);
        used.add(selected.index);
    });
    return matched;
}
function ensureLayoutNodePositions(graph) {
    let repairedNodes = 0;
    const nodes = graph.nodes.map((node) => {
        if (isFinitePosition(node.position))
            return node;
        const fallback = {
            x: graph.width + 96 + repairedNodes * (node.width + 42),
            y: Math.max(84, graph.height / 2),
        };
        repairedNodes += 1;
        return { ...node, position: fallback };
    });
    return repairedNodes > 0 ? { ...graph, nodes } : graph;
}
function isFinitePosition(value) {
    return value !== undefined && Number.isFinite(value.x) && Number.isFinite(value.y);
}
function assignRanks(nodes, edges) {
    const ranks = new Map(nodes.map((node) => [node.id, 0]));
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    edges.forEach((edge) => {
        if (!incoming.has(edge.targetId) || !outgoing.has(edge.sourceId))
            return;
        incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
        outgoing.get(edge.sourceId)?.push(edge.targetId);
    });
    const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
    const visited = new Set();
    while (queue.length > 0) {
        const id = queue.shift();
        if (!id)
            continue;
        visited.add(id);
        (outgoing.get(id) ?? []).forEach((targetId) => {
            ranks.set(targetId, Math.max(ranks.get(targetId) ?? 0, (ranks.get(id) ?? 0) + 1));
            incoming.set(targetId, (incoming.get(targetId) ?? 1) - 1);
            if (incoming.get(targetId) === 0)
                queue.push(targetId);
        });
    }
    nodes.forEach((node, index) => {
        if (!visited.has(node.id))
            ranks.set(node.id, Math.max(ranks.get(node.id) ?? 0, index));
    });
    return ranks;
}
function routeDraftConnection(source, target, draft, obstacles) {
    if (target) {
        return routeEdge(source, target, draft.sourceSide, draft.targetSide, 0, 0, 0, true, obstacles);
    }
    const targetVector = sideVector(draft.targetSide);
    const virtualTarget = {
        classes: [],
        height: 0,
        id: '__connection-draft-target__',
        label: '',
        position: {
            x: draft.end.x - targetVector.x * 14,
            y: draft.end.y - targetVector.y * 14,
        },
        shape: 'rect',
        textLines: [],
        tone: 'neutral',
        width: 0,
    };
    return routeEdge(source, virtualTarget, draft.sourceSide, draft.targetSide, 0, 0, 0, true, obstacles);
}
function nearestAnchorSide(node, point) {
    const normalizedX = (point.x - node.position.x) / Math.max(1, node.width / 2);
    const normalizedY = (point.y - node.position.y) / Math.max(1, node.height / 2);
    if (Math.abs(normalizedX) >= Math.abs(normalizedY))
        return normalizedX >= 0 ? 'right' : 'left';
    return normalizedY >= 0 ? 'bottom' : 'top';
}
function resolveDraftTargetSide(source, point) {
    if (!source)
        return 'left';
    const deltaX = point.x - source.position.x;
    const deltaY = point.y - source.position.y;
    if (Math.abs(deltaX) >= Math.abs(deltaY))
        return deltaX >= 0 ? 'left' : 'right';
    return deltaY >= 0 ? 'top' : 'bottom';
}
function oppositeSide(side) {
    if (side === 'top')
        return 'bottom';
    if (side === 'right')
        return 'left';
    if (side === 'bottom')
        return 'top';
    return 'right';
}
function pairedLaneOffset(laneIndex) {
    const lane = Math.max(1, Math.abs(laneIndex));
    return PAIRED_LANE_BASE_OFFSET + (lane - 1) * PAIRED_LANE_STEP;
}
function routeGraphEdges(nodes, edges, edgePatches, measuredEdgeLabels = new Map(), diagramKind, direction = 'LR') {
    if (diagramKind === 'sequence') {
        return {
            edges: routeSequenceGraphEdges(nodes, edges, edgePatches, measuredEdgeLabels),
            trunks: [],
        };
    }
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const candidates = edges.flatMap((edge, index) => {
        if (edge.stroke === 'invisible')
            return [];
        const source = nodesById.get(edge.sourceId);
        const target = nodesById.get(edge.targetId);
        if (!source || !target)
            return [];
        const feedback = isFeedbackEdge(edge);
        const sides = feedback
            ? feedbackAnchorSides(direction)
            : resolveAnchorSides(source, target);
        return [
            {
                edge,
                feedback,
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
    // Bundle semantic ports before obstacle detours choose local sides. Otherwise
    // three edges leaving one logical output are split into unrelated top/right
    // ports merely because an intermediate card blocks two of their direct paths.
    const edgeBundles = assignEdgeBundles(candidates, edgePatches);
    rerouteBlockedFacingCandidates(candidates, nodes, edgePatches);
    const pairLanes = assignDiagramEdgeLanes(candidates.filter(({ feedback }) => !feedback).map(({ edge }) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
    })));
    const portGroups = new Map();
    const addPort = (candidate, node, neighbor, side, role) => {
        const key = `${node.id}:${side}`;
        const group = portGroups.get(key) ?? [];
        group.push({
            candidate,
            node,
            projection: side === 'top' || side === 'bottom' ? neighbor.position.x : neighbor.position.y,
            role,
            side,
        });
        portGroups.set(key, group);
    };
    candidates.forEach((candidate) => {
        if (!candidate.sourceBundleKey) {
            addPort(candidate, candidate.source, candidate.target, candidate.sourceSide, 'source');
        }
        if (!candidate.targetBundleKey) {
            addPort(candidate, candidate.target, candidate.source, candidate.targetSide, 'target');
        }
    });
    portGroups.forEach((ports) => {
        const first = ports[0];
        if (!first)
            return;
        const setOffset = (port, offset) => {
            if (port.role === 'source')
                port.candidate.sourceOffset = offset;
            else
                port.candidate.targetOffset = offset;
        };
        if (ports.length === 1) {
            ports.forEach((port) => setOffset(port, 0));
            return;
        }
        const axisCenter = first.side === 'top' || first.side === 'bottom'
            ? first.node.position.x
            : first.node.position.y;
        const limit = portOffsetLimit(first.node, first.side);
        const preferredGap = ports.some(({ candidate, role }) => role === 'target' && candidate.edge.arrow)
            ? EDGE_TARGET_PORT_GAP
            : EDGE_SOURCE_PORT_GAP;
        const gap = Math.min(preferredGap, (limit * 2) / Math.max(1, ports.length - 1));
        const ordered = ports
            .map((port) => ({
            desired: clamp(port.projection - axisCenter, -limit, limit),
            port,
        }))
            .sort((firstPort, secondPort) => firstPort.desired - secondPort.desired ||
            firstPort.port.candidate.index - secondPort.port.candidate.index);
        const mixedRoles = new Set(ports.map(({ role }) => role)).size > 1;
        const offsets = mixedRoles
            ? ordered.map((_, index) => clamp((index - (ordered.length - 1) / 2) * gap, -limit, limit))
            : distributePortOffsets(ordered.map(({ desired }) => desired), limit, gap);
        ordered.forEach(({ port }, index) => {
            setOffset(port, offsets[index] ?? 0);
        });
    });
    const portGroupSize = (node, side) => portGroups.get(`${node.id}:${side}`)?.length ?? 0;
    candidates.forEach((candidate) => {
        const patch = edgePatches.get(candidate.edge.id);
        if ((patch?.points.length ?? 0) >= 2 ||
            candidate.sourceBundleKey ||
            candidate.targetBundleKey)
            return;
        if (oppositeSide(candidate.sourceSide) !== candidate.targetSide)
            return;
        const horizontal = candidate.sourceSide === 'left' || candidate.sourceSide === 'right';
        const start = anchorPoint(candidate.source, candidate.sourceSide, candidate.sourceOffset, 0);
        const end = anchorPoint(candidate.target, candidate.targetSide, candidate.targetOffset, 0);
        const delta = horizontal ? end.y - start.y : end.x - start.x;
        if (Math.abs(delta) > MICRO_JOG_THRESHOLD)
            return;
        const sourceCount = portGroupSize(candidate.source, candidate.sourceSide);
        const targetCount = portGroupSize(candidate.target, candidate.targetSide);
        if (sourceCount !== 1 || targetCount !== 1)
            return;
        let sourceOffset = candidate.sourceOffset;
        let targetOffset = candidate.targetOffset;
        sourceOffset += delta / 2;
        targetOffset -= delta / 2;
        const sourceLimit = portOffsetLimit(candidate.source, candidate.sourceSide);
        const targetLimit = portOffsetLimit(candidate.target, candidate.targetSide);
        sourceOffset = clamp(sourceOffset, -sourceLimit, sourceLimit);
        targetOffset = clamp(targetOffset, -targetLimit, targetLimit);
        const alignedStart = anchorPoint(candidate.source, candidate.sourceSide, sourceOffset, 0);
        const alignedEnd = anchorPoint(candidate.target, candidate.targetSide, targetOffset, 0);
        const remaining = horizontal
            ? alignedEnd.y - alignedStart.y
            : alignedEnd.x - alignedStart.x;
        // Commit only a genuinely orthogonal result; a tolerance alone would turn
        // the unwanted micro jog into a slightly diagonal SVG segment.
        if (Math.abs(remaining) < 0.1) {
            candidate.sourceOffset = sourceOffset;
            candidate.targetOffset = targetOffset;
        }
    });
    const bundlesByKey = new Map(edgeBundles.map((bundle) => [bundle.key, bundle]));
    const feedbackLaneIndexes = new Map(candidates
        .filter(({ feedback }) => feedback)
        .map((candidate, index) => [candidate.edge.id, index]));
    // Authored routes stay verbatim only while their terminals do not collide
    // on a node. Two routes sharing one authored anchor point still go through
    // endpoint re-anchoring so the shared port is separated.
    const authoredTerminals = candidates.flatMap((candidate) => {
        const points = edgePatches.get(candidate.edge.id)?.points;
        if (!points || points.length < 2)
            return [];
        return [
            { edgeId: candidate.edge.id, nodeId: candidate.source.id, point: points[0] },
            { edgeId: candidate.edge.id, nodeId: candidate.target.id, point: points[points.length - 1] },
        ];
    });
    const conflictedAuthoredEdges = new Set();
    authoredTerminals.forEach((first, index) => {
        authoredTerminals.slice(index + 1).forEach((second) => {
            if (first.edgeId !== second.edgeId &&
                first.nodeId === second.nodeId &&
                Math.hypot(first.point.x - second.point.x, first.point.y - second.point.y) < 6) {
                conflictedAuthoredEdges.add(first.edgeId);
                conflictedAuthoredEdges.add(second.edgeId);
            }
        });
    });
    const routed = candidates.map((candidate) => {
        const laneIndex = candidate.source.id === candidate.target.id
            ? candidate.index
            : (pairLanes.get(candidate.edge.id) ?? 0);
        const sourceBundle = candidate.sourceBundleKey
            ? bundlesByKey.get(candidate.sourceBundleKey)
            : undefined;
        const targetBundle = candidate.targetBundleKey
            ? bundlesByKey.get(candidate.targetBundleKey)
            : undefined;
        const automatic = sourceBundle || targetBundle
            ? routeBundledBranch(candidate, sourceBundle, targetBundle, laneIndex, nodes)
            : candidate.feedback
                ? routeFeedbackEdge(candidate, feedbackLaneIndexes.get(candidate.edge.id) ?? 0, nodes, direction)
                : routeEdge(candidate.source, candidate.target, candidate.sourceSide, candidate.targetSide, candidate.sourceOffset, candidate.targetOffset, laneIndex, candidate.edge.arrow, nodes);
        const exactRouteAllowed = !conflictedAuthoredEdges.has(candidate.edge.id);
        const route = applyEdgeRoutePatch(automatic, edgePatches.get(candidate.edge.id), targetBundle ? false : candidate.edge.arrow, exactRouteAllowed ? candidate.source : undefined, exactRouteAllowed ? candidate.target : undefined);
        return {
            edge: candidate.edge,
            route: candidate.edge.sourceArrow && !sourceBundle
                ? withSourceArrow(route)
                : route,
        };
    });
    const trunks = edgeBundles.map(createEdgeBundleTrunk);
    const labelPlacements = placeDiagramEdgeLabels([
        ...routed.map(({ edge, route }) => ({
            align: edge.labelAlign,
            arrow: Boolean(route.arrowPoints),
            bare: edge.bareLabel,
            id: edge.id,
            label: edge.label,
            lockedPosition: edgePatches.get(edge.id)?.label,
            metrics: measuredEdgeLabel(edge, measuredEdgeLabels),
            points: route.points,
        })),
        ...trunks.map((trunk) => ({
            arrow: Boolean(trunk.arrowPoints || trunk.sourceArrowPoints),
            id: trunk.key,
            label: '',
            points: trunk.points,
        })),
    ], nodes);
    const routedEdges = routed.map(({ edge, route }) => {
        const placement = labelPlacements.get(edge.id);
        return {
            edge,
            route: {
                ...route,
                label: placement?.position ?? route.label,
                labelMode: placement?.mode,
                labelMaximumTextWidth: placement?.maximumTextWidth,
            },
        };
    });
    return { edges: routedEdges, trunks };
}
function rerouteBlockedFacingCandidates(candidates, nodes, edgePatches) {
    candidates.forEach((candidate) => {
        if (candidate.feedback ||
            candidate.sourceBundleKey ||
            candidate.targetBundleKey ||
            candidate.edge.manual ||
            candidate.edge.sourceSide ||
            candidate.edge.targetSide ||
            (edgePatches.get(candidate.edge.id)?.points.length ?? 0) >= 2) {
            return;
        }
        const start = anchorPoint(candidate.source, candidate.sourceSide, 0, 0);
        const tip = anchorPoint(candidate.target, candidate.targetSide, 0, 0);
        if (!isDirectFacingRoute(start, tip, candidate.sourceSide, candidate.targetSide))
            return;
        if (directFacingRouteAvoidsNodes(start, tip, candidate.source, candidate.target, nodes)) {
            return;
        }
        // When another node occupies the direct corridor, changing both anchors to
        // one outer side produces a clean bypass. This also keeps the blocked edge
        // away from the local target port group instead of drawing a U-turn inside
        // the intervening card. Top/left are reserved for these forward detours;
        // feedback routes use bottom/right.
        const vertical = candidate.sourceSide === 'top' || candidate.sourceSide === 'bottom';
        const outerSide = vertical ? 'left' : 'top';
        candidate.sourceSide = outerSide;
        candidate.targetSide = outerSide;
    });
}
function feedbackAnchorSides(direction) {
    return direction === 'LR' || direction === 'RL'
        ? { source: 'bottom', target: 'bottom' }
        : { source: 'right', target: 'right' };
}
function assignEdgeBundles(candidates, edgePatches) {
    const directedPairs = new Set(candidates.map(({ source, target }) => `${source.id}\u0000${target.id}`));
    const eligible = (candidate) => !candidate.feedback &&
        candidate.edge.arrow &&
        !candidate.edge.manual &&
        candidate.source.id !== candidate.target.id &&
        !directedPairs.has(`${candidate.target.id}\u0000${candidate.source.id}`) &&
        (edgePatches.get(candidate.edge.id)?.points.length ?? 0) < 2;
    const bundles = [];
    const collect = (kind, groupKey, memberNodeId) => {
        const groups = new Map();
        candidates.filter(eligible).forEach((candidate) => {
            const key = groupKey(candidate);
            const group = groups.get(key) ?? [];
            group.push(candidate);
            groups.set(key, group);
        });
        groups.forEach((members, key) => {
            if (members.length < 2)
                return;
            if (new Set(members.map(memberNodeId)).size !== members.length)
                return;
            if (new Set(members.map(({ edge }) => edge.stroke)).size !== 1)
                return;
            if (kind === 'fan-out' &&
                new Set(members.map(({ edge }) => Boolean(edge.sourceArrow))).size !== 1) {
                return;
            }
            const first = members[0];
            if (!first)
                return;
            const fanIn = kind === 'fan-in';
            const node = fanIn ? first.target : first.source;
            const side = fanIn ? first.targetSide : first.sourceSide;
            const bundle = {
                key: `${kind}:${node.id}:${side}`,
                kind,
                members,
                node,
                side,
                stroke: first.edge.stroke,
            };
            members.forEach((candidate) => {
                if (fanIn) {
                    candidate.targetBundleKey = bundle.key;
                    candidate.targetOffset = 0;
                }
                else {
                    candidate.sourceBundleKey = bundle.key;
                    candidate.sourceOffset = 0;
                }
            });
            bundles.push(bundle);
        });
    };
    // One edge may participate in both bundles (for example
    // Product Server → Models is part of a source fan-out and a target fan-in).
    // Keeping the two endpoint bundles independent lets the middle branch connect
    // both shared buses without inventing duplicate ports.
    collect('fan-in', ({ target, targetSide }) => `${target.id}:${targetSide}`, ({ source }) => source.id);
    collect('fan-out', ({ source, sourceSide }) => `${source.id}:${sourceSide}`, ({ target }) => target.id);
    bundles.forEach((bundle) => moveCollinearBundleToOuterLane(bundle, candidates));
    return bundles;
}
function moveCollinearBundleToOuterLane(bundle, candidates) {
    const horizontal = bundle.side === 'left' || bundle.side === 'right';
    const nodeCross = horizontal ? bundle.node.position.y : bundle.node.position.x;
    const nodePrimary = horizontal ? bundle.node.position.x : bundle.node.position.y;
    const vector = sideVector(bundle.side);
    const members = bundle.members.map((candidate) => bundle.kind === 'fan-in' ? candidate.source : candidate.target);
    const collinear = members.every((node) => Math.abs((horizontal ? node.position.y : node.position.x) - nodeCross) < 1);
    const forwardDistances = members.map((node) => horizontal
        ? (node.position.x - nodePrimary) * vector.x
        : (node.position.y - nodePrimary) * vector.y);
    const distinctForwardRanks = new Set(forwardDistances.filter((distance) => distance > 0).map((distance) => format(distance)));
    if (!collinear || distinctForwardRanks.size < 2)
        return;
    // A same-axis fan-out/fan-in would otherwise collapse into one straight
    // segment that crosses every nearer sibling. Move the whole semantic port to
    // the quieter outer side so an incoming edge and an outgoing bus never
    // overpaint the same node pin or occupy two almost-identical corridors.
    const outerSides = horizontal
        ? ['top', 'bottom']
        : ['left', 'right'];
    const memberIds = new Set(bundle.members.map(({ edge }) => edge.id));
    const sideOccupancy = (side) => candidates.filter((candidate) => !memberIds.has(candidate.edge.id) &&
        ((candidate.source.id === bundle.node.id && candidate.sourceSide === side) ||
            (candidate.target.id === bundle.node.id && candidate.targetSide === side))).length;
    const outerSide = sideOccupancy(outerSides[1]) < sideOccupancy(outerSides[0])
        ? outerSides[1]
        : outerSides[0];
    bundle.side = outerSide;
    bundle.key = `${bundle.kind}:${bundle.node.id}:${outerSide}`;
    bundle.members.forEach((candidate) => {
        if (bundle.kind === 'fan-in') {
            candidate.targetBundleKey = bundle.key;
            candidate.targetSide = outerSide;
            if (!candidate.sourceBundleKey)
                candidate.sourceSide = outerSide;
        }
        else {
            candidate.sourceBundleKey = bundle.key;
            candidate.sourceSide = outerSide;
            if (!candidate.targetBundleKey)
                candidate.targetSide = outerSide;
        }
    });
}
function edgeBundleIdsForRankSpacing(edges, direction) {
    const ids = new Set();
    const automaticSides = direction === 'RL'
        ? { source: 'left', target: 'right' }
        : direction === 'TB'
            ? { source: 'bottom', target: 'top' }
            : direction === 'BT'
                ? { source: 'top', target: 'bottom' }
                : { source: 'right', target: 'left' };
    const directedPairs = new Set(edges.map((edge) => `${edge.sourceId}\u0000${edge.targetId}`));
    const eligible = edges.filter((edge) => edge.arrow &&
        !edge.manual &&
        edge.sourceId !== edge.targetId &&
        !directedPairs.has(`${edge.targetId}\u0000${edge.sourceId}`) &&
        (edge.points?.length ?? 0) < 2);
    const collect = (groupKey, memberNodeId) => {
        const groups = new Map();
        eligible.forEach((edge) => {
            const key = groupKey(edge);
            const group = groups.get(key) ?? [];
            group.push(edge);
            groups.set(key, group);
        });
        groups.forEach((group) => {
            if (group.length < 2 ||
                new Set(group.map(memberNodeId)).size !== group.length ||
                new Set(group.map((edge) => edge.stroke)).size !== 1) {
                return;
            }
            group.forEach((edge) => ids.add(edge.id));
        });
    };
    collect((edge) => `${edge.targetId}:${edge.targetSide ?? automaticSides.target}`, (edge) => edge.sourceId);
    collect((edge) => `${edge.sourceId}:${edge.sourceSide ?? automaticSides.source}`, (edge) => edge.targetId);
    return ids;
}
function edgeBundleEndpoint(bundle) {
    return anchorPoint(bundle.node, bundle.side, 0, bundle.kind === 'fan-in' ? 14 : 10);
}
function edgeBundleMemberAnchor(candidate, bundle) {
    return bundle.kind === 'fan-in'
        ? anchorPoint(candidate.source, candidate.sourceSide, candidate.sourceOffset, 10)
        : anchorPoint(candidate.target, candidate.targetSide, candidate.targetOffset, 14);
}
function edgeBundleTrunkLength(bundle) {
    const endpoint = edgeBundleEndpoint(bundle);
    const vector = sideVector(bundle.side);
    const forwardDistances = bundle.members.flatMap((candidate) => {
        const member = edgeBundleMemberAnchor(candidate, bundle);
        const distance = (member.x - endpoint.x) * vector.x + (member.y - endpoint.y) * vector.y;
        return distance > 0 ? [distance] : [];
    });
    if (forwardDistances.length === 0)
        return EDGE_BUNDLE_TRUNK_LENGTH;
    const nearest = Math.min(...forwardDistances);
    return Math.max(8, Math.min(EDGE_BUNDLE_TRUNK_LENGTH, Math.max(EDGE_BUNDLE_MINIMUM_TRUNK_LENGTH, nearest * 0.38), Math.max(8, nearest - 8)));
}
function edgeBundleCollectorCenter(bundle) {
    const endpoint = edgeBundleEndpoint(bundle);
    const vector = sideVector(bundle.side);
    const length = edgeBundleTrunkLength(bundle);
    return {
        x: endpoint.x + vector.x * length,
        y: endpoint.y + vector.y * length,
    };
}
function edgeBundleBranchJoin(candidate, bundle) {
    const collector = edgeBundleCollectorCenter(bundle);
    const member = edgeBundleMemberAnchor(candidate, bundle);
    return bundle.side === 'left' || bundle.side === 'right'
        ? { x: collector.x, y: member.y }
        : { x: member.x, y: collector.y };
}
function edgeBundleCollectorGeometry(bundle) {
    const collector = edgeBundleCollectorCenter(bundle);
    const joins = bundle.members.map((candidate) => ({
        candidate,
        point: edgeBundleBranchJoin(candidate, bundle),
    }));
    const horizontalStem = bundle.side === 'left' || bundle.side === 'right';
    const axisValue = (point) => horizontalStem ? point.y : point.x;
    const collectorAxis = axisValue(collector);
    const joinAxes = joins.map(({ point }) => axisValue(point));
    const minimumJoinAxis = Math.min(...joinAxes);
    const maximumJoinAxis = Math.max(...joinAxes);
    const minimumAxis = Math.min(collectorAxis, minimumJoinAxis);
    const maximumAxis = Math.max(collectorAxis, maximumJoinAxis);
    const minimumCornerLeg = minimumJoinAxis < collectorAxis
        ? Math.min(EDGE_BUNDLE_CORNER_LEG, collectorAxis - minimumJoinAxis)
        : 0;
    const maximumCornerLeg = maximumJoinAxis > collectorAxis
        ? Math.min(EDGE_BUNDLE_CORNER_LEG, maximumJoinAxis - collectorAxis)
        : 0;
    const pointAtAxis = (point, axis) => horizontalStem ? { ...point, y: axis } : { ...point, x: axis };
    return {
        axisValue,
        collector,
        collectorAxis,
        collectorEnd: pointAtAxis(collector, maximumAxis - maximumCornerLeg),
        collectorStart: pointAtAxis(collector, minimumAxis + minimumCornerLeg),
        horizontalStem,
        joins,
        maximumCornerLeg,
        maximumJoinAxis,
        minimumCornerLeg,
        minimumJoinAxis,
        pointAtAxis,
    };
}
function edgeBundleJoinContinuation(candidate, bundle) {
    const join = edgeBundleBranchJoin(candidate, bundle);
    const geometry = edgeBundleCollectorGeometry(bundle);
    const joinAxis = geometry.axisValue(join);
    if (Math.abs(joinAxis - geometry.minimumJoinAxis) < 0.1 &&
        geometry.minimumCornerLeg > 0) {
        return geometry.pointAtAxis(join, joinAxis + geometry.minimumCornerLeg);
    }
    if (Math.abs(joinAxis - geometry.maximumJoinAxis) < 0.1 &&
        geometry.maximumCornerLeg > 0) {
        return geometry.pointAtAxis(join, joinAxis - geometry.maximumCornerLeg);
    }
    return undefined;
}
function routeBundledBranch(candidate, sourceBundle, targetBundle, laneIndex, obstacles) {
    const sourceJoin = sourceBundle
        ? edgeBundleBranchJoin(candidate, sourceBundle)
        : undefined;
    const targetJoin = targetBundle
        ? edgeBundleBranchJoin(candidate, targetBundle)
        : undefined;
    const virtualSource = {
        classes: [],
        height: 0,
        id: `__fan-out:${candidate.edge.id}`,
        label: '',
        position: sourceJoin ?? candidate.source.position,
        shape: 'rect',
        textLines: [],
        tone: 'neutral',
        width: 0,
    };
    const virtualTarget = {
        ...virtualSource,
        id: `__fan-in:${candidate.edge.id}`,
        position: targetJoin ?? candidate.target.position,
    };
    const automatic = routeEdge(sourceBundle ? virtualSource : candidate.source, targetBundle ? virtualTarget : candidate.target, candidate.sourceSide, candidate.targetSide, sourceBundle ? 0 : candidate.sourceOffset, targetBundle ? 0 : candidate.targetOffset, laneIndex, candidate.edge.arrow && !targetBundle, obstacles);
    let points = automatic.points;
    if (sourceJoin && points.length > 1) {
        points = [sourceJoin, ...points.slice(1)];
    }
    if (targetJoin && points.length > 1) {
        points = [...points.slice(0, -1), targetJoin];
    }
    const sourceContinuation = sourceBundle
        ? edgeBundleJoinContinuation(candidate, sourceBundle)
        : undefined;
    const targetContinuation = targetBundle
        ? edgeBundleJoinContinuation(candidate, targetBundle)
        : undefined;
    if (sourceContinuation)
        points = [sourceContinuation, ...points];
    if (targetContinuation)
        points = [...points, targetContinuation];
    return finalizeEdgeRoute(points, candidate.edge.arrow && !targetBundle, candidate.sourceSide, candidate.targetSide);
}
function createEdgeBundleTrunk(bundle) {
    const geometry = edgeBundleCollectorGeometry(bundle);
    const { collector, collectorAxis, collectorEnd, collectorStart } = geometry;
    const endpoint = edgeBundleEndpoint(bundle);
    const collectorBeforeJoins = collectorAxis < geometry.minimumJoinAxis;
    const collectorAfterJoins = collectorAxis > geometry.maximumJoinAxis;
    const collectorConnection = collectorBeforeJoins
        ? collectorEnd
        : collectorAfterJoins
            ? collectorStart
            : undefined;
    const stemPoints = bundle.kind === 'fan-in'
        ? collectorConnection
            ? [collectorConnection, collector, endpoint]
            : [collector, endpoint]
        : collectorConnection
            ? [endpoint, collector, collectorConnection]
            : [endpoint, collector];
    let trunk = finalizeEdgeRoute(stemPoints, bundle.kind === 'fan-in', bundle.kind === 'fan-in' ? oppositeSide(bundle.side) : bundle.side, bundle.kind === 'fan-in' ? bundle.side : oppositeSide(bundle.side));
    if (bundle.kind === 'fan-out' &&
        bundle.members.every(({ edge }) => edge.sourceArrow)) {
        trunk = withSourceArrow(trunk);
    }
    const collectorPath = !collectorBeforeJoins &&
        !collectorAfterJoins &&
        Math.hypot(collectorEnd.x - collectorStart.x, collectorEnd.y - collectorStart.y) >= 0.1
        ? orthogonalPath([collectorStart, collectorEnd])
        : '';
    return {
        arrowPoints: trunk.arrowPoints,
        edgeIds: bundle.members.map(({ edge }) => edge.id),
        key: bundle.key,
        path: [collectorPath, trunk.path].filter(Boolean).join(' '),
        points: trunk.points,
        sourceArrowPoints: trunk.sourceArrowPoints,
        stroke: bundle.stroke,
    };
}
function routeFeedbackEdge(candidate, laneIndex, nodes, direction) {
    if (candidate.source.id === candidate.target.id) {
        return routeEdge(candidate.source, candidate.target, candidate.sourceSide, candidate.targetSide, candidate.sourceOffset, candidate.targetOffset, candidate.index, candidate.edge.arrow, nodes);
    }
    const horizontalMain = direction === 'LR' || direction === 'RL';
    const outerSide = horizontalMain ? 'bottom' : 'right';
    if (candidate.sourceSide !== outerSide || candidate.targetSide !== outerSide) {
        return routeEdge(candidate.source, candidate.target, candidate.sourceSide, candidate.targetSide, candidate.sourceOffset, candidate.targetOffset, laneIndex, candidate.edge.arrow, nodes);
    }
    const start = anchorPoint(candidate.source, candidate.sourceSide, candidate.sourceOffset, 10);
    const tip = anchorPoint(candidate.target, candidate.targetSide, candidate.targetOffset, 14);
    const sourceVector = sideVector(candidate.sourceSide);
    const targetVector = sideVector(candidate.targetSide);
    const sourceStub = {
        x: start.x + sourceVector.x * 24,
        y: start.y + sourceVector.y * 24,
    };
    const targetStub = {
        x: tip.x + targetVector.x * 24,
        y: tip.y + targetVector.y * 24,
    };
    const lane = horizontalMain
        ? Math.max(...nodes.map((node) => node.position.y + node.height / 2)) +
            34 +
            laneIndex * FEEDBACK_LANE_GAP
        : Math.max(...nodes.map((node) => node.position.x + node.width / 2)) +
            34 +
            laneIndex * FEEDBACK_LANE_GAP;
    const points = horizontalMain
        ? [
            start,
            sourceStub,
            { x: sourceStub.x, y: lane },
            { x: targetStub.x, y: lane },
            targetStub,
            tip,
        ]
        : [
            start,
            sourceStub,
            { x: lane, y: sourceStub.y },
            { x: lane, y: targetStub.y },
            targetStub,
            tip,
        ];
    return finalizeEdgeRoute(points, candidate.edge.arrow, candidate.sourceSide, candidate.targetSide);
}
function distributePortOffsets(desired, limit, gap) {
    if (desired.length <= 1)
        return desired.map((offset) => clamp(offset, -limit, limit));
    const blocks = desired.map((offset, index) => ({
        count: 1,
        end: index,
        start: index,
        sum: clamp(offset, -limit, limit) - index * gap,
    }));
    for (let index = 1; index < blocks.length;) {
        const previous = blocks[index - 1];
        const current = blocks[index];
        if (previous.sum / previous.count <= current.sum / current.count) {
            index += 1;
            continue;
        }
        blocks.splice(index - 1, 2, {
            count: previous.count + current.count,
            end: current.end,
            start: previous.start,
            sum: previous.sum + current.sum,
        });
        index = Math.max(1, index - 1);
    }
    const transformed = new Array(desired.length);
    const minimum = -limit;
    const maximum = limit - (desired.length - 1) * gap;
    blocks.forEach((block) => {
        const value = clamp(block.sum / block.count, minimum, maximum);
        for (let index = block.start; index <= block.end; index += 1) {
            transformed[index] = value;
        }
    });
    return transformed.map((offset, index) => offset + index * gap);
}
function routeSequenceGraphEdges(nodes, edges, edgePatches, measuredEdgeLabels) {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const firstMessageY = 154;
    const messageGap = Math.max(68, ...edges.map((edge) => naturalEdgeLabelMetrics(edge, measuredEdgeLabels).height + 34));
    return edges.flatMap((edge, index) => {
        if (edge.stroke === 'invisible')
            return [];
        const source = nodesById.get(edge.sourceId);
        const target = nodesById.get(edge.targetId);
        if (!source || !target)
            return [];
        const y = firstMessageY + index * messageGap;
        const forward = target.position.x >= source.position.x;
        const sourceSide = forward ? 'right' : 'left';
        const targetSide = forward ? 'left' : 'right';
        const metrics = naturalEdgeLabelMetrics(edge, measuredEdgeLabels);
        const automaticPoints = source.id === target.id
            ? [
                { x: source.position.x, y },
                { x: source.position.x + 78, y },
                { x: source.position.x + 78, y: y + 38 },
                { x: source.position.x, y: y + 38 },
            ]
            : [
                { x: source.position.x, y },
                { x: target.position.x, y },
            ];
        const patch = edgePatches.get(edge.id);
        const points = patch?.points.length && isOrthogonalRoute(patch.points)
            ? normalizeOrthogonalPoints(patch.points)
            : automaticPoints;
        const route = finalizeEdgeRoute(points, edge.arrow, sourceSide, targetSide);
        const midpoint = source.id === target.id
            ? { x: source.position.x + 39, y: y - metrics.height / 2 - 7 }
            : {
                x: (source.position.x + target.position.x) / 2,
                y: y - metrics.height / 2 - 7,
            };
        return [{
                edge,
                route: {
                    ...route,
                    label: patch?.label ?? midpoint,
                    labelMaximumTextWidth: source.id === target.id
                        ? 156
                        : Math.max(120, Math.min(300, Math.abs(target.position.x - source.position.x) - 32)),
                },
            }];
    });
}
function measuredEdgeLabel(edge, measurements) {
    const measured = measurements.get(edge.id);
    return measured?.label === edge.label ? measured : undefined;
}
function naturalEdgeLabelMetrics(edge, measurements) {
    const natural = measureDiagramEdgeLabel(edge.label, edge.bareLabel);
    const measured = measuredEdgeLabel(edge, measurements);
    return measured && sameTextLines(measured.lines, natural.lines) ? measured : natural;
}
function sameTextLines(first, second) {
    return first.length === second.length && first.every((line, index) => line === second[index]);
}
function resolveAnchorSides(source, target) {
    if (source.id === target.id) {
        return { source: 'right', target: 'top' };
    }
    const deltaX = target.position.x - source.position.x;
    const deltaY = target.position.y - source.position.y;
    const horizontalScore = Math.abs(deltaX) / Math.max(1, (source.width + target.width) / 2);
    const verticalScore = Math.abs(deltaY) / Math.max(1, (source.height + target.height) / 2);
    if (horizontalScore >= verticalScore) {
        return deltaX >= 0
            ? { source: 'right', target: 'left' }
            : { source: 'left', target: 'right' };
    }
    return deltaY >= 0
        ? { source: 'bottom', target: 'top' }
        : { source: 'top', target: 'bottom' };
}
function routeEdge(source, target, sourceSide, targetSide, sourceOffset, targetOffset, laneIndex, arrow, obstacles) {
    const sourceGap = 10;
    const targetGap = 14;
    if (source.id === target.id) {
        const right = source.position.x + source.width / 2;
        const top = source.position.y - source.height / 2;
        const points = [
            { x: right + sourceGap, y: source.position.y - 10 },
            { x: right + 58 + (laneIndex % 4) * 6, y: source.position.y - 10 },
            { x: right + 58 + (laneIndex % 4) * 6, y: top - 48 },
            { x: source.position.x, y: top - 48 },
            { x: source.position.x, y: top - targetGap },
        ];
        return finalizeEdgeRoute(points, arrow, sourceSide, targetSide);
    }
    const rawStart = anchorPoint(source, sourceSide, sourceOffset, 0);
    const rawTip = anchorPoint(target, targetSide, targetOffset, 0);
    const directFacing = isDirectFacingRoute(rawStart, rawTip, sourceSide, targetSide);
    const directRouteClear = directFacing && directFacingRouteAvoidsNodes(rawStart, rawTip, source, target, obstacles);
    if (laneIndex !== 0 && directRouteClear) {
        // A reverse arrow shares the logical pin. Start the outgoing shaft behind
        // that arrow tip so it can never protrude through the opposite arrowhead.
        const pairedSourceGap = targetGap + 3;
        const start = anchorPoint(source, sourceSide, sourceOffset, pairedSourceGap);
        const tip = anchorPoint(target, targetSide, targetOffset, targetGap);
        const sourceVector = sideVector(sourceSide);
        const targetVector = sideVector(targetSide);
        const stubLength = 22;
        const sourceStub = {
            x: start.x + sourceVector.x * stubLength,
            y: start.y + sourceVector.y * stubLength,
        };
        const targetStub = {
            x: tip.x + targetVector.x * stubLength,
            y: tip.y + targetVector.y * stubLength,
        };
        const laneOffset = Math.sign(laneIndex) * pairedLaneOffset(laneIndex);
        const horizontal = sourceSide === 'left' || sourceSide === 'right';
        const points = horizontal
            ? [
                start,
                sourceStub,
                { x: sourceStub.x, y: (sourceStub.y + targetStub.y) / 2 + laneOffset },
                { x: targetStub.x, y: (sourceStub.y + targetStub.y) / 2 + laneOffset },
                targetStub,
                tip,
            ]
            : [
                start,
                sourceStub,
                { x: (sourceStub.x + targetStub.x) / 2 + laneOffset, y: sourceStub.y },
                { x: (sourceStub.x + targetStub.x) / 2 + laneOffset, y: targetStub.y },
                targetStub,
                tip,
            ];
        return finalizeEdgeRoute(points, arrow, sourceSide, targetSide);
    }
    if (directRouteClear) {
        const clearance = Math.max(0, distanceAlongSide(rawStart, rawTip, sourceSide));
        // Keep a visible shaft on close neighbouring cards while retaining a gap at
        // both anchors. Fixed 10/14 px stubs would otherwise consume the whole gap.
        const directSourceGap = Math.min(sourceGap, Math.max(2, clearance * 0.16));
        const directTargetGap = Math.min(targetGap, Math.max(4, clearance * 0.22));
        return finalizeEdgeRoute([
            anchorPoint(source, sourceSide, sourceOffset, directSourceGap),
            anchorPoint(target, targetSide, targetOffset, directTargetGap),
        ], arrow, sourceSide, targetSide);
    }
    const start = anchorPoint(source, sourceSide, sourceOffset, sourceGap);
    const tip = anchorPoint(target, targetSide, targetOffset, targetGap);
    const sourceVector = sideVector(sourceSide);
    const targetVector = sideVector(targetSide);
    const approach = 32 + (Math.abs(laneIndex) % 3) * 5;
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
    const routeObstacles = obstacles.filter((node) => node.id !== source.id && node.id !== target.id);
    if (laneIndex !== 0 && sourceHorizontal === targetHorizontal) {
        const pairedRoute = pairedObstacleLaneRoute(start, sourceStub, targetStub, tip, source, target, routeObstacles, sourceHorizontal, laneIndex);
        if (pairedRoute) {
            return finalizeEdgeRoute(pairedRoute, arrow, sourceSide, targetSide);
        }
    }
    const obstacleRoute = findObstacleAvoidingRoute(sourceStub, targetStub, routeObstacles, sourceSide, targetSide, 14 + (Math.abs(laneIndex) % 3) * 3);
    let points;
    if (obstacleRoute) {
        points = [start, ...obstacleRoute, tip];
    }
    else if (sourceHorizontal !== targetHorizontal) {
        points = sourceHorizontal
            ? [start, sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub, tip]
            : [start, sourceStub, { x: sourceStub.x, y: targetStub.y }, targetStub, tip];
    }
    else if (sourceHorizontal) {
        const facing = (sourceSide === 'right' && targetSide === 'left' && sourceStub.x <= targetStub.x) ||
            (sourceSide === 'left' && targetSide === 'right' && sourceStub.x >= targetStub.x);
        if (facing) {
            const middleX = (sourceStub.x + targetStub.x) / 2;
            points = [
                start,
                sourceStub,
                { x: middleX, y: sourceStub.y },
                { x: middleX, y: targetStub.y },
                targetStub,
                tip,
            ];
        }
        else if (sourceSide === targetSide) {
            const laneX = sourceSide === 'right'
                ? Math.max(sourceStub.x, targetStub.x) + approach
                : Math.min(sourceStub.x, targetStub.x) - approach;
            points = [
                start,
                sourceStub,
                { x: laneX, y: sourceStub.y },
                { x: laneX, y: targetStub.y },
                targetStub,
                tip,
            ];
        }
        else {
            const laneY = source.position.y <= target.position.y
                ? Math.min(sourceStub.y, targetStub.y) - approach
                : Math.max(sourceStub.y, targetStub.y) + approach;
            points = [
                start,
                sourceStub,
                { x: sourceStub.x, y: laneY },
                { x: targetStub.x, y: laneY },
                targetStub,
                tip,
            ];
        }
    }
    else {
        const facing = (sourceSide === 'bottom' && targetSide === 'top' && sourceStub.y <= targetStub.y) ||
            (sourceSide === 'top' && targetSide === 'bottom' && sourceStub.y >= targetStub.y);
        if (facing) {
            const middleY = (sourceStub.y + targetStub.y) / 2;
            points = [
                start,
                sourceStub,
                { x: sourceStub.x, y: middleY },
                { x: targetStub.x, y: middleY },
                targetStub,
                tip,
            ];
        }
        else if (sourceSide === targetSide) {
            const laneY = sourceSide === 'bottom'
                ? Math.max(sourceStub.y, targetStub.y) + approach
                : Math.min(sourceStub.y, targetStub.y) - approach;
            points = [
                start,
                sourceStub,
                { x: sourceStub.x, y: laneY },
                { x: targetStub.x, y: laneY },
                targetStub,
                tip,
            ];
        }
        else {
            const laneX = source.position.x <= target.position.x
                ? Math.min(sourceStub.x, targetStub.x) - approach
                : Math.max(sourceStub.x, targetStub.x) + approach;
            points = [
                start,
                sourceStub,
                { x: laneX, y: sourceStub.y },
                { x: laneX, y: targetStub.y },
                targetStub,
                tip,
            ];
        }
    }
    return finalizeEdgeRoute(points, arrow, sourceSide, targetSide);
}
function pairedObstacleLaneRoute(start, sourceStub, targetStub, tip, source, target, obstacles, horizontal, laneIndex) {
    const laneClearance = 28 + Math.max(0, Math.abs(laneIndex) - 1) * 12;
    if (horizontal) {
        const left = Math.min(source.position.x, target.position.x) - 180;
        const right = Math.max(source.position.x, target.position.x) + 180;
        const local = [source, target, ...obstacles.filter((node) => {
                const nodeLeft = node.position.x - node.width / 2;
                const nodeRight = node.position.x + node.width / 2;
                return nodeRight >= left && nodeLeft <= right &&
                    Math.abs(node.position.y - (source.position.y + target.position.y) / 2) <= 180;
            })];
        const laneY = laneIndex < 0
            ? Math.min(...local.map((node) => node.position.y - node.height / 2)) - laneClearance
            : Math.max(...local.map((node) => node.position.y + node.height / 2)) + laneClearance;
        return [
            start,
            sourceStub,
            { x: sourceStub.x, y: laneY },
            { x: targetStub.x, y: laneY },
            targetStub,
            tip,
        ];
    }
    const top = Math.min(source.position.y, target.position.y) - 180;
    const bottom = Math.max(source.position.y, target.position.y) + 180;
    const local = [source, target, ...obstacles.filter((node) => {
            const nodeTop = node.position.y - node.height / 2;
            const nodeBottom = node.position.y + node.height / 2;
            return nodeBottom >= top && nodeTop <= bottom &&
                Math.abs(node.position.x - (source.position.x + target.position.x) / 2) <= 180;
        })];
    const laneX = laneIndex < 0
        ? Math.min(...local.map((node) => node.position.x - node.width / 2)) - laneClearance
        : Math.max(...local.map((node) => node.position.x + node.width / 2)) + laneClearance;
    return [
        start,
        sourceStub,
        { x: laneX, y: sourceStub.y },
        { x: laneX, y: targetStub.y },
        targetStub,
        tip,
    ];
}
function isDirectFacingRoute(start, tip, sourceSide, targetSide) {
    if (oppositeSide(sourceSide) !== targetSide)
        return false;
    if (sourceSide === 'left')
        return Math.abs(start.y - tip.y) < 0.1 && tip.x <= start.x;
    if (sourceSide === 'right')
        return Math.abs(start.y - tip.y) < 0.1 && tip.x >= start.x;
    if (sourceSide === 'top')
        return Math.abs(start.x - tip.x) < 0.1 && tip.y <= start.y;
    return Math.abs(start.x - tip.x) < 0.1 && tip.y >= start.y;
}
function directFacingRouteAvoidsNodes(start, end, source, target, nodes) {
    const clearance = 8;
    const obstacles = nodes
        .filter((node) => node.id !== source.id && node.id !== target.id)
        .map((node) => ({
        bottom: node.position.y + node.height / 2 + clearance,
        left: node.position.x - node.width / 2 - clearance,
        right: node.position.x + node.width / 2 + clearance,
        top: node.position.y - node.height / 2 - clearance,
    }));
    return segmentAvoidsRectangles(start, end, obstacles);
}
function distanceAlongSide(start, end, side) {
    const direction = sideVector(side);
    return (end.x - start.x) * direction.x + (end.y - start.y) * direction.y;
}
function findObstacleAvoidingRoute(start, end, nodes, sourceSide, targetSide, clearance) {
    const routeWindow = {
        left: Math.min(start.x, end.x) - 180,
        right: Math.max(start.x, end.x) + 180,
        top: Math.min(start.y, end.y) - 180,
        bottom: Math.max(start.y, end.y) + 180,
    };
    const rectangles = nodes
        .map((node) => ({
        left: node.position.x - node.width / 2 - clearance,
        right: node.position.x + node.width / 2 + clearance,
        top: node.position.y - node.height / 2 - clearance,
        bottom: node.position.y + node.height / 2 + clearance,
    }))
        .filter((rectangle) => rectangle.right >= routeWindow.left &&
        rectangle.left <= routeWindow.right &&
        rectangle.bottom >= routeWindow.top &&
        rectangle.top <= routeWindow.bottom);
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
    const points = [];
    const pointIndexes = new Map();
    yValues.forEach((y) => {
        xValues.forEach((x) => {
            const point = { x, y };
            if (rectangles.some((rectangle) => pointInsideRectangle(point, rectangle)))
                return;
            pointIndexes.set(pointKey(point), points.length);
            points.push(point);
        });
    });
    const startIndex = pointIndexes.get(pointKey(start));
    const endIndex = pointIndexes.get(pointKey(end));
    if (startIndex === undefined || endIndex === undefined)
        return null;
    const neighbors = Array.from({ length: points.length }, () => []);
    const connectVisible = (indexes, direction) => {
        indexes.sort((first, second) => direction === 1
            ? points[first].x - points[second].x
            : points[first].y - points[second].y);
        for (let index = 1; index < indexes.length; index += 1) {
            const first = indexes[index - 1];
            const second = indexes[index];
            if (!segmentAvoidsRectangles(points[first], points[second], rectangles))
                continue;
            const distance = Math.abs(points[first].x - points[second].x) +
                Math.abs(points[first].y - points[second].y);
            neighbors[first].push({ direction, distance, index: second });
            neighbors[second].push({ direction, distance, index: first });
        }
    };
    yValues.forEach((y) => {
        connectVisible(points.flatMap((point, index) => (Math.abs(point.y - y) < 0.05 ? [index] : [])), 1);
    });
    xValues.forEach((x) => {
        connectVisible(points.flatMap((point, index) => (Math.abs(point.x - x) < 0.05 ? [index] : [])), 2);
    });
    const horizontalSource = sourceSide === 'left' || sourceSide === 'right';
    const horizontalTarget = targetSide === 'left' || targetSide === 'right';
    const sourceDirection = horizontalSource ? 1 : 2;
    const targetDirection = horizontalTarget ? 1 : 2;
    const stateCount = points.length * 2;
    const distances = new Float64Array(stateCount);
    distances.fill(Number.POSITIVE_INFINITY);
    const previousStates = new Int32Array(stateCount);
    previousStates.fill(-1);
    const startState = startIndex * 2 + sourceDirection - 1;
    distances[startState] = 0;
    const queue = [];
    pushRouteQueue(queue, { cost: 0, state: startState });
    const bendCost = 34;
    while (queue.length > 0) {
        const current = popRouteQueue(queue);
        if (!current || current.cost !== distances[current.state])
            continue;
        const pointIndex = Math.floor(current.state / 2);
        const direction = (current.state % 2) + 1;
        neighbors[pointIndex].forEach((neighbor) => {
            const nextState = neighbor.index * 2 + neighbor.direction - 1;
            const nextCost = current.cost + neighbor.distance + (direction === neighbor.direction ? 0 : bendCost);
            if (nextCost >= distances[nextState])
                return;
            distances[nextState] = nextCost;
            previousStates[nextState] = current.state;
            pushRouteQueue(queue, { cost: nextCost, state: nextState });
        });
    }
    const endStates = [1, 2].map((direction) => {
        const state = endIndex * 2 + direction - 1;
        return {
            cost: distances[state] + (direction === targetDirection ? 0 : bendCost),
            state,
        };
    });
    const bestEnd = endStates.sort((first, second) => first.cost - second.cost)[0];
    if (!Number.isFinite(bestEnd.cost))
        return null;
    const routed = [];
    let state = bestEnd.state;
    while (state >= 0) {
        routed.push(points[Math.floor(state / 2)]);
        if (state === startState)
            break;
        state = previousStates[state];
    }
    if (state !== startState)
        return null;
    routed.reverse();
    return normalizeOrthogonalPoints(routed);
}
function uniqueCoordinates(values) {
    return [...new Set(values.map((value) => format(value)))].sort((first, second) => first - second);
}
function pointKey(point) {
    return `${format(point.x)}:${format(point.y)}`;
}
function pointInsideRectangle(point, rectangle) {
    const epsilon = 0.05;
    return (point.x > rectangle.left + epsilon &&
        point.x < rectangle.right - epsilon &&
        point.y > rectangle.top + epsilon &&
        point.y < rectangle.bottom - epsilon);
}
function segmentAvoidsRectangles(start, end, rectangles) {
    const epsilon = 0.05;
    if (Math.abs(start.y - end.y) < epsilon) {
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        return rectangles.every((rectangle) => start.y <= rectangle.top + epsilon ||
            start.y >= rectangle.bottom - epsilon ||
            right <= rectangle.left + epsilon ||
            left >= rectangle.right - epsilon);
    }
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    return rectangles.every((rectangle) => start.x <= rectangle.left + epsilon ||
        start.x >= rectangle.right - epsilon ||
        bottom <= rectangle.top + epsilon ||
        top >= rectangle.bottom - epsilon);
}
function pushRouteQueue(queue, item) {
    queue.push(item);
    let index = queue.length - 1;
    while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (queue[parent].cost <= item.cost)
            break;
        queue[index] = queue[parent];
        index = parent;
    }
    queue[index] = item;
}
function popRouteQueue(queue) {
    const first = queue[0];
    const last = queue.pop();
    if (!first || !last || queue.length === 0)
        return first;
    let index = 0;
    while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= queue.length)
            break;
        const child = right < queue.length && queue[right].cost < queue[left].cost ? right : left;
        if (queue[child].cost >= last.cost)
            break;
        queue[index] = queue[child];
        index = child;
    }
    queue[index] = last;
    return first;
}
function getRouteSegmentHandles(points) {
    const handles = points
        .slice(0, -1)
        .map((start, segmentIndex) => {
        const end = points[segmentIndex + 1];
        const horizontal = Math.abs(start.y - end.y) < 0.1;
        const vertical = Math.abs(start.x - end.x) < 0.1;
        if (!horizontal && !vertical)
            return null;
        // Endpoint stubs remain automatic so their side/gap constraint is never broken.
        if (segmentIndex < 1 || segmentIndex > points.length - 3)
            return null;
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (length < 20)
            return null;
        return {
            orientation: horizontal ? 'horizontal' : 'vertical',
            segmentIndex,
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
            length,
        };
    })
        .filter((handle) => Boolean(handle))
        .sort((first, second) => second.length - first.length)
        .slice(0, 2)
        .map(({ length: _length, ...handle }) => handle);
    return handles;
}
function moveRouteSegment(points, handle, point) {
    const next = points.map((routePoint) => ({ ...routePoint }));
    const start = next[handle.segmentIndex];
    const end = next[handle.segmentIndex + 1];
    if (!start || !end)
        return next;
    if (handle.orientation === 'horizontal') {
        start.y = point.y;
        end.y = point.y;
    }
    else {
        start.x = point.x;
        end.x = point.x;
    }
    return next;
}
function sameRoutePoints(first, second) {
    return (first.length === second.length &&
        first.every((point, index) => Math.abs(point.x - second[index].x) < 0.1 && Math.abs(point.y - second[index].y) < 0.1));
}
function finalizeEdgeRoute(points, arrow, sourceSide, targetSide) {
    const normalized = normalizeOrthogonalPoints(points);
    const label = polylineMidpoint(normalized);
    if (!arrow || normalized.length < 2) {
        return { label, path: orthogonalPath(normalized), points: normalized, sourceSide, targetSide };
    }
    const tip = normalized.at(-1);
    const previous = normalized.at(-2);
    if (!tip || !previous) {
        return { label, path: orthogonalPath(normalized), points: normalized, sourceSide, targetSide };
    }
    const segmentLength = Math.hypot(tip.x - previous.x, tip.y - previous.y);
    if (segmentLength < 1) {
        return { label, path: orthogonalPath(normalized), points: normalized, sourceSide, targetSide };
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
    const left = { x: base.x - direction.y * halfWidth, y: base.y + direction.x * halfWidth };
    const right = { x: base.x + direction.y * halfWidth, y: base.y - direction.x * halfWidth };
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
function withSourceArrow(route) {
    const tip = route.points[0];
    const next = route.points[1];
    if (!tip || !next)
        return route;
    const segmentLength = Math.hypot(tip.x - next.x, tip.y - next.y);
    if (segmentLength < 1)
        return route;
    const direction = {
        x: (tip.x - next.x) / segmentLength,
        y: (tip.y - next.y) / segmentLength,
    };
    const arrowLength = Math.min(11, Math.max(6, segmentLength * 0.58));
    const halfWidth = arrowLength * 0.52;
    const base = {
        x: tip.x - direction.x * arrowLength,
        y: tip.y - direction.y * arrowLength,
    };
    const left = { x: base.x - direction.y * halfWidth, y: base.y + direction.x * halfWidth };
    const right = { x: base.x + direction.y * halfWidth, y: base.y - direction.x * halfWidth };
    return {
        ...route,
        sourceArrowPoints: [tip, left, right]
            .map((point) => `${format(point.x)},${format(point.y)}`)
            .join(' '),
    };
}
function applyEdgeRoutePatch(automatic, patch, arrow, source, target) {
    if (!patch)
        return automatic;
    if (patch.points.length < 2 || automatic.points.length < 2) {
        return patch.label ? { ...automatic, label: patch.label } : automatic;
    }
    // An authored route whose endpoints still sit on both node borders is exact
    // geometry (for example an ELK or agent layout for unmoved nodes). Keep it
    // verbatim instead of re-anchoring, which would bend the port order the
    // author chose into micro jogs and avoidable crossings.
    const patchStart = patch.points[0];
    const patchEnd = patch.points.at(-1);
    if (source && target && patchStart && patchEnd &&
        pointOnNodeBorder(patchStart, source) &&
        pointOnNodeBorder(patchEnd, target)) {
        const points = normalizeOrthogonalPoints(patch.points.map((point) => ({ ...point })));
        if (isOrthogonalRoute(points)) {
            const route = finalizeEdgeRoute(points, arrow, automatic.sourceSide, automatic.targetSide);
            return patch.label ? { ...route, label: patch.label } : route;
        }
    }
    const start = automatic.points[0];
    const end = automatic.points.at(-1);
    if (!start || !end)
        return patch.label ? { ...automatic, label: patch.label } : automatic;
    const patchedPoints = patch.points.map((point) => ({ ...point }));
    patchedPoints[0] = start;
    patchedPoints[patchedPoints.length - 1] = end;
    const sourceNeighbor = patchedPoints[1];
    const targetNeighbor = patchedPoints.at(-2);
    if (sourceNeighbor && targetNeighbor && patchedPoints.length > 2) {
        if (automatic.sourceSide === 'top' || automatic.sourceSide === 'bottom') {
            sourceNeighbor.x = start.x;
        }
        else {
            sourceNeighbor.y = start.y;
        }
        if (automatic.targetSide === 'top' || automatic.targetSide === 'bottom') {
            targetNeighbor.x = end.x;
        }
        else {
            targetNeighbor.y = end.y;
        }
    }
    const points = normalizeOrthogonalPoints(patchedPoints);
    if (!isOrthogonalRoute(points))
        return patch.label ? { ...automatic, label: patch.label } : automatic;
    const route = finalizeEdgeRoute(points, arrow, automatic.sourceSide, automatic.targetSide);
    return patch.label ? { ...route, label: patch.label } : route;
}
function translateEdgeRoutePatch(patch, delta) {
    return {
        ...(patch.label
            ? { label: { x: patch.label.x + delta.x, y: patch.label.y + delta.y } }
            : null),
        points: patch.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
    };
}
function pointOnNodeBorder(point, node, tolerance = 3) {
    const deltaX = Math.abs(point.x - node.position.x) - node.width / 2;
    const deltaY = Math.abs(point.y - node.position.y) - node.height / 2;
    if (deltaX > tolerance || deltaY > tolerance)
        return false;
    return Math.abs(deltaX) <= tolerance || Math.abs(deltaY) <= tolerance;
}
function isOrthogonalRoute(points) {
    return points.slice(1).every((point, index) => {
        const previous = points[index];
        return Math.abs(point.x - previous.x) < 0.1 || Math.abs(point.y - previous.y) < 0.1;
    });
}
function normalizeOrthogonalPoints(points) {
    const deduplicated = points.filter((point, index) => index === 0 ||
        Math.abs(point.x - points[index - 1].x) >= 0.1 ||
        Math.abs(point.y - points[index - 1].y) >= 0.1);
    const normalized = [];
    deduplicated.forEach((point) => {
        const previous = normalized.at(-1);
        const beforePrevious = normalized.at(-2);
        if (previous &&
            beforePrevious &&
            ((Math.abs(beforePrevious.x - previous.x) < 0.1 && Math.abs(previous.x - point.x) < 0.1) ||
                (Math.abs(beforePrevious.y - previous.y) < 0.1 && Math.abs(previous.y - point.y) < 0.1))) {
            normalized[normalized.length - 1] = point;
        }
        else {
            normalized.push(point);
        }
    });
    return normalized;
}
function portOffsetLimit(node, side) {
    const halfSpan = side === 'top' || side === 'bottom' ? node.width / 2 : node.height / 2;
    const inset = node.shape === 'circle' || node.shape === 'diamond' ? halfSpan * 0.38 : 16;
    return Math.max(0, halfSpan - inset);
}
function anchorPoint(node, side, requestedOffset, gap) {
    const halfWidth = node.width / 2;
    const halfHeight = node.height / 2;
    const offset = clamp(requestedOffset, -portOffsetLimit(node, side), portOffsetLimit(node, side));
    let boundary;
    if (side === 'top' || side === 'bottom') {
        let boundaryY = halfHeight;
        if (node.shape === 'circle') {
            boundaryY = halfHeight * Math.sqrt(Math.max(0, 1 - (offset * offset) / (halfWidth * halfWidth)));
        }
        else if (node.shape === 'diamond') {
            boundaryY = halfHeight * (1 - Math.min(1, Math.abs(offset) / halfWidth));
        }
        boundary = {
            x: node.position.x + offset,
            y: node.position.y + (side === 'bottom' ? boundaryY : -boundaryY),
        };
    }
    else {
        let boundaryX = halfWidth;
        if (node.shape === 'circle') {
            boundaryX = halfWidth * Math.sqrt(Math.max(0, 1 - (offset * offset) / (halfHeight * halfHeight)));
        }
        else if (node.shape === 'diamond') {
            boundaryX = halfWidth * (1 - Math.min(1, Math.abs(offset) / halfHeight));
        }
        boundary = {
            x: node.position.x + (side === 'right' ? boundaryX : -boundaryX),
            y: node.position.y + offset,
        };
    }
    const vector = sideVector(side);
    return { x: boundary.x + vector.x * gap, y: boundary.y + vector.y * gap };
}
function sideVector(side) {
    if (side === 'top')
        return { x: 0, y: -1 };
    if (side === 'right')
        return { x: 1, y: 0 };
    if (side === 'bottom')
        return { x: 0, y: 1 };
    return { x: -1, y: 0 };
}
function orthogonalPath(points) {
    if (points.length < 2)
        return '';
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
        const radius = Math.min(ORTHOGONAL_CORNER_RADIUS, incomingLength / 2, outgoingLength / 2);
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
        const incoming = { x: corner.x - previous.x, y: corner.y - previous.y };
        const outgoing = { x: next.x - corner.x, y: next.y - corner.y };
        const sweep = incoming.x * outgoing.y - incoming.y * outgoing.x > 0 ? 1 : 0;
        commands.push(`L ${format(before.x)} ${format(before.y)} A ${format(radius)} ${format(radius)} 0 0 ${sweep} ${format(after.x)} ${format(after.y)}`);
    }
    const end = points.at(-1);
    if (end)
        commands.push(`L ${format(end.x)} ${format(end.y)}`);
    return commands.join(' ');
}
function polylineMidpoint(points) {
    const segments = points.slice(1).map((point, index) => {
        const start = points[index];
        return { length: Math.hypot(point.x - start.x, point.y - start.y), start, end: point };
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
    return points.at(-1) ?? { x: 0, y: 0 };
}
function snapNodePosition(nodes, movingNode, requested) {
    const threshold = 6;
    let bestX;
    let bestY;
    const movingX = [requested.x - movingNode.width / 2, requested.x, requested.x + movingNode.width / 2];
    const movingY = [requested.y - movingNode.height / 2, requested.y, requested.y + movingNode.height / 2];
    nodes.forEach((candidate) => {
        if (candidate.id === movingNode.id)
            return;
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
                    bestX = { distance, guide: candidateValue, offset };
                }
            });
        });
        movingY.forEach((movingValue) => {
            candidateY.forEach((candidateValue) => {
                const offset = candidateValue - movingValue;
                const distance = Math.abs(offset);
                if (distance <= threshold && (!bestY || distance < bestY.distance)) {
                    bestY = { distance, guide: candidateValue, offset };
                }
            });
        });
    });
    return {
        guides: { x: bestX?.guide, y: bestY?.guide },
        position: {
            x: requested.x + (bestX?.offset ?? 0),
            y: requested.y + (bestY?.offset ?? 0),
        },
    };
}
function layoutBoardGroups(groups, nodes) {
    const nodeBounds = new Map(nodes.map((node) => [node.id, {
            bottom: node.position.y + node.height / 2,
            left: node.position.x - node.width / 2,
            right: node.position.x + node.width / 2,
            top: node.position.y - node.height / 2,
        }]));
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const children = new Map();
    groups.forEach((group) => {
        if (!group.parentId || !groupsById.has(group.parentId))
            return;
        const nested = children.get(group.parentId) ?? [];
        nested.push(group);
        children.set(group.parentId, nested);
    });
    const resolved = new Map();
    const resolving = new Set();
    const resolve = (group) => {
        const previous = resolved.get(group.id);
        if (previous)
            return previous;
        if (resolving.has(group.id))
            return undefined;
        resolving.add(group.id);
        const rectangles = group.nodeIds.flatMap((nodeId) => {
            const bounds = nodeBounds.get(nodeId);
            return bounds ? [bounds] : [];
        });
        (children.get(group.id) ?? []).forEach((child) => {
            const nested = resolve(child);
            if (nested)
                rectangles.push(nested.bounds);
        });
        resolving.delete(group.id);
        if (rectangles.length === 0)
            return undefined;
        const bounds = {
            bottom: Math.max(...rectangles.map((rectangle) => rectangle.bottom)) + 22,
            left: Math.min(...rectangles.map((rectangle) => rectangle.left)) - 24,
            right: Math.max(...rectangles.map((rectangle) => rectangle.right)) + 24,
            top: Math.min(...rectangles.map((rectangle) => rectangle.top)) - 44,
        };
        const layoutGroup = { ...group, bounds };
        resolved.set(group.id, layoutGroup);
        return layoutGroup;
    };
    return groups.flatMap((group) => {
        const layout = resolve(group);
        return layout ? [layout] : [];
    });
}
function getLayoutBounds(nodes, padding, groups = []) {
    const rectangles = [
        ...nodes.map((node) => ({
            bottom: node.position.y + node.height / 2,
            left: node.position.x - node.width / 2,
            right: node.position.x + node.width / 2,
            top: node.position.y - node.height / 2,
        })),
        ...groups.map((group) => group.bounds),
    ];
    if (rectangles.length === 0)
        return { height: 120, left: 0, top: 0, width: 320 };
    const left = Math.min(...rectangles.map((rectangle) => rectangle.left)) - padding;
    const right = Math.max(...rectangles.map((rectangle) => rectangle.right)) + padding;
    const top = Math.min(...rectangles.map((rectangle) => rectangle.top)) - padding;
    const bottom = Math.max(...rectangles.map((rectangle) => rectangle.bottom)) + padding;
    return { height: bottom - top, left, top, width: right - left };
}
function getRenderedDiagramBounds(nodes, routedEdges, padding, groups = []) {
    const rectangles = [
        ...nodes.map((node) => ({
            bottom: node.position.y + node.height / 2,
            left: node.position.x - node.width / 2,
            right: node.position.x + node.width / 2,
            top: node.position.y - node.height / 2,
        })),
        ...groups.map((group) => group.bounds),
    ];
    routedEdges.forEach(({ edge, route }) => {
        route.points.forEach((point) => {
            rectangles.push({ bottom: point.y, left: point.x, right: point.x, top: point.y });
        });
        if (!edge.label)
            return;
        const naturalMetrics = measureDiagramEdgeLabel(edge.label, edge.bareLabel, route.labelMaximumTextWidth);
        const metrics = route.labelMode === 'floating'
            ? compactDiagramEdgeLabelMetrics(naturalMetrics, edge.bareLabel)
            : naturalMetrics;
        const labelPaddingX = route.labelMode === 'floating' ? 2 : edge.bareLabel ? 7 : 9;
        const left = edge.labelAlign === 'start'
            ? route.label.x - labelPaddingX
            : edge.labelAlign === 'end'
                ? route.label.x - metrics.width + labelPaddingX
                : route.label.x - metrics.width / 2;
        rectangles.push({
            bottom: route.label.y + metrics.height / 2,
            left,
            right: left + metrics.width,
            top: route.label.y - metrics.height / 2,
        });
    });
    if (rectangles.length === 0)
        return { height: 120, left: 0, top: 0, width: 320 };
    const left = Math.min(...rectangles.map((rectangle) => rectangle.left)) - padding;
    const right = Math.max(...rectangles.map((rectangle) => rectangle.right)) + padding;
    const top = Math.min(...rectangles.map((rectangle) => rectangle.top)) - padding;
    const bottom = Math.max(...rectangles.map((rectangle) => rectangle.bottom)) + padding;
    return { height: bottom - top, left, top, width: right - left };
}
function getEmbeddedDiagramBounds(nodes, routedEdges, groups = []) {
    const content = getRenderedDiagramBounds(nodes, routedEdges, 0, groups);
    const shortestContentAxis = Math.min(content.width, content.height);
    const padding = clamp(shortestContentAxis * 0.055, 24, 36);
    return {
        height: content.height + padding * 2,
        left: content.left - padding,
        top: content.top - padding,
        width: content.width + padding * 2,
    };
}
function unionDiagramBounds(first, second) {
    const left = Math.min(first.left, second.left);
    const top = Math.min(first.top, second.top);
    const right = Math.max(first.left + first.width, second.left + second.width);
    const bottom = Math.max(first.top + first.height, second.top + second.height);
    return { height: bottom - top, left, top, width: right - left };
}
function roundedDiamondPath(halfWidth, halfHeight) {
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
function isFeedbackEdge(edge) {
    return edge.role === 'feedback';
}
function measureTextWidth(value) {
    return measureDiagramTextWidth(value);
}
function clientPointToSvg(svg, clientX, clientY) {
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix)
        return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
}
function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
function format(value) {
    const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Number(safeValue.toFixed(2));
}
//# sourceMappingURL=BoardCanvas.js.map