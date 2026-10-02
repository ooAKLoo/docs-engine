export type BoardViewport = {
    x: number;
    y: number;
    scale: number;
};
export type BoardViewportUpdate = BoardViewport | ((current: BoardViewport) => BoardViewport);
type MutableViewportRef = {
    current: BoardViewport;
};
export declare const BOARD_PINCH_ZOOM_SENSITIVITY = 0.01;
export declare const BOARD_WHEEL_ZOOM_SENSITIVITY = 0.0018;
export type BoardWheelStream = {
    lastTime: number;
    continuous: boolean;
};
/**
 * WheelEvent has no device identifier. Small/fractional pixel deltas are the
 * first-event signal; <=40ms cadence and a 160ms latch also cover fast swipes
 * and momentum with larger deltas. Line/page units always mean discrete input.
 * ctrlKey alone cannot identify pinch: Ctrl+mouse-wheel uses it too.
 */
export declare function isContinuousBoardWheel(event: Pick<WheelEvent, 'deltaMode' | 'deltaX' | 'deltaY' | 'timeStamp'>, stream: BoardWheelStream): boolean;
export declare function boardWheelZoomFactor(delta: number, pinch: boolean): number;
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
/**
 * Move the displayed viewport toward its latest interaction target with a
 * frame-rate-independent exponential response for discrete wheel input. The curve
 * never overshoots and does not restart when more wheel events arrive.
 */
export declare function dampBoardViewport(current: BoardViewport, target: BoardViewport, elapsedMs: number, responseMs?: number): {
    x: number;
    y: number;
    scale: number;
};
export declare function boardViewportHasSettled(current: BoardViewport, target: BoardViewport): boolean;
export {};
//# sourceMappingURL=BoardViewport.d.ts.map