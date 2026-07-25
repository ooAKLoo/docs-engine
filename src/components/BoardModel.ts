export type BoardDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type BoardAnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type BoardNodeShape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond';
export type BoardNodeTone = 'blue' | 'purple' | 'teal' | 'green' | 'orange' | 'neutral';
export type BoardEdgeRole = 'flow' | 'feedback';

export type BoardDiagramKind =
  | 'flowchart'
  | 'sequence'
  | 'state'
  | 'class'
  | 'er'
  | 'gantt'
  | 'git'
  | 'timeline'
  | 'mindmap'
  | 'pie';

export type BoardPoint = {
  x: number;
  y: number;
};

export type BoardNode = {
  classes: string[];
  height?: number;
  id: string;
  label: string;
  placeholder?: boolean;
  position?: BoardPoint;
  shape: BoardNodeShape;
  tone: BoardNodeTone;
  width?: number;
};

/** A semantic container such as a module boundary, responsibility area or deployment zone. */
export type BoardGroup = {
  id: string;
  label: string;
  nodeIds: string[];
  parentId?: string;
  tone?: BoardNodeTone;
};

export type BoardEdge = {
  arrow: boolean;
  bareLabel?: boolean;
  id: string;
  label: string;
  labelAlign?: 'start' | 'middle' | 'end';
  labelPosition?: BoardPoint;
  /** User-created relationship; excluded from automatic rank calculation. */
  manual?: boolean;
  points?: BoardPoint[];
  /** Routing semantics. Feedback edges close a cycle and use an outer lane. */
  role?: BoardEdgeRole;
  /** Render an arrowhead at the source endpoint, for Mermaid bidirectional edges. */
  sourceArrow?: boolean;
  sourceId: string;
  sourceSide?: BoardAnchorSide;
  stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
  targetId: string;
  targetSide?: BoardAnchorSide;
};

export type BoardCanvasSize = {
  height: number;
  width: number;
};

/**
 * The only persisted diagram model understood by the renderer and editor.
 * Import formats such as Mermaid are discarded after they are converted into this document.
 */
export type BoardDocument = {
  canvas?: BoardCanvasSize;
  diagramKind?: BoardDiagramKind;
  direction: BoardDirection;
  edges: BoardEdge[];
  groups?: BoardGroup[];
  nodes: BoardNode[];
  version: 1;
};

export type BoardImportNodeLayout = {
  height?: number;
  position: BoardPoint;
  width?: number;
};

export type BoardImportEdgeLayout = {
  bareLabel?: boolean;
  id?: string;
  label?: string;
  labelAlign?: 'start' | 'middle' | 'end';
  labelPosition?: BoardPoint;
  points?: BoardPoint[];
  sourceId: string;
  sourceSide?: BoardAnchorSide;
  targetId: string;
  targetSide?: BoardAnchorSide;
};

/** Exact geometry optionally applied while importing authored source into a BoardDocument. */
export type BoardImportLayout = BoardCanvasSize & {
  edges?: BoardImportEdgeLayout[];
  nodes: Record<string, BoardImportNodeLayout>;
};

export type BoardImportSource = {
  format: 'mermaid';
  layout?: BoardImportLayout;
  source: string;
};

export type BoardDocumentChangeReason =
  | 'import'
  | 'node-label'
  | 'node-position'
  | 'create-edge'
  | 'create-node-and-edge'
  | 'edge-route';

export type BoardDocumentChange = {
  document: BoardDocument;
  edgeId?: string;
  nodeId?: string;
  operation?: BoardOperation;
  reason: BoardDocumentChangeReason;
};

export type BoardOperation =
  | {label: string; nodeId: string; type: 'update-node-label'}
  | {nodeId: string; position: BoardPoint; type: 'update-node-position'}
  | {edge: BoardEdge; type: 'create-edge'}
  | {edge: BoardEdge; node: BoardNode; type: 'create-node-and-edge'}
  | {edgeId: string; labelPosition?: BoardPoint; points: BoardPoint[]; type: 'update-edge-route'};

