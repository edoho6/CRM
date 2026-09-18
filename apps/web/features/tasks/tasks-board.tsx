'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Bell,
  BellRing,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Collapsible,
  EmptyState,
  cn,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { HeaderTools } from '@/components/header-tools';
import { showBrowserNotification } from './browser-notify';
import { formatDate, formatDateTime } from '@clinic/i18n';
import { Link, useRouter } from '@clinic/i18n/navigation';
import type { ClinicTaskWithPatient } from '@clinic/db/types';
import { dateKeyIn } from '@clinic/domain';
import { deleteTask, setTaskDone } from './actions';
import { TaskDialog } from './task-dialog';
import { applyOverrides, reconcile, withOverride, withPending, type Overrides } from './optimistic';

/**
 * The to-do list, in full.
 *
 * Grouped by when: what is late, what is today, what is ahead, and what has
 * no date. Late is first and red because the whole point of a dated task is
 * the date. Done tasks are kept, folded, for the "did I ring her" question
 * that comes up a week later.
 */

type Group = 'overdue' | 'today' | 'later' | 'undated';

function groupOf(task: ClinicTaskWithPatient, now: Date, timeZone: string): Group {
  // The clinic's day, not UTC's: until three in the morning the two differ
  // here, and a task due today sat under "today" the day after.
  const today = dateKeyIn(now, timeZone);
  if (task.due_at) {
    const due = new Date(task.due_at);
    if (due.getTime() < now.getTime()) return 'overdue';
    return dateKeyIn(due, timeZone) === today ? 'today' : 'later';
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
  timeZone,
  renderedAt,
}: {
  open: ClinicTaskWithPatient[];
  done: ClinicTaskWithPatient[];
  patients: { id: string; full_name: string }[];
  /** The clinic's zone: "today" is its day. */
  timeZone: string;
  /** When the page was rendered (ISO): the clock the server and the browser share. */
  renderedAt: string;
}) {
  const t = useTranslations('tasks');
  const router = useRouter();
  // What this board has been told and the server has not yet shown, and
  // which rows are mid-write. Per row: ticking one task must not grey out
  // the other thirty, and must not wait for the page to be re-read.
  const [overrides, setOverrides] = useState<Overrides>(() => new Map());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicTaskWithPatient | null>(null);
  const [permission, setPermission] = useState<'unsupported' | NotificationPermission>('default');
  const confirm = useConfirm();
  const { toast } = useToast();
  const tc = useTranslations('common');

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  // The server's lists have arrived (a refresh): forget what they now show.
  useEffect(() => {
    setOverrides((current) => (current.size === 0 ? current : reconcile(open, done, current)));
  }, [open, done]);

  const shown = applyOverrides(open, done, overrides);
  // The page's clock rather than Date.now(): a task falling due between the
  // server's render and the browser's would otherwise change group at
  // hydration, and React rebuilds the whole list.
  const now = new Date(renderedAt);
  const groups: Record<Group, ClinicTaskWithPatient[]> = {
    overdue: [],
    today: [],
    later: [],
    undated: [],
  };
  for (const task of shown.open) groups[groupOf(task, now, timeZone)].push(task);

  async function toggle(task: ClinicTaskWithPatient, isDone: boolean) {
    setOverrides((current) => withOverride(current, task.id, isDone ? 'done' : 'open'));
    setPendingIds((current) => withPending(current, task.id, true));
    const result = await setTaskDone(task.id, isDone);
    setPendingIds((current) => withPending(current, task.id, false));
    if (!result.ok) {
      // Back where the server has it, and said out loud.
      setOverrides((current) => withOverride(current, task.id, null));
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    router.refresh();
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

  /*
   * The only way to know the operating system lets it through. The browser
   * says "granted" and then Windows, with "do not disturb" on or the browser
   * switched off in its notification settings, shows nothing — and the
   * reminder looked broken when it had fired. Sent now, it answers that.
   */
  function sendTest() {
    const shown = showBrowserNotification({
      title: t('testTitle'),
      body: t('testBody'),
      tag: 'task-test',
    });
    toast(
      shown
        ? { tone: 'info', title: t('testSent') }
        : { tone: 'warning', title: t('testFailed') },
    );
  }

  async function remove(task: ClinicTaskWithPatient) {
    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.task') }),
      body: t('deleteConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    setOverrides((current) => withOverride(current, task.id, 'removed'));
    setPendingIds((current) => withPending(current, task.id, true));
    const result = await deleteTask(task.id);
    setPendingIds((current) => withPending(current, task.id, false));
    if (!result.ok) {
      setOverrides((current) => withOverride(current, task.id, null));
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    toast({ tone: 'success', title: t('deleted') });
    router.refresh();
  }

  const row = (task: ClinicTaskWithPatient, isDone: boolean) => {
    const late = !isDone && groupOf(task, now, timeZone) === 'overdue';
    return (
      <li key={task.id} className="flex items-start gap-2.5 py-2">
        <input
          type="checkbox"
          checked={isDone}
          aria-label={t(isDone ? 'markOpen' : 'markDone', { title: task.title })}
          disabled={pendingIds.has(task.id)}
          onChange={() => toggle(task, !isDone)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 accent-accent"
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
              disabled={pendingIds.has(task.id)}
              onClick={() => toggle(task, false)}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('reopen')}
            </Button>
          ) : null}
          <button
            type="button"
            aria-label={t('editTaskOf', { title: task.title })}
            title={t('editTask')}
            disabled={pendingIds.has(task.id)}
            onClick={() => edit(task)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 active:bg-ink-200 pointer-coarse:h-10 pointer-coarse:w-10"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('deleteTaskOf', { title: task.title })}
            title={tc('delete')}
            disabled={pendingIds.has(task.id)}
            onClick={() => remove(task)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 active:bg-red-100 pointer-coarse:h-10 pointer-coarse:w-10"
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
      {/* In the page header, where every page keeps its actions — the
          primary last, in the far corner. The browser's own permission is
          asked for from here and nowhere else: a prompt that appears on its
          own is a prompt people refuse. */}
      <HeaderTools
        slotId="tasks-header-tools"
        fallbackClassName="flex flex-wrap items-center justify-end gap-2"
      >
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
            <Button type="button" variant="secondary" onClick={enableBrowser}>
              <Bell className="h-4 w-4" aria-hidden />
              {t('enableBrowser')}
            </Button>
          )}
        </div>
        <Button type="button" onClick={() => edit(null)}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('new')}
        </Button>
      </HeaderTools>

      {shown.open.length === 0 ? (
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

      {shown.done.length > 0 ? (
        <Collapsible title={`${t('sections.done')} · ${shown.done.length}`}>
          <ul className="divide-y divide-ink-100">{shown.done.map((task) => row(task, true))}</ul>
        </Collapsible>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('browserNotifications')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-600">{t('browserHint')}</p>
          {permission === 'granted' ? (
            <>
              <p className="text-sm text-ink-600">{t('testHint')}</p>
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={sendTest}>
                  {t('sendTest')}
                </Button>
              </div>
            </>
          ) : null}
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
