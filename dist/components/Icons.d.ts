import type { ReactNode } from 'react';
import type { DocBlock } from '../model.js';
export type IconsProps = Omit<Extract<DocBlock, {
    type: 'icons';
}>, 'type'> & {
    renderInline?: (text: string) => ReactNode;
};
export declare function Icons({ layout, title, items, renderInline }: IconsProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Icons.d.ts.map