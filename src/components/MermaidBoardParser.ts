export type DiagramDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type DiagramAnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type DiagramNodeShape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond';
export type DiagramNodeTone = 'blue' | 'purple' | 'teal' | 'green' | 'orange' | 'neutral';
export type MermaidBoardKind =
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

export type ParsedDiagramNode = {
  classes: string[];
  id: string;
  label: string;
  placeholder?: boolean;
  shape: DiagramNodeShape;
  tone: DiagramNodeTone;
};

export type ParsedDiagramEdge = {
  arrow: boolean;
  bareLabel?: boolean;
  id: string;
  label: string;
  labelAlign?: 'start' | 'middle' | 'end';
  sourceSide?: DiagramAnchorSide;
  sourceId: string;
  stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
  targetSide?: DiagramAnchorSide;
  targetId: string;
};

export type ParsedDiagramGraph = {
  direction: DiagramDirection;
  edges: ParsedDiagramEdge[];
  kind: MermaidBoardKind;
  nodes: ParsedDiagramNode[];
};

type Relation = {from: string; label?: string; to: string};
type Entity = {fields: string[]; name: string};

const diagramTones: DiagramNodeTone[] = ['blue', 'teal', 'purple', 'orange', 'green', 'neutral'];

export async function parseMermaidBoard(source: string): Promise<ParsedDiagramGraph> {
  const kind = diagramKind(source);
  if (kind === 'flowchart') return parseFlowchart(source);
  if (kind === 'sequence') return parseSequence(source);
  if (kind === 'state') return parseState(source);
  if (kind === 'class' || kind === 'er') return parseEntities(kind, source);
  if (kind === 'gantt') return parseGantt(source);
  if (kind === 'git') return parseGitGraph(source);
  if (kind === 'timeline') return parseTimeline(source);
  if (kind === 'mindmap') return parseMindmap(source);
  if (kind === 'pie') return parsePie(source);
  throw new Error('当前 Mermaid 语法尚未接入统一 Board');
}

export function diagramKind(source: string): MermaidBoardKind | 'unsupported' {
  const first = sourceLines(source)[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('flowchart') || first.startsWith('graph')) return 'flowchart';
  if (first.startsWith('sequencediagram')) return 'sequence';
  if (first.startsWith('statediagram')) return 'state';
  if (first.startsWith('classdiagram')) return 'class';
  if (first.startsWith('erdiagram')) return 'er';
  if (first.startsWith('gantt')) return 'gantt';
  if (first.startsWith('gitgraph')) return 'git';
  if (first.startsWith('timeline')) return 'timeline';
  if (first.startsWith('mindmap')) return 'mindmap';
  if (first.startsWith('pie')) return 'pie';
  return 'unsupported';
}

