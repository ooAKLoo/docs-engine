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
const boardDirectionLabels = {
    BT: '从下到上',
    LR: '从左到右',
    RL: '从右到左',
    TB: '从上到下',
};
const boardDiagramKindLabels = {
    class: '类与接口',
    er: '实体关系',
    flowchart: '流程或组件关系',
    gantt: '甘特计划',
    git: '版本分支',
    mindmap: '思维导图',
    pie: '占比',
    sequence: '时序',
    state: '状态机',
    timeline: '时间线',
};
function decodeBoardLabel(value) {
    return value
        .replace(/<br\s*\/?>/giu, ' / ')
        .replace(/<[^>]+>/gu, '')
        .replace(/&amp;/gu, '&')
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>')
        .replace(/&quot;/gu, '"')
        .replace(/&#(?:39|x27);/giu, "'")
        .replace(/\s+/gu, ' ')
        .trim();
}
function boardEdgeConnector(edge) {
    if (edge.sourceArrow && edge.arrow)
        return '↔';
    if (edge.sourceArrow)
        return '←';
    if (edge.arrow)
        return '→';
    return '—';
}
/**
 * Export every semantic Board object as readable Markdown. Geometry, colours
 * and interaction state are intentionally omitted: copied documents preserve
 * groups, nodes and relationships rather than renderer implementation details.
 */
export function serializeBoardDocument(document, options = {}) {
    const title = decodeBoardLabel(options.title ?? '图表') || '图表';
    const headingLevel = options.headingLevel ?? 3;
    const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
    const groupsById = new Map((document.groups ?? []).map((group) => [group.id, group]));
    const lines = [
        `${'#'.repeat(headingLevel)} ${title}`,
        '',
        `类型：${document.diagramKind ? boardDiagramKindLabels[document.diagramKind] : '关系图'}；阅读方向：${boardDirectionLabels[document.direction]}。`,
    ];
    if (document.groups?.length) {
        lines.push('', '分组：');
        document.groups.forEach((group) => {
            const parent = group.parentId ? groupsById.get(group.parentId) : undefined;
            const members = group.nodeIds
                .map((nodeId) => nodesById.get(nodeId))
                .filter((node) => Boolean(node))
                .map((node) => decodeBoardLabel(node.label) || node.id);
            const parentCopy = parent ? `；上级分组：${decodeBoardLabel(parent.label) || parent.id}` : '';
            lines.push(`- ${decodeBoardLabel(group.label) || group.id}（\`${group.id}\`）：${members.join('、') || '无节点'}${parentCopy}`);
        });
    }
    lines.push('', '节点：');
    document.nodes.forEach((node) => {
        lines.push(`- ${decodeBoardLabel(node.label) || node.id}（\`${node.id}\`）`);
    });
    const visibleEdges = document.edges.filter((edge) => edge.stroke !== 'invisible');
    if (visibleEdges.length) {
        lines.push('', '关系：');
        visibleEdges.forEach((edge) => {
            const source = nodesById.get(edge.sourceId);
            const target = nodesById.get(edge.targetId);
            const sourceCopy = decodeBoardLabel(source?.label ?? '') || edge.sourceId;
            const targetCopy = decodeBoardLabel(target?.label ?? '') || edge.targetId;
            const relation = decodeBoardLabel(edge.label);
            const qualifiers = [
                edge.stroke === 'dotted' ? '虚线' : '',
                edge.stroke === 'thick' ? '强调线' : '',
                edge.role === 'feedback' ? '反馈关系' : '',
            ].filter(Boolean);
            lines.push(`- ${sourceCopy}（\`${edge.sourceId}\`） ${boardEdgeConnector(edge)} ${targetCopy}（\`${edge.targetId}\`）${relation ? `：${relation}` : ''}${qualifiers.length ? `（${qualifiers.join('、')}）` : ''}`);
        });
    }
    return `${lines.join('\n').trim()}\n`;
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