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
 * The dosing fields were added a round ago precisely so this page could exist —
 * "one gram of granule twice daily after food" cannot be read back off a free
 * text note, cannot be printed onto a label, and cannot be carried forward. Until
 * now the patient left with a bag of herbs and nothing written on it.
 *
 * Two things on one sheet, separated by a cut line: the full prescription, and a
 * label small enough to go on the bag. The label repeats only what someone
 * standing at their kitchen counter needs — how much, how often, when — because
 * a label carrying the whole ingredient list is a label nobody reads.
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
      .select('full_name, title')
      .eq('id', scope.context.membership.user_id)
      .maybeSingle<Pick<Profile, 'full_name' | 'title'>>(),
  ]);

  const clinic = scope.context.clinic;

  const formulaName = record.formula
    ? formulaPrimaryName(record.formula, locale as Locale)
    : null;

  /*
   * How to take it, as one line.
   *
   * Assembled from the parts that were actually recorded rather than from a
   * sentence template: a prescription with an amount but no timing should read
   * "2 g, twice a day" and not "2 g, twice a day, ." — and the parts are
   * separated by a middle dot for the same reason, because a comma implies a
   * grammar the pieces do not have.
   */
  const dosing = [
    record.dose_amount
      ? `${format.number(Number(record.dose_amount))} ${tUnit(record.dose_unit ?? 'gram')}`
      : null,
    record.doses_per_day
      ? tDispensing('perDay', { count: Number(record.doses_per_day) })
      : null,
    record.dose_timing ? tDispensing(`timing.${record.dose_timing}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
        </div>
      </dl>

      {formulaName ? (
        <p className="text-base font-medium" dir="auto">
          {formulaName}
          {record.preparation ? ` · ${tPrep(record.preparation)}` : ''}
        </p>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold">{t('contents')}</h3>
        {record.items.length === 0 ? (
          <p className="text-sm text-ink-600">—</p>
        ) : (
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
                    {item.herb
                      ? herbPrimaryName(item.herb, locale as Locale)
                      : (item.custom_name ?? '—')}
                  </td>
                  {/* The wrapper carries the direction, not just the number:
                      in Hebrew the unit would otherwise be laid out before the
                      figure and "0 גרם" would read as "גרם 0". */}
                  <td className="border-b border-ink-100 py-1 text-end tabular-nums" dir="ltr">
                    {format.number(Number(item.quantity))} {tUnit(item.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dosing || record.days_supply ? (
        <section className="rounded-lg border border-ink-300 p-3">
          <h3 className="text-sm font-semibold">{t('howToTake')}</h3>
          <p className="mt-1 text-base" dir="auto">
            {dosing || '—'}
          </p>
          {record.days_supply ? (
            <p className="mt-0.5 text-sm text-ink-700" dir="auto">
              {t('daysSupply')}: {record.days_supply}
            </p>
          ) : null}
        </section>
      ) : null}

      {record.notes ? (
        <section>
          <h3 className="text-sm font-semibold">{t('notes')}</h3>
          <p className="mt-1 text-sm whitespace-pre-wrap text-ink-700" dir="auto">
            {record.notes}
          </p>
        </section>
      ) : null}

      {/* The label. A dashed rule and a note to cut, because the alternative is
          a second sheet for four lines of text. */}
      <section className="border-t-2 border-dashed border-ink-400 pt-4">
        <p className="mb-2 text-xs text-ink-500">{t('cutHere')}</p>
        <div className="max-w-sm rounded-lg border border-ink-400 p-3">
          <p className="text-sm font-semibold" dir="auto">
            {clinic.name}
          </p>
          <p className="mt-1 text-sm" dir="auto">
            {patient?.full_name ?? '—'}
            {formulaName ? ` · ${formulaName}` : ''}
          </p>
          <p className="mt-1 text-base font-medium" dir="auto">
            {dosing || '—'}
          </p>
          <p className="mt-1 text-xs text-ink-600" dir="ltr">
            {formatDate(new Date(record.dispensed_at))}
          </p>
        </div>
      </section>

      <footer className="border-t border-ink-200 pt-3 text-xs text-ink-600">
        {t('keepAway')}
      </footer>
    </article>
  );
}
