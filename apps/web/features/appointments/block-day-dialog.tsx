'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CalendarOff, DoorOpen } from 'lucide-react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Spinner,
  TimeSelect,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { reopenDiaryPeriod, saveScheduleException } from '@/features/settings/actions';
import type { DayException } from './availability';
import { toDateKey } from './date-utils';

/**
 * Closing one day, from the day itself.
 *
 * The working-hours screen closes holidays — a fortnight in August, a course
 * next spring. This is for the Tuesday you have just decided to take off,
 * while looking at it: the same row in the same table, written from where
 * the decision is made rather than from a settings page two clicks away.
 *
 * A closure is the whole day unless hours are given, in which case the day
 * is open at those hours and no others — the meaning the diary already gives
 * that pair, and the one the schedule screen calls "open only between".
 */
export function BlockDayDialog({
  day,
  existing,
  onOpenChange,
}: {
  day: Date | null;
  /** What is already written for that day, if anything. */
  existing: DayException | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('appointments.block');
  const tc = useTranslations('common');
  const tSchedule = useTranslations('schedule');
  const format = useFormatter();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wholeDay, setWholeDay] = useState(true);
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('13:00');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!day) return;
    const partial = Boolean(existing && !existing.is_closed && existing.start_time && existing.end_time);
    setWholeDay(!partial);
    setFrom(existing?.start_time?.slice(0, 5) ?? '09:00');
    setTo(existing?.end_time?.slice(0, 5) ?? '13:00');
    setReason(existing?.reason ?? '');
    setError(null);
  }, [day, existing]);

  if (!day) return null;
  const key = toDateKey(day);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveScheduleException({
        date: key,
        is_closed: wholeDay,
        start_time: wholeDay ? '' : from,
        end_time: wholeDay ? '' : to,
        reason,
      });
      if (!result.ok) {
        setError(t('failed'));
        return;
      }
      toast({ tone: 'success', title: t('saved') });
      onOpenChange(false);
      router.refresh();
    });
  }

  function reopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenDiaryPeriod(key, key);
      if (!result.ok) {
        setError(t('failed'));
        return;
      }
      toast({ tone: 'success', title: t('reopened') });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} closeLabel={tc('close')} className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm font-medium text-ink-900">{format.dateTime(day, 'weekday')}</p>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {existing ? <Alert tone="info">{t('alreadyBlocked')}</Alert> : null}

          <label className="flex items-center gap-2 text-sm text-ink-800">
            <Checkbox checked={wholeDay} onChange={(event) => setWholeDay(event.target.checked)} />
            {t('wholeDay')}
          </label>

          {!wholeDay ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-600">{t('openOnlyBetween')}</p>
              <div className="flex flex-wrap items-center gap-3">
                <TimeSelect
                  value={from}
                  onChange={setFrom}
                  label={t('openOnlyBetween')}
                  hourLabel={tSchedule('hour')}
                  minuteLabel={tSchedule('minute')}
                />
                <span className="text-ink-500" aria-hidden>
                  –
                </span>
                <TimeSelect
                  value={to}
                  onChange={setTo}
                  label={t('openOnlyBetween')}
                  hourLabel={tSchedule('hour')}
                  minuteLabel={tSchedule('minute')}
                />
              </div>
            </div>
          ) : null}

          <Field label={t('reason')} htmlFor="block_reason">
            <Input
              id="block_reason"
              value={reason}
              maxLength={160}
              placeholder={t('reasonPlaceholder')}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>

          <DialogFooter>
            {existing ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={reopen}
                className="me-auto"
              >
                <DoorOpen className="h-4 w-4" aria-hidden />
                {t('reopen')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
            <Button type="button" disabled={isPending || (!wholeDay && to <= from)} onClick={save}>
              {isPending ? <Spinner /> : <CalendarOff className="h-4 w-4" aria-hidden />}
              {t('save')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
