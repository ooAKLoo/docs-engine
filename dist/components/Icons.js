import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Users, Target, Flag, MessageCircle, Megaphone, HardDrive, Search, Sparkles, Wallet, Cpu, Camera, Backpack, Smartphone, ShieldCheck, Feather, Clock, MapPin, Lock, Cloud, Folder, Image, Film, Music, Zap, Heart, TriangleAlert, BookOpen, ListChecks, Check, X, Scale, RefreshCw, Eye, Timer, } from 'lucide-react';
import { serializeDocBlock } from '../serializeDocumentMarkdown.js';
import { MarkdownInline } from './MarkdownInline.js';
// Named imports and a closed map keep the dynamic lucide catalog out of bundles.
const icons = {
    users: Users,
    target: Target,
    flag: Flag,
    'message-circle': MessageCircle,
    megaphone: Megaphone,
    'hard-drive': HardDrive,
    search: Search,
    sparkles: Sparkles,
    wallet: Wallet,
    cpu: Cpu,
    camera: Camera,
    backpack: Backpack,
    smartphone: Smartphone,
    'shield-check': ShieldCheck,
    feather: Feather,
    clock: Clock,
    'map-pin': MapPin,
    lock: Lock,
    cloud: Cloud,
    folder: Folder,
    image: Image,
    film: Film,
    music: Music,
    zap: Zap,
    heart: Heart,
    'triangle-alert': TriangleAlert,
    'book-open': BookOpen,
    'list-checks': ListChecks,
    check: Check,
    x: X,
    scale: Scale,
    'refresh-cw': RefreshCw,
    eye: Eye,
    timer: Timer,
};
const warnedNames = new Set();
function resolveIcon(name) {
    if (Object.hasOwn(icons, name))
        return icons[name];
    const isDevelopment = import.meta.env?.DEV ??
        (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');
    if (isDevelopment && !warnedNames.has(name)) {
        warnedNames.add(name);
        console.warn(`[docs-engine] Unknown icon: "${name}"`);
    }
    return undefined;
}
function defaultInline(text) {
    return _jsx(MarkdownInline, { text: text });
}
export function Icons({ layout, title, items, renderInline = defaultInline }) {
    return (_jsxs("div", { className: "de-icons", "data-layout": layout, "data-de-icons-markdown": serializeDocBlock({ type: 'icons', layout, title, items }).join('\n').trim(), style: { '--de-icons-columns': Math.max(1, Math.min(4, items.length)) }, children: [title ? _jsx("p", { className: "de-icons__label", children: renderInline(title) }) : null, _jsx("ul", { className: "de-icons__items", role: "list", children: items.map((item, index) => {
                    const Icon = resolveIcon(item.icon);
                    return (_jsxs("li", { className: "de-icons__item", "data-icon": item.icon, children: [_jsx("span", { className: "de-icons__icon", "aria-hidden": "true", children: Icon ? _jsx(Icon, { size: 20, strokeWidth: 1.75 }) : null }), _jsxs("div", { className: "de-icons__copy", children: [_jsx("p", { className: "de-icons__title", children: renderInline(item.title) }), item.description ? (_jsx("p", { className: "de-icons__description", children: renderInline(item.description) })) : null, item.note ? _jsx("p", { className: "de-icons__note", children: renderInline(item.note) }) : null] })] }, index));
                }) })] }));
}
//# sourceMappingURL=Icons.js.map