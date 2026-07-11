import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type AnnotationProps = HTMLAttributes<HTMLParagraphElement>;

export function Annotation({className, ...props}: AnnotationProps) {
  return <p className={joinClassNames('de-annotation', className)} {...props} />;
}
