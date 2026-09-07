'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  Ear,
  Minus,
  Search,
  X,
} from 'lucide-react';
import { FloatingList, Select, useAnchoredPosition } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import {
  NEEDLE_TECHNIQUES,
  POINT_PLACEMENTS,
  toPointPlacement,
  type NeedleTechnique,
  type PointPlacement,
  type PointRegion,
} from '@clinic/domain';

/**
 * The point prescription, written the way it is spoken.
 *
 * Laid out as a cross, with each quadrant where it belongs on the body: upper
 * left and upper right along the top, lower left and lower right along the
 * bottom, midline and ear down the middle. A prescription is remembered
 * spatially — "ST36 and SP6 below, LI4 above, Ren 6 on the midline" — and a
 * grid in that shape can be read at a glance without labels being parsed.
 *
 * Side and level are one choice rather than two. Asking separately meant
 * answering the same question twice, and left the body chart unable to do
 * anything but mark both sides.
 *
 * Right sits on the physical right of the screen and left on the physical left,
 * in both languages — the column order is reversed for Hebrew so that reading
 * the word and looking at the position give the same answer. That is deliberate
 * rather than following the front-view convention where a facing patient's right
 * appears on the reader's left: the words are what gets typed under pressure,
 * and the chart beside it is what shows the anatomy.
 *
 * Anything can be typed. A code from the catalogue carries an id, which is what
 * puts a dot on the body map and links through to the point's page; free text
 * is kept exactly as written and simply does not appear on the map. Losing the
 * ability to write "ashi, left trapezius" would be a worse trade than the map
 * being complete.
 */

/**
 * How each quadrant is drawn.
 *
 * The two sides carry different hues so a glance separates them, but colour is
 * never the only signal: every panel also has its label and an arrow pointing at
 * the physical corner it occupies. Someone who cannot tell jade from sky still
 * has two independent cues.
 *
 * Written as whole class strings rather than composed at runtime, because
 * Tailwind can only see classes that appear literally in the source.
 */
const PLACEMENT_STYLES: Record<
  PointPlacement,
  {
    icon: typeof ArrowUpRight;
    panel: string;
    label: string;
    icon_class: string;
    count: string;
  }
> = {
  right_upper: {
    icon: ArrowUpRight,
    panel: 'border-jade-200 bg-jade-50/60',
    label: 'text-jade-800',
    icon_class: 'text-jade-700',
    count: 'bg-jade-100 text-jade-800',
  },
  right_lower: {
    icon: ArrowDownRight,
    panel: 'border-jade-200 bg-jade-50/60',
    label: 'text-jade-800',
    icon_class: 'text-jade-700',
    count: 'bg-jade-100 text-jade-800',
  },
  left_upper: {
    icon: ArrowUpLeft,
    panel: 'border-sky-200 bg-sky-50/60',
    label: 'text-sky-800',
    icon_class: 'text-sky-700',
    count: 'bg-sky-100 text-sky-800',
  },
  left_lower: {
    icon: ArrowDownLeft,
    panel: 'border-sky-200 bg-sky-50/60',
    label: 'text-sky-800',
    icon_class: 'text-sky-700',
    count: 'bg-sky-100 text-sky-800',
  },
  center: {
    icon: Minus,
    panel: 'border-ink-200 bg-white',
    label: 'text-ink-700',
    icon_class: 'text-ink-600',
    count: 'bg-ink-100 text-ink-700',
  },
  ear: {
    icon: Ear,
    panel: 'border-ink-200 bg-white',
    label: 'text-ink-700',
    icon_class: 'text-ink-600',
    count: 'bg-ink-100 text-ink-700',
  },
};

export interface PointOption {
  id: string;
  code: string;
  pinyin: string | null;
  english: string | null;
  chinese: string | null;
  region: PointRegion;
}

export interface PointRow {
  point: string;
  point_id: string | null;
  region: PointPlacement;
  technique: NeedleTechnique;
  retention_minutes?: number | string | null;
  notes?: string | null;
}

