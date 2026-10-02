import { type RefObject } from 'react';
import { type BoardViewport, type BoardViewportUpdate } from './BoardViewport.js';
/** Keep high-frequency viewport work outside React, including the grid. */
export declare function useBoardViewport(stageRef: RefObject<HTMLDivElement>, canvasRef: RefObject<HTMLDivElement>, active: boolean, reducedMotion: boolean | null, grid?: boolean): {
    viewport: BoardViewport;
    target: import("react").MutableRefObject<BoardViewport>;
    displayed: import("react").MutableRefObject<BoardViewport>;
    update: (value: BoardViewportUpdate) => void;
    queue: (value: BoardViewportUpdate) => void;
    damp: (value: BoardViewportUpdate) => void;
};
//# sourceMappingURL=useBoardViewport.d.ts.map