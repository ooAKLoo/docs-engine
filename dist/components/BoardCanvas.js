'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assignDiagramEdgeLanes, calculateAdaptiveRankGaps, compactDiagramEdgeLabelMetrics, measureDiagramEdgeLabel, measureDiagramTextWidth, placeDiagramEdgeLabels, wrapDiagramText, } from './BoardAutoLayout.js';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const DIRECT_ROUTE_LABEL_RESERVE = 47;
const PAIRED_ROUTE_LABEL_RESERVE = 108;
const PAIRED_LANE_BASE_OFFSET = 32;
const PAIRED_LANE_STEP = 30;
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
    const routedEdges = routeGraphEdges(layout.nodes, layout.edges, routePatches, measuredEdgeLabels, boardDocument.diagramKind);
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
    return (_jsx("div", { className: "de-board", "data-authored-layout": boardLayout ? 'true' : undefined, role: "img", "aria-label": accessibleLabel, children: _jsxs("svg", { ref: svgRef, className: "de-board__svg", viewBox: `${format(renderedDisplayBounds.left)} ${format(renderedDisplayBounds.top)} ${format(renderedDisplayBounds.width)} ${format(renderedDisplayBounds.height)}`, preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true", children: [layout.groups.length > 0 ? (_jsx("g", { className: "de-board__groups", children: layout.groups.map((group) => (_jsxs("g", { className: "de-board__group", "data-de-group-id": group.id, "data-tone": group.tone ?? 'neutral', children: [_jsx("rect", { x: group.bounds.left, y: group.bounds.top, width: group.bounds.right - group.bounds.left, height: group.bounds.bottom - group.bounds.top, rx: "18", ry: "18" }), _jsx("text", { x: group.bounds.left + 18, y: group.bounds.top + 24, children: group.label })] }, group.id))) })) : null, boardDocument.diagramKind === 'sequence' ? (_jsx("g", { className: "de-board__lifelines", children: layout.nodes.map((node) => (_jsx("line", { x1: node.position.x, x2: node.position.x, y1: node.position.y + node.height / 2 + 10, y2: layout.height - 28 }, `${node.id}:lifeline`))) })) : null, _jsxs("g", { className: "de-board__edges", children: [routedEdges.map(({ edge, route }) => {
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
                        }), draftRoute ? (_jsx("g", { className: "de-board__connection-preview", "aria-hidden": "true", children: _jsx("path", { d: draftRoute.path, className: "de-board__edge-path" }) })) : null] }), _jsxs("g", { className: "de-board__arrows", children: [routedEdges.map(({ edge, route }) => route.arrowPoints && edge.stroke !== 'invisible' ? (_jsx("polygon", { className: "de-board__arrow", "data-edge-id": edge.id, "data-feedback": isFeedbackEdge(edge) ? 'true' : undefined, points: route.arrowPoints }, edge.id)) : null), draftRoute?.arrowPoints ? (_jsx("g", { className: "de-board__connection-preview", children: _jsx("polygon", { className: "de-board__arrow", points: draftRoute.arrowPoints }) })) : null] }), _jsx("g", { className: "de-board__edge-labels", children: routedEdges.map(({ edge, route }) => edge.label && edge.stroke !== 'invisible' ? (_jsx(BoardEdgeLabel, { edge: edge, onMeasure: recordEdgeLabelMeasurement, route: route }, edge.id)) : null) }), guides.x !== undefined || guides.y !== undefined ? (_jsxs("g", { className: "de-board__guides", children: [guides.x !== undefined ? (_jsx("line", { x1: guides.x, x2: guides.x, y1: guideBounds.top, y2: guideBounds.top + guideBounds.height })) : null, guides.y !== undefined ? (_jsx("line", { x1: guideBounds.left, x2: guideBounds.left + guideBounds.width, y1: guides.y, y2: guides.y })) : null] })) : null, _jsx("g", { className: "de-board__nodes", children: layout.nodes.map((node) => {
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
    // Dotted return edges are visual feedback loops. They must not turn an
    // otherwise forward flow into a cyclic rank graph and reshuffle the cards.
    const edges = applyBoardEdgeLayout(graph.edges, boardLayout);
    if (graph.diagramKind === 'sequence') {
        return layoutSequenceDiagramGraph(measuredNodes, edges, graph.groups ?? [], boardLayout, measuredEdgeLabels);
    }
    if (hasGroupLayout(graph.groups ?? [], measuredNodes)) {
        return layoutGroupedDiagramGraph(measuredNodes, edges, graph.groups ?? [], graph.direction, patches, boardLayout, measuredEdgeLabels);
    }
    const ranks = assignRanks(measuredNodes, edges.filter((edge) => !edge.manual && !isFeedbackEdge(edge)));
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
    const pairLanes = assignDiagramEdgeLanes(edges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
    })));
    const maximumPairLane = Math.max(0, ...[...pairLanes.values()].map((lane) => Math.abs(lane)));
    const pairLaneOffset = maximumPairLane > 0 ? pairedLaneOffset(maximumPairLane) : 0;
    const maximumLabelCrossSize = Math.max(0, ...edges.map((edge) => {
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
    const rankGaps = calculateAdaptiveRankGaps(sortedRanks.length, horizontal, edges.flatMap((edge) => {
        const sourceRank = rankIndexes.get(ranks.get(edge.sourceId) ?? 0);
        const targetRank = rankIndexes.get(ranks.get(edge.targetId) ?? 0);
        if (sourceRank === undefined || targetRank === undefined)
            return [];
        return [{
                label: edge.label,
                metrics: naturalEdgeLabelMetrics(edge, measuredEdgeLabels),
                // Direct routes consume only anchor clearances. A paired route also owns
                // two 22 px stubs plus the rounded corners around its carrier segment.
                routePadding: pairLanes.has(edge.id)
                    ? PAIRED_ROUTE_LABEL_RESERVE
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
    const rankGaps = calculateAdaptiveRankGaps(sortedRanks.length, horizontal, edges.flatMap((edge) => {
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
        edges,
        groups: layoutBoardGroups(groups, nodes),
        height,
        nodes,
        width,
    };
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
    return edges.map((edge) => {
        const layout = findBoardEdgeLayout(edge, boardLayout);
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
    edges.forEach((edge) => {
        const layout = findBoardEdgeLayout(edge, boardLayout);
        if (!layout?.points?.length && !layout?.labelPosition)
            return;
        patches.set(edge.id, {
            ...(layout.labelPosition ? { label: layout.labelPosition } : null),
            ...(layout.points?.length ? { points: layout.points } : { points: [] }),
        });
    });
    return patches;
}
function findBoardEdgeLayout(edge, boardLayout) {
    return boardLayout.edges?.find((layout) => layout.sourceId === edge.sourceId &&
        layout.targetId === edge.targetId &&
        (layout.label === undefined || layout.label === edge.label));
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
function routeGraphEdges(nodes, edges, edgePatches, measuredEdgeLabels = new Map(), diagramKind) {
    if (diagramKind === 'sequence') {
        return routeSequenceGraphEdges(nodes, edges, edgePatches, measuredEdgeLabels);
    }
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const candidates = edges.flatMap((edge, index) => {
        if (edge.stroke === 'invisible')
            return [];
        const source = nodesById.get(edge.sourceId);
        const target = nodesById.get(edge.targetId);
        if (!source || !target)
            return [];
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
    const pairLanes = assignDiagramEdgeLanes(candidates.map(({ edge }) => ({
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
        addPort(candidate, candidate.source, candidate.target, candidate.sourceSide, 'source');
        addPort(candidate, candidate.target, candidate.source, candidate.targetSide, 'target');
    });
    // A Board anchor is a shared pin. Parallel edges intentionally leave from the
    // exact same point instead of gaining per-edge padding along the node boundary.
    portGroups.forEach((ports) => {
        ports.forEach((port) => {
            if (port.role === 'source')
                port.candidate.sourceOffset = 0;
            else
                port.candidate.targetOffset = 0;
        });
    });
    const routed = candidates.map((candidate) => ({
        edge: candidate.edge,
        route: applyEdgeRoutePatch(routeEdge(candidate.source, candidate.target, candidate.sourceSide, candidate.targetSide, candidate.sourceOffset, candidate.targetOffset, candidate.source.id === candidate.target.id
            ? candidate.index
            : (pairLanes.get(candidate.edge.id) ?? 0), candidate.edge.arrow, nodes), edgePatches.get(candidate.edge.id), candidate.edge.arrow),
    }));
    const labelPlacements = placeDiagramEdgeLabels(routed.map(({ edge, route }) => ({
        align: edge.labelAlign,
        arrow: edge.arrow,
        bare: edge.bareLabel,
        id: edge.id,
        label: edge.label,
        lockedPosition: edgePatches.get(edge.id)?.label,
        metrics: measuredEdgeLabel(edge, measuredEdgeLabels),
        points: route.points,
    })), nodes);
    return routed.map(({ edge, route }) => {
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
    const obstacleRoute = findObstacleAvoidingRoute(sourceStub, targetStub, obstacles, sourceSide, targetSide, 14 + (Math.abs(laneIndex) % 3) * 3);
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
function applyEdgeRoutePatch(automatic, patch, arrow) {
    if (!patch)
        return automatic;
    if (patch.points.length < 2 || automatic.points.length < 2) {
        return patch.label ? { ...automatic, label: patch.label } : automatic;
    }
    const start = automatic.points[0];
    const end = automatic.points.at(-1);
    if (!start || !end)
        return patch.label ? { ...automatic, label: patch.label } : automatic;
    const points = normalizeOrthogonalPoints([start, ...patch.points.slice(1, -1), end]);
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
function measureNode(label, shape, classes = [], authoredWidth) {
    const detailLabel = hasBoardClass(classes, 'deBoardDetail');
    const gate = resolveNodeBadge(classes);
    const wideCard = hasBoardClass(classes, 'deBoardWide');
    const horizontalPadding = detailLabel ? 46 : 38;
    const maximumTextWidth = Math.max(36, Math.min(202, (authoredWidth ?? 240) - horizontalPadding));
    const lines = wrapDiagramText(label, maximumTextWidth);
    const contentWidth = Math.max(...lines.map((line, index) => measureTextWidth(line) * (detailLabel && index > 0 ? 0.86 : 1)), 36);
    const minimumWidth = gate ? 204 : wideCard ? 200 : detailLabel ? 150 : shape === 'stadium' ? 92 : 118;
    const baseWidth = Math.max(minimumWidth, Math.min(240, contentWidth + (detailLabel ? 46 : 38)));
    const baseHeight = gate ? 140 : Math.max(detailLabel ? 82 : 54, lines.length * 20 + (detailLabel ? 34 : 24));
    if (shape === 'circle' || shape === 'diamond') {
        if (shape === 'diamond' && gate)
            return { height: baseHeight, textLines: lines, width: baseWidth };
        const diameter = Math.max(baseWidth, baseHeight + 22);
        return { height: diameter, textLines: lines, width: diameter };
    }
    return { height: baseHeight, textLines: lines, width: baseWidth };
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
function hasBoardClass(classes, className) {
    return classes.some((value) => value.toLowerCase() === className.toLowerCase());
}
function resolveNodeBadge(classes) {
    if (hasBoardClass(classes, 'deBoardGateOne'))
        return '门槛 01';
    if (hasBoardClass(classes, 'deBoardGateTwo'))
        return '门槛 02';
    return null;
}
function measureBadgeWidth(value) {
    const textWidth = [...value].reduce((width, character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        if (character === ' ')
            return width + 3.8;
        return width + (codePoint > 0xff ? 11 : /[A-Z0-9]/.test(character) ? 6.5 : 5.8);
    }, 0);
    return Math.max(68, Math.ceil(textWidth + 24));
}
function isFeedbackEdge(edge) {
    return edge.stroke === 'dotted' && /复测|反馈|回流|迭代/.test(edge.label);
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