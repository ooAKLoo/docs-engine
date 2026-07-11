import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type TableScrollProps = HTMLAttributes<HTMLDivElement>;

export function TableScroll({className, ...props}: TableScrollProps) {
  return <div className={joinClassNames('de-table-scroll', className)} {...props} />;
}