export type BoardMarkdownOptions = {
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  title?: string;
};

type FeedbackDetectableEdge = Pick<
  BoardEdge,
  'id' | 'manual' | 'role' | 'sourceId' | 'stroke' | 'targetId'
>;

/**
 * Detect cycle-closing edges in source order. Explicit roles win; inferred
 * feedback edges are excluded from the main adjacency so one return path does
 * not cause every later forward edge to be classified as feedback.
 */
export function detectBoardFeedbackEdgeIds(edges: readonly FeedbackDetectableEdge[]) {
  const adjacency = new Map<string, Set<string>>();
  const feedback = new Set<string>();

  const reaches = (from: string, target: string) => {
    const stack = [from];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (current === target) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      adjacency.get(current)?.forEach((next) => stack.push(next));
    }
    return false;
  };

  edges.forEach((edge) => {
    if (edge.stroke === 'invisible') return;
    if (edge.role === 'feedback') {
      feedback.add(edge.id);
      return;
    }
    if (edge.manual) return;
    if (edge.role !== 'flow' && reaches(edge.targetId, edge.sourceId)) {
      feedback.add(edge.id);
      return;
    }
    const targets = adjacency.get(edge.sourceId) ?? new Set<string>();
    targets.add(edge.targetId);
    adjacency.set(edge.sourceId, targets);
  });

  return feedback;
}

const boardDirectionLabels: Record<BoardDirection, string> = {
  BT: '从下到上',
  LR: '从左到右',
  RL: '从右到左',
  TB: '从上到下',
};

const boardDiagramKindLabels: Record<BoardDiagramKind, string> = {
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

function decodeBoardLabel(value: string) {
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

function boardEdgeConnector(edge: BoardEdge) {
  if (edge.sourceArrow && edge.arrow) return '↔';
  if (edge.sourceArrow) return '←';
  if (edge.arrow) return '→';
  return '—';
}

/**
 * Export every semantic Board object as readable Markdown. Geometry, colours
 * and interaction state are intentionally omitted: copied documents preserve
 * groups, nodes and relationships rather than renderer implementation details.
 */
export function serializeBoardDocument(
  document: BoardDocument,
  options: BoardMarkdownOptions = {},
) {
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
        .filter((node): node is BoardNode => Boolean(node))
        .map((node) => decodeBoardLabel(node.label) || node.id);
      const parentCopy = parent ? `；上级分组：${decodeBoardLabel(parent.label) || parent.id}` : '';
      lines.push(
        `- ${decodeBoardLabel(group.label) || group.id}（\`${group.id}\`）：${members.join('、') || '无节点'}${parentCopy}`,
      );
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
      lines.push(
        `- ${sourceCopy}（\`${edge.sourceId}\`） ${boardEdgeConnector(edge)} ${targetCopy}（\`${edge.targetId}\`）${relation ? `：${relation}` : ''}${qualifiers.length ? `（${qualifiers.join('、')}）` : ''}`,
      );
    });
  }

  return `${lines.join('\n').trim()}\n`;
}

/** Pure reducer used by every Board editing surface and suitable for host-side persistence. */
export function applyBoardOperation(
  document: BoardDocument,
  operation: BoardOperation,
): BoardDocument {
  if (operation.type === 'update-node-label') {
    return {
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === operation.nodeId
          ? {...node, label: operation.label, placeholder: false}
          : node,
      ),
    };
  }
  if (operation.type === 'update-node-position') {
    return {
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === operation.nodeId ? {...node, position: operation.position} : node,
      ),
    };
  }
  if (operation.type === 'create-edge') {
    return {...document, edges: [...document.edges, operation.edge]};
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
    edges: document.edges.map((edge) =>
      edge.id === operation.edgeId
        ? {
            ...edge,
            labelPosition: operation.labelPosition,
            points: operation.points,
          }
        : edge,
    ),
  };
}
