'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useId, useMemo, useRef, useState, } from 'react';
import { joinClassNames } from '../classnames.js';
export function StatusEditor({ value, options, editable = false, allowCreate = false, onChange, onCreate, toneForValue, label = '状态', placeholder = '未设置', onError, className, ...props }) {
    const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [optimisticValue, setOptimisticValue] = useState(value);
    const [createdOptions, setCreatedOptions] = useState([]);
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    useEffect(() => {
        setOptimisticValue(value);
    }, [value]);
    useEffect(() => {
        setMounted(true);
    }, []);
    const mergedOptions = useMemo(() => mergeStatusOptions([...options, ...createdOptions], optimisticValue, toneForValue), [createdOptions, optimisticValue, options, toneForValue]);
    const canEdit = editable && typeof onChange === 'function';
    const canCreate = canEdit && allowCreate;
    const normalizedValue = optimisticValue.trim();
    const displayValue = normalizedValue || placeholder;
    const tone = resolveStatusTone(normalizedValue, mergedOptions, toneForValue);
    const title = error || (saving ? '保存中' : `${label}：${displayValue}`);
    const updateMenuPosition = useCallback(() => {
        const button = buttonRef.current;
        if (!button)
            return;
        const rect = button.getBoundingClientRect();
        const estimatedHeight = Math.min(340, 42 * (mergedOptions.length + (canCreate ? 2 : 1)) + 18);
        const opensUp = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > estimatedHeight;
        setMenuStyle({
            position: 'fixed',
            top: opensUp ? rect.top - estimatedHeight - 8 : rect.bottom + 8,
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 208) - 12),
            minWidth: Math.max(rect.width, 208),
            zIndex: 80,
        });
    }, [canCreate, mergedOptions.length]);
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
            closeMenu();
        }
        function handleKeyDown(event) {
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
    async function commit(nextValue, reason) {
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
            await onChange?.(next, { reason });
            closeMenu();
            return true;
        }
        catch (commitError) {
            setOptimisticValue(previous);
            setError('状态保存失败');
            onError?.(commitError);
            return false;
        }
        finally {
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
            const option = typeof registered === 'object' && registered ? registered : { value: next };
            setCreatedOptions((current) => mergeStatusOptions([...current, option], ''));
            const saved = await commit(next, 'create');
            if (!saved) {
                setCreatedOptions((current) => current.filter((item) => item.value !== option.value));
            }
        }
        catch (createError) {
            setError('新增状态失败');
            onError?.(createError);
        }
        finally {
            setSaving(false);
        }
    }
    if (!canEdit) {
        return (_jsx("span", { className: joinClassNames('de-badge', className), "data-kind": "status", "data-value": tone, title: title, ...props, children: displayValue }));
    }
    return (_jsxs("span", { ref: rootRef, className: joinClassNames('de-status-editor', className), title: title, ...props, children: [_jsxs("button", { ref: buttonRef, type: "button", className: "de-badge de-status-trigger", "data-kind": "status", "data-value": tone, "aria-label": label, "aria-haspopup": "listbox", "aria-expanded": open, "aria-controls": `de-status-menu-${instanceId}`, disabled: saving, onClick: () => setOpen((current) => !current), children: [_jsx("span", { children: displayValue }), _jsx("span", { className: "de-status-chevron", "aria-hidden": "true", children: "\u2304" })] }), mounted && open && menuStyle
                ? createPortal(_jsxs("div", { ref: menuRef, id: `de-status-menu-${instanceId}`, className: "de-status-popover", role: "listbox", "aria-label": `${label}选项`, style: menuStyle, children: [_jsx(StatusMenuOption, { label: placeholder, tone: "neutral", selected: !normalizedValue, onSelect: () => void commit('', 'select') }), mergedOptions.map((option) => (_jsx(StatusMenuOption, { label: option.value, tone: resolveStatusTone(option.value, mergedOptions, toneForValue), selected: option.value === normalizedValue, onSelect: () => void commit(option.value, 'select') }, option.value))), canCreate ? (creating ? (_jsxs("form", { className: "de-status-create-form", onSubmit: (event) => {
                                event.preventDefault();
                                void createState();
                            }, children: [_jsx("input", { autoFocus: true, value: draft, maxLength: 80, placeholder: "\u8F93\u5165\u65B0\u72B6\u6001", "aria-label": "\u65B0\u72B6\u6001\u540D\u79F0", onChange: (event) => setDraft(event.target.value) }), _jsx("button", { type: "submit", disabled: saving || !draft.trim(), children: "\u6DFB\u52A0" })] })) : (_jsxs("button", { type: "button", className: "de-status-create-button", onClick: () => setCreating(true), children: [_jsx("span", { "aria-hidden": "true", children: "\uFF0B" }), " \u65B0\u589E\u72B6\u6001"] }))) : null, error ? _jsx("p", { className: "de-status-error", role: "status", children: error }) : null] }), document.body)
                : null] }));
}
function StatusMenuOption({ label, tone, selected, onSelect, }) {
    return (_jsxs("button", { type: "button", role: "option", "aria-selected": selected, className: "de-status-menu-option", onClick: onSelect, children: [_jsx("span", { className: "de-badge", "data-kind": "status", "data-value": tone, children: label }), _jsx("span", { className: "de-status-option-check", "aria-hidden": "true", children: selected ? '✓' : '' })] }));
}
function mergeStatusOptions(options, currentValue, toneForValue) {
    const seen = new Set();
    const result = [];
    [...options, currentValue ? { value: currentValue } : null].forEach((rawOption) => {
        if (!rawOption)
            return;
        const value = rawOption.value.trim();
        if (!value || seen.has(value))
            return;
        seen.add(value);
        result.push({
            value,
            tone: rawOption.tone ?? toneForValue?.(value, options) ?? 'neutral',
        });
    });
    return result;
}
function resolveStatusTone(value, options, toneForValue) {
    if (!value)
        return 'neutral';
    return toneForValue?.(value, options) ?? options.find((option) => option.value === value)?.tone ?? 'neutral';
}
//# sourceMappingURL=StatusEditor.js.map