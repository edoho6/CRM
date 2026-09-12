'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChartColumn, ChevronLeft, Eye, EyeOff, LayoutGrid, RotateCcw, Rows3 } from 'lucide-react';
import { ArrangeToggle, Button, SegmentedControl, cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { TREATMENT_STATUSES, type TreatmentStatus } from '@clinic/domain';
import { PREF_KEYS } from '@/lib/prefs';
import {
  EMPTY_TILE_LAYOUT,
  arrangeTiles,
  moveTile,
  parseTileLayout,
  toggleTileHidden,
  type TileLayout,
} from './tile-layout';

export interface StatusCounts {
  byStatus: Record<TreatmentStatus, number>;
  active: number;
  inactive: number;
  total: number;
  /** Active files with no appointment ahead of them. */
  noUpcoming: number;
}

/**
 * How the practice stands, in numbers, above the list.
 *
 * Two questions. The first is about the diary — how many people are in
 * treatment, how many are not, and the one that used to have no answer at
 * all: how many are in treatment with nothing booked, which is how a patient
 * quietly falls out of a course. The second is about outcomes, which is the
 * question worth being able to answer about your own practice: how many
 * courses finished well, how many partly, how many people simply stopped.
 *
 * Every number is also a filter. A number you cannot click is a number you
 * have to take on trust; clicking through to the eleven people it counts is
 * what makes it checkable.
 *
 * Three ways of showing the same numbers, and a fourth that hides them,
 * because a strip of statistics above a list you open forty times a day is
 * either the first thing you want or the thing in the way, depending on the
 * day. The choice is remembered in this browser — and so is the order of the
 * tiles, and which of them are shown at all: the number one practice watches
 * is not the number another does, so "arrange" lets each put theirs first.
 */

type Mode = 'tiles' | 'pills' | 'bar' | 'hidden';
const MODES: readonly Mode[] = ['tiles', 'pills', 'bar', 'hidden'];
const MODE_STORAGE_KEY = PREF_KEYS.kpiMode;
const LAYOUT_STORAGE_KEY = PREF_KEYS.kpiLayout;
const MODE_ICONS = { tiles: LayoutGrid, pills: Rows3, bar: ChartColumn, hidden: EyeOff } as const;

type Tone = 'jade' | 'sky' | 'amber' | 'red' | 'ink';

/* Whole class strings per tone: Tailwind only sees classes written literally. */
const TONES: Record<Tone, { text: string; active: string; fill: string }> = {
  jade: { text: 'text-jade-800', active: 'border-jade-500 bg-jade-50', fill: 'bg-jade-600' },
  sky: { text: 'text-sky-800', active: 'border-sky-600 bg-sky-100', fill: 'bg-sky-600' },
  amber: { text: 'text-amber-800', active: 'border-amber-500 bg-amber-100', fill: 'bg-amber-500' },
  red: { text: 'text-red-700', active: 'border-red-600 bg-red-50', fill: 'bg-red-600' },
  ink: { text: 'text-ink-900', active: 'border-ink-400 bg-ink-100', fill: 'bg-ink-400' },
};

/* Outcomes by tone; anything not named here is neutral. */
const OUTCOME_TONES = new Map<string, Tone>([
  ['full_success', 'jade'],
  ['completed', 'jade'],
  ['partial_success', 'sky'],
  ['dropped_out', 'amber'],
  ['unsuccessful', 'red'],
]);

interface Item {
  key: string;
  label: string;
  value: number;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}

export function PatientStatusSummary({ counts }: { counts: StatusCounts }) {
  const t = useTranslations('patients');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>('tiles');
  const [layout, setLayout] = useState<TileLayout>(EMPTY_TILE_LAYOUT);
  const [arranging, setArranging] = useState(false);
  // Before paint, from the attribute the pre-paint script wrote (so a hidden
  // strip is hidden by the stylesheet from the first frame), then the order.
  useLayoutEffect(() => {
    const stored = document.documentElement.dataset.kpiMode;
    if (stored && (MODES as readonly string[]).includes(stored)) setMode(stored as Mode);
    try {
      setLayout(parseTileLayout(localStorage.getItem(LAYOUT_STORAGE_KEY)));
    } catch {
      // Site data blocked: the default order, and that is the whole cost.
    }
  }, []);

  function chooseMode(next: Mode) {
    setMode(next);
    document.documentElement.dataset.kpiMode = next;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // As above.
    }
  }

  function saveLayout(next: TileLayout) {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // As above.
    }
  }

  const currentStatus = searchParams.get('status');
  const showingInactive = searchParams.get('inactive') === '1';
  const showingNoUpcoming = searchParams.get('noUpcoming') === '1';

  function go(next: { status?: TreatmentStatus | null; inactive?: boolean; noUpcoming?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.status) params.set('status', next.status);
    else params.delete('status');

    if (next.noUpcoming) params.set('noUpcoming', '1');
    else params.delete('noUpcoming');

    // Anything but "in treatment" describes a file that is by definition not
    // active, so asking for one has to widen the list past the active-only
    // default or it comes back empty.
    if (next.inactive || (next.status && next.status !== 'active')) params.set('inactive', '1');
    else params.delete('inactive');
    // A different filter is a different list; page 3 of the old one is nowhere.
    params.delete('page');

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const nothingChosen = !currentStatus && !showingInactive && !showingNoUpcoming;

  const diary: Item[] = [
    {
      key: 'active',
      label: t('status.active'),
      value: counts.active,
      tone: 'jade',
      active: currentStatus === 'active',
      onClick: () => go({ status: 'active' }),
    },
    {
      key: 'noUpcoming',
      label: t('noUpcoming'),
      value: counts.noUpcoming,
      tone: 'amber',
      active: showingNoUpcoming,
      onClick: () => go({ noUpcoming: true }),
    },
    {
      key: 'inactive',
      label: t('kpi.notActive'),
      value: counts.inactive,
      tone: 'ink',
      active: !currentStatus && showingInactive && !showingNoUpcoming,
      onClick: () => go({ inactive: true }),
    },
    {
      key: 'total',
      label: t('kpi.total'),
      value: counts.total,
      tone: 'ink',
      active: nothingChosen,
      onClick: () => go({}),
    },
  ];

  /* Outcomes only. "In treatment" and "not active" are the diary; repeating
     them here would make the two groups look like one broken total. */
  const outcomes: Item[] = TREATMENT_STATUSES.filter(
    (status) => status !== 'active' && status !== 'inactive',
  ).map((status) => ({
    key: status,
    label: t(`status.${status}`),
    value: counts.byStatus[status] ?? 0,
    tone: OUTCOME_TONES.get(status) ?? 'ink',
    active: currentStatus === status,
    onClick: () => go({ status }),
  }));

  const all = [...diary, ...outcomes];
  const ordered = arrangeTiles(all, layout);
  const isHidden = (item: Item) => layout.hidden.includes(item.key);
  const visible = ordered.filter((item) => !isHidden(item));
  const visibleOutcomes = outcomes.filter((item) => !isHidden(item));

  const switcher = (
    <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
      <SegmentedControl
        iconOnly
        label={t('kpi.view')}
        value={mode}
        onChange={chooseMode}
        options={MODES.map((candidate) => {
          const Icon = MODE_ICONS[candidate];
          return {
            value: candidate,
            label: t(`kpi.modes.${candidate}`),
            icon: <Icon className="h-4 w-4" aria-hidden />,
          };
        })}
      />
      {/* The same switch as the dashboard's, the menu's and the treatment
          page's, and in the same place: last, in the far corner. */}
      {mode !== 'hidden' ? (
        <ArrangeToggle
          editing={arranging}
          onToggle={() => setArranging((current) => !current)}
          arrangeLabel={t('kpi.arrange')}
          doneLabel={t('kpi.arrangeDone')}
        />
      ) : null}
    </div>
  );

  // On a phone the switcher drops under the tiles: beside them it took half
  // the width and left nine tiles squeezed into the other half.
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          {mode === 'tiles' ? (
            <div data-kpi-tiles>
              <TileRow
                items={arranging ? ordered : visible}
                arranging={arranging}
                hidden={layout.hidden}
                onMove={(key, step) => saveLayout(moveTile(all, layout, key, step))}
                onToggleHidden={(key) => saveLayout(toggleTileHidden(layout, key))}
                labels={{
                  earlier: t('kpi.moveEarlier'),
                  later: t('kpi.moveLater'),
                  hide: t('kpi.hideTile'),
                  show: t('kpi.showTile'),
                }}
              />
            </div>
          ) : mode === 'pills' ? (
            <div className="flex flex-wrap items-center gap-1">
              {(arranging ? ordered : visible).map((item) => (
                <Pill key={item.key} item={item} dimmed={arranging && isHidden(item)} />
              ))}
            </div>
          ) : mode === 'bar' ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {visible
                  .filter((item) => !outcomes.includes(item))
                  .map((item) => (
                    <TextStat key={item.key} item={item} />
                  ))}
              </div>
              <StackedBar items={visibleOutcomes} />
            </div>
          ) : null}
        </div>
        {switcher}
      </div>

      {arranging ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-jade-300 bg-jade-50/50 px-3 py-1.5 text-xs text-ink-700">
          <span>{t('kpi.arrangeHint')}</span>
          {/* Finishing is the switch above, as on every other screen; only
              the reset lives here, beside the hint that explains the mode. */}
          {layout.order.length > 0 || layout.hidden.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => saveLayout(EMPTY_TILE_LAYOUT)}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t('kpi.resetOrder')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TileRow({
  items,
  arranging,
  hidden,
  onMove,
  onToggleHidden,
  labels,
}: {
  items: Item[];
  arranging: boolean;
  hidden: string[];
  onMove: (key: string, step: -1 | 1) => void;
  onToggleHidden: (key: string) => void;
  labels: { earlier: string; later: string; hide: string; show: string };
}) {
  // Two even columns on a phone: nine tiles of uneven width wrapping freely
  // left a lone tile on the last row and no pattern to scan.
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
      {items.map((item, index) => {
        const style = TONES[item.tone];
        const isHidden = hidden.includes(item.key);
        const face = (
          <>
            <span
              className={cn('block text-base leading-none font-semibold tabular-nums', style.text)}
            >
              {item.value}
            </span>
            <span className="mt-1 block text-xs leading-tight text-ink-600">{item.label}</span>
          </>
        );
        if (!arranging) {
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              aria-pressed={item.active}
              className={cn(
                'min-w-[5.5rem] rounded-lg border px-2.5 py-1.5 text-start transition-colors',
                item.active ? style.active : 'border-ink-200 bg-white hover:bg-ink-50',
              )}
            >
              {face}
            </button>
          );
        }
        // While arranging, a tile is a thing to move, not a filter to click:
        // the arrows and the eye take the clicks, and the face stays put.
        return (
          <div
            key={item.key}
            className={cn(
              'min-w-[5.5rem] rounded-lg border border-dashed px-2.5 py-1.5 text-start',
              isHidden ? 'border-ink-200 bg-ink-50 opacity-60' : 'border-jade-400 bg-white',
            )}
          >
            {face}
            <span className="mt-1.5 flex items-center gap-0.5">
              <ArrangeButton
                label={`${labels.earlier}: ${item.label}`}
                disabled={index === 0}
                onClick={() => onMove(item.key, -1)}
              >
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </ArrangeButton>
              <ArrangeButton
                label={`${labels.later}: ${item.label}`}
                disabled={index === items.length - 1}
                onClick={() => onMove(item.key, 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" aria-hidden />
              </ArrangeButton>
              <ArrangeButton
                label={`${isHidden ? labels.show : labels.hide}: ${item.label}`}
                pressed={isHidden}
                onClick={() => onToggleHidden(item.key)}
              >
                {isHidden ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
              </ArrangeButton>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ArrangeButton({
  label,
  disabled = false,
  pressed,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-0.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Pill({ item, dimmed = false }: { item: Item; dimmed?: boolean }) {
  const style = TONES[item.tone];
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-pressed={item.active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        item.active ? style.active : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
        dimmed && 'opacity-50',
      )}
    >
      <span aria-hidden className={cn('h-2 w-2 rounded-full', style.fill)} />
      {item.label}
      <span className={cn('font-semibold tabular-nums', style.text)}>{item.value}</span>
    </button>
  );
}

function TextStat({ item }: { item: Item }) {
  const style = TONES[item.tone];
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-pressed={item.active}
      className={cn(
        'rounded px-1 underline-offset-2 hover:underline',
        item.active ? 'font-semibold text-ink-900' : 'text-ink-600',
      )}
    >
      {item.label}{' '}
      <span className={cn('font-semibold tabular-nums', style.text)}>{item.value}</span>
    </button>
  );
}

/**
 * One bar, the outcomes in proportion. The legend under it carries the
 * numbers and the words: a bar is for seeing the shape, and colour alone is
 * never asked to say which segment is which.
 */
function StackedBar({ items }: { items: Item[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-1.5">
      <div
        role="img"
        aria-label={items.map((item) => `${item.label}: ${item.value}`).join(', ')}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100"
      >
        {total > 0
          ? items
              .filter((item) => item.value > 0)
              .map((item) => (
                <span
                  key={item.key}
                  title={`${item.label}: ${item.value}`}
                  style={{ flexGrow: item.value, flexBasis: 0 }}
                  className={cn(
                    'block min-w-[3px] border-e border-white last:border-e-0',
                    TONES[item.tone].fill,
                  )}
                />
              ))
          : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item) => (
          <Pill key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
