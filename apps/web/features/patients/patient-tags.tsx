'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Combobox, Popover, cn, useToast, type ComboboxOption, type ComboboxValue } from '@clinic/ui';
import { Link, useRouter } from '@clinic/i18n/navigation';
import type { PatientTag } from '@clinic/db/types';
import { createPatientTagInline, setPatientTags } from './actions';
import { TAG_CLASSES } from './tag-colors';

/**
 * The labels on a patient's file.
 *
 * A tag is a word the practitioner chose — "headaches", "stopped after two",
 * "pays cash" — and a click on it lists everyone who carries it. That link is
 * the whole point: a label nobody can gather by is decoration.
 *
 * Adding is typing. The picker offers the clinic's existing tags and makes a
 * new one from whatever else is typed, so the vocabulary grows from use
 * rather than from a settings screen. Tidying — renaming, colouring, merging
 * — happens in Settings, in one place, for all files at once.
 */

export type TagChip = Pick<PatientTag, 'id' | 'name' | 'color'>;

/** A tag as a link to everyone who carries it. */
export function TagChipLink({ tag, className }: { tag: TagChip; className?: string }) {
  return (
    <Link
      href={{ pathname: '/patients', query: { tag: tag.id, inactive: '1' } }}
      className={cn(
        'inline-flex max-w-48 items-center truncate rounded-full px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline',
        TAG_CLASSES[tag.color],
        className,
      )}
      dir="auto"
    >
      {tag.name}
    </Link>
  );
}

export function PatientTags({
  patientId,
  tags,
  allTags,
  editable = true,
}: {
  patientId: string;
  /** The tags on this file. */
  tags: TagChip[];
  /** Every tag the clinic has, for the picker. */
  allTags: TagChip[];
  editable?: boolean;
}) {
  const t = useTranslations('patients.tags');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState<TagChip[]>(tags);

  // The server's list wins whenever it arrives; the local copy only bridges
  // the moment between a click and the refresh.
  const tagIds = tags.map((tag) => tag.id).join(',');
  useEffect(() => {
    setCurrent(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagIds]);

  function save(next: TagChip[]) {
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const result = await setPatientTags({
        patient_id: patientId,
        tag_ids: next.map((tag) => tag.id),
      });
      if (!result.ok) {
        setCurrent(previous);
        toast({ tone: 'danger', title: t('saveFailed') });
        return;
      }
      router.refresh();
    });
  }

  function add(choice: ComboboxValue | null, close: () => void) {
    if (!choice || !choice.label.trim()) return;
    startTransition(async () => {
      let tag = choice.id ? allTags.find((candidate) => candidate.id === choice.id) : undefined;
      if (!tag) {
        // Typed rather than chosen: a new tag, or an existing one spelt from
        // memory — the unique name index makes the second an error, which is
        // caught here by matching the name first.
        const byName = allTags.find(
          (candidate) => candidate.name.trim().toLowerCase() === choice.label.trim().toLowerCase(),
        );
        if (byName) {
          tag = byName;
        } else {
          const created = await createPatientTagInline(choice.label);
          if (!created.ok) {
            toast({ tone: 'danger', title: t('saveFailed') });
            return;
          }
          tag = { id: created.data.id, name: choice.label.trim(), color: 'ink' };
        }
      }
      close();
      if (current.some((existing) => existing.id === tag!.id)) return;
      save([...current, tag]);
    });
  }

  const options: ComboboxOption[] = allTags
    .filter((tag) => !current.some((existing) => existing.id === tag.id))
    .map((tag) => ({ id: tag.id, label: tag.name }));

  return (
    <div className="flex flex-wrap items-center gap-1" aria-label={t('title')}>
      {current.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            'inline-flex items-center rounded-full text-xs font-medium',
            TAG_CLASSES[tag.color],
          )}
        >
          <TagChipLink tag={tag} className="rounded-e-none pe-1" />
          {editable ? (
            <button
              type="button"
              aria-label={t('remove', { name: tag.name })}
              title={t('remove', { name: tag.name })}
              disabled={isPending}
              onClick={() => save(current.filter((existing) => existing.id !== tag.id))}
              className="rounded-e-full py-0.5 pe-1.5 ps-0.5 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}

      {editable ? (
        <Popover
          triggerContent={
            current.length === 0 ? (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>{t('add')}</span>
              </>
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden />
            )
          }
          triggerLabel={t('add')}
          triggerTitle={t('add')}
          triggerClassName={cn(
            'inline-flex h-6 items-center justify-center gap-1 rounded-full border border-dashed text-xs',
            current.length === 0 ? 'px-2.5' : 'w-6',
            'border-ink-300 text-ink-500 transition-colors hover:border-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
          panelLabel={t('add')}
          width={272}
          disabled={isPending}
        >
          {({ close }) => (
            <div className="p-2">
              <Combobox
                label={t('add')}
                placeholder={t('placeholder')}
                options={options}
                value={null}
                onChange={(choice) => add(choice, close)}
                allowCustom
                emptyCustomHint={t('createHint')}
              />
            </div>
          )}
        </Popover>
      ) : current.length === 0 ? (
        <span className="text-xs text-ink-500">{t('none')}</span>
      ) : null}
    </div>
  );
}
