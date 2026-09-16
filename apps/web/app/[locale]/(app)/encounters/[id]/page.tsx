import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Locale } from '@clinic/domain';
import type {
  EncounterPaymentStatus,
  AcupuncturePoint,
  DispensingRecordWithItems,
  Encounter,
  Herb,
  HerbFormula,
  FormSubmission,
  FormTemplate,
  Patient,
  RecordedPoint,
  TcmNote,
  TreatmentProtocol,
} from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { RegisterOpenFile } from '@/features/workspace/register-open-file';
import { HeaderToolsSlot } from '@/components/header-tools';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { EncounterForm } from '@/features/encounters/encounter-form';
import type { TonguePhoto } from '@/features/encounters/tongue-photos';
import type { BodyPointRow } from '@/features/encounters/body3d/points';
import type { Sketch } from '@/features/encounters/sketches';
import { prescriptionKey } from '@/features/encounters/prescription-key';
import { formulaPrimaryName, herbPrimaryName } from '@/lib/display';
import {
  DispensePanel,
  type FormulaOption,
  type HerbOption,
} from '@/features/inventory/dispense-panel';
import { EncounterFormsPanel } from '@/features/forms/encounter-forms-panel';
import type { PreviousEncounter } from '@/features/encounters/encounter-compare';
import { EncounterNav, type EncounterStep } from '@/features/encounters/encounter-nav';
import { PaymentAction } from '@/features/billing/payment-status';
import { ReopenEncounterButton } from '@/features/encounters/reopen-encounter-button';
import type { EncounterSignature } from '@clinic/db/types';
import { toPaymentSummary } from '@/features/billing/payment-summary';
import { formatDate, formatDateTime } from '@clinic/i18n';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('encounters', 'single');

/*
 * The catalogue, as the prescription panel needs it and no wider.
 *
 * Both of these were `select('*')` — over as many as two thousand herbs and a
 * thousand formulas, on every single open of a treatment. `*` on these two
 * tables is mostly prose: functions, indications, cautions, contraindications,
 * modifications, dosage notes, the English of all of them again in `text_en`,
 * and a JSON list of sources. None of it was displayed. The panel shows one
 * name and searches by the others.
 *
 * The whole catalogue still travels, deliberately, for the same reason the
 * point catalogue does: autocomplete with no round trip per keystroke is what
 * makes typing a herb name mid-treatment feel like nothing at all. What changed
 * is that it now travels as names.
 */
const HERB_SELECT = 'id, pinyin_name, chinese_name, english_name, botanical_name';

const FORMULA_SELECT =
  'id, name_pinyin, name_chinese, name_english,' +
  ' items:herb_formula_items(id, dosage, herb:herbs(id, pinyin_name, chinese_name, english_name))';

const DISPENSING_SELECT =
  '*, items:dispensing_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name)), ' +
  'formula:herb_formulas(id, name_pinyin, name_english)';

/** Only what the picker and the chart need — not the clinical prose. */
const POINT_SELECT =
  'id, code, pinyin_name, chinese_name, english_name, default_region, body_view, x, y, bilateral, location, actions, indications';

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
  | 'location'
  | 'actions'
  | 'indications'
>;

/**
 * An earlier treatment, as the comparison panel needs it.
 *
 * `note` is one-to-one with the encounter (the note's encounter_id is
 * unique), and PostgREST embeds such a relation as an object — or null for a
 * visit that never got its note. `dispensing` is one-to-many and always a
 * list. Both are read defensively below, because a wrong guess here is not a
 * wrong column, it is the whole page failing to open.
 */
interface PreviousNote {
  points_used: RecordedPoint[] | null;
}

interface PreviousRow {
  id: string;
  encounter_date: string;
  /** One-to-one, so an object or null in practice; typed loosely on purpose. */
  note: PreviousNote[] | PreviousNote | null;
  dispensing: {
    formula: Pick<HerbFormula, 'id' | 'name_pinyin' | 'name_english'> | null;
    preparation: string | null;
    dose_amount: number | null;
    dose_unit: string | null;
    doses_per_day: number | null;
    dose_timing: string | null;
    items: {
      custom_name: string | null;
      quantity: number;
      unit: string | null;
      herb: Pick<Herb, 'id' | 'pinyin_name' | 'chinese_name' | 'english_name'> | null;
    }[];
  }[];
}

