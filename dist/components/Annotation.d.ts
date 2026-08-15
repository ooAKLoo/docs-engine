import type { HTMLAttributes, ReactNode } from 'react';
export type AnnotationProps = HTMLAttributes<HTMLElement> & {
    /** Dimension name that belongs with the judgment, e.g. "用户购买原因". */
    label?: ReactNode;
};
export declare function Annotation({ className, label, children, ...props }: AnnotationProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Annotation.d.ts.map