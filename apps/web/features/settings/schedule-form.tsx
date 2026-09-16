'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
  TimeSelect,
  Toggle,
  useToast,
} from '@clinic/ui';
import { formatDate } from '@clinic/i18n';
import { useRouter } from '@clinic/i18n/navigation';
import type { PractitionerSchedule, ScheduleException } from '@clinic/db/types';
import { closeDiaryPeriod, reopenDiaryPeriod, saveWorkingHours } from './actions';
import { groupClosures } from './closure-periods';
import { DateInput } from '@/components/date-input';

/**
 * When the practitioner works, and when the diary is shut.
 *
 * The week is Sunday-first, matching the Israeli working week and the calendar
 * that draws it. Each day has a switch: on or off, before any question of hours.
 * That was the missing step — a day with no ranges *meant* closed, but only to
 * someone who had been told, and nothing on screen said so.
 *
 * Times are `TimeSelect` rather than `<input type="time">`. Chrome takes that
 * control's clock from the browser's own locale and ignores the page's, so an
 * English Windows showed AM/PM while every other time in the app was 24-hour.
 */

/** Sunday first: `practitioner_schedules.weekday` is 0 for Sunday. */
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

interface Block {
  key: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

function toBlocks(rows: PractitionerSchedule[]): Block[] {
  return rows
    .filter((row) => row.is_active)
    .map((row) => ({
      key: row.id,
      weekday: row.weekday,
      // Postgres returns `HH:MM:SS`; the control speaks `HH:MM`.
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
    }));
}

export function ScheduleForm({
  schedules,
  exceptions,
  today,
}: {
  schedules: PractitionerSchedule[];
  exceptions: ScheduleException[];
  /**
   * The clinic's date, worked out on the server.
   *
   * Not `new Date()` here: this renders on the server and again in the browser,
   * and the two must agree or React discards the markup. It was also
   * `toISOString().slice(0, 10)`, which is the UTC day — so until three in the
   * morning Israel time this said yesterday.
   */
  today: string;
}) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const tWeekday = useTranslations('schedule.weekday');
  const router = useRouter();

  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(schedules));
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState('');

  /*
   * Whole day or a stretch of hours.
   *
   * Two different facts, and the database already tells them apart: a closed day
   * is shaded out of the calendar entirely, a shortened one only outside the
   * hours that remain. The hour fields appear only when they mean something.
   */
  const [wholeDay, setWholeDay] = useState(true);
  const [closeFromTime, setCloseFromTime] = useState('14:00');
  const [closeToTime, setCloseToTime] = useState('18:00');

  /** One row per closed day in the database; one row per holiday on screen. */
  const periods = useMemo(
    () =>
      groupClosures(
        // Shortened days are listed too. They were filtered out when a closure
        // could only be a whole day, and leaving that filter would have hidden
        // every entry this screen can now create.
        exceptions.map((entry) => ({
          id: entry.id,
          date: entry.date,
          reason: entry.reason,
          isClosed: entry.is_closed,
          startTime: entry.start_time ? entry.start_time.slice(0, 5) : null,
          endTime: entry.end_time ? entry.end_time.slice(0, 5) : null,
        })),
      ),
    [exceptions],
  );

  /**
   * Turning a day on gives it a sensible clinic day, so the common case is one
   * click. Turning it off drops its ranges — a day that is off has no hours, and
   * keeping them hidden would let the switch and the saved data disagree.
   */
  function toggleDay(weekday: number, on: boolean) {
    setBlocks((current) =>
      on
        ? [
            ...current,
            {
              key: `new-${Math.random().toString(36).slice(2, 9)}`,
              weekday,
              start_time: '09:00',
              end_time: '17:00',
            },
          ]
        : current.filter((block) => block.weekday !== weekday),
    );
  }

  function addBlock(weekday: number) {
    setBlocks((current) => [
      ...current,
      {
        key: `new-${Math.random().toString(36).slice(2, 9)}`,
        weekday,
        start_time: '17:00',
        end_time: '20:00',
      },
    ]);
  }

  function setBlockTime(key: string, field: 'start_time' | 'end_time', value: string) {
    setBlocks((current) =>
      current.map((block) => (block.key === key ? { ...block, [field]: value } : block)),
    );
  }

  function saveHours() {
    setError(null);
    startTransition(async () => {
      const result = await saveWorkingHours(
        blocks.map((block) => ({
          weekday: block.weekday,
          start_time: block.start_time,
          end_time: block.end_time,
          is_active: true,
        })),
      );
      if (!result.ok) {
        setError(t('hoursSaveFailed'));
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  function closePeriod() {
    if (!from || !to) return;
    setError(null);
    startTransition(async () => {
      const result = await closeDiaryPeriod({
        from,
        to,
        reason,
        start_time: wholeDay ? '' : closeFromTime,
        end_time: wholeDay ? '' : closeToTime,
      });
      if (!result.ok) {
        setError(t('closureSaveFailed'));
        return;
      }
      setReason('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('workingHours')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {WEEKDAYS.map((weekday) => {
              const dayBlocks = blocks.filter((block) => block.weekday === weekday);
              const on = dayBlocks.length > 0;

              return (
                <li key={weekday} className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3">
                  <span className="flex w-32 shrink-0 items-center gap-2.5 pt-1">
                    <Toggle
                      checked={on}
                      onChange={(next) => toggleDay(weekday, next)}
                      label={tWeekday(String(weekday))}
                      disabled={isPending}
                    />
                    <span className="text-sm font-medium text-ink-800">
                      {tWeekday(String(weekday))}
                    </span>
                  </span>

                  {on ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {dayBlocks.map((block) => (
                        <div key={block.key} className="flex flex-wrap items-center gap-1.5">
                          <TimeSelect
                            value={block.start_time}
                            onChange={(value) => setBlockTime(block.key, 'start_time', value)}
                            disabled={isPending}
                            label={t('startTime')}
                            hourLabel={t('hour')}
                            minuteLabel={t('minute')}
                          />
                          <span aria-hidden className="text-ink-500">
                            –
                          </span>
                          <TimeSelect
                            value={block.end_time}
                            onChange={(value) => setBlockTime(block.key, 'end_time', value)}
                            disabled={isPending}
                            label={t('endTime')}
                            hourLabel={t('hour')}
                            minuteLabel={t('minute')}
                          />
                          {dayBlocks.length > 1 ? (
                            <button
                              type="button"
                              aria-label={tc('delete')}
                              title={tc('delete')}
                              disabled={isPending}
                              onClick={() =>
                                setBlocks((current) =>
                                  current.filter((entry) => entry.key !== block.key),
                                )
                              }
                              className="rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ))}

                      {/* A second range is a midday break — the gap between them is
                        the closed part, which one start and one end cannot say. */}
                      {dayBlocks.length < 3 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => addBlock(weekday)}
                          className="self-start"
                        >
                          <Plus className="h-4 w-4" />
                          {t('addBreak')}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="pt-2 text-sm text-ink-500">{t('closed')}</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex justify-end">
            <Button type="button" onClick={saveHours} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {tc('save')}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-ink-600" aria-hidden />
            {t('closures')}
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-600">{t('closuresHint')}</p>

          {periods.length > 0 ? (
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
              {periods.map((period) => (
                <li
                  key={`${period.from}:${period.to}`}
                  className="flex flex-wrap items-center gap-2 p-2.5 text-sm"
                >
                  <span dir="ltr" className="shrink-0 tabular-nums text-ink-800">
                    {period.from === period.to
                      ? formatDate(period.from)
                      : `${formatDate(period.from)} – ${formatDate(period.to)}`}
                  </span>
                  <span className="text-xs text-ink-600">
                    {t('dayCount', { count: period.days })}
                  </span>
                  {/* Whole-day or shortened, in words. Two rows that differ only
                    by a tint are two rows nobody tells apart. */}
                  <span className="text-xs text-ink-700">
                    {period.isClosed ? (
                      t('allDay')
                    ) : (
                      <span dir="ltr" className="tabular-nums">
                        {period.startTime}–{period.endTime}
                      </span>
                    )}
                  </span>
                  {period.reason ? (
                    <span className="min-w-0 truncate text-ink-700" dir="auto">
                      · {period.reason}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t('reopen')}
                    title={t('reopen')}
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await reopenDiaryPeriod(period.from, period.to);
                        router.refresh();
                      })
                    }
                    className="ms-auto rounded-md p-1.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">{t('noClosures')}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('closeFrom')} htmlFor="closure_from" density="compact">
              <DateInput
                id="closure_from"
                value={from}
                onChange={(event) => {
                  const next = event.target.value;
                  setFrom(next);
                  // One day is the common case, so the end follows the start until
                  // it is deliberately set past it.
                  if (!to || to < next) setTo(next);
                }}
              />
            </Field>
            <Field label={t('closeTo')} htmlFor="closure_to" density="compact">
              <DateInput
                id="closure_to"
                min={from}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Field label={t('reason')} htmlFor="closure_reason" density="compact">
              <Input
                id="closure_reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('reasonPlaceholder')}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={wholeDay}
              onChange={(event) => setWholeDay(event.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-jade-700"
            />
            {t('allDay')}
          </label>

          {!wholeDay ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-ink-700">{t('openOnlyBetween')}</span>
              <TimeSelect
                value={closeFromTime}
                onChange={setCloseFromTime}
                disabled={isPending}
                label={t('startTime')}
                hourLabel={t('hour')}
                minuteLabel={t('minute')}
              />
              <span aria-hidden className="text-ink-500">
                –
              </span>
              <TimeSelect
                value={closeToTime}
                onChange={setCloseToTime}
                disabled={isPending}
                label={t('endTime')}
                hourLabel={t('hour')}
                minuteLabel={t('minute')}
              />
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closePeriod}
              disabled={
                isPending ||
                !from ||
                !to ||
                to < from ||
                (!wholeDay && closeToTime <= closeFromTime)
              }
            >
              {isPending ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <CalendarOff className="h-4 w-4" />
              )}
              {t('closeDiary')}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
