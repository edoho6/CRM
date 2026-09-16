'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowLeftRight, History, Minus, Plus } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Select } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import type { RecordedPoint } from '@clinic/db/types';
import { formatDate } from '@clinic/i18n';
import { ReferenceChip } from '@/features/reference/reference-sheet';
import type {
  CurrentPrescription,
  PrescriptionLine,
  PrescriptionMeta,
} from './current-prescription-context';
import {
  compareHerbs,
  comparePoints,
  type CurrentPoint,
  type HerbCell,
  type Placement,
  type PointCell,
  type Status,
} from './encounter-diff';

/**
 * Earlier treatments beside this one — head to head, and live.
 *
 * Two columns: the treatment being compared against, and the one being written.
 * Points on top, herbs underneath, and every entry coloured by what happened to
 * it: amber on the earlier side for a point or herb that is gone, green on the
 * current side for one that is new, amber on the current side for a herb whose
 * dose changed. The current column follows the form as it is typed — and
 * follows the dispensing panel as a formula is picked or a herb line filled in,
 * before anything is saved. Each side prints its own dose and only its own: a
 * column headed "now" that also carries last time's figure beside it reads as
 * two numbers for one line, and which is which is a guess.
 *
 * Beside the columns, a second reading of the same data: **what changed** — a
 * short list of what was added, what was dropped, and which doses moved, each
 * with a sign of its own. The columns answer "what did I give"; this answers
 * "what am I doing differently", which is the question asked while deciding.
 * One button switches between them and nothing else moves.
 *
 * Under each formula: how it was taken — the form it came in, the total, and
 * the dose — because "what did I give last time" is answered by the herbs and
 * by the amount, and the amount used to be a dialog away. The divided dose
 * leads ("3 גרם פעמיים ביום") and the day's total follows it in brackets: the
 * first is what the patient is told, the second is what it comes to.
 *
 * Every point, herb and formula is a chip that opens its card over the page.
 *
 * Colour is never the only signal: the legend at the foot says in words what
 * each colour means, and the change list carries a +, a − or a two-way arrow
 * beside every line as well as a heading in words.
 */

export interface PreviousEncounter {
  id: string;
  date: string;
  points: RecordedPoint[];
  formula: string | null;
  formulaId?: string | null;
  herbs: PrescriptionLine[];
  meta?: PrescriptionMeta | null;
}

/**
 * One tint per matched pair, on both sides, so the eye finds the same point
 * or herb across the two columns without reading every label. Mixed from the
 * hue over the card at a fifth, so the text on top keeps its contrast in
 * both themes; the pairs wrap around after eight.
 */
// Plain values, not theme variables: the default palette's variables are
// only emitted when a utility uses them, and none does here.
const PAIR_HUES = [
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#14b8a6',
  '#f43f5e',
  '#84cc16',
  '#d946ef',
  '#f97316',
];

