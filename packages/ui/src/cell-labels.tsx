'use client';

import * as React from 'react';

/**
 * Gives every cell the name of its column, for the phone layout.
 *
 * Under `md` a `TableWrapper` marked `responsive` lays each row out as a
 * card, and a card needs each value labelled — "phone: 050…", not a bare
 * number. The labels are the column headings, read once from the table's
 * own `<thead>` and written onto each cell as `data-label`, which the
 * stylesheet shows before the value. Rows are server-rendered, so the
 * labelling is done here after mount rather than by every page repeating
 * its headings on every cell.
 *
 * Re-run when rows are re-sorted or replaced: the observer watches the body.
 */
export function CellLabels() {
  const anchor = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const table = anchor.current?.closest('.table-cards')?.querySelector('table');
    if (!table) return;

    const label = () => {
      const headings = Array.from(table.querySelectorAll('thead th')).map((th) =>
        (th.textContent ?? '').trim(),
      );
      for (const row of table.querySelectorAll('tbody tr')) {
        let column = 0;
        for (const cell of row.querySelectorAll('td')) {
          const heading = headings[column] ?? '';
          if (heading && cell.colSpan === 1) cell.setAttribute('data-label', heading);
          else cell.removeAttribute('data-label');
          column += cell.colSpan;
        }
      }
    };

    label();
    const body = table.querySelector('tbody');
    if (!body) return;
    const observer = new MutationObserver(label);
    observer.observe(body, { childList: true });
    return () => observer.disconnect();
  }, []);

  return <span ref={anchor} hidden />;
}