/** A tongue photograph on the file, with the date of the treatment it was taken at. */
interface TonguePhotoRow {
  id: string;
  encounter_id: string | null;
  created_at: string;
  encounter: { encounter_date: string } | null;
}

/** A page written by hand at this treatment. */
interface SketchRow {
  id: string;
  created_at: string;
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
    tonguePhotosResult,
    sketchesResult,
    signaturesResult,
    bodyPointsResult,
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
        .returns<FormulaOption[]>(),
      scope.supabase
        .from('herbs')
        .select(HERB_SELECT)
        .eq('is_active', true)
        .order('pinyin_name', { ascending: true })
        .limit(2000)
        .returns<HerbOption[]>(),
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
          'id, encounter_date, note:tcm_notes(points_used),' +
            ' dispensing:dispensing_records(preparation, dose_amount, dose_unit, doses_per_day, dose_timing,' +
            ' formula:herb_formulas(id, name_pinyin, name_english),' +
            ' items:dispensing_items(custom_name, quantity, unit,' +
            ' herb:herbs(id, pinyin_name, chinese_name, english_name)))',
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
      /*
       * Every tongue photograph on this patient's file, newest first, with the
       * date of the treatment each belongs to. Two dozen is years of visits;
       * the comparison is against the last few, not the archive.
       *
       * Until migration 16 has been run this column does not exist, the query
       * fails, and the panel shows no photographs — which is the right thing
       * to show, rather than the page failing.
       */
      scope.supabase
        .from('patient_documents')
        .select('id, encounter_id, created_at, encounter:encounters(encounter_date)')
        .eq('patient_id', encounter.patient_id)
        .eq('category', 'tongue')
        .order('created_at', { ascending: false })
        .limit(24)
        .returns<TonguePhotoRow[]>(),
      // The pages written by hand at this treatment, oldest first. Until
      // migration 46 has run no row can carry the category, and the panel
      // simply shows none.
      scope.supabase
        .from('patient_documents')
        .select('id, created_at')
        .eq('encounter_id', id)
        .eq('category', 'sketch')
        .order('created_at', { ascending: true })
        .limit(50)
        .returns<SketchRow[]>(),
      // The signatures this record carried before it was reopened, newest
      // first. Until migration 38 has run the table does not exist, the
      // query fails, and the record simply shows no history of reopening.
      scope.supabase
        .from('encounter_signatures')
        .select('*')
        .eq('encounter_id', id)
        .order('reopened_at', { ascending: false })
        .limit(10)
        .returns<EncounterSignature[]>(),
      // Where each point sits on the 3D body — service-wide rows, a few
      // hundred at most. Until migration 56 has run the table does not
      // exist, the query fails, and the model simply lists its points
      // instead of drawing them.
      scope.supabase
        .from('body_points')
        .select('code, side_type, x, y, z, approach_x, approach_y, approach_z, validated, note')
        .limit(1000)
        .returns<BodyPointRow[]>(),
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
    bilateral: point.bilateral,
    location: point.location,
    actions: point.actions,
    indications: point.indications,
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
   * The earlier treatments, shaped for the head-to-head comparison.
   *
   * Herbs stay structured — a name, a dose and a language-independent key —
   * because the panel diffs them line by line against what is being prescribed
   * now. The display name is the same function the dispensing panel uses, so
   * the two columns read the same in either language, and the key is the
   * pinyin so they match regardless. A visit with more than one prescription
   * shows the last, which is the correction.
   */
  // The route param is a string; the layout has already refused anything that
  // is not a real locale, so this narrowing states a fact rather than hoping.
  const uiLocale = locale as Locale;
  const previousEncounters: PreviousEncounter[] = (previousResult.data ?? []).map((row) => {
    // The note is one-to-one with its encounter, and PostgREST embeds such a
    // relation as an object — or null, for an encounter that never got its
    // note. Indexing null as a list is what used to take this page down the
    // moment a patient had one such visit in their history.
    const noteEmbed = row.note as PreviousRow['note'] | PreviousNote | null | undefined;
    const note = Array.isArray(noteEmbed) ? (noteEmbed[0] ?? null) : (noteEmbed ?? null);
    const dispensingList = Array.isArray(row.dispensing) ? row.dispensing : [];
    const dispensing = dispensingList[dispensingList.length - 1] ?? null;

    const items = dispensing?.items ?? [];
    return {
      id: row.id,
      date: row.encounter_date,
      points: note?.points_used ?? [],
      formula: dispensing?.formula ? formulaPrimaryName(dispensing.formula, uiLocale) : null,
      formulaId: dispensing?.formula?.id ?? null,
      herbs: items.flatMap((item) => {
        const name = item.herb ? herbPrimaryName(item.herb, uiLocale) : item.custom_name;
        if (!name) return [];
        return [
          {
            key: prescriptionKey(item.herb?.pinyin_name, name),
            name,
            quantity: Number(item.quantity),
            herbId: item.herb?.id ?? null,
          },
        ];
      }),
      meta: dispensing
        ? {
            preparation: dispensing.preparation,
            total: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.quantity), 0) * 100) / 100 : null,
            unit: items[0]?.unit ?? null,
            doseAmount: dispensing.dose_amount === null ? null : Number(dispensing.dose_amount),
            doseUnit: dispensing.dose_unit,
            dosesPerDay: dispensing.doses_per_day === null ? null : Number(dispensing.doses_per_day),
            doseTiming: dispensing.dose_timing,
          }
        : null,
    };
  });

  const tonguePhotos: TonguePhoto[] = (tonguePhotosResult.data ?? []).map((row) => ({
    id: row.id,
    encounterId: row.encounter_id,
    date: row.encounter?.encounter_date ?? row.created_at.slice(0, 10),
  }));

  const sketches: Sketch[] = (sketchesResult.data ?? []).map((row) => ({
    id: row.id,
    date: encounter.encounter_date ?? row.created_at.slice(0, 10),
  }));

  /** Oldest first, so a session's number never changes when a later one is added. */
  const steps: EncounterStep[] = (stepsResult.data ?? []).map((row) => ({
    id: row.id,
    date: row.encounter_date,
  }));

  return (
    <>
      {/* Onto the tab strip in the shell, which knows the URL but not the
          name on it. */}
      <RegisterOpenFile
        kind="encounter"
        id={encounter.id}
        label={
          patientResult.data
            ? `${patientResult.data.full_name} · ${formatDate(new Date(encounter.encounter_date))}`
            : formatDate(new Date(encounter.encounter_date))
        }
        href={`/encounters/${encounter.id}`}
      />

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
              {/* When it was signed, in the same line as everything else
                  about this record — it used to be a whole card of its own,
                  under a badge that already said "signed". */}
              {isSigned && encounter.signed_at ? (
                <span className="text-ink-600" dir="auto">
                  {t('signedAt', { date: formatDateTime(new Date(encounter.signed_at)) })}
                </span>
              ) : null}
            </span>
          ) : null
        }
        // The state of the money, beside the record's name: a thing you check
        // before letting a patient leave, in the same glance as the date.
        aside={
          <PaymentAction
            summary={toPaymentSummary(paymentResult.data)}
            encounterId={encounter.id}
            canBill={canBill}
          />
        }
        actions={
          <>
            <Badge tone={isSigned ? 'success' : 'warning'}>{t(`status.${encounter.status}`)}</Badge>
            {isSigned ? <ReopenEncounterButton encounterId={encounter.id} /> : null}
            {/* The switch that arranges both columns lands here, last — the
                far corner of the header — so the columns start level with
                each other and the switch is out of the way of the record. */}
            {/* Two slots, so the pen stays before the arrange switch, which is
                always the last control in the corner. */}
            <HeaderToolsSlot id="encounter-header-sketch" />
            <HeaderToolsSlot id="encounter-header-tools" />
          </>
        }
      />

      {/* The form owns the two-column layout: tongue, pulse and dispensing all
          belong to the same side column, so it places them together. */}
      <EncounterForm
        encounterId={encounter.id}
        patientId={encounter.patient_id}
        note={noteResult.data ?? null}
        isSigned={isSigned}
        pointCatalogue={pointCatalogue}
        pointPositions={pointPositions}
        bodyPoints={bodyPointsResult.data ?? []}
        canPlaceBodyPoints={scope.context.isPlatformAdmin}
        protocols={protocolsResult.data ?? []}
        previousEncounters={previousEncounters}
        tonguePhotos={tonguePhotos}
        sketches={sketches}
        reopened={signaturesResult.data?.[0] ?? null}
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
