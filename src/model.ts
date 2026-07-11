export type CalloutVariant = 'brand' | 'info' | 'note' | 'annotation';

export type DocBlock =
  | {type: 'heading'; level: 1 | 2 | 3; text: string}
  | {type: 'paragraph'; text: string; tone?: 'muted'}
  | {type: 'list'; items: Array<{text: string; muted?: boolean; strong?: boolean}>}
  | {type: 'formula'; lines: string[]; compact?: boolean}
  | {type: 'image'; src: string; alt: string; caption?: string}
  | {type: 'imageGrid'; images: Array<{src: string; alt: string; caption?: string}>}
  | {type: 'callout'; variant: CalloutVariant; title: string; body: string[]}
  | {type: 'table'; headers: string[]; rows: string[][]; statusOptions?: string[]};

export type HeadingLink = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
};

export type DocumentModel = {
  schemaVersion: 1;
  slug: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  meta: string;
  source: string;
  updatedAt: string;
  summary: string;
  blocks: DocBlock[];
};
