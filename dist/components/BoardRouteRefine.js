import { measureDiagramEdgeLabel, measureDiagramTextWidth } from './BoardAutoLayout.js';
import { applyBoardLayout, validateBoardLayout } from './BoardLayout.js';
const EPSILON = 0.01;
const LANE_GAP = 8;
const PORT_GAP = 10;
// Two 10px corner radii plus a visible 12px straight section.
const MIN_OFFSET = 32;
const SOURCE_STUB = 16;
const ARROW_STUB = 24;
const ENDPOINT_CLEARANCE = 24;
/** Refine ELK geometry without changing ranks, node positions or edge semantics. */
export function refineBoardRoutes(document, layout) {
    const axis = createAxis(document.direction);
    const nodes = new Map(Object.entries(layout.nodes).map(([id, node]) => [
        id,
        axis.boxAt(axis.toAxis(node.position), node.width ?? 0, node.height ?? 0),
    ]));
    const geometry = {
        axis,
        nodes,
        groups: buildGroupObstacles(document, nodes, axis.horizontal),
        edges: new Map(document.edges.map((edge) => [edge.id, edge])),
        originals: new Map(),
        maxU: axis.horizontal ? layout.width : layout.height,
        maxV: axis.horizontal ? layout.height : layout.width,
    };
    const routes = (layout.edges ?? []).map((edge) => ({
        ...edge,
        points: edge.points?.map((point) => ({ ...point })),
    }));
    const visible = routes.filter((edge) => Boolean(edge.id && edge.points?.length && geometry.edges.get(edge.id)?.stroke !== 'invisible'));
    for (const route of visible) {
        route.points = normalize(route.points.map(axis.toAxis)).map(axis.fromAxis);
        geometry.originals.set(route.id, route.points.map(axis.toAxis));
    }
    const working = { ...layout, edges: routes };
    allocateGapChannels(document, working, geometry, visible);
    let currentErrors = layoutErrors(document, working);
    const ordered = [...visible].sort((a, b) => (b.points.length - a.points.length || compareRoutes(a, b, geometry)));
    for (const route of ordered) {
        const context = createRouteContext(geometry, route, visible);
        if (!context)
            continue;
        const originalQuality = routeQuality(context, context.original);
        if (originalQuality.bends === 0 && originalQuality.endpointViolations === 0)
            continue;
        const candidates = rankCandidates(context, originalQuality);
        for (const { points } of candidates) {
            if (!isCandidateSafe(context, points))
                continue;
            const label = context.edge.label ? positionLabel(context, points) : route.labelPosition;
            if (context.edge.label && !label)
                continue;
            const previousPoints = route.points;
            const previousLabel = route.labelPosition;
            route.points = points.map(axis.fromAxis);
            route.labelPosition = label;
            const nextErrors = layoutErrors(document, working);
            if ([...nextErrors].some((error) => !currentErrors.has(error))) {
                route.points = previousPoints;
                route.labelPosition = previousLabel;
                continue;
            }
            // Occupancy is read from the accepted routes before refining the next edge.
            currentErrors = nextErrors;
            break;
        }
    }
    return working;
}
/** Commit a whole gap at once so its edges can make room for one another. */
function allocateGapChannels(document, layout, geometry, visible) {
    for (const gap of collectGaps(geometry, visible)) {
        const ports = assignGapPorts(gap, geometry, visible);
        if (!ports)
            continue;
        const bent = ports.filter(({ start, end }) => !near(start.v, end.v));
        const ordered = orderGapChannels(bent, gap, geometry);
        if (ordered.length > 1 && (gap.high - gap.low) / (ordered.length + 1) < LANE_GAP)
            continue;
        const channels = new Map(ordered.map((entry, index) => [
            entry.route.id,
            gap.low + (index + 1) * (gap.high - gap.low) / (ordered.length + 1),
        ]));
        const proposal = new Map(ports.map((entry) => [
            entry.route.id,
            normalize(zRoute(entry, channels.get(entry.route.id) ?? (gap.low + gap.high) / 2)),
        ]));
        const affected = new Set(proposal.keys());
        const replacements = visible.map((route) => proposal.has(route.id) ? {
            ...route,
            points: proposal.get(route.id).map(geometry.axis.fromAxis),
            labelPosition: undefined,
        } : route);
        const before = gapQuality(visible, affected, geometry);
        const after = gapQuality(replacements, affected, geometry);
        if (after[2] > before[2] || !(after[0] < before[0]
            || (after[0] === before[0] && after[1] < before[1])))
            continue;
        let safe = true;
        const affectedRoutes = replacements.filter((entry) => affected.has(entry.id));
        affectedRoutes.sort((a, b) => compareRoutes(a, b, geometry));
        for (const route of affectedRoutes) {
            const context = createRouteContext(geometry, route, replacements);
            if (!context || !isCandidateSafe(context, proposal.get(route.id))) {
                safe = false;
                break;
            }
            if (context.edge.label) {
                route.labelPosition = positionLabel(context, proposal.get(route.id));
                if (!route.labelPosition) {
                    safe = false;
                    break;
                }
            }
        }
        if (!safe)
            continue;
        const byId = new Map(replacements.map((route) => [route.id, route]));
        const candidate = { ...layout, edges: layout.edges?.map((route) => byId.get(route.id ?? '') ?? route) };
        const errors = layoutErrors(document, layout);
        if ([...layoutErrors(document, candidate)].some((error) => !errors.has(error)))
            continue;
        for (const route of visible) {
            if (affected.has(route.id))
                Object.assign(route, byId.get(route.id));
        }
    }
}
function collectGaps(geometry, routes) {
    const gaps = new Map();
    for (const route of routes) {
        const { axis } = geometry;
        if (!axis.primarySide(route.sourceSide) || !axis.primarySide(route.targetSide))
            continue;
        const source = geometry.nodes.get(route.sourceId);
        const target = geometry.nodes.get(route.targetId);
        const points = route.points.map(axis.toAxis);
        const start = points[0];
        const end = points[points.length - 1];
        if (!pointsOutward(axis, start, { u: end.u, v: start.v }, route.sourceSide))
            continue;
        if (!pointsOutward(axis, end, { u: start.u, v: end.v }, route.targetSide))
            continue;
        const [left, right] = start.u < end.u ? [source, target] : [target, source];
        const [leftId, rightId] = start.u < end.u
            ? [route.sourceId, route.targetId] : [route.targetId, route.sourceId];
        const sourceGroup = smallestGroup(geometry.groups, leftId);
        const targetGroup = smallestGroup(geometry.groups, rightId);
        let low = left.u1;
        let high = right.u0;
        let key;
        if (sourceGroup && targetGroup && sourceGroup !== targetGroup
            && sourceGroup.box.u1 < targetGroup.box.u0) {
            low = sourceGroup.box.u1;
            high = targetGroup.box.u0;
            key = `groups:${sourceGroup.id}:${targetGroup.id}`;
        }
        else {
            // Nodes whose primary projections overlap belong to the same column.
            const members = sourceGroup === targetGroup && sourceGroup
                ? [...sourceGroup.members] : [...geometry.nodes.keys()];
            const columns = nodeColumns(members.map((id) => geometry.nodes.get(id)).filter(Boolean));
            const leftIndex = columns.findIndex((column) => left.u0 >= column.u0 && left.u1 <= column.u1);
            const rightIndex = columns.findIndex((column) => right.u0 >= column.u0 && right.u1 <= column.u1);
            if (leftIndex < 0 || rightIndex !== leftIndex + 1)
                continue;
            low = columns[leftIndex].u1;
            high = columns[rightIndex].u0;
            key = `columns:${sourceGroup?.id ?? ''}:${targetGroup?.id ?? ''}:${low}:${high}`;
        }
        const edge = geometry.edges.get(route.id);
        const sourceStub = edge.sourceArrow ? ARROW_STUB : SOURCE_STUB;
        const targetStub = edge.arrow ? ARROW_STUB : SOURCE_STUB;
        const leftStub = start.u < end.u ? sourceStub : targetStub;
        const rightStub = start.u < end.u ? targetStub : sourceStub;
        const safeLow = Math.max(low + LANE_GAP, left.u1 + leftStub);
        const safeHigh = Math.min(high - LANE_GAP, right.u0 - rightStub);
        if (safeLow >= safeHigh)
            continue;
        const gap = gaps.get(key) ?? { key, low: safeLow, high: safeHigh, routes: [] };
        gap.low = Math.max(gap.low, safeLow);
        gap.high = Math.min(gap.high, safeHigh);
        gap.routes.push(route);
        gaps.set(key, gap);
    }
    // A skip-layer edge can share the same empty corridor. Include it in the
    // transaction instead of treating its old channel as an immovable obstacle.
    for (const gap of gaps.values()) {
        for (const route of routes) {
            if (gap.routes.includes(route))
                continue;
            if (!geometry.axis.primarySide(route.sourceSide) || !geometry.axis.primarySide(route.targetSide))
                continue;
            const points = route.points.map(geometry.axis.toAxis);
            const start = points[0];
            const end = points[points.length - 1];
            if (Math.min(start.u, end.u) + ARROW_STUB > gap.low
                || Math.max(start.u, end.u) - ARROW_STUB < gap.high)
                continue;
            if (!pointsOutward(geometry.axis, start, { u: end.u, v: start.v }, route.sourceSide))
                continue;
            if (!pointsOutward(geometry.axis, end, { u: start.u, v: end.v }, route.targetSide))
                continue;
            gap.routes.push(route);
        }
    }
    return [...gaps.values()]
        .filter((gap) => gap.routes.length > 1 && gap.low < gap.high)
        .sort((a, b) => a.low - b.low || a.high - b.high || compareIds(a.key, b.key));
}
function smallestGroup(groups, id) {
    return groups.filter(({ members }) => members.has(id)).sort((a, b) => a.members.size - b.members.size || compareIds(a.id, b.id))[0];
}
function nodeColumns(boxes) {
    const columns = [];
    for (const box of [...boxes].sort((a, b) => a.u0 - b.u0 || a.u1 - b.u1)) {
        const previous = columns[columns.length - 1];
        if (previous && box.u0 < previous.u1 - EPSILON) {
            previous.u1 = Math.max(previous.u1, box.u1);
        }
        else {
            columns.push({ u0: box.u0, u1: box.u1 });
        }
    }
    return columns;
}
function assignGapPorts(gap, geometry, visible) {
    const entries = [...gap.routes].sort((a, b) => compareRoutes(a, b, geometry)).map((route) => {
        const points = route.points.map(geometry.axis.toAxis);
        return { route, start: { ...points[0] }, end: { ...points[points.length - 1] } };
    });
    const sideSlots = new Map();
    for (const entry of entries) {
        for (const source of [true, false]) {
            const id = source ? entry.route.sourceId : entry.route.targetId;
            const side = source ? entry.route.sourceSide : entry.route.targetSide;
            const box = geometry.nodes.get(id);
            const point = source ? entry.start : entry.end;
            const [low, high] = gapPortRange(box, point.u, gap, geometry);
            const slot = {
                entry,
                point: source ? entry.start : entry.end,
                opposite: source ? entry.end : entry.start,
                low,
                high,
            };
            const key = `${id}:${side}`;
            const slots = sideSlots.get(key) ?? [];
            slots.push(slot);
            sideSlots.set(key, slots);
        }
    }
    for (const slots of sideSlots.values()) {
        // Sort by the opposite node centre, not its ELK port or declaration index.
        const otherCenter = (slot) => {
            const source = slot.point === slot.entry.start;
            const id = source ? slot.entry.route.targetId : slot.entry.route.sourceId;
            const box = geometry.nodes.get(id);
            return (box.v0 + box.v1) / 2;
        };
        slots.sort((a, b) => otherCenter(a) - otherCenter(b)
            || compareRoutes(a.entry.route, b.entry.route, geometry));
        const { low, high } = slots[0];
        if (high - low < (slots.length - 1) * PORT_GAP)
            return undefined;
        const spacing = Math.max(PORT_GAP, (high - low) / (slots.length + 1));
        const first = (low + high - spacing * (slots.length - 1)) / 2;
        slots.forEach((slot, index) => { slot.point.v = first + spacing * index; });
    }
    // Align overlapping endpoint slots to eliminate avoidable Z routes. Adjacent
    // slots remain at least PORT_GAP apart throughout this deterministic pass.
    const alignmentOrder = [...entries].sort((a, b) => Number(Math.abs(a.start.v - a.end.v) >= MIN_OFFSET)
        - Number(Math.abs(b.start.v - b.end.v) >= MIN_OFFSET)
        || compareRoutes(a.route, b.route, geometry));
    for (const entry of alignmentOrder) {
        const bounds = (point) => {
            const slots = [...sideSlots.values()].find((list) => list.some((slot) => slot.point === point));
            const index = slots.findIndex((slot) => slot.point === point);
            const slot = slots[index];
            return [
                Math.max(slot.low, index ? slots[index - 1].point.v + PORT_GAP : slot.low),
                Math.min(slot.high, index + 1 < slots.length ? slots[index + 1].point.v - PORT_GAP : slot.high),
            ];
        };
        const [s0, s1] = bounds(entry.start);
        const [t0, t1] = bounds(entry.end);
        const low = Math.max(s0, t0);
        const high = Math.min(s1, t1);
        if (low <= high) {
            const v = clamp((entry.start.v + entry.end.v) / 2, low, high);
            entry.start.v = v;
            entry.end.v = v;
        }
        else if (Math.abs(entry.start.v - entry.end.v) < MIN_OFFSET) {
            // When the available slots cannot overlap, spread the bend while
            // retaining the order and clearance of neighbouring ports.
            const pairs = [-1, 1].flatMap((sign) => {
                const low = Math.max(s0, t0 - sign * MIN_OFFSET);
                const high = Math.min(s1, t1 - sign * MIN_OFFSET);
                if (low > high)
                    return [];
                const start = clamp((entry.start.v + entry.end.v - sign * MIN_OFFSET) / 2, low, high);
                return [{ start, end: start + sign * MIN_OFFSET }];
            });
            pairs.sort((a, b) => (Math.abs(a.start - entry.start.v) + Math.abs(a.end - entry.end.v))
                - (Math.abs(b.start - entry.start.v) + Math.abs(b.end - entry.end.v))
                || a.start - b.start);
            if (pairs[0]) {
                entry.start.v = pairs[0].start;
                entry.end.v = pairs[0].end;
            }
        }
    }
    // Edges outside this gap retain their ports and remain hard obstacles.
    const included = new Set(entries.map(({ route }) => route.id));
    for (const entry of entries) {
        const outside = visible.filter((route) => !included.has(route.id));
        const context = createRouteContext(geometry, entry.route, [entry.route, ...outside]);
        if (!context)
            return undefined;
        if (context.sourcePorts.some((point) => distance(point, entry.start) < PORT_GAP - EPSILON))
            return undefined;
        if (context.targetPorts.some((point) => distance(point, entry.end) < PORT_GAP - EPSILON))
            return undefined;
    }
    return entries;
}
function gapPortRange(box, endpoint, gap, geometry) {
    let ranges = [portRange(box)];
    for (const { titleBox } of geometry.groups) {
        if (overlap(endpoint, (gap.low + gap.high) / 2, titleBox.u0, titleBox.u1) < 0)
            continue;
        ranges = ranges.flatMap(([low, high]) => {
            if (high < titleBox.v0 || low > titleBox.v1)
                return [[low, high]];
            const available = [];
            if (low < titleBox.v0)
                available.push([low, titleBox.v0 - 1]);
            if (high > titleBox.v1)
                available.push([titleBox.v1 + 1, high]);
            return available;
        });
    }
    ranges.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]) || a[0] - b[0]);
    return ranges[0] ?? [1, 0];
}
function zRoute(entry, channel) {
    return [entry.start, { u: channel, v: entry.start.v }, { u: channel, v: entry.end.v }, entry.end];
}
function pairCrossings(first, second) {
    let count = 0;
    for (const a of segments(normalize(first))) {
        for (const b of segments(normalize(second))) {
            const point = intersectionPoint(a, b);
            if (point && strictlyInside(point, a) && strictlyInside(point, b))
                count++;
        }
    }
    return count;
}
function orderGapChannels(entries, gap, geometry) {
    const low = gap.low + (gap.high - gap.low) / 3;
    const high = gap.high - (gap.high - gap.low) / 3;
    const dependencies = new Map(entries.map((entry) => [entry, new Map()]));
    for (let first = 0; first < entries.length; first++) {
        for (let second = first + 1; second < entries.length; second++) {
            const a = entries[first];
            const b = entries[second];
            const before = pairCrossings(zRoute(a, low), zRoute(b, high));
            const after = pairCrossings(zRoute(a, high), zRoute(b, low));
            if (before < after)
                dependencies.get(a).set(b, after - before);
            if (after < before)
                dependencies.get(b).set(a, before - after);
        }
    }
    const remaining = new Set(entries);
    const result = [];
    while (remaining.size) {
        const incoming = (entry) => [...remaining].reduce((sum, other) => sum + (dependencies.get(other).get(entry) ?? 0), 0);
        const available = [...remaining].filter((entry) => incoming(entry) === 0);
        // Break a dependency cycle at the least costly incoming preference.
        const next = (available.length ? available : [...remaining]).sort((a, b) => incoming(a) - incoming(b) || compareRoutes(a.route, b.route, geometry))[0];
        result.push(next);
        remaining.delete(next);
    }
    return result;
}
function gapQuality(routes, affected, geometry) {
    const points = routes.map((route) => route.points.map(geometry.axis.toAxis));
    let violations = 0;
    let bends = 0;
    let crossings = 0;
    routes.forEach((route, index) => {
        if (!affected.has(route.id))
            return;
        violations += shortEndpointCount(geometry.edges.get(route.id), points[index])
            + smallOffsetIndices(points[index]).length;
        bends += points[index].length - 2;
    });
    for (let first = 0; first < routes.length; first++) {
        for (let second = first + 1; second < routes.length; second++) {
            if (!affected.has(routes[first].id) && !affected.has(routes[second].id))
                continue;
            for (const a of segments(points[first])) {
                for (const b of segments(points[second])) {
                    const point = intersectionPoint(a, b);
                    if (!point)
                        continue;
                    if (strictlyInside(point, a) && strictlyInside(point, b))
                        crossings++;
                    if (nearEndpoint(point, points[first]) || nearEndpoint(point, points[second]))
                        violations++;
                }
            }
        }
    }
    return [violations, bends, crossings];
}
function createAxis(direction) {
    const horizontal = direction === 'LR' || direction === 'RL';
    return {
        horizontal,
        toAxis: ({ x, y }) => horizontal ? { u: x, v: y } : { u: y, v: x },
        fromAxis: ({ u, v }) => horizontal ? { x: u, y: v } : { x: v, y: u },
        boxAt(center, width, height) {
            const uSize = horizontal ? width : height;
            const vSize = horizontal ? height : width;
            return {
                u0: center.u - uSize / 2,
                u1: center.u + uSize / 2,
                v0: center.v - vSize / 2,
                v1: center.v + vSize / 2,
            };
        },
        primarySide: (side) => horizontal
            ? side === 'left' || side === 'right'
            : side === 'top' || side === 'bottom',
    };
}
function buildGroupObstacles(document, nodes, horizontal) {
    const groups = document.groups ?? [];
    const resolved = new Map();
    const resolving = new Set();
    const resolve = (id) => {
        const cached = resolved.get(id);
        if (cached)
            return cached;
        const group = groups.find((entry) => entry.id === id);
        if (!group || resolving.has(id))
            return undefined;
        resolving.add(id);
        const members = new Set(group.nodeIds);
        const boxes = group.nodeIds.flatMap((nodeId) => {
            const box = nodes.get(nodeId);
            return box ? [box] : [];
        });
        for (const child of groups.filter((entry) => entry.parentId === id)) {
            const nested = resolve(child.id);
            if (!nested)
                continue;
            boxes.push(nested.box);
            nested.members.forEach((nodeId) => members.add(nodeId));
        }
        resolving.delete(id);
        if (!boxes.length)
            return undefined;
        const contentBox = {
            u0: Math.min(...boxes.map((box) => box.u0)),
            u1: Math.max(...boxes.map((box) => box.u1)),
            v0: Math.min(...boxes.map((box) => box.v0)),
            v1: Math.max(...boxes.map((box) => box.v1)),
        };
        // Match the rendered chrome, including the header and nested child groups.
        const box = {
            u0: contentBox.u0 - (horizontal ? 24 : 44),
            u1: contentBox.u1 + (horizontal ? 24 : 22),
            v0: contentBox.v0 - (horizontal ? 44 : 24),
            v1: contentBox.v1 + (horizontal ? 22 : 24),
        };
        // BoardCanvas draws the label at (left + 18, top + 24), at 12px.
        const left = horizontal ? box.u0 : box.v0;
        const top = horizontal ? box.v0 : box.u0;
        const width = measureDiagramTextWidth(group.label, 12 / 14) + [...group.label].length * 0.24;
        const title = { left: left + 10, right: left + 26 + width, top: top + 4, bottom: top + 35 };
        const titleBox = horizontal
            ? { u0: title.left, u1: title.right, v0: title.top, v1: title.bottom }
            : { u0: title.top, u1: title.bottom, v0: title.left, v1: title.right };
        const obstacle = { id, box, contentBox, titleBox, members };
        resolved.set(id, obstacle);
        return obstacle;
    };
    groups.forEach(({ id }) => resolve(id));
    return [...resolved.values()];
}
function createRouteContext(geometry, route, visible) {
    if (route.sourceId === route.targetId)
        return undefined;
    const source = geometry.nodes.get(route.sourceId);
    const target = geometry.nodes.get(route.targetId);
    const edge = geometry.edges.get(route.id);
    if (!source || !target || !edge || route.points.length < 2)
        return undefined;
    const others = visible.filter((other) => other !== route).map((other) => {
        const points = other.points.map(geometry.axis.toAxis);
        return { route: other, points, segments: segments(points) };
    });
    return {
        geometry,
        route,
        edge,
        source,
        target,
        original: route.points.map(geometry.axis.toAxis),
        others,
        sourcePorts: occupiedPorts(others, route.sourceId, route.sourceSide),
        targetPorts: occupiedPorts(others, route.targetId, route.targetSide),
    };
}
function occupiedPorts(others, nodeId, side) {
    const ports = [];
    for (const { route, points } of others) {
        if (route.sourceId === nodeId && route.sourceSide === side)
            ports.push(points[0]);
        if (route.targetId === nodeId && route.targetSide === side)
            ports.push(points[points.length - 1]);
    }
    return ports;
}
function rankCandidates(context, original) {
    const seen = new Set();
    const ranked = [];
    const originalReversals = reversalCount(context.original);
    const hasEndpointCrossing = original.endpointViolations
        > shortEndpointCount(context.edge, context.original);
    for (const candidate of generateCandidates(context)) {
        const points = normalize(candidate);
        const key = JSON.stringify(points);
        if (seen.has(key) || points.length < 2)
            continue;
        seen.add(key);
        // Escaping an existing endpoint crossing may require an outer detour.
        // Otherwise a local repair must not introduce new reversals.
        if (!hasEndpointCrossing && reversalCount(points) > originalReversals)
            continue;
        const quality = routeQuality(context, points);
        if (!improvesQuality(quality, original))
            continue;
        ranked.push({ points, quality });
    }
    return ranked.sort((a, b) => compareQuality(a.quality, b.quality));
}
function generateCandidates(context) {
    const { axis } = context.geometry;
    const { route, original } = context;
    const candidates = reversalCandidates(original);
    if (axis.primarySide(route.sourceSide) && axis.primarySide(route.targetSide)) {
        candidates.unshift(...portCandidates(context));
    }
    // Moving a terminal channel can repair a short arrow stub without removing
    // bends. It also preserves detours that a full Z route cannot safely replace.
    candidates.push(...endpointChannelCandidates(context));
    for (const points of smallOffsetCandidates(context)) {
        candidates.push(points);
        // ELK can combine a small offset with a short terminal stub. Repair them
        // together so the candidate still clears the unchanged endpoint checks.
        if (shortEndpointCount(context.edge, points)) {
            candidates.push(...endpointChannelCandidates({ ...context, original: points }));
        }
    }
    candidates.push(...terminalShortcutCandidates(context));
    return candidates;
}
function terminalShortcutCandidates(context) {
    const { original, geometry } = context;
    const candidates = [];
    const end = original[original.length - 1];
    if (!geometry.axis.primarySide(context.route.targetSide))
        return candidates;
    const [low, high] = portRange(context.target);
    const targetValues = portValues(low, high, end.v, context.targetPorts);
    const channels = channelCoordinates(context);
    // Reuse existing channels and shared gaps to shorten the tail; never add an
    // outer lane beyond this subpath's endpoints.
    for (let index = 1; index < original.length - 1; index++) {
        const start = original[index];
        for (const u of unique(channels)) {
            if (u < Math.min(start.u, end.u) || u > Math.max(start.u, end.u))
                continue;
            for (const v of targetValues) {
                candidates.push([
                    ...original.slice(0, index + 1),
                    { u, v: start.v },
                    { u, v },
                    { u: end.u, v },
                ]);
            }
        }
    }
    return candidates;
}
function portCandidates(context) {
    const { original, source, target, sourcePorts, targetPorts } = context;
    const start = original[0];
    const end = original[original.length - 1];
    const [s0, s1] = portRange(source);
    const [t0, t1] = portRange(target);
    const candidates = [];
    const low = Math.max(s0, t0);
    const high = Math.min(s1, t1);
    if (low <= high) {
        const aligned = unique([
            ...portValues(low, high, start.v, [...sourcePorts, ...targetPorts]),
            clamp(end.v, low, high),
            clamp((start.v + end.v) / 2, low, high),
        ]);
        const displacement = (v) => Math.abs(v - start.v) + Math.abs(v - end.v);
        aligned.sort((a, b) => displacement(a) - displacement(b) || a - b);
        for (const v of aligned) {
            candidates.push([{ u: start.u, v }, { u: end.u, v }]);
        }
    }
    const channels = channelCoordinates(context);
    for (const vSource of portValues(s0, s1, start.v, sourcePorts)) {
        for (const vTarget of portValues(t0, t1, end.v, targetPorts)) {
            for (const u of channels) {
                candidates.push([
                    { u: start.u, v: vSource },
                    { u, v: vSource },
                    { u, v: vTarget },
                    { u: end.u, v: vTarget },
                ]);
            }
        }
    }
    return candidates;
}
function channelCoordinates(context) {
    const { original, route, geometry } = context;
    const start = original[0];
    const end = original[original.length - 1];
    const channels = [...original.map(({ u }) => u), (start.u + end.u) / 2];
    const sourceSign = Math.sign(original[1].u - start.u);
    const targetSign = Math.sign(original[original.length - 2].u - end.u);
    const sourceMinimum = context.edge.sourceArrow ? ARROW_STUB : SOURCE_STUB;
    if (sourceSign)
        channels.push(start.u + sourceSign * sourceMinimum);
    if (targetSign)
        channels.push(end.u + targetSign * ARROW_STUB);
    for (const source of geometry.groups) {
        if (!source.members.has(route.sourceId))
            continue;
        for (const target of geometry.groups) {
            if (!target.members.has(route.targetId) || source === target)
                continue;
            const low = Math.min(source.box.u1, target.box.u1);
            const high = Math.max(source.box.u0, target.box.u0);
            if (low >= high)
                continue;
            // Keep alternative lanes inside the gap when its midpoint is occupied.
            channels.push((low + high) / 2, low + (high - low) / 4, high - (high - low) / 4);
        }
    }
    return unique(channels);
}
function reversalCandidates(points) {
    const candidates = [];
    // Test both axes: even a horizontal flow can contain a vertical U-turn.
    for (let index = 0; index + 3 < points.length; index++) {
        const [a, b, c, d] = points.slice(index, index + 4);
        const reversesU = (b.u - a.u) * (d.u - c.u) < -EPSILON;
        const reversesV = (b.v - a.v) * (d.v - c.v) < -EPSILON;
        if (!reversesU && !reversesV)
            continue;
        candidates.push([...points.slice(0, index + 1), { u: a.u, v: d.v }, ...points.slice(index + 3)], [...points.slice(0, index + 1), { u: d.u, v: a.v }, ...points.slice(index + 3)]);
    }
    return candidates;
}
/** A Z has two turns and its outer segments travel in the same direction. */
function smallOffsetIndices(points) {
    const indices = [];
    for (let index = 0; index + 3 < points.length; index++) {
        const [a, b, c, d] = points.slice(index, index + 4);
        const sameDirection = (b.u - a.u) * (d.u - c.u) > EPSILON
            || (b.v - a.v) * (d.v - c.v) > EPSILON;
        if (sameDirection && distance(b, c) < MIN_OFFSET - EPSILON)
            indices.push(index);
    }
    return indices;
}
function smallOffsetCandidates(context) {
    const { original, geometry } = context;
    const candidates = [];
    for (const index of smallOffsetIndices(original)) {
        const [a, , , d] = original.slice(index, index + 4);
        const coordinate = near(a.v, original[index + 1].v) ? 'v' : 'u';
        const first = a[coordinate];
        const last = d[coordinate];
        const values = [first, last, (first + last) / 2,
            first - MIN_OFFSET, first + MIN_OFFSET, last - MIN_OFFSET, last + MIN_OFFSET];
        const choices = (source) => {
            const terminal = source ? index === 0 : index + 3 === original.length - 1;
            if (!terminal)
                return unique(values);
            const box = source ? context.source : context.target;
            const ports = source ? context.sourcePorts : context.targetPorts;
            const [low, high] = portRange(coordinate === 'v' ? box : {
                u0: box.v0, u1: box.v1, v0: box.u0, v1: box.u1,
            });
            return unique([
                ...values.map((value) => clamp(value, low, high)),
                ...portValues(low, high, source ? first : last, ports.map((point) => ({ u: 0, v: point[coordinate] }))),
            ]);
        };
        // Move either or both adjoining segments. Interior segment moves preserve
        // their perpendicular neighbours; terminal moves slide along the same side.
        for (const start of choices(true)) {
            for (const end of choices(false)) {
                if (!near(start, end) && Math.abs(start - end) < MIN_OFFSET - EPSILON)
                    continue;
                const points = original.map((point) => ({ ...point }));
                points[index][coordinate] = points[index + 1][coordinate] = start;
                points[index + 2][coordinate] = points[index + 3][coordinate] = end;
                if (points.some(({ u, v }) => u < 0 || v < 0 || u > geometry.maxU || v > geometry.maxV))
                    continue;
                candidates.push(points);
            }
        }
    }
    return candidates;
}
function reversalCount(points) {
    let count = 0;
    for (let index = 0; index + 3 < points.length; index++) {
        const [a, b, c, d] = points.slice(index, index + 4);
        if ((b.u - a.u) * (d.u - c.u) < -EPSILON
            || (b.v - a.v) * (d.v - c.v) < -EPSILON)
            count++;
    }
    return count;
}
function endpointChannelCandidates(context) {
    const { original, edge } = context;
    if (original.length < 4)
        return [];
    const moveChannel = (points, fromSource, minimum) => {
        const copy = points.map((point) => ({ ...point }));
        if (!fromSource)
            copy.reverse();
        const coordinate = near(copy[0].v, copy[1].v) ? 'u' : 'v';
        const sign = Math.sign(copy[1][coordinate] - copy[0][coordinate]);
        const channel = copy[0][coordinate] + sign * minimum;
        copy[1][coordinate] = channel;
        copy[2][coordinate] = channel;
        if (!fromSource)
            copy.reverse();
        return copy;
    };
    const source = moveChannel(original, true, edge.sourceArrow ? ARROW_STUB : SOURCE_STUB);
    const target = moveChannel(original, false, edge.arrow ? ARROW_STUB : SOURCE_STUB);
    const both = moveChannel(source, false, edge.arrow ? ARROW_STUB : SOURCE_STUB);
    return [source, target, both];
}
function portRange(box) {
    const margin = Math.min(12, (box.v1 - box.v0) / 4);
    return [box.v0 + margin, box.v1 - margin];
}
function portValues(low, high, preferred, occupied) {
    const values = [clamp(preferred, low, high), low, high, (low + high) / 2];
    for (const point of occupied) {
        values.push(point.v - PORT_GAP, point.v + PORT_GAP);
    }
    return unique(values.filter((value) => value >= low && value <= high));
}
function routeQuality(context, points) {
    const parts = segments(points);
    let endpointViolations = shortEndpointCount(context.edge, points);
    let crossings = 0;
    for (const other of context.others) {
        for (const first of parts) {
            for (const second of other.segments) {
                const crossing = intersectionPoint(first, second);
                if (!crossing)
                    continue;
                if (strictlyInside(crossing, first) && strictlyInside(crossing, second))
                    crossings++;
                if (nearEndpoint(crossing, points) || nearEndpoint(crossing, other.points)) {
                    endpointViolations++;
                }
            }
        }
    }
    return {
        endpointViolations,
        smallOffsets: smallOffsetIndices(points).length,
        bends: points.length - 2,
        crossings,
        groupPadding: groupPaddingPenalty(context, parts),
        length: parts.reduce((sum, [a, b]) => sum + distance(a, b), 0),
    };
}
function shortEndpointCount(edge, points) {
    const firstLength = distance(points[0], points[1]);
    const lastLength = distance(points[points.length - 2], points[points.length - 1]);
    const sourceMinimum = edge.sourceArrow ? ARROW_STUB : SOURCE_STUB;
    let count = firstLength < sourceMinimum - EPSILON ? 1 : 0;
    if (edge.arrow && lastLength < ARROW_STUB - EPSILON)
        count++;
    return count;
}
function nearEndpoint(point, points) {
    return distance(point, points[0]) < ENDPOINT_CLEARANCE - EPSILON
        || distance(point, points[points.length - 1]) < ENDPOINT_CLEARANCE - EPSILON;
}
function groupPaddingPenalty(context, parts) {
    let penalty = 0;
    for (const { box, contentBox, members } of context.geometry.groups) {
        // Common ancestors are not a boundary crossed by this edge.
        if (members.has(context.route.sourceId) === members.has(context.route.targetId))
            continue;
        for (const [a, b] of parts) {
            if (!near(a.u, b.u))
                continue;
            const inPadding = a.u > box.u0 && a.u < box.u1
                && (a.u < contentBox.u0 || a.u > contentBox.u1);
            if (inPadding && overlap(a.v, b.v, box.v0, box.v1) > EPSILON)
                penalty++;
        }
    }
    return penalty;
}
function qualityKey(quality) {
    return [
        quality.endpointViolations + quality.smallOffsets,
        quality.bends,
        quality.crossings,
        quality.groupPadding,
        quality.length,
    ];
}
function compareQuality(first, second) {
    const firstKey = qualityKey(first);
    const secondKey = qualityKey(second);
    for (let index = 0; index < firstKey.length; index++) {
        const difference = firstKey[index] - secondKey[index];
        if (difference)
            return difference;
    }
    return 0;
}
function improvesQuality(candidate, original) {
    if (candidate.crossings > original.crossings)
        return false;
    const violations = candidate.endpointViolations + candidate.smallOffsets;
    const previous = original.endpointViolations + original.smallOffsets;
    return violations < previous || (violations === previous && candidate.bends < original.bends);
}
function isCandidateSafe(context, points) {
    const { geometry, route } = context;
    const start = points[0];
    const end = points[points.length - 1];
    const sourceSide = terminalSide(geometry.axis, start, context.source);
    const targetSide = terminalSide(geometry.axis, end, context.target);
    if (sourceSide !== route.sourceSide || targetSide !== route.targetSide)
        return false;
    const originalLength = routeLength(geometry.originals.get(route.id) ?? context.original);
    if (routeLength(points) > Math.max(originalLength * 1.25, originalLength + 48) + EPSILON)
        return false;
    if (!pointsOutward(geometry.axis, start, points[1], sourceSide))
        return false;
    if (!pointsOutward(geometry.axis, end, points[points.length - 2], targetSide))
        return false;
    const sourcePorts = occupiedPorts(context.others, route.sourceId, sourceSide);
    const targetPorts = occupiedPorts(context.others, route.targetId, targetSide);
    if (points.some(({ u, v }) => u < 0 || v < 0 || u > geometry.maxU || v > geometry.maxV))
        return false;
    if (sourcePorts.some((point) => distance(point, start) < PORT_GAP - EPSILON))
        return false;
    if (targetPorts.some((point) => distance(point, end) < PORT_GAP - EPSILON))
        return false;
    // Keep the ELK route when no candidate clears every endpoint zone. Checking
    // both routes also protects arrows on already accepted neighbouring edges.
    if (routeQuality(context, points).endpointViolations > 0)
        return false;
    for (const [index, segment] of segments(points).entries()) {
        if (!near(segment[0].u, segment[1].u) && !near(segment[0].v, segment[1].v))
            return false;
        for (const [id, box] of geometry.nodes) {
            if (id === route.sourceId && index === 0)
                continue;
            if (id === route.targetId && index === points.length - 2)
                continue;
            // Match the validator's node clearance.
            if (hitsBox(segment, expand(box, 8)))
                return false;
        }
        for (const { box, titleBox, members } of geometry.groups) {
            if (hitsBox(segment, titleBox))
                return false;
            if (members.has(route.sourceId) || members.has(route.targetId))
                continue;
            if (hitsBox(segment, box))
                return false;
        }
        if (context.others.some((other) => other.segments.some((part) => parallelOverlap(segment, part)))) {
            return false;
        }
    }
    return true;
}
function terminalSide(axis, point, box) {
    if (point.u < box.u0 - EPSILON || point.u > box.u1 + EPSILON
        || point.v < box.v0 - EPSILON || point.v > box.v1 + EPSILON)
        return undefined;
    if (near(point.u, box.u0))
        return axis.horizontal ? 'left' : 'top';
    if (near(point.u, box.u1))
        return axis.horizontal ? 'right' : 'bottom';
    if (near(point.v, box.v0))
        return axis.horizontal ? 'top' : 'left';
    if (near(point.v, box.v1))
        return axis.horizontal ? 'bottom' : 'right';
    return undefined;
}
function pointsOutward(axis, start, next, side) {
    const a = axis.fromAxis(start);
    const b = axis.fromAxis(next);
    switch (side) {
        case 'left': return b.x < a.x && near(b.y, a.y);
        case 'right': return b.x > a.x && near(b.y, a.y);
        case 'top': return b.y < a.y && near(b.x, a.x);
        case 'bottom': return b.y > a.y && near(b.x, a.x);
        default: return false;
    }
}
function positionLabel(context, points) {
    const mainSegments = segments(points).filter(([a, b]) => near(a.v, b.v));
    mainSegments.sort(([a, b], [c, d]) => Math.abs(d.u - c.u) - Math.abs(b.u - a.u));
    const longest = mainSegments[0];
    if (!longest)
        return undefined;
    const [a, b] = longest;
    const point = context.geometry.axis.fromAxis({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });
    const box = labelBox(context.geometry, context.edge, point);
    for (const node of context.geometry.nodes.values()) {
        if (boxesOverlap(box, expand(node, 6)))
            return undefined;
    }
    for (const { route } of context.others) {
        const edge = context.geometry.edges.get(route.id);
        if (!edge?.label || !route.labelPosition)
            continue;
        const other = labelBox(context.geometry, edge, route.labelPosition);
        if (boxesOverlap(box, expand(other, 6)))
            return undefined;
    }
    return point;
}
function labelBox(geometry, edge, point) {
    const metrics = measureDiagramEdgeLabel(edge.label, edge.bareLabel);
    return geometry.axis.boxAt(geometry.axis.toAxis(point), metrics.width, metrics.height);
}
function layoutErrors(document, layout) {
    const diagnostics = validateBoardLayout(applyBoardLayout(document, layout), { requireEdgeRoutes: true });
    const errors = diagnostics.filter(({ severity }) => severity === 'error');
    return new Set(errors.map(({ code, edgeIds, nodeIds }) => JSON.stringify([
        code,
        edgeIds?.slice().sort(),
        nodeIds?.slice().sort(),
    ])));
}
function normalize(points) {
    const result = [];
    for (const point of points) {
        if (result.length && equalPoints(result[result.length - 1], point))
            continue;
        while (result.length >= 2) {
            const a = result[result.length - 2];
            const b = result[result.length - 1];
            const sameU = near(a.u, b.u) && near(b.u, point.u);
            const sameV = near(a.v, b.v) && near(b.v, point.v);
            if (!sameU && !sameV)
                break;
            result.pop();
        }
        if (!result.length || !equalPoints(result[result.length - 1], point))
            result.push(point);
    }
    return result;
}
function hitsBox([a, b], box) {
    if (near(a.v, b.v)) {
        return a.v >= box.v0 - EPSILON && a.v <= box.v1 + EPSILON
            && overlap(a.u, b.u, box.u0, box.u1) >= -EPSILON;
    }
    return a.u >= box.u0 - EPSILON && a.u <= box.u1 + EPSILON
        && overlap(a.v, b.v, box.v0, box.v1) >= -EPSILON;
}
function parallelOverlap([a, b], [c, d]) {
    const horizontal = near(a.v, b.v);
    if (horizontal !== near(c.v, d.v))
        return false;
    if (horizontal) {
        return Math.abs(a.v - c.v) < LANE_GAP - EPSILON
            && overlap(a.u, b.u, c.u, d.u) > EPSILON;
    }
    return Math.abs(a.u - c.u) < LANE_GAP - EPSILON
        && overlap(a.v, b.v, c.v, d.v) > EPSILON;
}
function intersectionPoint(first, second) {
    if (near(first[0].v, first[1].v) === near(second[0].v, second[1].v))
        return undefined;
    const [h, v] = near(first[0].v, first[1].v) ? [first, second] : [second, first];
    const point = { u: v[0].u, v: h[0].v };
    if (point.u < Math.min(h[0].u, h[1].u) - EPSILON)
        return undefined;
    if (point.u > Math.max(h[0].u, h[1].u) + EPSILON)
        return undefined;
    if (point.v < Math.min(v[0].v, v[1].v) - EPSILON)
        return undefined;
    if (point.v > Math.max(v[0].v, v[1].v) + EPSILON)
        return undefined;
    return point;
}
function strictlyInside(point, [a, b]) {
    const coordinate = near(a.v, b.v) ? 'u' : 'v';
    return point[coordinate] > Math.min(a[coordinate], b[coordinate]) + EPSILON
        && point[coordinate] < Math.max(a[coordinate], b[coordinate]) - EPSILON;
}
function segments(points) {
    return points.slice(1).map((end, index) => [points[index], end]);
}
function near(a, b) {
    return Math.abs(a - b) < EPSILON;
}
function equalPoints(a, b) {
    return near(a.u, b.u) && near(a.v, b.v);
}
function distance(a, b) {
    return Math.abs(a.u - b.u) + Math.abs(a.v - b.v);
}
function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}
function unique(values) {
    return [...new Set(values)];
}
function compareIds(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
function overlap(a, b, c, d) {
    return Math.min(Math.max(a, b), Math.max(c, d)) - Math.max(Math.min(a, b), Math.min(c, d));
}
function expand(box, margin) {
    return {
        u0: box.u0 - margin,
        u1: box.u1 + margin,
        v0: box.v0 - margin,
        v1: box.v1 + margin,
    };
}
function boxesOverlap(a, b) {
    return a.u0 < b.u1 && a.u1 > b.u0 && a.v0 < b.v1 && a.v1 > b.v0;
}
function compareRoutes(a, b, geometry) {
    const first = geometry.edges.get(a.id);
    const second = geometry.edges.get(b.id);
    return compareIds(first.sourceId, second.sourceId)
        || compareIds(first.targetId, second.targetId)
        || compareIds(first.label, second.label)
        || compareIds(first.stroke, second.stroke)
        || compareIds(first.role ?? '', second.role ?? '')
        || Number(first.arrow) - Number(second.arrow)
        || Number(Boolean(first.sourceArrow)) - Number(Boolean(second.sourceArrow))
        || compareIds(a.id, b.id);
}
function routeLength(points) {
    return segments(points).reduce((sum, [a, b]) => sum + distance(a, b), 0);
}
//# sourceMappingURL=BoardRouteRefine.js.map