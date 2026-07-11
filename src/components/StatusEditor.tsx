'use client';

import {createPortal} from 'react-dom';
import {AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion} from 'motion/react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';
import {joinClassNames} from '../classnames.js';
import type {StatusTone} from './Status.js';

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

export function StatusEditor({
  value,
  options,
  editable = false,
  allowCreate = false,
  toggleWhenBinary = false,
  onChange,
  onCreate,
  toneForValue,
  label = '状态',
  placeholder = '未设置',
  onError,
  className,
  ...props
}: StatusEditorProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [createdOptions, setCreatedOptions] = useState<StatusOption[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setOptimisticValue(value);
  }, [value]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mergedOptions = useMemo(
    () => mergeStatusOptions([...options, ...createdOptions], optimisticValue, toneForValue),
    [createdOptions, optimisticValue, options, toneForValue],
  );
  const canEdit = editable && typeof onChange === 'function';
  const canCreate = canEdit && allowCreate;
  const canToggle = canEdit && toggleWhenBinary && mergedOptions.length === 2;
  const normalizedValue = optimisticValue.trim();
  const displayValue = normalizedValue || placeholder;
  const tone = resolveStatusTone(normalizedValue, mergedOptions, toneForValue);
  const title = error || (saving ? '保存中' : `${label}：${displayValue}`);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const estimatedHeight = Math.min(340, 42 * (mergedOptions.length + (canCreate ? 2 : 1)) + 18);
    const opensUp = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > estimatedHeight;
    setMenuStyle({
      position: 'fixed',
      top: opensUp ? rect.top - estimatedHeight - 8 : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 208) - 12),
      minWidth: Math.max(rect.width, 208),
      transformOrigin: opensUp ? 'bottom left' : 'top left',
      zIndex: 80,
    });
  }, [canCreate, mergedOptions.length]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  function closeMenu() {
    setOpen(false);
    setCreating(false);
    setDraft('');
  }

  async function commit(nextValue: string, reason: StatusEditorChangeMeta['reason']) {
    const next = nextValue.trim();
    if (next === normalizedValue) {
      closeMenu();
      return true;
    }

    const previous = optimisticValue;
    setOptimisticValue(next);
    setSaving(true);
    setError('');
    try {
      await onChange?.(next, {reason});
      closeMenu();
      return true;
    } catch (commitError) {
      setOptimisticValue(previous);
      setError('状态保存失败');
      onError?.(commitError);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createState() {
    const next = draft.trim();
    if (!next || next.length > 80 || /[|\r\n]/.test(next)) {
      setError('状态名称需为 1–80 个字符，且不能包含换行或竖线');
      return;
    }

    const existing = mergedOptions.some((option) => option.value === next);
    if (existing) {
      await commit(next, 'select');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const registered = await onCreate?.(next);
      const option = typeof registered === 'object' && registered ? registered : {value: next};
      setCreatedOptions((current) => mergeStatusOptions([...current, option], ''));
      const saved = await commit(next, 'create');
      if (!saved) {
        setCreatedOptions((current) => current.filter((item) => item.value !== option.value));
      }
    } catch (createError) {
      setError('新增状态失败');
      onError?.(createError);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <span
        className={joinClassNames('de-badge', className)}
        data-kind="status"
        data-value={tone}
        title={title}
        {...props}
      >
        {displayValue}
      </span>
    );
  }

  return (
    <span ref={rootRef} className={joinClassNames('de-status-editor', className)} title={title} {...props}>
      <button
        ref={buttonRef}
        type="button"
        className="de-badge de-status-trigger"
        data-kind="status"
        data-value={tone}
        aria-label={label}
        aria-haspopup={canToggle ? undefined : 'listbox'}
        aria-expanded={open}
        aria-controls={`de-status-menu-${instanceId}`}
        disabled={saving}
        onClick={() => {
          if (canToggle) {
            const next = mergedOptions.find((option) => option.value !== normalizedValue)?.value ?? mergedOptions[0]?.value ?? '';
            void commit(next, 'select');
            return;
          }
          setOpen((current) => !current);
        }}
      >
        <span>{displayValue}</span>
      </button>
      {mounted && menuStyle
        ? createPortal(
            <LazyMotion features={domAnimation} strict>
              <AnimatePresence>
                {open ? (
                  <m.div
                  ref={menuRef}
                  key={`de-status-menu-${instanceId}`}
                  id={`de-status-menu-${instanceId}`}
                  className="de-status-popover"
                  role="listbox"
                  aria-label={`${label}选项`}
                  style={menuStyle}
                  initial={prefersReducedMotion ? {opacity: 0} : {opacity: 0, scale: 0.98}}
                  animate={{opacity: 1, scale: 1}}
                  exit={prefersReducedMotion ? {opacity: 0} : {opacity: 0, scale: 0.985}}
                  transition={prefersReducedMotion ? {duration: 0} : {type: 'spring', stiffness: 420, damping: 34, mass: 0.52}}
                  >
                  <StatusMenuOption
                    label={placeholder}
                    tone="neutral"
                    selected={!normalizedValue}
                    onSelect={() => void commit('', 'select')}
                  />
                  {mergedOptions.map((option) => (
                    <StatusMenuOption
                      key={option.value}
                      label={option.value}
                      tone={resolveStatusTone(option.value, mergedOptions, toneForValue)}
                      selected={option.value === normalizedValue}
                      onSelect={() => void commit(option.value, 'select')}
                    />
                  ))}
                  {canCreate ? (
                    creating ? (
                      <form
                        className="de-status-create-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void createState();
                        }}
                      >
                        <input
                          autoFocus
                          value={draft}
                          maxLength={80}
                          placeholder="输入新状态"
                          aria-label="新状态名称"
                          onChange={(event) => setDraft(event.target.value)}
                        />
                        <button type="submit" disabled={saving || !draft.trim()}>添加</button>
                      </form>
                    ) : (
                      <button type="button" className="de-status-create-button" onClick={() => setCreating(true)}>
                        <span aria-hidden="true">＋</span> 新增状态
                      </button>
                    )
                  ) : null}
                  {error ? <p className="de-status-error" role="status">{error}</p> : null}
                  </m.div>
                ) : null}
              </AnimatePresence>
            </LazyMotion>,
            document.body,
          )
        : null}
    </span>
  );
}

function StatusMenuOption({
  label,
  tone,
  selected,
  onSelect,
}: {
  label: string;
  tone: StatusTone;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className="de-status-menu-option"
      onClick={onSelect}
    >
      <span className="de-badge" data-kind="status" data-value={tone}>{label}</span>
      <span className="de-status-option-check" aria-hidden="true">{selected ? '✓' : ''}</span>
    </button>
  );
}

function mergeStatusOptions(options: readonly StatusOption[], currentValue: string, toneForValue?: StatusEditorProps['toneForValue']) {
  const seen = new Set<string>();
  const result: StatusOption[] = [];
  [...options, currentValue ? {value: currentValue} : null].forEach((rawOption) => {
    if (!rawOption) return;
    const value = rawOption.value.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    result.push({
      value,
      tone: rawOption.tone ?? toneForValue?.(value, options) ?? 'neutral',
    });
  });
  return result;
}

function resolveStatusTone(
  value: string,
  options: readonly StatusOption[],
  toneForValue?: StatusEditorProps['toneForValue'],
): StatusTone {
  if (!value) return 'neutral';
  return toneForValue?.(value, options) ?? options.find((option) => option.value === value)?.tone ?? 'neutral';
}
