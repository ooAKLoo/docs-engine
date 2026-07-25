const EPSILON = 0.01;
/** Merge exact authored geometry into a canonical BoardDocument. */
export function applyBoardLayout(document, layout) {
    if (!layout)
        return document;
    const edgeLayouts = matchImportEdgeLayouts(document.edges, layout.edges ?? []);
    return {
        ...document,
        canvas: { height: layout.height, width: layout.width },
        edges: document.edges.map((edge) => {
            const authored = edgeLayouts.get(edge.id);
            if (!authored)
                return edge;
            return {
                ...edge,
                bareLabel: authored.bareLabel ?? edge.bareLabel,
                label: authored.label ?? edge.label,
                labelAlign: authored.labelAlign ?? edge.labelAlign,
                labelPosition: authored.labelPosition,
                points: authored.points,
                sourceSide: authored.sourceSide ?? edge.sourceSide,
                targetSide: authored.targetSide ?? edge.targetSide,
            };
        }),
        nodes: document.nodes.map((node) => {
            const authored = layout.nodes[node.id];
            return authored ? { ...node, ...authored } : node;
        }),
    };
}
/**
 * Validate geometry produced by an Agent or designer before it is persisted.
 *
 * Automatic edges may omit points by default. Set requireEdgeRoutes when an
 * authored board must own every route instead of allowing BoardCanvas to fill
 * missing geometry.
 */
