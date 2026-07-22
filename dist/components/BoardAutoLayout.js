const EDGE_LABEL_FONT_SCALE = 12 / 14;
const EDGE_LABEL_LINE_HEIGHT = 16;
export const EDGE_LABEL_MAX_TEXT_WIDTH = 220;
const EDGE_LABEL_MIN_TEXT_WIDTH = 24;
const EDGE_LABEL_SEGMENT_CLEARANCE = 6;
const EDGE_ARROW_MAX_LENGTH = 11;
const EDGE_ARROW_HALF_WIDTH = EDGE_ARROW_MAX_LENGTH * 0.52;
const EDGE_ARROW_LABEL_GAP = 4;
const EDGE_CORNER_MAX_RADIUS = 10;
/**
 * Deterministic SVG text measurement used before the browser paints the Board.
 * It errs slightly on the wide side so consumers do not depend on a system font.
 */
export function measureDiagramTextWidth(value, scale = 1) {
    return [...value].reduce((width, character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        const characterWidth = codePoint > 0xff ? 14 : character === ' ' ? 4 : /[A-Z0-9]/.test(character) ? 8.2 : 7.2;
        return width + characterWidth * scale;
    }, 0);
}
/** Preserve explicit line breaks, then wrap CJK by character and Latin by word. */
export function wrapDiagramText(value, maximumWidth, scale = 1) {
    const safeMaximum = Math.max(24, maximumWidth);
    return value.split('\n').flatMap((line) => wrapDiagramLine(line, safeMaximum, scale));
}
export function measureDiagramEdgeLabel(value, bare = false, maximumTextWidth = EDGE_LABEL_MAX_TEXT_WIDTH) {
    if (!value)
        return { height: 0, lines: [], width: 0 };
    const paddingX = bare ? 7 : 9;
    const paddingY = bare ? 3 : 5;
    const lines = wrapDiagramText(value, Math.min(EDGE_LABEL_MAX_TEXT_WIDTH, Math.max(EDGE_LABEL_MIN_TEXT_WIDTH, maximumTextWidth)), EDGE_LABEL_FONT_SCALE);
    const textWidth = Math.max(1, ...lines.map((line) => measureDiagramTextWidth(line, EDGE_LABEL_FONT_SCALE)));
    return {
        height: lines.length * EDGE_LABEL_LINE_HEIGHT + paddingY * 2,
        lines,
        width: textWidth + paddingX * 2,
    };
}
/** A floating label keeps only a small canvas cutout around the glyphs. */
export function compactDiagramEdgeLabelMetrics(metrics, bare = false) {
    const naturalPaddingX = bare ? 7 : 9;
    const naturalPaddingY = bare ? 3 : 5;
    const compactPaddingX = 2;
    const compactPaddingY = 1;
    return {
        height: Math.max(1, metrics.height - naturalPaddingY * 2) + compactPaddingY * 2,
        lines: metrics.lines,
        width: Math.max(1, metrics.width - naturalPaddingX * 2) + compactPaddingX * 2,
    };
}
/** Adjacent labels own real whitespace between rank boxes; the gap is not fixed. */
export function calculateAdaptiveRankGaps(rankCount, horizontal, edges, baseGap = 106) {
    const gaps = Array.from({ length: Math.max(0, rankCount - 1) }, () => baseGap);
    edges.forEach((edge) => {
        const firstRank = Math.min(edge.sourceRank, edge.targetRank);
        const lastRank = Math.max(edge.sourceRank, edge.targetRank);
        if (lastRank - firstRank !== 1 || firstRank < 0 || firstRank >= gaps.length)
            return;
        const label = edge.metrics ?? measureDiagramEdgeLabel(edge.label);
        const requiredGap = (horizontal ? label.width : label.height) + (edge.routePadding ?? 30);
        gaps[firstRank] = Math.max(gaps[firstRank], Math.ceil(requiredGap));
    });
    return gaps;
}
/** A -> B and B -> A share a pair key and therefore receive different lanes. */
export function assignDiagramEdgeLanes(edges) {
    const groups = new Map();
    edges.forEach((edge) => {
        if (edge.sourceId === edge.targetId)
            return;
        const pair = [edge.sourceId, edge.targetId].sort();
        const key = `${pair[0]}\u0000${pair[1]}`;
        const group = groups.get(key) ?? [];
        group.push(edge);
        groups.set(key, group);
    });
    const lanes = new Map();
    groups.forEach((group) => {
        if (group.length < 2)
            return;
        group.forEach((edge, index) => {
            const distance = Math.floor(index / 2) + 1;
            lanes.set(edge.id, index % 2 === 0 ? -distance : distance);
        });
    });
    return lanes;
}
/**
 * Reserve node and label rectangles, then select the lowest-collision candidate for
 * every automatic edge label. Explicit label positions are immutable reservations.
 */
