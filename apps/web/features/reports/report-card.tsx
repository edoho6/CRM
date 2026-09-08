'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Card, CardBody, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';

/**
 * The frame every chart on the report sits in.
 *
 * Title, the one number the section exists to deliver, the chart, and a way to
 * read the same data as a table.
 *
 * The table is not a courtesy. A chart that cannot be read — by someone using a
 * screen reader, by someone who needs the exact figure rather than the shape, or
 * by anyone printing it in black and white — is a chart for some people. It is
 * also the fastest way to answer "what was March", which a bar cannot do.
 */

export interface ReportTable {
  columns: string[];
  rows: Record<string, string | number | null>[];
  /** Column headers, already translated. Falls back to the raw column name. */
  headers?: Record<string, string>;
}

export function ReportCard({
  title,
  headline,
  hint,
  table,
  failed = false,
  children,
}: {
  title: string;
  /** The figure the section is about, stated rather than left to be read off. */
  headline?: string;
  hint?: string;
  table: ReportTable;
  /**
   * The query behind this section did not run. Said as such, and separately
   * from "no data": a clinic with no bookings and a report that could not
   * reach the bookings table used to show the same sentence, and only one of
   * those is something to act on.
   */
  failed?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('reports');
  const [showTable, setShowTable] = useState(false);

  const empty = failed || table.rows.length === 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {headline ? (
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink-900" dir="ltr">
              {headline}
            </p>
          ) : null}
          {hint ? <p className="mt-0.5 text-xs text-ink-600">{hint}</p> : null}
        </div>

        {/* Nothing to draw is said in words. A chart with no bars looks like a
            chart that failed to load. */}
        {failed ? (
          <Alert tone="warning">{t('unavailable')}</Alert>
        ) : empty ? (
          <p className="py-6 text-center text-sm text-ink-600">{t('noData')}</p>
        ) : (
          children
        )}

        {!empty ? (
          <div className="no-print">
            <button
              type="button"
              onClick={() => setShowTable((current) => !current)}
              aria-expanded={showTable}
              className="rounded-md text-xs font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-700"
            >
              {showTable ? t('hideTable') : t('showTable')}
            </button>
          </div>
        ) : null}

        {/* Printed always, on screen only when asked: on paper there is no
            button to press and no colour to rely on. */}
        {!empty ? (
          <div className={showTable ? undefined : 'hidden print:block'}>
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <Th key={column}>{table.headers?.[column] ?? column}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <Tr key={index}>
                      {table.columns.map((column) => {
                        const value = row[column];
                        const isNumber = typeof value === 'number';
                        return (
                          <Td
                            key={column}
                            dir={isNumber ? 'ltr' : 'auto'}
                            className={isNumber ? 'tabular-nums' : undefined}
                          >
                            {value === null || value === '' ? '—' : String(value)}
                          </Td>
                        );
                      })}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
