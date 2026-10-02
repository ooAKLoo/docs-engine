import { measureDiagramEdgeLabel } from './BoardAutoLayout.js';
import { measureNode } from './BoardNodeMetrics.js';
import { refineBoardRoutes } from './BoardRouteRefine.js';
const GROUP_ID_PREFIX = '__de-group__:';
/**
 * Drawn group chrome in BoardCanvas extends 44px above, 24px beside and 22px
 * below the member bounds. The ELK padding must contain that chrome so a
 * container never paints over its neighbours or its own members.
 */
const GROUP_PADDING = '[top=56.0,left=32.0,bottom=30.0,right=32.0]';
const ROOT_PADDING = '[top=42.0,left=42.0,bottom=42.0,right=42.0]';
const EDGE_LABEL_MARGIN = 12;
const elkDirections = {
    BT: 'UP',
    LR: 'RIGHT',
    RL: 'LEFT',
    TB: 'DOWN',
};
let enginePromise;
async function loadElk() {
    enginePromise ??= import('elkjs/lib/elk.bundled.js')
        .then((module) => (module.default ?? module))
        .catch(() => undefined);
    return enginePromise;
}
/** Kinds whose relationships form a general graph and benefit from layered layout. */
export function supportsElkBoardLayout(kind) {
    return kind === 'flowchart' || kind === 'state' || kind === 'class' || kind === 'er';
}
function usesFlowRouting(document) {
    return document.diagramKind === 'flowchart' || document.diagramKind === 'state';
}
/**
 * Compute authored-quality geometry for an imported diagram with ELK layered:
 * container-aware layer assignment, crossing minimisation, orthogonal routing
 * with separated lanes and inline label reservations. Returns undefined when
 * the engine is unavailable or the result is incomplete, so callers can fall
 * back to the built-in automatic layout.
 * Set refineRoutes to false to inspect the raw ELK geometry and diagnostics.
 */
export async function computeElkBoardLayout(document, options = {}) {
    const Elk = await loadElk();
    if (!Elk)
        return undefined;
    const nodeSizes = new Map(document.nodes.map((node) => {
        const measured = measureNode(node.label, node.shape, node.classes);
        // Whole pixels keep the renderer's re-measure at `width - padding` from
        // drifting below the wrap threshold through float round-trips.
        return [node.id, { height: Math.ceil(measured.height), width: Math.ceil(measured.width) }];
    }));
    const graph = buildElkGraph(usesFlowRouting(document) ? canonicalLayoutOrder(document) : document, nodeSizes);
    if (!graph)
        return undefined;
    const result = await new Elk().layout(graph);
    const layout = convertElkResult(document, result, nodeSizes);
    return layout && options.refineRoutes !== false && usesFlowRouting(document)
        ? refineBoardRoutes(document, layout)
        : layout;
}
/**
 * ELK's model-order tie breakers must not depend on edge statement order.
 * Nodes follow the flow topologically; the author's node declaration order
 * only breaks the remaining ties, so renaming an ID never moves a node.
 */
