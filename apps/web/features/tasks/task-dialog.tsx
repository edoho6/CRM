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
  LtrInput,
  Spinner,
  Textarea,
  TimeSelect,
  useConfirm,
  useToast,
  type ComboboxOption,
  type ComboboxValue,
} from '@clinic/ui';
import { REMIND_CHANNELS, type RemindChannel } from '@clinic/domain';
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
  onOpenChange,
}: {
  open: boolean;
  task: ClinicTaskWithPatient | null;
  patients: { id: string; full_name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const tSchedule = useTranslations('schedule');
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
  const [patientChoice, setPatientChoice] = useState<ComboboxValue | null>(null);

  const patientOptions: ComboboxOption[] = useMemo(
    () => patients.map((patient) => ({ id: patient.id, label: patient.full_name })),
    [patients],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    if (task?.due_at) {
      const due = new Date(task.due_at);
      setDate(toDateKey(due));
      setTime(toTimeValue(due));
    } else {
      // A new task lands on today; the time field only unlocks once a date exists.
      setDate(task?.due_on ?? (task ? '' : toDateKey(new Date())));
      setTime('');
    }
    setUrgent(task?.is_urgent ?? false);
    setChannel(task?.remind_via ?? 'app');
    setPatientChoice(
      task?.patient ? { id: task.patient.id, label: task.patient.full_name } : null,
    );
    setError(null);
  }, [open, task]);

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
              <LtrInput
                id="task_date"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  if (!event.target.value) setTime('');
                }}
              />
            </Field>
            <Field label={t('dueTime')} htmlFor="task_time" hint={!date ? t('noTime') : undefined}>
              <div className="flex items-center gap-2">
                <TimeSelect
                  value={time || '09:00'}
                  onChange={setTime}
                  label={t('dueTime')}
                  disabled={!date}
                  hourLabel={tSchedule('hour')}
                  minuteLabel={tSchedule('minute')}
                />
                {time ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setTime('')}>
                    {t('noTime')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!date}
                    onClick={() => setTime('09:00')}
                  >
                    {t('dueTime')}
                  </Button>
                )}
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
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink-700">{t('remindVia')}</legend>
            <div className="flex flex-wrap gap-3">
              {REMIND_CHANNELS.map((option) => {
                // Only the in-app channel has anything behind it today.
                const available = option === 'app';
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
