'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FlaskConical, Search, Sprout, User, X } from 'lucide-react';
import { Spinner, cn } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { useSupabase } from '@/lib/use-supabase';
import {
  formulaChineseName,
  formulaPrimaryName,
  herbBotanicalName,
  herbChineseName,
  herbPrimaryName,
} from '@/lib/display';

/**
 * Global search that expands in place.
 *
 * Clicking the magnifier opens a search field beside it rather than a dialog:
 * looking someone up is a glance, not a task that deserves to cover the screen.
 * Results appear as you type and only a click navigates, so scanning them never
 * moves you off the page you were on.
 *
 * Three separate lookups, each against names only. A patient's name is theirs
 * alone: it is never matched against a herb or a formula, so searching for
 * someone answers with the person and not with what they were prescribed. That
 * held only by accident while the catalogue carried Hebrew names — the demo
 * data named each patient's formula after them, and looking the patient up
 * returned their prescriptions (15.9).
 */

interface SearchResult {
  id: string;
  group: 'patients' | 'herbs' | 'formulas';
  primary: string;
  chinese: string;
  secondary: string;
  href: string;
}

interface HerbRow {
  id: string;
  pinyin_name: string | null;
  chinese_name: string | null;
  english_name: string | null;
  botanical_name: string | null;
}

interface FormulaRow {
  id: string;
  name_pinyin: string | null;
  name_chinese: string | null;
  name_english: string | null;
}

const RESULTS_PER_GROUP = 5;
const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

/** PostgREST `or=` splits on commas and parentheses, so they must not survive. */
function escapeTerm(term: string): string {
  return term.replace(/[%,()]/g, ' ').trim();
}

const GROUP_META = {
  patients: { icon: User, tone: 'bg-sky-100 text-sky-800' },
  herbs: { icon: Sprout, tone: 'bg-jade-100 text-jade-800' },
  formulas: { icon: FlaskConical, tone: 'bg-amber-100 text-amber-800' },
} as const;

