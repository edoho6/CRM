'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyNote,
  Field,
  Input,
  Select,
  Toggle,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { DEFAULT_ENTRY_COLOR } from '@clinic/domain';
import type { Location, Room } from '@clinic/db/types';
import { deleteRoom, saveRoom } from './actions';

/**
 * The rooms a clinic treats in.
 *
 * Defining them is what turns on side-by-side booking: with two rooms, the
 * same practitioner can hold two people at ten o'clock, one in each, and the
 * calendar shows both with the room's colour. With none, the diary behaves as
 * it always did — one person, one hour.
 *
 * When the practice has more than one address, each room says which one it
 * is in, and the booking dialog offers only the rooms of the chosen address.
 */

interface Draft {
  id: string | null;
  name: string;
  color: string;
  is_active: boolean;
  location_id: string;
}

function toDraft(room?: Room): Draft {
  return {
    id: room?.id ?? null,
    name: room?.name ?? '',
    color: room?.color ?? DEFAULT_ENTRY_COLOR,
    is_active: room?.is_active ?? true,
    location_id: room?.location_id ?? '',
  };
}

export function RoomsManager({ rooms, locations }: { rooms: Room[]; locations: Location[] }) {
  const t = useTranslations('settings.rooms');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Draft[]>(() => rooms.map((room) => toDraft(room)));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeLocations = locations.filter((entry) => entry.is_active);

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
        location_id: draft.location_id || null,
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
      title: tc('deleteNamed', { thing: tc('things.room') }),
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
      {drafts.length === 0 ? <EmptyNote>{t('empty')}</EmptyNote> : null}

      {drafts.map((draft, index) => (
        <Card key={draft.id ?? `new-${index}`}>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('name')} htmlFor={`room-${index}`} required className="min-w-40 flex-1">
                <Input
                  id={`room-${index}`}
                  value={draft.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                />
              </Field>
              <Field label={t('colour')} htmlFor={`room-color-${index}`}>
                <input
                  id={`room-color-${index}`}
                  type="color"
                  value={draft.color}
                  onChange={(event) => update(index, { color: event.target.value })}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
                />
              </Field>
            </div>

            {activeLocations.length > 0 ? (
              <Field label={t('location')} htmlFor={`room-location-${index}`}>
                <Select
                  id={`room-location-${index}`}
                  value={draft.location_id}
                  onChange={(event) => update(index, { location_id: event.target.value })}
                >
                  <option value="">{t('anyLocation')}</option>
                  {activeLocations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
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
                  className="text-ink-500 hover:bg-red-50 hover:text-red-700"
                  aria-label={tc('delete')}
                  title={tc('delete')}
                  disabled={isPending}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
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
