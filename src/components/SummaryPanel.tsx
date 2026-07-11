import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type SummaryPanelProps = HTMLAttributes<HTMLDivElement>;

export function SummaryPanel({className, ...props}: SummaryPanelProps) {
  return <section className={joinClassNames('de-summary-panel', className)} {...props} />;
}
