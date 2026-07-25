import { type ButtonHTMLAttributes, type RefObject } from 'react';
export type DocumentCopyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onCopy'> & {
    copiedLabel?: string;
    copyLabel?: string;
    errorLabel?: string;
    onCopy?: (markdown: string) => void;
    rootRef: RefObject<HTMLElement>;
};
export declare function serializeDocumentToMarkdown(root: HTMLElement): string;
export declare function DocumentCopyButton({ className, copiedLabel, copyLabel, errorLabel, onCopy, rootRef, ...props }: DocumentCopyButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DocumentCopy.d.ts.map