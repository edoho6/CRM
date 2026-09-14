import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookMarked } from 'lucide-react';
import { Badge, Dash, EmptyState, PageBody, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { formatDate } from '@clinic/i18n';
import { PageHeader } from '@/components/app-shell';
import { ExternalLink } from '@/components/external-link';
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

/**
 * What the library holds, for anyone who asks it questions: every file and
 * every page, when it was last read, how many passages it became. The
 * loading itself happens from a terminal, by whoever runs the service.
 */
export default async function LibrarySourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('library.sources');
  const tc = await getTranslations('common');

  // The passage count per source is a count over every passage in the
  // library; right after a large load, before the indexes and statistics
  // catch up, that can run past the database's time limit. The list is
  // then shown without the counts rather than as an empty library.
  const counted = await scope.supabase
    .from('library_sources')
    .select('id, kind, title, url, pages, fetched_at, chunks:library_chunks(count)')
    .eq('status', 'active')
    .order('kind')
    .order('title')
    .limit(1000)
    .returns<SourceRow[]>();
  const plain = counted.error
    ? await scope.supabase
        .from('library_sources')
        .select('id, kind, title, url, pages, fetched_at')
        .eq('status', 'active')
        .order('kind')
        .order('title')
        .limit(1000)
        .returns<Omit<SourceRow, 'chunks'>[]>()
    : null;
  const rows: SourceRow[] = counted.data ?? (plain?.data ?? []).map((row) => ({ ...row, chunks: null }));

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<LibraryNav current="sources" />} />
      <PageBody width="wide">
        {rows.length === 0 ? (
          <EmptyState icon={<BookMarked className="h-8 w-8" />} title={t('empty')} />
        ) : (
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
        )}
      </PageBody>
    </>
  );
}
