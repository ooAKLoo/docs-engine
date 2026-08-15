'use client';

import type {HTMLAttributes, ReactNode} from 'react';
import {joinClassNames} from '../classnames.js';
import type {DocumentNavGroup} from '../documentNav.js';

export type DocumentCatalogProps = HTMLAttributes<HTMLElement> & {
  groups: DocumentNavGroup[];
  currentId?: string;
  label?: string;
  header?: ReactNode;
  actions?: ReactNode;
};

/**
 * Left-rail document catalog. Hosts supply grouped links; Docs Engine owns the
 * visuals. Optional so Docusaurus hosts can keep their native sidebar.
 */
export function DocumentCatalog({
  actions,
  className,
  currentId,
  groups,
  header,
  label = '目录',
  ...props
}: DocumentCatalogProps) {
  return (
    <nav
      {...props}
      className={joinClassNames('de-document-catalog', className)}
      aria-label={label}
    >
      {header ? <div className="de-document-catalog__header">{header}</div> : null}
      <div className="de-document-catalog__toolbar">
        <p className="de-document-catalog__label">{label}</p>
        {actions ? <div className="de-document-catalog__actions">{actions}</div> : null}
      </div>
      <div className="de-document-catalog__groups">
        {groups.map((group) => (
          <section key={group.key} className="de-document-catalog__group" aria-label={group.label}>
            <p className="de-document-catalog__group-label">{group.label}</p>
            {group.items.length > 0 ? (
              <div className="de-document-catalog__items">
                {group.items.map((item) => (
                  <a
                    key={item.id}
                    className="de-document-catalog__link"
                    href={item.href}
                    aria-current={item.id === currentId ? 'page' : undefined}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </nav>
  );
}
