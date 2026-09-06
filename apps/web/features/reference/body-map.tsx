'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import type { BodyView } from '@clinic/domain';

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
 * Bilateral points are stored once on the right-hand side and mirrored here, so
 * correcting one coordinate moves both dots.
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
const TORSO =
  'M 98 102 C 88 108, 70 114, 58 126 C 60 145, 63 156, 63 168 ' +
  'C 66 200, 73 224, 73 248 C 71 268, 62 278, 62 294 C 62 306, 70 313, 82 313 ' +
  'L 104 306 L 110 298 L 116 306 L 138 313 C 150 313, 158 306, 158 294 ' +
  'C 158 278, 149 268, 147 248 C 147 224, 154 200, 157 168 ' +
  'C 157 156, 160 145, 162 126 C 150 114, 132 108, 122 102 Z';

const LIMBS: { d: string; width: number }[] = [
  // Arms: upper arm, forearm, hand — each thinner than the last.
  { d: 'M 62 122 L 47 230', width: 25 },
  { d: 'M 47 230 L 38 307', width: 19 },
  { d: 'M 38 307 L 34 342', width: 14 },
  { d: 'M 158 122 L 173 230', width: 25 },
  { d: 'M 173 230 L 182 307', width: 19 },
  { d: 'M 182 307 L 186 342', width: 14 },
  // Legs: thigh, calf, foot.
  { d: 'M 84 296 L 80 405', width: 44 },
  { d: 'M 80 405 L 82 524', width: 32 },
  { d: 'M 82 524 L 80 546', width: 20 },
  { d: 'M 136 296 L 140 405', width: 44 },
  { d: 'M 140 405 L 138 524', width: 32 },
  { d: 'M 138 524 L 140 546', width: 20 },
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
    // "left" and "right" in a note mean the patient's side; on a chart drawn
    // facing the reader they are simply the two mirrored positions, and a
    // single-sided entry gets one dot instead of two.
    const wantsBoth = point.bilateral && point.region !== 'left' && point.region !== 'right';
    if (wantsBoth) {
      out.push({ key: `${point.key}-r`, cx: point.x, cy: point.y, point });
      out.push({ key: `${point.key}-l`, cx: W - point.x, cy: point.y, point });
    } else if (point.bilateral && point.region === 'left') {
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
              <g fill="var(--color-ink-200)" stroke="var(--color-ink-400)" strokeWidth={1.5}>
                {/* Head, neck and torso are filled shapes; limbs are strokes.
                    Drawing the limbs under the torso hides the joins. */}
                {LIMBS.map((limb) => (
                  <path
                    key={limb.d}
                    d={limb.d}
                    fill="none"
                    stroke="var(--color-ink-200)"
                    strokeWidth={limb.width}
                    strokeLinecap="round"
                  />
                ))}
                {LIMBS.map((limb) => (
                  <path
                    key={`${limb.d}-edge`}
                    d={limb.d}
                    fill="none"
                    stroke="var(--color-ink-400)"
                    strokeWidth={limb.width}
                    strokeLinecap="round"
                    strokeOpacity={0.25}
                    style={{ fill: 'none' }}
                  />
                ))}
                <rect x={98} y={82} width={24} height={34} rx={10} />
                <ellipse cx={110} cy={56} rx={25} ry={34} />
                <path d={TORSO} />
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
                      <circle cx={cx} cy={cy} r={10} fill="var(--color-jade-600)" fillOpacity={0.2} />
                    ) : null}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isActive ? 6.5 : 5}
                      fill="var(--color-jade-700)"
                      stroke="white"
                      strokeWidth={1.75}
                      className="transition-all"
                    />
                    {isActive ? (
                      <text
                        x={cx > W / 2 ? cx + 11 : cx - 11}
                        y={cy - 9}
                        textAnchor={cx > W / 2 ? 'start' : 'end'}
                        className="fill-ink-900 text-[12px] font-semibold"
                        style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3.5 }}
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
      <figcaption className="mt-2 text-center text-[11px] leading-snug text-ink-600">
        {t('disclaimer')}
      </figcaption>
    </figure>
  );
}
