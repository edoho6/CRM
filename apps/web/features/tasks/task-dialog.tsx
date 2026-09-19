'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Checkbox,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  FieldGrid,
  Input,
  Select,
  Spinner,
  Textarea,
  TimeSelect,
  cn,
  useConfirm,
  useToast,
  type ComboboxOption,
  type ComboboxValue,
} from '@clinic/ui';
import { REMIND_CHANNELS, REMIND_OFFSETS, type RemindChannel } from '@clinic/domain';
import { getBrowserClient } from '@clinic/db/browser';
import { DateInput } from '@/components/date-input';
import { useRouter } from '@clinic/i18n/navigation';
import { describeActionError } from '@/lib/action-error';
import type { ClinicTaskWithPatient } from '@clinic/db/types';
import { combineDateAndTime, toDateKey, toTimeValue } from '@/features/appointments/date-utils';
import { createTask, deleteTask, updateTask } from './actions';

/**
 * One task, in full.
 *
 * The dashboard adds a task in one line; this is where it gets a moment. A
 * date alone puts it on that day's list; a date and a time make it an alarm.
 * The channel is recorded for all three but only the in-app one fires today
 * — the others are offered greyed, with the reason, rather than hidden,
 * because "will there be SMS" is a question worth answering on the screen.
 */
