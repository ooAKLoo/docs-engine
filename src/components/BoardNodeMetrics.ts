import type {BoardNodeShape} from './BoardModel.js';
import {measureDiagramTextWidth, wrapDiagramText} from './BoardAutoLayout.js';

export function hasBoardClass(classes: string[], className: string) {
  return classes.some((value) => value.toLowerCase() === className.toLowerCase());
}

export function resolveNodeBadge(classes: string[]) {
  if (hasBoardClass(classes, 'deBoardGateOne')) return '门槛 01';
  if (hasBoardClass(classes, 'deBoardGateTwo')) return '门槛 02';
  return null;
}

export function measureBadgeWidth(value: string) {
  const textWidth = [...value].reduce((width, character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === ' ') return width + 3.8;
    return width + (codePoint > 0xff ? 11 : /[A-Z0-9]/.test(character) ? 6.5 : 5.8);
  }, 0);
  return Math.max(68, Math.ceil(textWidth + 24));
}

/**
 * Deterministic node sizing shared by the renderer and every automatic layout,
 * so authored geometry produced before paint matches the painted card exactly.
 */
export function measureNode(
  label: string,
  shape: BoardNodeShape,
  classes: string[] = [],
  authoredWidth?: number,
) {
  const detailLabel = hasBoardClass(classes, 'deBoardDetail');
  const gate = resolveNodeBadge(classes);
  const wideCard = hasBoardClass(classes, 'deBoardWide');
  const horizontalPadding = detailLabel ? 46 : 38;
  const maximumTextWidth = Math.max(36, Math.min(202, (authoredWidth ?? 240) - horizontalPadding));
  const lines = wrapDiagramText(label, maximumTextWidth);
  const contentWidth = Math.max(
    ...lines.map((line, index) => measureDiagramTextWidth(line) * (detailLabel && index > 0 ? 0.86 : 1)),
    36,
  );
  const minimumWidth = gate ? 204 : wideCard ? 200 : detailLabel ? 150 : shape === 'stadium' ? 92 : 118;
  const baseWidth = Math.max(minimumWidth, Math.min(240, contentWidth + (detailLabel ? 46 : 38)));
  const baseHeight = gate ? 140 : Math.max(detailLabel ? 82 : 54, lines.length * 20 + (detailLabel ? 34 : 24));
  if (shape === 'circle' || shape === 'diamond') {
    if (shape === 'diamond' && gate) return {height: baseHeight, textLines: lines, width: baseWidth};
    const diameter = Math.max(baseWidth, baseHeight + 22);
    return {height: diameter, textLines: lines, width: diameter};
  }
  return {height: baseHeight, textLines: lines, width: baseWidth};
}
