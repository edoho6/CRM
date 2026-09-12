import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Stethoscope } from 'lucide-react';
import { Dash, EmptyState, Table, TableWrapper, Td, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { MED_KINDS, type MedKind } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { CATALOGUE_PAGE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { RememberQuery } from '@/components/remember-query';
import { SegmentedLinks } from '@/components/segmented-links';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { CatalogueSearch } from '@/features/reference/catalogue-search';
import { MedicineKindIcon, MedicineStatusBadge } from '@/features/medicine/medicine-body';
import { MED_LIST_COLUMNS, type MedListRow } from '@/features/medicine/queries';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('medicine', 'title');

const MEDICINE_PATH = '/reference/medicine';

/** The codes a list row shows beside the name: the ones a clinician recognises at a glance. */
const LISTED_IDS: Array<[key: string, label: string]> = [
  ['icd10', 'ICD-10'],
  ['atc', 'ATC'],
  ['loinc', 'LOINC'],
];

/**
 * The Western medicine reference: conditions, symptoms and drugs, compiled
 * from open sources, with the Hebrew entry ours and the sources quoted. One
 * list for the three kinds, a kind filter in the URL, search over every name
 * and alias in both languages.
 */
export default async function MedicinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const { q = '', kind: kindParam = '', page: pageParam } = rawParams;
  const page = pageFrom(pageParam);
  setRequestLocale(locale);

  const t = await getTranslations('medicine');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  const kind = (MED_KINDS as readonly string[]).includes(kindParam) ? (kindParam as MedKind) : null;
  const term = q.trim();

  let query = scope.supabase
    .from('med_entries')
    .select(MED_LIST_COLUMNS, { count: 'exact' })
    .order('name_he', { ascending: true, nullsFirst: false })
    .order('name_en', { ascending: true })
    .range(...pageRange(page, CATALOGUE_PAGE));
  if (kind) query = query.eq('kind', kind);
  if (term) {
    // search_text holds every name and alias in both languages, kept by a trigger.
    const escaped = term.replace(/[%,()]/g, ' ');
    query = query.ilike('search_text', `%${escaped}%`);
  }

  // The counts behind the kind filter, with the same search applied, so the
  // numbers answer "how many of these match" rather than "how many exist".
  const countOf = async (of: MedKind | null) => {
    let counting = scope.supabase.from('med_entries').select('id', { count: 'exact', head: true });
    if (of) counting = counting.eq('kind', of);
    if (term) counting = counting.ilike('search_text', `%${term.replace(/[%,()]/g, ' ')}%`);
    const { count } = await counting;
    return count ?? 0;
  };

  const [result, ...counts] = await Promise.all([query.returns<MedListRow[]>(), countOf(null), ...MED_KINDS.map((k) => countOf(k))]);
  // Before the reference has been loaded the table answers with an error;
  // the page shows an empty library rather than a broken one.
  const rows = result.error ? [] : (result.data ?? []);
  const count = result.error ? 0 : (result.count ?? rows.length);
  const [allCount, ...kindCounts] = counts;

  const kindQuery = (value: MedKind | null) => ({ ...(term ? { q: term } : {}), ...(value ? { kind: value } : {}) });

  return (
    <>
      <PageHeader title={t('title')} description={t('count', { count })} />

      <div className="mb-4 space-y-3">
        <RememberQuery id="medicine" keys={['q', 'kind']} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReferenceNav />
          <CatalogueSearch initialQuery={term} placeholder={t('searchPlaceholder')} />
        </div>
        <SegmentedLinks
          label={t('kindFilter')}
          size="sm"
          items={[
            { href: { pathname: MEDICINE_PATH, query: kindQuery(null) }, label: t('allKinds'), active: kind === null, count: allCount },
            ...MED_KINDS.map((value, index) => ({
              href: { pathname: MEDICINE_PATH, query: kindQuery(value) },
              label: t(`kinds.${value}`),
              active: kind === value,
              count: kindCounts[index],
              icon: <MedicineKindIcon kind={value} className="h-3.5 w-3.5" />,
            })),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-8 w-8" />}
          title={term ? tc('noResults') : t('empty')}
          description={term ? undefined : t('emptyBody')}
        />
      ) : (
        <TableWrapper responsive>
          <Table>
            <thead>
              <tr>
                <th scope="col" className="border-b border-ink-200 bg-ink-50 px-3 py-2 text-start text-xs font-medium text-ink-600">
                  {tc('name')}
                </th>
                <th scope="col" className="border-b border-ink-200 bg-ink-50 px-3 py-2 text-start text-xs font-medium text-ink-600">
                  {t('table.kind')}
                </th>
                <th scope="col" className="border-b border-ink-200 bg-ink-50 px-3 py-2 text-start text-xs font-medium text-ink-600">
                  {t('table.identifiers')}
                </th>
                <th scope="col" className="border-b border-ink-200 bg-ink-50 px-3 py-2 text-start text-xs font-medium text-ink-600">
                  {t('table.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = row.name_he ?? row.name_en;
                const summary = row.summary_he ?? null;
                const codes = LISTED_IDS.filter(([key]) => row.identifiers?.[key]).map(([key, label]) => `${label} ${row.identifiers[key]}`);
                return (
                  <Tr key={row.id}>
                    <Td data-card-title>
                      <div className="flex items-start gap-3">
                        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
                          <MedicineKindIcon kind={row.kind} className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <Link href={`${MEDICINE_PATH}/${row.slug}`} className="text-base font-semibold text-sky-800 underline-offset-2 hover:underline">
                            {name}
                          </Link>
                          {row.name_he ? (
                            <span className="block text-xs text-ink-500" dir="ltr">
                              {row.name_en}
                            </span>
                          ) : null}
                          {summary ? <span className="mt-0.5 line-clamp-2 block text-sm text-ink-700">{summary}</span> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>{t(`kind.${row.kind}`)}</Td>
                    <Td>
                      {codes.length ? (
                        <span dir="ltr" className="text-xs text-ink-700">
                          {codes.join(' · ')}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      <MedicineStatusBadge entry={row} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      )}

      <Pagination page={page} size={CATALOGUE_PAGE} total={count} shown={rows.length} pathname={MEDICINE_PATH} query={{ ...rawParams }} />
    </>
  );
}
