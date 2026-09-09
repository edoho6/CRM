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
 * Hovering the magnifier opens a search field beside it rather than a dialog:
 * looking someone up is a glance, not a task that deserves to cover the screen.
 * Results appear as you type and only a click navigates, so scanning them never
 * moves you off the page you were on.
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
  hebrew_name: string | null;
  botanical_name: string | null;
}

interface FormulaRow {
  id: string;
  name_pinyin: string | null;
  name_chinese: string | null;
  name_english: string | null;
  name_hebrew: string | null;
}

const RESULTS_PER_GROUP = 5;
const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;
const CLOSE_DELAY_MS = 220;

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
  const router = useRouter();
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  /** Only collapse an empty box: half-typed text must survive a stray mouse move. */
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!query.trim()) setOpen(false);
    }, CLOSE_DELAY_MS);
  }

  useEffect(() => cancelClose, []);

  function reveal() {
    cancelClose();
    setOpen(true);
    // The field is rendered by this same update, so focus waits a frame.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function dismiss() {
    cancelClose();
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

      const [patients, herbs, formulas] = await Promise.all([
        supabase
          .from('patients')
          .select('id, full_name, phone')
          .or(`full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`)
          .eq('is_active', true)
          .limit(RESULTS_PER_GROUP),
        supabase
          .from('herbs')
          .select('id, pinyin_name, chinese_name, english_name, hebrew_name, botanical_name')
          .or(
            `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%,botanical_name.ilike.%${escaped}%`,
          )
          .eq('is_active', true)
          .limit(RESULTS_PER_GROUP),
        supabase
          .from('herb_formulas')
          .select('id, name_pinyin, name_chinese, name_english, name_hebrew')
          .or(
            `name_pinyin.ilike.%${escaped}%,name_chinese.ilike.%${escaped}%,name_english.ilike.%${escaped}%,name_hebrew.ilike.%${escaped}%`,
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

  return (
    <div className="relative" onMouseEnter={reveal} onMouseLeave={scheduleClose}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={t('search')}
          title={t('search')}
          onClick={() => (open ? inputRef.current?.focus() : reveal())}
          onFocus={reveal}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600',
            'transition-all duration-150 ease-out',
            'hover:-translate-y-px hover:border-jade-300 hover:bg-jade-50 hover:text-jade-800 hover:shadow-md',
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
            open ? 'w-56 opacity-100 sm:w-72' : 'w-0 opacity-0',
          )}
        >
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            tabIndex={open ? 0 : -1}
            className={cn(
              'h-11 w-full rounded-xl border border-ink-200 bg-white px-3 pe-8 text-sm text-ink-900',
              'placeholder:text-ink-500 shadow-xs transition-colors text-start',
              'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:border-focus',
            )}
          />
          {query ? (
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('search')}
              className="absolute inset-y-0 end-2 my-auto flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {showPanel ? (
        <div
          className="absolute top-full z-popover mt-1.5 max-h-96 w-80 overflow-y-auto rounded-xl border border-ink-200 bg-white p-1.5 shadow-lg transition-[opacity,translate] duration-(--duration-fast) ease-standard starting:translate-y-1 starting:opacity-0 sm:w-96"
          style={{ insetInlineEnd: 0 }}
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
                          onClick={() => {
                            dismiss();
                            router.push(result.href);
                          }}
                          className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-start transition-colors hover:bg-jade-50 focus-visible:bg-jade-50 focus-visible:outline-none"
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
