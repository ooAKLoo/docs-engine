import type {CSSProperties, ReactNode} from 'react';
import {
  Users, Target, Flag, MessageCircle, Megaphone, HardDrive, Search, Sparkles,
  Wallet, Cpu, Camera, Backpack, Smartphone, ShieldCheck, Feather, Clock,
  MapPin, Lock, Cloud, Folder, Image, Film, Music, Zap, Heart, TriangleAlert,
  BookOpen, ListChecks, Check, X, Scale, RefreshCw, Eye, Timer,
  type LucideIcon,
} from 'lucide-react';
import type {KnownIconName} from '../iconNames.js';
import type {DocBlock} from '../model.js';
import {serializeDocBlock} from '../serializeDocumentMarkdown.js';
import {MarkdownInline} from './MarkdownInline.js';

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
} satisfies Record<KnownIconName, LucideIcon>;

const warnedNames = new Set<string>();
declare const process: {env: {NODE_ENV?: string}} | undefined;

function resolveIcon(name: string): LucideIcon | undefined {
  if (Object.hasOwn(icons, name)) return icons[name as KnownIconName];
  const isDevelopment =
    (import.meta as ImportMeta & {env?: {DEV?: boolean}}).env?.DEV ??
    (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');
  if (isDevelopment && !warnedNames.has(name)) {
    warnedNames.add(name);
    console.warn(`[docs-engine] Unknown icon: "${name}"`);
  }
  return undefined;
}

export type IconsProps = Omit<Extract<DocBlock, {type: 'icons'}>, 'type'> & {
  renderInline?: (text: string) => ReactNode;
};

function defaultInline(text: string) {
  return <MarkdownInline text={text} />;
}

export function Icons({layout, title, items, renderInline = defaultInline}: IconsProps) {
  return (
    <div
      className="de-icons"
      data-layout={layout}
      data-de-icons-markdown={serializeDocBlock({type: 'icons', layout, title, items}).join('\n').trim()}
      style={{'--de-icons-columns': Math.max(1, Math.min(4, items.length))} as CSSProperties}
    >
      {title ? <p className="de-icons__label">{renderInline(title)}</p> : null}
      <ul className="de-icons__items" role="list">
        {items.map((item, index) => {
          const Icon = resolveIcon(item.icon);
          return (
            <li className="de-icons__item" data-icon={item.icon} key={index}>
              <span className="de-icons__icon" aria-hidden="true">
                {Icon ? <Icon size={20} strokeWidth={1.75} /> : null}
              </span>
              <div className="de-icons__copy">
                <p className="de-icons__title">{renderInline(item.title)}</p>
                {item.description ? (
                  <p className="de-icons__description">{renderInline(item.description)}</p>
                ) : null}
                {item.note ? <p className="de-icons__note">{renderInline(item.note)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
