import type {HTMLAttributes, ReactNode} from 'react';
import {joinClassNames} from '../classnames.js';

export type AnnotationProps = HTMLAttributes<HTMLElement> & {
  /** Dimension name that belongs with the judgment, e.g. "用户购买原因". */
  label?: ReactNode;
};

export function Annotation({className, label, children, ...props}: AnnotationProps) {
  const classNames = joinClassNames('de-annotation', className);

  if (label != null && label !== '') {
    return (
      <figure className={classNames} {...props}>
        <figcaption className="de-annotation-label">{label}</figcaption>
        <p className="de-annotation-line">{children}</p>
      </figure>
    );
  }

  return (
    <p className={classNames} {...props}>
      {children}
    </p>
  );
}
