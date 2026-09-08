'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, Select } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import type { RecordedPoint } from '@clinic/db/types';
import { formatDate } from '@clinic/i18n';

/**
 * The last time you treated this patient, beside what you are writing now.
 *
 * The question a practitioner actually asks mid-treatment is not "what happened
 * on the fourteenth of March" but "what did I do last time, and is it working" —
 * and answering it today means leaving the record, opening a previous one, and
 * remembering what you saw. This puts the answer next to the field.
 *
 * What is compared is what changes between visits: the pattern, the principle,
 * the points, and the prescription. Not the complaint, which is the same
 * complaint, and not the whole note — a wall of prose beside the note being
 * written is a second thing to read rather than an answer.
 *
 * Points are diffed because that is the comparison that is genuinely hard to do
 * by eye: eight codes against eight codes, and the two that changed are the
 * entire clinical content of the difference.
 */

export interface PreviousEncounter {
  id: string;
  date: string;
  patternDiagnosis: string | null;
  treatmentPrinciple: string | null;
  points: RecordedPoint[];
  /** The formula or the herb list, already rendered to a line of text. */
  prescription: string | null;
  /** What the patient said they came with. */
  chiefComplaint: string | null;
  treatmentNotes: string | null;
}

export function EncounterCompare({
  previous,
  currentPoints,
}: {
  /** Earlier treatments of the same patient, newest first. */
  previous: PreviousEncounter[];
  /** The points in the record being written, so the diff is live. */
  currentPoints: string[];
}) {
  const t = useTranslations('encounters.compare');
  const [selectedId, setSelectedId] = useState('');

  const selected = previous.find((entry) => entry.id === selectedId) ?? previous[0] ?? null;

  const diff = useMemo(() => {
    if (!selected) return null;

    // Compared case-insensitively on the trimmed code: "LI4" and "li4 " are the
    // same point, and a diff that says otherwise is noise.
    const normalise = (value: string) => value.trim().toLowerCase();
    const before = new Map(selected.points.map((point) => [normalise(point.point), point.point]));
    const now = new Map(currentPoints.map((point) => [normalise(point), point]));

    const kept: string[] = [];
    const dropped: string[] = [];
    const added: string[] = [];

    for (const [key, label] of before) {
      if (now.has(key)) kept.push(label);
      else dropped.push(label);
    }
    for (const [key, label] of now) {
      if (!before.has(key)) added.push(label);
    }

    return { kept, dropped, added };
  }, [selected, currentPoints]);

  if (previous.length === 0) return null;

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
          >
            {previous.map((entry, index) => (
              <option key={entry.id} value={entry.id}>
                {index === 0 ? `${t('mostRecent')} · ` : ''}
                {new Date(entry.date).toLocaleDateString()}
              </option>
            ))}
          </Select>
        ) : null}

        {selected ? (
          <>
            <p className="text-xs text-ink-600" dir="ltr">
              {formatDate(new Date(selected.date))}
            </p>

            {/* Every point of that treatment, before the comparison.
                The diff below answers "what did I change"; this answers "what
                did I do", and the second question is the one asked first. */}
            {selected.points.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-xs font-medium text-ink-700">{t('pointsUsed')}</span>
                {selected.points.map((point, index) => (
                  <span
                    key={`${point.point}:${index}`}
                    dir="ltr"
                    className="rounded border border-ink-200 bg-white px-1.5 py-0.5 text-xs tabular-nums text-ink-800"
                  >
                    {point.point}
                  </span>
                ))}
              </div>
            ) : null}

            {/* The point diff. Each group is labelled in words as well as
                coloured — a red chip and a green chip are the same chip to a
                colourblind reader. */}
            {diff && (diff.kept.length > 0 || diff.dropped.length > 0 || diff.added.length > 0) ? (
              <div className="space-y-2">
                <PointGroup
                  label={t('pointsKept')}
                  points={diff.kept}
                  className="border-ink-200 bg-ink-50 text-ink-800"
                />
                <PointGroup
                  label={t('pointsDropped')}
                  points={diff.dropped}
                  className="border-amber-200 bg-amber-50 text-amber-900"
                />
                <PointGroup
                  label={t('pointsAdded')}
                  points={diff.added}
                  className="border-jade-200 bg-jade-50 text-jade-900"
                />
              </div>
            ) : null}

            <dl className="space-y-2 border-t border-ink-100 pt-3 text-sm">
              <CompareRow label={t('pattern')} value={selected.patternDiagnosis} />
              <CompareRow label={t('principle')} value={selected.treatmentPrinciple} />
              <CompareRow label={t('prescription')} value={selected.prescription} />
              <CompareRow label={t('complaint')} value={selected.chiefComplaint} summarise />
              <CompareRow label={t('notes')} value={selected.treatmentNotes} summarise />
            </dl>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function PointGroup({
  label,
  points,
  className,
}: {
  label: string;
  points: string[];
  className: string;
}) {
  // An empty group is not shown at all: "nothing was dropped" is said better by
  // the absence of a "dropped" row than by an empty one.
  if (points.length === 0) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="text-xs font-medium text-ink-700">{label}</span>
      {points.map((point) => (
        <span
          key={point}
          dir="ltr"
          className={cn('rounded border px-1.5 py-0.5 text-xs tabular-nums', className)}
        >
          {point}
        </span>
      ))}
    </div>
  );
}

/**
 * One line of the comparison.
 *
 * `summarise` clamps the prose to three lines with a control to open it. The
 * narrative fields run to paragraphs, and this panel sits in a narrow side
 * column beside the note being written — printed in full, one previous treatment
 * pushed the rest of the comparison off the screen, which is the opposite of
 * what it is for. Clamped, the shape of the visit is readable at a glance and
 * the whole of it is one click away.
 */
function CompareRow({
  label,
  value,
  summarise = false,
}: {
  label: string;
  value: string | null;
  summarise?: boolean;
}) {
  const t = useTranslations('encounters.compare');
  const [expanded, setExpanded] = useState(false);

  const text = value?.trim() ?? '';
  // Roughly what fits in three clamped lines here. Below it there is nothing to
  // expand and the control would be a button that does nothing visible.
  const isLong = summarise && text.length > 180;

  return (
    <div>
      <dt className="text-xs font-medium text-ink-600">{label}</dt>
      {/* A dash, not an empty line: nothing recorded is a fact worth seeing. */}
      <dd
        className={cn(
          'whitespace-pre-line text-ink-800',
          isLong && !expanded && 'line-clamp-3',
        )}
        dir="auto"
      >
        {text || '—'}
      </dd>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="mt-0.5 rounded text-xs font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-700"
        >
          {expanded ? t('showLess') : t('showMore')}
        </button>
      ) : null}
    </div>
  );
}
