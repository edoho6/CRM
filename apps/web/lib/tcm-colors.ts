import type {
  Channel,
  FormulaTcmCategory,
  Taste,
  TcmCategory,
  Temperature,
} from '@clinic/domain';

/**
 * Colour vocabulary for the materia medica.
 *
 * The point is not decoration — it is that a practitioner scanning a list of
 * three hundred herbs should be able to see the shape of the page before
 * reading a single label. So the hues carry meaning rather than being assigned
 * arbitrarily:
 *
 *   Temperature runs a single spectrum, red at hot through neutral stone to
 *   indigo at very cold. That one is the anchor everything else is read
 *   against — warm is red, cooling is blue.
 *
 *   Tastes and channels follow the five phases, which is the mapping a
 *   practitioner already carries in their head: wood green, fire red, earth
 *   yellow, metal grey, water blue. Nothing new to learn.
 *
 *   Categories inherit from the temperature spectrum by what they *do* —
 *   heat-clearers are blues, warming and yang-supporting groups are reds and
 *   oranges, damp and wind groups are greens, spirit groups violet, blood
 *   groups rose and pink.
 *
 * Every class string is written out in full. Tailwind reads source files
 * literally, so a name assembled at runtime (`bg-${hue}-100`) would never be
 * generated into the stylesheet.
 */

export interface ChipStyle {
  /** Badge / chip surface: light fill, dark text, hairline ring. */
  chip: string;
  /** The solid colour on its own, for a dot or a bar. */
  dot: string;
}

const style = (chip: string, dot: string): ChipStyle => ({ chip, dot });

const UNKNOWN = style('bg-ink-100 text-ink-700 ring-1 ring-ink-200', 'bg-ink-300');

/* ------------------------------------------------------------------------- */
/* Temperature — the spectrum every other scale is read against               */
/* ------------------------------------------------------------------------- */

export const TEMPERATURE_STYLES: Record<Temperature, ChipStyle> = {
  hot: style('bg-red-100 text-red-900 ring-1 ring-red-300', 'bg-red-500'),
  warm: style('bg-orange-100 text-orange-900 ring-1 ring-orange-300', 'bg-orange-500'),
  slightly_warm: style('bg-amber-100 text-amber-900 ring-1 ring-amber-200', 'bg-amber-400'),
  neutral: style('bg-stone-100 text-stone-700 ring-1 ring-stone-300', 'bg-stone-400'),
  cool: style('bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200', 'bg-cyan-400'),
  slightly_cold: style('bg-sky-100 text-sky-900 ring-1 ring-sky-300', 'bg-sky-500'),
  cold: style('bg-blue-100 text-blue-900 ring-1 ring-blue-300', 'bg-blue-500'),
  very_cold: style('bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300', 'bg-indigo-600'),
};

/* ------------------------------------------------------------------------- */
/* Tastes — the five phases, extended for the three that sit outside them     */
/* ------------------------------------------------------------------------- */

export const TASTE_STYLES: Record<Taste, ChipStyle> = {
  /* wood */ sour: style('bg-green-100 text-green-900 ring-1 ring-green-300', 'bg-green-500'),
  /* fire */ bitter: style('bg-red-100 text-red-900 ring-1 ring-red-300', 'bg-red-500'),
  /* earth */ sweet: style('bg-yellow-100 text-yellow-900 ring-1 ring-yellow-300', 'bg-yellow-400'),
  /* metal */ acrid: style('bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300', 'bg-zinc-400'),
  /* water */ salty: style('bg-blue-100 text-blue-900 ring-1 ring-blue-300', 'bg-blue-600'),
  bland: style('bg-stone-50 text-stone-600 ring-1 ring-stone-200', 'bg-stone-300'),
  astringent: style('bg-rose-100 text-rose-900 ring-1 ring-rose-300', 'bg-rose-400'),
  aromatic: style('bg-violet-100 text-violet-900 ring-1 ring-violet-300', 'bg-violet-500'),
};

/* ------------------------------------------------------------------------- */
/* Channels — paired by phase; the yin organ carries the deeper fill          */
/* ------------------------------------------------------------------------- */

