import { TASTES, TEMPERATURES, type Taste, type Temperature } from './enums';

/**
 * What a formula is made of, by nature and by taste.
 *
 * Counted by herb, not by gram: "three warm herbs and seven cool ones" is
 * how a formula's character is read, and it is what the two pies show. A
 * herb with several tastes counts once for each; a herb whose nature is not
 * recorded is counted apart and left out of the lean.
 */

export interface CompositionHerb {
  temperature?: Temperature | null;
  tastes?: readonly Taste[] | null;
}

export interface CompositionSlice<K extends string> {
  key: K;
  count: number;
  /** This slice's share of the counted herbs (or taste mentions), 0–1. */
  share: number;
}

export type TemperatureLean = 'warm' | 'cool' | 'balanced' | 'unknown';

export interface TemperatureComposition {
  slices: CompositionSlice<Temperature>[];
  /** Herbs on each side; neutral is neither. */
  warm: number;
  cool: number;
  neutral: number;
  /** Herbs whose nature is not recorded. */
  unknown: number;
  known: number;
  lean: TemperatureLean;
}

export interface TasteComposition {
  slices: CompositionSlice<Taste>[];
  /** Taste mentions counted — a herb with two tastes adds two. */
  mentions: number;
  /** Herbs with no taste recorded. */
  unknown: number;
}

const WARM = new Set<Temperature>(['hot', 'warm', 'slightly_warm']);
const COOL = new Set<Temperature>(['cool', 'slightly_cold', 'cold', 'very_cold']);

export function temperatureComposition(herbs: readonly (CompositionHerb | null | undefined)[]): TemperatureComposition {
  const counts = new Map<Temperature, number>();
  let unknown = 0;
  for (const herb of herbs) {
    const temperature = herb?.temperature ?? null;
    if (!temperature) {
      unknown += 1;
      continue;
    }
    counts.set(temperature, (counts.get(temperature) ?? 0) + 1);
  }
  const known = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const slices = TEMPERATURES.filter((key) => counts.has(key)).map((key) => ({ key, count: counts.get(key)!, share: counts.get(key)! / known }));
  const warm = slices.filter((slice) => WARM.has(slice.key)).reduce((sum, slice) => sum + slice.count, 0);
  const cool = slices.filter((slice) => COOL.has(slice.key)).reduce((sum, slice) => sum + slice.count, 0);
  const neutral = known - warm - cool;
  // The side with more herbs is the lean; a tie, or nothing known, is not one.
  const lean: TemperatureLean = known === 0 ? 'unknown' : warm > cool ? 'warm' : cool > warm ? 'cool' : 'balanced';
  return { slices, warm, cool, neutral, unknown, known, lean };
}

export function tasteComposition(herbs: readonly (CompositionHerb | null | undefined)[]): TasteComposition {
  const counts = new Map<Taste, number>();
  let unknown = 0;
  for (const herb of herbs) {
    const tastes = (herb?.tastes ?? []).filter((taste): taste is Taste => (TASTES as readonly string[]).includes(taste));
    if (tastes.length === 0) {
      unknown += 1;
      continue;
    }
    for (const taste of new Set(tastes)) counts.set(taste, (counts.get(taste) ?? 0) + 1);
  }
  const mentions = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const slices = TASTES.filter((key) => counts.has(key)).map((key) => ({ key, count: counts.get(key)!, share: counts.get(key)! / mentions }));
  return { slices, mentions, unknown };
}

export interface PieArc<K extends string> {
  key: K;
  count: number;
  share: number;
  /** An SVG path for the wedge, drawn clockwise from twelve o'clock. */
  d: string;
}

/**
 * The wedges of a pie of the given radius, centred on (r, r). A single
 * slice is a full ring rather than an arc whose ends meet, which SVG cannot
 * draw as one path.
 */
export function pieArcs<K extends string>(slices: readonly CompositionSlice<K>[], radius: number, inner = 0): PieArc<K>[] {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return [];
  const cx = radius;
  const cy = radius;
  const point = (r: number, angle: number) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)] as const;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  let start = 0;
  return slices.map((slice) => {
    const sweep = (slice.count / total) * Math.PI * 2;
    const end = start + sweep;
    let d: string;
    if (slices.length === 1) {
      // Two half-circles make the ring.
      const [x0, y0] = point(radius, 0);
      const [x1, y1] = point(radius, Math.PI);
      d = `M ${round(x0)} ${round(y0)} A ${radius} ${radius} 0 1 1 ${round(x1)} ${round(y1)} A ${radius} ${radius} 0 1 1 ${round(x0)} ${round(y0)} Z`;
      if (inner > 0) {
        const [ix0, iy0] = point(inner, 0);
        const [ix1, iy1] = point(inner, Math.PI);
        d += ` M ${round(ix0)} ${round(iy0)} A ${inner} ${inner} 0 1 0 ${round(ix1)} ${round(iy1)} A ${inner} ${inner} 0 1 0 ${round(ix0)} ${round(iy0)} Z`;
      }
    } else {
      const large = sweep > Math.PI ? 1 : 0;
      const [x0, y0] = point(radius, start);
      const [x1, y1] = point(radius, end);
      if (inner > 0) {
        const [ix0, iy0] = point(inner, start);
        const [ix1, iy1] = point(inner, end);
        d = `M ${round(x0)} ${round(y0)} A ${radius} ${radius} 0 ${large} 1 ${round(x1)} ${round(y1)} L ${round(ix1)} ${round(iy1)} A ${inner} ${inner} 0 ${large} 0 ${round(ix0)} ${round(iy0)} Z`;
      } else {
        d = `M ${round(cx)} ${round(cy)} L ${round(x0)} ${round(y0)} A ${radius} ${radius} 0 ${large} 1 ${round(x1)} ${round(y1)} Z`;
      }
    }
    start = end;
    return { key: slice.key, count: slice.count, share: slice.share, d };
  });
}
