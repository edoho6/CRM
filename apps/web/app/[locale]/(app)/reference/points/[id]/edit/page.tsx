import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AcupuncturePoint } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { PointForm } from '@/features/reference/point-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('reference.points', 'edit');

export default async function EditPointPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('reference.points');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: point } = await scope.supabase
    .from('acupuncture_points')
    .select('*')
    .eq('id', id)
    .maybeSingle<AcupuncturePoint>();

  if (!point) notFound();

  return (
    <>
      <PageHeader
        title={t('edit')}
        description={
          <span dir="ltr">
            {point.code}
            {point.pinyin_name ? ` · ${point.pinyin_name}` : ''}
          </span>
        }
        actions={<ReferenceNav compact />}
      />
      <PointForm point={point} />
    </>
  );
}
