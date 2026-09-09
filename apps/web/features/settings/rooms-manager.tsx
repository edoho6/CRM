'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Toggle,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import type { Room } from '@clinic/db/types';
import { deleteRoom, saveRoom } from './actions';

/**
 * The rooms a clinic treats in.
 *
 * Defining them is what turns on side-by-side booking: with two rooms, the
 * same practitioner can hold two people at ten o'clock, one in each, and the
 * calendar shows both with the room's colour. With none, the diary behaves as
 * it always did — one person, one hour.
 *
 * Edited in place, like treatment types: a clinic has two or three of these and
 * changes them when it moves premises.
 */

interface Draft {
  id: string | null;
  name: string;
  color: string;
  is_active: boolean;
}

function toDraft(room?: Room): Draft {
  return {
    id: room?.id ?? null,
    name: room?.name ?? '',
    color: room?.color ?? '#0e7490',
    is_active: room?.is_active ?? true,
  };
}

export function RoomsManager({ rooms }: { rooms: Room[] }) {
  const t = useTranslations('settings.rooms');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Draft[]>(() => rooms.map((room) => toDraft(room)));
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
      const result = await saveRoom(draft.id, {
        name: draft.name,
        color: draft.color,
        is_active: draft.is_active,
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
      title: tc('deleteConfirmTitle'),
      body: t('deleteConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteRoom(draft.id!);
      if (!result.ok) {
        // Bookings already refer to it, so it was retired rather than removed.
        setError(t('inUse'));
        router.refresh();
        return;
      }
      setDrafts((current) => current.filter((_, position) => position !== index));
      toast({ tone: 'success', title: tc('deleted') });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">{t('intro')}</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {drafts.map((draft, index) => (
        <Card key={draft.id ?? `new-${index}`}>
          <CardBody className="flex flex-wrap items-end gap-3">
            <Field label={t('name')} htmlFor={`room-${index}`} required className="min-w-48 flex-1">
              <Input
                id={`room-${index}`}
                value={draft.name}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </Field>

            <Field label={t('colour')} htmlFor={`room-color-${index}`}>
              <span className="flex items-center gap-2">
                <input
                  id={`room-color-${index}`}
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

            <Toggle
              checked={draft.is_active}
              onChange={(checked) => update(index, { is_active: checked })}
              label={t('active')}
            />

            <div className="ms-auto flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                disabled={isPending || !draft.name.trim()}
                onClick={() => save(index)}
              >
                {tc('save')}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-ink-500 hover:bg-red-50 hover:text-red-600"
                aria-label={tc('delete')}
                title={tc('delete')}
                disabled={isPending}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setDrafts((current) => [...current, toDraft()])}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {t('add')}
      </Button>
    </div>
  );
}
