import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type StatusTone = 'done' | 'progress' | 'todo' | 'neutral';

export type StatusProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function Status({className, tone = 'neutral', ...props}: StatusProps) {
  return <span className={joinClassNames('de-badge', className)} data-kind="status" data-value={tone} {...props} />;
}
