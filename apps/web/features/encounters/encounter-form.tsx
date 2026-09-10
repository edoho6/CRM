'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { BookmarkPlus, Lock, MoreHorizontal, Save } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldGrid,
  Input,
  Section,
  Spinner,
  Textarea,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { toPointPlacement, type BodyView, type TreatmentModality } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { TcmNote, TreatmentProtocol } from '@clinic/db/types';
import { useAutosave } from '@/lib/use-autosave';
import type { MappedPoint } from '@/features/reference/body-map';
import { HumanBody3D } from './body3d/human-body-3d';
import { PointsEditor, type PointOption, type PointRow } from './points-editor';
import { EncounterCompare, type PreviousEncounter } from './encounter-compare';
import {
  CurrentPrescriptionProvider,
  type CurrentPrescription,
} from './current-prescription-context';
import { TonguePhotos, type TonguePhoto } from './tongue-photos';
import { SidePanels } from './side-panels';
import { ProtocolPicker } from './protocol-picker';
import { saveProtocolFromEncounter } from './protocol-actions';
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
      // Three generations of older notes have to keep opening: ones that
      // recorded a `side` and no region, ones with one of the five flat
      // regions, and ones with the four quadrants. `toPointPlacement` handles
      // the last two; the side is read first because it is the more specific.
      region: point.region
        ? toPointPlacement(point.region)
        : point.side === 'left'
          ? 'left'
          : point.side === 'midline'
            ? 'center'
            : 'right',
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
  patientId,
  note,
  isSigned,
  pointCatalogue,
  pointPositions,
  protocols,
  previousEncounters,
  tonguePhotos,
  dispensePanel,
  formsPanel,
}: {
  encounterId: string;
  patientId: string;
  note: TcmNote | null;
  isSigned: boolean;
  /** The whole point catalogue, for instant autocomplete with no round trip. */
  pointCatalogue: PointOption[];
  /** Where each catalogued point sits on the body chart, keyed by point id. */
  pointPositions: Record<string, PointPosition>;
  /** Saved protocols, for filling the points in from one. */
  protocols: TreatmentProtocol[];
  /** This patient's earlier treatments, newest first, for the comparison. */
  previousEncounters: PreviousEncounter[];
  /** Every tongue photograph on this patient's file, newest first. */
  tonguePhotos: TonguePhoto[];
  dispensePanel?: React.ReactNode;
  formsPanel?: React.ReactNode;
}) {
  const t = useTranslations('encounters');
  const tf = useTranslations('encounters.fields');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tProtocols = useTranslations('protocols');
  const tPanels = useTranslations('encounters.panels');
  const format = useFormatter();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [state, setState] = useState<NoteState>(() => toState(note));
  const [isPending, startTransition] = useTransition();
  // Only a failure stays on the page. "Saved" is a toast, and the autosave line
  // under the form already says when the record was last written.
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Saving this treatment as a protocol.
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [protocolName, setProtocolName] = useState('');
  const [protocolDescription, setProtocolDescription] = useState('');

  /*
   * What the dispensing panel is composing, for the live comparison.
   *
   * The panel publishes on every change; only a real change is kept. Returning
   * the previous value from the updater when the two are equal makes React
   * skip the render, which is what keeps a panel that republishes on every
   * keystroke from re-rendering the whole form on every keystroke.
   */
  const [currentPrescription, setCurrentPrescription] = useState<CurrentPrescription | null>(
    null,
  );
  const publishPrescription = useCallback((next: CurrentPrescription | null) => {
    setCurrentPrescription((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
  }, []);
  const prescriptionContext = useMemo(
    () => ({ publish: publishPrescription }),
    [publishPrescription],
  );

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
      toast({ tone: 'success', title: t('saved') });
      // Tell the autosave this value is on disk, so it does not immediately
      // write the same thing again.
      autosave.markSaved();
      router.refresh();
    });
  }

  /**
   * Fills the points in from a protocol.
   *
   * Appended rather than replacing: a practitioner who has already written two
   * points and then reaches for a protocol meant to add to them, not to lose
   * them. Points already present are not duplicated.
   */
  function applyProtocol(protocol: TreatmentProtocol) {
    const existing = new Set(state.points_used.map((row) => row.point.trim().toLowerCase()));
    const added: PointRow[] = protocol.points_used
      .filter((point) => !existing.has(point.point.trim().toLowerCase()))
      .map((point) => ({
        point: point.point,
        point_id: point.point_id ?? null,
        region: point.region ? toPointPlacement(point.region) : 'right',
        technique: point.technique,
        retention_minutes: point.retention_minutes ?? '',
        notes: point.notes ?? '',
      }));

    setState((current) => ({
      ...current,
      // An empty first row is a placeholder, not a point; the protocol fills it.
      points_used: [...current.points_used.filter((row) => row.point.trim()), ...added],
      // The principle is filled only when the field is empty. Overwriting what
      // the practitioner has already concluded would be the protocol arguing
      // with the clinician.
      treatment_principle:
        current.treatment_principle.trim() || (protocol.treatment_principle ?? ''),
    }));
    setStatus('idle');
  }

  function handleSaveAsProtocol() {
    if (!protocolName.trim()) return;
    setErrorKey(null);
    startTransition(async () => {
      // Save the note first, because the protocol is built from what is on disk
      // rather than from what is on screen — see saveProtocolFromEncounter.
      const saveResult = await saveEncounterNote(encounterId, buildPayload());
      if (!saveResult.ok) {
        setErrorKey(saveResult.error.key);
        setStatus('error');
        return;
      }
      const result = await saveProtocolFromEncounter(
        encounterId,
        protocolName,
        protocolDescription,
      );
      if (!result.ok) {
        setErrorKey(result.error.key);
        setStatus('error');
        return;
      }
      autosave.markSaved();
      setProtocolOpen(false);
      setProtocolName('');
      setProtocolDescription('');
      toast({ tone: 'success', title: tProtocols('savedFromTreatment') });
      router.refresh();
    });
  }

  async function handleSign() {
    // Not destructive — signing is the point — but irreversible, so it is
    // asked in the product's own dialog rather than the browser's.
    const confirmed = await confirm({
      title: t('signConfirmTitle'),
      body: t('signConfirmBody'),
      confirmLabel: t('sign'),
    });
    if (!confirmed) return;
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
      // The one irreversible act on this page deserves to be acknowledged
      // in words, not only by the form going grey.
      toast({ tone: 'success', title: t('signed') });
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
              <h3 className="mb-1.5 text-sm font-semibold text-ink-900">{tf('tongue')}</h3>
              {/* The photograph first, open on the page, then the words. The
                  words describe what the photograph shows. */}
              <TonguePhotos
                patientId={patientId}
                encounterId={encounterId}
                photos={tonguePhotos}
                disabled={isSigned}
              />
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Field label={tf('tongueColorShort')} htmlFor="tongue_body_color" density="compact">
                  <Textarea
                    id="tongue_body_color"
                    rows={1}
                    disabled={disabled}
                    value={state.tongue_body_color}
                    onChange={(event) => set('tongue_body_color', event.target.value)}
                    className="min-h-10 field-sizing-content"
                  />
                </Field>
                <Field label={tf('tongueShapeShort')} htmlFor="tongue_shape" density="compact">
                  <Textarea
                    id="tongue_shape"
                    rows={1}
                    disabled={disabled}
                    value={state.tongue_shape}
                    onChange={(event) => set('tongue_shape', event.target.value)}
                    className="min-h-10 field-sizing-content"
                  />
                </Field>
                <Field label={tf('tongueCoatingShort')} htmlFor="tongue_coating" density="compact">
                  <Textarea
                    id="tongue_coating"
                    rows={1}
                    disabled={disabled}
                    value={state.tongue_coating}
                    onChange={(event) => set('tongue_coating', event.target.value)}
                    className="min-h-10 field-sizing-content"
                  />
                </Field>
              </div>
              <Textarea
                id="tongue_notes"
                rows={2}
                className="mt-1.5 field-sizing-content"
                aria-label={tf('tongueNotes')}
                placeholder={tf('tongueNotes')}
                disabled={disabled}
                value={state.tongue_notes}
                onChange={(event) => set('tongue_notes', event.target.value)}
              />
            </div>

            <div className="border-t border-ink-100 pt-3">
              <h3 className="mb-1.5 text-sm font-semibold text-ink-900">{tf('pulse')}</h3>
              {/* Qualities used to be a third field. They are written into the
                  same phrase as the sides in practice — "left wiry, right thin"
                  — so the row that asked for them separately is gone and the
                  column is still stored for notes that have one. */}
              <div className="grid grid-cols-2 gap-1.5">
                <Field label={tf('pulseRightShort')} htmlFor="pulse_right" density="compact">
                  <Textarea
                    id="pulse_right"
                    rows={1}
                    disabled={disabled}
                    value={state.pulse_right}
                    onChange={(event) => set('pulse_right', event.target.value)}
                    className="min-h-10 field-sizing-content"
                  />
                </Field>
                <Field label={tf('pulseLeftShort')} htmlFor="pulse_left" density="compact">
                  <Textarea
                    id="pulse_left"
                    rows={1}
                    disabled={disabled}
                    value={state.pulse_left}
                    onChange={(event) => set('pulse_left', event.target.value)}
                    className="min-h-10 field-sizing-content"
                  />
                </Field>
              </div>
              <Textarea
                id="pulse_notes"
                rows={2}
                className="mt-1.5 field-sizing-content"
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
    <CurrentPrescriptionProvider value={prescriptionContext}>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {isSigned ? <Alert tone="info" title={t('lockedNotice')} /> : null}
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
                <div>
                  {/* The instruction sits under the heading rather than under
                      the grid. It explains what to type, so it has to be read
                      before the fields, not after them — underneath, it was
                      below six panels and a body chart, which is where nobody
                      looks for how to start. */}
                  <h3 className="text-sm font-medium text-ink-700">{tf('pointsUsed')}</h3>
                  <p className="mt-0.5 mb-2 text-xs text-ink-600">{t('points.hint')}</p>

                  {/* Above the grid rather than beside it: a protocol is chosen
                      before the points are typed, not after. */}
                  {!isSigned ? (
                    <div className="mb-3">
                      <ProtocolPicker
                        protocols={protocols}
                        disabled={disabled}
                        onApply={applyProtocol}
                        label={tProtocols('applyPoints')}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]">
                    <PointsEditor
                      value={state.points_used}
                      catalogue={pointCatalogue}
                      disabled={disabled}
                      onChange={(rows) => set('points_used', rows)}
                    />
                    {/* The chart is a mirror of the list, not a second input: it
                      reflects what has been chosen so a gap in the prescription
                      is visible rather than deduced. */}
                    <HumanBody3D
                      points={mappedPoints}
                      onSelect={(point) => router.push(`/reference/points/${point.pointId}`)}
                    />
                  </div>
                </div>

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
          /* Stuck to the bottom of the window. This is the longest page in the
             app, and the buttons that save and sign it were at the foot of a
             column that ended below a 3D body and a dispensing table — a
             consultation's worth of scrolling away from where the typing is. */
          <div className="sticky bottom-0 z-sticky -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
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
            {/* The rare action behind a menu; the two everyday ones as buttons.
                Save is the primary: it is pressed twenty times a visit, while
                signing happens once and locks the record, so it must never be
                the button the hand reaches for by habit. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  aria-label={tc('more')}
                  title={tc('more')}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setProtocolOpen(true)}>
                  <BookmarkPlus className="h-4 w-4" />
                  {tProtocols('saveFromTreatment')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={handleSign} disabled={isPending}>
              <Lock className="h-4 w-4" />
              {t('sign')}
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? <Spinner /> : <Save className="h-4 w-4" />}
              {isPending ? tc('saving') : tc('save')}
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={protocolOpen} onOpenChange={setProtocolOpen}>
        <DialogContent title={tProtocols('saveFromTreatment')} closeLabel={tc('close')}>
          <div className="space-y-4">
            <p className="text-sm text-ink-700">{tProtocols('saveFromTreatmentBody')}</p>
            <Field label={tProtocols('name')} htmlFor="protocol_name" required>
              <Input
                id="protocol_name"
                value={protocolName}
                onChange={(event) => setProtocolName(event.target.value)}
              />
            </Field>
            <Field label={tProtocols('description')} htmlFor="protocol_description">
              <Textarea
                id="protocol_description"
                rows={2}
                value={protocolDescription}
                onChange={(event) => setProtocolDescription(event.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setProtocolOpen(false)}
                disabled={isPending}
              >
                {tc('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSaveAsProtocol}
                disabled={isPending || !protocolName.trim()}
              >
                {isPending ? <Spinner /> : null}
                {tc('save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Side column: what you observe at the couch, and what you hand over
          because of it — in whatever order this practitioner keeps them. */}
      <SidePanels
        panels={[
          { id: 'examination', title: tPanels('examination'), node: examinationCard },
          {
            id: 'compare',
            title: tPanels('compare'),
            // Inside the form rather than passed in as a prop, because the diff
            // is against the points being typed right now — an element built by
            // the page could only ever compare against what is already saved.
            node: (
              <EncounterCompare
                previous={previousEncounters}
                currentPoints={state.points_used
                  .filter((row) => row.point.trim())
                  .map((row) => ({ point: row.point, region: row.region }))}
                currentPrescription={currentPrescription}
              />
            ),
          },
          // The wrappers are not decoration: `dispensePanel` and `formsPanel`
          // are elements built by the page and handed in as props, and each
          // needs a parent of its own so it is a single child rather than an
          // entry React asks a key for.
          { id: 'dispensing', title: tPanels('dispensing'), node: <div>{dispensePanel}</div> },
          { id: 'forms', title: tPanels('forms'), node: <div>{formsPanel}</div> },
        ]}
      />
    </div>
    </CurrentPrescriptionProvider>
  );
}
