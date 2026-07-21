import { type HTMLAttributes, type ReactNode } from 'react';
export type CodeBlockProps = Omit<HTMLAttributes<HTMLPreElement>, 'children'> & {
    children?: ReactNode;
    code?: string;
    copiedLabel?: string;
    copyLabel?: string;
    language?: string;
    onCopy?: (code: string) => void;
};
export declare function CodeBlock({ children, className, code, copiedLabel, copyLabel, language, onCopy, tabIndex, ...props }: CodeBlockProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=CodeBlock.d.ts.map