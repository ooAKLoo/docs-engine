import {Link2} from 'lucide-react';
import type {AnchorHTMLAttributes, ReactNode} from 'react';
import {joinClassNames} from '../classnames.js';

export type ResourceLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> & {
  children?: ReactNode;
  href: string;
};

/**
 * External or operational resource link with a stable icon and no-wrap layout.
 * Long links expand the table and rely on the shared table shell for horizontal scrolling.
 */
export function ResourceLink({children, className, href, ...props}: ResourceLinkProps) {
  return (
    <a className={joinClassNames('de-resource-link', className)} href={href} {...props}>
      <Link2
        aria-hidden="true"
        className="de-resource-link__icon"
        focusable="false"
        size={15}
        strokeWidth={1.8}
      />
      <span className="de-resource-link__label">{children ?? href}</span>
    </a>
  );
}
