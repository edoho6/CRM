import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScrollText } from 'lucide-react';
import { Badge, EmptyState, PageBody, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { formatDateTime } from '@clinic/i18n';
import type { StatusTone } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { PAGE_SIZE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { LibraryNav } from '@/features/library/library-nav';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('library.activity', 'title');

interface QueryRow {
  id: string;
  user_id: string;
  asked_at: string;
  status: 'answered' | 'no_sources' | 'refused_pii' | 'refused_quota' | 'error';
  sources: { source_id: string; title: string; url: string | null; page: number | null; cited: boolean }[];
}

const STATUS_TONES: Record<QueryRow['status'], StatusTone> = {
  answered: 'success',
  no_sources: 'info',
  refused_pii: 'warning',
  refused_quota: 'warning',
  error: 'danger',
};

/**
 * The clinic's questions to the library: who, when, what came back — and
 * nothing of what was asked, because the log never had it. Paginated like
 * the access log; the policies limit it to the reader's own clinic.
 */
export default async function LibraryActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('library.activity');

  const page = pageFrom((await searchParams).page);
  const [from, to] = pageRange(page);
  const { data, count } = await scope.supabase
    .from('library_queries')
    .select('id, user_id, asked_at, status, sources', { count: 'exact' })
    .order('asked_at', { ascending: false })
    .range(from, to)
    .returns<QueryRow[]>();
  const rows = data ?? [];

  // Names for the ids, through the clinic's own profile policies.
  const names = new Map<string, string>();
  const ids = [...new Set(rows.map((row) => row.user_id))];
  if (ids.length > 0) {
    const { data: profiles } = await scope.supabase.from('profiles').select('id, full_name').in('id', ids);
    for (const profile of profiles ?? []) names.set(profile.id, profile.full_name ?? '');
  }

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<LibraryNav current="activity" />} />
      <PageBody width="wide">
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-8 w-8" />} title={t('empty')} />
        ) : (
          <>
            <TableWrapper responsive>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>{t('when')}</Th>
                    <Th>{t('who')}</Th>
                    <Th>{t('status')}</Th>
                    <Th>{t('sources')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      <Td data-card-title>
                        <span dir="ltr">{formatDateTime(new Date(row.asked_at))}</span>
                      </Td>
                      <Td>{names.get(row.user_id) || '–'}</Td>
                      <Td>
                        <Badge tone={STATUS_TONES[row.status]}>{t(`statuses.${row.status}`)}</Badge>
                      </Td>
                      <Td>
                        {row.sources.length === 0 ? (
                          <span className="text-ink-500">{t('none')}</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {row.sources.map((source, index) => (
                              <li key={`${source.source_id}-${index}`} className="text-xs" dir="auto">
                                <span className={source.cited ? 'font-medium text-ink-900' : 'text-ink-600'}>{source.title}</span>
                                {source.page ? <span className="text-ink-500"> · {source.page}</span> : null}
                                {source.cited ? <span className="ms-1 text-sky-800">({t('cited')})</span> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
            <Pagination page={page} total={count ?? rows.length} shown={rows.length} pathname="/library/activity" query={{}} />
          </>
        )}
      </PageBody>
    </>
  );
}
