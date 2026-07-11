import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type DocumentContentProps = HTMLAttributes<HTMLDivElement>;

export function DocumentContent({className, ...props}: DocumentContentProps) {
  return <div className={joinClassNames('de-root', 'de-prose', className)} {...props} />;
}
