import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type TransitionProps = HTMLAttributes<HTMLDivElement>;
export type TransitionCardProps = HTMLAttributes<HTMLDivElement> & {
  target?: boolean;
};
export type TransitionPartProps = HTMLAttributes<HTMLElement>;

export function Transition({className, ...props}: TransitionProps) {
  return <div className={joinClassNames('de-transition', className)} {...props} />;
}

export function TransitionCard({className, target = false, ...props}: TransitionCardProps) {
  return (
    <div
      className={joinClassNames('de-transition-card', target && 'de-transition-card--target', className)}
      {...props}
    />
  );
}

export function TransitionArrow({className, ...props}: TransitionPartProps) {
  return <span aria-hidden="true" className={joinClassNames('de-transition-arrow', className)} {...props} />;
}

export function TransitionLabel({className, ...props}: TransitionPartProps) {
  return <span className={joinClassNames('de-transition-label', className)} {...props} />;
}

export function TransitionTitle({className, ...props}: TransitionPartProps) {
  return <strong className={joinClassNames('de-transition-title', className)} {...props} />;
}

export function TransitionCopy({className, ...props}: TransitionPartProps) {
  return <p className={joinClassNames('de-transition-copy', className)} {...props} />;
}