function canonicalLayoutOrder(document) {
    const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    const declared = new Map(document.nodes.map(({ id }, index) => [id, index]));
    const remaining = new Set(document.nodes.map(({ id }) => id));
    const incoming = new Map(document.nodes.map(({ id }) => [id, new Set()]));
    const outgoing = new Map(document.nodes.map(({ id }) => [id, new Set()]));
    for (const edge of document.edges) {
        const source = edge.role === 'feedback' ? edge.targetId : edge.sourceId;
        const target = edge.role === 'feedback' ? edge.sourceId : edge.targetId;
        if (source !== target)
            incoming.get(target)?.add(source);
        if (source !== target)
            outgoing.get(source)?.add(target);
    }
    const order = new Map();
    while (remaining.size) {
        const ready = [...remaining].filter((id) => ![...(incoming.get(id) ?? [])].some((parent) => remaining.has(parent)));
        // Among nodes whose predecessors are placed, keep the author's order.
        const id = (ready.length ? ready : [...remaining]).sort((a, b) => declared.get(a) - declared.get(b))[0];
        order.set(id, order.size);
        remaining.delete(id);
    }
    return {
        ...document,
        nodes: [...document.nodes].sort((a, b) => order.get(a.id) - order.get(b.id)),
        edges: [...document.edges].sort((a, b) => order.get(a.sourceId) - order.get(b.sourceId)
            || order.get(a.targetId) - order.get(b.targetId)
            || compare(a.label, b.label)
            || compare(a.stroke, b.stroke)
            || compare(a.role ?? '', b.role ?? '')
            || Number(a.arrow) - Number(b.arrow)
            || Number(Boolean(a.sourceArrow)) - Number(Boolean(b.sourceArrow))),
        groups: document.groups?.map((group) => ({
            ...group,
            nodeIds: [...group.nodeIds].sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER)),
        })),
    };
}
function buildElkGraph(document, nodeSizes) {
    const groups = document.groups ?? [];
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const parentGroupByNode = new Map();
    groups.forEach((group) => {
        group.nodeIds.forEach((nodeId) => {
            if (!parentGroupByNode.has(nodeId))
                parentGroupByNode.set(nodeId, group.id);
        });
    });
    const elkGroups = new Map();
    groups.forEach((group) => {
        elkGroups.set(group.id, {
            children: [],
            edges: [],
            id: GROUP_ID_PREFIX + group.id,
            layoutOptions: { 'elk.padding': GROUP_PADDING },
        });
    });
    const root = {
        children: [],
        edges: [],
        id: '__de-root__',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': elkDirections[document.direction] ?? 'RIGHT',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
            'elk.json.edgeCoords': 'ROOT',
            'elk.json.shapeCoords': 'ROOT',
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            // A stable model order still needs enough crossing-minimisation sweeps.
            ...(usesFlowRouting(document) ? { 'elk.layered.thoroughness': '20' } : null),
            'elk.layered.spacing.edgeEdgeBetweenLayers': '14',
            'elk.layered.spacing.edgeNodeBetweenLayers': '26',
            'elk.layered.spacing.nodeNodeBetweenLayers': '92',
            'elk.layered.unnecessaryBendpoints': 'true',
            'elk.padding': ROOT_PADDING,
            'elk.spacing.edgeEdge': '14',
            'elk.spacing.edgeLabel': '6',
            'elk.spacing.edgeNode': '26',
            'elk.spacing.labelLabel': '8',
            'elk.spacing.labelNode': '18',
            'elk.spacing.nodeNode': '44',
        },
    };
    const containerOf = (groupId) => {
        if (!groupId)
            return root;
        return elkGroups.get(groupId) ?? root;
    };
    // Attach nested groups below their parents; broken parent references fall
    // back to the root container instead of dropping the group.
    groups.forEach((group) => {
        const parent = group.parentId && groupById.has(group.parentId)
            ? containerOf(group.parentId)
            : root;
        parent.children?.push(elkGroups.get(group.id));
    });
    document.nodes.forEach((node) => {
        const size = nodeSizes.get(node.id);
        containerOf(parentGroupByNode.get(node.id)).children?.push({
            height: size?.height,
            id: node.id,
            width: size?.width,
        });
    });
    // Every edge lives in the closest common ancestor of its endpoints so ELK
    // receives a well-formed compound graph.
    const ancestorsOf = (nodeId) => {
        const chain = [];
        let current = parentGroupByNode.get(nodeId);
        while (current) {
            chain.push(current);
            const parent = groupById.get(current)?.parentId;
            current = parent && groupById.has(parent) ? parent : undefined;
        }
        return chain;
    };
    document.edges.forEach((edge) => {
        if (!nodeSizes.has(edge.sourceId) || !nodeSizes.has(edge.targetId))
            return;
        const sourceAncestors = ancestorsOf(edge.sourceId);
        const targetAncestors = new Set(ancestorsOf(edge.targetId));
        const commonAncestor = sourceAncestors.find((groupId) => targetAncestors.has(groupId));
        const labelMetrics = edge.label
            ? measureDiagramEdgeLabel(edge.label, edge.bareLabel)
            : undefined;
        const reverse = usesFlowRouting(document) && edge.role === 'feedback';
        containerOf(commonAncestor).edges?.push({
            id: edge.id,
            ...(labelMetrics
                ? {
                    labels: [{
                            // Reserve a margin around the drawn pill so inline labels never
                            // touch node borders or neighbouring lanes; the drawn label is
                            // re-centred inside this padded box after layout.
                            height: labelMetrics.height + EDGE_LABEL_MARGIN * 2,
                            layoutOptions: { 'elk.edgeLabels.inline': 'true' },
                            text: edge.label,
                            width: labelMetrics.width + EDGE_LABEL_MARGIN * 2,
                        }],
                }
                : null),
            // Rank feedback in the forward direction instead of letting ELK's cycle
            // breaker choose an arbitrary edge of the main flow to reverse.
            sources: [reverse ? edge.targetId : edge.sourceId],
            targets: [reverse ? edge.sourceId : edge.targetId],
        });
    });
    return root;
}
function convertElkResult(document, result, nodeSizes) {
    const nodeLayouts = {};
    const nodeCenters = new Map();
    const visit = (elkNode) => {
        elkNode.children?.forEach((child) => {
            if (!child.id.startsWith(GROUP_ID_PREFIX) && nodeSizes.has(child.id)) {
                const size = nodeSizes.get(child.id);
                const width = child.width ?? size.width;
                const height = child.height ?? size.height;
                const center = { x: (child.x ?? 0) + width / 2, y: (child.y ?? 0) + height / 2 };
                nodeCenters.set(child.id, center);
                nodeLayouts[child.id] = { height, position: center, width };
            }
            visit(child);
        });
    };
    visit(result);
    if (document.nodes.some((node) => !nodeCenters.has(node.id)))
        return undefined;
    const elkEdges = new Map();
    const collectEdges = (elkNode) => {
        elkNode.edges?.forEach((edge) => elkEdges.set(edge.id, edge));
        elkNode.children?.forEach(collectEdges);
    };
    collectEdges(result);
    const edgeLayouts = [];
    for (const edge of document.edges) {
        const elkEdge = elkEdges.get(edge.id);
        const section = elkEdge?.sections?.[0];
        if (!elkEdge || !section) {
            // Invisible spacing edges may be dropped silently; visible edges must be
            // routed or the whole result is discarded in favour of the fallback.
            if (edge.stroke === 'invisible')
                continue;
            return undefined;
        }
        const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
            .map((point) => ({ x: point.x, y: point.y }));
        if (points.length < 2 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
            return undefined;
        }
        // Restore semantic direction before resolving the two endpoint sides.
        // This also swaps ELK's source/target sides without changing arrow flags.
        if (usesFlowRouting(document) && edge.role === 'feedback')
            points.reverse();
        const label = elkEdge.labels?.[0];
        const labelPosition = label && label.x !== undefined && label.y !== undefined
            ? {
                x: label.x + (label.width ?? 0) / 2,
                y: label.y + (label.height ?? 0) / 2,
            }
            : undefined;
        edgeLayouts.push({
            id: edge.id,
            ...(labelPosition ? { labelPosition } : null),
            points,
            sourceId: edge.sourceId,
            sourceSide: anchorSideOf(edge, points[0], nodeCenters.get(edge.sourceId), nodeSizes.get(edge.sourceId)),
            targetId: edge.targetId,
            targetSide: anchorSideOf(edge, points[points.length - 1], nodeCenters.get(edge.targetId), nodeSizes.get(edge.targetId)),
        });
    }
    const width = result.width ?? 0;
    const height = result.height ?? 0;
    if (width <= 0 || height <= 0)
        return undefined;
    return { edges: edgeLayouts, height, nodes: nodeLayouts, width };
}
function anchorSideOf(edge, point, center, size) {
    if (!point || !center || !size)
        return undefined;
    const relativeX = (point.x - center.x) / Math.max(1, size.width / 2);
    const relativeY = (point.y - center.y) / Math.max(1, size.height / 2);
    if (Math.abs(relativeX) >= Math.abs(relativeY)) {
        return relativeX >= 0 ? 'right' : 'left';
    }
    return relativeY >= 0 ? 'bottom' : 'top';
}
//# sourceMappingURL=BoardElkLayout.js.map