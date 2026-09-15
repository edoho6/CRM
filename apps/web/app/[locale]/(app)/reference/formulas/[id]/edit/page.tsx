import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Herb, HerbFormulaWithItems } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { formulaPrimaryName } from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { FormulaForm } from '@/features/inventory/formula-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('inventory.formulas', 'edit');

export default async function EditFormulaPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('inventory.formulas');

  const scope = await getClinicScope();
  if (!scope) return null;

  const [{ data: formula }, { data: herbs }] = await Promise.all([
    scope.supabase
      .from('herb_formulas')
      .select(
        '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, default_unit))',
      )
      .eq('id', id)
      .maybeSingle<HerbFormulaWithItems>(),
    scope.supabase
      .from('herbs')
      .select('*')
      .eq('is_active', true)
      .order('pinyin_name', { ascending: true })
      .limit(2000)
      .returns<Herb[]>(),
  ]);

  if (!formula) notFound();

  return (
    <>
      <PageHeader
        title={t('edit')}
        description={formulaPrimaryName(formula, locale as Locale)}
        actions={<ReferenceNav compact />}
      />
      <FormulaForm formula={formula} herbs={herbs ?? []} />
    </>
  );
}
