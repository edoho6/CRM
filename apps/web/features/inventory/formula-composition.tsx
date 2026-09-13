'use client';

import { useId, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { EmptyNote, cn } from '@clinic/ui';
import {
  pieArcs,
  tasteComposition,
  temperatureComposition,
  type CompositionHerb,
  type CompositionSlice,
  type Taste,
  type Temperature,
} from '@clinic/domain';

/**
 * Two rings for a formula: what it is by nature, and what it is by taste,
 * counted by herb — "three warm, seven cool" is how a formula's character
 * is read. Narrow on purpose: the page keeps them in a side column.
 *
 * Every wedge knows its herbs. Hovering a wedge, or hovering, focusing or
 * clicking its row in the legend, names them under the row and lifts the
 * wedge; a click pins it. The legend is the chart for a screen reader and
 * for anyone who cannot tell the colours apart — each row carries its
 * label and count — and the ring is the glance.
 *
 * The natures fold into five bands (hot, warm, neutral, cool, cold): eight
 * wedges of red-to-blue cannot be told apart, five can, and the exact
 * natures are listed under the ring. Colours are the chart tokens in
 * globals.css — red for hot, blue for cold, grey between; green for sour,
 * yellow for sweet, red for acrid, the faintest grey for bland — and the
 * tastes go round the ring in an order that keeps red away from green.
 */

type TemperatureBand = 'hot' | 'warm' | 'neutral' | 'cool' | 'cold';

const BAND_OF: Record<Temperature, TemperatureBand> = {
  hot: 'hot',
  warm: 'warm',
  slightly_warm: 'warm',
  neutral: 'neutral',
  cool: 'cool',
  slightly_cold: 'cool',
  cold: 'cold',
  very_cold: 'cold',
};
const BANDS: readonly TemperatureBand[] = ['hot', 'warm', 'neutral', 'cool', 'cold'];
/** Round the ring: no red beside a green or a brown, no blue beside a violet. */
const TASTE_ORDER: readonly Taste[] = ['sweet', 'sour', 'salty', 'acrid', 'bland', 'bitter', 'astringent', 'aromatic'];

const bandColor = (band: TemperatureBand) => `var(--chart-temp-${band})`;
const tasteColor = (taste: Taste) => `var(--chart-taste-${taste})`;

export function FormulaComposition({ herbs, className }: { herbs: readonly (CompositionHerb | null | undefined)[]; className?: string }) {
  const t = useTranslations('inventory.formulas.composition');
  const tTemp = useTranslations('inventory.temperature');
  const tTaste = useTranslations('inventory.taste');
  const format = useFormatter();

  const temperature = temperatureComposition(herbs);
  const tastes = tasteComposition(herbs);
  // Nothing recorded on any herb: say so, rather than draw two empty rings.
  if (temperature.known === 0 && tastes.mentions === 0) return <EmptyNote className={className}>{t('none')}</EmptyNote>;

  // The ring's wedges: the natures folded into their bands, in band order,
  // each band carrying the herbs of every nature in it.
  const bands = new Map<TemperatureBand, { count: number; herbs: string[] }>();
  for (const slice of temperature.slices) {
    const band = BAND_OF[slice.key];
    const row = bands.get(band) ?? { count: 0, herbs: [] };
    row.count += slice.count;
    row.herbs.push(...slice.herbs);
    bands.set(band, row);
  }
  const bandSlices: CompositionSlice<TemperatureBand>[] = BANDS.filter((band) => bands.has(band)).map((band) => ({
    key: band,
    count: bands.get(band)!.count,
    share: bands.get(band)!.count / temperature.known,
    herbs: bands.get(band)!.herbs,
  }));
  const tasteSlices = TASTE_ORDER.map((taste) => tastes.slices.find((slice) => slice.key === taste)).filter((slice): slice is CompositionSlice<Taste> => Boolean(slice));

  const percent = (share: number) => format.number(share, { style: 'percent', maximumFractionDigits: 0 });
  const parts = <K extends string>(slices: readonly CompositionSlice<K>[], label: (key: K) => string) =>
    slices.map((slice) => `${label(slice.key)} ${slice.count}`).join(', ');

  return (
    <div className={cn('space-y-3', className)}>
      <Ring
        title={t('temperature')}
        aria={t('ariaTemperature', { parts: parts(bandSlices, (band) => tTemp(band)) })}
        slices={bandSlices}
        total={temperature.known}
        centerLabel={t('center')}
        colorOf={bandColor}
        labelOf={(band) => tTemp(band)}
        herbsOf={(band) => t('herbsOf', { label: tTemp(band) })}
        percent={percent}
        summary={
          <>
            <span className="font-medium text-ink-800">{t(`lean.${temperature.lean}`)}</span>
            {temperature.known > 0 ? <span> · {t('sides', { warm: temperature.warm, cool: temperature.cool, neutral: temperature.neutral })}</span> : null}
          </>
        }
        detail={
          <>
            {temperature.slices.length > 0 ? (
              <span>
                {t('detail')} {temperature.slices.map((slice) => `${tTemp(slice.key)} ${slice.count}`).join(' · ')}
              </span>
            ) : null}
            {temperature.unknown > 0 ? <span className="block">{t('unknownTemperature', { count: temperature.unknown })}</span> : null}
          </>
        }
      />
      <Ring
        title={t('tastes')}
        aria={t('ariaTastes', { parts: parts(tasteSlices, (taste) => tTaste(taste)) })}
        slices={tasteSlices}
        total={herbs.filter(Boolean).length - tastes.unknown}
        centerLabel={t('center')}
        colorOf={tasteColor}
        labelOf={(taste) => tTaste(taste)}
        herbsOf={(taste) => t('herbsOf', { label: tTaste(taste) })}
        percent={percent}
        summary={<span>{t('tasteHint')}</span>}
        detail={tastes.unknown > 0 ? <span>{t('unknownTaste', { count: tastes.unknown })}</span> : null}
      />
      <p className="text-xs text-ink-500">{t('hint')}</p>
    </div>
  );
}

const RADIUS = 46;
const HOLE = 27;

function Ring<K extends string>({
  title,
  aria,
  slices,
  total,
  centerLabel,
  colorOf,
  labelOf,
  herbsOf,
  percent,
  summary,
  detail,
}: {
  title: string;
  aria: string;
  slices: readonly CompositionSlice<K>[];
  total: number;
  centerLabel: string;
  colorOf: (key: K) => string;
  labelOf: (key: K) => string;
  herbsOf: (key: K) => string;
  percent: (share: number) => string;
  summary: React.ReactNode;
  detail?: React.ReactNode;
}) {
  const id = useId();
  // Hovered follows the pointer; pinned stays after a click, so the list can be read.
  const [hovered, setHovered] = useState<K | null>(null);
  const [pinned, setPinned] = useState<K | null>(null);
  const shown = pinned ?? hovered;
  const current = shown ? (slices.find((slice) => slice.key === shown) ?? null) : null;
  const arcs = pieArcs(slices, RADIUS, HOLE);
  const size = RADIUS * 2;

  return (
    <figure className="rounded-xl border border-ink-200 bg-white p-3 shadow-sm">
      <figcaption className="mb-2 text-sm font-semibold text-ink-900">{title}</figcaption>
      {arcs.length === 0 ? (
        <p className="text-sm text-ink-600">–</p>
      ) : (
        <div className="flex items-start gap-3">
          <svg
            viewBox={`-2 -2 ${size + 4} ${size + 4}`}
            role="img"
            aria-label={aria}
            className="h-28 w-28 shrink-0"
            onMouseLeave={() => setHovered(null)}
          >
            {/* The ring's two edges, so the faintest wedge still has a rim. */}
            <circle cx={RADIUS} cy={RADIUS} r={RADIUS + 0.75} fill="none" stroke="var(--color-ink-200)" strokeWidth={1} />
            <circle cx={RADIUS} cy={RADIUS} r={HOLE - 0.75} fill="none" stroke="var(--color-ink-200)" strokeWidth={1} />
            {arcs.map((arc) => (
              <path
                key={arc.key}
                d={arc.d}
                fill={colorOf(arc.key)}
                stroke="var(--color-white)"
                strokeWidth={2}
                strokeLinejoin="round"
                className={cn(
                  'cursor-pointer transition-[opacity,transform] duration-(--duration-fast)',
                  shown && shown !== arc.key && 'opacity-35',
                  shown === arc.key && 'scale-[1.05]',
                )}
                style={{ transformOrigin: `${RADIUS}px ${RADIUS}px` }}
                onMouseEnter={() => setHovered(arc.key)}
                onClick={() => setPinned((value) => (value === arc.key ? null : arc.key))}
              >
                <title>{`${labelOf(arc.key)}: ${arc.herbs.length ? arc.herbs.join(', ') : arc.count}`}</title>
              </path>
            ))}
            <text x={RADIUS} y={RADIUS - 1} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--color-ink-900)" className="tabular-nums">
              {current ? current.count : total}
            </text>
            <text x={RADIUS} y={RADIUS + 10} textAnchor="middle" fontSize={7.5} fill="var(--color-ink-600)">
              {current ? labelOf(current.key) : centerLabel}
            </text>
          </svg>

          <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
            {slices.map((slice) => {
              const on = shown === slice.key;
              const listId = `${id}-${slice.key}`;
              return (
                <li key={slice.key}>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={listId}
                    aria-label={herbsOf(slice.key)}
                    onMouseEnter={() => setHovered(slice.key)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(slice.key)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setPinned((value) => (value === slice.key ? null : slice.key))}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-start transition-colors duration-(--duration-fast)',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      on ? 'bg-ink-100' : 'hover:bg-ink-50',
                    )}
                  >
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm border border-ink-900/10" style={{ background: colorOf(slice.key) }} />
                    <span className="min-w-0 flex-1 truncate text-ink-900">{labelOf(slice.key)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-600">
                      {slice.count} · {percent(slice.share)}
                    </span>
                  </button>
                  <p id={listId} hidden={!on} className="ps-6 pe-1 pb-1 text-xs leading-5 text-ink-700" dir="auto">
                    {slice.herbs.length ? slice.herbs.join(' · ') : '–'}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-600">{summary}</p>
      {detail ? <p className="mt-1 text-xs text-ink-500">{detail}</p> : null}
    </figure>
  );
}