export function TaskDialog({
  open,
  task,
  patients,
  defaultPatient,
  onOpenChange,
}: {
  open: boolean;
  task: ClinicTaskWithPatient | null;
  patients: { id: string; full_name: string }[];
  /** Preselected for a task opened from a patient's file. */
  defaultPatient?: { id: string; full_name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const tSchedule = useTranslations('schedule');
  // Whether this person has a phone signed in to the store app: the push
  // option is offered only then. Asked once per opening, from the browser,
  // because the dialog opens from five places and none of them knows.
  const [hasDevice, setHasDevice] = useState(false);
  useEffect(() => {
    if (!open) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from('device_push_tokens')
      .select('id')
      .eq('app', 'clinic')
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setHasDevice(Boolean(data && data.length > 0));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [channel, setChannel] = useState<RemindChannel>('app');
  const [offset, setOffset] = useState<number>(0);
  const [patientChoice, setPatientChoice] = useState<ComboboxValue | null>(null);

  const patientOptions: ComboboxOption[] = useMemo(
    () => patients.map((patient) => ({ id: patient.id, label: patient.full_name })),
    [patients],
  );

  // Reset when the dialog opens (or opens on another task), while rendering —
  // an effect after it drew the previous task's fields for a frame first.
  const [seen, setSeen] = useState<{ open: boolean; task: typeof task; defaultPatient: typeof defaultPatient } | null>(null);
  if (!seen || seen.open !== open || seen.task !== task || seen.defaultPatient !== defaultPatient) {
    setSeen({ open, task, defaultPatient });
    if (open) resetFields();
  }
  function resetFields() {
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    if (task?.due_at) {
      const due = new Date(task.due_at);
      setDate(toDateKey(due));
      setTime(toTimeValue(due));
    } else {
      // A new task lands on today, at the next whole hour — with a time, so it
      // rings: a task without one only waits on the list. Not 00:00, which
      // on today is already past and would ring the moment it is saved.
      // An existing task that never had a time keeps having none.
      const now = new Date();
      setDate(task?.due_on ?? (task ? '' : toDateKey(now)));
      setTime(task ? '' : `${String(Math.min(now.getHours() + 1, 23)).padStart(2, '0')}:00`);
    }
    setUrgent(task?.is_urgent ?? false);
    setChannel(task?.remind_via ?? 'app');
    setOffset(task?.remind_offset_minutes ?? 0);
    setPatientChoice(
      task?.patient
        ? { id: task.patient.id, label: task.patient.full_name }
        : defaultPatient
          ? { id: defaultPatient.id, label: defaultPatient.full_name }
          : null,
    );
    setError(null);
  }

  function save() {
    if (!title.trim()) {
      setError(tc('somethingMissing'));
      return;
    }
    setError(null);
    const dueAt = date && time ? combineDateAndTime(date, time).toISOString() : '';
    const payload = {
      title: title.trim(),
      notes,
      due_on: date,
      due_at: dueAt,
      is_urgent: urgent,
      patient_id: patientChoice?.id ?? '',
      remind_via: channel,
      remind_offset_minutes: time ? offset : 0,
    };
    startTransition(async () => {
      const result = task ? await updateTask(task.id, payload) : await createTask(payload);
      if (!result.ok) {
        setError(describeActionError(tAll, result.error?.key));
        return;
      }
      toast({ tone: 'success', title: t(task ? 'updated' : 'created') });
      onOpenChange(false);
      router.refresh();
    });
  }

  async function remove() {
    if (!task) return;
    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.task') }),
      body: t('deleteConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) {
        setError(describeActionError(tAll, result.error?.key));
        return;
      }
      toast({ tone: 'success', title: t('deleted') });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={task ? t('edit') : t('new')} closeLabel={tc('close')} className="max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Field label={t('titleField')} htmlFor="task_title" required>
            <Input
              id="task_title"
              value={title}
              maxLength={200}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <FieldGrid>
            <Field label={t('dueDate')} htmlFor="task_date">
              <DateInput
                id="task_date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  if (!event.target.value) setTime('');
                }}
              />
            </Field>
            {/* 00:00 in the boxes and "no set time" ticked beside them, rather
                than a blank first choice: the blank's label did not fit the box
                and was cut to "בלי …". Picking an hour unticks it; ticking it
                takes the time away again. */}
            <Field label={t('dueTime')} htmlFor="task_time">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <TimeSelect
                  value={time || '00:00'}
                  onChange={setTime}
                  label={t('dueTime')}
                  disabled={!date}
                  hourLabel={tSchedule('hour')}
                  minuteLabel={tSchedule('minute')}
                  className={cn('w-auto min-w-0 flex-1 basis-40', !time && '[&_select]:text-ink-500')}
                />
                <label className="flex items-center gap-2 text-sm text-ink-800">
                  <Checkbox
                    checked={!time}
                    disabled={!date}
                    onChange={(event) => setTime(event.target.checked ? '' : '00:00')}
                  />
                  {t('noSetTime')}
                </label>
              </div>
            </Field>
          </FieldGrid>

          <Field label={t('patient')} htmlFor="task_patient">
            <Combobox
              id="task_patient"
              label={t('patient')}
              placeholder={t('searchPatient')}
              options={patientOptions}
              value={patientChoice}
              onChange={setPatientChoice}
            />
          </Field>

          <Field label={tc('notes')} htmlFor="task_notes">
            <Textarea
              id="task_notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-800">
            <Checkbox checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
            {t('urgent')}
            <span className="text-xs text-ink-500">· {t('urgentHint')}</span>
          </label>

          <Field label={t('remindWhen')} htmlFor="task_offset" hint={!time ? t('noTime') : undefined}>
            <Select
              id="task_offset"
              value={String(offset)}
              disabled={!time}
              onChange={(event) => setOffset(Number(event.target.value))}
            >
              {REMIND_OFFSETS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t(`offsets.${minutes}`)}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink-700">{t('remindVia')}</legend>
            <div className="flex flex-wrap gap-3">
              {REMIND_CHANNELS.map((option) => {
                // The in-app channel always; the phone when one is signed in;
                // email and SMS wait for a sending provider.
                const available = option === 'app' || (option === 'push' && hasDevice);
                return (
                  <label
                    key={option}
                    className={`flex items-center gap-1.5 text-sm ${available ? 'text-ink-800' : 'text-ink-400'}`}
                  >
                    <input
                      type="radio"
                      name="remind_via"
                      value={option}
                      checked={channel === option}
                      disabled={!available || !time}
                      onChange={() => setChannel(option)}
                      className="h-4 w-4 border-ink-300"
                    />
                    {t(`channels.${option}`)}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-ink-500">{t('channelHint')}</p>
          </fieldset>

          <DialogFooter>
            {/* Delete sits at the far end of the row, after Save, with a gap.
                It used to be pushed to the start edge — the first thing the
                eye meets in a Hebrew footer, for the one action that cannot be
                undone. */}
            {task ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={remove}
                className="order-last ms-3 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {tc('delete')}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