function parseFlowchart(source: string): ParsedDiagramGraph {
  const lines = sourceLines(source).map((line) => line.trim());
  const header = lines.shift()?.match(/^(?:flowchart|graph)\s+(LR|RL|TB|TD|BT)\b/iu);
  if (!header) throw new Error('无法识别 flowchart 方向');
  const nodes = new Map<string, ParsedDiagramNode>();
  const edges: ParsedDiagramEdge[] = [];
  const classes = new Map<string, string[]>();

  const ensureNode = (token: string) => {
    const parsed = parseFlowNode(token);
    const previous = nodes.get(parsed.id);
    const nodeClasses = classes.get(parsed.id) ?? previous?.classes ?? [];
    const next = previous && token.trim() === parsed.id
      ? {...previous, classes: nodeClasses, tone: resolveTone(nodeClasses)}
      : {...previous, ...parsed, classes: nodeClasses, tone: resolveTone(nodeClasses)};
    nodes.set(parsed.id, next);
    return next;
  };

  lines.forEach((line) => {
    if (!line || /^(?:subgraph|end|classDef|linkStyle|style|click|direction)\b/iu.test(line)) return;
    const classAssignment = line.match(/^class\s+(.+?)\s+([\w-]+)$/iu);
    if (classAssignment) {
      classAssignment[1].split(',').map((id) => id.trim()).filter(Boolean).forEach((id) => {
        const nextClasses = [...(classes.get(id) ?? []), classAssignment[2]];
        classes.set(id, nextClasses);
        const current = nodes.get(id);
        if (current) nodes.set(id, {...current, classes: nextClasses, tone: resolveTone(nextClasses)});
      });
      return;
    }
    const parsedEdges = parseFlowEdges(line);
    if (parsedEdges.length === 0) {
      if (/^[\p{L}\p{N}_:-]+(?:\[|\(|\{|$)/u.test(line)) ensureNode(line);
      return;
    }
    parsedEdges.forEach((parsed) => {
      const sourceNode = ensureNode(parsed.source);
      const targetNode = ensureNode(parsed.target);
      edges.push(createEdge('flow', edges.length, sourceNode.id, targetNode.id, parsed.label, {
        arrow: parsed.arrow,
        stroke: parsed.stroke,
      }));
    });
  });

  classes.forEach((nodeClasses, id) => {
    const current = nodes.get(id);
    if (current) nodes.set(id, {...current, classes: nodeClasses, tone: resolveTone(nodeClasses)});
  });
  if (nodes.size === 0) throw new Error('flowchart 中没有可渲染节点');
  return {
    direction: resolveDirection(header[1]),
    edges,
    kind: 'flowchart',
    nodes: [...nodes.values()],
  };
}

function parseFlowEdges(line: string) {
  const labelled = line.match(/^(.+?)\s+--\s+(.+?)\s+-->\s+(.+)$/u);
  if (labelled) return [{arrow: true, label: labelled[2].trim(), source: labelled[1], stroke: 'normal' as const, target: labelled[3]}];
  const dottedLabelled = line.match(/^(.+?)\s+-\.\s*(.+?)\s*\.->\s+(.+)$/u);
  if (dottedLabelled) return [{arrow: true, label: dottedLabelled[2].trim(), source: dottedLabelled[1], stroke: 'dotted' as const, target: dottedLabelled[3]}];
  const pipeLabelled = line.match(/^(.+?)\s*(-->|-\.->|==>)\s*\|([^|]+)\|\s*(.+)$/u);
  if (pipeLabelled) return [{
    arrow: true,
    label: pipeLabelled[3].trim(),
    source: pipeLabelled[1],
    stroke: connectorStroke(pipeLabelled[2]),
    target: pipeLabelled[4],
  }];
  const parts = line.split(/(-->|-\.->|==>|~~~|---)/u).map((part) => part.trim());
  if (parts.length < 3 || parts.length % 2 === 0) return [];
  const result: Array<{arrow: boolean; label: string; source: string; stroke: ParsedDiagramEdge['stroke']; target: string}> = [];
  for (let index = 0; index < parts.length - 2; index += 2) {
    const connector = parts[index + 1];
    if (!/^(?:-->|-\.->|==>|~~~|---)$/u.test(connector)) return [];
    result.push({
      arrow: connector !== '~~~' && connector !== '---',
      label: '',
      source: parts[index],
      stroke: connectorStroke(connector),
      target: parts[index + 2],
    });
  }
  return result;
}

function parseFlowNode(token: string): Omit<ParsedDiagramNode, 'classes' | 'tone'> {
  const value = token.trim();
  const match = value.match(/^([\p{L}\p{N}_:-]+)(.*)$/u);
  if (!match) return {id: value, label: normalizeLabel(value), shape: 'rect'};
  const [, id, notation] = match;
  const forms: Array<{pattern: RegExp; shape: DiagramNodeShape}> = [
    {pattern: /^\(\((.+)\)\)$/u, shape: 'circle'},
    {pattern: /^\(\[(.+)\]\)$/u, shape: 'stadium'},
    {pattern: /^\[\((.+)\)\]$/u, shape: 'round'},
    {pattern: /^\((.+)\)$/u, shape: 'round'},
    {pattern: /^\{\{(.+)\}\}$/u, shape: 'diamond'},
    {pattern: /^\{(.+)\}$/u, shape: 'diamond'},
    {pattern: /^\[\[(.+)\]\]$/u, shape: 'rect'},
    {pattern: /^\[(.+)\]$/u, shape: 'rect'},
  ];
  for (const form of forms) {
    const label = notation.match(form.pattern)?.[1];
    if (label !== undefined) return {id, label: normalizeLabel(label), shape: form.shape};
  }
  return {id, label: id, shape: 'rect'};
}

function parseSequence(source: string): ParsedDiagramGraph {
  const actors = new Map<string, string>();
  const messages: Array<{arrow: string; from: string; label: string; to: string}> = [];
  sourceLines(source).slice(1).forEach((rawLine) => {
    const line = rawLine.trim();
    const participant = line.match(/^(?:participant|actor)\s+([^\s]+)(?:\s+as\s+(.+))?$/iu);
    if (participant) {
      actors.set(participant[1], participant[2]?.trim() ?? participant[1]);
      return;
    }
    // Keep the actor token lazy. A greedy token would parse `Agent-->>Lula`
    // as the non-existent actor `Agent-` followed by the shorter arrow `->>`.
    const message = line.match(/^([^\s]+?)\s*(--?>>|--?>|--?x)\s*([^\s]+)\s*:\s*(.+)$/u);
    if (!message) return;
    const [, from, arrow, to, label] = message;
    if (!actors.has(from)) actors.set(from, from);
    if (!actors.has(to)) actors.set(to, to);
    messages.push({arrow, from, label: normalizeLabel(label), to});
  });
  const entries = [...actors.entries()];
  if (entries.length === 0) throw new Error('sequenceDiagram 中没有参与者或消息');
  const nodeIds = new Map(entries.map(([id]) => [id, `actor:${id}`]));
  return {
    direction: 'LR',
    edges: messages.map((message, index) => createEdge(
      'sequence',
      index,
      nodeIds.get(message.from)!,
      nodeIds.get(message.to)!,
      `${index + 1}. ${message.label}`,
      {stroke: message.arrow.startsWith('--') ? 'dotted' : 'normal'},
    )),
    kind: 'sequence',
    nodes: entries.map(([id, label], index) => createNode(`actor:${id}`, label, index, 'stadium')),
  };
}

function parseState(source: string): ParsedDiagramGraph {
  const aliases = new Map<string, string>();
  const relations: Relation[] = [];
  sourceLines(source).slice(1).forEach((rawLine) => {
    const line = rawLine.trim();
    const alias = line.match(/^state\s+"(.+)"\s+as\s+([^\s]+)$/iu);
    if (alias) {
      aliases.set(alias[2], alias[1]);
      return;
    }
    const declaration = line.match(/^state\s+([^\s{]+)$/iu);
    if (declaration) aliases.set(declaration[1], declaration[1]);
    const transition = line.match(/^(.+?)\s*-->\s*(.+)$/u);
    if (!transition) return;
    const [target, label] = transition[2].split(/\s*:\s*(.+)/u);
    relations.push({from: transition[1].trim(), to: target.trim(), label: label?.trim()});
  });
  const names = unique([
    ...aliases.keys(),
    ...relations.flatMap((relation) => [relation.from, relation.to]),
  ].filter((name) => name !== '[*]'));
  if (names.length === 0) throw new Error('stateDiagram 中没有状态');
  const nodeIds = new Map(names.map((name) => [name, `state:${name}`]));
  const usesStart = relations.some((relation) => relation.from === '[*]');
  const usesEnd = relations.some((relation) => relation.to === '[*]');
  const nodes = names.map((name, index) => createNode(`state:${name}`, aliases.get(name) ?? name, index, 'round'));
  if (usesStart) nodes.unshift(createNode('state:__start', '开始', nodes.length, 'circle', 'neutral'));
  if (usesEnd) nodes.push(createNode('state:__end', '结束', nodes.length, 'circle', 'neutral'));
  return {
    direction: 'LR',
    edges: relations.map((relation, index) => createEdge(
      'state',
      index,
      relation.from === '[*]' ? 'state:__start' : nodeIds.get(relation.from)!,
      relation.to === '[*]' ? 'state:__end' : nodeIds.get(relation.to)!,
      relation.label ?? '',
    )),
    kind: 'state',
    nodes,
  };
}

function parseEntities(kind: 'class' | 'er', source: string): ParsedDiagramGraph {
  const entities = new Map<string, Entity>();
  const relationLines: string[] = [];
  let current: Entity | null = null;
  sourceLines(source).slice(1).forEach((rawLine) => {
    const line = rawLine.trim();
    const opening = kind === 'class'
      ? line.match(/^class\s+([^\s{]+)\s*\{$/iu)
      : line.match(/^([^\s{]+)\s*\{$/u);
    if (opening) {
      current = {name: opening[1], fields: []};
      entities.set(current.name, current);
      return;
    }
    if (line === '}') {
      current = null;
      return;
    }
    if (current) {
      current.fields.push(line.replace(/^[-+#~]/u, '').trim());
      return;
    }
    const member = kind === 'class' ? line.match(/^([^\s:]+)\s*:\s*(.+)$/u) : null;
    if (member && !/[|o}{.<>*-]{2}/u.test(line)) {
      const entity = entities.get(member[1]) ?? {name: member[1], fields: []};
      entity.fields.push(member[2].replace(/^[-+#~]/u, '').trim());
      entities.set(entity.name, entity);
      return;
    }
    const declaration = kind === 'class' ? line.match(/^class\s+([^\s{]+)$/iu) : null;
    if (declaration) {
      if (!entities.has(declaration[1])) entities.set(declaration[1], {name: declaration[1], fields: []});
      return;
    }
    relationLines.push(line);
  });
  const relations = relationLines.map((line) => parseRelation(line, [...entities.keys()])).filter((value): value is Relation => value !== null);
  relations.flatMap((relation) => [relation.from, relation.to]).forEach((name) => {
    if (!entities.has(name)) entities.set(name, {name, fields: []});
  });
  const entries = [...entities.values()];
  if (entries.length === 0) throw new Error(`${kind === 'class' ? 'classDiagram' : 'erDiagram'} 中没有实体`);
  const nodeIds = new Map(entries.map((entity) => [entity.name, `entity:${entity.name}`]));
  return {
    direction: 'LR',
    edges: relations.map((relation, index) => createEdge('entity', index, nodeIds.get(relation.from)!, nodeIds.get(relation.to)!, relation.label ?? '')),
    kind,
    nodes: entries.map((entity, index) => ({
      ...createNode(`entity:${entity.name}`, [entity.name, ...entity.fields].join('\n'), index, 'rect'),
      classes: entity.fields.length > 0 ? ['deBoardDetail', 'deBoardWide'] : [],
    })),
  };
}

function parseRelation(line: string, knownNames: string[]): Relation | null {
  const matchedNames = knownNames
    .map((name) => ({index: line.search(new RegExp(`(^|\\s)${escapeRegExp(name)}(?=\\s|$)`, 'u')), name}))
    .filter((entry) => entry.index >= 0)
    .sort((first, second) => first.index - second.index);
  if (matchedNames.length >= 2) {
    return {from: matchedNames[0].name, to: matchedNames.at(-1)!.name, label: relationLabel(line)};
  }
  const relation = line.match(/^([^\s]+)\s+[|o}{.<>*+\-]+\s+([^\s]+)(?:\s*:\s*(.+))?$/u);
  return relation ? {from: relation[1], to: relation[2], label: relation[3]?.trim()} : null;
}

function parseGantt(source: string): ParsedDiagramGraph {
  const tasks: Array<{after?: string; date?: string; duration?: string; label: string; sourceId?: string; status: string}> = [];
  let section = '';
  sourceLines(source).slice(1).forEach((rawLine) => {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^section\s+(.+)$/iu);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      return;
    }
    if (!line.includes(':') || /^(?:title|dateFormat|axisFormat|excludes|todayMarker)\b/iu.test(line)) return;
    const [label, metadata = ''] = line.split(/:(.+)/u).map((part) => part.trim());
    const parts = metadata.split(',').map((part) => part.trim()).filter(Boolean);
    const sourceId = parts.find((part) => /^[A-Za-z_][\w-]*$/u.test(part) && !/^(?:done|active|crit|milestone)$/iu.test(part));
    tasks.push({
      after: metadata.match(/\bafter\s+([\w-]+)/iu)?.[1],
      date: metadata.match(/\d{4}-\d{2}-\d{2}/u)?.[0],
      duration: metadata.match(/\b\d+(?:\.\d+)?[dhw]\b/iu)?.[0],
      label: section ? `${section} · ${label}` : label,
      sourceId,
      status: metadata,
    });
  });
  if (tasks.length === 0) throw new Error('gantt 中没有任务');
  const nodeIds = tasks.map((task, index) => `task:${task.sourceId ?? index}`);
  const sourceIds = new Map(tasks.map((task, index) => [task.sourceId, nodeIds[index]]).filter((entry): entry is [string, string] => entry[0] !== undefined));
  const nodes = tasks.map((task, index) => createNode(
    nodeIds[index],
    [task.label, [task.date, task.duration].filter(Boolean).join(' · ')].filter(Boolean).join('\n'),
    index,
    'round',
    task.status.includes('done') ? 'green' : task.status.includes('crit') ? 'orange' : task.status.includes('active') ? 'blue' : undefined,
  ));
  return {
    direction: 'LR',
    edges: tasks.slice(1).map((task, index) => createEdge(
      'gantt',
      index,
      task.after && sourceIds.has(task.after) ? sourceIds.get(task.after)! : nodeIds[index],
      nodeIds[index + 1],
      task.after ? '依赖' : '',
    )),
    kind: 'gantt',
    nodes,
  };
}

function parseGitGraph(source: string): ParsedDiagramGraph {
  const configuredMain = source.match(/mainBranchName['"]?\s*:\s*['"]([^'"]+)['"]/u)?.[1];
  let currentBranch = configuredMain ?? 'main';
  const branchHeads = new Map<string, string | undefined>([[currentBranch, undefined]]);
  const branchTones = new Map<string, DiagramNodeTone>([[currentBranch, 'blue']]);
  const commits = new Map<string, string>();
  const nodes: ParsedDiagramNode[] = [];
  const edges: ParsedDiagramEdge[] = [];

  const toneForBranch = (branch: string) => {
    const existing = branchTones.get(branch);
    if (existing) return existing;
    const tone = diagramTones[branchTones.size % Math.max(1, diagramTones.length - 1)];
    branchTones.set(branch, tone);
    return tone;
  };
  const appendCommit = (label: string, sourceCommit?: string, stroke: ParsedDiagramEdge['stroke'] = 'normal') => {
    const id = `git:commit:${nodes.length}`;
    const previousHead = branchHeads.get(currentBranch);
    nodes.push(createNode(id, `${label}\n${currentBranch}`, nodes.length, 'round', toneForBranch(currentBranch)));
    if (previousHead) edges.push(createEdge('git', edges.length, previousHead, id, '', {stroke}));
    if (sourceCommit && sourceCommit !== previousHead) {
      edges.push(createEdge('git-source', edges.length, sourceCommit, id, 'cherry-pick', {stroke: 'dotted'}));
    }
    branchHeads.set(currentBranch, id);
    commits.set(label, id);
    return id;
  };

  sourceLines(source).slice(1).forEach((rawLine) => {
    const line = rawLine.trim();
    const branch = line.match(/^branch\s+(.+?)(?:\s+order:\s*\d+)?$/iu);
    if (branch) {
      const name = stripQuotes(branch[1].trim());
      branchHeads.set(name, branchHeads.get(currentBranch));
      toneForBranch(name);
      currentBranch = name;
      return;
    }
    const checkout = line.match(/^(?:checkout|switch)\s+(.+)$/iu);
    if (checkout) {
      currentBranch = stripQuotes(checkout[1].trim());
      if (!branchHeads.has(currentBranch)) branchHeads.set(currentBranch, undefined);
      toneForBranch(currentBranch);
      return;
    }
    if (/^commit\b/iu.test(line)) {
      appendCommit(readGitOption(line, 'id') ?? `Commit ${nodes.length + 1}`);
      return;
    }
    const merge = line.match(/^merge\s+([^\s]+)(.*)$/iu);
    if (merge) {
      const sourceBranch = stripQuotes(merge[1]);
      const mergeId = readGitOption(merge[2], 'id') ?? `合并 ${sourceBranch}`;
      const previousHead = branchHeads.get(currentBranch);
      const sourceHead = branchHeads.get(sourceBranch);
      const id = appendCommit(mergeId);
      if (sourceHead && sourceHead !== previousHead) {
        edges.push(createEdge('git-merge', edges.length, sourceHead, id, `合并 ${sourceBranch}`));
      }
      return;
    }
    if (/^cherry-pick\b/iu.test(line)) {
      const pickedId = readGitOption(line, 'id') ?? 'cherry-pick';
      appendCommit(pickedId, commits.get(pickedId), 'normal');
    }
  });

  if (nodes.length === 0) throw new Error('gitGraph 中没有提交');
  return {direction: 'LR', edges, kind: 'git', nodes};
}

function parseTimeline(source: string): ParsedDiagramGraph {
  const events: Array<{date: string; text: string}> = [];
  let currentDate = '';
  sourceLines(source).slice(1).forEach((rawLine) => {
    const line = rawLine.trim();
    if (/^title\s+/iu.test(line) || !line.includes(':')) return;
    const [date, text = ''] = line.split(/:(.+)/u);
    if (date.trim()) currentDate = date.trim();
    if (text.trim()) events.push({date: currentDate, text: text.trim()});
  });
  if (events.length === 0) throw new Error('timeline 中没有事件');
  const nodeIds = events.map((_, index) => `event:${index}`);
  return {
    direction: 'LR',
    edges: nodeIds.slice(1).map((nodeId, index) => createEdge('timeline', index, nodeIds[index], nodeId, '')),
    kind: 'timeline',
    nodes: events.map((event, index) => createNode(nodeIds[index], `${event.date}\n${event.text}`, index, 'round')),
  };
}

function parseMindmap(source: string): ParsedDiagramGraph {
  const entries = sourceLines(source).slice(1).map((rawLine) => ({
    indent: rawLine.match(/^\s*/u)?.[0].length ?? 0,
    label: mindmapLabel(rawLine.trim()),
  })).filter((entry) => entry.label);
  if (entries.length === 0) throw new Error('mindmap 中没有节点');
  const nodes: ParsedDiagramNode[] = [];
  const edges: ParsedDiagramEdge[] = [];
  const stack: Array<{id: string; indent: number}> = [];
  entries.forEach((entry, index) => {
    const id = `mind:${index}`;
    while (stack.length > 0 && stack.at(-1)!.indent >= entry.indent) stack.pop();
    nodes.push(createNode(id, entry.label, index, index === 0 ? 'stadium' : 'round'));
    const parent = stack.at(-1);
    if (parent) edges.push(createEdge('mindmap', edges.length, parent.id, id, ''));
    stack.push({id, indent: entry.indent});
  });
  return {direction: 'LR', edges, kind: 'mindmap', nodes};
}

function parsePie(source: string): ParsedDiagramGraph {
  const lines = sourceLines(source).slice(1);
  const title = lines.find((line) => /^title\s+/iu.test(line.trim()))?.trim().replace(/^title\s+/iu, '') ?? '占比';
  const values = lines.filter((line) => line.includes(':') && !/^title\s+/iu.test(line.trim())).map((line) => {
    const [label, amount = '0'] = line.trim().split(/:(.+)/u);
    return {label: label.replace(/^"|"$/gu, '').trim(), value: Number(amount.trim()) || 0};
  });
  if (values.length === 0) throw new Error('pie 中没有分类数据');
  const total = values.reduce((sum, item) => sum + item.value, 0) || 1;
  const nodes = [createNode('pie:root', title, 0, 'circle', 'neutral')];
  const edges: ParsedDiagramEdge[] = [];
  values.forEach((item, index) => {
    const id = `pie:${index}`;
    const percent = `${Math.round((item.value / total) * 100)}%`;
    nodes.push(createNode(id, `${item.label}\n${item.value}`, index + 1, 'round'));
    edges.push(createEdge('pie', index, 'pie:root', id, percent));
  });
  return {direction: 'LR', edges, kind: 'pie', nodes};
}

function createNode(
  id: string,
  label: string,
  index: number,
  shape: DiagramNodeShape,
  tone?: DiagramNodeTone,
): ParsedDiagramNode {
  return {classes: [], id, label: normalizeLabel(label), shape, tone: tone ?? diagramTones[index % diagramTones.length]};
}

function createEdge(
  prefix: string,
  index: number,
  sourceId: string,
  targetId: string,
  label: string,
  options: {arrow?: boolean; stroke?: ParsedDiagramEdge['stroke']} = {},
): ParsedDiagramEdge {
  return {
    arrow: options.arrow ?? true,
    id: `${prefix}:${index}:${sourceId}:${targetId}`,
    label: normalizeLabel(label),
    sourceId,
    stroke: options.stroke ?? 'normal',
    targetId,
  };
}

function connectorStroke(value: string): ParsedDiagramEdge['stroke'] {
  if (value === '-.->') return 'dotted';
  if (value === '==>') return 'thick';
  if (value === '~~~') return 'invisible';
  return 'normal';
}

function sourceLines(source: string) {
  return source.split(/\r?\n/u)
    .map((line) => line.replace(/%%.*$/u, '').trimEnd())
    .filter((line) => line.trim());
}

function normalizeLabel(value: string) {
  return value.replace(/<br\s*\/?\s*>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/^(["'])(.*)\1$/su, '$2')
    .trim();
}

function resolveDirection(value: string | undefined): DiagramDirection {
  const normalized = value?.toUpperCase();
  if (normalized === 'RL' || normalized === 'TB' || normalized === 'BT') return normalized;
  if (normalized === 'TD') return 'TB';
  return 'LR';
}

function resolveTone(classes: string[]): DiagramNodeTone {
  const value = classes.join(' ').toLowerCase();
  if (value.includes('purple')) return 'purple';
  if (value.includes('teal')) return 'teal';
  if (value.includes('green')) return 'green';
  if (value.includes('orange')) return 'orange';
  if (value.includes('neutral')) return 'neutral';
  return 'blue';
}

function relationLabel(line: string) {
  return line.includes(':') ? line.split(':').slice(1).join(':').trim() : undefined;
}

function mindmapLabel(value: string) {
  let label = value.replace(/^root\s*/iu, '').trim();
  label = label.replace(/^[\p{L}\p{N}_-]+(?=[([{])/u, '');
  const wrappers: Array<[string, string]> = [['((', '))'], ['{{', '}}'], ['[[', ']]'], ['(', ')'], ['[', ']'], ['{', '}']];
  for (const [start, end] of wrappers) {
    if (label.startsWith(start) && label.endsWith(end)) {
      label = label.slice(start.length, -end.length);
      break;
    }
  }
  return normalizeLabel(label);
}

function readGitOption(value: string, name: string) {
  const match = value.match(new RegExp(`\\b${name}\\s*:\\s*(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'iu'));
  return match?.slice(1).find(Boolean);
}

function stripQuotes(value: string) {
  return value.replace(/^(["'])(.*)\1$/su, '$2');
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
