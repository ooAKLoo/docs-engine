import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';
import type {CalloutVariant} from '../model.js';

export type CalloutProps = HTMLAttributes<HTMLElement> & {
  variant?: Exclude<CalloutVariant, 'annotation'>;
};

export function Callout({className, variant = 'note', ...props}: CalloutProps) {
  return <aside className={joinClassNames('de-callout', className)} data-variant={variant} {...props} />;
}
