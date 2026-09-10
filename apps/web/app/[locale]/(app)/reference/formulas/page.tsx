import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { FlaskConical, Plus } from 'lucide-react';
import {
  Dash,
  Badge,
  Button,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { HerbFormulaWithItems } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { CATALOGUE_PAGE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { RememberQuery } from '@/components/remember-query';
import { TcmChip } from '@/components/tcm-chip';
import { getClinicScope } from '@/lib/session';
import { formulaChineseName, formulaPrimaryName, herbPrimaryName } from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { CatalogueSearch } from '@/features/reference/catalogue-search';
import { CompareToggle, CompareTray } from '@/features/reference/compare-controls';
import { FormulaFilters } from '@/features/inventory/formula-filters';
import {
  parseFormulaFilters,
  type FormulaSearchParams,
} from '@/features/inventory/formula-filter-params';

export default async function FormulasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<FormulaSearchParams>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const filters = parseFormulaFilters(rawParams);
  const page = pageFrom((rawParams as { page?: string }).page);
  setRequestLocale(locale);

  const t = await getTranslations('inventory.formulas');
  const tFormulaTcm = await getTranslations('inventory.formulaTcmCategory');
  const tReview = await getTranslations('inventory.review');
  const tc = await getTranslations('common');
  const tCompare = await getTranslations('reference.compare');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('herb_formulas')
    .select(
      '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit))',
      { count: 'exact' },
    )
    .order('name_pinyin', { ascending: true })
    .range(...pageRange(page, CATALOGUE_PAGE));

  if (filters.q) {
    const escaped = filters.q.replace(/[%,()]/g, ' ');
    query = query.or(
      `name_pinyin.ilike.%${escaped}%,name_chinese.ilike.%${escaped}%,name_english.ilike.%${escaped}%,name_hebrew.ilike.%${escaped}%,source_text.ilike.%${escaped}%`,
    );
  }
  if (filters.cat.length) query = query.in('tcm_category', filters.cat);
  if (filters.kind.length) query = query.in('category', filters.kind);
  if (filters.review) query = query.eq('needs_review', true);

  const { data, count } = await query.returns<HerbFormulaWithItems[]>();
  const formulas = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('count', { count: count ?? formulas.length })}
        actions={
          <Button asChild>
            <Link href="/reference/formulas/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <ReferenceNav />

      <div className="mb-4 space-y-3">
        <RememberQuery id="formulas" keys={['q', 'cat', 'kind', 'review']} />
        <CatalogueSearch initialQuery={filters.q} placeholder={t('searchPlaceholder')} />
        <FormulaFilters filters={filters} />
      </div>

      {formulas.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title={filters.q ? tc('noResults') : t('empty')}
          description={filters.q ? undefined : t('emptyBody')}
          action={
            <Button asChild size="sm">
              <Link href="/reference/formulas/new">{t('new')}</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="name" sortDisabled={(count ?? 0) > CATALOGUE_PAGE}>
            <thead>
              <tr>
                <th scope="col" className="w-10 border-b border-ink-200 bg-ink-50 px-3 py-2">
                  <span className="sr-only">{tCompare('column')}</span>
                </th>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="cat">{t('fields.tcmCategory')}</SortTh>
                <SortTh sortKey="source">{t('fields.sourceText')}</SortTh>
                <SortTh sortKey="items">{t('herbCount')}</SortTh>
                <SortTh sortKey="weight">{t('totalWeight')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {formulas.map((formula) => {
                const chinese = formulaChineseName(formula);
                const total = formula.items.reduce((sum, item) => sum + Number(item.dosage), 0);
                // A one-line preview of the prescription, so the list itself
                // answers "which formula was the one with Chai Hu in it?".
                const preview = formula.items
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .slice(0, 5)
                  .map((item) => herbPrimaryName(item.herb, locale as Locale))
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Tr
                    key={formula.id}
                    sort={{
                      name: formulaPrimaryName(formula, locale as Locale),
                      cat: formula.tcm_category ? tFormulaTcm(formula.tcm_category) : null,
                      source: formula.source_text,
                      items: formula.items.length,
                      weight: total,
                    }}
                  >
                    <Td className="w-10">
                      <CompareToggle
                        kind="formula"
                        id={formula.id}
                        label={formulaPrimaryName(formula, locale as Locale)}
                      />
                    </Td>
                    <Td data-card-title>
                      <Link
                        href={`/reference/formulas/${formula.id}`}
                        className="flex items-baseline gap-2 underline-offset-2 hover:underline"
                      >
                        <span className="text-base font-semibold text-jade-800">
                          {formulaPrimaryName(formula, locale as Locale)}
                        </span>
                        {chinese ? <span className="text-base text-ink-600">{chinese}</span> : null}
                      </Link>
                      {formula.name_english ? (
                        <span className="block text-xs text-ink-500" dir="ltr">
                          {formula.name_english}
                        </span>
                      ) : null}
                      {preview ? (
                        <span className="mt-0.5 block text-xs text-ink-500" dir="ltr">
                          {preview}
                          {formula.items.length > 5 ? ' …' : ''}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      {formula.tcm_category ? (
                        <TcmChip scale="formulaTcmCategory" value={formula.tcm_category}>
                          {tFormulaTcm(formula.tcm_category)}
                        </TcmChip>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      <span className="text-xs text-ink-600 italic" dir="ltr">
                        {formula.source_text ?? <Dash />}
                      </span>
                    </Td>
                    <Td>
                      <span className="tabular-nums">{formula.items.length}</span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="font-semibold tabular-nums">
                        {format.number(total)} g
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}

      <CompareTray />
      <Pagination
        page={page}
        size={CATALOGUE_PAGE}
        total={count ?? null}
        shown={formulas.length}
        pathname="/reference/formulas"
        query={{ ...rawParams }}
      />
    </>
  );
}
