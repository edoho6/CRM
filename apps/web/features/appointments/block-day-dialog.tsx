'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CalendarOff, DoorOpen, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  Input,
  Spinner,
  TimeSelect,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import {
  addScheduleBlocks,
  deleteScheduleBlock,
  reopenDiaryPeriod,
  saveScheduleException,
} from '@/features/settings/actions';
import { blockedWindowsFor, type Availability, type DayException } from './availability';
import { combineDateAndTime, toDateKey } from './date-utils';

/**
 * Closing a day, or hours of it, from the day itself.
 *
 * The working-hours screen closes holidays — a fortnight in August, a course
 * next spring. This is for the Tuesday you have just decided to take off,
 * while looking at it, or for the two hours of it you cannot work.
 *
 * Two shapes. The whole day is one row in the exceptions table, as the
 * schedule screen writes it. Hours are windows — as many as the day needs,
 * each with its own reason — and they are cut out of the day's hours rather
 * than replacing them: "not 14:00–16:00" and "not 11:00–11:30", not "open
 * only between".
 */

interface Draft {
  /** The row's own key: removing a middle window must not move the next one's focus. */
  key: string;
  from: string;
  to: string;
  reason: string;
}

const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const clock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export function BlockDayDialog({
  day,
  existing,
  availability,
  onOpenChange,
}: {
  day: Date | null;
  /** The whole-day closure already written for that day, if any. */
  existing: DayException | null;
  availability: Availability;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('appointments.block');
  const tc = useTranslations('common');
  const tSchedule = useTranslations('schedule');
  const format = useFormatter();
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wholeDay, setWholeDay] = useState(false);
  const [reason, setReason] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const key = day ? toDateKey(day) : '';
  const windows = day ? blockedWindowsFor(day, availability) : [];

  // Reset when the dialog opens on a day (or that day's closure changes), while
  // rendering rather than in an effect that first drew the previous day's rows.
  const [seen, setSeen] = useState<{ day: Date | null; existing: typeof existing } | null>(null);
  if (!seen || seen.day !== day || seen.existing !== existing) {
    setSeen({ day, existing });
    if (day) resetFor(day);
  }
  function resetFor(day: Date) {
    setWholeDay(Boolean(existing?.is_closed));
    setReason(existing?.reason ?? '');
    // One empty window to start from when nothing is blocked yet; otherwise
    // the existing ones are the list and a new one is asked for.
    setDrafts(
      existing?.is_closed || blockedWindowsFor(day, availability).length > 0
        ? []
        : [{ key: crypto.randomUUID(), from: '12:00', to: '13:00', reason: '' }],
    );
    setError(null);
    // The windows of the day are derived from `availability`, which changes
    // only through a refresh — no need to reset on it.
  }

  const invalidDraft = drafts.some((draft) => minutes(draft.to) <= minutes(draft.from));

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)),
    );
  }

  /** A new window starts where the last one ended, an hour long. */
  function addDraft() {
    setDrafts((current) => {
      const lastDraft = current[current.length - 1];
      const lastWindow = windows[windows.length - 1];
      const from = lastDraft ? lastDraft.to : lastWindow ? clock(lastWindow.end) : '12:00';
      const [h] = from.split(':').map(Number);
      const to = `${String(Math.min(23, (h ?? 12) + 1)).padStart(2, '0')}:${from.slice(3)}`;
      return [...current, { key: crypto.randomUUID(), from, to, reason: '' }];
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      if (wholeDay) {
        const result = await saveScheduleException({
          date: key,
          is_closed: true,
          start_time: '',
          end_time: '',
          reason,
        });
        if (!result.ok) {
          setError(t('failed'));
          return;
        }
      } else if (drafts.length > 0) {
        const result = await addScheduleBlocks(
          drafts.map((draft) => ({
            start_at: combineDateAndTime(key, draft.from).toISOString(),
            end_at: combineDateAndTime(key, draft.to).toISOString(),
            reason: draft.reason,
          })),
        );
        if (!result.ok) {
          setError(t('failed'));
          return;
        }
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

  async function removeWindow(id: string) {
    // The row used to vanish on one click with no word said. Reopening hours
    // is reversible, but a mis-tap next to the time fields is easy.
    const confirmed = await confirm({
      title: t('removeWindow'),
      body: t('removeConfirm'),
      confirmLabel: t('removeWindow'),
      destructive: true,
    });
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteScheduleBlock(id);
      if (!result.ok) {
        setError(t('failed'));
        return;
      }
      toast({ tone: 'success', title: t('removed') });
      router.refresh();
    });
  }

  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} closeLabel={tc('close')} className="max-w-lg">
        <div className="space-y-4">
          {day ? (
            <p className="text-sm font-medium text-ink-900">{format.dateTime(day, 'weekday')}</p>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {existing?.is_closed ? <Alert tone="info">{t('alreadyBlocked')}</Alert> : null}

          <label className="flex items-center gap-2 text-sm text-ink-800">
            <Checkbox checked={wholeDay} onChange={(event) => setWholeDay(event.target.checked)} />
            {t('wholeDay')}
          </label>

          {wholeDay ? (
            <Input
              value={reason}
              maxLength={160}
              placeholder={t('reasonPlaceholder')}
              aria-label={t('reason')}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-600">{t('hoursHint')}</p>

              {windows.length > 0 ? (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                  {windows.map((window) => (
                    <li key={window.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span dir="ltr" className="tabular-nums text-ink-800">
                        {clock(window.start)}–{clock(window.end)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-600" dir="auto">
                        {window.reason ?? ''}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-ink-500 hover:bg-red-50 hover:text-red-700"
                        aria-label={t('removeWindow')}
                        title={t('removeWindow')}
                        disabled={isPending}
                        onClick={() => removeWindow(window.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {drafts.map((draft, index) => (
                <div
                  key={draft.key}
                  className="space-y-2 rounded-lg border border-dashed border-ink-300 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <TimeSelect
                      value={draft.from}
                      onChange={(value) => updateDraft(index, { from: value })}
                      label={t('from')}
                      hourLabel={tSchedule('hour')}
                      minuteLabel={tSchedule('minute')}
                    />
                    <span className="text-ink-500" aria-hidden>
                      –
                    </span>
                    <TimeSelect
                      value={draft.to}
                      onChange={(value) => updateDraft(index, { to: value })}
                      label={t('to')}
                      hourLabel={tSchedule('hour')}
                      minuteLabel={tSchedule('minute')}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="ms-auto h-8 w-8 text-ink-500"
                      aria-label={t('removeWindow')}
                      title={t('removeWindow')}
                      onClick={() =>
                        setDrafts((current) => current.filter((_, position) => position !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  {minutes(draft.to) <= minutes(draft.from) ? (
                    <p className="text-xs text-red-700" role="alert">
                      {t('endAfterStart')}
                    </p>
                  ) : null}
                  <Input
                    value={draft.reason}
                    maxLength={160}
                    placeholder={t('reasonPlaceholder')}
                    aria-label={t('reason')}
                    onChange={(event) => updateDraft(index, { reason: event.target.value })}
                  />
                </div>
              ))}

              <Button type="button" variant="secondary" size="sm" onClick={addDraft}>
                <Plus className="h-4 w-4" aria-hidden />
                {t('addWindow')}
              </Button>
            </div>
          )}

          <DialogFooter>
            {existing?.is_closed ? (
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
            <Button
              type="button"
              disabled={isPending || (!wholeDay && (drafts.length === 0 || invalidDraft))}
              onClick={save}
            >
              {isPending ? <Spinner /> : <CalendarOff className="h-4 w-4" aria-hidden />}
              {t('save')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
