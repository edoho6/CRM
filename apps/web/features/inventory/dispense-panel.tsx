'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Check, Columns2, Plus, Printer, Sprout, X } from 'lucide-react';
import {
  Dash,
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  Combobox,
  Dialog,
  DialogContent,
  Field,
  LtrInput,
  Select,
  SegmentedControl,
  Spinner,
  Table,
  TableWrapper,
  Td,
  Th,
  Textarea,
  type ComboboxOption,
  type ComboboxValue,
} from '@clinic/ui';
import {
  DOSE_TIMINGS,
  HERB_PREPARATIONS,
  preparationUnit,
  preparationUnits,
  type DoseTiming,
  type HerbPreparation,
  type HerbUnit,
  type Locale,
} from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type {
  DispensingRecordWithItems,
  Herb,
  HerbFormulaWithItems,
  TreatmentProtocol,
} from '@clinic/db/types';
import { formulaPrimaryName, herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { ProtocolPicker } from '@/features/encounters/protocol-picker';
import {
  prescriptionKey,
  useCurrentPrescriptionPublisher,
} from '@/features/encounters/current-prescription-context';
import { GranuleCalculator } from './granule-calculator';
import { multiplierForTotal, round2, splitByParts } from './dosing';
import { dispenseHerbs, recordPrescription } from './actions';
import { formatDate, formatDateTime } from '@clinic/i18n';
import { ReferenceChip } from '@/features/reference/reference-sheet';
import { cn } from '@clinic/ui/cn';

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
  protocols,
  tracksInventory,
  disabled,
}: {
  encounterId: string;
  formulas: HerbFormulaWithItems[];
  herbs: Herb[];
  records: DispensingRecordWithItems[];
  /** Saved protocols, for filling the prescription in from one. */
  protocols: TreatmentProtocol[];
  /** False when the clinic holds no stock: the panel records a prescription instead. */
  tracksInventory: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('inventory.dispensing');
  const tPrep = useTranslations('inventory.preparation');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tProtocols = useTranslations('protocols');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();

  const [mode, setMode] = useState<'formula' | 'herb'>('formula');
  const [formulaChoice, setFormulaChoice] = useState<ComboboxValue | null>(null);
  const [preparation, setPreparation] = useState<HerbPreparation>('dried_herb');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [rows, setRows] = useState<HerbRow[]>([{ choice: null, dose: '' }]);
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState<HerbUnit>(() => preparationUnit('dried_herb'));
  const [dosesPerDay, setDosesPerDay] = useState('');
  const [doseTiming, setDoseTiming] = useState<DoseTiming | ''>('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{
    key: string;
    values?: Record<string, string | number>;
  } | null>(null);

  const unit = preparationUnit(preparation);

  // The list of past prescriptions: one opened for its herbs, and a set ticked
  // for comparison. Comparing is a mode so the checkboxes exist only while it is on.
  const [detail, setDetail] = useState<DispensingRecordWithItems | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }
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

  /*
   * Tell the comparison what is being given.
   *
   * What is being composed comes first: a formula picked or a herb line filled
   * in is the answer to "what am I giving now" even before it is saved, and it
   * is flagged as a draft so the panel can say so. With nothing in hand, the
   * latest record for this treatment stands in. With neither, nothing.
   *
   * Names travel with a pinyin key so the other side can match them across
   * languages — see the context for why.
   */
  const publish = useCurrentPrescriptionPublisher();
  useEffect(() => {
    // How the draft is taken, as typed so far. Empty figures stay null: a
    // dose of nothing is not a dose.
    const draftMeta = (total: number | null) => ({
      preparation,
      total,
      unit,
      doseAmount: Number(doseAmount) > 0 ? Number(doseAmount) : null,
      doseUnit,
      dosesPerDay: Number(dosesPerDay) > 0 ? Number(dosesPerDay) : null,
      doseTiming: doseTiming || null,
    });
    if (mode === 'formula' && selectedFormula) {
      publish({
        formula: formulaPrimaryName(selectedFormula, locale),
        formulaId: selectedFormula.id,
        draft: true,
        meta: draftMeta(round2(formulaBookDose * multiplier) || null),
        herbs: selectedFormula.items.map((item) => ({
          key: prescriptionKey(item.herb?.pinyin_name, herbPrimaryName(item.herb, locale)),
          name: herbPrimaryName(item.herb, locale),
          quantity: round2(Number(item.dosage) * multiplier),
          herbId: item.herb?.id ?? null,
        })),
      });
      return;
    }
    if (mode === 'formula' && formulaChoice?.label.trim()) {
      publish({ formula: formulaChoice.label.trim(), draft: true, herbs: [], meta: draftMeta(null) });
      return;
    }
    if (mode === 'herb' && herbLines.length > 0) {
      publish({
        formula: null,
        draft: true,
        meta: draftMeta(herbLinesTotal || null),
        herbs: herbLines.map((line) => {
          const herb = herbs.find((entry) => entry.id === line.choice.id);
          return {
            key: prescriptionKey(herb?.pinyin_name, line.choice.label),
            name: line.choice.label,
            quantity: line.quantity,
            herbId: herb?.id ?? null,
          };
        }),
      });
      return;
    }
    const latest = records[0] ?? null;
    if (latest) {
      publish({
        formula: latest.formula ? formulaPrimaryName(latest.formula, locale) : null,
        formulaId: latest.formula?.id ?? null,
        draft: false,
        meta: {
          preparation: latest.preparation,
          total: recordTotal(latest) || null,
          unit: latest.items[0]?.unit ?? null,
          doseAmount: latest.dose_amount === null ? null : Number(latest.dose_amount),
          doseUnit: latest.dose_unit,
          dosesPerDay: latest.doses_per_day === null ? null : Number(latest.doses_per_day),
          doseTiming: latest.dose_timing,
        },
        herbs: latest.items.map((item) => {
          const name = item.herb ? herbPrimaryName(item.herb, locale) : (item.custom_name ?? '—');
          return {
            key: prescriptionKey(item.herb?.pinyin_name, name),
            name,
            quantity: Number(item.quantity),
            herbId: item.herb?.id ?? null,
          };
        }),
      });
      return;
    }
    publish(null);
    // `herbLines` is rebuilt every render; the publisher itself compares what it
    // is given against what it has, so the extra calls cost nothing.
  }, [publish, mode, selectedFormula, formulaChoice, herbLines, records, herbs, locale, multiplier]);

  function reset() {
    setFormulaChoice(null);
    setRows([{ choice: null, dose: '' }]);
    setNotes('');
    setTotalQuantity('');
    setDoseAmount('');
    setDosesPerDay('');
    setDoseTiming('');
    setDoseUnit(preparationUnit(preparation));
  }

  /**
   * Fills the prescription in from a protocol.
   *
   * Replaces rather than appends, unlike the points: two prescriptions merged
   * into one is not a bigger prescription, it is a different and wrong one. The
   * fields stay editable afterwards, which is the whole contract of a protocol.
   *
   * A herb the protocol names but the catalogue no longer carries still comes
   * through, as a typed line — the same way an off-catalogue herb has always
   * been allowed here.
   */
  function applyProtocol(protocol: TreatmentProtocol) {
    setError(null);

    if (protocol.formula_id) {
      const formula = formulas.find((entry) => entry.id === protocol.formula_id);
      setMode('formula');
      setFormulaChoice(
        formula
          ? { id: formula.id, label: formulaPrimaryName(formula, locale) }
          : { id: protocol.formula_id, label: '' },
      );
    } else if (protocol.herbs.length > 0) {
      setMode('herb');
      setRows(
        protocol.herbs.map((entry) => {
          const herb = entry.herb_id ? herbs.find((h) => h.id === entry.herb_id) : undefined;
          return {
            choice: herb
              ? { id: herb.id, label: herbPrimaryName(herb, locale) }
              : { id: '', label: entry.name },
            dose: entry.quantity === null ? '' : String(entry.quantity),
          };
        }),
      );
    }

    if (protocol.preparation) setPreparation(protocol.preparation as HerbPreparation);
    // The protocol's own unit when it has one, otherwise the default for its
    // format — never the unit left over from the last prescription.
    setDoseUnit(
      (protocol.dose_unit as HerbUnit | null) ??
        preparationUnit((protocol.preparation as HerbPreparation | null) ?? preparation),
    );
    setDoseAmount(protocol.dose_amount === null ? '' : String(protocol.dose_amount));
    setDosesPerDay(protocol.doses_per_day === null ? '' : String(protocol.doses_per_day));
    setDoseTiming((protocol.dose_timing as DoseTiming | null) ?? '');
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
      // How the patient takes it, as opposed to how much was dispensed. The
      // unit is not asked for separately — it follows from the preparation, the
      // same way it does everywhere else in this panel.
      dose_amount: doseAmount,
      // What the patient measures, which is not necessarily what the stock was
      // weighed in — the lines below still carry `unit` for that.
      dose_unit: doseUnit,
      doses_per_day: dosesPerDay,
      dose_timing: doseTiming,
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
      {/* Closed until it is wanted.

          Not every treatment involves herbs — plenty are needles alone — and an
          open prescription form with a formula search, a herb table and four
          dosing fields was the largest thing on the page for practitioners who
          never used it. Shut, it is one line; open, it is exactly what it was.

          Past prescriptions stay visible below, because those are a record of
          what happened rather than a form to fill in. */}
      {!disabled ? (
        <Collapsible
          title={tracksInventory ? t('title') : t('prescriptionTitle')}
          icon={<Sprout className="h-4 w-4" aria-hidden />}
        >
          <div className="space-y-4">
            {error ? <Alert tone="danger">{renderError()}</Alert> : null}

            {/* Above the formula/herb switch, because applying a protocol is
                what decides which of the two you are in. */}
            <ProtocolPicker
              protocols={protocols}
              disabled={disabled || isPending}
              onApply={applyProtocol}
              label={tProtocols('applyPrescription')}
            />

            <div className="flex flex-wrap items-center gap-1">
              <SegmentedControl
                label={t('modeLabel')}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'formula', label: t('formula') },
                  { value: 'herb', label: t('herb') },
                ]}
              />
              <GranuleCalculator className="ms-auto" />
            </div>

            {/* Decided once for the whole prescription, so it sits above the list
                rather than being repeated against every line. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tPrep('label')} htmlFor="preparation">
                <Select
                  id="preparation"
                  value={preparation}
                  onChange={(event) => {
                    const next = event.target.value as HerbPreparation;
                    setPreparation(next);
                    // Grams is not an option for capsules. Rather than leave an
                    // impossible unit selected, the default for the new format
                    // is taken — the picker beside the amount is one click away
                    // if it is the wrong one.
                    setDoseUnit(preparationUnit(next));
                  }}
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
                  <h3 className="text-sm font-semibold text-ink-900">{t('herbs')}</h3>
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
                        className="w-24 shrink-0 pb-2 text-xs tabular-nums text-ink-700"
                      >
                        {line ? `${format.number(line.quantity)} ${tUnit(unit)}` : '—'}
                      </span>

                      <button
                        type="button"
                        aria-label={tc('delete')}
                        onClick={() => setRows(rows.filter((_, position) => position !== index))}
                        className="mb-1 rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
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
                      <span className="tabular-nums">
                        {format.number(herbLinesTotal)} {tUnit(unit)}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {/* How to take it. Under the list on purpose: it is the last thing
                decided and the first thing the patient reads, and it applies to
                the whole prescription rather than to any one line.

                It was previously written into the free-text note, where it
                cannot be read back, cannot be printed onto a label, and cannot
                be carried into the next prescription. */}
            <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
              <h3 className="mb-2 text-sm font-medium text-ink-800">{t('doseTitle')}</h3>
              {/*
                One sentence, one row: how much, of what, how often.
                When to take it goes underneath.

                Sized rather than shared equally. This panel lives in the side
                column of the treatment page, about a third of the width, and an
                even three-way split gave each field roughly a hundred pixels —
                too narrow to read a number in, let alone type one. The two
                numbers are two or three digits and get fixed widths; the unit
                takes whatever is left, because it is the only one holding a
                word.
              */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  {/* The unit is chosen, not stated. It used to be printed into
                      the label from the preparation, which made "1 gram" the
                      only instruction expressible — and a patient told to take
                      one gram of loose herb has no way to measure it. A teaspoon
                      they have. */}
                  <Field
                    label={t('doseAmount')}
                    htmlFor="dose_amount"
                    density="compact"
                    className="w-20 shrink-0"
                  >
                    <LtrInput
                      id="dose_amount"
                      type="number"
                      min={0}
                      step="0.1"
                      value={doseAmount}
                      onChange={(event) => setDoseAmount(event.target.value)}
                    />
                  </Field>

                  <Field
                    label={t('doseUnit')}
                    htmlFor="dose_unit"
                    density="compact"
                    className="min-w-24 flex-1"
                  >
                    <Select
                      id="dose_unit"
                      value={doseUnit}
                      onChange={(event) => setDoseUnit(event.target.value as HerbUnit)}
                    >
                      {preparationUnits(preparation).map((option) => (
                        <option key={option} value={option}>
                          {tUnit(option)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {/* The preparation is chosen once at the top of the panel, so
                      repeating it here said nothing. What was actually missing
                      is how often — "1g after food" is not an instruction until
                      you know whether that is once a day or three times. */}
                  <Field
                    label={t('dosesPerDay')}
                    htmlFor="doses_per_day"
                    density="compact"
                    className="w-20 shrink-0"
                  >
                    <LtrInput
                      id="doses_per_day"
                      type="number"
                      min={1}
                      max={12}
                      step={1}
                      value={dosesPerDay}
                      onChange={(event) => setDosesPerDay(event.target.value)}
                    />
                  </Field>
                </div>

                <div>
                <Field label={t('doseTiming')} htmlFor="dose_timing" density="compact">
                  <Select
                    id="dose_timing"
                    value={doseTiming}
                    onChange={(event) => setDoseTiming(event.target.value as DoseTiming | '')}
                  >
                    <option value="">—</option>
                    {DOSE_TIMINGS.map((option) => (
                      <option key={option} value={option}>
                        {t(`timing.${option}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                </div>
              </div>
            </div>

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
                      <span className="shrink-0 tabular-nums text-ink-700">
                        {format.number(round2(Number(item.dosage) * multiplier))} {tUnit(unit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-ink-200 pt-1.5 text-sm font-medium">
                  <span>{tc('total')}</span>
                  <span className="tabular-nums">
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
          </div>
        </Collapsible>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('history')}</CardTitle>
          {/* Comparing is a mode, entered on purpose: tick two or more, then
              press. Outside it the list has no checkboxes to catch the eye. */}
          {records.length > 1 ? (
            <div className="flex items-center gap-1.5">
              {comparing ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setComparing(false);
                      setSelectedIds([]);
                    }}
                  >
                    {tc('cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={selectedIds.length < 2}
                    onClick={() => setCompareOpen(true)}
                  >
                    <Columns2 className="h-4 w-4" aria-hidden />
                    {t('compareSelected', { count: selectedIds.length })}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="ghost" onClick={() => setComparing(true)}>
                  <Columns2 className="h-4 w-4" aria-hidden />
                  {t('compare')}
                </Button>
              )}
            </div>
          ) : null}
        </CardHeader>
        <CardBody className="p-0">
          {records.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">{t('empty')}</p>
          ) : (
            <>
              {comparing ? (
                <p className="px-4 pt-3 text-xs text-ink-600">{t('selectToCompare')}</p>
              ) : null}
              {/* One line per prescription: when, what, how much in total, and
                  the day's dose — which is the figure asked about on the phone
                  a week later, so it is the large one. The herbs are one click
                  in, not spread down the page. */}
              <ul className="divide-y divide-ink-100">
                {records.map((record) => {
                  const daily = dailyDose(record);
                  const name = recordTitle(record, locale, t('herbs'));
                  const checked = selectedIds.includes(record.id);
                  return (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
                    >
                      {comparing ? (
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleSelected(record.id)}
                          aria-label={name}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setDetail(record)}
                          title={t('details')}
                          dir="auto"
                          className="max-w-full truncate text-start text-sm font-medium text-jade-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {name}
                        </button>
                        {/* How it is taken, in one line and large: the form,
                            then the day's dose — the two things asked about
                            on the phone a week later. The date is a line of
                            its own underneath, and the total sits at the end. */}
                        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="text-sm font-semibold text-ink-900">
                            {record.preparation ? tPrep(record.preparation) : <Dash />}
                          </span>
                          {daily ? (
                            <span className="text-sm font-semibold text-ink-900">
                              <span className="tabular-nums">
                                {format.number(daily.amount)} {tUnit(daily.unit)}
                              </span>{' '}
                              {t('perDaySuffix')}
                            </span>
                          ) : (
                            <span className="text-sm text-ink-500">{t('noDosing')}</span>
                          )}
                          <span className="text-xs text-ink-500">
                            {t('totalShort')}{' '}
                            <span className="tabular-nums">
                              {format.number(recordTotal(record))} {tUnit(record.items[0]?.unit ?? unit)}
                            </span>
                          </span>
                        </p>
                        <p className="text-xs text-ink-500" dir="ltr">
                          {formatDateTime(new Date(record.dispensed_at))}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <DispensingDetailDialog record={detail} onClose={() => setDetail(null)} locale={locale} />
      <DispensingCompareDialog
        open={compareOpen}
        records={records.filter((record) => selectedIds.includes(record.id))}
        onClose={() => setCompareOpen(false)}
        locale={locale}
      />
    </div>
  );
}

/** Amount per dose times doses per day. Null when either half is missing. */
function dailyDose(record: DispensingRecordWithItems): { amount: number; unit: HerbUnit } | null {
  if (!record.dose_amount || !record.doses_per_day) return null;
  return {
    amount: round2(Number(record.dose_amount) * Number(record.doses_per_day)),
    unit: record.dose_unit ?? 'gram',
  };
}

function recordTotal(record: DispensingRecordWithItems): number {
  return round2(record.items.reduce((sum, item) => sum + Number(item.quantity), 0));
}

/** The same herb in two prescriptions must match: catalogue id, or the typed name. */
function itemKey(item: DispensingRecordWithItems['items'][number]): string {
  return item.herb ? `herb:${item.herb.id}` : `custom:${(item.custom_name ?? '').trim().toLowerCase()}`;
}

function itemLabel(item: DispensingRecordWithItems['items'][number], locale: Locale): string {
  return item.herb ? herbPrimaryName(item.herb, locale) : (item.custom_name ?? '—');
}

/**
 * One prescription, opened from the list: the dose large, the herbs and their
 * weights, the notes, and the way to the printed sheet.
 */
function DispensingDetailDialog({
  record,
  onClose,
  locale,
}: {
  record: DispensingRecordWithItems | null;
  onClose: () => void;
  locale: Locale;
}) {
  const t = useTranslations('inventory.dispensing');
  const tc = useTranslations('common');
  const tUnit = useTranslations('inventory.unit');
  const tPrep = useTranslations('inventory.preparation');
  const format = useFormatter();

  const daily = record ? dailyDose(record) : null;

  return (
    <Dialog open={record !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {record ? (
        <DialogContent
          title={recordTitle(record, locale, t('herbs'))}
          closeLabel={tc('close')}
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-500">
              <span dir="ltr">{formatDateTime(new Date(record.dispensed_at))}</span>
              {record.preparation ? ` · ${tPrep(record.preparation)}` : ''}
            </p>

            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <p className="text-xs font-medium text-ink-600">{t('dailyDose')}</p>
              <p className="mt-0.5 text-2xl font-semibold text-ink-900">
                {daily ? (
                  <span className="tabular-nums">
                    {format.number(daily.amount)} {tUnit(daily.unit)}
                  </span>
                ) : (
                  <span className="text-base font-normal text-ink-500">{t('noDosing')}</span>
                )}
              </p>
              {record.dose_amount || record.doses_per_day || record.dose_timing ? (
                <p className="mt-1 text-sm text-ink-700">
                  {[
                    record.dose_amount
                      ? `${format.number(Number(record.dose_amount))} ${tUnit(record.dose_unit ?? 'gram')} ${t('perDose')}`
                      : null,
                    record.doses_per_day
                      ? t('perDay', { count: Number(record.doses_per_day) })
                      : null,
                    record.dose_timing ? t(`timing.${record.dose_timing}`) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
              {record.days_supply ? (
                <p className="mt-0.5 text-xs text-ink-600">{record.days_supply}</p>
              ) : null}
            </div>

            {record.items.length > 0 ? (
              <TableWrapper className="rounded-lg">
                <Table>
                  <thead>
                    <tr>
                      <Th>{tc('name')}</Th>
                      <Th className="text-end">{tc('quantity')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.items.map((item) => (
                      <tr key={item.id}>
                        <Td dir="auto">
                          <ReferenceChip
                            target={{ kind: 'herb', id: item.herb?.id ?? null, pinyin: item.herb?.pinyin_name ?? null, name: item.custom_name, label: itemLabel(item, locale) }}
                            dir="auto"
                          >
                            {itemLabel(item, locale)}
                          </ReferenceChip>
                        </Td>
                        <Td className="text-end">
                          <span className="tabular-nums">
                            {format.number(Number(item.quantity))} {tUnit(item.unit)}
                          </span>
                        </Td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <Td>{tc('total')}</Td>
                      <Td className="text-end">
                        <span className="tabular-nums">
                          {format.number(recordTotal(record))}{' '}
                          {tUnit(record.items[0]?.unit ?? 'gram')}
                        </span>
                      </Td>
                    </tr>
                  </tbody>
                </Table>
              </TableWrapper>
            ) : null}

            {record.notes ? (
              <p className="text-sm whitespace-pre-wrap text-ink-700" dir="auto">
                {record.notes}
              </p>
            ) : null}

            <div className="flex justify-end">
              {/* A new tab, because printing is the point and losing the
                  treatment behind it is a needless step back. */}
              <Button asChild variant="secondary" size="sm">
                <a href={`/print/prescription/${record.id}`} target="_blank" rel="noopener">
                  <Printer className="h-4 w-4" aria-hidden />
                  {t('printPrescription')}
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/**
 * Two or more prescriptions side by side, one row per herb.
 *
 * The rows that matter are the ones a herb appears in more than once — that is
 * the continuity of a course of treatment — so they are tinted and ticked, and
 * a herb whose dose moved between prescriptions says so beside its name. The
 * count at the top answers the question before the table is read. Colour is
 * never alone: the tick, the badge and the legend all say it in words.
 */
function DispensingCompareDialog({
  open,
  records,
  onClose,
  locale,
}: {
  open: boolean;
  records: DispensingRecordWithItems[];
  onClose: () => void;
  locale: Locale;
}) {
  const t = useTranslations('inventory.dispensing');
  const tc = useTranslations('common');
  const tUnit = useTranslations('inventory.unit');
  const format = useFormatter();

  const rows = useMemo(() => {
    const byKey = new Map<
      string,
      { key: string; label: string; unit: HerbUnit; quantities: Map<string, number> }
    >();
    for (const record of records) {
      for (const item of record.items) {
        const key = itemKey(item);
        const row = byKey.get(key) ?? {
          key,
          label: itemLabel(item, locale),
          unit: item.unit,
          quantities: new Map<string, number>(),
        };
        row.quantities.set(record.id, Number(item.quantity));
        byKey.set(key, row);
      }
    }
    // Shared first, most shared at the top; then by name.
    return [...byKey.values()].sort(
      (a, b) => b.quantities.size - a.quantities.size || a.label.localeCompare(b.label),
    );
  }, [records, locale]);

  const shared = rows.filter((row) => row.quantities.size > 1);
  const inAll = rows.filter((row) => row.quantities.size === records.length).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {open && records.length > 0 ? (
        <DialogContent title={t('compareTitle')} closeLabel={tc('close')} className="max-w-4xl">
          <div className="space-y-3">
            <p className="text-sm text-ink-800">
              {t('sharedHerbs', { shared: shared.length, total: rows.length })}
              {records.length > 2 ? ` · ${t('inAll')}: ${inAll}` : ''}
            </p>

            <TableWrapper className="rounded-lg">
              <Table>
                <thead>
                  <tr>
                    <Th>{tc('name')}</Th>
                    {/* The name first, because that is what the columns are
                        being compared as; the date under it is which time. */}
                    {records.map((record) => (
                      <Th key={record.id} className="text-end">
                        <span className="block truncate" dir="auto">
                          {recordTitle(record, locale, t('herbs'))}
                        </span>
                        <span className="block font-normal text-ink-500" dir="ltr">
                          {formatDate(record.dispensed_at)}
                        </span>
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const values = [...row.quantities.values()];
                    const isShared = row.quantities.size > 1;
                    const differs =
                      isShared && Math.max(...values) - Math.min(...values) > 0.001;
                    return (
                      <tr key={row.key} className={cn(isShared && 'bg-jade-50')}>
                        <Td dir="auto">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {isShared ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-jade-700" aria-hidden />
                            ) : null}
                            {row.label}
                            {differs ? <Badge tone="warning">{t('doseDiffers')}</Badge> : null}
                          </span>
                        </Td>
                        {records.map((record) => {
                          const quantity = row.quantities.get(record.id);
                          return (
                            <Td key={record.id} className="text-end">
                              <span className="tabular-nums">
                                {quantity === undefined
                                  ? '—'
                                  : `${format.number(quantity)} ${tUnit(row.unit)}`}
                              </span>
                            </Td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="font-medium">
                    <Td>{tc('total')}</Td>
                    {records.map((record) => (
                      <Td key={record.id} className="text-end">
                        <span className="tabular-nums">
                          {format.number(recordTotal(record))}{' '}
                          {tUnit(record.items[0]?.unit ?? 'gram')}
                        </span>
                      </Td>
                    ))}
                  </tr>
                  <tr>
                    <Td>{t('dailyDose')}</Td>
                    {records.map((record) => {
                      const daily = dailyDose(record);
                      return (
                        <Td key={record.id} className="text-end">
                          <span className="tabular-nums">
                            {daily ? `${format.number(daily.amount)} ${tUnit(daily.unit)}` : '—'}
                          </span>
                        </Td>
                      );
                    })}
                  </tr>
                </tbody>
              </Table>
            </TableWrapper>

            <p className="text-xs text-ink-600">{t('compareLegend')}</p>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/**
 * What a prescription is called.
 *
 * The formula's name when there is one. A bespoke mix has no name of its own,
 * and "herbs" as a heading says nothing about which — so the herbs themselves
 * are the name, the first three and a count of the rest.
 */
function recordTitle(record: DispensingRecordWithItems, locale: Locale, fallback: string): string {
  if (record.formula) return formulaPrimaryName(record.formula, locale);
  const names = record.items.map((item) => itemLabel(item, locale)).filter((name) => name && name !== '—');
  if (names.length === 0) return fallback;
  if (names.length <= 3) return names.join(' · ');
  return `${names.slice(0, 3).join(' · ')} +${names.length - 3}`;
}
