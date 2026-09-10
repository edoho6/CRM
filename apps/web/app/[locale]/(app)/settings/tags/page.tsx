import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { PatientTag } from '@clinic/db/types';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { TagsManager } from '@/features/settings/tags-manager';

export default async function TagsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  const [{ data: tags }, { data: links }] = await Promise.all([
    scope.supabase
      .from('patient_tags')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .returns<PatientTag[]>(),
    // Counted here rather than with a GROUP BY the client cannot express: a
    // few thousand short rows at most.
    scope.supabase
      .from('patient_tag_links')
      .select('tag_id')
      .limit(20_000)
      .returns<{ tag_id: string }[]>(),
  ]);

  const usage: Record<string, number> = {};
  for (const link of links ?? []) usage[link.tag_id] = (usage[link.tag_id] ?? 0) + 1;

  return (
    <>
      <PageHeader title={t('tags.title')} description={t('tags.subtitle')} below={<SettingsNav />} />
      <PageBody width="narrow">
        <TagsManager tags={tags ?? []} usage={usage} />
      </PageBody>
    </>
  );
}
