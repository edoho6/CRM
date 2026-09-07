'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Lock, Save } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  FieldGrid,
  Input,
  Section,
  Spinner,
  Textarea,
} from '@clinic/ui';
import { toPointPlacement, type BodyView, type TreatmentModality } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { TcmNote } from '@clinic/db/types';
import { useAutosave } from '@/lib/use-autosave';
import { BodyMap, type MappedPoint } from '@/features/reference/body-map';
import { PointsEditor, type PointOption, type PointRow } from './points-editor';
import { saveEncounterNote, signEncounter } from './actions';

/** Everything the body chart needs to draw one catalogued point. */
export interface PointPosition {
  code: string;
  label: string;
  view: BodyView;
  x: number;
  y: number;
  bilateral: boolean;
}

interface NoteState {
  chief_complaint: string;
  history_of_present_illness: string;
  tongue_body_color: string;
  tongue_shape: string;
  tongue_coating: string;
  tongue_notes: string;
  pulse_left: string;
  pulse_right: string;
  pulse_qualities: string;
  pulse_notes: string;
  tcm_pattern_diagnosis: string;
  western_diagnosis: string;
  treatment_principle: string;
  modalities_used: TreatmentModality[];
  points_used: PointRow[];
  treatment_notes: string;
  recommendations: string;
  follow_up_plan: string;
}

function toState(note: TcmNote | null): NoteState {
  return {
    chief_complaint: note?.chief_complaint ?? '',
    history_of_present_illness: note?.history_of_present_illness ?? '',
    tongue_body_color: note?.tongue_body_color ?? '',
    tongue_shape: note?.tongue_shape ?? '',
    tongue_coating: note?.tongue_coating ?? '',
    tongue_notes: note?.tongue_notes ?? '',
    pulse_left: note?.pulse_left ?? '',
    pulse_right: note?.pulse_right ?? '',
    // Stored as an array, edited as a comma-separated line — practitioners write
    // pulse qualities as a phrase, not as separate form fields.
    pulse_qualities: (note?.pulse_qualities ?? []).join(', '),
    pulse_notes: note?.pulse_notes ?? '',
    tcm_pattern_diagnosis: note?.tcm_pattern_diagnosis ?? '',
    western_diagnosis: note?.western_diagnosis ?? '',
    treatment_principle: note?.treatment_principle ?? '',
    modalities_used: note?.modalities_used ?? [],
    points_used: (note?.points_used ?? []).map((point) => ({
      point: point.point,
      point_id: point.point_id ?? null,
      // Two generations of older notes have to keep opening: ones that recorded
      // a `side` and no region, and ones that recorded one of the five flat
      // regions. toPointPlacement handles the second; the side is read first
      // because it is the more specific of the two.
      region: point.region
        ? toPointPlacement(point.region)
        : point.side === 'left'
          ? 'left_upper'
          : point.side === 'right'
            ? 'right_upper'
            : point.side === 'midline'
              ? 'center'
              : 'right_upper',
      technique: point.technique,
      retention_minutes: point.retention_minutes ?? '',
      notes: point.notes ?? '',
    })),
    treatment_notes: note?.treatment_notes ?? '',
    recommendations: note?.recommendations ?? '',
    follow_up_plan: note?.follow_up_plan ?? '',
  };
}

/**
 * The treatment record.
 *
 * The layout follows the order of a consultation rather than the order of the
 * database: the complaint and what you concluded from it fill the main column,
 * while the two things you look at and record at the couch — tongue and pulse —
 * sit in the side column next to the herbs you dispense from those findings.
 *
 * The dispensing panel is passed in rather than imported so this component stays
 * a pure form and the side column can hold anything.
 */
