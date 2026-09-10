'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import { placementSide, toPointPlacement, type BodyView } from '@clinic/domain';

/**
 * A schematic body chart with the treatment's points marked on it.
 *
 * The figure follows the standard 7.5-head adult canon — head one unit, chin at
 * 1, nipples at 2, navel at 3, pubis at 3.75 (the halfway point of the body),
 * knee at 5.5, ankle at 7.2 — and is built from the same landmark table that
 * generates the point coordinates, so the drawing and the dots cannot drift
 * apart.
 *
 * It is still a schematic. The caption says so, because a chart that looks
 * precise invites being used as though it were, and this one answers "which
 * points did I use, and roughly where" rather than "where exactly is LU7".
 *
 * Coordinates are stored once, on the right-hand side, and the left is drawn as
 * their mirror — so correcting one number moves both sides. Which side actually
 * gets a dot comes from the placement recorded in the note.
 */

export interface MappedPoint {
  /** Unique per dot: the same point can be prescribed twice in one treatment. */
  key: string;
  /** The catalogue row, which is what a click or Enter navigates to. */
  pointId: string;
  code: string;
  label: string;
  view: BodyView;
  x: number;
  y: number;
  bilateral: boolean;
  /** Which side was actually needled, as recorded in the note. */
  region: string;
}

const W = 220;
const H = 560;

/**
 * The figure, in the same coordinates as the points.
 *
 * Limbs are round-capped strokes rather than outlines: one stroke width per
 * segment gives an arm that tapers from shoulder to fingertip without a
 * hand-tuned outline that would have to be redrawn every time a landmark moves.
 */
/*
 * The neck, drawn rather than left as a gap.
 *
 * It runs from the chin at y=90 to the shoulder line at y=118, which are two of
 * the landmarks every point coordinate is measured from. Nothing here may move
 * those numbers: the 361 points were generated against this table, so redrawing
 * the figure is only allowed to change how it looks, never where its landmarks
 * are. That is also why a stock silhouette was not used in its place — the ones
 * that are genuinely public domain are drawn in their own proportions and with
 * their own pose, and swapping one in would leave every arm point beside an arm
 * rather than on it.
 */
const NECK = 'M 99 84 C 99 98, 96 104, 92 110 L 128 110 C 124 104, 121 98, 121 84 Z';

/*
 * The torso.
 *
 * Same landmarks as before, better shape: the trapezius slopes up into the neck
 * instead of meeting it at a corner, the ribcage is fuller, the waist draws in
 * at the navel (y=230) and the hips flare below it. A chart of acupuncture
 * points is read by finding a landmark and working from it, so the landmarks
 * being legible is not decoration.
 */
const TORSO =
  // Left trapezius, shoulder, and down the arm's edge.
  'M 92 110 C 80 111, 68 116, 58 126 ' +
  // Ribcage: widening to the chest, then drawing in to the waist.
  'C 60 146, 64 158, 65 170 ' +
  'C 68 196, 74 214, 74 232 ' +
  // Waist, then out over the hip.
  'C 73 252, 64 266, 62 284 ' +
  'C 61 300, 68 313, 82 315 ' +
  // The pelvic floor, dipping at the midline.
  'L 104 308 L 110 300 L 116 308 L 138 315 ' +
  // Mirror, right side upwards.
  'C 152 313, 159 300, 158 284 ' +
  'C 156 266, 147 252, 146 232 ' +
  'C 146 214, 152 196, 155 170 ' +
  'C 156 158, 160 146, 162 126 ' +
  'C 152 116, 140 111, 128 110 Z';

/*
 * Limbs, as round-capped strokes down a skeleton.
 *
 * The centre lines are exactly the ones the point generator used — an arm point
 * is placed at a fraction along these segments, so moving an endpoint moves
 * every point on that limb. Only the widths are touched, tapering a little more
 * steeply so the figure reads as a body rather than as pipes.
 */
