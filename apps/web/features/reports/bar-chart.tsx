'use client';

import { useId } from 'react';
import { useFormatter } from 'next-intl';

/**
 * Counts over months, as vertical bars.
 *
 * Bars rather than a line, because these are discrete periods being compared
 * rather than a continuous quantity being tracked: "March against April" is the
 * question, and a line between two months implies values in between that do not
 * exist.
 *
 * One or two series. There is no third, and that is a limit rather than an
 * omission — the two colours were measured against each other and against both
 * chart surfaces, and a third would have to be measured against both of them
 * before it could be used. See `--color-series-1` in `globals.css`.
 *
 * Inline SVG, no library: a dozen rectangles and two axis labels.
 */

export interface BarSeries {
  /** Shown in the legend. Never rendered in the series colour — see below. */
  label: string;
  values: number[];
}

const HEIGHT = 180;
const PADDING = { top: 8, bottom: 22 };

export function BarChart({
  labels,
  series,
  unit = 'count',
}: {
  /** One per column, already formatted for display. */
  labels: string[];
  series: [BarSeries] | [BarSeries, BarSeries];
  /*
   * How to write a value in the tooltip. A name rather than a formatting
   * function, because the pages that use this chart are Server Components and a
   * function cannot cross that boundary — it would arrive as a client reference
   * and fail at run time, with a build that passed.
   */
  unit?: 'count' | 'currency';
}) {
  const id = useId();
  const format = useFormatter();
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const formatValue = (value: number) =>
    unit === 'currency'
      ? format.number(value, 'currency')
      : format.number(value);

  // A single scale across both series, so the two are comparable. Two scales
  // would be the dual-axis mistake wearing a different hat.
  const max = Math.max(1, ...series.flatMap((entry) => entry.values));

  /* Up to six months every label fits; past that they would collide, so only
     the first, the last and roughly the middle are printed. Four bars with
     three labels read as a missing month, not as thinning. */
  const labelAt = (index: number) =>
    labels.length <= 6 ||
    index === 0 ||
    index === labels.length - 1 ||
    index === Math.floor((labels.length - 1) / 2);

  return (
    <div className="space-y-2">
      {series.length > 1 ? (
        <ul className="flex flex-wrap items-center gap-3">
          {series.map((entry, index) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              {/* The swatch carries the identity; the word stays in a text
                  colour. A label printed in its own series colour is a label
                  that fails its own contrast check. */}
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: `var(--color-series-${index + 1})` }}
              />
              <span className="text-xs text-ink-700">{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Hidden from the accessibility tree: the same numbers are in the card's
          headline and in its table, and a bar chart narrated bar by bar is
          noise. */}
      <div className="overflow-x-auto">
        {/* Scaled uniformly, not stretched to the container. `preserveAspectRatio="none"`
            would fill the width, but it scales x and y independently — the bars
            would be fine and the month labels under them would come out
            horizontally squashed or smeared depending on the card. A slightly
            shorter chart is a better trade than distorted text. */}
        <svg
          viewBox={`0 0 ${Math.max(labels.length * 44, 280)} ${HEIGHT}`}
          width={Math.max(labels.length * 44, 280)}
          height={HEIGHT}
          className="mx-auto block"
          role="presentation"
          aria-hidden
        >
          {labels.map((label, index) => {
            const columnWidth = 44;
            const x = index * columnWidth;
            const barWidth = series.length > 1 ? 14 : 20;
            const gap = series.length > 1 ? 3 : 0;
            const groupWidth = barWidth * series.length + gap * (series.length - 1);
            const startX = x + (columnWidth - groupWidth) / 2;

            return (
              <g key={`${id}-${index}`}>
                {series.map((entry, seriesIndex) => {
                  const value = entry.values[index] ?? 0;
                  const barHeight = (value / max) * plotHeight;
                  return (
                    <rect
                      key={seriesIndex}
                      x={startX + seriesIndex * (barWidth + gap)}
                      // A zero-height bar is invisible and reads as missing
                      // data, so a value of nought keeps a one-pixel foot.
                      y={PADDING.top + plotHeight - Math.max(barHeight, value > 0 ? 1 : 0)}
                      width={barWidth}
                      height={Math.max(barHeight, value > 0 ? 1 : 0)}
                      rx={2}
                      fill={`var(--color-series-${seriesIndex + 1})`}
                    >
                      <title>
                        {/* One string, not three text nodes: React hydrates an SVG
                            title with several children as a mismatch and rebuilds
                            the whole page on the client. */}
                        {`${label} · ${entry.label} · ${formatValue(value)}`}
                      </title>
                    </rect>
                  );
                })}

                {labelAt(index) ? (
                  <text
                    x={x + columnWidth / 2}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    className="fill-ink-500 text-xs"
                  >
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* The baseline, so bars sit on something rather than floating. */}
          <line
            x1={0}
            x2={Math.max(labels.length * 44, 280)}
            y1={PADDING.top + plotHeight}
            y2={PADDING.top + plotHeight}
            className="stroke-ink-200"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
}
