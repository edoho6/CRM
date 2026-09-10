import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Columns3 } from 'lucide-react';
import { EmptyState, TableWrapper } from '@clinic/ui';
import type { AcupuncturePoint, Herb, HerbFormulaWithItems } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import {
  formulaPrimaryName,
  herbBotanicalName,
  herbChineseName,
  herbPrimaryName,
} from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { CompareTable, type CompareColumn, type CompareRow } from '@/features/reference/compare-table';

/**
 * Two to four entries of the catalogue, side by side.
 *
 * Attributes down the side and entries across the top, which is the way round
 * that makes a comparison readable: the eye travels along one row to answer one
 * question ("which of these is coldest"), and a table with entries as rows makes
 * that a vertical scan across changing labels.
 *
 * The selection arrives in the URL rather than from storage, so a comparison can
 * be linked to, reloaded, and opened in a second window beside the first.
 */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; ids?: string }>;
}) {
  const { locale } = await params;
  const { kind, ids } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('reference.compare');
  const tHerb = await getTranslations('inventory.herbs.fields');
  const tFormula = await getTranslations('inventory.formulas.fields');
  const tPoint = await getTranslations('reference.points.fields');
  const tTcm = await getTranslations('inventory.tcmCategory');
  const tTemp = await getTranslations('inventory.temperature');
  const tTaste = await getTranslations('inventory.taste');
  const tChannel = await getTranslations('inventory.channel');
  const tPointChannel = await getTranslations('reference.pointChannel');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  // Anything unrecognised in the URL is treated as nothing selected rather than
  // as an error: this is a link people edit and share.
  const idList = (ids ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[0-9a-fA-F-]{36}$/.test(value))
    .slice(0, 4);

  const empty = (
    <>
      <PageHeader title={t('title')} actions={<ReferenceNav compact />} />
      <EmptyState
        icon={<Columns3 className="h-8 w-8" />}
        title={t('nothingSelected')}
        description={t('nothingSelectedBody')}
      />
    </>
  );

  if (idList.length < 2) return empty;

  let columns: CompareColumn[] = [];
  let rows: CompareRow[] = [];

  /** Rendered as a dash when there is nothing: absence is a finding. */
  const list = (values: string[] | null | undefined, translate: (value: string) => string) =>
    values && values.length > 0 ? values.map(translate).join(', ') : null;

  if (kind === 'herb') {
    const { data } = await scope.supabase
      .from('herbs')
      .select('*')
      .in('id', idList)
      .returns<Herb[]>();

    // Ordered as the URL asked, not as the database returned them — the columns
    // should stand in the order they were ticked.
    const herbs = idList
      .map((id) => (data ?? []).find((herb) => herb.id === id))
      .filter((herb): herb is Herb => Boolean(herb));

    if (herbs.length < 2) return empty;

    columns = herbs.map((herb) => ({
      id: herb.id,
      title: herbPrimaryName(herb, locale as Locale),
      subtitle: herbChineseName(herb),
      href: `/reference/herbs/${herb.id}`,
      imageUrl: herb.image_url,
    }));

    rows = [
      { label: tHerb('botanicalName'), values: herbs.map((h) => herbBotanicalName(h)), ltr: true },
      {
        label: tHerb('tcmCategory'),
        values: herbs.map((h) => (h.tcm_category ? tTcm(h.tcm_category) : null)),
      },
      {
        label: tHerb('temperature'),
        values: herbs.map((h) => (h.temperature ? tTemp(h.temperature) : null)),
        highlight: true,
      },
      {
        label: tHerb('tastes'),
        values: herbs.map((h) => list(h.tastes, (value) => tTaste(value))),
        highlight: true,
      },
      {
        label: tHerb('channels'),
        values: herbs.map((h) => list(h.channels, (value) => tChannel(value))),
        highlight: true,
      },
      {
        label: tHerb('dosageRange'),
        values: herbs.map((h) =>
          h.dosage_min_g !== null || h.dosage_max_g !== null
            ? `${h.dosage_min_g !== null ? format.number(Number(h.dosage_min_g)) : '?'}–${
                h.dosage_max_g !== null ? format.number(Number(h.dosage_max_g)) : '?'
              } g`
            : null,
        ),
        ltr: true,
      },
      { label: tHerb('functions'), values: herbs.map((h) => h.functions) },
      { label: tHerb('indications'), values: herbs.map((h) => h.indications) },
      { label: tHerb('cautions'), values: herbs.map((h) => h.cautions) },
    ];
  } else if (kind === 'formula') {
    const { data } = await scope.supabase
      .from('herb_formulas')
      .select(
        '*, items:herb_formula_items(dosage, unit, herb:herbs(pinyin_name, english_name, hebrew_name))',
      )
      .in('id', idList)
      .returns<HerbFormulaWithItems[]>();

    const formulas = idList
      .map((id) => (data ?? []).find((formula) => formula.id === id))
      .filter((formula): formula is HerbFormulaWithItems => Boolean(formula));

    if (formulas.length < 2) return empty;

    columns = formulas.map((formula) => ({
      id: formula.id,
      title: formulaPrimaryName(formula, locale as Locale),
      subtitle: formula.name_chinese,
      href: `/reference/formulas/${formula.id}`,
      imageUrl: formula.image_url,
    }));

    rows = [
      { label: tFormula('namePinyin'), values: formulas.map((f) => f.name_pinyin), ltr: true },
      { label: tFormula('sourceText'), values: formulas.map((f) => f.source_text) },
      {
        label: t('ingredientCount'),
        values: formulas.map((f) => String(f.items?.length ?? 0)),
        ltr: true,
        highlight: true,
      },
      {
        label: t('ingredients'),
        values: formulas.map(
          (f) =>
            (f.items ?? [])
              .map((item) => {
                const name =
                  item.herb?.pinyin_name ?? item.herb?.english_name ?? item.herb?.hebrew_name ?? '';
                return name ? `${name} ${item.dosage}${item.unit === 'gram' ? 'g' : ''}` : null;
              })
              .filter(Boolean)
              .join(' · ') || null,
        ),
      },
      { label: tFormula('actions'), values: formulas.map((f) => f.actions) },
      { label: tFormula('indications'), values: formulas.map((f) => f.indications) },
      {
        label: tFormula('contraindications'),
        values: formulas.map((f) => f.contraindications),
      },
      { label: tFormula('modifications'), values: formulas.map((f) => f.modifications) },
    ];
  } else if (kind === 'point') {
    const { data } = await scope.supabase
      .from('acupuncture_points')
      .select('*')
      .in('id', idList)
      .returns<AcupuncturePoint[]>();

    const points = idList
      .map((id) => (data ?? []).find((point) => point.id === id))
      .filter((point): point is AcupuncturePoint => Boolean(point));

    if (points.length < 2) return empty;

    columns = points.map((point) => ({
      id: point.id,
      title: point.code,
      subtitle: point.pinyin_name,
      href: `/reference/points/${point.id}`,
      imageUrl: null,
    }));

    rows = [
      {
        label: tPoint('channel'),
        values: points.map((p) => tPointChannel(p.channel)),
        highlight: true,
      },
      { label: tPoint('chineseName'), values: points.map((p) => p.chinese_name) },
      {
        label: tPoint('english'),
        values: points.map((p) => p.english_name),
      },
      { label: tPoint('location'), values: points.map((p) => p.location) },
      { label: tPoint('actions'), values: points.map((p) => p.actions), highlight: true },
      { label: tPoint('indications'), values: points.map((p) => p.indications) },
      { label: tPoint('needling'), values: points.map((p) => p.needling), ltr: true },
      { label: tPoint('cautions'), values: points.map((p) => p.cautions) },
    ];
  } else {
    return empty;
  }

  return (
    <>
      {/* No "back to list" button: the catalogue strip under the heading and
          the shell's back button already lead there. */}
      <PageHeader title={t('title')} description={t('subtitle')} actions={<ReferenceNav compact />} />
      <TableWrapper>
        <CompareTable
          columns={columns}
          rows={rows}
          differsLabel={t('differs')}
          attributeLabel={t('attribute')}
        />
      </TableWrapper>
    </>
  );
}