export const CHANNEL_STYLES: Record<Channel, ChipStyle> = {
  /* metal */
  lung: style('bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300', 'bg-zinc-500'),
  large_intestine: style('bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200', 'bg-zinc-300'),
  /* earth */
  spleen: style('bg-yellow-100 text-yellow-900 ring-1 ring-yellow-300', 'bg-yellow-500'),
  stomach: style('bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200', 'bg-yellow-300'),
  /* sovereign fire */
  heart: style('bg-red-100 text-red-900 ring-1 ring-red-300', 'bg-red-500'),
  small_intestine: style('bg-red-50 text-red-700 ring-1 ring-red-200', 'bg-red-300'),
  /* water */
  kidney: style('bg-blue-100 text-blue-900 ring-1 ring-blue-300', 'bg-blue-600'),
  bladder: style('bg-blue-50 text-blue-700 ring-1 ring-blue-200', 'bg-blue-300'),
  /* ministerial fire */
  pericardium: style('bg-rose-100 text-rose-900 ring-1 ring-rose-300', 'bg-rose-500'),
  san_jiao: style('bg-rose-50 text-rose-700 ring-1 ring-rose-200', 'bg-rose-300'),
  /* wood */
  liver: style('bg-green-100 text-green-900 ring-1 ring-green-300', 'bg-green-600'),
  gallbladder: style('bg-green-50 text-green-700 ring-1 ring-green-200', 'bg-green-300'),
};

/* ------------------------------------------------------------------------- */
/* Herb categories — inherited from what the group does                       */
/* ------------------------------------------------------------------------- */

export const TCM_CATEGORY_STYLES: Record<TcmCategory, ChipStyle> = {
  /* release the exterior: warm disperses, cool vents */
  release_exterior_warm: style('bg-orange-100 text-orange-900 ring-1 ring-orange-300', 'bg-orange-500'),
  release_exterior_cool: style('bg-cyan-100 text-cyan-900 ring-1 ring-cyan-300', 'bg-cyan-500'),

  /* clear heat — the blue family */
  clear_heat_drain_fire: style('bg-blue-100 text-blue-900 ring-1 ring-blue-300', 'bg-blue-500'),
  clear_heat_cool_blood: style('bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300', 'bg-indigo-500'),
  clear_heat_dry_dampness: style('bg-teal-100 text-teal-900 ring-1 ring-teal-300', 'bg-teal-500'),
  clear_heat_relieve_toxicity: style('bg-sky-100 text-sky-900 ring-1 ring-sky-300', 'bg-sky-500'),
  clear_deficient_heat: style('bg-violet-50 text-violet-700 ring-1 ring-violet-200', 'bg-violet-300'),
  clear_summer_heat: style('bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200', 'bg-cyan-300'),

  /* move things out through the bowels */
  downward_draining: style('bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300', 'bg-zinc-500'),
  moist_laxative: style('bg-stone-50 text-stone-600 ring-1 ring-stone-200', 'bg-stone-300'),
  harsh_expellant: style('bg-fuchsia-100 text-fuchsia-900 ring-1 ring-fuchsia-300', 'bg-fuchsia-600'),

  /* dampness and wind-damp — the green family */
  drain_dampness: style('bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300', 'bg-emerald-500'),
  dispel_wind_dampness: style('bg-green-100 text-green-900 ring-1 ring-green-300', 'bg-green-500'),
  aromatic_transform_dampness: style('bg-lime-100 text-lime-900 ring-1 ring-lime-300', 'bg-lime-500'),

  /* phlegm and the breath */
  transform_phlegm_cold: style('bg-slate-100 text-slate-800 ring-1 ring-slate-300', 'bg-slate-500'),
  transform_phlegm_heat: style('bg-sky-50 text-sky-700 ring-1 ring-sky-200', 'bg-sky-300'),
  relieve_cough_wheezing: style('bg-blue-50 text-blue-700 ring-1 ring-blue-200', 'bg-blue-300'),

  /* digestion and qi */
  relieve_food_stagnation: style('bg-yellow-100 text-yellow-900 ring-1 ring-yellow-300', 'bg-yellow-500'),
  regulate_qi: style('bg-amber-50 text-amber-800 ring-1 ring-amber-200', 'bg-amber-300'),

  /* blood — rose and pink, kept clear of the warming reds */
  stop_bleeding: style('bg-rose-100 text-rose-900 ring-1 ring-rose-300', 'bg-rose-500'),
  invigorate_blood: style('bg-pink-100 text-pink-900 ring-1 ring-pink-300', 'bg-pink-500'),

  /* warming and tonifying */
  warm_interior: style('bg-red-100 text-red-900 ring-1 ring-red-300', 'bg-red-600'),
  tonify_qi: style('bg-amber-100 text-amber-900 ring-1 ring-amber-300', 'bg-amber-500'),
  tonify_blood: style('bg-rose-50 text-rose-700 ring-1 ring-rose-200', 'bg-rose-300'),
  tonify_yang: style('bg-orange-50 text-orange-800 ring-1 ring-orange-200', 'bg-orange-300'),
  tonify_yin: style('bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200', 'bg-indigo-300'),

  /* holding in, settling down, opening up */
  stabilize_bind: style('bg-stone-100 text-stone-800 ring-1 ring-stone-300', 'bg-stone-500'),
  calm_spirit_anchor: style('bg-violet-100 text-violet-900 ring-1 ring-violet-300', 'bg-violet-600'),
  calm_spirit_nourish: style('bg-purple-50 text-purple-700 ring-1 ring-purple-200', 'bg-purple-300'),
  aromatic_open_orifices: style('bg-purple-100 text-purple-900 ring-1 ring-purple-300', 'bg-purple-600'),

  extinguish_wind: style('bg-teal-50 text-teal-700 ring-1 ring-teal-200', 'bg-teal-300'),
  expel_parasites: style('bg-lime-50 text-lime-800 ring-1 ring-lime-200', 'bg-lime-300'),
  external_application: style('bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300', 'bg-neutral-400'),
  // Western herbs sit outside the materia medica's families: a stone tone of their own.
  western: style('bg-stone-100 text-stone-700 ring-1 ring-stone-300', 'bg-stone-400'),
  other: style('bg-ink-100 text-ink-700 ring-1 ring-ink-200', 'bg-ink-300'),
};

