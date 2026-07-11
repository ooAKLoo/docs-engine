import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type PriorityLevel = 'p0' | 'p1' | 'p2';

export type PriorityProps = HTMLAttributes<HTMLSpanElement> & {
  level?: PriorityLevel;
};

export function Priority({className, level = 'p1', ...props}: PriorityProps) {
  return <span className={joinClassNames('de-badge', className)} data-kind="priority" data-value={level} {...props} />;
}
