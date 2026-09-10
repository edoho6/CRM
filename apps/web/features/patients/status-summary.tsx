'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChartColumn, EyeOff, LayoutGrid, Rows3 } from 'lucide-react';
import { SegmentedControl, cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { TREATMENT_STATUSES, type TreatmentStatus } from '@clinic/domain';

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
 * day. The choice is remembered in this browser.
 */

type Mode = 'tiles' | 'pills' | 'bar' | 'hidden';
const MODES: readonly Mode[] = ['tiles', 'pills', 'bar', 'hidden'];
const MODE_STORAGE_KEY = 'herbalist-patient-kpi-mode';
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
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored && (MODES as readonly string[]).includes(stored)) setMode(stored as Mode);
    } catch {
      // Site data blocked: tiles every time, and that is the whole cost.
    }
  }, []);

  function chooseMode(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
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

  /* Outcomes only. "In treatment" and "not active" are the row above; repeating
     them here would make the two rows look like one broken total. */
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

  const switcher = (
    <SegmentedControl
      iconOnly
      label={t('kpi.view')}
      value={mode}
      onChange={chooseMode}
      className="shrink-0"
      options={MODES.map((candidate) => {
        const Icon = MODE_ICONS[candidate];
        return {
          value: candidate,
          label: t(`kpi.modes.${candidate}`),
          icon: <Icon className="h-4 w-4" aria-hidden />,
        };
      })}
    />
  );

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {mode === 'tiles' ? (
          <div className="space-y-1.5">
            <TileRow items={diary} />
            <TileRow items={outcomes} />
          </div>
        ) : mode === 'pills' ? (
          <div className="flex flex-wrap items-center gap-1">
            {diary.map((item) => (
              <Pill key={item.key} item={item} />
            ))}
            <span aria-hidden className="mx-1 h-4 w-px bg-ink-200" />
            {outcomes.map((item) => (
              <Pill key={item.key} item={item} />
            ))}
          </div>
        ) : mode === 'bar' ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {diary.map((item) => (
                <TextStat key={item.key} item={item} />
              ))}
            </div>
            <StackedBar items={outcomes} />
          </div>
        ) : null}
      </div>
      {switcher}
    </div>
  );
}

function TileRow({ items }: { items: Item[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const style = TONES[item.tone];
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
            <span className={cn('block text-base leading-none font-semibold tabular-nums', style.text)}>
              {item.value}
            </span>
            <span className="mt-1 block text-xs leading-tight text-ink-600">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Pill({ item }: { item: Item }) {
  const style = TONES[item.tone];
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-pressed={item.active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        item.active ? style.active : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
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
      {item.label} <span className={cn('font-semibold tabular-nums', style.text)}>{item.value}</span>
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
                  className={cn('block min-w-[3px] border-e border-white last:border-e-0', TONES[item.tone].fill)}
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
