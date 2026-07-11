import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type RiskGridProps = HTMLAttributes<HTMLDivElement>;
export type RiskItemProps = HTMLAttributes<HTMLDivElement>;

export function RiskGrid({className, ...props}: RiskGridProps) {
  return <div className={joinClassNames('de-check-grid', className)} {...props} />;
}

export function RiskItem({className, ...props}: RiskItemProps) {
  return <div className={joinClassNames('de-check-item', className)} {...props} />;
}
