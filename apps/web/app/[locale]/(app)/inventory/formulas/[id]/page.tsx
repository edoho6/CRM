import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, Pencil } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Herb, HerbFormula, HerbFormulaItem } from '@clinic/db/types';
import { TEMPERATURES, type Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { TcmChip, TcmChips } from '@/components/tcm-chip';
import { getClinicScope } from '@/lib/session';
import {
  formulaChineseName,
  formulaPrimaryName,
  herbBotanicalName,
  herbChineseName,
  herbPrimaryName,
} from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';

/**
 * A formula's reference page, built on the same skeleton as a herb's: identity
 * at the top, the numbers that matter beside it, then the prose and finally the
 * ingredient list. Nothing here is editable — reading a prescription and
 * rewriting one are different acts, and the edit form lives behind its own
 * button so a stray click can never quietly change a dose.
 */

type ItemRow = HerbFormulaItem & {
  herb: Pick<
    Herb,
    | 'id'
    | 'pinyin_name'
    | 'chinese_name'
    | 'english_name'
    | 'hebrew_name'
    | 'botanical_name'
    | 'tcm_category'
    | 'temperature'
    | 'tastes'
    | 'default_unit'
  > | null;
};

type FormulaRow = HerbFormula & { items: ItemRow[] };

function Prose({ text }: { text: string | null }) {
  if (!text) return <span className="text-ink-400">—</span>;
  return <span className="whitespace-pre-wrap">{text}</span>;
}

export default async function FormulaDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.formulas');
  const tf = await getTranslations('inventory.formulas.fields');
  const tCategory = await getTranslations('inventory.formulas.category');
  const tFormulaTcm = await getTranslations('inventory.formulaTcmCategory');
  const tTcm = await getTranslations('inventory.tcmCategory');
  const tTemp = await getTranslations('inventory.temperature');
  const tTaste = await getTranslations('inventory.taste');
  const tUnit = await getTranslations('inventory.unit');
  const tReview = await getTranslations('inventory.review');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: formula } = await scope.supabase
    .from('herb_formulas')
    .select(
      '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, botanical_name, tcm_category, temperature, tastes, default_unit))',
    )
    .eq('id', id)
    .maybeSingle<FormulaRow>();

  if (!formula) notFound();

  const items = [...(formula.items ?? [])].sort((a, b) => a.sequence - b.sequence);
  const totalWeight = items.reduce((sum, item) => sum + Number(item.dosage), 0);
  const chinese = formulaChineseName(formula);
  const primary = formulaPrimaryName(formula, locale as Locale);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span dir="ltr">{primary}</span>
            {chinese ? <span className="font-normal text-ink-600">{chinese}</span> : null}
            {formula.needs_review ? (
              <Badge tone="warning" className="align-middle">
                <AlertTriangle className="h-3 w-3" />
                {tReview('badge')}
              </Badge>
            ) : null}
          </span>
        }
        description={
          <span className="block" dir="ltr">
            {formula.name_english ?? ''}
            {formula.name_english && formula.source_text ? ' · ' : ''}
            {formula.source_text ? <span className="italic">{formula.source_text}</span> : null}
          </span>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href={`/inventory/formulas/${formula.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {tc('edit')}
            </Link>
          </Button>
        }
      />
      <InventoryNav />

      {formula.needs_review ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {tReview('hint')}
        </p>
      ) : null}

      {/* Same idea as the herb page: the figures you need before reading a word. */}
      <section className="mb-5 rounded-card border border-ink-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="text-xs font-medium text-ink-500">{t('totalWeight')}</p>
            <p dir="ltr" className="text-3xl leading-tight font-bold tabular-nums text-jade-800">
              {format.number(totalWeight)} g
            </p>
            {formula.dosage_notes ? (
              <p className="mt-0.5 max-w-md text-xs text-ink-600">{formula.dosage_notes}</p>
            ) : null}
          </div>

          <div className="h-12 w-px shrink-0 bg-ink-100" aria-hidden />

          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-ink-500">{t('items')}</p>
              <p className="text-xl font-semibold tabular-nums text-ink-800">{items.length}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-500">{tf('tcmCategory')}</p>
              {formula.tcm_category ? (
                <TcmChip scale="formulaTcmCategory" value={formula.tcm_category}>
                  {tFormulaTcm(formula.tcm_category)}
                </TcmChip>
              ) : (
                <span className="text-ink-400">—</span>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-500">{tf('category')}</p>
              <Badge tone="neutral">{tCategory(formula.category)}</Badge>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-500">{tc('status')}</p>
              <Badge tone={formula.is_active ? 'success' : 'muted'}>
                {formula.is_active ? tc('active') : tc('inactive')}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('items')}</CardTitle>
              <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-700">
                {format.number(totalWeight)} g
              </span>
            </CardHeader>
            <CardBody className="p-0">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-400">{t('needsHerb')}</p>
              ) : (
                <TableWrapper className="rounded-none border-0">
                  <SortableTable defaultSortKey="order">
                    <thead>
                      <tr>
                        <SortTh sortKey="order">#</SortTh>
                        <SortTh sortKey="name">{tc('name')}</SortTh>
                        <SortTh sortKey="cat">{tf('tcmCategory')}</SortTh>
                        <SortTh sortKey="temp">{t('nature')}</SortTh>
                        <SortTh sortKey="dose">{t('dosage')}</SortTh>
                      </tr>
                    </thead>
                    <SortBody locale={locale}>
                      {items.map((item, index) => {
                        const herb = item.herb;
                        const herbChinese = herb ? herbChineseName(herb) : '';
                        const botanical = herb ? herbBotanicalName(herb) : '';
                        const tastes = herb?.tastes ?? [];
                        return (
                          <Tr
                            key={item.id}
                            sort={{
                              order: index,
                              name: herb ? herbPrimaryName(herb, locale as Locale) : '',
                              cat: herb?.tcm_category ? tTcm(herb.tcm_category) : null,
                              temp: herb?.temperature ? TEMPERATURES.indexOf(herb.temperature) : null,
                              dose: Number(item.dosage),
                            }}
                          >
                            <Td>
                              <span className="text-xs tabular-nums text-ink-400">{index + 1}</span>
                            </Td>
                            <Td>
                              {herb ? (
                                <>
                                  {/* Every ingredient is a door back into the
                                      materia medica, the mirror of the herb
                                      page's list of formulas. */}
                                  <Link
                                    href={`/inventory/herbs/${herb.id}`}
                                    className="flex items-baseline gap-2 underline-offset-2 hover:underline"
                                  >
                                    <span className="font-semibold text-jade-800">
                                      {herbPrimaryName(herb, locale as Locale)}
                                    </span>
                                    {herbChinese ? <span className="text-ink-600">{herbChinese}</span> : null}
                                  </Link>
                                  {botanical ? (
                                    <span className="block text-xs text-ink-500 italic" dir="ltr">
                                      {botanical}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-ink-400">—</span>
                              )}
                              {item.notes ? (
                                <span className="block text-xs text-ink-600">{item.notes}</span>
                              ) : null}
                            </Td>
                            <Td>
                              {herb?.tcm_category ? (
                                <TcmChip scale="tcmCategory" value={herb.tcm_category} size="sm">
                                  {tTcm(herb.tcm_category)}
                                </TcmChip>
                              ) : (
                                <span className="text-ink-400">—</span>
                              )}
                            </Td>
                            <Td>
                              <span className="flex flex-wrap items-center gap-1">
                                {herb?.temperature ? (
                                  <TcmChip scale="temperature" value={herb.temperature} size="sm">
                                    {tTemp(herb.temperature)}
                                  </TcmChip>
                                ) : null}
                                {tastes.length ? (
                                  <TcmChips
                                    scale="taste"
                                    values={tastes}
                                    render={(value) => tTaste(value as never)}
                                    size="sm"
                                  />
                                ) : null}
                              </span>
                            </Td>
                            <Td>
                              <span dir="ltr" className="text-base font-semibold tabular-nums text-ink-900">
                                {format.number(Number(item.dosage))}
                              </span>
                              <span className="ms-1 text-xs text-ink-500">{tUnit(item.unit)}</span>
                            </Td>
                          </Tr>
                        );
                      })}
                    </SortBody>
                  </SortableTable>
                </TableWrapper>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('clinical')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl>
                <DetailRow label={tf('actions')}>
                  <Prose text={formula.actions} />
                </DetailRow>
                <DetailRow label={tf('indications')}>
                  <Prose text={formula.indications} />
                </DetailRow>
                <DetailRow label={tf('contraindications')}>
                  <Prose text={formula.contraindications} />
                </DetailRow>
                {formula.modifications ? (
                  <DetailRow label={tf('modifications')}>
                    <Prose text={formula.modifications} />
                  </DetailRow>
                ) : null}
                {formula.description ? (
                  <DetailRow label={tf('description')}>
                    <Prose text={formula.description} />
                  </DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tc('name')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl>
                <DetailRow label={tf('namePinyin')}>
                  <span dir="ltr">{formula.name_pinyin ?? '—'}</span>
                </DetailRow>
                <DetailRow label={tf('nameChinese')}>{formula.name_chinese ?? '—'}</DetailRow>
                <DetailRow label={tf('nameEnglish')}>
                  <span dir="ltr">{formula.name_english ?? '—'}</span>
                </DetailRow>
                {formula.name_hebrew ? (
                  <DetailRow label={tf('nameHebrew')}>{formula.name_hebrew}</DetailRow>
                ) : null}
                <DetailRow label={tf('sourceText')}>
                  <span dir="ltr" className="italic">
                    {formula.source_text ?? '—'}
                  </span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
