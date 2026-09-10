'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Spinner, useToast } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { defineWidget } from '@clinic/domain/widgets';
import { formatDate, formatDateTime } from '@clinic/i18n';
import { Link } from '@clinic/i18n/navigation';
import type { ClinicTaskWithPatient } from '@clinic/db/types';
import { useAsyncData } from '@/lib/use-supabase';
import { createTask, deleteTask, setTaskDone } from '@/features/tasks/actions';
import { registerWidget } from '../registry';
import { WidgetEmpty, WidgetLoading } from '../widget-frame';

/**
 * The to-do list, on the dashboard.
 *
 * Adding is a single field at the top rather than a dialog: the whole value of
 * this is that a thought — "ring Ronit about her results" — costs one line and
 * no navigation. A form with a due date, a priority and a patient picker is a
 * form people go round rather than through, and back to the sticky note.
 *
 * Urgent is a toggle on the row after the fact, which is the order these are
 * actually decided in. Nothing is urgent as you type it; it becomes urgent when
 * you look at the list on Thursday.
 */
function TasksWidget() {
  const t = useTranslations('widgets.tasks');
  const tc = useTranslations('common');
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading } = useAsyncData<ClinicTaskWithPatient[]>(
    async (supabase) => {
      const { data: rows, error } = await supabase
        .from('clinic_tasks')
        .select('*, patient:patients(id, full_name)')
        .is('done_at', null)
        .order('is_urgent', { ascending: false })
        .order('due_on', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      return (rows ?? []) as ClinicTaskWithPatient[];
    },
    // Re-read after every write. The list is short and the alternative is
    // guessing at the new order, which the urgent-first sort would get wrong.
    [reloadKey],
  );

  const refresh = () => setReloadKey((key) => key + 1);

  function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createTask({
        title: trimmed,
        notes: '',
        due_on: '',
        is_urgent: false,
        patient_id: '',
      });
      // A silent failure here looked like nothing happened — and the title
      // stayed in the box, so people pressed Enter again and again.
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      setTitle('');
      refresh();
    });
  }

  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
        className="flex items-center gap-1.5"
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('newTask')}
          disabled={isPending}
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
          {isPending ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
          <span className="sr-only">{t('newTask')}</span>
        </Button>
      </form>

      {loading ? (
        <WidgetLoading />
      ) : rows.length === 0 ? (
        <WidgetEmpty>{t('empty')}</WidgetEmpty>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((task) => {
            const overdue = task.due_at
              ? new Date(task.due_at).getTime() < Date.now()
              : task.due_on !== null && task.due_on < today;
            return (
              <li key={task.id} className="flex items-start gap-2 py-1.5">
                <input
                  type="checkbox"
                  checked={false}
                  aria-label={t('markDone', { title: task.title })}
                  disabled={isPending}
                  onChange={() =>
                    startTransition(async () => {
                      await setTaskDone(task.id, true);
                      refresh();
                    })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-jade-700"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {task.is_urgent ? (
                      <AlertTriangle
                        aria-label={t('urgent')}
                        className="h-3.5 w-3.5 shrink-0 text-amber-700"
                      />
                    ) : null}
                    <span className="text-sm text-ink-900" dir="auto">
                      {task.title}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    {task.due_on || task.due_at ? (
                      /* Overdue is said in words as well as in colour — an amber
                         date and a grey date are the same date to anyone not
                         comparing them side by side. */
                      <span
                        dir="ltr"
                        className={cn(
                          'tabular-nums',
                          overdue ? 'font-medium text-amber-800' : 'text-ink-600',
                        )}
                      >
                        {task.due_at
                          ? formatDateTime(new Date(task.due_at))
                          : task.due_on
                            ? formatDate(task.due_on)
                            : ''}
                        {overdue ? ` · ${t('overdue')}` : ''}
                      </span>
                    ) : null}

                    {task.patient ? (
                      <Link
                        href={`/patients/${task.patient.id}`}
                        className="truncate text-jade-700 underline-offset-2 hover:underline"
                      >
                        {task.patient.full_name}
                      </Link>
                    ) : null}
                  </span>
                </span>

                <button
                  type="button"
                  aria-label={tc('delete')}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteTask(task.id);
                      refresh();
                    })
                  }
                  className="shrink-0 rounded p-1 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'tasks',
    icon: 'ListChecks',
    defaultSize: 'md',
    defaultConfig: {},
    component: TasksWidget,
    singleton: true,
  }),
);
