import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/app-shell';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { HerbForm } from '@/features/inventory/herb-form';

export default async function NewHerbPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('inventory.herbs');

  return (
    <>
      <PageHeader title={t('new')} actions={<ReferenceNav compact />} />
      <HerbForm />
    </>
  );
}
