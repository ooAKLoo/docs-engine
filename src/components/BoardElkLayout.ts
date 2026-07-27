import type {
  BoardAnchorSide,
  BoardDocument,
  BoardEdge,
  BoardImportEdgeLayout,
  BoardImportLayout,
  BoardPoint,
} from './BoardModel.js';
import {measureDiagramEdgeLabel} from './BoardAutoLayout.js';
import {measureNode} from './BoardNodeMetrics.js';

type ElkPoint = {x: number; y: number};

type ElkLabel = {
  height?: number;
  id?: string;
  layoutOptions?: Record<string, string>;
  text?: string;
  width?: number;
  x?: number;
  y?: number;
};

type ElkEdgeSection = {
  bendPoints?: ElkPoint[];
  endPoint: ElkPoint;
  startPoint: ElkPoint;
};

type ElkEdge = {
  id: string;
  labels?: ElkLabel[];
  layoutOptions?: Record<string, string>;
  sections?: ElkEdgeSection[];
  sources: string[];
  targets: string[];
};

type ElkNode = {
  children?: ElkNode[];
  edges?: ElkEdge[];
  height?: number;
  id: string;
  layoutOptions?: Record<string, string>;
  width?: number;
  x?: number;
  y?: number;
};

type ElkEngine = {
  layout(graph: ElkNode): Promise<ElkNode>;
};

type ElkConstructor = new () => ElkEngine;

const GROUP_ID_PREFIX = '__de-group__:';

/**
 * Drawn group chrome in BoardCanvas extends 44px above, 24px beside and 22px
 * below the member bounds. The ELK padding must contain that chrome so a
 * container never paints over its neighbours or its own members.
 */
const GROUP_PADDING = '[top=56.0,left=32.0,bottom=30.0,right=32.0]';
const ROOT_PADDING = '[top=42.0,left=42.0,bottom=42.0,right=42.0]';
const EDGE_LABEL_MARGIN = 12;

const elkDirections: Record<BoardDocument['direction'], string> = {
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
  TB: 'DOWN',
};

let enginePromise: Promise<ElkConstructor | undefined> | undefined;

async function loadElk(): Promise<ElkConstructor | undefined> {
  enginePromise ??= import('elkjs/lib/elk.bundled.js')
    .then((module) => (module.default ?? module) as unknown as ElkConstructor)
    .catch(() => undefined);
  return enginePromise;
}

/** Kinds whose relationships form a general graph and benefit from layered layout. */
export function supportsElkBoardLayout(kind: BoardDocument['diagramKind']) {
  return kind === 'flowchart' || kind === 'state' || kind === 'class' || kind === 'er';
}

/**
 * Compute authored-quality geometry for an imported diagram with ELK layered:
 * container-aware layer assignment, crossing minimisation, orthogonal routing
 * with separated lanes and inline label reservations. Returns undefined when
 * the engine is unavailable or the result is incomplete, so callers can fall
 * back to the built-in automatic layout.
 */
export async function computeElkBoardLayout(
  document: BoardDocument,
): Promise<BoardImportLayout | undefined> {
  const Elk = await loadElk();
  if (!Elk) return undefined;

  const nodeSizes = new Map(document.nodes.map((node) => {
    const measured = measureNode(node.label, node.shape, node.classes);
    // Whole pixels keep the renderer's re-measure at `width - padding` from
    // drifting below the wrap threshold through float round-trips.
    return [node.id, {height: Math.ceil(measured.height), width: Math.ceil(measured.width)}];
  }));

  const graph = buildElkGraph(document, nodeSizes);
  if (!graph) return undefined;

  const result = await new Elk().layout(graph);
  return convertElkResult(document, result, nodeSizes);
}

