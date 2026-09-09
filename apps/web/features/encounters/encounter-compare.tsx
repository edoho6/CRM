'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, CardTitle, Select } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { toPointPlacement } from '@clinic/domain';
import type { RecordedPoint } from '@clinic/db/types';
import { formatDate } from '@clinic/i18n';
import type { CurrentPrescription, PrescriptionLine } from './current-prescription-context';

/**
 * Last time, beside now — head to head, and live.
 *
 * Two columns: the treatment being compared against, and the one being written.
 * Points on top, herbs underneath, and every entry coloured by what happened to
 * it: amber on the earlier side for a point or herb that is gone, green on the
 * current side for one that is new, amber on the current side for a herb whose
 * dose changed, with the old dose beside it. The current column follows the
 * form as it is typed — and follows the dispensing panel as a formula is picked
 * or a herb line filled in, before anything is saved.
 *
 * The prose that used to sit under the diff — pattern, principle, complaint,
 * notes — is gone. Beside a note being written it was a second thing to read,
 * and the question this answers is "what did I give last time, and what am I
 * giving now", which two lists answer and five paragraphs do not.
 *
 * Colour is never the only signal: the legend at the foot says in words what
 * each colour means, and the changed dose prints the old figure.
 */

export interface PreviousEncounter {
  id: string;
  date: string;
  points: RecordedPoint[];
  formula: string | null;
  herbs: PrescriptionLine[];
}

export interface CurrentPoint {
  point: string;
  region: string;
}

type Placement = 'right' | 'left' | 'center' | 'ear';

/** Older notes carry a `side` and no region; the same rule the form applies. */
function placementOf(point: RecordedPoint): Placement {
  if (point.region) return toPointPlacement(point.region);
  if (point.side === 'left') return 'left';
  if (point.side === 'midline') return 'center';
  return 'right';
}

function pointKey(code: string, placement: string): string {
  return `${code.trim().toLowerCase()}|${placement}`;
}

type Status = 'kept' | 'dropped' | 'added' | 'changed';

interface PointCell {
  key: string;
  code: string;
  placement: Placement;
  status: Status;
}

interface HerbCell {
  key: string;
  name: string;
  quantity: number | null;
  status: Status;
  /** The earlier dose, for a changed line. */
  was?: number | null;
}

export function EncounterCompare({
  previous,
  currentPoints,
  currentPrescription,
}: {
  /** Earlier treatments of the same patient, newest first. */
  previous: PreviousEncounter[];
  /** The points in the record being written, so the diff is live. */
  currentPoints: CurrentPoint[];
  /** What the dispensing panel is composing or has recorded, if anything. */
  currentPrescription: CurrentPrescription | null;
}) {
  const t = useTranslations('encounters.compare');
  const tRegion = useTranslations('encounters.region');
  const [selectedId, setSelectedId] = useState('');

  const selected = previous.find((entry) => entry.id === selectedId) ?? previous[0] ?? null;

  const points = useMemo(() => {
    if (!selected) return null;

    const before = new Map<string, PointCell>();
    for (const point of selected.points) {
      const placement = placementOf(point);
      const key = pointKey(point.point, placement);
      before.set(key, { key, code: point.point, placement, status: 'dropped' });
    }
    const now = new Map<string, PointCell>();
    for (const point of currentPoints) {
      const placement = toPointPlacement(point.region);
      const key = pointKey(point.point, placement);
      if (!now.has(key)) now.set(key, { key, code: point.point, placement, status: 'added' });
    }
    for (const [key, cell] of before) {
      if (now.has(key)) {
        cell.status = 'kept';
        now.get(key)!.status = 'kept';
      }
    }
    return { before: [...before.values()], now: [...now.values()] };
  }, [selected, currentPoints]);

  const herbs = useMemo(() => {
    if (!selected) return null;

    const before = new Map<string, HerbCell>();
    for (const line of selected.herbs) {
      before.set(line.key, { ...line, status: 'dropped' });
    }
    const now = new Map<string, HerbCell>();
    for (const line of currentPrescription?.herbs ?? []) {
      if (!now.has(line.key)) now.set(line.key, { ...line, status: 'added' });
    }
    for (const [key, cell] of before) {
      const current = now.get(key);
      if (!current) continue;
      cell.status = 'kept';
      if (
        cell.quantity !== null &&
        current.quantity !== null &&
        Math.abs(cell.quantity - current.quantity) > 0.001
      ) {
        current.status = 'changed';
        current.was = cell.quantity;
      } else {
        current.status = 'kept';
      }
    }
    return { before: [...before.values()], now: [...now.values()] };
  }, [selected, currentPrescription]);

  if (previous.length === 0) {
    // A first visit is a fact worth a line, not a panel that silently is not there.
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-600">{t('firstVisit')}</p>
        </CardBody>
      </Card>
    );
  }

  const formulaChanged =
    (selected?.formula ?? null) !== (currentPrescription?.formula ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4 text-ink-600" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {previous.length > 1 ? (
          <Select
            aria-label={t('chooseTreatment')}
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-8 text-xs"
          >
            {previous.map((entry, index) => (
              <option key={entry.id} value={entry.id}>
                {index === 0 ? `${t('mostRecent')} · ` : ''}
                {formatDate(entry.date)}
              </option>
            ))}
          </Select>
        ) : null}

        {selected && points && herbs ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {/* Column heads. Reading order is earlier → now, which is the
                start column → end column in either script. */}
            <ColumnHead label={t('previous')} detail={formatDate(selected.date)} />
            <ColumnHead
              label={t('current')}
              detail={
                currentPrescription?.draft ? <Badge tone="muted">{t('draft')}</Badge> : null
              }
            />

            <RowLabel>{t('points')}</RowLabel>
            <PointList cells={points.before} regionLabel={(p) => tRegion(p)} empty={t('none')} />
            <PointList cells={points.now} regionLabel={(p) => tRegion(p)} empty={t('none')} />

            <RowLabel>{t('herbs')}</RowLabel>
            <div className="min-w-0 space-y-1">
              <FormulaLine name={selected.formula} changed={false} empty={t('none')} />
              <HerbList cells={herbs.before} />
            </div>
            <div className="min-w-0 space-y-1">
              <FormulaLine
                name={currentPrescription?.formula ?? null}
                changed={formulaChanged}
                empty={t('none')}
              />
              <HerbList cells={herbs.now} renderWas={(quantity) => t('was', { quantity })} />
            </div>
          </div>
        ) : null}

        <p className="border-t border-ink-100 pt-2 text-xs text-ink-600">{t('legend')}</p>
      </CardBody>
    </Card>
  );
}

