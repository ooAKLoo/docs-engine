const DEFAULT_VIEWPORT_RESPONSE_MS = 32;
// Native trackpad pinch emits small ctrl+pixel deltas: -100px maps to exp(1).
// Mouse modifier-wheel keeps the previous, gentler notch gain.
export const BOARD_PINCH_ZOOM_SENSITIVITY = 0.01;
export const BOARD_WHEEL_ZOOM_SENSITIVITY = 0.0018;
/**
 * WheelEvent has no device identifier. Small/fractional pixel deltas are the
 * first-event signal; <=40ms cadence and a 160ms latch also cover fast swipes
 * and momentum with larger deltas. Line/page units always mean discrete input.
 * ctrlKey alone cannot identify pinch: Ctrl+mouse-wheel uses it too.
 */
export function isContinuousBoardWheel(event, stream) {
    const gap = event.timeStamp - stream.lastTime;
    const magnitude = Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY));
    const continuous = event.deltaMode === 0 && (magnitude <= 40 ||
        (magnitude < 80 && (!Number.isInteger(event.deltaX) || !Number.isInteger(event.deltaY))) ||
        (gap >= 0 && (gap <= 40 || (stream.continuous && gap <= 160))));
    stream.lastTime = event.timeStamp;
    stream.continuous = continuous;
    return continuous;
}
export function boardWheelZoomFactor(delta, pinch) {
    const distance = pinch ? delta : Math.max(-120, Math.min(120, delta));
    return Math.exp(-distance * (pinch ? BOARD_PINCH_ZOOM_SENSITIVITY : BOARD_WHEEL_ZOOM_SENSITIVITY));
}
/**
 * Resolve and publish a viewport update synchronously.
 *
 * Wheel and pointer streams can dispatch several events before React commits
 * state. Keeping the interaction ref current here prevents later events from
 * reading stale scale or position values and dropping part of the gesture.
 */
export function advanceBoardViewport(viewportRef, update) {
    const next = typeof update === 'function'
        ? update(viewportRef.current)
        : update;
    viewportRef.current = next;
    return next;
}
/**
 * WheelEvent deltas may be expressed in pixels, text lines or pages depending
 * on the input device and browser. Convert them to pixels before panning or
 * applying the exponential zoom curve.
 */
export function normalizeBoardWheelDelta(delta, deltaMode, pageSize) {
    if (deltaMode === 1)
        return delta * 16;
    if (deltaMode === 2)
        return delta * Math.max(1, pageSize);
    return delta;
}
/**
 * Move the displayed viewport toward its latest interaction target with a
 * frame-rate-independent exponential response for discrete wheel input. The curve
 * never overshoots and does not restart when more wheel events arrive.
 */
export function dampBoardViewport(current, target, elapsedMs, responseMs = DEFAULT_VIEWPORT_RESPONSE_MS) {
    const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / Math.max(1, responseMs));
    return {
        x: current.x + (target.x - current.x) * alpha,
        y: current.y + (target.y - current.y) * alpha,
        scale: current.scale + (target.scale - current.scale) * alpha,
    };
}
export function boardViewportHasSettled(current, target) {
    return (Math.abs(current.x - target.x) < 0.1 &&
        Math.abs(current.y - target.y) < 0.1 &&
        Math.abs(current.scale - target.scale) < 0.0005);
}
//# sourceMappingURL=BoardViewport.js.map