'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import type { BodyView } from '@clinic/domain';

/**
 * A schematic body chart with the treatment's points marked on it.
 *
 * The figure is drawn, not photographed, and the coordinates that place a dot
 * on it are approximate by design: the map answers "which points did I use, and
 * roughly where" at a glance. It is not an anatomical locator and the caption
 * says so, because a chart that looks precise invites being used as though it
 * were.
 *
 * Bilateral points are stored once, on the right-hand side of the drawing, and
 * mirrored here — that way a point moves in both places when its coordinate is
 * corrected.
 */

export interface MappedPoint {
  /** Unique per dot: the same point can be prescribed twice in one treatment. */
  key: string;
  /** The catalogue row, which is what a click navigates to. */
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

const W = 200;
const H = 520;

/** The outline, as one path per view. Deliberately plain: a silhouette, not art. */
const FIGURE = {
  front:
    'M100 14 C112 14 120 23 120 35 C120 44 116 51 111 55 L111 62 C124 66 140 74 146 86 ' +
    'C152 99 156 130 158 160 C160 190 162 220 163 240 L152 242 C150 214 146 182 142 160 ' +
    'L140 214 C140 232 138 250 136 262 C133 282 130 310 128 340 C126 372 125 410 124 442 ' +
    'C123 468 122 486 121 498 L104 498 C104 470 105 430 104 396 C103 372 102 356 100 344 ' +
    'C98 356 97 372 96 396 C95 430 96 470 96 498 L79 498 C78 486 77 468 76 442 ' +
    'C75 410 74 372 72 340 C70 310 67 282 64 262 C62 250 60 232 60 214 L58 160 ' +
    'C54 182 50 214 48 242 L37 240 C38 220 40 190 42 160 C44 130 48 99 54 86 ' +
    'C60 74 76 66 89 62 L89 55 C84 51 80 44 80 35 C80 23 88 14 100 14 Z',
  back:
    'M100 14 C112 14 120 23 120 35 C120 44 116 51 111 55 L111 62 C124 66 140 74 146 86 ' +
    'C152 99 156 130 158 160 C160 190 162 220 163 240 L152 242 C150 214 146 182 142 160 ' +
    'L140 214 C140 232 138 250 136 262 C133 282 130 310 128 340 C126 372 125 410 124 442 ' +
    'C123 468 122 486 121 498 L104 498 C104 470 105 430 104 396 C103 372 102 356 100 344 ' +
    'C98 356 97 372 96 396 C95 430 96 470 96 498 L79 498 C78 486 77 468 76 442 ' +
    'C75 410 74 372 72 340 C70 310 67 282 64 262 C62 250 60 232 60 214 L58 160 ' +
    'C54 182 50 214 48 242 L37 240 C38 220 40 190 42 160 C44 130 48 99 54 86 ' +
    'C60 74 76 66 89 62 L89 55 C84 51 80 44 80 35 C80 23 88 14 100 14 Z',
};

/** Faint guide lines so the silhouette reads as a body rather than a blob. */
const GUIDES = {
  front: [
    'M100 62 L100 240', // midline
    'M72 100 L128 100', // chest
    'M76 172 L124 172', // waist
    'M100 216 L100 244', // pelvis
  ],
  back: [
    'M100 62 L100 244',
    'M74 92 L126 92',
    'M78 170 L122 170',
    'M100 216 L100 244',
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
  /** Called when a dot is clicked, so the caller can open the point's page. */
  onSelect?: (point: MappedPoint) => void;
  className?: string;
}) {
  const t = useTranslations('encounters.bodyMap');
  const [hovered, setHovered] = useState<string | null>(null);

  const views = useMemo(
    () => (['front', 'back'] as BodyView[]).map((view) => ({ view, dots: dotsFor(points, view) })),
    [points],
  );

  return (
    <figure className={cn('rounded-card border border-ink-200 bg-white p-3', className)}>
      <div className="flex items-start justify-center gap-2">
        {views.map(({ view, dots }) => (
          <div key={view} className="flex-1">
            <p className="mb-1 text-center text-xs font-medium text-ink-500">{t(view)}</p>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label={t(`${view}Label`, { count: dots.length })}
            >
              <path d={FIGURE[view]} fill="var(--color-ink-100)" stroke="var(--color-ink-300)" strokeWidth={1.5} />
              {GUIDES[view].map((d) => (
                <path key={d} d={d} stroke="var(--color-ink-200)" strokeWidth={0.8} fill="none" />
              ))}

              {dots.map(({ key, cx, cy, point }) => {
                const active = hovered === key;
                return (
                  <g
                    key={key}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelect?.(point)}
                    className={onSelect ? 'cursor-pointer' : undefined}
                  >
                    {/* A generous invisible target: the visible dot is 4px wide
                        on a chart that may be rendered at half size. */}
                    <circle cx={cx} cy={cy} r={9} fill="transparent" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={active ? 6 : 4.5}
                      fill="var(--color-jade-600)"
                      stroke="white"
                      strokeWidth={1.5}
                      className="transition-all"
                    />
                    {active ? (
                      <text
                        x={cx > W / 2 ? cx + 9 : cx - 9}
                        y={cy - 8}
                        textAnchor={cx > W / 2 ? 'start' : 'end'}
                        className="fill-ink-900 text-[11px] font-semibold"
                        style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
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
      <figcaption className="mt-2 text-center text-[11px] leading-snug text-ink-400">
        {t('disclaimer')}
      </figcaption>
    </figure>
  );
}
