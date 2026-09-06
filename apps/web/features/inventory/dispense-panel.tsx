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
} from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { DispensingRecordWithItems, Herb, HerbFormulaWithItems } from '@clinic/db/types';
import { formulaPrimaryName, herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { dispenseHerbs, recordPrescription } from './actions';

interface AdHocRow {
  herb_id: string;
  quantity: string;
}

/**
 * Dispensing panel shown inside an open treatment.
 *
 * Two ways in: pick a saved formula and scale it (multiplier 7 for a week), or
 * build an ad-hoc list. Both go to the same database function, which is what
 * guarantees stock is never deducted twice or half-deducted.
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
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();

  const [mode, setMode] = useState<'formula' | 'adhoc'>('formula');
  const [formulaId, setFormulaId] = useState('');
  const [multiplier, setMultiplier] = useState('1');
  const [rows, setRows] = useState<AdHocRow[]>([{ herb_id: '', quantity: '' }]);
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ key: string; values?: Record<string, string | number> } | null>(
    null,
  );

  const selectedFormula = useMemo(
    () => formulas.find((formula) => formula.id === formulaId) ?? null,
    [formulas, formulaId],
  );

  const multiplierValue = Number(multiplier) || 1;

  const preview = useMemo(() => {
    if (mode === 'formula') {
      if (!selectedFormula) return [];
      return selectedFormula.items.map((item) => ({
        label: herbPrimaryName(item.herb, locale),
        quantity: Number(item.dosage) * multiplierValue,
        unit: item.unit,
      }));
    }
    return rows
      .filter((row) => row.herb_id && Number(row.quantity) > 0)
      .map((row) => {
        const herb = herbs.find((entry) => entry.id === row.herb_id);
        return {
          label: herbPrimaryName(herb, locale),
          quantity: Number(row.quantity) * multiplierValue,
          unit: herb?.default_unit ?? 'gram',
        };
      });
  }, [mode, selectedFormula, rows, herbs, locale, multiplierValue]);

  const totalWeight = preview.reduce((sum, item) => sum + item.quantity, 0);

  function handleDispense() {
    setError(null);
    const payload = {
      encounter_id: encounterId,
      formula_id: mode === 'formula' ? formulaId || null : null,
      multiplier: multiplierValue,
      items:
        mode === 'adhoc'
          ? rows
              .filter((row) => row.herb_id && Number(row.quantity) > 0)
              .map((row) => ({
                herb_id: row.herb_id,
                quantity: Number(row.quantity),
                unit: herbs.find((herb) => herb.id === row.herb_id)?.default_unit ?? 'gram',
              }))
          : [],
      notes,
    };

    startTransition(async () => {
      // Same payload either way. With no shelf there is nothing to allocate
      // from and nothing that can come up short, so the write goes to the plain
      // recorder rather than the allocator.
      const result = tracksInventory
        ? await dispenseHerbs(payload)
        : await recordPrescription(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFormulaId('');
      setRows([{ herb_id: '', quantity: '' }]);
      setNotes('');
      setMultiplier('1');
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
                {t('fromFormula')}
              </Button>
              <Button
                variant={mode === 'adhoc' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('adhoc')}
              >
                {t('adHoc')}
              </Button>
            </div>

            {mode === 'formula' ? (
              <Field label={t('selectFormula')} htmlFor="formula_id">
                <Select
                  id="formula_id"
                  value={formulaId}
                  onChange={(event) => setFormulaId(event.target.value)}
                >
                  <option value="">{t('selectFormula')}</option>
                  {formulas.map((formula) => (
                    <option key={formula.id} value={formula.id}>
                      {formulaPrimaryName(formula, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        aria-label={t('selectFormula')}
                        value={row.herb_id}
                        onChange={(event) =>
                          setRows(
                            rows.map((entry, position) =>
                              position === index ? { ...entry, herb_id: event.target.value } : entry,
                            ),
                          )
                        }
                      >
                        <option value="">—</option>
                        {herbs.map((herb) => (
                          <option key={herb.id} value={herb.id}>
                            {herbPrimaryName(herb, locale)}
                            {herbSecondaryName(herb, locale) ? ` · ${herbSecondaryName(herb, locale)}` : ''}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <LtrInput
                      aria-label={tc('quantity')}
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={row.quantity}
                      onChange={(event) =>
                        setRows(
                          rows.map((entry, position) =>
                            position === index ? { ...entry, quantity: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={tc('delete')}
                      onClick={() => setRows(rows.filter((_, position) => position !== index))}
                      className="rounded-md p-2 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRows([...rows, { herb_id: '', quantity: '' }])}
                >
                  <Plus className="h-4 w-4" />
                  {tc('add')}
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('multiplier')} htmlFor="multiplier" hint={t('multiplierHint')}>
                <LtrInput
                  id="multiplier"
                  type="number"
                  min={0.5}
                  step="0.5"
                  value={multiplier}
                  onChange={(event) => setMultiplier(event.target.value)}
                />
              </Field>
              <Field label={tc('notes')} htmlFor="dispense_notes">
                <Input
                  id="dispense_notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </div>

            {preview.length > 0 ? (
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
                <p className="mb-1.5 text-xs font-medium text-ink-600">{t('preview')}</p>
                <ul className="space-y-0.5 text-sm">
                  {preview.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-800">{item.label}</span>
                      <span className="shrink-0 tabular-nums text-ink-600" dir="ltr">
                        {format.number(item.quantity)} {tUnit(item.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-ink-200 pt-1.5 text-sm font-medium">
                  <span>{tc('total')}</span>
                  <span dir="ltr" className="tabular-nums">
                    {format.number(totalWeight)}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button onClick={handleDispense} disabled={isPending || preview.length === 0}>
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
            <p className="px-4 py-6 text-center text-sm text-ink-400">{t('empty')}</p>
          ) : (
            <div className="space-y-4 p-4">
              {records.map((record) => (
                <div key={record.id}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      {record.formula
                        ? formulaPrimaryName(record.formula, locale)
                        : t('adHoc')}
                      {Number(record.multiplier) !== 1 ? ` × ${format.number(Number(record.multiplier))}` : ''}
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
                        {record.items.map((item) => (
                          <Tr
                            key={item.id}
                            sort={{
                              name: herbPrimaryName(item.herb, locale),
                              quantity: Number(item.quantity),
                            }}
                          >
                            <Td>{herbPrimaryName(item.herb, locale)}</Td>
                            <Td>
                              <span dir="ltr" className="tabular-nums">
                                {format.number(Number(item.quantity))} {tUnit(item.unit)}
                              </span>
                            </Td>
                          </Tr>
                        ))}
                      </SortBody>
                    </SortableTable>
                  </TableWrapper>
                  {record.notes ? (
                    <p className="mt-1 text-xs text-ink-500">{record.notes}</p>
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
