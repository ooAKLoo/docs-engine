import type { HTMLAttributes } from 'react';
export type TransitionProps = HTMLAttributes<HTMLDivElement>;
export type TransitionCardProps = HTMLAttributes<HTMLDivElement> & {
    target?: boolean;
};
export type TransitionPartProps = HTMLAttributes<HTMLElement>;
export declare function Transition({ className, ...props }: TransitionProps): import("react/jsx-runtime").JSX.Element;
export declare function TransitionCard({ className, target, ...props }: TransitionCardProps): import("react/jsx-runtime").JSX.Element;
export declare function TransitionArrow({ className, ...props }: TransitionPartProps): import("react/jsx-runtime").JSX.Element;
export declare function TransitionLabel({ className, ...props }: TransitionPartProps): import("react/jsx-runtime").JSX.Element;
export declare function TransitionTitle({ className, ...props }: TransitionPartProps): import("react/jsx-runtime").JSX.Element;
export declare function TransitionCopy({ className, ...props }: TransitionPartProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Transition.d.ts.map