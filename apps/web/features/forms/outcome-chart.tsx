'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Select, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { formatDate } from '@clinic/i18n';

/**
 * One scale question, plotted across the times it was asked.
 *
 * This is what turns a questionnaire from a document into a measure. "Rate your
 * pain from 0 to 10" answered once is a note; answered at every visit it is the
 * only objective account of whether the treatment is working, and reading that
 * off a list of submissions is not something anyone does.
 *
 * Deliberately one question at a time. Two scales on one pair of axes invites
 * reading a relationship between them that the numbers do not support — a pain
 * scale and a sleep scale share nothing but a range.
 *
 * Drawn as inline SVG rather than with a charting library: one line, a handful
 * of points, no zoom or brush. A library here would be more code to load than
 * the chart it draws.
 */

export interface OutcomePoint {
  date: string;
  value: number;
}

export interface OutcomeSeries {
  fieldId: string;
  label: string;
  min: number;
  max: number;
  minLabel: string | null;
  maxLabel: string | null;
  points: OutcomePoint[];
}

const WIDTH = 560;
const HEIGHT = 200;
const PADDING = { top: 12, right: 16, bottom: 28, left: 34 };

export function OutcomeChart({ series }: { series: OutcomeSeries[] }) {
  const t = useTranslations('forms');
  const format = useFormatter();
  const [fieldId, setFieldId] = useState(series[0]?.fieldId ?? '');
  const [showTable, setShowTable] = useState(false);

  const active = series.find((entry) => entry.fieldId === fieldId) ?? series[0] ?? null;

  const geometry = useMemo(() => {
    if (!active || active.points.length === 0) return null;

    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const span = Math.max(active.max - active.min, 1);

    // Time is the x axis, so the gaps between visits are real rather than every
    // submission being one step apart — three sessions in a week and then a
    // month off should look like that.
    const times = active.points.map((point) => new Date(point.date).getTime());
    const first = Math.min(...times);
    const last = Math.max(...times);
    const timeSpan = Math.max(last - first, 1);

    const coords = active.points.map((point, index) => {
      const time = new Date(point.date).getTime();
      // A single point has nowhere to sit along a range of zero, so it centres.
      const ratio = active.points.length === 1 ? 0.5 : (time - first) / timeSpan;
      return {
        key: `${point.date}:${index}`,
        date: point.date,
        value: point.value,
        x: PADDING.left + ratio * plotWidth,
        y: PADDING.top + (1 - (point.value - active.min) / span) * plotHeight,
      };
    });

    return { coords, plotHeight, span };
  }, [active]);

  if (!active || active.points.length === 0) return null;

  const path = geometry ? geometry.coords.map((c) => `${c.x},${c.y}`).join(' ') : '';
  const latest = active.points[active.points.length - 1]!;
  const first = active.points[0]!;
  const change = latest.value - first.value;

  return (
    <div className="space-y-3">
      {series.length > 1 ? (
        <Select
          aria-label={t('outcomeQuestion')}
          value={active.fieldId}
          onChange={(event) => setFieldId(event.target.value)}
          className="max-w-md"
        >
          {series.map((entry) => (
            <option key={entry.fieldId} value={entry.fieldId}>
              {entry.label}
            </option>
          ))}
        </Select>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-ink-900" dir="auto">
          {active.label}
        </h3>
        {/* The headline the chart exists to deliver, stated rather than left to
            be read off the line. */}
        <p className="mt-0.5 text-sm text-ink-700">
          {t('outcomeSummary', {
            count: active.points.length,
            first: first.value,
            latest: latest.value,
          })}
          {change !== 0 ? (
            <span className="ms-1 text-ink-600">
              ({change > 0 ? '+' : ''}
              {change})
            </span>
          ) : null}
        </p>
      </div>

      {/* The chart is decorative for a screen reader — the same numbers are in
          the summary above and in the table below — so it is hidden from the
          accessibility tree rather than described badly. */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[200px] w-full min-w-[420px]"
          role="presentation"
          aria-hidden
        >
          {/* Three gridlines: the two ends of the scale and its middle. More
              would be a grid competing with the line it is meant to support. */}
          {[0, 0.5, 1].map((fraction) => {
            const y = PADDING.top + fraction * (HEIGHT - PADDING.top - PADDING.bottom);
            const value = Math.round(active.max - fraction * (active.max - active.min));
            return (
              <g key={fraction}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  className="stroke-ink-200"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-ink-500 text-[10px]"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {geometry && geometry.coords.length > 1 ? (
            <polyline
              points={path}
              fill="none"
              className="stroke-jade-700"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {geometry?.coords.map((coord) => (
            <g key={coord.key}>
              {/* A ring in the surface colour so a marker that lands on the line
                  is still a separate mark rather than a thickening of it. */}
              <circle cx={coord.x} cy={coord.y} r={5} className="fill-white" />
              <circle cx={coord.x} cy={coord.y} r={4} className="fill-jade-700" />
              <title>
                {formatDate(new Date(coord.date))} · {coord.value}
              </title>
            </g>
          ))}

          {/* Only the ends are dated. Every point labelled turns the axis into a
              wall of text at any real number of visits. */}
          {geometry && geometry.coords.length > 0 ? (
            <>
              <text
                x={geometry.coords[0]!.x}
                y={HEIGHT - 8}
                textAnchor="start"
                className="fill-ink-500 text-[10px]"
              >
                {formatDate(new Date(geometry.coords[0]!.date))}
              </text>
              {geometry.coords.length > 1 ? (
                <text
                  x={geometry.coords[geometry.coords.length - 1]!.x}
                  y={HEIGHT - 8}
                  textAnchor="end"
                  className="fill-ink-500 text-[10px]"
                >
                  {format.dateTime(
                    new Date(geometry.coords[geometry.coords.length - 1]!.date),
                    'short',
                  )}
                </text>
              ) : null}
            </>
          ) : null}
        </svg>
      </div>

      {active.minLabel || active.maxLabel ? (
        <p className="text-xs text-ink-600">
          {active.min} = {active.minLabel ?? '—'} · {active.max} = {active.maxLabel ?? '—'}
        </p>
      ) : null}

      {/* The same data as numbers. A chart that cannot be read is not a chart
          for everyone, and this is also the fastest way to read one value. */}
      <div>
        <button
          type="button"
          onClick={() => setShowTable((current) => !current)}
          aria-expanded={showTable}
          className="rounded-md text-xs font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-700"
        >
          {showTable ? t('hideTable') : t('showTable')}
        </button>
        {showTable ? (
          <TableWrapper className="mt-2">
            <Table>
            <thead>
              <Tr>
                <Th>{t('answeredOn')}</Th>
                <Th>{active.label}</Th>
              </Tr>
            </thead>
            <tbody>
              {active.points.map((point, index) => (
                <Tr key={`${point.date}:${index}`}>
                  <Td dir="ltr" className="tabular-nums">
                    {formatDate(new Date(point.date))}
                  </Td>
                  <Td className="tabular-nums">{point.value}</Td>
                </Tr>
              ))}
            </tbody>
            </Table>
          </TableWrapper>
        ) : null}
      </div>
    </div>
  );
}