const LIMBS: { d: string; width: number }[] = [
  // Arms: upper arm, forearm, hand — each thinner than the last.
  { d: 'M 62 122 L 47 230', width: 26 },
  { d: 'M 47 230 L 38 307', width: 18 },
  { d: 'M 38 307 L 34 342', width: 13 },
  { d: 'M 158 122 L 173 230', width: 26 },
  { d: 'M 173 230 L 182 307', width: 18 },
  { d: 'M 182 307 L 186 342', width: 13 },
  // Legs: thigh, calf, foot.
  { d: 'M 84 296 L 80 405', width: 46 },
  { d: 'M 80 405 L 82 524', width: 30 },
  { d: 'M 82 524 L 80 546', width: 19 },
  { d: 'M 136 296 L 140 405', width: 46 },
  { d: 'M 140 405 L 138 524', width: 30 },
  { d: 'M 138 524 L 140 546', width: 19 },
];

/*
 * Joints, as discs at the points where two strokes meet.
 *
 * Two round-capped strokes of different widths leave a visible step where they
 * join. A disc the width of the thicker one fills it, which is what turns an
 * elbow from a notch into an elbow.
 */
const JOINTS: { cx: number; cy: number; r: number }[] = [
  { cx: 62, cy: 122, r: 13 },
  { cx: 47, cy: 230, r: 11 },
  { cx: 38, cy: 307, r: 8 },
  { cx: 158, cy: 122, r: 13 },
  { cx: 173, cy: 230, r: 11 },
  { cx: 182, cy: 307, r: 8 },
  { cx: 84, cy: 296, r: 23 },
  { cx: 80, cy: 405, r: 16 },
  { cx: 82, cy: 524, r: 10 },
  { cx: 136, cy: 296, r: 23 },
  { cx: 140, cy: 405, r: 16 },
  { cx: 138, cy: 524, r: 10 },
];

/** Faint marks so the two views are told apart at a glance. */
const GUIDES: Record<BodyView, string[]> = {
  front: [
    'M 110 116 L 110 300', // midline, where the Ren vessel runs
    'M 78 124 L 142 124', // clavicles
    'M 74 248 L 146 248', // waist
  ],
  back: [
    'M 110 116 L 110 300', // spine, where the Du vessel runs
    'M 76 140 L 96 176', // left scapula
    'M 144 140 L 124 176', // right scapula
    'M 74 248 L 146 248',
  ],
};

function dotsFor(points: MappedPoint[], view: BodyView) {
  const out: { key: string; cx: number; cy: number; point: MappedPoint }[] = [];
  for (const point of points) {
    if (point.view !== view) continue;

    // The note now records a side for every point, so the chart draws what was
    // actually needled rather than assuming both. A bilateral point needled on
    // the left gets one dot on the left — marking both would be a record of a
    // treatment that did not happen.
    //
    // Coordinates are stored once, on the right; the left is the mirror of it,
    // so correcting one number moves both sides.
    const side = placementSide(toPointPlacement(point.region));

    if (side === 'left') {
      out.push({ key: `${point.key}-l`, cx: W - point.x, cy: point.y, point });
    } else if (side === 'right') {
      out.push({ key: `${point.key}-r`, cx: point.x, cy: point.y, point });
    } else if (point.bilateral) {
      // Midline and ear entries on a paired point: no side was stated, so both
      // are shown, which is the older reading and still the honest one.
      out.push({ key: `${point.key}-r`, cx: point.x, cy: point.y, point });
      out.push({ key: `${point.key}-l`, cx: W - point.x, cy: point.y, point });
    } else {
      out.push({ key: `${point.key}-r`, cx: point.x, cy: point.y, point });
    }
  }
  return out;
}

