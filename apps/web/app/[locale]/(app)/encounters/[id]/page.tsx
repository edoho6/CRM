import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  DispensingRecordWithItems,
  Encounter,
  Herb,
  HerbFormulaWithItems,
  Patient,
  TcmNote,
} from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { EncounterForm } from '@/features/encounters/encounter-form';
import { DispensePanel } from '@/features/inventory/dispense-panel';
import { CreateInvoiceButton } from '@/features/billing/create-invoice-button';

const FORMULA_SELECT =
  '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit))';

const DISPENSING_SELECT =
  '*, items:dispensing_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name)), ' +
  'formula:herb_formulas(id, name_pinyin, name_english, name_hebrew)';

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

  const [noteResult, patientResult, dispensingResult, formulasResult, herbsResult] =
    await Promise.all([
      scope.supabase
        .from('tcm_notes')
        .select('*')
        .eq('encounter_id', id)
        .maybeSingle<TcmNote>(),
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
        .returns<HerbFormulaWithItems[]>(),
      scope.supabase
        .from('herbs')
        .select('*')
        .eq('is_active', true)
        .order('pinyin_name', { ascending: true })
        .returns<Herb[]>(),
    ]);

  const isSigned = encounter.status === 'signed';

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
            <CreateInvoiceButton encounterId={encounter.id} />
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
        dispensePanel={
          <DispensePanel
            encounterId={encounter.id}
            formulas={formulasResult.data ?? []}
            herbs={herbsResult.data ?? []}
            records={dispensingResult.data ?? []}
            disabled={isSigned}
          />
        }
      />
    </>
  );
}
