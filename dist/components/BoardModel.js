/**
 * Detect cycle-closing edges in source order. Explicit roles win; inferred
 * feedback edges are excluded from the main adjacency so one return path does
 * not cause every later forward edge to be classified as feedback.
 */
export function detectBoardFeedbackEdgeIds(edges) {
    const adjacency = new Map();
    const feedback = new Set();
    const reaches = (from, target) => {
        const stack = [from];
        const visited = new Set();
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current)
                continue;
            if (current === target)
                return true;
            if (visited.has(current))
                continue;
            visited.add(current);
            adjacency.get(current)?.forEach((next) => stack.push(next));
        }
        return false;
    };
    edges.forEach((edge) => {
        if (edge.stroke === 'invisible')
            return;
        if (edge.role === 'feedback') {
            feedback.add(edge.id);
            return;
        }
        if (edge.manual)
            return;
        if (edge.role !== 'flow' && reaches(edge.targetId, edge.sourceId)) {
            feedback.add(edge.id);
            return;
        }
        const targets = adjacency.get(edge.sourceId) ?? new Set();
        targets.add(edge.targetId);
        adjacency.set(edge.sourceId, targets);
    });
    return feedback;
}
/** Pure reducer used by every Board editing surface and suitable for host-side persistence. */
export function applyBoardOperation(document, operation) {
    if (operation.type === 'update-node-label') {
        return {
            ...document,
            nodes: document.nodes.map((node) => node.id === operation.nodeId
                ? { ...node, label: operation.label, placeholder: false }
                : node),
        };
    }
    if (operation.type === 'update-node-position') {
        return {
            ...document,
            nodes: document.nodes.map((node) => node.id === operation.nodeId ? { ...node, position: operation.position } : node),
        };
    }
    if (operation.type === 'create-edge') {
        return { ...document, edges: [...document.edges, operation.edge] };
    }
    if (operation.type === 'create-node-and-edge') {
        return {
            ...document,
            edges: [...document.edges, operation.edge],
            nodes: [...document.nodes, operation.node],
        };
    }
    return {
        ...document,
        edges: document.edges.map((edge) => edge.id === operation.edgeId
            ? {
                ...edge,
                labelPosition: operation.labelPosition,
                points: operation.points,
            }
            : edge),
    };
}
//# sourceMappingURL=BoardModel.js.map