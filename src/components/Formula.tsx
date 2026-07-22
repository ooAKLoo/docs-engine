import katex from 'katex';
import type {HTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type FormulaProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** A LaTeX expression. */
  latex: string;
  /** Keep the formula visually compact when it is part of dense reference content. */
  compact?: boolean;
};

/**
 * A display-math block for documents. Rendering is synchronous and SSR-safe, so the same
 * mathematical typography is emitted on the server and after hydration.
 */
export function Formula({className, compact = false, latex, ...props}: FormulaProps) {
  const html = katex.renderToString(latex, {
    displayMode: true,
    output: 'htmlAndMathml',
    strict: 'ignore',
    throwOnError: false,
  });

  return (
    <div
      className={joinClassNames('de-formula', className)}
      data-compact={compact ? 'true' : undefined}
      {...props}
    >
      <span dangerouslySetInnerHTML={{__html: html}} />
    </div>
  );
}
