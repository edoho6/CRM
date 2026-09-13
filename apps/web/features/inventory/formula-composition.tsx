import { useFormatter, useTranslations } from 'next-intl';
import { EmptyNote, cn } from '@clinic/ui';
import {
  pieArcs,
  tasteComposition,
  temperatureComposition,
  TASTES,
  type CompositionHerb,
  type CompositionSlice,
  type Taste,
  type Temperature,
} from '@clinic/domain';

/**
 * Two pies for a formula: what it is by nature, and what it is by taste.
 *
 * Counted by herb — "three warm, seven cool" is how a formula's character
 * is read — and drawn as a ring with a gap between wedges, a legend that
 * names every wedge with its count, and one line that says the lean. The
 * legend is the chart for a screen reader and for anyone who cannot tell
 * the colours apart; the ring is the glance.
 *
 * The natures fold into five bands for the ring (hot, warm, neutral, cool,
 * cold): eight wedges of red-to-blue cannot be told apart, five can, and
 * the exact natures are listed under the ring. The colours are the chart
 * tokens in globals.css, a diverging warm–grey–cool scale for nature and
 * eight fixed hues for taste, checked with the palette validator in both
 * themes; the warm and the cool ends are never adjacent to each other.
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

  // The ring's wedges: the natures folded into their bands, in band order.
  const bandCounts = new Map<TemperatureBand, number>();
  for (const slice of temperature.slices) bandCounts.set(BAND_OF[slice.key], (bandCounts.get(BAND_OF[slice.key]) ?? 0) + slice.count);
  const bandSlices: CompositionSlice<TemperatureBand>[] = BANDS.filter((band) => bandCounts.has(band)).map((band) => ({
    band,
    key: band,
    count: bandCounts.get(band)!,
    share: bandCounts.get(band)! / temperature.known,
  }));

  const percent = (share: number) => format.number(share, { style: 'percent', maximumFractionDigits: 0 });
  const parts = <K extends string>(slices: readonly CompositionSlice<K>[], label: (key: K) => string) =>
    slices.map((slice) => `${label(slice.key)} ${slice.count}`).join(', ');

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Pie
        title={t('temperature')}
        aria={t('ariaTemperature', { parts: parts(bandSlices, (band) => tTemp(band)) })}
        slices={bandSlices}
        colorOf={bandColor}
        labelOf={(band) => tTemp(band)}
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
      <Pie
        title={t('tastes')}
        aria={t('ariaTastes', { parts: parts(tastes.slices, (taste) => tTaste(taste)) })}
        slices={tastes.slices}
        colorOf={tasteColor}
        labelOf={(taste) => tTaste(taste)}
        percent={percent}
        summary={<span>{t('tasteHint')}</span>}
        detail={tastes.unknown > 0 ? <span>{t('unknownTaste', { count: tastes.unknown })}</span> : null}
      />
    </div>
  );
}

function Pie<K extends string>({
  title,
  aria,
  slices,
  colorOf,
  labelOf,
  percent,
  summary,
  detail,
}: {
  title: string;
  aria: string;
  slices: readonly CompositionSlice<K>[];
  colorOf: (key: K) => string;
  labelOf: (key: K) => string;
  percent: (share: number) => string;
  summary: React.ReactNode;
  detail?: React.ReactNode;
}) {
  const arcs = pieArcs(slices, 40, 17);
  return (
    <figure className="rounded-lg border border-ink-200 bg-white p-3">
      <figcaption className="mb-2 text-sm font-semibold text-ink-900">{title}</figcaption>
      {arcs.length === 0 ? (
        <p className="text-sm text-ink-600">–</p>
      ) : (
        <div className="flex items-center gap-4">
          {/* The gap between wedges is the card's own surface, so it holds in both themes. */}
          <svg viewBox="0 0 80 80" role="img" aria-label={aria} className="h-24 w-24 shrink-0">
            {arcs.map((arc) => (
              <path key={arc.key} d={arc.d} fill={colorOf(arc.key)} stroke="var(--color-white)" strokeWidth={1.5} strokeLinejoin="round">
                <title>{`${labelOf(arc.key)}: ${arc.count} (${percent(arc.share)})`}</title>
              </path>
            ))}
          </svg>
          <ul className="min-w-0 flex-1 space-y-1 text-sm">
            {slices.map((slice) => (
              <li key={slice.key} className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorOf(slice.key) }} />
                <span className="min-w-0 truncate text-ink-900">{labelOf(slice.key)}</span>
                <span className="ms-auto shrink-0 tabular-nums text-ink-600">
                  {slice.count} · {percent(slice.share)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-600">{summary}</p>
      {detail ? <p className="mt-1 text-xs text-ink-500">{detail}</p> : null}
    </figure>
  );
}

/** Every taste has a colour token; the type keeps the list and the stylesheet honest. */
export const TASTE_TOKENS: readonly Taste[] = TASTES;
