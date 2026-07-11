import type { HTMLAttributes } from 'react';
import type { CalloutVariant } from '../model.js';
export type CalloutProps = HTMLAttributes<HTMLElement> & {
    variant?: Exclude<CalloutVariant, 'annotation'>;
};
export declare function Callout({ className, variant, ...props }: CalloutProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Callout.d.ts.map