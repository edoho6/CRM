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
import { DEFAULT_ENTRY_COLOR } from '@clinic/domain';
import type { Location } from '@clinic/db/types';
import { deleteLocation, saveLocation } from './actions';

/**
 * The clinics a practitioner works from.
 *
 * One account, several addresses — Tuesdays here, Thursdays there. With more
 * than one defined, every booking names one, and the rooms are sorted under
 * them. With none, nothing in the diary asks.
 */

interface Draft {
  id: string | null;
  name: string;
  address: string;
  color: string;
  is_active: boolean;
}

function toDraft(location?: Location): Draft {
  return {
    id: location?.id ?? null,
    name: location?.name ?? '',
    address: location?.address ?? '',
    color: location?.color ?? DEFAULT_ENTRY_COLOR,
    is_active: location?.is_active ?? true,
  };
}

export function LocationsManager({ locations }: { locations: Location[] }) {
  const t = useTranslations('settings.locations');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Draft[]>(() => locations.map((entry) => toDraft(entry)));
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
      const result = await saveLocation(draft.id, {
        name: draft.name,
        address: draft.address,
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
      title: tc('deleteNamed', { thing: tc('things.location') }),
      body: t('deleteConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteLocation(draft.id!);
      if (!result.ok) {
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
      {drafts.length === 0 ? <p className="text-sm text-ink-500">{t('empty')}</p> : null}

      {drafts.map((draft, index) => (
        <Card key={draft.id ?? `new-${index}`}>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('name')} htmlFor={`location-${index}`} required className="min-w-40 flex-1">
                <Input
                  id={`location-${index}`}
                  value={draft.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                />
              </Field>
              <Field label={t('colour')} htmlFor={`location-color-${index}`}>
                <input
                  id={`location-color-${index}`}
                  type="color"
                  value={draft.color}
                  onChange={(event) => update(index, { color: event.target.value })}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
                />
              </Field>
            </div>
            <Field label={t('address')} htmlFor={`location-address-${index}`}>
              <Input
                id={`location-address-${index}`}
                value={draft.address}
                onChange={(event) => update(index, { address: event.target.value })}
              />
            </Field>
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
