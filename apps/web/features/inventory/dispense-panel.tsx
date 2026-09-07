'use client';

import { useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Plus, Sprout, X } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Combobox,
  Field,
  LtrInput,
  Select,
  SortBody,
  SortTh,
  SortableTable,
  Spinner,
  TableWrapper,
  Td,
  Textarea,
  Tr,
  type ComboboxOption,
  type ComboboxValue,
} from '@clinic/ui';
import {
  HERB_PREPARATIONS,
  preparationUnit,
  type HerbPreparation,
  type Locale,
} from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { DispensingRecordWithItems, Herb, HerbFormulaWithItems } from '@clinic/db/types';
import { formulaPrimaryName, herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { GranuleCalculator } from './granule-calculator';
import { multiplierForTotal, round2, splitByParts } from './dosing';
import { dispenseHerbs, recordPrescription } from './actions';

interface HerbRow {
  /** Null when the name was typed rather than chosen — an off-catalogue line. */
  choice: ComboboxValue | null;
  /** A relative part when a total is given, otherwise grams as written. */
  dose: string;
}

/**
 * What was prescribed, written the way it is dictated.
 *
 * Two ways in — a formula, or individual herbs — and both are typed rather than
 * scrolled: the catalogue holds 170 formulas and 376 herbs, and a `<select>` of
 * either is unusable when you know the name and the list does not fit on screen.
 * Anything the catalogue has never carried is kept verbatim, because refusing it
 * does not stop it being prescribed, it just moves the record onto paper.
 *
 * The preparation and the total sit above the list rather than beside each line,
 * because they are decided once for the whole prescription. The unit follows
 * from the preparation instead of being a second menu that can disagree with it.
 *
 * With a total given, the numbers against each herb are read as *parts* and the
 * actual weights are worked out from them — put 100g against nine herbs marked
 * 13, 19 and 6 and each one's share is computed. That is the arithmetic a
 * practitioner otherwise does nine times on paper, and it is where the decimal
 * point goes astray. With no total, the numbers are grams exactly as typed.
 */
export function DispensePanel({
  encounterId,
  formulas,
  herbs,
  records,
  tracksInventory,
  disabled,
}: {
  encounterId: string;
  formulas: HerbFormulaWithItems[];
  herbs: Herb[];
  records: DispensingRecordWithItems[];
  /** False when the clinic holds no stock: the panel records a prescription instead. */
  tracksInventory: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('inventory.dispensing');
  const tPrep = useTranslations('inventory.preparation');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();

  const [mode, setMode] = useState<'formula' | 'herb'>('formula');
  const [formulaChoice, setFormulaChoice] = useState<ComboboxValue | null>(null);
  const [preparation, setPreparation] = useState<HerbPreparation>('dried_herb');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [rows, setRows] = useState<HerbRow[]>([{ choice: null, dose: '' }]);
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{
    key: string;
    values?: Record<string, string | number>;
  } | null>(null);

  const unit = preparationUnit(preparation);
  const requestedTotal = Number(totalQuantity);
  const hasTotal = Number.isFinite(requestedTotal) && requestedTotal > 0;

  const formulaOptions: ComboboxOption[] = useMemo(
    () =>
      formulas.map((formula) => ({
        id: formula.id,
        label: formulaPrimaryName(formula, locale),
        secondary: formula.name_pinyin,
        tertiary: formula.name_chinese,
        keywords: [formula.name_english, formula.name_hebrew].filter(Boolean).join(' '),
      })),
    [formulas, locale],
  );

  const herbOptions: ComboboxOption[] = useMemo(
    () =>
      herbs.map((herb) => ({
        id: herb.id,
        label: herbPrimaryName(herb, locale),
        secondary: herbSecondaryName(herb, locale),
        tertiary: herb.chinese_name,
        keywords: [herb.pinyin_name, herb.english_name, herb.hebrew_name].filter(Boolean).join(' '),
      })),
    [herbs, locale],
  );

  const selectedFormula = useMemo(
    () => formulas.find((formula) => formula.id === formulaChoice?.id) ?? null,
    [formulas, formulaChoice],
  );

  const filledRows = rows.filter((row) => row.choice && Number(row.dose) > 0);

  /*
   * The proportional split.
   *
   * The numbers against each herb are relative parts; their sum is the whole.
   * Each herb's weight is its share of the requested total, so nine herbs marked
   * 13/19/6 out of 100g come out as 11.4, 16.7 and 5.3 rather than as the parts
   * themselves. Without a total there is nothing to divide, and the numbers are
   * taken as grams exactly as typed.
   */
  const herbLines = splitByParts(
    filledRows.map((row) => ({ item: row.choice!, dose: Number(row.dose) })),
    hasTotal ? requestedTotal : null,
  ).map((line) => ({ choice: line.item, quantity: line.quantity }));

  const herbLinesTotal = round2(herbLines.reduce((sum, line) => sum + line.quantity, 0));

  /* The book dose of a formula — the sum of its lines as written. Asking for a
     total in grams is the natural way to prescribe; the database scales by a
     multiplier, so the conversion happens here rather than in someone's head. */
  const formulaBookDose = selectedFormula
    ? selectedFormula.items.reduce((sum, item) => sum + Number(item.dosage), 0)
    : 0;

  const multiplier =
    mode === 'formula' ? multiplierForTotal(formulaBookDose, hasTotal ? requestedTotal : null) : 1;

  const canSubmit =
    mode === 'formula' ? Boolean(formulaChoice?.label.trim()) : herbLines.length > 0;

  function reset() {
    setFormulaChoice(null);
    setRows([{ choice: null, dose: '' }]);
    setNotes('');
    setTotalQuantity('');
  }

  function handleSubmit() {
    setError(null);

    const payload = {
      encounter_id: encounterId,
      formula_id: mode === 'formula' ? (formulaChoice?.id ?? null) : null,
      // A formula typed rather than chosen becomes a named line, so the
      // prescription is still a record instead of a blank.
      custom_formula:
        mode === 'formula' && formulaChoice && !formulaChoice.id ? formulaChoice.label : '',
      preparation,
      days_supply: '',
      multiplier: mode === 'formula' ? multiplier : 1,
      items:
        mode === 'herb'
          ? herbLines.map((line) => ({
              herb_id: line.choice.id,
              name: line.choice.id ? '' : line.choice.label,
              // Already the computed weight, so the server stores what was shown.
              quantity: line.quantity,
              preparation,
              unit,
            }))
          : [],
      notes,
    };

    startTransition(async () => {
      // With no shelf there is nothing to allocate and nothing that can come up
      // short, so the write goes to the plain recorder rather than the allocator.
      // A prescription naming something off-catalogue cannot be allocated either,
      // whatever the clinic holds.
      const allocatable = tracksInventory && payload.formula_id !== null && !payload.custom_formula;
      const result = allocatable ? await dispenseHerbs(payload) : await recordPrescription(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function renderError() {
    if (!error) return null;
    if (error.key === 'inventory.dispensing.insufficientStock') {
      return t('insufficientStock', {
        herb: String(error.values?.herb ?? ''),
        required: String(error.values?.required ?? ''),
        available: String(error.values?.available ?? ''),
      });
    }
    if (error.key === 'errors.encounterLocked') return tErrors('encounterLocked');
    if (error.key === 'errors.formulaOrItemsRequired') return tErrors('formulaOrItemsRequired');
    return tc('errorGeneric');
  }

  return (
    <div className="space-y-4">
      {!disabled ? (
        <Card>
          <CardHeader>
            <CardTitle>{tracksInventory ? t('title') : t('prescriptionTitle')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {error ? <Alert tone="danger">{renderError()}</Alert> : null}

            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant={mode === 'formula' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('formula')}
              >
                {t('formula')}
              </Button>
              <Button
                variant={mode === 'herb' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('herb')}
              >
                {t('herb')}
              </Button>
              <GranuleCalculator className="ms-auto" />
            </div>

            {/* Decided once for the whole prescription, so it sits above the list
                rather than being repeated against every line. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tPrep('label')} htmlFor="preparation">
                <Select
                  id="preparation"
                  value={preparation}
                  onChange={(event) => setPreparation(event.target.value as HerbPreparation)}
                >
                  {HERB_PREPARATIONS.map((option) => (
                    <option key={option} value={option}>
                      {tPrep(option)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={`${t('totalQuantity')} · ${tUnit(unit)}`}
                htmlFor="total_quantity"
                hint={mode === 'herb' ? t('totalQuantityHint') : undefined}
              >
                <LtrInput
                  id="total_quantity"
                  type="number"
                  min={0}
                  step="0.01"
                  value={totalQuantity}
                  onChange={(event) => setTotalQuantity(event.target.value)}
                />
              </Field>
            </div>

            {mode === 'formula' ? (
              <Field label={t('formula')} htmlFor="formula_search">
                <Combobox
                  id="formula_search"
                  label={t('formula')}
                  placeholder={t('searchFormula')}
                  options={formulaOptions}
                  value={formulaChoice}
                  onChange={setFormulaChoice}
                  allowCustom
                  emptyCustomHint={t('notInCatalogue')}
                />
              </Field>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-medium text-ink-800">{t('herbs')}</h4>
                  <span className="text-xs text-ink-600">
                    {hasTotal ? t('doseAsParts') : t('doseAsGrams', { unit: tUnit(unit) })}
                  </span>
                </div>

                {rows.map((row, index) => {
                  const line = row.choice
                    ? herbLines.find((entry) => entry.choice === row.choice)
                    : undefined;
                  return (
                    <div key={index} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Combobox
                          label={t('herb')}
                          placeholder={t('searchHerb')}
                          options={herbOptions}
                          value={row.choice}
                          allowCustom
                          emptyCustomHint={t('notInCatalogue')}
                          onChange={(choice) =>
                            setRows(
                              rows.map((entry, position) =>
                                position === index ? { ...entry, choice } : entry,
                              ),
                            )
                          }
                        />
                      </div>

                      <LtrInput
                        aria-label={hasTotal ? t('parts') : tc('quantity')}
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-20"
                        value={row.dose}
                        onChange={(event) =>
                          setRows(
                            rows.map((entry, position) =>
                              position === index ? { ...entry, dose: event.target.value } : entry,
                            ),
                          )
                        }
                      />

                      {/* The computed weight, beside the part it came from, so the
                          split is visible as it is typed rather than only in a
                          summary underneath. */}
                      <span
                        dir="ltr"
                        className="w-24 shrink-0 pb-2 text-xs tabular-nums text-ink-700"
                      >
                        {line ? `${format.number(line.quantity)} ${tUnit(unit)}` : '—'}
                      </span>

                      <button
                        type="button"
                        aria-label={tc('delete')}
                        onClick={() => setRows(rows.filter((_, position) => position !== index))}
                        className="mb-1 rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRows([...rows, { choice: null, dose: '' }])}
                  >
                    <Plus className="h-4 w-4" />
                    {tc('add')}
                  </Button>

                  {herbLines.length > 0 ? (
                    <span className="text-sm font-medium text-ink-800">
                      {tc('total')}{' '}
                      <span dir="ltr" className="tabular-nums">
                        {format.number(herbLinesTotal)} {tUnit(unit)}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            <Field label={tc('notes')} htmlFor="dispense_notes">
              {/* A textarea rather than a single line, and resizable: dosing
                  instructions run to a sentence or two more often than not. */}
              <Textarea
                id="dispense_notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>

            {/* The composition of a catalogued formula, scaled to what was asked
                for, so what is about to be weighed is visible before it is. */}
            {selectedFormula ? (
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
                <p className="mb-1.5 text-xs font-medium text-ink-600">
                  {t('preview')} · {selectedFormula.items.length}
                </p>
                <ul className="space-y-0.5 text-sm">
                  {selectedFormula.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-800">
                        {herbPrimaryName(item.herb, locale)}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-700" dir="ltr">
                        {format.number(round2(Number(item.dosage) * multiplier))} {tUnit(unit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-ink-200 pt-1.5 text-sm font-medium">
                  <span>{tc('total')}</span>
                  <span dir="ltr" className="tabular-nums">
                    {format.number(round2(hasTotal ? requestedTotal : formulaBookDose))}{' '}
                    {tUnit(unit)}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
                {isPending ? <Spinner /> : <Sprout className="h-4 w-4" />}
                {tracksInventory ? t('dispense') : t('prescribe')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('history')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {records.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">{t('empty')}</p>
          ) : (
            <div className="space-y-4 p-4">
              {records.map((record) => (
                <div key={record.id}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      {record.formula ? formulaPrimaryName(record.formula, locale) : t('herb')}
                      {record.preparation ? ` · ${tPrep(record.preparation)}` : ''}
                    </span>
                    <span className="text-xs text-ink-500" dir="ltr">
                      {format.dateTime(new Date(record.dispensed_at), 'dateTime')}
                    </span>
                  </div>
                  <TableWrapper className="rounded-lg">
                    <SortableTable>
                      <thead>
                        <tr>
                          <SortTh sortKey="name">{tc('name')}</SortTh>
                          <SortTh sortKey="quantity">{tc('quantity')}</SortTh>
                        </tr>
                      </thead>
                      <SortBody locale={locale}>
                        {record.items.map((item) => {
                          // A line with no catalogue herb carries its own name.
                          const label = item.herb
                            ? herbPrimaryName(item.herb, locale)
                            : (item.custom_name ?? '—');
                          return (
                            <Tr
                              key={item.id}
                              sort={{ name: label, quantity: Number(item.quantity) }}
                            >
                              <Td>{label}</Td>
                              <Td>
                                <span dir="ltr" className="tabular-nums">
                                  {format.number(Number(item.quantity))} {tUnit(item.unit)}
                                </span>
                              </Td>
                            </Tr>
                          );
                        })}
                      </SortBody>
                    </SortableTable>
                  </TableWrapper>
                  {record.notes ? (
                    <p className="mt-1 text-xs whitespace-pre-wrap text-ink-600">{record.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
