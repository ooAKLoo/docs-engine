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
//# sourceMappingURL=BoardViewport.js.map