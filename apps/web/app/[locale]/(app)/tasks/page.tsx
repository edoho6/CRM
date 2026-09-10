import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ClinicTaskWithPatient } from '@clinic/db/types';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { TasksBoard } from '@/features/tasks/tasks-board';

/**
 * The to-do list as a page.
 *
 * The dashboard widget is for glancing and for the one-line add; this is
 * where a task gets a time, a patient, and the way it should remind. Done
 * tasks from the last month come along, folded.
 */
export default async function TasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tasks');

  const scope = await getClinicScope();
  if (!scope) return null;

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [openResult, doneResult, patientsResult] = await Promise.all([
    scope.supabase
      .from('clinic_tasks')
      .select('*, patient:patients(id, full_name)')
      .is('done_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('due_on', { ascending: true, nullsFirst: false })
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(500)
      .returns<ClinicTaskWithPatient[]>(),
    scope.supabase
      .from('clinic_tasks')
      .select('*, patient:patients(id, full_name)')
      .not('done_at', 'is', null)
      .gte('done_at', monthAgo.toISOString())
      .order('done_at', { ascending: false })
      .limit(100)
      .returns<ClinicTaskWithPatient[]>(),
    scope.supabase
      .from('patients')
      .select('id, full_name')
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .limit(1000)
      .returns<{ id: string; full_name: string }[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <PageBody width="narrow">
        <TasksBoard
          open={openResult.data ?? []}
          done={doneResult.data ?? []}
          patients={patientsResult.data ?? []}
        />
      </PageBody>
    </>
  );
}
