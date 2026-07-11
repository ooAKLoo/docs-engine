import type { HTMLAttributes } from 'react';
export type StatusTone = 'done' | 'progress' | 'todo' | 'neutral' | 'warning' | 'danger';
export type StatusProps = HTMLAttributes<HTMLSpanElement> & {
    tone?: StatusTone;
};
export declare function Status({ className, tone, ...props }: StatusProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Status.d.ts.map