function buildElkGraph(
  document: BoardDocument,
  nodeSizes: Map<string, {height: number; width: number}>,
): ElkNode | undefined {
  const groups = document.groups ?? [];
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const parentGroupByNode = new Map<string, string>();
  groups.forEach((group) => {
    group.nodeIds.forEach((nodeId) => {
      if (!parentGroupByNode.has(nodeId)) parentGroupByNode.set(nodeId, group.id);
    });
  });

  const elkGroups = new Map<string, ElkNode>();
  groups.forEach((group) => {
    elkGroups.set(group.id, {
      children: [],
      edges: [],
      id: GROUP_ID_PREFIX + group.id,
      layoutOptions: {'elk.padding': GROUP_PADDING},
    });
  });

  const root: ElkNode = {
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

  const containerOf = (groupId: string | undefined): ElkNode => {
    if (!groupId) return root;
    return elkGroups.get(groupId) ?? root;
  };

  // Attach nested groups below their parents; broken parent references fall
  // back to the root container instead of dropping the group.
  groups.forEach((group) => {
    const parent = group.parentId && groupById.has(group.parentId)
      ? containerOf(group.parentId)
      : root;
    parent.children?.push(elkGroups.get(group.id)!);
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
  const ancestorsOf = (nodeId: string) => {
    const chain: string[] = [];
    let current = parentGroupByNode.get(nodeId);
    while (current) {
      chain.push(current);
      const parent = groupById.get(current)?.parentId;
      current = parent && groupById.has(parent) ? parent : undefined;
    }
    return chain;
  };

  document.edges.forEach((edge) => {
    if (!nodeSizes.has(edge.sourceId) || !nodeSizes.has(edge.targetId)) return;
    const sourceAncestors = ancestorsOf(edge.sourceId);
    const targetAncestors = new Set(ancestorsOf(edge.targetId));
    const commonAncestor = sourceAncestors.find((groupId) => targetAncestors.has(groupId));
    const labelMetrics = edge.label
      ? measureDiagramEdgeLabel(edge.label, edge.bareLabel)
      : undefined;
    containerOf(commonAncestor).edges?.push({
      id: edge.id,
      ...(labelMetrics
        ? {
            labels: [{
              // Reserve a margin around the drawn pill so inline labels never
              // touch node borders or neighbouring lanes; the drawn label is
              // re-centred inside this padded box after layout.
              height: labelMetrics.height + EDGE_LABEL_MARGIN * 2,
              layoutOptions: {'elk.edgeLabels.inline': 'true'},
              text: edge.label,
              width: labelMetrics.width + EDGE_LABEL_MARGIN * 2,
            }],
          }
        : null),
      sources: [edge.sourceId],
      targets: [edge.targetId],
    });
  });

  return root;
}

function convertElkResult(
  document: BoardDocument,
  result: ElkNode,
  nodeSizes: Map<string, {height: number; width: number}>,
): BoardImportLayout | undefined {
  const nodeLayouts: BoardImportLayout['nodes'] = {};
  const nodeCenters = new Map<string, BoardPoint>();

  const visit = (elkNode: ElkNode) => {
    elkNode.children?.forEach((child) => {
      if (!child.id.startsWith(GROUP_ID_PREFIX) && nodeSizes.has(child.id)) {
        const size = nodeSizes.get(child.id)!;
        const width = child.width ?? size.width;
        const height = child.height ?? size.height;
        const center = {x: (child.x ?? 0) + width / 2, y: (child.y ?? 0) + height / 2};
        nodeCenters.set(child.id, center);
        nodeLayouts[child.id] = {height, position: center, width};
      }
      visit(child);
    });
  };
  visit(result);

  if (document.nodes.some((node) => !nodeCenters.has(node.id))) return undefined;

  const elkEdges = new Map<string, ElkEdge>();
  const collectEdges = (elkNode: ElkNode) => {
    elkNode.edges?.forEach((edge) => elkEdges.set(edge.id, edge));
    elkNode.children?.forEach(collectEdges);
  };
  collectEdges(result);

  const edgeLayouts: BoardImportEdgeLayout[] = [];
  for (const edge of document.edges) {
    const elkEdge = elkEdges.get(edge.id);
    const section = elkEdge?.sections?.[0];
    if (!elkEdge || !section) {
      // Invisible spacing edges may be dropped silently; visible edges must be
      // routed or the whole result is discarded in favour of the fallback.
      if (edge.stroke === 'invisible') continue;
      return undefined;
    }
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      .map((point) => ({x: point.x, y: point.y}));
    if (points.length < 2 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      return undefined;
    }
    const label = elkEdge.labels?.[0];
    const labelPosition = label && label.x !== undefined && label.y !== undefined
      ? {
          x: label.x + (label.width ?? 0) / 2,
          y: label.y + (label.height ?? 0) / 2,
        }
      : undefined;
    edgeLayouts.push({
      id: edge.id,
      ...(labelPosition ? {labelPosition} : null),
      points,
      sourceId: edge.sourceId,
      sourceSide: anchorSideOf(edge, points[0], nodeCenters.get(edge.sourceId), nodeSizes.get(edge.sourceId)),
      targetId: edge.targetId,
      targetSide: anchorSideOf(edge, points[points.length - 1], nodeCenters.get(edge.targetId), nodeSizes.get(edge.targetId)),
    });
  }

  const width = result.width ?? 0;
  const height = result.height ?? 0;
  if (width <= 0 || height <= 0) return undefined;
  return {edges: edgeLayouts, height, nodes: nodeLayouts, width};
}

function anchorSideOf(
  edge: BoardEdge,
  point: BoardPoint | undefined,
  center: BoardPoint | undefined,
  size: {height: number; width: number} | undefined,
): BoardAnchorSide | undefined {
  if (!point || !center || !size) return undefined;
  const relativeX = (point.x - center.x) / Math.max(1, size.width / 2);
  const relativeY = (point.y - center.y) / Math.max(1, size.height / 2);
  if (Math.abs(relativeX) >= Math.abs(relativeY)) {
    return relativeX >= 0 ? 'right' : 'left';
  }
  return relativeY >= 0 ? 'bottom' : 'top';
}
