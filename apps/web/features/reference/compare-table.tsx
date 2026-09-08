import { Sprout } from 'lucide-react';
import { cn } from '@clinic/ui/cn';
import { Link } from '@clinic/i18n/navigation';

/**
 * The side-by-side table.
 *
 * A server component: it takes rendered strings and lays them out. Everything
 * that needed a database or a translator has already happened by the time it is
 * called, which keeps the comparison page's per-kind logic in one place instead
 * of spread through a component that has to know about herbs and points at once.
 *
 * Rows where the entries actually differ are marked. That is the whole job of a
 * comparison table and the thing it is otherwise bad at: eight rows of prose in
 * which two words differ looks identical at a glance, and finding the difference
 * by reading is exactly the work being avoided.
 */

export interface CompareColumn {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
}

export interface CompareRow {
  label: string;
  /** One per column, in the same order. Null renders as a dash. */
  values: (string | null)[];
  /** Latin script, a number, a dosage — kept left-to-right inside Hebrew. */
  ltr?: boolean;
  /** A row worth marking when it differs: temperature, taste, channel. */
  highlight?: boolean;
}

function differs(values: (string | null)[]): boolean {
  const normalised = values.map((value) => (value ?? '').trim().toLowerCase());
  return new Set(normalised).size > 1;
}

export function CompareTable({
  columns,
  rows,
  differsLabel,
  attributeLabel,
}: {
  columns: CompareColumn[];
  rows: CompareRow[];
  /** Announced on a marked row — the tint alone is not a message. */
  differsLabel: string;
  /** Names the first column for a screen reader; the cell itself stays empty. */
  attributeLabel: string;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {/* The corner cell names the axis rather than sitting empty. */}
          <th
            scope="col"
            className="sticky start-0 z-10 w-40 border-b border-ink-200 bg-ink-50 px-3 py-2 text-start text-xs font-semibold text-ink-600"
          >
            <span className="sr-only">{attributeLabel}</span>
          </th>
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              className="min-w-[12rem] border-b border-s border-ink-200 bg-ink-50 px-3 py-2 text-start align-top"
            >
              <Link
                href={column.href}
                className="flex items-start gap-2 underline-offset-2 hover:underline"
              >
                {column.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={column.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md border border-ink-100 object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-jade-50 text-jade-300"
                  >
                    <Sprout className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-jade-800" dir="auto">
                    {column.title}
                  </span>
                  {column.subtitle ? (
                    <span className="block truncate text-xs font-normal text-ink-600" dir="auto">
                      {column.subtitle}
                    </span>
                  ) : null}
                </span>
              </Link>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const marked = Boolean(row.highlight) && differs(row.values);
          return (
            <tr key={row.label} className={cn(marked && 'bg-amber-50/60')}>
              <th
                scope="row"
                className="sticky start-0 z-10 border-b border-ink-100 bg-white px-3 py-2 text-start align-top text-xs font-medium text-ink-600"
              >
                {row.label}
                {/* Marked in words as well as in colour — a tinted row is not a
                    message to anyone reading without colour, and a lone glyph is
                    read aloud as "black diamond suit". */}
                {marked ? (
                  <>
                    <span aria-hidden className="ms-1 text-amber-800">
                      ◆
                    </span>
                    <span className="sr-only"> · {differsLabel}</span>
                  </>
                ) : null}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={columns[index]?.id ?? index}
                  dir={row.ltr ? 'ltr' : 'auto'}
                  className={cn(
                    'border-b border-s border-ink-100 px-3 py-2 align-top',
                    // Nothing recorded is shown as a dash, never as an empty
                    // cell: the reader has to be able to tell "none" from
                    // "the table stopped here".
                    value?.trim() ? 'text-ink-800' : 'text-ink-500',
                  )}
                >
                  {value?.trim() ? value : '—'}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
