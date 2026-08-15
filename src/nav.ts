'use client';

/**
 * Client-only document chrome. Next.js hosts should import catalog, outline and
 * frame from this entry so the `'use client'` boundary is on the module itself.
 */
export {DocumentCatalog, type DocumentCatalogProps} from './components/DocumentCatalog.js';
export {DocumentFrame, type DocumentFrameProps} from './components/DocumentFrame.js';
export {DocumentOutline, type DocumentOutlineProps} from './components/DocumentOutline.js';
export type {DocumentNavGroup, DocumentNavItem} from './documentNav.js';
