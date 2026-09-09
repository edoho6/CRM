import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { DispensingRecordWithItems, Patient, Profile } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { formulaPrimaryName, herbPrimaryName } from '@/lib/display';
import { PrintButton } from '@/features/documents/print-button';
import { formatDate } from '@clinic/i18n';

/**
 * The prescription, on paper, for the patient to take home with the bag.
 *
 * One plain sheet: who prescribed, for whom, what, and how to take it. It
 * used to carry a second, cut-off label as well; that made a page of two
 * documents in two sizes, and the practitioner asked for one. The thing a
 * patient reads at the kitchen counter is the dose — so that is the largest
 * type on the page, and the day's total is worked out for them rather than
 * left as a multiplication to do with the kettle on.
 */
const DISPENSING_SELECT =
  '*, items:dispensing_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name)), ' +
  'formula:herb_formulas(id, name_pinyin, name_english, name_hebrew)';

export default async function PrescriptionPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('prescriptionPrint');
  const tUnit = await getTranslations('inventory.unit');
  const tPrep = await getTranslations('inventory.preparation');
  const tDispensing = await getTranslations('inventory.dispensing');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: record } = await scope.supabase
    .from('dispensing_records')
    .select(DISPENSING_SELECT)
    .eq('id', id)
    .maybeSingle<DispensingRecordWithItems>();

  if (!record) notFound();

  const [{ data: patient }, { data: profile }] = await Promise.all([
    scope.supabase
      .from('patients')
      .select('full_name')
      .eq('id', record.patient_id)
      .maybeSingle<Pick<Patient, 'full_name'>>(),
    scope.supabase
      .from('profiles')
      .select('full_name, title, phone')
      .eq('id', scope.context.membership.user_id)
      .maybeSingle<Pick<Profile, 'full_name' | 'title' | 'phone'>>(),
  ]);

  const clinic = scope.context.clinic;
  const uiLocale = locale as Locale;

  const formulaName = record.formula ? formulaPrimaryName(record.formula, uiLocale) : null;
  const doseUnit = record.dose_unit ?? 'gram';

  /*
   * How to take it, as parts rather than a sentence template: a prescription
   * with an amount but no timing reads "2 g · twice a day" and not
   * "2 g, twice a day, ." — the middle dot implies no grammar the pieces lack.
   */
  const perDose = record.dose_amount
    ? `${format.number(Number(record.dose_amount))} ${tUnit(doseUnit)}`
    : null;
  const timesADay = record.doses_per_day
    ? tDispensing('perDay', { count: Number(record.doses_per_day) })
    : null;
  const timing = record.dose_timing ? tDispensing(`timing.${record.dose_timing}`) : null;
  const dailyTotal =
    record.dose_amount && record.doses_per_day
      ? `${format.number(Number(record.dose_amount) * Number(record.doses_per_day))} ${tUnit(doseUnit)}`
      : null;
  const dosing = [perDose, timesADay, timing].filter(Boolean).join(' · ');

  return (
    <article className="space-y-6">
      <PrintButton />

      <header className="border-b border-ink-300 pb-4">
        <h1 className="text-xl font-semibold">{clinic.name}</h1>
        <p className="mt-0.5 text-sm text-ink-600">
          {[clinic.address, clinic.phone].filter(Boolean).join(' · ')}
        </p>
      </header>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-ink-600" dir="ltr">
          {formatDate(new Date(record.dispensed_at))}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>
          <dt className="text-xs text-ink-600">{t('patient')}</dt>
          <dd dir="auto">{patient?.full_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-600">{t('practitioner')}</dt>
          <dd dir="auto">
            {[profile?.full_name, profile?.title].filter(Boolean).join(' · ') || '—'}
          </dd>
          {profile?.phone ? (
            <dd className="text-xs text-ink-600" dir="ltr">
              {profile.phone}
            </dd>
          ) : null}
        </div>
      </dl>

      {formulaName ? (
        <p className="text-base font-medium" dir="auto">
          {formulaName}
          {record.preparation ? ` · ${tPrep(record.preparation)}` : ''}
        </p>
      ) : null}

      {/* The dose first and largest: it is the one thing on the sheet that is
          read again and again after the day it was handed over. */}
      {dosing || dailyTotal || record.days_supply ? (
        <section className="rounded-lg border border-ink-300 p-4">
          <h3 className="text-sm font-semibold text-ink-900">{t('howToTake')}</h3>
          <p className="mt-1 text-2xl font-semibold" dir="auto">
            {dosing || '—'}
          </p>
          {dailyTotal ? (
            <p className="mt-1 text-base text-ink-800" dir="auto">
              {t('dailyTotal')}: {dailyTotal}
            </p>
          ) : null}
          {record.days_supply ? (
            <p className="mt-0.5 text-sm text-ink-700" dir="auto">
              {t('daysSupply')}: {record.days_supply}
            </p>
          ) : null}
        </section>
      ) : null}

      {record.items.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink-900">{t('contents')}</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-ink-300 py-1 text-start text-xs font-semibold text-ink-600"
                >
                  {t('herb')}
                </th>
                <th
                  scope="col"
                  className="border-b border-ink-300 py-1 text-end text-xs font-semibold text-ink-600"
                >
                  {t('quantity')}
                </th>
              </tr>
            </thead>
            <tbody>
              {record.items.map((item) => (
                <tr key={item.id}>
                  <td className="border-b border-ink-100 py-1" dir="auto">
                    {item.herb ? herbPrimaryName(item.herb, uiLocale) : (item.custom_name ?? '—')}
                  </td>
                  {/* No direction override: in a Hebrew line the bidi algorithm
                      already puts the figure before its unit, and forcing LTR is
                      what made "20 מ״ל" read as "מ״ל 20". */}
                  <td className="border-b border-ink-100 py-1 text-end tabular-nums">
                    {format.number(Number(item.quantity))} {tUnit(item.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {record.notes ? (
        <section>
          <h3 className="text-sm font-semibold text-ink-900">{t('notes')}</h3>
          <p className="mt-1 text-sm whitespace-pre-wrap text-ink-700" dir="auto">
            {record.notes}
          </p>
        </section>
      ) : null}

      <footer className="border-t border-ink-200 pt-3 text-xs text-ink-600">
        {t('keepAway')}
      </footer>
    </article>
  );
}
