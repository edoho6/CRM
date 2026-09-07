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
  Input,
  LtrInput,
  Select,
  SortBody,
  SortTh,
  SortableTable,
  Spinner,
  TableWrapper,
  Td,
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
import { dispenseHerbs, recordPrescription } from './actions';

interface HerbRow {
  /** Null when the name was typed rather than chosen — an off-catalogue line. */
  choice: ComboboxValue | null;
  quantity: string;
}

/**
 * What was prescribed, written the way it is dictated.
 *
 * Two ways in, and they are named for what they are: a formula, or individual
 * herbs. Both are typed rather than scrolled — the catalogue holds 170 formulas
 * and 376 herbs, and a `<select>` of either is unusable when the name is known
 * and the list is not.
 *
 * Anything can be prescribed, including things the catalogue has never carried:
 * a patent remedy, a supplement, a formula modified past recognition. Refusing
 * those does not stop them being prescribed, it just moves the record onto paper
 * where nothing can find it again — so a typed name that matches nothing is kept
 * verbatim.
 *
 * Amounts are amounts. The old multiplier asked "how many times the book dose",
 * which is a calculation to do in your head before you can answer; this asks for
 * grams or millilitres, and which of the two is decided by the preparation
 * rather than by a second menu that can disagree with it.
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
  const [daysSupply, setDaysSupply] = useState('');
  const [rows, setRows] = useState<HerbRow[]>([{ choice: null, quantity: '' }]);
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ key: string; values?: Record<string, string | number> } | null>(
    null,
  );

  const unit = preparationUnit(preparation);

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

  const filledRows = rows.filter((row) => row.choice && Number(row.quantity) > 0);

  /*
   * The book dose of the formula — the sum of its lines as written.
   *
   * Asking for a total in grams is the natural way to prescribe ("make up 100g
   * of this"), while the database scales a formula by a multiplier. The
   * conversion belongs here, once, rather than in the practitioner's head every
   * time: how many times the written formula does the requested weight come to.
   *
   * With no total given the formula is dispensed exactly as written.
   */
  const formulaBookDose = selectedFormula
    ? selectedFormula.items.reduce((sum, item) => sum + Number(item.dosage), 0)
    : 0;

  const requestedTotal = Number(totalQuantity);
  const multiplier =
    mode === 'formula' && requestedTotal > 0 && formulaBookDose > 0
      ? requestedTotal / formulaBookDose
      : 1;

  /* Enough to send: a formula (catalogued or named) or at least one herb line. */
  const canSubmit =
    mode === 'formula' ? Boolean(formulaChoice?.label.trim()) : filledRows.length > 0;

  function reset() {
    setFormulaChoice(null);
    setRows([{ choice: null, quantity: '' }]);
    setNotes('');
    setTotalQuantity('');
    setDaysSupply('');
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
      days_supply: daysSupply,
      multiplier,
      items:
        mode === 'herb'
          ? filledRows.map((row) => ({
              herb_id: row.choice?.id ?? null,
              name: row.choice?.id ? '' : (row.choice?.label ?? ''),
              quantity: Number(row.quantity),
              preparation,
              unit,
            }))
          : [],
      notes,
    };

    startTransition(async () => {
      // With no shelf there is nothing to allocate and nothing that can come up
      // short, so the write goes to the plain recorder rather than the allocator.
      // A prescription naming something off-catalogue also cannot be allocated,
      // whatever the clinic holds.
      const allocatable = tracksInventory && payload.formula_id !== null && !payload.custom_formula;
      const result = allocatable
        ? await dispenseHerbs(payload)
        : await recordPrescription(payload);

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

            <div className="flex gap-1">
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
                {rows.map((row, index) => (
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
                    <div className="flex items-center gap-1">
                      <LtrInput
                        aria-label={tc('quantity')}
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-24"
                        value={row.quantity}
                        onChange={(event) =>
                          setRows(
                            rows.map((entry, position) =>
                              position === index ? { ...entry, quantity: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                      <span className="shrink-0 text-xs text-ink-600">{tUnit(unit)}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={tc('delete')}
                      onClick={() => setRows(rows.filter((_, position) => position !== index))}
                      className="mb-1 rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRows([...rows, { choice: null, quantity: '' }])}
                >
                  <Plus className="h-4 w-4" />
                  {tc('add')}
                </Button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
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

              {mode === 'formula' ? (
                <Field label={`${tc('quantity')} · ${tUnit(unit)}`} htmlFor="total_quantity">
                  <LtrInput
                    id="total_quantity"
                    type="number"
                    min={0}
                    step="0.01"
                    value={totalQuantity}
                    onChange={(event) => setTotalQuantity(event.target.value)}
                  />
                </Field>
              ) : null}

              {/* Free text on purpose: "10 ימים", "עד הביקור הבא", "שבועיים ואז
                  נראה". The instruction lives in the wording, and an integer
                  field throws away exactly the part that carries it. */}
              <Field label={t('daysSupply')} htmlFor="days_supply">
                <Input
                  id="days_supply"
                  value={daysSupply}
                  placeholder={t('daysSupplyPlaceholder')}
                  onChange={(event) => setDaysSupply(event.target.value)}
                />
              </Field>
            </div>

            <Field label={tc('notes')} htmlFor="dispense_notes">
              <Input
                id="dispense_notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>

            {/* The composition of a catalogued formula, so what is about to be
                handed over is visible before it is. A named formula has no
                composition to show, which is itself worth seeing. */}
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
                      {/* Scaled to the requested total, so what is shown is what
                          will be weighed rather than what the book says. */}
                      <span className="shrink-0 tabular-nums text-ink-600" dir="ltr">
                        {format.number(Math.round(Number(item.dosage) * multiplier * 100) / 100)}{' '}
                        {tUnit(unit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-ink-200 pt-1.5 text-sm font-medium">
                  <span>{tc('total')}</span>
                  <span dir="ltr" className="tabular-nums">
                    {format.number(
                      Math.round((requestedTotal > 0 ? requestedTotal : formulaBookDose) * 100) / 100,
                    )}{' '}
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
                      {record.days_supply ? ` · ${record.days_supply}` : ''}
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
                  {record.notes ? <p className="mt-1 text-xs text-ink-500">{record.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
