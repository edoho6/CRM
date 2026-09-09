import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Room } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { RoomsManager } from '@/features/settings/rooms-manager';

export default async function RoomsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: rooms } = await scope.supabase
    .from('rooms')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<Room[]>();

  return (
    <>
      <PageHeader title={t('title')} description={t('rooms.subtitle')} />
      <SettingsNav />
      <div className="max-w-3xl">
        <RoomsManager rooms={rooms ?? []} />
      </div>
    </>
  );
}
