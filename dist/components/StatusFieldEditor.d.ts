import { type HTMLAttributes } from 'react';
import type { StatusTone } from './Status.js';
import type { StatusOption } from './StatusEditor.js';
export type StatusFieldEditorProps = Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> & {
    label: string;
    options: readonly StatusOption[];
    editable?: boolean;
    usedValues?: readonly string[];
    toneForValue?: (value: string, options: readonly StatusOption[]) => StatusTone;
    onOptionsChange?: (options: StatusOption[]) => void | Promise<void>;
    onError?: (error: unknown) => void;
};
export declare function StatusFieldEditor({ label, options, editable, usedValues, toneForValue, onOptionsChange, onError, className, ...props }: StatusFieldEditorProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=StatusFieldEditor.d.ts.map