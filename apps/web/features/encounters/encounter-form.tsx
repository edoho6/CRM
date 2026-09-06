'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Save } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldGrid,
  Input,
  Section,
  Spinner,
  Textarea,
} from '@clinic/ui';
import { TREATMENT_MODALITIES, type BodyView, type TreatmentModality } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { TcmNote } from '@clinic/db/types';
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
      // Notes written before regions existed carry a side instead; left and
      // right map across cleanly, and anything else starts in the upper bucket
      // where the practitioner can move it.
      region:
        point.region ??
        (point.side === 'left' || point.side === 'right'
          ? point.side
          : point.side === 'midline'
            ? 'center'
            : 'upper'),
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
  const tModality = useTranslations('encounters.modalities');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
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

  function toggleModality(modality: TreatmentModality) {
    set(
      'modalities_used',
      state.modalities_used.includes(modality)
        ? state.modalities_used.filter((entry) => entry !== modality)
        : [...state.modalities_used, modality],
    );
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

  const examinationCard = (
    <Card>
      <CardBody>
        <Section title={t('sections.examination')}>
          <div className="space-y-4">
            <Field label={tf('tongueBodyColor')} htmlFor="tongue_body_color">
              <Input
                id="tongue_body_color"
                disabled={disabled}
                value={state.tongue_body_color}
                onChange={(event) => set('tongue_body_color', event.target.value)}
              />
            </Field>
            <Field label={tf('tongueShape')} htmlFor="tongue_shape">
              <Input
                id="tongue_shape"
                disabled={disabled}
                value={state.tongue_shape}
                onChange={(event) => set('tongue_shape', event.target.value)}
              />
            </Field>
            <Field label={tf('tongueCoating')} htmlFor="tongue_coating">
              <Input
                id="tongue_coating"
                disabled={disabled}
                value={state.tongue_coating}
                onChange={(event) => set('tongue_coating', event.target.value)}
              />
            </Field>
            <Field label={tf('tongueNotes')} htmlFor="tongue_notes">
              <Textarea
                id="tongue_notes"
                rows={2}
                disabled={disabled}
                value={state.tongue_notes}
                onChange={(event) => set('tongue_notes', event.target.value)}
              />
            </Field>

            <div className="border-t border-ink-100 pt-4">
              <Field label={tf('pulseLeft')} htmlFor="pulse_left">
                <Input
                  id="pulse_left"
                  disabled={disabled}
                  value={state.pulse_left}
                  onChange={(event) => set('pulse_left', event.target.value)}
                />
              </Field>
            </div>
            <Field label={tf('pulseRight')} htmlFor="pulse_right">
              <Input
                id="pulse_right"
                disabled={disabled}
                value={state.pulse_right}
                onChange={(event) => set('pulse_right', event.target.value)}
              />
            </Field>
            <Field label={tf('pulseQualities')} htmlFor="pulse_qualities" hint="wiry, thready">
              <Input
                id="pulse_qualities"
                disabled={disabled}
                value={state.pulse_qualities}
                onChange={(event) => set('pulse_qualities', event.target.value)}
              />
            </Field>
            <Field label={tf('pulseNotes')} htmlFor="pulse_notes">
              <Textarea
                id="pulse_notes"
                rows={2}
                disabled={disabled}
                value={state.pulse_notes}
                onChange={(event) => set('pulse_notes', event.target.value)}
              />
            </Field>
          </div>
        </Section>
      </CardBody>
    </Card>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
      {isSigned ? (
        <Alert tone="info" title={t('lockedNotice')} />
      ) : null}
      {status === 'saved' ? <Alert tone="success">{tc('saved')}</Alert> : null}
      {status === 'error' ? (
        <Alert tone="danger">
          {errorKey === 'errors.encounterLocked' ? tErrors('encounterLocked') : tc('errorGeneric')}
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
            <div className="space-y-4">
              <Field label={tf('modalitiesUsed')}>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {TREATMENT_MODALITIES.map((modality) => (
                    <label key={modality} className="flex items-center gap-2 text-sm text-ink-700">
                      <Checkbox
                        checked={state.modalities_used.includes(modality)}
                        disabled={disabled}
                        onChange={() => toggleModality(modality)}
                      />
                      {tModality(modality)}
                    </label>
                  ))}
                </div>
              </Field>

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