export function BodyMap({
  points,
  onSelect,
  className,
}: {
  points: MappedPoint[];
  /** Called when a dot is activated, so the caller can open the point's page. */
  onSelect?: (point: MappedPoint) => void;
  className?: string;
}) {
  const t = useTranslations('encounters.bodyMap');
  const [active, setActive] = useState<string | null>(null);

  const views = useMemo(
    () => (['front', 'back'] as BodyView[]).map((view) => ({ view, dots: dotsFor(points, view) })),
    [points],
  );

  return (
    <figure className={cn('rounded-card border border-ink-200 bg-white p-3', className)}>
      <div className="flex items-start justify-center gap-2">
        {views.map(({ view, dots }) => (
          <div key={view} className="flex-1">
            <p className="mb-1 text-center text-xs font-medium text-ink-600">{t(view)}</p>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label={t(`${view}Label`, { count: dots.length })}
            >
              {/*
                The body is drawn as one silhouette rather than as an outlined
                pile of parts. Every piece is filled in the same colour with no
                stroke, so where two of them overlap there is no seam; the whole
                figure then gets a single outline from the union underneath.

                That is why the order matters: limbs first, then the joint discs
                that fill the step where two strokes of different widths meet,
                then the neck, head and torso over the top.
              */}
              <g fill="var(--color-ink-200)" stroke="none">
                {LIMBS.map((limb) => (
                  <path
                    key={limb.d}
                    d={limb.d}
                    fill="none"
                    stroke="var(--color-ink-200)"
                    strokeWidth={limb.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {JOINTS.map((joint) => (
                  <circle key={`${joint.cx}-${joint.cy}`} cx={joint.cx} cy={joint.cy} r={joint.r} />
                ))}
                <path d={NECK} />
                <path d={TORSO} />
                {/* The head. Slightly narrower than tall, which is what stops a
                    schematic figure reading as a balloon on a stick. */}
                <ellipse cx={110} cy={56} rx={23} ry={31} />
              </g>

              {/* The outline, over the fill: one quiet edge for the whole
                  figure, thin enough not to compete with the point markers,
                  which are the thing actually being read. */}
              <g
                fill="none"
                stroke="var(--color-ink-400)"
                strokeWidth={1.25}
                strokeOpacity={0.65}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {LIMBS.map((limb) => (
                  <path key={`${limb.d}-edge`} d={limb.d} strokeWidth={0.9} strokeOpacity={0.35} />
                ))}
                <path d={TORSO} />
                <ellipse cx={110} cy={56} rx={23} ry={31} />
              </g>

              {GUIDES[view].map((d) => (
                <path
                  key={d}
                  d={d}
                  stroke="var(--color-ink-400)"
                  strokeWidth={0.8}
                  strokeOpacity={0.5}
                  fill="none"
                />
              ))}

              {dots.map(({ key, cx, cy, point }) => {
                const isActive = active === key;
                const label = `${point.code}${point.label ? ` · ${point.label}` : ''}`;
                return (
                  <g
                    key={key}
                    // Every dot is reachable and operable from the keyboard, not
                    // only from a mouse: without this the chart would be the one
                    // route to a point's page that a keyboard user cannot take.
                    role={onSelect ? 'button' : undefined}
                    tabIndex={onSelect ? 0 : undefined}
                    aria-label={onSelect ? label : undefined}
                    onMouseEnter={() => setActive(key)}
                    onMouseLeave={() => setActive((current) => (current === key ? null : current))}
                    onFocus={() => setActive(key)}
                    onBlur={() => setActive((current) => (current === key ? null : current))}
                    onClick={() => onSelect?.(point)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect?.(point);
                      }
                    }}
                    className={onSelect ? 'cursor-pointer focus:outline-none' : undefined}
                  >
                    {/* A generous invisible target: the visible dot is 5px wide
                        on a chart often rendered at half size, well below the
                        24px minimum a pointer needs. */}
                    <circle cx={cx} cy={cy} r={11} fill="transparent" />
                    {isActive ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill="var(--color-jade-600)"
                        fillOpacity={0.2}
                      />
                    ) : null}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isActive ? 6.5 : 5}
                      fill="var(--color-jade-700)"
                      stroke="var(--color-white)"
                      strokeWidth={1.75}
                      className="transition-all"
                    />
                    {isActive ? (
                      <text
                        x={cx > W / 2 ? cx + 11 : cx - 11}
                        y={cy - 9}
                        textAnchor={cx > W / 2 ? 'start' : 'end'}
                        className="fill-ink-900 text-[12px] font-semibold"
                        style={{ paintOrder: 'stroke', stroke: 'var(--color-white)', strokeWidth: 3.5 }}
                      >
                        {point.code}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-center text-xs leading-snug text-ink-600">
        {t('disclaimer')}
      </figcaption>
    </figure>
  );
}
