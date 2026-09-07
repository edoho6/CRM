'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Select } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import {
  NEEDLE_TECHNIQUES,
  POINT_REGIONS,
  type NeedleTechnique,
  type PointRegion,
} from '@clinic/domain';

/**
 * The point prescription, written the way it is spoken.
 *
 * Five buckets — upper, lower, left, right, centre — rather than a flat list,
 * because a prescription is remembered spatially: "ST36 and SP6 below, LI4 and
 * LU7 above, Ren 6 on the midline". The catalogue proposes which bucket a point
 * belongs to and the practitioner moves it wherever it actually went.
 *
 * Anything can be typed. A code from the catalogue carries an id, which is what
 * puts a dot on the body map and links through to the point's page; free text
 * is kept exactly as written and simply does not appear on the map. Losing the
 * ability to write "ashi, left trapezius" would be a worse trade than the map
 * being complete.
 */

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
  region: PointRegion;
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
  scored.sort((a, b) => a.score - b.score || a.option.code.localeCompare(b.option.code, 'en', { numeric: true }));
  return scored.slice(0, 8).map((entry) => entry.option);
}

function PointCombobox({
  catalogue,
  region,
  onAdd,
  disabled,
}: {
  catalogue: PointOption[];
  region: PointRegion;
  onAdd: (row: PointRow) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('encounters.points');
  const [term, setTerm] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => search(catalogue, term), [catalogue, term]);

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
    <div className="relative">
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
        <ul
          id={`point-options-${region}`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
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
        </ul>
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

  const byRegion = useMemo(() => {
    const groups: Record<PointRegion, { row: PointRow; index: number }[]> = {
      upper: [], lower: [], left: [], right: [], center: [],
    };
    value.forEach((row, index) => {
      const region = POINT_REGIONS.includes(row.region) ? row.region : 'upper';
      groups[region].push({ row, index });
    });
    return groups;
  }, [value]);

  function update(index: number, patch: Partial<PointRow>) {
    onChange(value.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {POINT_REGIONS.map((region) => {
        const rows = byRegion[region];
        return (
          <section key={region} className="rounded-lg border border-ink-200 bg-ink-50/40 p-2">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold text-ink-600">{tRegion(region)}</h4>
              {rows.length > 0 ? (
                <span className="text-xs tabular-nums text-ink-500">{rows.length}</span>
              ) : null}
            </div>

            {rows.length === 0 && disabled ? (
              <p className="py-1 text-xs text-ink-500">{t('none')}</p>
            ) : null}

            <ul className="space-y-1.5">
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
                      // appear on the map; free text reads plainly so the
                      // difference is visible without explanation.
                      row.point_id ? 'text-jade-800' : 'text-ink-700',
                    )}
                  >
                    {row.point}
                  </span>
                  <Select
                    aria-label={t('technique')}
                    value={row.technique}
                    disabled={disabled}
                    onChange={(event) => update(index, { technique: event.target.value as NeedleTechnique })}
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
              <div className="mt-1.5">
                <PointCombobox
                  catalogue={catalogue}
                  region={region}
                  onAdd={(row) => onChange([...value, row])}
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
