'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Bell, BellRing, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, CardTitle, Collapsible, EmptyState, cn, useConfirm, useToast } from '@clinic/ui';
import { formatDate, formatDateTime } from '@clinic/i18n';
import { Link, useRouter } from '@clinic/i18n/navigation';
import type { ClinicTaskWithPatient } from '@clinic/db/types';
import { deleteTask, setTaskDone } from './actions';
import { TaskDialog } from './task-dialog';

/**
 * The to-do list, in full.
 *
 * Grouped by when: what is late, what is today, what is ahead, and what has
 * no date. Late is first and red because the whole point of a dated task is
 * the date. Done tasks are kept, folded, for the "did I ring her" question
 * that comes up a week later.
 */

type Group = 'overdue' | 'today' | 'later' | 'undated';

function groupOf(task: ClinicTaskWithPatient, now: Date): Group {
  const today = now.toISOString().slice(0, 10);
  if (task.due_at) {
    const due = new Date(task.due_at);
    if (due.getTime() < now.getTime()) return 'overdue';
    return due.toDateString() === now.toDateString() ? 'today' : 'later';
  }
  if (task.due_on) {
    if (task.due_on < today) return 'overdue';
    return task.due_on === today ? 'today' : 'later';
  }
  return 'undated';
}

function dueLabel(task: ClinicTaskWithPatient): string | null {
  if (task.due_at) return formatDateTime(new Date(task.due_at));
  if (task.due_on) return formatDate(task.due_on);
  return null;
}

export function TasksBoard({
  open,
  done,
  patients,
}: {
  open: ClinicTaskWithPatient[];
  done: ClinicTaskWithPatient[];
  patients: { id: string; full_name: string }[];
}) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicTaskWithPatient | null>(null);
  const [permission, setPermission] = useState<'unsupported' | NotificationPermission>('default');
  const confirm = useConfirm();
  const { toast } = useToast();
  const tc = useTranslations('common');

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  const now = new Date();
  const groups: Record<Group, ClinicTaskWithPatient[]> = {
    overdue: [],
    today: [],
    later: [],
    undated: [],
  };
  for (const task of open) groups[groupOf(task, now)].push(task);

  function toggle(task: ClinicTaskWithPatient, isDone: boolean) {
    startTransition(async () => {
      await setTaskDone(task.id, isDone);
      router.refresh();
    });
  }

  function edit(task: ClinicTaskWithPatient | null) {
    setEditing(task);
    setDialogOpen(true);
  }

  async function enableBrowser() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'denied') {
      toast({ tone: 'warning', title: t('browserDenied') });
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') toast({ tone: 'success', title: t('browserGranted') });
    else if (result === 'denied') toast({ tone: 'warning', title: t('browserDenied') });
    else toast({ tone: 'info', title: t('browserDismissed') });
  }

  async function remove(task: ClinicTaskWithPatient) {
    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.task') }),
      body: t('deleteConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      await deleteTask(task.id);
      toast({ tone: 'success', title: t('deleted') });
      router.refresh();
    });
  }

  const row = (task: ClinicTaskWithPatient, isDone: boolean) => {
    const late = !isDone && groupOf(task, now) === 'overdue';
    return (
      <li key={task.id} className="flex items-start gap-2.5 py-2">
        <input
          type="checkbox"
          checked={isDone}
          aria-label={t(isDone ? 'markOpen' : 'markDone', { title: task.title })}
          disabled={isPending}
          onChange={() => toggle(task, !isDone)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 accent-jade-700"
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => edit(task)}
            className={cn(
              'max-w-full truncate text-start text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              isDone ? 'text-ink-500 line-through' : 'text-ink-900',
            )}
            dir="auto"
          >
            {task.is_urgent && !isDone ? (
              <AlertTriangle
                aria-label={t('urgent')}
                className="me-1 inline h-3.5 w-3.5 text-amber-700"
              />
            ) : null}
            {task.title}
          </button>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-600">
            {dueLabel(task) ? (
              <span dir="ltr" className={cn('tabular-nums', late && 'font-medium text-red-700')}>
                {dueLabel(task)}
              </span>
            ) : null}
            {task.due_at && task.remind_via === 'app' && !isDone ? (
              <span className="inline-flex items-center gap-1" title={t('channels.app')}>
                <Bell className="h-3 w-3" aria-hidden />
                <span className="sr-only">{t('channels.app')}</span>
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
            {task.notes ? (
              <span className="truncate text-ink-500" dir="auto">
                {task.notes}
              </span>
            ) : null}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5">
          {isDone ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => toggle(task, false)}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('reopen')}
            </Button>
          ) : null}
          <button
            type="button"
            aria-label={t('editTask')}
            title={t('editTask')}
            disabled={isPending}
            onClick={() => edit(task)}
            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={tc('delete')}
            title={tc('delete')}
            disabled={isPending}
            onClick={() => remove(task)}
            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </span>
      </li>
    );
  };

  const section = (group: Group) =>
    groups[group].length === 0 ? null : (
      <section key={group} aria-labelledby={`tasks-${group}`} className="space-y-1">
        <h2
          id={`tasks-${group}`}
          className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            group === 'overdue' ? 'text-red-700' : 'text-ink-500',
          )}
        >
          {t(`sections.${group}`)} · {groups[group].length}
        </h2>
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white px-3">
          {groups[group].map((task) => row(task, false))}
        </ul>
      </section>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" onClick={() => edit(null)}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('new')}
        </Button>

        {/* The browser's own permission, asked for from here and nowhere
            else: a prompt that appears on its own is a prompt people refuse. */}
        <div className="flex items-center gap-2 text-xs text-ink-600">
          {permission === 'granted' ? (
            <span className="inline-flex items-center gap-1 text-jade-800">
              <BellRing className="h-3.5 w-3.5" aria-hidden />
              {t('browserOn')}
            </span>
          ) : permission === 'denied' ? (
            <span>{t('browserBlocked')}</span>
          ) : permission === 'unsupported' ? (
            <span>{t('browserUnsupported')}</span>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={enableBrowser}>
              <Bell className="h-4 w-4" aria-hidden />
              {t('enableBrowser')}
            </Button>
          )}
        </div>
      </div>

      {open.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-8 w-8" />}
          title={t('empty')}
          action={
            <Button type="button" variant="secondary" onClick={() => edit(null)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('new')}
            </Button>
          }
        />
      ) : (
        <>
          {section('overdue')}
          {section('today')}
          {section('later')}
          {section('undated')}
        </>
      )}

      {done.length > 0 ? (
        <Collapsible title={`${t('sections.done')} · ${done.length}`}>
          <ul className="divide-y divide-ink-100">{done.map((task) => row(task, true))}</ul>
        </Collapsible>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('browserNotifications')}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-ink-600">{t('browserHint')}</p>
        </CardBody>
      </Card>

      <TaskDialog
        open={dialogOpen}
        task={editing}
        patients={patients}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
      />
    </div>
  );
}