export function validateBoardLayout(document, options = {}) {
    const diagnostics = [];
    const edgeNodeClearance = Math.max(0, options.edgeNodeClearance ?? 8);
    const minimumNodeGap = Math.max(0, options.minimumNodeGap ?? 24);
    const requireEdgeRoutes = options.requireEdgeRoutes ?? false;
    const requireNodeGeometry = options.requireNodeGeometry ?? true;
    const canvas = document.canvas;
    if (canvas &&
        (!isPositiveFinite(canvas.width) || !isPositiveFinite(canvas.height))) {
        diagnostics.push({
            code: 'canvas-invalid',
            message: '画布宽高必须是大于 0 的有限数值。',
            severity: 'error',
        });
    }
    reportDuplicateIds(document.nodes.map(({ id }) => id), 'node', diagnostics);
    reportDuplicateIds(document.edges.map(({ id }) => id), 'edge', diagnostics);
    const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
    const nodeRectangles = new Map();
    document.nodes.forEach((node) => {
        const rectangle = nodeRectangle(node);
        if (!rectangle) {
            if (requireNodeGeometry) {
                diagnostics.push({
                    code: 'node-geometry-missing',
                    message: `节点“${node.id}”必须提供有限 position 以及大于 0 的 width、height。`,
                    nodeIds: [node.id],
                    severity: 'error',
                });
            }
            return;
        }
        nodeRectangles.set(node.id, rectangle);
        if (canvas && !rectangleInsideCanvas(rectangle, canvas.width, canvas.height)) {
            diagnostics.push({
                code: 'node-outside-canvas',
                message: `节点“${node.id}”超出 authored canvas 边界。`,
                nodeIds: [node.id],
                severity: 'error',
            });
        }
    });
    const positionedNodes = document.nodes.filter((node) => nodeRectangles.has(node.id));
    positionedNodes.forEach((first, firstIndex) => {
        const firstRectangle = nodeRectangles.get(first.id);
        if (!firstRectangle)
            return;
        positionedNodes.slice(firstIndex + 1).forEach((second) => {
            const secondRectangle = nodeRectangles.get(second.id);
            if (!secondRectangle)
                return;
            if (rectanglesOverlap(firstRectangle, secondRectangle)) {
                diagnostics.push({
                    code: 'node-overlap',
                    message: `节点“${first.id}”与“${second.id}”发生重叠。`,
                    nodeIds: [first.id, second.id],
                    severity: 'error',
                });
                return;
            }
            if (minimumNodeGap > 0 &&
                rectanglesOverlap(expandRectangle(firstRectangle, minimumNodeGap / 2), expandRectangle(secondRectangle, minimumNodeGap / 2))) {
                diagnostics.push({
                    code: 'node-gap',
                    message: `节点“${first.id}”与“${second.id}”的间距小于 ${minimumNodeGap}px。`,
                    nodeIds: [first.id, second.id],
                    severity: 'warning',
                });
            }
        });
    });
    const routedSegments = [];
    document.edges.forEach((edge) => {
        const source = nodeById.get(edge.sourceId);
        const target = nodeById.get(edge.targetId);
        if (!source || !target) {
            diagnostics.push({
                code: 'edge-reference-missing',
                edgeIds: [edge.id],
                message: `连线“${edge.id}”引用了不存在的起点或终点。`,
                nodeIds: [edge.sourceId, edge.targetId],
                severity: 'error',
            });
            return;
        }
        if (edge.stroke === 'invisible')
            return;
        if (!edge.points?.length) {
            if (requireEdgeRoutes) {
                diagnostics.push({
                    code: 'edge-route-missing',
                    edgeIds: [edge.id],
                    message: `连线“${edge.id}”缺少 authored route points。`,
                    severity: 'error',
                });
            }
            return;
        }
        if (edge.points.length < 2 || edge.points.some((point) => !isFinitePoint(point))) {
            diagnostics.push({
                code: 'edge-route-invalid',
                edgeIds: [edge.id],
                message: `连线“${edge.id}”必须包含至少两个有限坐标点。`,
                severity: 'error',
            });
            return;
        }
        if (canvas &&
            edge.points.some(({ x, y }) => x < 0 || y < 0 || x > canvas.width || y > canvas.height)) {
            diagnostics.push({
                code: 'edge-outside-canvas',
                edgeIds: [edge.id],
                message: `连线“${edge.id}”超出 authored canvas 边界。`,
                severity: 'error',
            });
        }
        let nonOrthogonal = false;
        edge.points.slice(0, -1).forEach((start, index) => {
            const end = edge.points?.[index + 1];
            if (!end || pointsEqual(start, end))
                return;
            const horizontal = nearlyEqual(start.y, end.y);
            const vertical = nearlyEqual(start.x, end.x);
            if (!horizontal && !vertical)
                nonOrthogonal = true;
            const segment = { edge, end, index, start };
            routedSegments.push(segment);
            document.nodes.forEach((node) => {
                if (node.id === edge.sourceId || node.id === edge.targetId)
                    return;
                const rectangle = nodeRectangles.get(node.id);
                if (rectangle &&
                    segmentIntersectsRectangle(start, end, expandRectangle(rectangle, edgeNodeClearance))) {
                    diagnostics.push({
                        code: 'edge-node-collision',
                        edgeIds: [edge.id],
                        message: `连线“${edge.id}”穿过节点“${node.id}”的安全边界。`,
                        nodeIds: [node.id],
                        severity: 'error',
                    });
                }
            });
        });
        if (nonOrthogonal) {
            diagnostics.push({
                code: 'edge-non-orthogonal',
                edgeIds: [edge.id],
                message: `连线“${edge.id}”包含非正交线段。`,
                severity: 'error',
            });
        }
        if (edge.labelPosition) {
            document.nodes.forEach((node) => {
                if (node.id === edge.sourceId || node.id === edge.targetId)
                    return;
                const rectangle = nodeRectangles.get(node.id);
                if (rectangle && pointInsideRectangle(edge.labelPosition, rectangle)) {
                    diagnostics.push({
                        code: 'label-node-collision',
                        edgeIds: [edge.id],
                        message: `连线“${edge.id}”的标签锚点落在节点“${node.id}”内部。`,
                        nodeIds: [node.id],
                        severity: 'error',
                    });
                }
            });
        }
    });
    const reportedEdgePairs = new Set();
    routedSegments.forEach((first, firstIndex) => {
        routedSegments.slice(firstIndex + 1).forEach((second) => {
            if (first.edge.id === second.edge.id)
                return;
            const intersection = classifySegmentIntersection(first, second);
            if (!intersection)
                return;
            const pairKey = [first.edge.id, second.edge.id].sort().join('\u0000');
            const diagnosticKey = `${intersection}:${pairKey}`;
            if (reportedEdgePairs.has(diagnosticKey))
                return;
            reportedEdgePairs.add(diagnosticKey);
            diagnostics.push({
                code: intersection === 'overlap' ? 'edge-overlap' : 'edge-crossing',
                edgeIds: [first.edge.id, second.edge.id],
                message: intersection === 'overlap'
                    ? `连线“${first.edge.id}”与“${second.edge.id}”共享了可见线段。`
                    : `连线“${first.edge.id}”与“${second.edge.id}”发生交叉。`,
                severity: 'error',
            });
        });
    });
    return deduplicateDiagnostics(diagnostics);
}
/** Throw when an authored layout contains any error-level diagnostic. */
export function assertBoardLayout(document, options = {}) {
    const errors = validateBoardLayout(document, options).filter(({ severity }) => severity === 'error');
    if (errors.length === 0)
        return document;
    throw new Error(`Board authored layout 校验失败：\n${errors
        .map(({ code, message }) => `- [${code}] ${message}`)
        .join('\n')}`);
}
function matchImportEdgeLayouts(edges, layouts) {
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
function reportDuplicateIds(ids, kind, diagnostics) {
    const seen = new Set();
    const reported = new Set();
    ids.forEach((id) => {
        if (!seen.has(id)) {
            seen.add(id);
            return;
        }
        if (reported.has(id))
            return;
        reported.add(id);
        diagnostics.push({
            code: kind === 'node' ? 'duplicate-node-id' : 'duplicate-edge-id',
            ...(kind === 'node' ? { nodeIds: [id] } : { edgeIds: [id] }),
            message: `${kind === 'node' ? '节点' : '连线'} ID“${id}”重复。`,
            severity: 'error',
        });
    });
}
function nodeRectangle(node) {
    if (!node.position ||
        !isFinitePoint(node.position) ||
        !isPositiveFinite(node.width) ||
        !isPositiveFinite(node.height)) {
        return undefined;
    }
    return {
        bottom: node.position.y + node.height / 2,
        left: node.position.x - node.width / 2,
        right: node.position.x + node.width / 2,
        top: node.position.y - node.height / 2,
    };
}
function rectangleInsideCanvas(rectangle, width, height) {
    return (rectangle.left >= -EPSILON &&
        rectangle.top >= -EPSILON &&
        rectangle.right <= width + EPSILON &&
        rectangle.bottom <= height + EPSILON);
}
function expandRectangle(rectangle, amount) {
    return {
        bottom: rectangle.bottom + amount,
        left: rectangle.left - amount,
        right: rectangle.right + amount,
        top: rectangle.top - amount,
    };
}
function rectanglesOverlap(first, second) {
    return (first.left < second.right - EPSILON &&
        first.right > second.left + EPSILON &&
        first.top < second.bottom - EPSILON &&
        first.bottom > second.top + EPSILON);
}
function pointInsideRectangle(point, rectangle) {
    return (point.x >= rectangle.left - EPSILON &&
        point.x <= rectangle.right + EPSILON &&
        point.y >= rectangle.top - EPSILON &&
        point.y <= rectangle.bottom + EPSILON);
}
function segmentIntersectsRectangle(start, end, rectangle) {
    if (pointInsideRectangle(start, rectangle) || pointInsideRectangle(end, rectangle)) {
        return true;
    }
    const corners = [
        { x: rectangle.left, y: rectangle.top },
        { x: rectangle.right, y: rectangle.top },
        { x: rectangle.right, y: rectangle.bottom },
        { x: rectangle.left, y: rectangle.bottom },
    ];
    return corners.some((corner, index) => segmentsIntersect(start, end, corner, corners[(index + 1) % corners.length]));
}
function classifySegmentIntersection(first, second) {
    const firstHorizontal = nearlyEqual(first.start.y, first.end.y);
    const firstVertical = nearlyEqual(first.start.x, first.end.x);
    const secondHorizontal = nearlyEqual(second.start.y, second.end.y);
    const secondVertical = nearlyEqual(second.start.x, second.end.x);
    if (firstHorizontal && secondHorizontal && nearlyEqual(first.start.y, second.start.y)) {
        const overlap = rangeOverlap(first.start.x, first.end.x, second.start.x, second.end.x);
        return overlap > EPSILON ? 'overlap' : undefined;
    }
    if (firstVertical && secondVertical && nearlyEqual(first.start.x, second.start.x)) {
        const overlap = rangeOverlap(first.start.y, first.end.y, second.start.y, second.end.y);
        return overlap > EPSILON ? 'overlap' : undefined;
    }
    if ((firstHorizontal && secondVertical) ||
        (firstVertical && secondHorizontal)) {
        const horizontal = firstHorizontal ? first : second;
        const vertical = firstVertical ? first : second;
        const point = { x: vertical.start.x, y: horizontal.start.y };
        if (valueWithin(point.x, horizontal.start.x, horizontal.end.x) &&
            valueWithin(point.y, vertical.start.y, vertical.end.y)) {
            if (isSharedTerminalTouch(first, second, point))
                return undefined;
            return 'crossing';
        }
        return undefined;
    }
    if (segmentsIntersect(first.start, first.end, second.start, second.end)) {
        const sharedPoints = [first.start, first.end].filter((point) => pointsEqual(point, second.start) || pointsEqual(point, second.end));
        if (sharedPoints.length > 0 &&
            sharedPoints.every((point) => isSharedTerminalTouch(first, second, point))) {
            return undefined;
        }
        return 'crossing';
    }
    return undefined;
}
function isSharedTerminalTouch(first, second, point) {
    const firstTerminal = (first.index === 0 && pointsEqual(point, first.start)) ||
        (first.index === (first.edge.points?.length ?? 1) - 2 &&
            pointsEqual(point, first.end));
    const secondTerminal = (second.index === 0 && pointsEqual(point, second.start)) ||
        (second.index === (second.edge.points?.length ?? 1) - 2 &&
            pointsEqual(point, second.end));
    if (!firstTerminal || !secondTerminal)
        return false;
    return (first.edge.sourceId === second.edge.sourceId ||
        first.edge.sourceId === second.edge.targetId ||
        first.edge.targetId === second.edge.sourceId ||
        first.edge.targetId === second.edge.targetId);
}
function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
    const firstOrientation = orientation(firstStart, firstEnd, secondStart);
    const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
    const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
    const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);
    if (firstOrientation !== secondOrientation &&
        thirdOrientation !== fourthOrientation) {
        return true;
    }
    return ((firstOrientation === 0 && pointOnSegment(secondStart, firstStart, firstEnd)) ||
        (secondOrientation === 0 && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
        (thirdOrientation === 0 && pointOnSegment(firstStart, secondStart, secondEnd)) ||
        (fourthOrientation === 0 && pointOnSegment(firstEnd, secondStart, secondEnd)));
}
function orientation(first, second, third) {
    const cross = (second.y - first.y) * (third.x - second.x) -
        (second.x - first.x) * (third.y - second.y);
    if (Math.abs(cross) <= EPSILON)
        return 0;
    return cross > 0 ? 1 : 2;
}
function pointOnSegment(point, start, end) {
    return (valueWithin(point.x, start.x, end.x) &&
        valueWithin(point.y, start.y, end.y));
}
function rangeOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return (Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd)) -
        Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd)));
}
function valueWithin(value, first, second) {
    return (value >= Math.min(first, second) - EPSILON &&
        value <= Math.max(first, second) + EPSILON);
}
function isPositiveFinite(value) {
    return value !== undefined && Number.isFinite(value) && value > 0;
}
function isFinitePoint(point) {
    return Number.isFinite(point.x) && Number.isFinite(point.y);
}
function nearlyEqual(first, second) {
    return Math.abs(first - second) <= EPSILON;
}
function pointsEqual(first, second) {
    return nearlyEqual(first.x, second.x) && nearlyEqual(first.y, second.y);
}
function deduplicateDiagnostics(diagnostics) {
    const seen = new Set();
    return diagnostics.filter((diagnostic) => {
        const key = [
            diagnostic.code,
            ...(diagnostic.nodeIds ?? []),
            ...(diagnostic.edgeIds ?? []),
        ].join('\u0000');
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=BoardLayout.js.map