import type {TableHTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

/**
 * Docusaurus/MDX table adapter. oVita keeps its richer TableBlock wrapper,
 * but both hosts share the same `de-table` visual contract.
 */
export function Table({className, ...props}: TableProps) {
  return (
    <div className="de-table-shell">
      <div className="de-table-scroll">
        <table className={joinClassNames('de-table', className)} {...props} />
      </div>
    </div>
  );
}
