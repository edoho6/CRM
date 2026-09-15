import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookMarked } from 'lucide-react';
import { Badge, Dash, EmptyState, PageBody, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { formatDate } from '@clinic/i18n';
import { PageHeader } from '@/components/app-shell';
import { ExternalLink } from '@/components/external-link';
import { Pagination, pageFrom, pageRange } from '@/components/pagination';
import { SegmentedLinks } from '@/components/segmented-links';
import { getClinicScope } from '@/lib/session';
import { LibraryNav } from '@/features/library/library-nav';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('library.sources', 'title');

interface SourceRow {
  id: string;
  kind: 'file' | 'website';
  title: string;
  url: string | null;
  pages: number | null;
  fetched_at: string;
  /** Null when the count could not be had in time. */
  chunks: { count: number }[] | null;
}

type Kind = 'all' | 'file' | 'website';

/**
 * What the library holds, for anyone who asks it questions: every file and
 * every page, when it was last read, how many passages it became. A page
 * at a time — the websites alone run to thousands of pages — and by kind,
 * because a practitioner looking for a book does not want to scroll past
 * every article of every site. The loading itself happens from a terminal,
 * by whoever runs the service.
 */
export default async function LibrarySourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; kind?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('library.sources');
  const tc = await getTranslations('common');

  const query = await searchParams;
  const kind: Kind = query.kind === 'file' || query.kind === 'website' ? query.kind : 'all';
  const page = pageFrom(query.page);
  const [from, to] = pageRange(page);
  // The passage count is a count per source; over one page of fifty it is
  // quick, but right after a large load, before the statistics catch up,
  // it can still run past the database's time limit. The list is then
  // shown without the counts rather than as an empty library.
  let countedQuery = scope.supabase
    .from('library_sources')
    .select('id, kind, title, url, pages, fetched_at, chunks:library_chunks(count)', { count: 'exact' })
    .eq('status', 'active');
  if (kind !== 'all') countedQuery = countedQuery.eq('kind', kind);
  const counted = await countedQuery.order('kind').order('title').range(from, to).returns<SourceRow[]>();

  let plain: { data: Omit<SourceRow, 'chunks'>[] | null; count: number | null } | null = null;
  if (counted.error) {
    let plainQuery = scope.supabase.from('library_sources').select('id, kind, title, url, pages, fetched_at', { count: 'exact' }).eq('status', 'active');
    if (kind !== 'all') plainQuery = plainQuery.eq('kind', kind);
    plain = await plainQuery.order('kind').order('title').range(from, to).returns<Omit<SourceRow, 'chunks'>[]>();
  }
  const rows: SourceRow[] = counted.data ?? (plain?.data ?? []).map((row) => ({ ...row, chunks: null }));
  const total = counted.count ?? plain?.count ?? null;
  const kindQuery = kind === 'all' ? {} : { kind };

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<LibraryNav current="sources" />} />
      <PageBody width="wide">
        <SegmentedLinks
          label={t('kindHeading')}
          size="sm"
          items={(['all', 'file', 'website'] as const).map((value) => ({
            href: value === 'all' ? { pathname: '/library/sources' } : { pathname: '/library/sources', query: { kind: value } },
            label: value === 'all' ? tc('all') : value === 'file' ? t('files') : t('websites'),
            active: kind === value,
          }))}
        />
        {rows.length === 0 ? (
          <EmptyState icon={<BookMarked className="h-8 w-8" />} title={t('empty')} />
        ) : (
          <>
            <TableWrapper responsive>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>{tc('name')}</Th>
                    <Th>{t('kindHeading')}</Th>
                    <Th>{t('passagesHeading')}</Th>
                    <Th>{t('fetchedHeading')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      <Td data-card-title>
                        {row.url ? (
                          <ExternalLink href={row.url} newTabLabel={tc('opensInNewTab')} className="font-medium text-ink-900 underline-offset-2 hover:underline">
                            <span dir="auto">{row.title}</span>
                          </ExternalLink>
                        ) : (
                          <span dir="auto" className="font-medium text-ink-900">
                            {row.title}
                          </span>
                        )}
                        {row.pages ? <span className="block text-xs text-ink-500">{t('pages', { count: row.pages })}</span> : null}
                      </Td>
                      <Td>
                        <Badge tone="muted">{row.kind === 'website' ? t('website') : t('file')}</Badge>
                      </Td>
                      <Td>
                        {row.chunks ? <span className="tabular-nums">{t('passages', { count: row.chunks[0]?.count ?? 0 })}</span> : <Dash />}
                      </Td>
                      <Td>{formatDate(new Date(row.fetched_at))}</Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
            <Pagination page={page} total={total} shown={rows.length} pathname="/library/sources" query={kindQuery} />
          </>
        )}
      </PageBody>
    </>
  );
}
