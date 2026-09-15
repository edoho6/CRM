'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Combobox, SegmentedControl, useToast, type ComboboxValue } from '@clinic/ui';
import type { PointOption } from '@/features/encounters/points-editor';
import type { Vec3 } from './frame';
import type { BodyPointMap, BodyPointPosition, BodySide } from './points';
import type { PickEvent } from './body-model';
import { deleteBodyPoint, saveBodyPoint } from './body-point-actions';

/**
 * The placement tool: where a point sits on the 3D body, decided by a
 * person.
 *
 * Shown to a platform admin (the numbers are the same for every clinic).
 * Pick a point from the catalogue, click the body, and the clicked spot is
 * drawn in the editor's colour and stored in the frame `points.ts`
 * documents. A left-side click is stored mirrored, because bilateral points
 * are kept on the right. "Validated" is a separate tick: it says the number
 * was checked against an anatomical reference, and the tool never sets it
 * on its own.
 */
export default function PointPlacer({
  catalogue,
  positions,
  picked,
  onClear,
  onSaved,
  onDeleted,
}: {
  catalogue: PointOption[];
  positions: BodyPointMap;
  picked: PickEvent | null;
  onClear: () => void;
  onSaved: (entry: BodyPointPosition) => void;
  onDeleted: (code: string) => void;
}) {
  const t = useTranslations('encounters.body3d.placer');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<ComboboxValue | null>(null);
  const [side, setSide] = useState<BodySide>('right');
  const [validated, setValidated] = useState(false);

  const options = useMemo(
    () =>
      catalogue.map((point) => ({
        id: point.code,
        label: point.code,
        secondary: point.pinyin,
        tertiary: point.english ?? point.chinese,
        keywords: [point.pinyin, point.english, point.chinese].filter(Boolean).join(' '),
        ltr: true,
      })),
    [catalogue],
  );

  const code = choice?.id ?? null;
  const selected = code ? catalogue.find((point) => point.code === code) ?? null : null;
  const existing = code ? positions.get(code) ?? null : null;
  const stored = picked ? toStored(picked, side) : null;

  const placedCount = positions.size;
  const validatedCount = [...positions.values()].filter((entry) => entry.validated).length;

  const choose = (value: ComboboxValue | null) => {
    setChoice(value);
    const next = value?.id ? positions.get(value.id) : undefined;
    // A point that already has a row shows it as it is; a midline point
    // starts on the midline, a paired one on the right.
    const option = value?.id ? catalogue.find((point) => point.code === value.id) : undefined;
    setSide(next ? (next.sideType === 'midline' ? 'midline' : 'right') : option?.bilateral === false ? 'midline' : 'right');
    setValidated(next?.validated ?? false);
    onClear();
  };

  const save = () => {
    if (!code || !stored) return;
    startTransition(async () => {
      const entry: BodyPointPosition = {
        code,
        sideType: side === 'midline' ? 'midline' : 'bilateral',
        position: stored.position,
        approach: stored.approach,
        validated,
        note: t('placedNote'),
      };
      const result = await saveBodyPoint(entry);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: t('saved', { code }) });
      onSaved(entry);
      onClear();
    });
  };

  const setValidatedOnly = (next: boolean) => {
    setValidated(next);
    if (!code || !existing || stored) return;
    // Ticking "validated" on a point that is already placed writes the tick
    // without moving the point.
    startTransition(async () => {
      const entry: BodyPointPosition = { ...existing, validated: next };
      const result = await saveBodyPoint(entry);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        setValidated(!next);
        return;
      }
      onSaved(entry);
    });
  };

  const remove = () => {
    if (!code || !existing) return;
    startTransition(async () => {
      const result = await deleteBodyPoint(code);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: t('deleted', { code }) });
      onDeleted(code);
      onClear();
    });
  };

  const vec = (v: Vec3) => `${fixed(v.x)}, ${fixed(v.y)}, ${fixed(v.z)}`;

  return (
    <section
      aria-label={t('title')}
      className="mt-2 space-y-3 rounded-md border border-dashed border-amber-700 bg-amber-50 p-3 text-xs text-ink-800"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{t('title')}</p>
        <p className="text-ink-600">{t('progress', { placed: placedCount, validated: validatedCount })}</p>
      </div>
      <p className="text-ink-600">{t('hint')}</p>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Combobox
          label={t('point')}
          placeholder={t('pointPlaceholder')}
          options={options}
          value={choice}
          onChange={choose}
          limit={40}
        />
        <SegmentedControl
          label={t('side')}
          value={side}
          onChange={(next) => {
            setSide(next);
            onClear();
          }}
          options={[
            { value: 'right', label: t('sideRight') },
            { value: 'left', label: t('sideLeft') },
            { value: 'midline', label: t('sideMidline') },
          ]}
        />
      </div>

      {selected ? (
        <div className="space-y-2">
          {existing ? (
            <p dir="ltr" className="rounded bg-white px-2 py-1 text-xs">
              {t('existing')} <span className="tabular-nums">{vec(existing.position)}</span>
              {existing.validated ? ` · ${t('validatedMark')}` : ''}
            </p>
          ) : (
            <p className="text-ink-600">{t('notPlaced')}</p>
          )}
          {stored ? (
            <p dir="ltr" className="rounded bg-white px-2 py-1 text-xs">
              {t('picked')} <span className="tabular-nums">{vec(stored.position)}</span>
            </p>
          ) : (
            <p className="text-ink-600">{t('pick')}</p>
          )}
          <label className="inline-flex items-center gap-2 text-xs text-ink-800">
            <Checkbox
              checked={validated}
              onChange={(event) => setValidatedOnly(event.target.checked)}
              disabled={isPending}
            />
            {t('validated')}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={isPending || !stored} onClick={save}>
              {existing ? t('move') : t('save')}
            </Button>
            {stored ? (
              <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={isPending}>
                {t('clear')}
              </Button>
            ) : null}
            {existing ? (
              <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={isPending}>
                {t('delete')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-ink-600">{t('choose')}</p>
      )}
    </section>
  );
}

function toStored(picked: PickEvent, side: BodySide): { position: Vec3; approach: Vec3 } {
  if (side === 'midline') {
    return {
      position: { x: 0, y: picked.position.y, z: picked.position.z },
      approach: { x: 0, y: picked.normal.y, z: picked.normal.z },
    };
  }
  // Bilateral points are stored on the patient's right (x < 0). A click on
  // the left is mirrored; a click that landed a hair past the midline on
  // the "wrong" side is pushed to the right rather than refused, since the
  // constraint in the table would refuse it anyway.
  const mirror = side === 'left' ? -1 : 1;
  const x = picked.position.x * mirror;
  return {
    position: { x: x < 0 ? x : -Math.max(Math.abs(x), 0.001), y: picked.position.y, z: picked.position.z },
    approach: { x: picked.normal.x * mirror, y: picked.normal.y, z: picked.normal.z },
  };
}

function fixed(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}
