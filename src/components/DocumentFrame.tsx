'use client';

import {PanelLeftClose, PanelLeftOpen} from 'lucide-react';
import {useEffect, useState, type HTMLAttributes, type ReactNode} from 'react';
import {joinClassNames} from '../classnames.js';

export type DocumentFrameProps = HTMLAttributes<HTMLElement> & {
  catalog?: ReactNode;
  outline?: ReactNode;
  children: ReactNode;
  persistKey?: string;
};

/**
 * Optional three-column document chrome: catalog on the left, chapter outline
 * on the right. Hosts that already have a framework sidebar (Docusaurus) can
 * skip this component.
 */
export function DocumentFrame({
  catalog,
  children,
  className,
  outline,
  persistKey = 'de-document-catalog-collapsed',
  ...props
}: DocumentFrameProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(persistKey) === 'true');
    setReady(true);
  }, [persistKey]);

  function setCatalogCollapsed(nextCollapsed: boolean) {
    setCollapsed(nextCollapsed);
    window.localStorage.setItem(persistKey, String(nextCollapsed));
  }

  return (
    <div
      {...props}
      className={joinClassNames('de-document-frame', className)}
      data-catalog={catalog ? (collapsed ? 'collapsed' : 'open') : 'none'}
      data-outline={outline ? 'open' : 'none'}
    >
      {catalog && !collapsed ? (
        <div className="de-document-frame__catalog">
          <button
            className="de-document-frame__collapse"
            type="button"
            onClick={() => setCatalogCollapsed(true)}
            aria-label="收起文档目录"
            title="收起文档目录"
          >
            <PanelLeftClose size={15} strokeWidth={2.1} />
          </button>
          {catalog}
        </div>
      ) : null}

      {ready && catalog && collapsed ? (
        <button
          className="de-document-frame__expand"
          type="button"
          onClick={() => setCatalogCollapsed(false)}
          aria-label="打开文档目录"
          title="打开文档目录"
        >
          <PanelLeftOpen size={17} strokeWidth={2.2} />
        </button>
      ) : null}

      <div className="de-document-frame__main">{children}</div>
      {outline ? <div className="de-document-frame__outline">{outline}</div> : null}
    </div>
  );
}