function pairStyle(pair: number | undefined): React.CSSProperties | undefined {
  if (pair === undefined) return undefined;
  const hue = PAIR_HUES[pair % PAIR_HUES.length];
  return {
    backgroundColor: `color-mix(in srgb, ${hue} 22%, transparent)`,
    borderColor: `color-mix(in srgb, ${hue} 60%, transparent)`,
  };
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
  // Which reading is on screen. The columns are the default because they are
  // the whole picture; the change list is the follow-up question.
  const [showChanges, setShowChanges] = useState(false);

  const selected = previous.find((entry) => entry.id === selectedId) ?? previous[0] ?? null;

  // The comparison itself is in `encounter-diff.ts`, with tests: which point
  // and which herb counts as the same one across two visits is a clinical
  // decision, not a rendering detail.
  const points = useMemo(
    () => (selected ? comparePoints(selected.points, currentPoints) : null),
    [selected, currentPoints],
  );

  const herbs = useMemo(
    () => (selected ? compareHerbs(selected.herbs, currentPrescription?.herbs ?? []) : null),
    [selected, currentPrescription],
  );

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

  const formulaChanged = (selected?.formula ?? null) !== (currentPrescription?.formula ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4 text-ink-600" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
        {/* One control, two readings of the same two treatments. `aria-pressed`
            rather than two buttons: it is a switch, and a screen reader should
            hear which way it is set rather than guess from the label. */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={showChanges}
          onClick={() => setShowChanges((current) => !current)}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          {showChanges ? t('showColumns') : t('showChanges')}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {previous.length > 1 ? (
          <Select
            aria-label={t('chooseTreatment')}
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
            compact
            className="text-xs"
          >
            {previous.map((entry, index) => (
              <option key={entry.id} value={entry.id}>
                {index === 0 ? `${t('mostRecent')} · ` : ''}
                {formatDate(entry.date)}
              </option>
            ))}
          </Select>
        ) : null}

        {selected && points && herbs && showChanges ? (
          <ChangeList
            points={points.now}
            droppedPoints={points.before}
            herbs={herbs.now}
            droppedHerbs={herbs.before}
            previousFormula={selected.formula}
            previousFormulaId={selected.formulaId ?? null}
            currentFormula={currentPrescription?.formula ?? null}
            currentFormulaId={currentPrescription?.formulaId ?? null}
            regionLabel={(placement) => tRegion(placement)}
          />
        ) : null}

        {selected && points && herbs && !showChanges ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {/* Column heads. Reading order is earlier → now, which is the
                start column → end column in either script. */}
            <ColumnHead label={t('previous')} detail={formatDate(selected.date)} />
            <ColumnHead
              label={t('current')}
              detail={currentPrescription?.draft ? <Badge tone="muted">{t('draft')}</Badge> : null}
            />

            <RowLabel>{t('points')}</RowLabel>
            <PointList cells={points.before} regionLabel={(p) => tRegion(p)} empty={t('none')} />
            <PointList cells={points.now} regionLabel={(p) => tRegion(p)} empty={t('none')} />

            <RowLabel>{t('herbs')}</RowLabel>
            <div className="min-w-0 space-y-1">
              <FormulaLine
                name={selected.formula}
                formulaId={selected.formulaId ?? null}
                changed={false}
                empty={t('none')}
              />
              <MetaLines meta={selected.meta ?? null} />
              <HerbList cells={herbs.before} />
            </div>
            <div className="min-w-0 space-y-1">
              <FormulaLine
                name={currentPrescription?.formula ?? null}
                formulaId={currentPrescription?.formulaId ?? null}
                changed={formulaChanged}
                empty={t('none')}
              />
              <MetaLines meta={currentPrescription?.meta ?? null} />
              <HerbList cells={herbs.now} />
            </div>
          </div>
        ) : null}

        {showChanges ? null : (
          <p className="border-t border-ink-100 pt-2 text-xs text-ink-600">{t('legend')}</p>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * What changed, and nothing else.
 *
 * The same two treatments the columns show, read as a difference: what was
 * added, what was dropped, and which doses moved. Everything carried over
 * unchanged is left out on purpose — it is the part that needs no decision,
 * and it is most of the list.
 *
 * Three signs, never colour alone: a plus for an addition, a minus for
 * something dropped, a two-way arrow for a dose that moved, each under a
 * heading that says the same thing in words. A changed dose is spelled out
 * with words between the two figures ("from 9 to 6") rather than an arrow
 * between them — two bare numbers either side of a neutral glyph swap places
 * in a Hebrew line, and the reader cannot tell which one is now.
 */
function ChangeList({
  points,
  droppedPoints,
  herbs,
  droppedHerbs,
  previousFormula,
  previousFormulaId,
  currentFormula,
  currentFormulaId,
  regionLabel,
}: {
  /** The current side, already marked added / kept / changed. */
  points: PointCell[];
  /** The earlier side, where anything still marked `dropped` is gone. */
  droppedPoints: PointCell[];
  herbs: HerbCell[];
  droppedHerbs: HerbCell[];
  previousFormula: string | null;
  previousFormulaId: string | null;
  currentFormula: string | null;
  currentFormulaId: string | null;
  regionLabel: (placement: Placement) => string;
}) {
  const t = useTranslations('encounters.compare');
  const format = useFormatter();

  const addedPoints = points.filter((cell) => cell.status === 'added');
  const removedPoints = droppedPoints.filter((cell) => cell.status === 'dropped');
  const addedHerbs = herbs.filter((cell) => cell.status === 'added');
  const removedHerbs = droppedHerbs.filter((cell) => cell.status === 'dropped');
  const changedHerbs = herbs.filter((cell) => cell.status === 'changed');
  const formulaChanged = (previousFormula ?? null) !== (currentFormula ?? null);

  const nothing =
    !formulaChanged &&
    addedPoints.length === 0 &&
    removedPoints.length === 0 &&
    addedHerbs.length === 0 &&
    removedHerbs.length === 0 &&
    changedHerbs.length === 0;

  if (nothing) return <p className="py-2 text-sm text-ink-600">{t('noChanges')}</p>;

  return (
    <div className="space-y-3 text-sm">
      {formulaChanged ? (
        <ChangeGroup sign="changed" label={t('formulaChanged')}>
          {previousFormula ? (
            <ChangeRow sign="removed">
              <ReferenceChip
                target={{
                  kind: 'formula',
                  id: previousFormulaId,
                  name: previousFormula,
                  label: previousFormula,
                }}
                dir="auto"
              >
                {previousFormula}
              </ReferenceChip>
            </ChangeRow>
          ) : null}
          {currentFormula ? (
            <ChangeRow sign="added">
              <ReferenceChip
                target={{
                  kind: 'formula',
                  id: currentFormulaId,
                  name: currentFormula,
                  label: currentFormula,
                }}
                dir="auto"
              >
                {currentFormula}
              </ReferenceChip>
            </ChangeRow>
          ) : null}
        </ChangeGroup>
      ) : null}

      {addedPoints.length > 0 || addedHerbs.length > 0 ? (
        <ChangeGroup sign="added" label={t('added')}>
          {addedPoints.map((cell) => (
            <ChangeRow key={`p:${cell.key}`} sign="added">
              <ReferenceChip
                target={{ kind: 'point', code: cell.code, label: cell.code }}
                dir="ltr"
                className="tabular-nums"
              >
                {cell.code}
              </ReferenceChip>
              <span className="text-xs text-ink-600">{regionLabel(cell.placement)}</span>
            </ChangeRow>
          ))}
          {addedHerbs.map((cell) => (
            <ChangeRow key={`h:${cell.key}`} sign="added" amount={cell.quantity} format={format}>
              <ReferenceChip
                target={{
                  kind: 'herb',
                  id: cell.herbId ?? null,
                  pinyin: cell.key,
                  name: cell.name,
                  label: cell.name,
                }}
                dir="auto"
                className="min-w-0 truncate"
              >
                {cell.name}
              </ReferenceChip>
            </ChangeRow>
          ))}
        </ChangeGroup>
      ) : null}

      {removedPoints.length > 0 || removedHerbs.length > 0 ? (
        <ChangeGroup sign="removed" label={t('removed')}>
          {removedPoints.map((cell) => (
            <ChangeRow key={`p:${cell.key}`} sign="removed">
              <ReferenceChip
                target={{ kind: 'point', code: cell.code, label: cell.code }}
                dir="ltr"
                className="tabular-nums"
              >
                {cell.code}
              </ReferenceChip>
              <span className="text-xs text-ink-600">{regionLabel(cell.placement)}</span>
            </ChangeRow>
          ))}
          {removedHerbs.map((cell) => (
            <ChangeRow key={`h:${cell.key}`} sign="removed" amount={cell.quantity} format={format}>
              <ReferenceChip
                target={{
                  kind: 'herb',
                  id: cell.herbId ?? null,
                  pinyin: cell.key,
                  name: cell.name,
                  label: cell.name,
                }}
                dir="auto"
                className="min-w-0 truncate"
              >
                {cell.name}
              </ReferenceChip>
            </ChangeRow>
          ))}
        </ChangeGroup>
      ) : null}

      {changedHerbs.length > 0 ? (
        <ChangeGroup sign="changed" label={t('doseChanged')}>
          {changedHerbs.map((cell) => (
            <ChangeRow key={`h:${cell.key}`} sign="changed">
              <ReferenceChip
                target={{
                  kind: 'herb',
                  id: cell.herbId ?? null,
                  pinyin: cell.key,
                  name: cell.name,
                  label: cell.name,
                }}
                dir="auto"
                className="min-w-0 truncate"
              >
                {cell.name}
              </ReferenceChip>
              <span className="shrink-0 text-xs font-medium text-ink-900">
                {t('doseFromTo', {
                  from: format.number(cell.was ?? 0),
                  to: format.number(cell.quantity ?? 0),
                })}
              </span>
            </ChangeRow>
          ))}
        </ChangeGroup>
      ) : null}
    </div>
  );
}

type ChangeSign = 'added' | 'removed' | 'changed';

const CHANGE_ICONS: Record<ChangeSign, typeof Plus> = {
  added: Plus,
  removed: Minus,
  changed: ArrowLeftRight,
};

const CHANGE_CLASSES: Record<ChangeSign, string> = {
  added: 'text-jade-800',
  removed: 'text-amber-800',
  changed: 'text-amber-800',
};

function ChangeGroup({
  sign,
  label,
  children,
}: {
  sign: ChangeSign;
  label: string;
  children: React.ReactNode;
}) {
  const Icon = CHANGE_ICONS[sign];
  return (
    <section>
      <h3
        className={cn('mb-1 flex items-center gap-1 text-xs font-semibold', CHANGE_CLASSES[sign])}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </h3>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function ChangeRow({
  sign,
  amount,
  format,
  children,
}: {
  sign: ChangeSign;
  /** Printed at the end of the row when the line carries one. */
  amount?: number | null;
  format?: ReturnType<typeof useFormatter>;
  children: React.ReactNode;
}) {
  const Icon = CHANGE_ICONS[sign];
  return (
    <li className="flex items-baseline gap-1.5 text-xs">
      {/* The sign repeats on every row, not just on the heading: a list read
          one line at a time — by a screen reader, or by an eye that landed in
          the middle of it — has no heading in view. */}
      <Icon className={cn('h-3 w-3 shrink-0 self-center', CHANGE_CLASSES[sign])} aria-hidden />
      {children}
      {amount != null && format ? (
        <span className="ms-auto shrink-0 tabular-nums text-ink-700">{format.number(amount)}</span>
      ) : null}
    </li>
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
          style={pairStyle(cell.pair)}
          className={cn(
            'inline-flex items-baseline gap-1 rounded border px-1.5 py-0.5 text-xs',
            cell.pair === undefined ? STATUS_CLASSES[cell.status] : 'text-ink-900',
          )}
        >
          <ReferenceChip
            target={{ kind: 'point', code: cell.code, label: cell.code }}
            dir="ltr"
            className="tabular-nums"
          >
            {cell.code}
          </ReferenceChip>
          <span className="text-xs text-ink-600">{regionLabel(cell.placement)}</span>
        </li>
      ))}
    </ul>
  );
}

function FormulaLine({
  name,
  formulaId,
  changed,
  empty,
}: {
  name: string | null;
  formulaId: string | null;
  changed: boolean;
  empty: string;
}) {
  if (!name) return <p className="text-xs text-ink-500">{empty}</p>;
  return (
    // The heading of its column, and sized like one. It was the same `text-xs`
    // as every herb under it, so the name of the prescription read as one more
    // line of the list rather than as what the list is.
    <p
      className={cn(
        'truncate rounded border px-1.5 py-1 text-sm font-semibold',
        changed ? STATUS_CLASSES.added : STATUS_CLASSES.kept,
      )}
      dir="auto"
      title={name}
    >
      <ReferenceChip target={{ kind: 'formula', id: formulaId, name, label: name }} dir="auto">
        {name}
      </ReferenceChip>
    </p>
  );
}

/**
 * The form, the total and the dose, under the formula. Nothing is printed for
 * a figure that was never recorded — a dash would look like a dose of nothing.
 *
 * The two figures that get asked about are the total and how it is taken, so
 * both are set in the card's own weight rather than in the footnote grey the
 * whole block used to be.
 *
 * The divided dose leads and the day's total follows it in brackets — "3 גרם
 * פעמיים ביום (סה״כ 6 גרם ליום)". That is the order the instruction is given
 * in and the order the patient hears it; the day's total is the arithmetic,
 * and putting the arithmetic first made the two figures on the line look like
 * one muddled sum.
 */
function MetaLines({ meta }: { meta: PrescriptionMeta | null }) {
  const t = useTranslations('inventory.dispensing');
  const tPrep = useTranslations('inventory.preparation');
  const tUnit = useTranslations('inventory.unit');
  const format = useFormatter();
  if (!meta) return null;
  const unit = meta.unit ?? meta.doseUnit ?? 'gram';
  const daily =
    meta.doseAmount && meta.dosesPerDay
      ? Math.round(meta.doseAmount * meta.dosesPerDay * 100) / 100
      : null;
  const hasAnything = meta.preparation || meta.total || daily || meta.doseAmount;
  if (!hasAnything) return null;
  return (
    <div className="space-y-0.5 px-1 text-xs text-ink-700">
      <p className="flex flex-wrap items-baseline gap-x-2">
        {meta.preparation ? (
          <span className="font-medium text-ink-900">{tPrep(meta.preparation as never)}</span>
        ) : null}
        {meta.total ? (
          <span className="text-sm font-semibold text-ink-900">
            {t('totalShort')}{' '}
            <span className="tabular-nums">
              {format.number(meta.total)} {tUnit(unit as never)}
            </span>
          </span>
        ) : null}
      </p>
      {daily && meta.doseAmount ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-ink-900">
            <span className="tabular-nums">
              {format.number(meta.doseAmount)} {tUnit((meta.doseUnit ?? unit) as never)}
            </span>{' '}
            {t('perDay', { count: meta.dosesPerDay ?? 0 })}
          </span>
          <span className="text-ink-600">
            ({t('totalShort')}{' '}
            <span className="tabular-nums">
              {format.number(daily)} {tUnit((meta.doseUnit ?? unit) as never)}
            </span>{' '}
            {t('perDaySuffix')})
          </span>
          {meta.doseTiming ? (
            <span className="text-ink-600">{t(`timing.${meta.doseTiming}` as never)}</span>
          ) : null}
        </p>
      ) : meta.doseAmount ? (
        <p className="text-ink-600">
          <span className="text-sm font-semibold text-ink-900 tabular-nums">
            {format.number(meta.doseAmount)} {tUnit((meta.doseUnit ?? unit) as never)}
          </span>{' '}
          {t('perDose')}
          {meta.doseTiming ? ` · ${t(`timing.${meta.doseTiming}` as never)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One column's herbs and their doses.
 *
 * Each side prints its own figure only. The current column used to append the
 * earlier dose to a changed line ("16" then "was 9"), which put two numbers on
 * one row of a column headed "now" — and in a Hebrew line the pair reads as one
 * run, so it came out as "was 9 16". What moved is answered by the change list,
 * where the two figures have words between them.
 */
function HerbList({ cells }: { cells: HerbCell[] }) {
  if (cells.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {cells.map((cell) => (
        <li
          key={cell.key}
          style={pairStyle(cell.pair)}
          className={cn(
            'flex items-baseline justify-between gap-2 rounded border px-1.5 py-0.5 text-xs',
            cell.pair === undefined ? STATUS_CLASSES[cell.status] : 'text-ink-900',
          )}
        >
          <ReferenceChip
            target={{
              kind: 'herb',
              id: cell.herbId ?? null,
              pinyin: cell.key,
              name: cell.name,
              label: cell.name,
            }}
            dir="auto"
            className="min-w-0 truncate"
          >
            {cell.name}
          </ReferenceChip>
          {cell.quantity !== null ? (
            <span className="shrink-0 tabular-nums">{cell.quantity}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
