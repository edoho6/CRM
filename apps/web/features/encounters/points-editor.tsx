'use client';

import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Button, Input, LtrInput, Select } from '@clinic/ui';
import { NEEDLE_TECHNIQUES, POINT_SIDES, type NeedleTechnique, type PointSide } from '@clinic/domain';

export interface PointRow {
  point: string;
  side: PointSide;
  technique: NeedleTechnique;
  retention_minutes?: number | string | null;
  notes?: string | null;
}

/**
 * Repeatable list of acupuncture points.
 *
 * Point codes (LI4, ST36) are Latin-script identifiers, so the code input is forced
 * LTR even in a Hebrew form — otherwise the letters and digits render in a
 * confusing order.
 */
export function PointsEditor({
  value,
  onChange,
  disabled,
}: {
  value: PointRow[];
  onChange: (rows: PointRow[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('encounters.points');
  const tSide = useTranslations('encounters.side');
  const tTechnique = useTranslations('encounters.technique');
  const tc = useTranslations('common');

  function update(index: number, patch: Partial<PointRow>) {
    onChange(value.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function add() {
    onChange([...value, { point: '', side: 'bilateral', technique: 'even', retention_minutes: '' }]);
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-center text-sm text-ink-400">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((row, index) => (
            <li
              key={index}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-ink-200 p-2 sm:grid-cols-[minmax(0,7rem)_minmax(0,8rem)_minmax(0,9rem)_minmax(0,6rem)_1fr_auto]"
            >
              <LtrInput
                aria-label={t('point')}
                placeholder={t('placeholder')}
                value={row.point}
                disabled={disabled}
                onChange={(event) => update(index, { point: event.target.value })}
                className="h-9 uppercase"
              />
              <Select
                aria-label={t('side')}
                value={row.side}
                disabled={disabled}
                onChange={(event) => update(index, { side: event.target.value as PointSide })}
                className="h-9"
              >
                {POINT_SIDES.map((side) => (
                  <option key={side} value={side}>
                    {tSide(side)}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t('technique')}
                value={row.technique}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { technique: event.target.value as NeedleTechnique })
                }
                className="h-9"
              >
                {NEEDLE_TECHNIQUES.map((technique) => (
                  <option key={technique} value={technique}>
                    {tTechnique(technique)}
                  </option>
                ))}
              </Select>
              <LtrInput
                aria-label={t('retention')}
                type="number"
                min={0}
                max={180}
                placeholder="20"
                value={row.retention_minutes ?? ''}
                disabled={disabled}
                onChange={(event) => update(index, { retention_minutes: event.target.value })}
                className="h-9"
              />
              <Input
                aria-label={tc('notes')}
                value={row.notes ?? ''}
                disabled={disabled}
                onChange={(event) => update(index, { notes: event.target.value })}
                className="h-9"
              />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={t('remove')}
                  className="justify-self-end rounded-md p-2 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!disabled ? (
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          {t('add')}
        </Button>
      ) : null}
    </div>
  );
}
