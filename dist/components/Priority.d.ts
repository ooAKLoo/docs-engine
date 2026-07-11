import type { HTMLAttributes } from 'react';
export type PriorityLevel = 'p0' | 'p1' | 'p2';
export type PriorityProps = HTMLAttributes<HTMLSpanElement> & {
    level?: PriorityLevel;
};
export declare function Priority({ className, level, ...props }: PriorityProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Priority.d.ts.map