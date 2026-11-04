/** Explicit built-in whitelist, also available from the headless agent entry. */
export const knownIconNames = Object.freeze([
  'users', 'target', 'flag', 'message-circle', 'megaphone', 'hard-drive',
  'search', 'sparkles', 'wallet', 'cpu', 'camera', 'backpack', 'smartphone',
  'shield-check', 'feather', 'clock', 'map-pin', 'lock', 'cloud', 'folder',
  'image', 'film', 'music', 'zap', 'heart', 'triangle-alert', 'book-open',
  'list-checks', 'check', 'x', 'scale', 'refresh-cw', 'eye', 'timer',
] as const);

export type KnownIconName = (typeof knownIconNames)[number];
