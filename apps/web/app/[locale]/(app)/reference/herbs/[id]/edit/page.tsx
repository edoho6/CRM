import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Herb } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { herbPrimaryName } from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { HerbForm } from '@/features/inventory/herb-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('inventory.herbs', 'edit');

export default async function EditHerbPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('inventory.herbs');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: herb } = await scope.supabase
    .from('herbs')
    .select('*')
    .eq('id', id)
    .maybeSingle<Herb>();

  if (!herb) notFound();

  return (
    <>
      <PageHeader
        title={t('edit')}
        description={herbPrimaryName(herb, locale as Locale)}
        actions={<ReferenceNav compact />}
      />
      <HerbForm herb={herb} />
    </>
  );
}
