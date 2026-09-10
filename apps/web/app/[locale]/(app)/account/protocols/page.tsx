import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { TreatmentProtocol } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { SettingsNav } from '@/features/settings/settings-nav';
import { getClinicScope } from '@/lib/session';
import { ProtocolsManager } from '@/features/encounters/protocols-manager';

/**
 * Saved treatment protocols.
 *
 * Retired ones are loaded here and nowhere else: this is the only screen from
 * which one can be brought back, so it is the only screen that needs to see
 * them. The treatment page loads active protocols only.
 */
export default async function ProtocolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('protocols');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('treatment_protocols')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(500)
    .returns<TreatmentProtocol[]>();

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <SettingsNav />
      <div className="max-w-3xl">
        <ProtocolsManager protocols={data ?? []} />
      </div>
    </>
  );
}