function ColumnHead({ label, detail }: { label: string; detail?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-b border-ink-100 pb-1">
      <span className="text-xs font-semibold text-ink-800">{label}</span>
      {typeof detail === 'string' ? (
        <span className="text-xs text-ink-500" dir="ltr">
          {detail}
        </span>
      ) : (
        detail
      )}
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return <p className="col-span-2 pt-1 text-xs font-medium text-ink-600">{children}</p>;
}

const STATUS_CLASSES: Record<Status, string> = {
  kept: 'border-ink-200 bg-white text-ink-800',
  dropped: 'border-amber-200 bg-amber-50 text-amber-900',
  added: 'border-jade-200 bg-jade-50 text-jade-900',
  changed: 'border-amber-200 bg-amber-50 text-amber-900',
};

function PointList({
  cells,
  regionLabel,
  empty,
}: {
  cells: PointCell[];
  regionLabel: (placement: Placement) => string;
  empty: string;
}) {
  if (cells.length === 0) return <p className="text-xs text-ink-500">{empty}</p>;
  return (
    <ul className="flex min-w-0 flex-wrap gap-1">
      {cells.map((cell) => (
        <li
          key={cell.key}
          className={cn(
            'inline-flex items-baseline gap-1 rounded border px-1.5 py-0.5 text-xs',
            STATUS_CLASSES[cell.status],
          )}
        >
          <span dir="ltr" className="tabular-nums">
            {cell.code}
          </span>
          <span className="text-[11px] opacity-70">{regionLabel(cell.placement)}</span>
        </li>
      ))}
    </ul>
  );
}

function FormulaLine({
  name,
  changed,
  empty,
}: {
  name: string | null;
  changed: boolean;
  empty: string;
}) {
  if (!name) return <p className="text-xs text-ink-500">{empty}</p>;
  return (
    <p
      className={cn(
        'truncate rounded border px-1.5 py-0.5 text-xs font-medium',
        changed ? STATUS_CLASSES.added : STATUS_CLASSES.kept,
      )}
      dir="auto"
      title={name}
    >
      {name}
    </p>
  );
}

function HerbList({
  cells,
  renderWas,
}: {
  cells: HerbCell[];
  /** Only the current column prints the earlier dose beside a changed one. */
  renderWas?: (quantity: number) => string;
}) {
  if (cells.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {cells.map((cell) => (
        <li
          key={cell.key}
          className={cn(
            'flex items-baseline justify-between gap-2 rounded border px-1.5 py-0.5 text-xs',
            STATUS_CLASSES[cell.status],
          )}
        >
          <span className="min-w-0 truncate" dir="auto" title={cell.name}>
            {cell.name}
          </span>
          {cell.quantity !== null ? (
            <span className="shrink-0 tabular-nums" dir="ltr">
              {cell.quantity}
              {cell.status === 'changed' && cell.was != null && renderWas ? (
                <span className="ms-1 text-[11px] opacity-70">{renderWas(cell.was)}</span>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
