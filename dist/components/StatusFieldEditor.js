'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useId, useMemo, useRef, useState, } from 'react';
import { joinClassNames } from '../classnames.js';
export function StatusFieldEditor({ label, options, editable = false, usedValues = [], toneForValue, onOptionsChange, onError, className, ...props }) {
    const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [optimisticOptions, setOptimisticOptions] = useState(() => normalizeOptions(options, toneForValue));
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
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
        if (!button)
            return;
        const rect = button.getBoundingClientRect();
        const estimatedHeight = Math.min(360, 44 * (normalizedOptions.length + 2) + 20);
        const opensUp = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > estimatedHeight;
        setMenuStyle({
            position: 'fixed',
            top: opensUp ? rect.top - estimatedHeight - 8 : rect.bottom + 8,
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 230) - 12),
            minWidth: Math.max(rect.width, 230),
            zIndex: 80,
        });
    }, [normalizedOptions.length]);
    useEffect(() => {
        if (!open)
            return;
        updateMenuPosition();
        function handlePointerDown(event) {
            const target = event.target;
            if (!target)
                return;
            if (rootRef.current?.contains(target) || menuRef.current?.contains(target))
                return;
            setOpen(false);
        }
        function handleKeyDown(event) {
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
    async function save(nextOptions) {
        const normalized = normalizeOptions(nextOptions, toneForValue);
        const previous = optimisticOptions;
        setOptimisticOptions(normalized);
        setSaving(true);
        setError('');
        try {
            await onOptionsChange?.(normalized);
        }
        catch (saveError) {
            setOptimisticOptions(previous);
            setError('状态字段保存失败');
            onError?.(saveError);
        }
        finally {
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
        await save([...normalizedOptions, { value, tone: toneForValue?.(value, normalizedOptions) ?? 'neutral' }]);
        setDraft('');
    }
    async function removeOption(value) {
        if (used.has(value))
            return;
        await save(normalizedOptions.filter((option) => option.value !== value));
    }
    if (!canEdit) {
        return _jsx("span", { className: joinClassNames('de-status-field-label', className), ...props, children: label });
    }
    return (_jsxs("span", { ref: rootRef, className: joinClassNames('de-status-field-editor', className), ...props, children: [_jsxs("button", { ref: buttonRef, type: "button", className: "de-status-field-trigger", "aria-label": `管理${label}字段值`, "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": `de-status-field-menu-${instanceId}`, disabled: saving, onClick: () => setOpen((current) => !current), children: [_jsx("span", { children: label }), _jsx("span", { className: "de-status-chevron", "aria-hidden": "true", children: "\u2304" })] }), mounted && open && menuStyle
                ? createPortal(_jsxs("div", { ref: menuRef, id: `de-status-field-menu-${instanceId}`, className: "de-status-popover de-status-field-popover", role: "dialog", "aria-label": `${label}字段值`, style: menuStyle, children: [_jsx("p", { className: "de-status-field-caption", children: "\u5B57\u6BB5\u503C" }), normalizedOptions.map((option) => {
                            const tone = toneForValue?.(option.value, normalizedOptions) ?? option.tone ?? 'neutral';
                            const isUsed = used.has(option.value);
                            return (_jsxs("div", { className: "de-status-field-option", children: [_jsx("span", { className: "de-badge", "data-kind": "status", "data-value": tone, children: option.value }), _jsx("button", { type: "button", className: "de-status-option-remove", "aria-label": `删除状态：${option.value}`, title: isUsed ? '该状态仍被列表使用，不能删除' : '删除状态', disabled: saving || isUsed, onClick: () => void removeOption(option.value), children: "\u00D7" })] }, option.value));
                        }), _jsxs("form", { className: "de-status-create-form", onSubmit: (event) => {
                                event.preventDefault();
                                void addOption();
                            }, children: [_jsx("input", { value: draft, maxLength: 80, placeholder: "\u65B0\u589E\u72B6\u6001", "aria-label": "\u65B0\u589E\u72B6\u6001", onChange: (event) => setDraft(event.target.value) }), _jsx("button", { type: "submit", disabled: saving || !draft.trim(), children: "\u6DFB\u52A0" })] }), error ? _jsx("p", { className: "de-status-error", role: "status", children: error }) : null] }), document.body)
                : null] }));
}
function normalizeOptions(options, toneForValue) {
    const seen = new Set();
    return options.flatMap((option) => {
        const value = option.value.trim();
        if (!value || seen.has(value))
            return [];
        seen.add(value);
        return [{ value, tone: option.tone ?? toneForValue?.(value, options) ?? 'neutral' }];
    });
}
//# sourceMappingURL=StatusFieldEditor.js.map