/* ------------------------------------------------------------------------- */
/* Formula categories — the same families, one entry per group                */
/* ------------------------------------------------------------------------- */

export const FORMULA_TCM_CATEGORY_STYLES: Record<FormulaTcmCategory, ChipStyle> = {
  release_exterior: style('bg-orange-100 text-orange-900 ring-1 ring-orange-300', 'bg-orange-500'),
  clear_heat: style('bg-blue-100 text-blue-900 ring-1 ring-blue-300', 'bg-blue-500'),
  purge: style('bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300', 'bg-zinc-500'),
  harmonize: style('bg-teal-100 text-teal-900 ring-1 ring-teal-300', 'bg-teal-500'),
  treat_dryness: style('bg-sky-100 text-sky-900 ring-1 ring-sky-300', 'bg-sky-500'),
  expel_dampness: style('bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300', 'bg-emerald-500'),
  warm_interior: style('bg-red-100 text-red-900 ring-1 ring-red-300', 'bg-red-600'),
  tonify: style('bg-amber-100 text-amber-900 ring-1 ring-amber-300', 'bg-amber-500'),
  regulate_qi: style('bg-yellow-100 text-yellow-900 ring-1 ring-yellow-300', 'bg-yellow-500'),
  invigorate_blood: style('bg-pink-100 text-pink-900 ring-1 ring-pink-300', 'bg-pink-500'),
  stop_bleeding: style('bg-rose-100 text-rose-900 ring-1 ring-rose-300', 'bg-rose-500'),
  stabilize_bind: style('bg-stone-100 text-stone-800 ring-1 ring-stone-300', 'bg-stone-500'),
  calm_spirit: style('bg-violet-100 text-violet-900 ring-1 ring-violet-300', 'bg-violet-600'),
  open_orifices: style('bg-purple-100 text-purple-900 ring-1 ring-purple-300', 'bg-purple-600'),
  extinguish_wind: style('bg-green-100 text-green-900 ring-1 ring-green-300', 'bg-green-600'),
  treat_phlegm: style('bg-slate-100 text-slate-800 ring-1 ring-slate-300', 'bg-slate-500'),
  reduce_food_stagnation: style('bg-lime-100 text-lime-900 ring-1 ring-lime-300', 'bg-lime-500'),
  expel_parasites: style('bg-fuchsia-100 text-fuchsia-900 ring-1 ring-fuchsia-300', 'bg-fuchsia-600'),
  other: style('bg-ink-100 text-ink-700 ring-1 ring-ink-200', 'bg-ink-300'),
};

/* ------------------------------------------------------------------------- */

export type TcmScale = 'tcmCategory' | 'formulaTcmCategory' | 'temperature' | 'taste' | 'channel';

const SCALES: Record<TcmScale, Record<string, ChipStyle>> = {
  tcmCategory: TCM_CATEGORY_STYLES,
  formulaTcmCategory: FORMULA_TCM_CATEGORY_STYLES,
  temperature: TEMPERATURE_STYLES,
  taste: TASTE_STYLES,
  channel: CHANNEL_STYLES,
};

/** Looks up one value on one scale, falling back to a neutral grey. */
export function tcmStyle(scale: TcmScale, value: string | null | undefined): ChipStyle {
  if (!value) return UNKNOWN;
  return SCALES[scale][value] ?? UNKNOWN;
}