/** Matches on code, pinyin or English, so "LU7", "lie que" and "sequence" all land. */
function search(catalogue: PointOption[], term: string): PointOption[] {
  const needle = term.trim().toLowerCase().replace(/\s+/g, '');
  if (!needle) return [];
  const scored: { option: PointOption; score: number }[] = [];
  for (const option of catalogue) {
    const code = option.code.toLowerCase();
    const pinyin = (option.pinyin ?? '').toLowerCase().replace(/\s+/g, '');
    const english = (option.english ?? '').toLowerCase();
    let score = -1;
    if (code === needle) score = 0;
    else if (code.startsWith(needle)) score = 1;
    else if (pinyin.startsWith(needle)) score = 2;
    else if (english.startsWith(needle)) score = 3;
    else if (pinyin.includes(needle)) score = 4;
    else if (english.includes(needle)) score = 5;
    else if ((option.chinese ?? '').includes(term.trim())) score = 5;
    if (score >= 0) scored.push({ option, score });
    if (scored.length > 400) break;
  }
  scored.sort(
    (a, b) =>
      a.score - b.score || a.option.code.localeCompare(b.option.code, 'en', { numeric: true }),
  );
  return scored.slice(0, 8).map((entry) => entry.option);
}

function PointCombobox({
  catalogue,
  region,
  onAdd,
  disabled,
}: {
  catalogue: PointOption[];
  region: PointPlacement;
  onAdd: (row: PointRow) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('encounters.points');
  const [term, setTerm] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => search(catalogue, term), [catalogue, term]);

  // The list is rendered into the body and measured against the viewport: these
  // fields sit in a narrow grid cell, and an absolutely-positioned list was both
  // cropped by it and too narrow to read a point's names in.
  const listStyle = useAnchoredPosition(fieldRef, open && matches.length > 0, {
    matchWidth: false,
    maxHeight: 256,
    contentRef: listRef,
    revision: matches.length,
  });

  function addOption(option: PointOption) {
    onAdd({ point: option.code, point_id: option.id, region, technique: 'even' });
    setTerm('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function addFreeText() {
    const value = term.trim();
    if (!value) return;
    onAdd({ point: value, point_id: null, region, technique: 'even' });
    setTerm('');
    setOpen(false);
  }

  return (
    <div ref={fieldRef} className="relative">
      <Search
        className="pointer-events-none absolute inset-y-0 start-2 my-auto h-3.5 w-3.5 text-ink-500"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="text"
        dir="ltr"
        value={term}
        disabled={disabled}
        placeholder={t('placeholder')}
        aria-label={t('point')}
        aria-expanded={open && matches.length > 0}
        role="combobox"
        aria-controls={`point-options-${region}`}
        autoComplete="off"
        onChange={(event) => {
          setTerm(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlight((value) => Math.min(value + 1, matches.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((value) => Math.max(value - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            // The highlighted match wins; otherwise whatever was typed is kept
            // verbatim, which is how a non-catalogue point gets recorded.
            if (open && matches[highlight]) addOption(matches[highlight]);
            else addFreeText();
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="h-8 w-full rounded-md border border-ink-200 bg-white ps-7 pe-2 text-sm text-ink-900 shadow-xs outline-none placeholder:text-ink-500 focus:border-jade-500 disabled:bg-ink-50"
      />

      {open && matches.length > 0 ? (
        <FloatingList
          ref={listRef}
          id={`point-options-${region}`}
          role="listbox"
          style={listStyle ? { ...listStyle, minWidth: 280 } : null}
        >
          {matches.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addOption(option)}
                className={cn(
                  'flex w-full items-baseline gap-2 px-2 py-1.5 text-start text-sm',
                  index === highlight ? 'bg-jade-50' : 'hover:bg-ink-50',
                )}
              >
                <span dir="ltr" className="font-semibold text-jade-800">
                  {option.code}
                </span>
                {option.pinyin ? (
                  <span dir="ltr" className="text-ink-700">
                    {option.pinyin}
                  </span>
                ) : null}
                {option.chinese ? <span className="text-ink-500">{option.chinese}</span> : null}
                {option.english ? (
                  <span dir="ltr" className="ms-auto truncate text-xs text-ink-500">
                    {option.english}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </FloatingList>
      ) : null}
    </div>
  );
}

export function PointsEditor({
  value,
  catalogue,
  onChange,
  disabled,
}: {
  value: PointRow[];
  catalogue: PointOption[];
  onChange: (rows: PointRow[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('encounters.points');
  const tRegion = useTranslations('encounters.region');
  const tTechnique = useTranslations('encounters.technique');
  const isRtl = useLocale() === 'he';

  const byRegion = useMemo(() => {
    const groups = Object.fromEntries(
      POINT_PLACEMENTS.map((placement) => [placement, [] as { row: PointRow; index: number }[]]),
    ) as Record<PointPlacement, { row: PointRow; index: number }[]>;
    value.forEach((row, index) => {
      // Notes written before placements existed carry one of the old flat
      // regions; toPointPlacement translates rather than dropping them.
      groups[toPointPlacement(row.region)].push({ row, index });
    });
    return groups;
  }, [value]);

  function update(index: number, patch: Partial<PointRow>) {
    onChange(value.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  /*
   * Which quadrants sit in the left and right columns.
   *
   * Right always lands on the physical right of the screen and left on the
   * physical left, in both languages — so the column order is reversed for
   * Hebrew, where the grid flows the other way. Reading the word and looking at
   * the position give the same answer either way, which is the entire reason
   * for laying this out rather than listing it.
   */
  const [firstColumn, lastColumn]: [PointPlacement[], PointPlacement[]] = isRtl
    ? [
        ['right_upper', 'right_lower'],
        ['left_upper', 'left_lower'],
      ]
    : [
        ['left_upper', 'left_lower'],
        ['right_upper', 'right_lower'],
      ];

  function panel(region: PointPlacement, compact = false) {
    const rows = byRegion[region];
    const style = PLACEMENT_STYLES[region];
    const Icon = style.icon;

    return (
      <section
        key={region}
        className={cn('flex flex-col rounded-lg border p-2', style.panel, !compact && 'flex-1')}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          {/* The arrow points at the physical corner the panel occupies, so a
              quadrant is identifiable without reading the label — which is what
              matters when left and right are the thing being told apart in a
              hurry. */}
          <Icon className={cn('h-3.5 w-3.5 shrink-0', style.icon_class)} aria-hidden />
          <h4 className={cn('text-xs font-semibold', style.label)}>{tRegion(region)}</h4>
          {rows.length > 0 ? (
            <span
              className={cn(
                'ms-auto rounded-full px-1.5 text-xs font-medium tabular-nums',
                style.count,
              )}
            >
              {rows.length}
            </span>
          ) : null}
        </div>

        {rows.length === 0 && disabled ? (
          <p className="py-1 text-xs text-ink-500">{t('none')}</p>
        ) : null}

        <ul className={cn('space-y-1.5', compact && 'flex flex-wrap gap-1.5 space-y-0')}>
          {rows.map(({ row, index }) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-ink-200 bg-white px-1.5 py-1"
            >
              <span
                dir="ltr"
                className={cn(
                  'text-sm font-semibold',
                  // A point that came from the catalogue is the one that can
                  // appear on the map; free text reads plainly so the difference
                  // is visible without explanation.
                  row.point_id ? 'text-jade-800' : 'text-ink-700',
                )}
              >
                {row.point}
              </span>
              <Select
                aria-label={t('technique')}
                value={row.technique}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { technique: event.target.value as NeedleTechnique })
                }
                className="h-7 w-auto min-w-20 border-0 bg-transparent px-1 text-xs shadow-none"
              >
                {NEEDLE_TECHNIQUES.map((technique) => (
                  <option key={technique} value={technique}>
                    {tTechnique(technique)}
                  </option>
                ))}
              </Select>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={t('remove')}
                  className="ms-auto rounded p-1 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {!disabled ? (
          <div className={cn('mt-1.5', compact ? 'max-w-xs' : 'mt-auto pt-1.5')}>
            <PointCombobox
              catalogue={catalogue}
              region={region}
              onAdd={(row) => onChange([...value, row])}
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-2">
      {/*
       * Three equal columns: a side, the midline, the other side.
       *
       * The middle one holds a single panel that runs the full height of the
       * block rather than two half-height boxes, because the midline is one
       * place on the body and not an upper and a lower one. It being taller is
       * also what makes the shape read as a body at a glance instead of as six
       * boxes in a grid.
       *
       * On a narrow screen the three stack, and the arrows and labels are then
       * the whole of the orientation — which is why neither is optional.
       */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-2">{firstColumn.map((region) => panel(region))}</div>

        <div className="flex">{panel('center')}</div>

        <div className="flex flex-col gap-2">{lastColumn.map((region) => panel(region))}</div>
      </div>

      {/* The ear sits outside the block, and smaller. Auricular points have no
          upper or lower and no side in the sense the quadrants mean, so putting
          them in the grid would make the grid say something untrue. */}
      {panel('ear', true)}
    </div>
  );
}
