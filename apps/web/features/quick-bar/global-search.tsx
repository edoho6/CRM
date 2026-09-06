'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FlaskConical, Search, Sprout, User } from 'lucide-react';
import { Button, Dialog, DialogContent, Input, Spinner, cn } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { useSupabase } from '@/lib/use-supabase';
import { herbPrimaryName, herbSecondaryName, formulaPrimaryName, formulaSecondaryName } from '@/lib/display';

/**
 * Global search, reachable from every screen and with Ctrl+K.
 *
 * One box across patients, herbs and formulas, because the practitioner thinks
 * "where is Dana" or "how much Huang Qi is left" — not "which section do I open
 * first". Queries run in parallel and each is capped, so a broad term stays fast.
 */

interface SearchResult {
  id: string;
  group: 'patients' | 'herbs' | 'formulas';
  primary: string;
  secondary: string;
  href: string;
}

/** Only the columns the search selects — the naming helpers need nothing more. */
interface HerbRow {
  id: string;
  pinyin_name: string | null;
  chinese_name: string | null;
  english_name: string | null;
  hebrew_name: string | null;
}

interface FormulaRow {
  id: string;
  name_pinyin: string | null;
  name_chinese: string | null;
  name_english: string | null;
  name_hebrew: string | null;
}

const RESULTS_PER_GROUP = 5;
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

/** PostgREST `or=` splits on commas and parentheses, so they must not survive. */
function escapeTerm(term: string): string {
  return term.replace(/[%,()]/g, ' ').trim();
}

const GROUP_ICON = {
  patients: User,
  herbs: Sprout,
  formulas: FlaskConical,
} as const;

export function GlobalSearch() {
  const t = useTranslations('quickBar');
  const router = useRouter();
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Ctrl+K / Cmd+K from anywhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
          .select('id, pinyin_name, chinese_name, english_name, hebrew_name')
          .or(
            `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%`,
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
          secondary: herbSecondaryName(herb),
          href: `/inventory/herbs/${herb.id}`,
        });
      }

      for (const row of formulas.data ?? []) {
        const formula = row as FormulaRow;
        found.push({
          id: formula.id,
          group: 'formulas',
          primary: formulaPrimaryName(formula),
          secondary: formulaSecondaryName(formula),
          href: `/inventory/formulas/${formula.id}`,
        });
      }

      return found;
    },
    [supabase],
  );

  useEffect(() => {
    if (!open) return;
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
  }, [query, open, runSearch]);

  // Reset between openings so the previous search isn't waiting there.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const grouped = useMemo(() => {
    return (['patients', 'herbs', 'formulas'] as const)
      .map((group) => ({ group, items: results.filter((result) => result.group === group) }))
      .filter((entry) => entry.items.length > 0);
  }, [results]);

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  const term = query.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t('search')}
        title={t('search')}
      >
        <Search className="h-4 w-4" />
      </Button>

      <DialogContent title={t('searchTitle')} description={t('searchHint')} className="max-w-xl">
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400"
            aria-hidden
          />
          <Input
            ref={inputRef}
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="ps-9"
          />
        </div>

        <div className="mt-3 max-h-80 overflow-y-auto">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-400">
              <Spinner /> {t('searching')}
            </p>
          ) : term.length < MIN_QUERY_LENGTH ? (
            <p className="py-6 text-center text-sm text-ink-400">{t('typeToSearch')}</p>
          ) : grouped.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t('noResults', { query: term })}</p>
          ) : (
            grouped.map(({ group, items }) => {
              const Icon = GROUP_ICON[group];
              return (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">
                    {t(`groups.${group}`)}
                  </p>
                  <ul>
                    {items.map((result) => (
                      <li key={`${result.group}-${result.id}`}>
                        <button
                          type="button"
                          onClick={() => select(result.href)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors',
                            'hover:bg-jade-50 focus-visible:bg-jade-50 focus-visible:outline-none',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink-900">{result.primary}</span>
                            {result.secondary ? (
                              <span className="block truncate text-xs text-ink-500" dir="ltr">
                                {result.secondary}
                              </span>
                            ) : null}
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
      </DialogContent>
    </Dialog>
  );
}
