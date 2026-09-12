'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  LtrInput,
  Spinner,
  Textarea,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { DEFAULT_ENTRY_COLOR } from '@clinic/domain';
import type { AppointmentType } from '@clinic/db/types';
import { deleteAppointmentType, saveAppointmentType } from './actions';

/**
 * The treatment types a practitioner defines for their own practice.
 *
 * This is the modular part of the diary: nothing here is a fixed list. A
 * practitioner who only does acupuncture defines two types; one who also sells
 * herbal consultations and does house calls defines five, each with its own
 * length, price and colour, and the calendar and the invoice both follow.
 *
 * Editing happens in place. There are rarely more than a handful, they are
 * changed once a year, and a list that opens a modal per row would be more
 * machinery than the task.
 */

interface Draft {
  id: string | null;
  name_he: string;
  name_en: string;
  default_duration_minutes: string;
  price: string;
  color: string;
  notes: string;
  is_active: boolean;
  online_bookable: boolean;
}

function toDraft(type?: AppointmentType): Draft {
  return {
    id: type?.id ?? null,
    name_he: type?.name_he ?? '',
    name_en: type?.name_en ?? '',
    default_duration_minutes: String(type?.default_duration_minutes ?? 60),
    price: type?.price === null || type?.price === undefined ? '' : String(type.price),
    color: type?.color ?? DEFAULT_ENTRY_COLOR,
    notes: type?.notes ?? '',
    is_active: type?.is_active ?? true,
    online_bookable: type?.online_bookable ?? false,
  };
}

export function AppointmentTypesManager({ types }: { types: AppointmentType[] }) {
  const t = useTranslations('settings.appointmentTypes');
  const tc = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Draft[]>(() => types.map((type) => toDraft(type)));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)),
    );
  }

  function save(index: number) {
    const draft = drafts[index]!;
    setError(null);

    startTransition(async () => {
      const result = await saveAppointmentType(draft.id, {
        name_he: draft.name_he,
        name_en: draft.name_en,
        default_duration_minutes: draft.default_duration_minutes,
        price: draft.price,
        color: draft.color,
        notes: draft.notes,
        is_active: draft.is_active,
        online_bookable: draft.online_bookable,
      });

      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  async function remove(index: number) {
    const draft = drafts[index]!;

    if (!draft.id) {
      setDrafts((current) => current.filter((_, position) => position !== index));
      return;
    }

    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.appointmentType') }),
      body: t('deleteConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteAppointmentType(draft.id!);
      if (!result.ok) {
        // A type already used by a booking cannot be removed without rewriting
        // history, so it is deactivated instead and says so.
        setError(t('inUse'));
        return;
      }
      setDrafts((current) => current.filter((_, position) => position !== index));
      toast({ tone: 'success', title: tc('deleted') });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {drafts.map((draft, index) => (
        <Card key={draft.id ?? `new-${index}`}>
          <CardBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('nameHe')} htmlFor={`he-${index}`} required>
                <Input
                  id={`he-${index}`}
                  value={draft.name_he}
                  onChange={(event) => update(index, { name_he: event.target.value })}
                />
              </Field>
              {/* Not required. A Hebrew practice has no reason to name every
                  treatment twice, and the calendar falls back to the Hebrew. */}
              <Field label={t('nameEn')} htmlFor={`en-${index}`}>
                <Input
                  id={`en-${index}`}
                  dir="ltr"
                  value={draft.name_en}
                  onChange={(event) => update(index, { name_en: event.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('duration')} htmlFor={`dur-${index}`}>
                <LtrInput
                  id={`dur-${index}`}
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={draft.default_duration_minutes}
                  onChange={(event) =>
                    update(index, { default_duration_minutes: event.target.value })
                  }
                />
              </Field>

              <Field label={t('price')} htmlFor={`price-${index}`} hint={t('priceHint')}>
                <LtrInput
                  id={`price-${index}`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="—"
                  value={draft.price}
                  onChange={(event) => update(index, { price: event.target.value })}
                />
              </Field>

              <Field label={t('colour')} htmlFor={`color-${index}`}>
                <span className="flex items-center gap-2">
                  <input
                    id={`color-${index}`}
                    type="color"
                    value={draft.color}
                    onChange={(event) => update(index, { color: event.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
                  />
                  <span dir="ltr" className="text-xs tabular-nums text-ink-600">
                    {draft.color}
                  </span>
                </span>
              </Field>
            </div>

            <Field label={tc('notes')} htmlFor={`notes-${index}`}>
              <Textarea
                id={`notes-${index}`}
                rows={2}
                value={draft.notes}
                onChange={(event) => update(index, { notes: event.target.value })}
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(event) => update(index, { is_active: event.target.checked })}
                  className="h-4 w-4 rounded border-ink-300"
                />
                {t('active')}
              </label>

              {/* Offered on the public booking page. Off by default: a new
                  type is the practitioner's until they say otherwise. */}
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={draft.online_bookable}
                  onChange={(event) => update(index, { online_bookable: event.target.checked })}
                  className="h-4 w-4 rounded border-ink-300"
                />
                {t('onlineBookable')}
              </label>

              <span className="flex items-center gap-2">
                {draft.price ? (
                  <span dir="ltr" className="text-sm tabular-nums text-ink-600">
                    {format.number(Number(draft.price), 'currency')}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {tc('delete')}
                </Button>
                <Button type="button" size="sm" onClick={() => save(index)} disabled={isPending}>
                  {isPending ? <Spinner /> : null}
                  {tc('save')}
                </Button>
              </span>
            </div>
          </CardBody>
        </Card>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setDrafts((current) => [...current, toDraft()])}
      >
        <Plus className="h-4 w-4" />
        {t('add')}
      </Button>
    </div>
  );
}
