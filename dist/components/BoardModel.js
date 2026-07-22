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