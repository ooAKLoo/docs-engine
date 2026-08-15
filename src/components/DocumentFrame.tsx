'use client';

import {PanelLeftClose, PanelLeftOpen} from 'lucide-react';
import {AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion} from 'motion/react';
import {useEffect, useState, type HTMLAttributes, type ReactNode} from 'react';
import {joinClassNames} from '../classnames.js';

export type DocumentFrameProps = HTMLAttributes<HTMLElement> & {
  catalog?: ReactNode;
  outline?: ReactNode;
  children: ReactNode;
  persistKey?: string;
  /**
   * When the frame stays mounted and this key changes, fade the main column
   * and chapter outline. Full-page remounts cannot interpolate; keep the
   * catalog and frame in a layout, then pass the current document id.
   */
  contentKey?: string;
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
  contentKey,
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

  const main = (
    <div className="de-document-frame__main">
      <DocumentFrameSwitch contentKey={contentKey}>{children}</DocumentFrameSwitch>
    </div>
  );
  const outlinePane = outline ? (
    <div className="de-document-frame__outline">
      <DocumentFrameSwitch contentKey={contentKey}>{outline}</DocumentFrameSwitch>
    </div>
  ) : null;

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

      {contentKey != null ? (
        <LazyMotion features={domAnimation} strict>
          {main}
          {outlinePane}
        </LazyMotion>
      ) : (
        <>
          {main}
          {outlinePane}
        </>
      )}
    </div>
  );
}

function DocumentFrameSwitch({
  children,
  contentKey,
}: {
  children: ReactNode;
  contentKey?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (contentKey == null) {
    return children;
  }

  const instant = prefersReducedMotion === true;
  const transition = instant ? {duration: 0} : {duration: 0.2, ease: [0.22, 1, 0.36, 1] as const};
  const initial = instant ? {opacity: 0} : {opacity: 0, y: 6};
  const animate = {opacity: 1, y: 0};
  const exit = instant ? {opacity: 0} : {opacity: 0, y: -4};

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={contentKey}
        className="de-document-frame__switch"
        initial={initial}
        animate={animate}
        exit={exit}
        transition={transition}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
