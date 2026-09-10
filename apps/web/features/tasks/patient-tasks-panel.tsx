'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ListChecks, Plus } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, CardTitle, cn } from '@clinic/ui';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { formatDate, formatDateTime } from '@clinic/i18n';
import type { ClinicTaskWithPatient } from '@clinic/db/types';
import { setTaskDone } from './actions';
import { TaskDialog } from './task-dialog';

/**
 * The open tasks that belong to one patient, on that patient's file.
 *
 * A task tied to a patient used to live only on the tasks page, where it was
 * one line among everyone's. The file is where the person is thought about,
 * so the file is where "call back about the results" should be waiting.
 */
export function PatientTasksPanel({
  patient,
  tasks,
}: {
  patient: { id: string; full_name: string };
  tasks: ClinicTaskWithPatient[];
}) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicTaskWithPatient | null>(null);
  const [isPending, startTransition] = useTransition();

  function done(task: ClinicTaskWithPatient) {
    startTransition(async () => {
      await setTaskDone(task.id, true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-ink-500" aria-hidden />
          {t('forPatient')}
        </CardTitle>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('new')}
        </Button>
      </CardHeader>
      <CardBody className="p-0">
        {tasks.length === 0 ? (
          <p className="px-4 py-5 text-center text-sm text-ink-500">{t('forPatientEmpty')}</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {tasks.map((task) => {
              const when = task.due_at
                ? formatDateTime(new Date(task.due_at))
                : task.due_on
                  ? formatDate(new Date(`${task.due_on}T00:00:00`))
                  : null;
              return (
                <li key={task.id} className="flex items-start gap-2.5 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={false}
                    aria-label={t('markDone', { title: task.title })}
                    disabled={isPending}
                    onChange={() => done(task)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 accent-jade-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(task);
                      setDialogOpen(true);
                    }}
                    className="min-w-0 flex-1 text-start"
                  >
                    <span className={cn('block truncate text-sm text-ink-900')} dir="auto">
                      {task.is_urgent ? (
                        <AlertTriangle aria-label={t('urgent')} className="me-1 inline h-3.5 w-3.5 text-amber-700" />
                      ) : null}
                      {task.title}
                    </span>
                    {when ? (
                      <span dir="ltr" className="block text-xs text-ink-600 tabular-nums">
                        {when}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-ink-100 px-4 py-2 text-end">
          <Link href="/tasks" className="text-xs text-jade-800 underline-offset-2 hover:underline">
            {t('openList')}
          </Link>
        </div>
      </CardBody>

      <TaskDialog
        open={dialogOpen}
        task={editing}
        patients={[patient]}
        defaultPatient={patient}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}
