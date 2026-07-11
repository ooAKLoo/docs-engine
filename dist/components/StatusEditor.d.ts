import { type HTMLAttributes } from 'react';
import type { StatusTone } from './Status.js';
export type StatusOption = {
    value: string;
    tone?: StatusTone;
};
export type StatusEditorChangeMeta = {
    reason: 'select' | 'create';
};
export type StatusEditorProps = Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> & {
    /** Current field value. The editor performs an optimistic display update until the host sends a new value. */
    value: string;
    /** Existing allowed states for this property. Values are de-duplicated by their trimmed text. */
    options: readonly StatusOption[];
    /** Whether the current user can change the property. */
    editable?: boolean;
    /** Enable the “新增状态” action. The host can persist a state registry via onCreate. */
    allowCreate?: boolean;
    /** With exactly two configured states, click the cell to switch directly instead of opening the menu. */
    toggleWhenBinary?: boolean;
    /** Persist the new value. The editor rolls back its optimistic display when this rejects. */
    onChange?: (value: string, meta: StatusEditorChangeMeta) => void | Promise<void>;
    /** Optional host hook for registering a newly created state before assigning it to this row. */
    onCreate?: (value: string) => void | StatusOption | Promise<void | StatusOption>;
    /** Maps application-specific state names to the shared visual tones. */
    toneForValue?: (value: string, options: readonly StatusOption[]) => StatusTone;
    /** Accessible label for the property button and option list. */
    label?: string;
    /** Label used for an empty field. */
    placeholder?: string;
    /** Receives a persistence or validation error after the UI has been restored. */
    onError?: (error: unknown) => void;
};
export declare function StatusEditor({ value, options, editable, allowCreate, toggleWhenBinary, onChange, onCreate, toneForValue, label, placeholder, onError, className, ...props }: StatusEditorProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=StatusEditor.d.ts.map