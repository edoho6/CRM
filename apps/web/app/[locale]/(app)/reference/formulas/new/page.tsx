import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Herb } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { FormulaForm } from '@/features/inventory/formula-form';

export default async function NewFormulaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('inventory.formulas');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: herbs } = await scope.supabase
    .from('herbs')
    .select('*')
    .eq('is_active', true)
    .order('pinyin_name', { ascending: true })
    .limit(2000)
    .returns<Herb[]>();

  return (
    <>
      <PageHeader title={t('new')} />
      <ReferenceNav />
      <FormulaForm herbs={herbs ?? []} />
    </>
  );
}
