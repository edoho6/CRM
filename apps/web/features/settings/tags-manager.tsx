'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Card, CardBody, Field, Input, cn, useConfirm, useToast } from '@clinic/ui';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { TAG_COLORS, type TagColor } from '@clinic/domain';
import type { PatientTag } from '@clinic/db/types';
import { TAG_CLASSES, TAG_SWATCH_CLASSES } from '@/features/patients/tag-colors';
import { deletePatientTag, savePatientTag } from './actions';

/**
 * Every tag the clinic uses, in one place.
 *
 * Tags are made from the patient file as they are needed, and this is where
 * they are tidied: renamed when two spellings turn out to mean one thing,
 * coloured so the important ones stand out, removed when they have stopped
 * meaning anything. The count beside each is a link, because "who has this
 * tag" is the reason the tag exists.
 */

interface Draft {
  id: string | null;
  name: string;
  color: TagColor;
}

function toDraft(tag?: PatientTag): Draft {
  return { id: tag?.id ?? null, name: tag?.name ?? '', color: tag?.color ?? 'ink' };
}

export function TagsManager({
  tags,
  usage,
}: {
  tags: PatientTag[];
  /** How many files carry each tag, by tag id. */
  usage: Record<string, number>;
}) {
  const t = useTranslations('settings.tags');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Draft[]>(() => tags.map((tag) => toDraft(tag)));
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
      const result = await savePatientTag(draft.id, { name: draft.name, color: draft.color });
      if (!result.ok) {
        setError(t('saveFailed'));
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
    const count = usage[draft.id] ?? 0;
    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.tag') }),
      body: t('deleteConfirm', { count }),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deletePatientTag(draft.id!);
      if (!result.ok) {
        setError(tc('errorGeneric'));
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

      {drafts.map((draft, index) => {
        const count = draft.id ? (usage[draft.id] ?? 0) : 0;
        return (
          <Card key={draft.id ?? `new-${index}`}>
            <CardBody className="flex flex-wrap items-end gap-3">
              <Field label={t('name')} htmlFor={`tag-${index}`} required className="min-w-48 flex-1">
                <Input
                  id={`tag-${index}`}
                  value={draft.name}
                  maxLength={60}
                  onChange={(event) => update(index, { name: event.target.value })}
                />
              </Field>

              {/* Five swatches, not a colour wheel: the point of a tag colour
                  is to be told apart from the other four at a glance. */}
              <fieldset className="flex items-center gap-1.5">
                <legend className="mb-1 text-xs font-medium text-ink-600">{t('colour')}</legend>
                {TAG_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer" title={t(`colours.${color}`)}>
                    <input
                      type="radio"
                      name={`tag-color-${index}`}
                      value={color}
                      checked={draft.color === color}
                      onChange={() => update(index, { color })}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'block h-6 w-6 rounded-full border-2',
                        TAG_SWATCH_CLASSES[color],
                        draft.color === color ? 'border-ink-900 ring-2 ring-white' : 'border-transparent',
                      )}
                    />
                    <span className="sr-only">{t(`colours.${color}`)}</span>
                  </label>
                ))}
              </fieldset>

              {draft.id ? (
                <Link
                  href={{ pathname: '/patients', query: { tag: draft.id, inactive: '1' } }}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium underline-offset-2 hover:underline',
                    TAG_CLASSES[draft.color],
                  )}
                >
                  {t('usage', { count })}
                </Link>
              ) : null}

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
            </CardBody>
          </Card>
        );
      })}

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
