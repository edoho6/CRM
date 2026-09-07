import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  EncounterPaymentStatus,
  AcupuncturePoint,
  DispensingRecordWithItems,
  Encounter,
  Herb,
  HerbFormulaWithItems,
  Patient,
  TcmNote,
} from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { EncounterForm } from '@/features/encounters/encounter-form';
import { DispensePanel } from '@/features/inventory/dispense-panel';
import { PaymentAction } from '@/features/billing/payment-status';
import { toPaymentSummary } from '@/features/billing/payment-summary';

const FORMULA_SELECT =
  '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit))';

const DISPENSING_SELECT =
  '*, items:dispensing_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name)), ' +
  'formula:herb_formulas(id, name_pinyin, name_english, name_hebrew)';

/** Only what the picker and the chart need — not the clinical prose. */
const POINT_SELECT =
  'id, code, pinyin_name, chinese_name, english_name, default_region, body_view, x, y, bilateral';

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

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('encounters');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: encounter } = await scope.supabase
    .from('encounters')
    .select('*')
    .eq('id', id)
    .maybeSingle<Encounter>();

  if (!encounter) notFound();

  const [noteResult, patientResult, dispensingResult, formulasResult, herbsResult, pointsResult] =
    await Promise.all([
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

  return (
    <>
      <PageHeader
        title={t('encounterOn', {
          date: format.dateTime(new Date(encounter.encounter_date), 'short'),
        })}
        description={
          patientResult.data ? (
            <Link
              href={`/patients/${patientResult.data.id}`}
              className="font-medium text-jade-800 underline-offset-2 hover:underline"
            >
              {patientResult.data.full_name}
            </Link>
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
                date: format.dateTime(new Date(encounter.signed_at), 'dateTime'),
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
        dispensePanel={
          <DispensePanel
            encounterId={encounter.id}
            formulas={formulasResult.data ?? []}
            herbs={herbsResult.data ?? []}
            records={dispensingResult.data ?? []}
            tracksInventory={tracksInventory}
            disabled={isSigned}
          />
        }
      />
    </>
  );
}