export function EncounterForm({
  encounterId,
  note,
  isSigned,
  pointCatalogue,
  pointPositions,
  dispensePanel,
}: {
  encounterId: string;
  note: TcmNote | null;
  isSigned: boolean;
  /** The whole point catalogue, for instant autocomplete with no round trip. */
  pointCatalogue: PointOption[];
  /** Where each catalogued point sits on the body chart, keyed by point id. */
  pointPositions: Record<string, PointPosition>;
  dispensePanel?: React.ReactNode;
}) {
  const t = useTranslations('encounters');
  const tf = useTranslations('encounters.fields');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();

  const [state, setState] = useState<NoteState>(() => toState(note));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const disabled = isSigned || isPending;

  function set<K extends keyof NoteState>(key: K, value: NoteState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    setStatus('idle');
  }

  function buildPayload() {
    return {
      ...state,
      pulse_qualities: state.pulse_qualities
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      points_used: state.points_used
        .filter((point) => point.point.trim())
        .map((point) => ({
          point: point.point.trim(),
          point_id: point.point_id,
          region: point.region,
          technique: point.technique,
          retention_minutes: point.retention_minutes === '' ? null : point.retention_minutes,
          notes: point.notes || null,
        })),
    };
  }

  /**
   * The dots on the chart, rebuilt from the prescription on every keystroke.
   * Only points chosen from the catalogue have a position; free text is carried
   * in the note but has nowhere to be drawn.
   */
  const mappedPoints: MappedPoint[] = state.points_used.flatMap((row, index) => {
    if (!row.point_id) return [];
    const position = pointPositions[row.point_id];
    if (!position || position.x === null || position.y === null) return [];
    return [
      {
        key: `${row.point_id}:${index}`,
        pointId: row.point_id,
        code: position.code,
        label: position.label,
        view: position.view,
        x: position.x,
        y: position.y,
        bilateral: position.bilateral,
        region: row.region,
      },
    ];
  });

  /*
   * Autosave, every forty-five seconds.
   *
   * A consultation runs for an hour and the note is written throughout it. The
   * loss this guards against is the ordinary one — a closed tab, a sleeping
   * laptop, an expired session — and "remember to press save" is not a control
   * for any of them.
   *
   * It does not call `router.refresh()` the way the manual save does: a refresh
   * mid-sentence re-renders the page under the cursor. The write has happened;
   * the screen catching up can wait for the explicit save or the next load.
   *
   * A signed record is locked by the database, so autosave stops rather than
   * generating a rejected write every forty-five seconds.
   */
  const autosave = useAutosave({
    value: state,
    enabled: !isSigned,
    onSave: async () => {
      const result = await saveEncounterNote(encounterId, buildPayload());
      return result.ok;
    },
  });

  function handleSave() {
    setStatus('idle');
    setErrorKey(null);
    startTransition(async () => {
      const result = await saveEncounterNote(encounterId, buildPayload());
      if (!result.ok) {
        setErrorKey(result.error.key);
        setStatus('error');
        return;
      }
      setStatus('saved');
      // Tell the autosave this value is on disk, so it does not immediately
      // write the same thing again.
      autosave.markSaved();
      router.refresh();
    });
  }

  function handleSign() {
    if (!window.confirm(t('signConfirmBody'))) return;
    setErrorKey(null);
    startTransition(async () => {
      // Save first: signing locks the record, so anything unsaved would be lost.
      const saveResult = await saveEncounterNote(encounterId, buildPayload());
      if (!saveResult.ok) {
        setErrorKey(saveResult.error.key);
        setStatus('error');
        return;
      }
      const result = await signEncounter(encounterId);
      if (!result.ok) {
        setErrorKey(result.error.key);
        setStatus('error');
        return;
      }
      router.refresh();
    });
  }

  /*
   * Tongue and pulse, two headings instead of eight stacked rows.
   *
   * These sit in the narrow column beside the note, and one label per line ran
   * the panel far below the fold — which meant scrolling away from the thing
   * being written in order to record the thing just observed. Each group now has
   * one heading and its fields side by side, with the labels above them small
   * and quiet. The fields themselves are unchanged; only the furniture is gone.
   */
  const examinationCard = (
    <Card>
      <CardBody>
        <Section title={t('sections.examination')}>
          <div className="space-y-4">
            <div>
              <h4 className="mb-1.5 text-sm font-semibold text-ink-900">{tf('tongue')}</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <Field label={tf('tongueColorShort')} htmlFor="tongue_body_color" density="compact">
                  <Input
                    id="tongue_body_color"
                    disabled={disabled}
                    value={state.tongue_body_color}
                    onChange={(event) => set('tongue_body_color', event.target.value)}
                  />
                </Field>
                <Field label={tf('tongueShapeShort')} htmlFor="tongue_shape" density="compact">
                  <Input
                    id="tongue_shape"
                    disabled={disabled}
                    value={state.tongue_shape}
                    onChange={(event) => set('tongue_shape', event.target.value)}
                  />
                </Field>
                <Field label={tf('tongueCoatingShort')} htmlFor="tongue_coating" density="compact">
                  <Input
                    id="tongue_coating"
                    disabled={disabled}
                    value={state.tongue_coating}
                    onChange={(event) => set('tongue_coating', event.target.value)}
                  />
                </Field>
              </div>
              <Textarea
                id="tongue_notes"
                rows={2}
                className="mt-1.5"
                aria-label={tf('tongueNotes')}
                placeholder={tf('tongueNotes')}
                disabled={disabled}
                value={state.tongue_notes}
                onChange={(event) => set('tongue_notes', event.target.value)}
              />
            </div>

            <div className="border-t border-ink-100 pt-3">
              <h4 className="mb-1.5 text-sm font-semibold text-ink-900">{tf('pulse')}</h4>
              {/* Qualities used to be a third field. They are written into the
                  same phrase as the sides in practice — "left wiry, right thin"
                  — so the row that asked for them separately is gone and the
                  column is still stored for notes that have one. */}
              <div className="grid grid-cols-2 gap-1.5">
                <Field label={tf('pulseRightShort')} htmlFor="pulse_right" density="compact">
                  <Input
                    id="pulse_right"
                    disabled={disabled}
                    value={state.pulse_right}
                    onChange={(event) => set('pulse_right', event.target.value)}
                  />
                </Field>
                <Field label={tf('pulseLeftShort')} htmlFor="pulse_left" density="compact">
                  <Input
                    id="pulse_left"
                    disabled={disabled}
                    value={state.pulse_left}
                    onChange={(event) => set('pulse_left', event.target.value)}
                  />
                </Field>
              </div>
              <Textarea
                id="pulse_notes"
                rows={2}
                className="mt-1.5"
                aria-label={tf('pulseNotes')}
                placeholder={tf('pulseNotes')}
                disabled={disabled}
                value={state.pulse_notes}
                onChange={(event) => set('pulse_notes', event.target.value)}
              />
            </div>
          </div>
        </Section>
      </CardBody>
    </Card>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {isSigned ? <Alert tone="info" title={t('lockedNotice')} /> : null}
        {status === 'saved' ? <Alert tone="success">{tc('saved')}</Alert> : null}
        {status === 'error' ? (
          <Alert tone="danger">
            {errorKey === 'errors.encounterLocked'
              ? tErrors('encounterLocked')
              : tc('errorGeneric')}
          </Alert>
        ) : null}

        <Card>
          <CardBody className="space-y-6">
            <Section title={t('sections.complaint')}>
              <div className="space-y-4">
                <Field label={tf('chiefComplaint')} htmlFor="chief_complaint">
                  <Textarea
                    id="chief_complaint"
                    rows={2}
                    disabled={disabled}
                    value={state.chief_complaint}
                    onChange={(event) => set('chief_complaint', event.target.value)}
                  />
                </Field>
                <Field label={tf('historyOfPresentIllness')} htmlFor="history_of_present_illness">
                  <Textarea
                    id="history_of_present_illness"
                    rows={3}
                    disabled={disabled}
                    value={state.history_of_present_illness}
                    onChange={(event) => set('history_of_present_illness', event.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section title={t('sections.differentiation')}>
              <div className="space-y-4">
                <Field label={tf('tcmPatternDiagnosis')} htmlFor="tcm_pattern_diagnosis">
                  <Textarea
                    id="tcm_pattern_diagnosis"
                    rows={2}
                    disabled={disabled}
                    value={state.tcm_pattern_diagnosis}
                    onChange={(event) => set('tcm_pattern_diagnosis', event.target.value)}
                  />
                </Field>
                <FieldGrid>
                  <Field label={tf('westernDiagnosis')} htmlFor="western_diagnosis">
                    <Textarea
                      id="western_diagnosis"
                      rows={2}
                      disabled={disabled}
                      value={state.western_diagnosis}
                      onChange={(event) => set('western_diagnosis', event.target.value)}
                    />
                  </Field>
                  <Field label={tf('treatmentPrinciple')} htmlFor="treatment_principle">
                    <Textarea
                      id="treatment_principle"
                      rows={2}
                      disabled={disabled}
                      value={state.treatment_principle}
                      onChange={(event) => set('treatment_principle', event.target.value)}
                    />
                  </Field>
                </FieldGrid>
              </div>
            </Section>

            <Section title={t('sections.treatment')}>
              {/* The nine modality checkboxes that used to open this section are
                gone. They were nine clicks describing what the points and the
                notes below already say, and the column they occupied is worth
                more to the point grid. `modalities_used` is still stored and
                still carried through a save, so older notes keep theirs. */}
              <div className="space-y-4">
                <Field label={tf('pointsUsed')} hint={t('points.hint')}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                    <PointsEditor
                      value={state.points_used}
                      catalogue={pointCatalogue}
                      disabled={disabled}
                      onChange={(rows) => set('points_used', rows)}
                    />
                    {/* The chart is a mirror of the list, not a second input: it
                      reflects what has been chosen so a gap in the prescription
                      is visible rather than deduced. */}
                    <BodyMap
                      points={mappedPoints}
                      onSelect={(point) => router.push(`/reference/points/${point.pointId}`)}
                    />
                  </div>
                </Field>

                <Field label={tf('treatmentNotes')} htmlFor="treatment_notes">
                  <Textarea
                    id="treatment_notes"
                    rows={3}
                    disabled={disabled}
                    value={state.treatment_notes}
                    onChange={(event) => set('treatment_notes', event.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section title={t('sections.followUp')}>
              <FieldGrid>
                <Field label={tf('recommendations')} htmlFor="recommendations">
                  <Textarea
                    id="recommendations"
                    rows={3}
                    disabled={disabled}
                    value={state.recommendations}
                    onChange={(event) => set('recommendations', event.target.value)}
                  />
                </Field>
                <Field label={tf('followUpPlan')} htmlFor="follow_up_plan">
                  <Textarea
                    id="follow_up_plan"
                    rows={3}
                    disabled={disabled}
                    value={state.follow_up_plan}
                    onChange={(event) => set('follow_up_plan', event.target.value)}
                  />
                </Field>
              </FieldGrid>
            </Section>
          </CardBody>
        </Card>

        {!isSigned ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* What the autosave is doing, stated rather than assumed. A form that
              saves itself silently is indistinguishable from one that does not,
              and the whole reassurance is in being able to see the last time. */}
            <p className="me-auto text-xs text-ink-600" role="status" aria-live="polite">
              {autosave.state === 'saving'
                ? tc('saving')
                : autosave.state === 'error'
                  ? t('autosaveFailed')
                  : autosave.lastSavedAt
                    ? t('autosavedAt', {
                        time: format.dateTime(autosave.lastSavedAt, 'time'),
                      })
                    : t('autosaveOn')}
            </p>
            <Button variant="secondary" onClick={handleSave} disabled={isPending}>
              {isPending ? <Spinner /> : <Save className="h-4 w-4" />}
              {isPending ? tc('saving') : tc('save')}
            </Button>
            <Button onClick={handleSign} disabled={isPending}>
              <Lock className="h-4 w-4" />
              {t('sign')}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Side column: what you observe at the couch, and what you hand over
          because of it. */}
      <div className="space-y-4">
        {examinationCard}
        {dispensePanel}
      </div>
    </div>
  );
}
