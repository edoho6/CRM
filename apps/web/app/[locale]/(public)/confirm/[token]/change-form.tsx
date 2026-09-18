'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CalendarClock, X } from 'lucide-react';
import { Alert, Button, Spinner, cn, useConfirm } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { formatTime } from '@clinic/i18n';
import { addDaysIn, dateKeyIn } from '@clinic/domain';
import { CLINIC_TIME_ZONE } from '@clinic/i18n';
import {
  cancelAppointment,
  fetchChangeSlots,
  moveAppointment,
  type ChangeResult,
} from '../actions';

/**
 * Another hour, or no appointment — from the reminder's link (migration 75).
 *
 * Closed until asked for: most people open the link to say they are coming,
 * and two more buttons under "I'll come" would make that one tap harder to
 * find. Moving is the booking page's day row and hour grid, over the same free
 * hours; cancelling asks once. Either one ends in the clinic's task list, so
 * nobody finds the change by reading the diary.
 */
export function ChangeForm({
  token,
  canMove,
  horizonDays,
}: {
  token: string;
  canMove: boolean;
  horizonDays: number;
}) {
  const t = useTranslations('confirm.change');
  const format = useFormatter();
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [day, setDay] = useState(() => dateKeyIn(new Date(), CLINIC_TIME_ZONE));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [result, setResult] = useState<ChangeResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: Math.min(horizonDays, 21) }, (_, index) =>
      addDaysIn(now, index, CLINIC_TIME_ZONE),
    );
  }, [horizonDays]);

  useEffect(() => {
    if (!moving) return;
    let stale = false;
    void fetchChangeSlots(token, day)
      .then((found) => {
        if (!stale) setSlots(found);
      })
      .catch(() => {
        if (stale) return;
        setSlots([]);
        setResult('error');
      });
    return () => {
      stale = true;
    };
  }, [moving, token, day]);

  function done(outcome: ChangeResult) {
    setResult(outcome);
    if (outcome === 'moved' || outcome === 'cancelled') {
      setMoving(false);
      router.refresh();
    }
  }

  function move(startAt: string) {
    startTransition(async () => done(await moveAppointment(token, startAt)));
  }

  async function cancel() {
    if (
      !(await confirm({
        title: t('cancelConfirmTitle'),
        body: t('cancelConfirmBody'),
        confirmLabel: t('cancel'),
        destructive: true,
      }))
    )
      return;
    startTransition(async () => done(await cancelAppointment(token)));
  }

  const message =
    result === 'moved' ? (
      <Alert tone="success">{t('moved')}</Alert>
    ) : result === 'cancelled' ? (
      <Alert tone="warning">{t('cancelled')}</Alert>
    ) : result === 'slot_taken' ? (
      <Alert tone="danger">{t('slotTaken')}</Alert>
    ) : result === 'not_allowed' ? (
      <Alert tone="danger">{t('notAllowed')}</Alert>
    ) : result === 'expired' || result === 'error' ? (
      <Alert tone="danger">{t('error')}</Alert>
    ) : null;

  if (result === 'moved' || result === 'cancelled') return message;

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-jade-800 underline underline-offset-2"
        >
          {t('open')}
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-ink-200 p-3" aria-label={t('title')}>
      {message}
      <div className={cn('grid gap-2', canMove ? 'grid-cols-2' : 'grid-cols-1')}>
        {canMove ? (
          <Button
            type="button"
            variant={moving ? 'primary' : 'secondary'}
            aria-expanded={moving}
            onClick={() => {
              // Cleared here, not in the effect: the grid of another day never shows under this one.
              setSlots(null);
              setMoving((value) => !value);
            }}
            disabled={isPending}
          >
            <CalendarClock className="h-4 w-4" aria-hidden />
            {t('move')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => void cancel()}
          disabled={isPending}
        >
          <X className="h-4 w-4" aria-hidden />
          {t('cancel')}
        </Button>
      </div>

      {moving ? (
        <div className="space-y-3">
          <div
            className="flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain pb-1"
            role="group"
            aria-label={t('day')}
          >
            {days.map((candidate) => {
              const key = dateKeyIn(candidate, CLINIC_TIME_ZONE);
              const selected = key === day;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSlots(null);
                    setDay(key);
                  }}
                  className={cn(
                    'flex min-h-11 shrink-0 snap-start flex-col items-center rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    selected
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-ink-200 bg-white text-ink-800 hover:bg-ink-50',
                  )}
                >
                  <span className="text-xs">
                    {format.dateTime(candidate, { weekday: 'short' })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {format.dateTime(candidate, { day: 'numeric', month: 'numeric' })}
                  </span>
                </button>
              );
            })}
          </div>
          {slots === null ? (
            <p className="flex items-center gap-2 py-4 text-sm text-ink-600">
              <Spinner /> {t('loading')}
            </p>
          ) : slots.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-600">{t('noSlots')}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => move(slot)}
                    aria-label={t('moveTo', { time: formatTime(new Date(slot)) })}
                    className="min-h-11 w-full rounded-lg border border-ink-200 bg-white py-3 text-base font-medium tabular-nums text-ink-900 transition-colors hover:border-jade-500 hover:bg-jade-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    dir="ltr"
                  >
                    {formatTime(new Date(slot))}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
