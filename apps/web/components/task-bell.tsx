'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Check } from 'lucide-react';
import { Popover, cn, useToast } from '@clinic/ui';
import { formatTime } from '@clinic/i18n';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { dueTasks, markTaskReminded, setTaskDone, type DueTask } from '@/features/tasks/actions';

/** How often the bell asks. A minute is the resolution a task's time has. */
const POLL_MS = 60_000;

/**
 * The bell in the header: the tasks whose moment has come.
 *
 * Polled while the app is open, and again whenever the tab comes back into
 * view, because a laptop that slept through eleven o'clock should say so the
 * moment its lid opens. A task crossing its time raises a toast inside the
 * app and, if the person has allowed it, the browser's own notification —
 * which is the one that shows from another tab or a minimised window.
 *
 * Firing once is a fact recorded on the task, not in this tab: two open
 * windows would otherwise both ring, and a reload would ring again.
 */
export function TaskBell() {
  const t = useTranslations('tasks');
  const { toast } = useToast();
  const router = useRouter();
  const [due, setDue] = useState<DueTask[]>([]);
  /*
   * The clock, as of the last poll.
   *
   * Reading `Date.now()` while rendering would make this component's output
   * depend on something that is not its props or its state: the server would
   * render one count and the browser another, and React would throw the markup
   * away. Taking the time from the poll — the same moment the list came from —
   * keeps the two in step, and a minute is the resolution a task's time has
   * anyway.
   */
  const [polledAt, setPolledAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const announced = useRef(new Set<string>());

  const poll = useCallback(async () => {
    const result = await dueTasks();
    if (!result.ok) return;
    setDue(result.data);

    const now = Date.now();
    setPolledAt(now);
    for (const task of result.data) {
      if (new Date(task.due_at).getTime() - (task.remind_offset_minutes ?? 0) * 60_000 > now) continue;
      if (task.reminded_at || announced.current.has(task.id)) continue;
      announced.current.add(task.id);

      toast({ tone: 'warning', title: `${t('dueNow')}: ${task.title}` });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(task.title, { body: t('dueNow'), tag: task.id });
        } catch {
          // Some browsers only allow notifications from a service worker;
          // the toast above has already said it.
        }
      }
      void markTaskReminded(task.id);
    }
  }, [t, toast]);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const ringing =
    polledAt === null
      ? 0
      : due.filter((task) => new Date(task.due_at).getTime() <= polledAt).length;

  function finish(task: DueTask) {
    setDue((current) => current.filter((entry) => entry.id !== task.id));
    startTransition(async () => {
      await setTaskDone(task.id, true);
      router.refresh();
    });
  }

  return (
    <Popover
      triggerContent={
        <>
          <Bell className="h-5 w-5" aria-hidden />
          {ringing > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-accent-fg tabular-nums"
            >
              {ringing}
            </span>
          ) : null}
        </>
      }
      triggerLabel={ringing > 0 ? `${t('bell')} · ${ringing}` : t('bell')}
      triggerTitle={t('bell')}
      triggerClassName="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-xs transition-colors hover:bg-ink-50 hover:text-ink-900 active:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      panelLabel={t('bell')}
      align="end"
      width={320}
    >
      {({ close }) => (
        <div className="p-1">
          {due.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-ink-600">{t('bellEmpty')}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
              {due.map((task) => {
                const late = polledAt !== null && new Date(task.due_at).getTime() <= polledAt;
                return (
                  <li key={task.id} className="flex items-start gap-2 px-2 py-2">
                    <button
                      type="button"
                      aria-label={t('markDone', { title: task.title })}
                      title={t('markDone', { title: task.title })}
                      disabled={isPending}
                      onClick={() => finish(task)}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ink-300 text-ink-500 hover:bg-jade-50 hover:text-jade-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-900" dir="auto">
                        {task.title}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span
                          className={cn(
                            'tabular-nums',
                            late ? 'font-medium text-red-700' : 'text-ink-600',
                          )}
                          dir="ltr"
                        >
                          {formatTime(new Date(task.due_at))}
                        </span>
                        <span className={late ? 'text-red-700' : 'text-ink-500'}>
                          {late ? t('dueNow') : t('soon')}
                        </span>
                        {task.patient ? (
                          <Link
                            href={`/patients/${task.patient.id}`}
                            onClick={close}
                            className="truncate text-jade-700 underline-offset-2 hover:underline"
                          >
                            {task.patient.full_name}
                          </Link>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/tasks"
            onClick={close}
            className="block rounded-md px-3 py-2 text-center text-xs font-medium text-jade-800 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          >
            {t('openAll')}
          </Link>
        </div>
      )}
    </Popover>
  );
}
