'use client';

import {useEffect, useState, type HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';
import type {HeadingLink} from '../model.js';

export type DocumentOutlineProps = HTMLAttributes<HTMLElement> & {
  headings: HeadingLink[];
  label?: string;
  emptyLabel?: string;
};

/**
 * Right-rail chapter outline with scroll spy. Hosts pass headings from
 * collectHeadings(); Docs Engine owns the visuals and active-section tracking.
 */
export function DocumentOutline({
  className,
  emptyLabel = '当前文档暂无章节标题。',
  headings,
  label = '本章',
  ...props
}: DocumentOutlineProps) {
  const [activeId, setActiveId] = useState<string | undefined>(headings[0]?.id);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveId(undefined);
      return;
    }

    function updateActiveHeading() {
      const nextId = readActiveHeadingId(headings);
      if (nextId) setActiveId(nextId);
    }

    updateActiveHeading();
    document.addEventListener('scroll', updateActiveHeading, {passive: true});
    window.addEventListener('resize', updateActiveHeading);
    window.addEventListener('hashchange', updateActiveHeading);
    return () => {
      document.removeEventListener('scroll', updateActiveHeading);
      window.removeEventListener('resize', updateActiveHeading);
      window.removeEventListener('hashchange', updateActiveHeading);
    };
  }, [headings]);

  return (
    <nav
      {...props}
      className={joinClassNames('de-document-outline', className)}
      aria-label={label}
    >
      <p className="de-document-outline__label">{label}</p>
      {headings.length === 0 ? (
        <p className="de-document-outline__empty">{emptyLabel}</p>
      ) : (
        <ol className="de-document-outline__list">
          {headings.map((heading) => (
            <li key={heading.id} data-level={heading.level}>
              <a
                className="de-document-outline__link"
                href={`#${heading.id}`}
                aria-current={heading.id === activeId ? 'location' : undefined}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

export function readActiveHeadingId(headings: HeadingLink[], offset = 96) {
  const hashId = window.location.hash.replace(/^#/, '');
  if (hashId && headings.some((heading) => heading.id === hashId)) {
    const hashed = document.getElementById(hashId);
    if (hashed && hashed.getBoundingClientRect().top <= offset + 8) {
      return hashId;
    }
  }

  let activeId = headings[0]?.id;
  for (const heading of headings) {
    const element = document.getElementById(heading.id);
    if (!element) continue;
    if (element.getBoundingClientRect().top <= offset) {
      activeId = heading.id;
    }
  }
  return activeId;
}
