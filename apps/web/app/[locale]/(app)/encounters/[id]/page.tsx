import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  EncounterPaymentStatus,
  AcupuncturePoint,
  DispensingRecordWithItems,
  Encounter,
  Herb,
  HerbFormula,
  HerbFormulaWithItems,
  FormSubmission,
  FormTemplate,
  Patient,
  RecordedPoint,
  TcmNote,
  TreatmentProtocol,
} from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { EncounterForm } from '@/features/encounters/encounter-form';
import { DispensePanel } from '@/features/inventory/dispense-panel';
import { EncounterFormsPanel } from '@/features/forms/encounter-forms-panel';
import type { PreviousEncounter } from '@/features/encounters/encounter-compare';
import { EncounterNav, type EncounterStep } from '@/features/encounters/encounter-nav';
import { PaymentAction } from '@/features/billing/payment-status';
import { toPaymentSummary } from '@/features/billing/payment-summary';
import { formatDate, formatDateTime } from '@clinic/i18n';

const FORMULA_SELECT =
  '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit))';

const DISPENSING_SELECT =
  '*, items:dispensing_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name)), ' +
  'formula:herb_formulas(id, name_pinyin, name_english, name_hebrew)';

/** Only what the picker and the chart need — not the clinical prose. */
const POINT_SELECT =
  'id, code, pinyin_name, chinese_name, english_name, default_region, body_view, x, y, bilateral';

/** Only what the questionnaire picker needs. */
type FormTemplateOption = Pick<FormTemplate, 'id' | 'title' | 'description' | 'fields'>;

type PointRow = Pick<
  AcupuncturePoint,
  | 'id'
  | 'code'
  | 'pinyin_name'
  | 'chinese_name'
  | 'english_name'
  | 'default_region'
  | 'body_view'
  | 'x'
  | 'y'
  | 'bilateral'
>;

/**
 * An earlier treatment, as the comparison panel needs it.
 *
 * `note` and `dispensing` come back as arrays from PostgREST even where the
 * relationship is one-to-one, because the client cannot tell a unique constraint
 * from a foreign key. Flattened below rather than typed as optional-single, so
 * the shape here matches what actually arrives.
 */
