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
import type {StatusOption} from './StatusEditor.js';

export type StatusFieldEditorProps = Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> & {
  label: string;
  options: readonly StatusOption[];
  editable?: boolean;
  usedValues?: readonly string[];
  toneForValue?: (value: string, options: readonly StatusOption[]) => StatusTone;
  onOptionsChange?: (options: StatusOption[]) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export function StatusFieldEditor({
  label,
  options,
  editable = false,
  usedValues = [],
  toneForValue,
  onOptionsChange,
  onError,
  className,
  ...props
}: StatusFieldEditorProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [optimisticOptions, setOptimisticOptions] = useState<StatusOption[]>(() => normalizeOptions(options, toneForValue));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const normalizedOptions = useMemo(() => normalizeOptions(optimisticOptions, toneForValue), [optimisticOptions, toneForValue]);
  const used = useMemo(() => new Set(usedValues.map((value) => value.trim()).filter(Boolean)), [usedValues]);
  const canEdit = editable && typeof onOptionsChange === 'function';

  useEffect(() => {
    setOptimisticOptions(normalizeOptions(options, toneForValue));
  }, [options, toneForValue]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const estimatedHeight = Math.min(360, 44 * (normalizedOptions.length + 2) + 20);
    const opensUp = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > estimatedHeight;
    setMenuStyle({
      position: 'fixed',
      top: opensUp ? rect.top - estimatedHeight - 8 : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 230) - 12),
      minWidth: Math.max(rect.width, 230),
      transformOrigin: opensUp ? 'bottom left' : 'top left',
      zIndex: 80,
    });
  }, [normalizedOptions.length]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
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

  async function save(nextOptions: StatusOption[]) {
    const normalized = normalizeOptions(nextOptions, toneForValue);
    const previous = optimisticOptions;
    setOptimisticOptions(normalized);
    setSaving(true);
    setError('');
    try {
      await onOptionsChange?.(normalized);
    } catch (saveError) {
      setOptimisticOptions(previous);
      setError('状态字段保存失败');
      onError?.(saveError);
    } finally {
      setSaving(false);
    }
  }

  async function addOption() {
    const value = draft.trim();
    if (!value || value.length > 80 || /[|\r\n]/.test(value)) {
      setError('状态名称需为 1–80 个字符，且不能包含换行或竖线');
      return;
    }
    if (normalizedOptions.some((option) => option.value === value)) {
      setError('该状态已存在');
      return;
    }
    await save([...normalizedOptions, {value, tone: toneForValue?.(value, normalizedOptions) ?? 'neutral'}]);
    setDraft('');
  }

  async function removeOption(value: string) {
    if (used.has(value)) return;
    await save(normalizedOptions.filter((option) => option.value !== value));
  }

  if (!canEdit) {
    return <span className={joinClassNames('de-status-field-label', className)} {...props}>{label}</span>;
  }

  return (
    <span ref={rootRef} className={joinClassNames('de-status-field-editor', className)} {...props}>
      <button
        ref={buttonRef}
        type="button"
        className="de-status-field-trigger"
        aria-label={`管理${label}字段值`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`de-status-field-menu-${instanceId}`}
        disabled={saving}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span><span className="de-status-chevron" aria-hidden="true">⌄</span>
      </button>
      {mounted && menuStyle
        ? createPortal(
            <LazyMotion features={domAnimation} strict>
              <AnimatePresence>
                {open ? (
                  <m.div
                  ref={menuRef}
                  key={`de-status-field-menu-${instanceId}`}
                  id={`de-status-field-menu-${instanceId}`}
                  className="de-status-popover de-status-field-popover"
                  role="dialog"
                  aria-label={`${label}字段值`}
                  style={menuStyle}
                  initial={prefersReducedMotion ? {opacity: 0} : {opacity: 0, scale: 0.98}}
                  animate={{opacity: 1, scale: 1}}
                  exit={prefersReducedMotion ? {opacity: 0} : {opacity: 0, scale: 0.985}}
                  transition={prefersReducedMotion ? {duration: 0} : {type: 'spring', stiffness: 420, damping: 34, mass: 0.52}}
                  >
                  <p className="de-status-field-caption">字段值</p>
                  {normalizedOptions.map((option) => {
                    const tone = toneForValue?.(option.value, normalizedOptions) ?? option.tone ?? 'neutral';
                    const isUsed = used.has(option.value);
                    return (
                      <div className="de-status-field-option" key={option.value}>
                        <span className="de-badge" data-kind="status" data-value={tone}>{option.value}</span>
                        <button
                          type="button"
                          className="de-status-option-remove"
                          aria-label={`删除状态：${option.value}`}
                          title={isUsed ? '该状态仍被列表使用，不能删除' : '删除状态'}
                          disabled={saving || isUsed}
                          onClick={() => void removeOption(option.value)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <form
                    className="de-status-create-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void addOption();
                    }}
                  >
                    <input
                      value={draft}
                      maxLength={80}
                      placeholder="新增状态"
                      aria-label="新增状态"
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <button type="submit" disabled={saving || !draft.trim()}>添加</button>
                  </form>
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

function normalizeOptions(options: readonly StatusOption[], toneForValue?: StatusFieldEditorProps['toneForValue']) {
  const seen = new Set<string>();
  return options.flatMap((option) => {
    const value = option.value.trim();
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [{value, tone: option.tone ?? toneForValue?.(value, options) ?? 'neutral'}];
  });
}