export function placeDiagramEdgeLabels(edges, nodes) {
    const placements = new Map();
    const nodeObstacles = nodes.map(rectangleForNode);
    const paddedNodeObstacles = nodeObstacles.map((rectangle) => expandRectangle(rectangle, 8));
    const occupiedLabels = [];
    const labelledEdges = edges.filter((edge) => edge.label);
    const arrowObstacles = edges.flatMap((edge) => {
        const obstacle = terminalArrowObstacle(edge);
        return obstacle ? [obstacle] : [];
    });
    labelledEdges.forEach((edge) => {
        if (!edge.lockedPosition)
            return;
        const metrics = edgeMetrics(edge, EDGE_LABEL_MAX_TEXT_WIDTH);
        placements.set(edge.id, {
            maximumTextWidth: EDGE_LABEL_MAX_TEXT_WIDTH,
            mode: 'locked',
            orientation: 'horizontal',
            position: edge.lockedPosition,
            segmentIndex: -1,
        });
        occupiedLabels.push(expandRectangle(rectangleForLabel(edge, edge.lockedPosition, metrics), 7));
    });
    labelledEdges
        .map((edge, index) => ({
        edge,
        index,
        metrics: edgeMetrics(edge, EDGE_LABEL_MAX_TEXT_WIDTH),
    }))
        .filter(({ edge }) => !edge.lockedPosition)
        .sort((first, second) => second.metrics.width * second.metrics.height - first.metrics.width * first.metrics.height ||
        first.index - second.index)
        .forEach(({ edge }) => {
        const ranked = labelCandidates(edge)
            .map((candidate, index) => {
            const rectangle = rectangleForLabel(edge, candidate.position, candidate.metrics);
            const obstacles = candidate.floating ? nodeObstacles : paddedNodeObstacles;
            return {
                arrowCollisionArea: arrowObstacles.reduce((sum, obstacle) => sum + rectangleIntersectionArea(rectangle, obstacle), 0),
                collisionArea: [...obstacles, ...occupiedLabels].reduce((sum, obstacle) => sum + rectangleIntersectionArea(rectangle, obstacle), 0),
                candidate,
                index,
                rectangle,
            };
        })
            .sort(compareLabelCandidateScores);
        const fallbackPosition = polylineCenter(edge.points);
        const fallbackMetrics = edgeMetrics(edge, EDGE_LABEL_MAX_TEXT_WIDTH);
        const selected = ranked[0] ?? {
            candidate: {
                containmentOverflow: Number.POSITIVE_INFINITY,
                distanceFromCenter: 0,
                floating: false,
                maximumTextWidth: EDGE_LABEL_MAX_TEXT_WIDTH,
                metrics: fallbackMetrics,
                orientation: 'horizontal',
                position: fallbackPosition,
                segmentIndex: -1,
                segmentLength: 0,
            },
            rectangle: rectangleForLabel(edge, fallbackPosition, fallbackMetrics),
        };
        placements.set(edge.id, {
            maximumTextWidth: selected.candidate.maximumTextWidth,
            mode: selected.candidate.floating ? 'floating' : 'inline',
            orientation: selected.candidate.orientation,
            position: selected.candidate.position,
            segmentIndex: selected.candidate.segmentIndex,
        });
        occupiedLabels.push(expandRectangle(selected.rectangle, 7));
    });
    return placements;
}
function wrapDiagramLine(value, maximumWidth, scale) {
    if (!value)
        return [''];
    const tokens = value.match(/[A-Za-z0-9_./:+-]+|\s+|./gu) ?? [value];
    const lines = [];
    let current = '';
    const commit = () => {
        lines.push(current.trim());
        current = '';
    };
    tokens.forEach((token) => {
        const normalizedToken = current ? token : token.trimStart();
        if (!normalizedToken)
            return;
        const candidate = current + normalizedToken;
        if (measureDiagramTextWidth(candidate, scale) <= maximumWidth) {
            current = candidate;
            return;
        }
        if (current)
            commit();
        if (measureDiagramTextWidth(normalizedToken, scale) <= maximumWidth) {
            current = normalizedToken;
            return;
        }
        [...normalizedToken].forEach((character) => {
            if (current && measureDiagramTextWidth(current + character, scale) > maximumWidth)
                commit();
            current += character;
        });
    });
    if (current || lines.length === 0)
        commit();
    return lines;
}
function labelCandidates(edge) {
    const pathCenter = polylineCenter(edge.points);
    const segments = edge.points.slice(1).flatMap((end, index) => {
        const start = edge.points[index];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const horizontal = Math.abs(start.y - end.y) < 0.1;
        const vertical = Math.abs(start.x - end.x) < 0.1;
        if (length < 1 || (!horizontal && !vertical))
            return [];
        const startClearance = EDGE_LABEL_SEGMENT_CLEARANCE + (index > 0 ? EDGE_CORNER_MAX_RADIUS : 0);
        const endClearance = EDGE_LABEL_SEGMENT_CLEARANCE +
            (index < edge.points.length - 2 ? EDGE_CORNER_MAX_RADIUS : 0) +
            (edge.arrow && index === edge.points.length - 2 ? EDGE_ARROW_MAX_LENGTH : 0);
        return [{
                carrierLength: Math.max(0, length - startClearance - endClearance),
                end,
                endClearance,
                horizontal,
                index,
                length,
                start,
                startClearance,
            }];
    });
    if (segments.length === 0)
        return [];
    const candidates = segments.flatMap((segment) => candidatesForSegment(edge, segment, pathCenter));
    const contained = candidates.filter((candidate) => candidate.containmentOverflow < 0.1);
    if (contained.length > 0)
        return contained;
    // A malformed/manual route may not contain the full label. Keep all semantic
    // text and use only its longest carrier instead of jumping to a tiny endpoint stub.
    const longest = Math.max(...segments.map((segment) => segment.carrierLength));
    return candidates.filter((candidate) => candidate.segmentLength >= longest - 0.1);
}
function candidatesForSegment(edge, segment, pathCenter) {
    const labelPaddingX = edge.bare ? 7 : 9;
    const maximumTextWidth = segment.horizontal
        ? Math.min(EDGE_LABEL_MAX_TEXT_WIDTH, Math.max(EDGE_LABEL_MIN_TEXT_WIDTH, segment.carrierLength - labelPaddingX * 2))
        : EDGE_LABEL_MAX_TEXT_WIDTH;
    const inlineMetrics = edgeMetrics(edge, maximumTextWidth);
    const floatingMetrics = compactDiagramEdgeLabelMetrics(inlineMetrics, edge.bare);
    const positions = [];
    const add = (position, floating, metrics) => {
        if (positions.some((candidate) => candidate.floating === floating &&
            Math.hypot(candidate.position.x - position.x, candidate.position.y - position.y) < 0.5))
            return;
        positions.push({ floating, metrics, position });
    };
    for (const ratio of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const inlinePosition = positionOnCarrier(edge, segment, inlineMetrics, ratio);
        add(inlinePosition, false, inlineMetrics);
        const floatingPosition = positionOnCarrier(edge, segment, floatingMetrics, ratio);
        const offset = segment.horizontal
            ? floatingMetrics.height / 2 + EDGE_ARROW_HALF_WIDTH + EDGE_ARROW_LABEL_GAP
            : floatingMetrics.width / 2 + EDGE_ARROW_HALF_WIDTH + EDGE_ARROW_LABEL_GAP;
        for (const direction of [-1, 1]) {
            add(segment.horizontal
                ? { x: floatingPosition.x, y: floatingPosition.y + direction * offset }
                : { x: floatingPosition.x + direction * offset, y: floatingPosition.y }, true, floatingMetrics);
        }
    }
    return positions.map(({ floating, metrics, position }) => {
        const rectangle = rectangleForLabel(edge, position, metrics);
        return {
            containmentOverflow: longitudinalOverflow(segment, rectangle),
            distanceFromCenter: Math.hypot(position.x - pathCenter.x, position.y - pathCenter.y),
            floating,
            maximumTextWidth,
            metrics,
            orientation: segment.horizontal ? 'horizontal' : 'vertical',
            position,
            segmentIndex: segment.index,
            segmentLength: segment.carrierLength,
        };
    });
}
function positionOnCarrier(edge, segment, metrics, ratio) {
    const bounds = carrierBounds(segment);
    if (!segment.horizontal) {
        return {
            x: segment.start.x,
            y: clampToInterval(bounds.minimum + (bounds.maximum - bounds.minimum) * ratio, bounds.minimum + metrics.height / 2, bounds.maximum - metrics.height / 2),
        };
    }
    const desiredX = bounds.minimum + (bounds.maximum - bounds.minimum) * ratio;
    const extents = horizontalLabelExtents(edge, metrics);
    const lower = bounds.minimum - extents.left;
    const upper = bounds.maximum - extents.right;
    return { x: clampToInterval(desiredX, lower, upper), y: segment.start.y };
}
function longitudinalOverflow(segment, rectangle) {
    const bounds = carrierBounds(segment);
    if (segment.horizontal) {
        return (Math.max(0, bounds.minimum - rectangle.left) +
            Math.max(0, rectangle.right - bounds.maximum));
    }
    return (Math.max(0, bounds.minimum - rectangle.top) +
        Math.max(0, rectangle.bottom - bounds.maximum));
}
function carrierBounds(segment) {
    const startAxis = segment.horizontal ? segment.start.x : segment.start.y;
    const endAxis = segment.horizontal ? segment.end.x : segment.end.y;
    if (segment.carrierLength <= 0) {
        const midpoint = (startAxis + endAxis) / 2;
        return { maximum: midpoint, minimum: midpoint };
    }
    const direction = endAxis >= startAxis ? 1 : -1;
    const first = startAxis + direction * segment.startClearance;
    const last = endAxis - direction * segment.endClearance;
    return { maximum: Math.max(first, last), minimum: Math.min(first, last) };
}
function compareLabelCandidateScores(first, second) {
    const firstHitsArrow = first.arrowCollisionArea > 0.1 ? 1 : 0;
    const secondHitsArrow = second.arrowCollisionArea > 0.1 ? 1 : 0;
    const firstCollides = first.collisionArea > 0.1 ? 1 : 0;
    const secondCollides = second.collisionArea > 0.1 ? 1 : 0;
    const firstOverflows = first.candidate.containmentOverflow > 0.1 ? 1 : 0;
    const secondOverflows = second.candidate.containmentOverflow > 0.1 ? 1 : 0;
    const firstMasksShortCarrier = firstOverflows && !first.candidate.floating ? 1 : 0;
    const secondMasksShortCarrier = secondOverflows && !second.candidate.floating ? 1 : 0;
    return (firstHitsArrow - secondHitsArrow ||
        firstMasksShortCarrier - secondMasksShortCarrier ||
        firstCollides - secondCollides ||
        first.arrowCollisionArea - second.arrowCollisionArea ||
        firstOverflows - secondOverflows ||
        first.collisionArea - second.collisionArea ||
        first.candidate.containmentOverflow - second.candidate.containmentOverflow ||
        Number(first.candidate.floating) - Number(second.candidate.floating) ||
        Number(first.candidate.orientation === 'vertical') -
            Number(second.candidate.orientation === 'vertical') ||
        first.candidate.metrics.lines.length - second.candidate.metrics.lines.length ||
        first.candidate.distanceFromCenter - second.candidate.distanceFromCenter ||
        second.candidate.segmentLength - first.candidate.segmentLength ||
        first.index - second.index);
}
function terminalArrowObstacle(edge) {
    if (!edge.arrow || edge.points.length < 2)
        return undefined;
    const tip = edge.points.at(-1);
    const start = edge.points.at(-2);
    if (!tip || !start)
        return undefined;
    const segmentLength = Math.hypot(tip.x - start.x, tip.y - start.y);
    if (segmentLength < 0.1)
        return undefined;
    const direction = {
        x: (tip.x - start.x) / segmentLength,
        y: (tip.y - start.y) / segmentLength,
    };
    const arrowLength = Math.min(EDGE_ARROW_MAX_LENGTH, Math.max(6, segmentLength * 0.58));
    const halfWidth = arrowLength * 0.52;
    const base = {
        x: tip.x - direction.x * arrowLength,
        y: tip.y - direction.y * arrowLength,
    };
    const points = [
        tip,
        { x: base.x - direction.y * halfWidth, y: base.y + direction.x * halfWidth },
        { x: base.x + direction.y * halfWidth, y: base.y - direction.x * halfWidth },
    ];
    return expandRectangle({
        bottom: Math.max(...points.map((point) => point.y)),
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
    }, 2);
}
function polylineCenter(points) {
    const segments = points.slice(1).map((end, index) => {
        const start = points[index];
        return { end, length: Math.hypot(end.x - start.x, end.y - start.y), start };
    });
    let remaining = segments.reduce((sum, segment) => sum + segment.length, 0) / 2;
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
function rectangleForNode(node) {
    return {
        bottom: node.position.y + node.height / 2,
        left: node.position.x - node.width / 2,
        right: node.position.x + node.width / 2,
        top: node.position.y - node.height / 2,
    };
}
function rectangleForLabel(edge, position, metrics) {
    const extents = horizontalLabelExtents(edge, metrics);
    const left = position.x + extents.left;
    return {
        bottom: position.y + metrics.height / 2,
        left,
        right: left + metrics.width,
        top: position.y - metrics.height / 2,
    };
}
function horizontalLabelExtents(edge, metrics) {
    const paddingX = edge.bare ? 7 : 9;
    if (edge.align === 'start') {
        return { left: -paddingX, right: metrics.width - paddingX };
    }
    if (edge.align === 'end') {
        return { left: -metrics.width + paddingX, right: paddingX };
    }
    return { left: -metrics.width / 2, right: metrics.width / 2 };
}
function edgeMetrics(edge, maximumTextWidth) {
    const estimated = measureDiagramEdgeLabel(edge.label, edge.bare, maximumTextWidth);
    return edge.metrics && sameLines(edge.metrics.lines, estimated.lines) ? edge.metrics : estimated;
}
function sameLines(first, second) {
    return first.length === second.length && first.every((line, index) => line === second[index]);
}
function clampToInterval(value, minimum, maximum) {
    if (minimum > maximum)
        return (minimum + maximum) / 2;
    return Math.min(maximum, Math.max(minimum, value));
}
function expandRectangle(rectangle, amount) {
    return {
        bottom: rectangle.bottom + amount,
        left: rectangle.left - amount,
        right: rectangle.right + amount,
        top: rectangle.top - amount,
    };
}
function rectangleIntersectionArea(first, second) {
    const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
    return width * height;
}
//# sourceMappingURL=BoardAutoLayout.js.map