interface PreviousRow {
  id: string;
  encounter_date: string;
  note: {
    tcm_pattern_diagnosis: string | null;
    treatment_principle: string | null;
    points_used: RecordedPoint[];
    treatment_notes: string | null;
    chief_complaint: string | null;
  }[];
  dispensing: {
    formula: Pick<HerbFormula, 'name_pinyin' | 'name_english' | 'name_hebrew'> | null;
    items: { custom_name: string | null; quantity: number; herb: { pinyin_name: string } | null }[];
  }[];
}

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('encounters');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: encounter } = await scope.supabase
    .from('encounters')
    .select('*')
    .eq('id', id)
    .maybeSingle<Encounter>();

  if (!encounter) notFound();

  const [
    noteResult,
    patientResult,
    dispensingResult,
    formulasResult,
    herbsResult,
    pointsResult,
    protocolsResult,
    formTemplatesResult,
    formSubmissionsResult,
    previousResult,
    stepsResult,
  ] = await Promise.all([
      scope.supabase.from('tcm_notes').select('*').eq('encounter_id', id).maybeSingle<TcmNote>(),
      scope.supabase
        .from('patients')
        .select('*')
        .eq('id', encounter.patient_id)
        .maybeSingle<Patient>(),
      scope.supabase
        .from('dispensing_records')
        .select(DISPENSING_SELECT)
        .eq('encounter_id', id)
        .order('dispensed_at', { ascending: false })
        .returns<DispensingRecordWithItems[]>(),
      scope.supabase
        .from('herb_formulas')
        .select(FORMULA_SELECT)
        .eq('is_active', true)
        .order('name_pinyin', { ascending: true })
        .limit(1000)
        .returns<HerbFormulaWithItems[]>(),
      scope.supabase
        .from('herbs')
        .select('*')
        .eq('is_active', true)
        .order('pinyin_name', { ascending: true })
        .limit(2000)
        .returns<Herb[]>(),
      // The whole point catalogue travels to the client once. It is about 40 kB
      // and buys autocomplete with no round trip per keystroke, which is what
      // makes typing "LU7" mid-treatment feel like nothing at all.
      scope.supabase
        .from('acupuncture_points')
        .select(POINT_SELECT)
        .eq('is_active', true)
        .limit(1000)
        .returns<PointRow[]>(),
      // The combinations this practitioner comes back to. Retired ones are not
      // loaded: a protocol is retired precisely so it stops appearing here.
      scope.supabase
        .from('treatment_protocols')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .limit(500)
        .returns<TreatmentProtocol[]>(),
      scope.supabase
        .from('form_templates')
        .select('id, title, description, fields')
        .eq('is_active', true)
        .order('title', { ascending: true })
        .limit(200)
        .returns<FormTemplateOption[]>(),
      // This visit's answers only. The patient's whole questionnaire history is
      // a tab in their file.
      scope.supabase
        .from('form_submissions')
        .select('*')
        .eq('encounter_id', id)
        .order('submitted_at', { ascending: true })
        .returns<FormSubmission[]>(),
      /*
       * The patient's earlier treatments, for the side-by-side comparison.
       *
       * Six, not all of them: the comparison answers "what did I do last time",
       * and a dropdown of forty visits is a different question with a different
       * screen. The record being edited is excluded by the date filter below
       * rather than in SQL, because two records can share a date.
       */
      scope.supabase
        .from('encounters')
        .select(
          'id, encounter_date, note:tcm_notes(tcm_pattern_diagnosis, treatment_principle,' +
            ' points_used, treatment_notes, chief_complaint),' +
            ' dispensing:dispensing_records(formula:herb_formulas(name_pinyin, name_english,' +
            ' name_hebrew), items:dispensing_items(custom_name, quantity,' +
            ' herb:herbs(pinyin_name)))',
        )
        .eq('patient_id', encounter.patient_id)
        .neq('id', id)
        .order('encounter_date', { ascending: false })
        .limit(6)
        .returns<PreviousRow[]>(),
      /*
       * Every treatment for this patient, oldest first — id and date only.
       *
       * Separate from the comparison query above, which fetches six with their
       * notes and prescriptions. This one needs all of them and almost nothing
       * about each: "session four of nine" cannot be worked out from a window,
       * and two columns across a few hundred rows costs nothing.
       */
      scope.supabase
        .from('encounters')
        .select('id, encounter_date')
        .eq('patient_id', encounter.patient_id)
        .order('encounter_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1000)
        .returns<{ id: string; encounter_date: string }[]>(),
    ]);

  // Opening a treatment record is reading a patient's clinical notes, and is
  // recorded as such.
  await logRecordAccess(scope.supabase, 'encounters', encounter.id);

  const [paymentResult, billingSettingsResult] = await Promise.all([
    scope.supabase
      .from('encounter_payment_status')
      .select('*')
      .eq('encounter_id', encounter.id)
      .maybeSingle<EncounterPaymentStatus>(),
    scope.supabase
      .from('clinic_payment_settings')
      .select('is_active')
      .maybeSingle<{ is_active: boolean }>(),
  ]);

  // No provider configured means "raise an invoice" would only ever fail, so it
  // is not offered.
  const canBill = billingSettingsResult.data?.is_active === true;

  const isSigned = encounter.status === 'signed';
  const points = pointsResult.data ?? [];

  const pointCatalogue = points.map((point) => ({
    id: point.id,
    code: point.code,
    pinyin: point.pinyin_name,
    english: point.english_name,
    chinese: point.chinese_name,
    region: point.default_region,
  }));

  const pointPositions = Object.fromEntries(
    points
      .filter((point) => point.x !== null && point.y !== null)
      .map((point) => [
        point.id,
        {
          code: point.code,
          label: point.pinyin_name ?? point.code,
          view: point.body_view,
          x: Number(point.x),
          y: Number(point.y),
          bilateral: point.bilateral,
        },
      ]),
  );

  // A clinic that keeps no stock still needs to record what it prescribed, so
  // the same panel writes a prescription instead of allocating from batches.
  const tracksInventory = scope.context.clinic.tracks_inventory !== false;

  /*
   * The earlier treatments, flattened for the comparison panel.
   *
   * The prescription is rendered to one line here rather than in the browser:
   * the panel compares, it does not re-derive, and a formula name plus a handful
   * of herb names is all the comparison needs of it. A visit with more than one
   * prescription shows the last, which is the correction.
   */
  const previousEncounters: PreviousEncounter[] = (previousResult.data ?? []).map((row) => {
    const note = row.note[0] ?? null;
    const dispensing = row.dispensing[row.dispensing.length - 1] ?? null;

    const formulaName = dispensing?.formula
      ? (locale === 'he'
          ? dispensing.formula.name_hebrew
          : dispensing.formula.name_english) ?? dispensing.formula.name_pinyin
      : null;

    const herbLine = (dispensing?.items ?? [])
      .map((item) => {
        const name = item.custom_name ?? item.herb?.pinyin_name ?? null;
        return name ? `${name} ${item.quantity}` : null;
      })
      .filter(Boolean)
      .join(' · ');

    return {
      id: row.id,
      date: row.encounter_date,
      patternDiagnosis: note?.tcm_pattern_diagnosis ?? null,
      treatmentPrinciple: note?.treatment_principle ?? null,
      points: note?.points_used ?? [],
      prescription: formulaName ?? (herbLine || null),
      chiefComplaint: note?.chief_complaint ?? null,
      treatmentNotes: note?.treatment_notes ?? null,
    };
  });

  /** Oldest first, so a session's number never changes when a later one is added. */
  const steps: EncounterStep[] = (stepsResult.data ?? []).map((row) => ({
    id: row.id,
    date: row.encounter_date,
  }));

  return (
    <>
      <PageHeader
        title={t('encounterOn', {
          date: formatDate(new Date(encounter.encounter_date)),
        })}
        description={
          patientResult.data ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={`/patients/${patientResult.data.id}`}
                className="font-medium text-jade-800 underline-offset-2 hover:underline"
              >
                {patientResult.data.full_name}
              </Link>
              {/* Which session this is, and the way to the ones either side. */}
              <EncounterNav encounterId={encounter.id} steps={steps} />
            </span>
          ) : null
        }
        actions={
          <>
            {/* The state of the money, at the top of the record, next to the
                state of the record. Both are things you check before letting a
                patient leave, so they belong in the same glance. */}
            <PaymentAction
              summary={toPaymentSummary(paymentResult.data)}
              encounterId={encounter.id}
              canBill={canBill}
              size="md"
            />
            <Badge tone={isSigned ? 'success' : 'warning'}>{t(`status.${encounter.status}`)}</Badge>
          </>
        }
      />

      {isSigned && encounter.signed_at ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t('status.signed')}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink-600" dir="auto">
              {t('signedAt', {
                date: formatDateTime(new Date(encounter.signed_at)),
              })}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* The form owns the two-column layout: tongue, pulse and dispensing all
          belong to the same side column, so it places them together. */}
      <EncounterForm
        encounterId={encounter.id}
        note={noteResult.data ?? null}
        isSigned={isSigned}
        pointCatalogue={pointCatalogue}
        pointPositions={pointPositions}
        protocols={protocolsResult.data ?? []}
        previousEncounters={previousEncounters}
        dispensePanel={
          <DispensePanel
            encounterId={encounter.id}
            formulas={formulasResult.data ?? []}
            herbs={herbsResult.data ?? []}
            records={dispensingResult.data ?? []}
            protocols={protocolsResult.data ?? []}
            tracksInventory={tracksInventory}
            disabled={isSigned}
          />
        }
        formsPanel={
          <EncounterFormsPanel
            patientId={encounter.patient_id}
            encounterId={encounter.id}
            templates={formTemplatesResult.data ?? []}
            submissions={formSubmissionsResult.data ?? []}
            disabled={isSigned}
          />
        }
      />
    </>
  );
}
