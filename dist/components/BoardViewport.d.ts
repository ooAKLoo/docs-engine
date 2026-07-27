export type BoardViewport = {
    x: number;
    y: number;
    scale: number;
};
export type BoardViewportUpdate = BoardViewport | ((current: BoardViewport) => BoardViewport);
type MutableViewportRef = {
    current: BoardViewport;
};
/**
 * Resolve and publish a viewport update synchronously.
 *
 * Wheel and pointer streams can dispatch several events before React commits
 * state. Keeping the interaction ref current here prevents later events from
 * reading stale scale or position values and dropping part of the gesture.
 */
export declare function advanceBoardViewport(viewportRef: MutableViewportRef, update: BoardViewportUpdate): BoardViewport;
/**
 * WheelEvent deltas may be expressed in pixels, text lines or pages depending
 * on the input device and browser. Convert them to pixels before panning or
 * applying the exponential zoom curve.
 */
export declare function normalizeBoardWheelDelta(delta: number, deltaMode: number, pageSize: number): number;
export {};
//# sourceMappingURL=BoardViewport.d.ts.map