export function GlobalSearch() {
  const t = useTranslations('quickBar');
  const tc = useTranslations('common');
  const router = useRouter();
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  /*
   * Opens on a click or Ctrl+K, never on the pointer merely passing over it.
   * It used to expand on hover, which pushed the bell and the "+" sideways
   * every time the mouse crossed the top bar on its way somewhere else, and
   * on a touch screen a hover is a tap — so the two behaviours diverged.
   * Closing is a click anywhere outside, or Escape.
   */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) dismiss();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reveal() {
    setOpen(true);
    // The field is rendered by this same update, so focus waits a frame.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function dismiss() {
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        reveal();
      }
      if (event.key === 'Escape' && open) dismiss();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSearch = useCallback(
    async (term: string): Promise<SearchResult[]> => {
      if (!supabase) return [];
      const escaped = escapeTerm(term);
      if (escaped.length < MIN_QUERY_LENGTH) return [];

      // Names, and for a patient the two other ways a clinic looks someone
      // up. Nothing here reaches into a file: a prescription, a note or a
      // dispensing line is not something the top bar searches.
      const [patients, herbs, formulas] = await Promise.all([
        supabase
          .from('patients')
          .select('id, full_name, phone')
          .or(`full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`)
          .eq('is_active', true)
          .limit(RESULTS_PER_GROUP),
        supabase
          .from('herbs')
          .select('id, pinyin_name, chinese_name, english_name, botanical_name')
          .or(
            `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,botanical_name.ilike.%${escaped}%`,
          )
          .eq('is_active', true)
          .limit(RESULTS_PER_GROUP),
        supabase
          .from('herb_formulas')
          .select('id, name_pinyin, name_chinese, name_english')
          .or(
            `name_pinyin.ilike.%${escaped}%,name_chinese.ilike.%${escaped}%,name_english.ilike.%${escaped}%`,
          )
          .eq('is_active', true)
          .limit(RESULTS_PER_GROUP),
      ]);

      const found: SearchResult[] = [];

      for (const row of patients.data ?? []) {
        const patient = row as { id: string; full_name: string; phone: string | null };
        found.push({
          id: patient.id,
          group: 'patients',
          primary: patient.full_name,
          chinese: '',
          secondary: patient.phone ?? '',
          href: `/patients/${patient.id}`,
        });
      }

      for (const row of herbs.data ?? []) {
        const herb = row as HerbRow;
        found.push({
          id: herb.id,
          group: 'herbs',
          primary: herbPrimaryName(herb),
          chinese: herbChineseName(herb),
          secondary: herbBotanicalName(herb) || (herb.english_name ?? ''),
          href: `/reference/herbs/${herb.id}`,
        });
      }

      for (const row of formulas.data ?? []) {
        const formula = row as FormulaRow;
        found.push({
          id: formula.id,
          group: 'formulas',
          primary: formulaPrimaryName(formula),
          chinese: formulaChineseName(formula),
          secondary: formula.name_english ?? '',
          href: `/reference/formulas/${formula.id}`,
        });
      }

      return found;
    },
    [supabase],
  );

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await runSearch(term);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, runSearch]);

  const grouped = useMemo(
    () =>
      (['patients', 'herbs', 'formulas'] as const)
        .map((group) => ({ group, items: results.filter((result) => result.group === group) }))
        .filter((entry) => entry.items.length > 0),
    [results],
  );

  const term = query.trim();
  const showPanel = open && term.length >= MIN_QUERY_LENGTH;

  /*
   * Arrow keys walk the results and Enter opens the lit one, the way the
   * combobox and the point picker already work. Before this, Ctrl+K and a
   * name got you a list you could only Tab through.
   */
  const flat = useMemo(() => grouped.flatMap((entry) => entry.items), [grouped]);
  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    setHighlight(0);
  }, [results]);
  const optionId = (result: SearchResult) => `global-search-${result.group}-${result.id}`;

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel || flat.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (current + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (current - 1 + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      const chosen = flat[highlight];
      if (!chosen) return;
      event.preventDefault();
      dismiss();
      router.push(chosen.href);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative',
        // On a phone the bar has no room beside the buttons: the search takes
        // the whole bar while it is open, the way a phone's mail search does.
        open && 'max-sm:absolute max-sm:inset-x-3 max-sm:top-2.5 max-sm:bottom-2.5 max-sm:z-10 max-sm:flex max-sm:items-center max-sm:bg-white',
      )}
    >
      <div className="flex items-center gap-1.5 max-sm:w-full">
        <button
          type="button"
          aria-label={t('search')}
          title={t('search')}
          aria-keyshortcuts="Control+K"
          onClick={() => (open ? inputRef.current?.focus() : reveal())}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-xs',
            'transition-all duration-(--duration-fast) ease-(--ease-standard)',
            'hover:-translate-y-px hover:border-jade-300 hover:bg-jade-50 hover:text-jade-800 hover:shadow-md active:translate-y-0 active:scale-[0.98]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            open && 'border-jade-300 bg-jade-50 text-jade-800',
          )}
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Width, not mounting, is what animates — the input keeps its state and
            focus while the box grows. */}
        <div
          className={cn(
            'relative overflow-hidden transition-all duration-200 ease-out',
            open ? 'w-56 opacity-100 max-sm:w-auto max-sm:flex-1 sm:w-72' : 'w-0 opacity-0',
          )}
        >
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            aria-activedescendant={showPanel && flat[highlight] ? optionId(flat[highlight]) : undefined}
            tabIndex={open ? 0 : -1}
            className={cn(
              'h-10 w-full rounded-lg border border-ink-200 bg-white px-3 pe-8 text-base sm:text-sm text-ink-900',
              'placeholder:text-ink-500 shadow-xs transition-colors text-start',
              'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:border-focus',
            )}
          />
          {query ? (
            <button
              type="button"
              onClick={dismiss}
              aria-label={tc('clear')}
              title={tc('clear')}
              className="absolute inset-y-0 end-1 my-auto flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          data-scroll-panel
          className="absolute end-0 top-full z-popover mt-1.5 max-h-96 w-80 overflow-y-auto overscroll-contain rounded-xl border border-ink-200 bg-white p-1.5 shadow-lg transition-[opacity,translate] duration-(--duration-fast) ease-standard starting:translate-y-1 starting:opacity-0 max-sm:inset-x-0 max-sm:top-[calc(100%+0.875rem)] max-sm:mt-0 max-sm:max-h-[60dvh] max-sm:w-auto sm:w-96"
        >
          {loading && results.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-500">
              <Spinner /> {t('searching')}
            </p>
          ) : grouped.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">
              {t('noResults', { query: term })}
            </p>
          ) : (
            grouped.map(({ group, items }) => {
              const meta = GROUP_META[group];
              const Icon = meta.icon;
              return (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    {t(`groups.${group}`)}
                  </p>
                  <ul>
                    {items.map((result) => (
                      <li key={`${result.group}-${result.id}`}>
                        <button
                          type="button"
                          id={optionId(result)}
                          role="option"
                          aria-selected={flat[highlight] === result}
                          onMouseEnter={() => setHighlight(flat.indexOf(result))}
                          onClick={() => {
                            dismiss();
                            router.push(result.href);
                          }}
                          className={cn(
                            'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-start transition-colors hover:bg-jade-50 focus-visible:bg-jade-50 focus-visible:outline-none',
                            flat[highlight] === result && 'bg-jade-50',
                          )}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="truncate text-sm font-medium text-ink-900">
                                {result.primary}
                              </span>
                              {result.chinese ? (
                                <span className="shrink-0 text-sm text-ink-500">
                                  {result.chinese}
                                </span>
                              ) : null}
                            </span>
                            {result.secondary ? (
                              <span className="block truncate text-xs text-ink-500" dir="ltr">
                                {result.secondary}
                              </span>
                            ) : null}
                          </span>
                          {/* Category is spelled out, not just implied by an icon. */}
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                              meta.tone,
                            )}
                          >
                            {t(`groupLabels.${group}`)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
