import type { HTMLAttributes } from 'react';
export type FormulaProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** A LaTeX expression. */
    latex: string;
    /** Keep the formula visually compact when it is part of dense reference content. */
    compact?: boolean;
};
/**
 * A display-math block for documents. Rendering is synchronous and SSR-safe, so the same
 * mathematical typography is emitted on the server and after hydration.
 */
export declare function Formula({ className, compact, latex, ...props }: FormulaProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Formula.d.ts.map