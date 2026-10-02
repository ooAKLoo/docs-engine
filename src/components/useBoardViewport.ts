import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import {
  advanceBoardViewport,
  boardViewportHasSettled,
  dampBoardViewport,
  type BoardViewport,
  type BoardViewportUpdate,
} from './BoardViewport.js';

const GESTURE_IDLE_MS = 120;
const MAX_WHEEL_ANIMATION_MS = 160;

/** Keep high-frequency viewport work outside React, including the grid. */
export function useBoardViewport(
  stageRef: RefObject<HTMLDivElement>,
  canvasRef: RefObject<HTMLDivElement>,
  active: boolean,
  reducedMotion: boolean | null,
  grid = false,
) {
  const target = useRef<BoardViewport>({x: 0, y: 0, scale: 1});
  const displayed = useRef(target.current);
  const [viewport, setViewport] = useState(target.current);
  const frame = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smooth = useRef(false);
  const previousTime = useRef<number | null>(null);
  const lastInputTime = useRef(0);

  const paint = useCallback((next: BoardViewport) => {
    displayed.current = next;
    if (stageRef.current) {
      // Retain a 2D transform so releasing will-change permits crisp SVG paint.
      stageRef.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
    }
    if (grid && canvasRef.current) {
      canvasRef.current.style.setProperty('--de-diagram-grid-size', `${22 * next.scale}px`);
      canvasRef.current.style.setProperty('--de-diagram-grid-x', `${next.x}px`);
      canvasRef.current.style.setProperty('--de-diagram-grid-y', `${next.y}px`);
    }
  }, [canvasRef, grid, stageRef]);

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    frame.current = null;
    idleTimer.current = null;
    previousTime.current = null;
    if (stageRef.current) stageRef.current.style.willChange = '';
  }, [stageRef]);

  const update = useCallback((value: BoardViewportUpdate) => {
    cancel();
    const next = advanceBoardViewport(target, value);
    // Resets must paint even when React's last committed value was identical.
    paint(next);
    setViewport(next);
  }, [cancel, paint]);

  const enqueue = useCallback((value: BoardViewportUpdate, animate: boolean) => {
    advanceBoardViewport(target, value);
    smooth.current = animate && !reducedMotion;
    lastInputTime.current = performance.now();
    if (stageRef.current && stageRef.current.style.willChange !== 'transform') {
      stageRef.current.style.willChange = 'transform';
    }
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    const finish = () => {
      // A discrete wheel animation may still be completing after input stops.
      if (frame.current !== null) {
        idleTimer.current = setTimeout(finish, 16);
        return;
      }
      idleTimer.current = null;
      if (stageRef.current) stageRef.current.style.willChange = '';
      setViewport(displayed.current);
    };
    idleTimer.current = setTimeout(finish, GESTURE_IDLE_MS);
    if (frame.current !== null) return;
    const tick = (now: number) => {
      frame.current = null;
      const next = smooth.current
        ? dampBoardViewport(displayed.current, target.current,
          previousTime.current === null ? 16 : now - previousTime.current)
        : target.current;
      previousTime.current = now;
      if (!smooth.current || now - lastInputTime.current >= MAX_WHEEL_ANIMATION_MS ||
          boardViewportHasSettled(next, target.current)) {
        paint(target.current);
        previousTime.current = null;
        return;
      }
      paint(next);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint, reducedMotion, stageRef]);

  const queue = useCallback((value: BoardViewportUpdate) => enqueue(value, false), [enqueue]);
  const damp = useCallback((value: BoardViewportUpdate) => enqueue(value, true), [enqueue]);

  useEffect(() => {
    // Opening/closing the viewer also ends any gesture on the previous surface.
    if (!active) update(target.current);
    return cancel;
  }, [active, cancel, update]);

  return {viewport, target, displayed, update, queue, damp};
}
