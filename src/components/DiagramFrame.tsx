import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type DiagramFrameProps = HTMLAttributes<HTMLDivElement>;

export function DiagramFrame({className, ...props}: DiagramFrameProps) {
  return <figure className={joinClassNames('de-diagram', className)} {...props} />;
}
