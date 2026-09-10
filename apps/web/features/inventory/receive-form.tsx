'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { PackagePlus, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Combobox,
  Field,
  FieldGrid,
  FormActionBar,
  Input,
  LtrInput,
  Select,
  Spinner,
  type ComboboxOption,
  useToast,
} from '@clinic/ui';
import {
  HERB_PREPARATIONS,
  HERB_UNITS,
  preparationUnit,
  receiveBatchSchema,
  type HerbPreparation,
  type Locale,
} from '@clinic/domain';
import type { z } from 'zod';
import { Link, useRouter } from '@clinic/i18n/navigation';
import type { Herb, Supplier } from '@clinic/db/types';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { receiveBatch } from './actions';
import { NewSupplierDialog } from './supplier-form';
import { DateInput } from '@/components/date-input';

type ReceiveInput = z.input<typeof receiveBatchSchema>;
type ReceiveOutput = z.output<typeof receiveBatchSchema>;

/** "1234.5678" → 1234.5678, or null for anything that is not a number. */
function numberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, places: number): string {
  const factor = 10 ** places;
  return String(Math.round(value * factor) / factor);
}

/**
 * Receiving stock.
 *
 * Writes through the `receive_herb_batch` function so the batch and its opening
 * ledger entry are created together — the running balance is then always
 * explainable by the ledger rather than appearing from nowhere.
 *
 * The herb is found by typing, not scrolled to in a list of four hundred. The
 * price is entered either way round — what the whole delivery cost, or what
 * one unit costs — and the other is worked out, because an invoice says the
 * first and the batch stores the second. Under it a small calculator answers
 * the question that comes up while pricing a prescription: what did 140 g
 * of this cost me?
 */
export function ReceiveForm({
  herbs,
  suppliers: initialSuppliers,
  defaultHerbId,
}: {
  herbs: Herb[];
  suppliers: Supplier[];
  defaultHerbId?: string;
}) {
  const t = useTranslations('inventory.batches');
  const tUnit = useTranslations('inventory.unit');
  const tPrep = useTranslations('inventory.preparation');
  const tSuppliers = useTranslations('inventory.suppliers');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const { toast } = useToast();

  // A supplier added from here joins the list without a round trip.
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [total, setTotal] = useState('');
  const [sample, setSample] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const empty: ReceiveInput = {
    herb_id: defaultHerbId ?? '',
    supplier_id: '',
    batch_number: '',
    quantity: '',
    unit: 'gram',
    preparation: 'dried_herb',
    unit_cost: '',
    expiry_date: '',
    storage_location: '',
    received_date: today,
    notes: '',
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiveInput, unknown, ReceiveOutput>({
    resolver: zodResolver(receiveBatchSchema),
    defaultValues: empty,
  });

  const herbId = watch('herb_id');
  const quantity = numberOrNull(watch('quantity'));
  const unit = watch('unit') ?? 'gram';
  const unitCost = numberOrNull(watch('unit_cost'));

  const herbOptions = useMemo<ComboboxOption[]>(
    () =>
      herbs.map((herb) => ({
        id: herb.id,
        label: herbPrimaryName(herb, locale),
        secondary: herbSecondaryName(herb, locale),
      })),
    [herbs, locale],
  );
  const chosenHerb = herbOptions.find((option) => option.id === herbId) ?? null;

  function onTotalChange(value: string) {
    setTotal(value);
    const amount = numberOrNull(value);
    if (amount !== null && quantity !== null && quantity > 0) {
      setValue('unit_cost', round(amount / quantity, 4), { shouldDirty: true });
    } else if (value === '') {
      setValue('unit_cost', '', { shouldDirty: true });
    }
  }

  function onUnitCostChange(value: string) {
    setValue('unit_cost', value, { shouldDirty: true });
    const cost = numberOrNull(value);
    setTotal(cost !== null && quantity !== null ? round(cost * quantity, 2) : '');
  }

  function onQuantityChange(value: string) {
    setValue('quantity', value, { shouldDirty: true });
    const amount = numberOrNull(value);
    if (unitCost !== null && amount !== null) setTotal(round(unitCost * amount, 2));
  }

  function onPreparationChange(value: HerbPreparation) {
    setValue('preparation', value, { shouldDirty: true });
    // A tincture is not booked in by the gram; the unit follows the form.
    setValue('unit', preparationUnit(value), { shouldDirty: true });
  }

  const sampleAmount = numberOrNull(sample);
  const sampleCost =
    sampleAmount !== null && unitCost !== null ? sampleAmount * unitCost : null;

  function onSubmit(values: ReceiveOutput) {
    setStatus('idle');
    startTransition(async () => {
      const result = await receiveBatch(values);
      if (!result.ok) {
        setStatus('error');
        return;
      }
      toast({ tone: 'success', title: t('received') });
      reset({ ...empty, herb_id: '' });
      setTotal('');
      setSample('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}
      {herbs.length === 0 ? (
        <Alert tone="info">
          {t('noHerbs')}{' '}
          <Link href="/reference/herbs/new" className="font-medium underline underline-offset-2">
            {t('noHerbsAction')}
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <FieldGrid>
            <Field
              label={tc('name')}
              htmlFor="herb_id"
              required
              error={errors.herb_id ? tc('requiredField') : null}
              className="sm:col-span-2"
            >
              <Combobox
                id="herb_id"
                label={tc('name')}
                placeholder={t('chooseHerb')}
                options={herbOptions}
                value={chosenHerb ? { id: chosenHerb.id, label: chosenHerb.label } : null}
                onChange={(choice) =>
                  setValue('herb_id', choice?.id ?? '', { shouldDirty: true, shouldValidate: true })
                }
                disabled={herbs.length === 0}
                autoFocus={!defaultHerbId}
              />
            </Field>

            <Field label={tPrep('label')} htmlFor="preparation">
              <Select
                id="preparation"
                value={watch('preparation') ?? 'dried_herb'}
                onChange={(event) => onPreparationChange(event.target.value as HerbPreparation)}
              >
                {HERB_PREPARATIONS.map((option) => (
                  <option key={option} value={option}>
                    {tPrep(option)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={tc('unit')} htmlFor="unit">
              <Select id="unit" {...register('unit')}>
                {HERB_UNITS.map((option) => (
                  <option key={option} value={option}>
                    {tUnit(option)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('quantityReceived')}
              htmlFor="quantity"
              required
              error={errors.quantity ? tc('requiredField') : null}
            >
              <LtrInput
                id="quantity"
                type="number"
                min={0}
                step="0.01"
                value={watch('quantity') ?? ''}
                onChange={(event) => onQuantityChange(event.target.value)}
              />
            </Field>

            <Field
              label={t('supplier')}
              htmlFor="supplier_id"
              hint={
                <NewSupplierDialog
                  trigger={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-jade-800 underline-offset-2 hover:underline"
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      {tSuppliers('new')}
                    </button>
                  }
                  onCreated={(supplier) => {
                    setSuppliers((current) =>
                      [...current, { ...current[0], ...supplier } as Supplier].sort((a, b) =>
                        a.name.localeCompare(b.name),
                      ),
                    );
                    setValue('supplier_id', supplier.id, { shouldDirty: true });
                  }}
                />
              }
            >
              <Select id="supplier_id" {...register('supplier_id')}>
                <option value="">{t('noSupplier')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('batchNumber')} htmlFor="batch_number">
              <LtrInput id="batch_number" {...register('batch_number')} />
            </Field>

            <Field label={t('totalCost')} htmlFor="total_cost" hint={t('totalCostHint')}>
              <LtrInput
                id="total_cost"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={total}
                onChange={(event) => onTotalChange(event.target.value)}
              />
            </Field>

            <Field label={`${t('unitCost')} · ${tUnit(unit)}`} htmlFor="unit_cost">
              <LtrInput
                id="unit_cost"
                type="number"
                min={0}
                step="0.0001"
                inputMode="decimal"
                value={watch('unit_cost') ?? ''}
                onChange={(event) => onUnitCostChange(event.target.value)}
              />
            </Field>

            {/* What a given amount of this batch cost — the number needed when
                pricing a prescription, worked out here rather than on paper. */}
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 sm:col-span-2">
              <Field label={t('costFor')} htmlFor="cost_sample" hint={t('costForHint')} density="compact">
                <span className="flex flex-wrap items-center gap-2">
                  <LtrInput
                    id="cost_sample"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    compact
                    value={sample}
                    onChange={(event) => setSample(event.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-ink-700">{tUnit(unit)}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink-900" dir="ltr">
                    {sampleCost !== null ? format.number(sampleCost, 'currency') : '—'}
                  </span>
                </span>
              </Field>
            </div>

            <Field label={t('expiryDate')} htmlFor="expiry_date">
              <DateInput
                id="expiry_date"
                value={watch('expiry_date') ?? ''}
                onChange={(event) => setValue('expiry_date', event.target.value, { shouldDirty: true })}
              />
            </Field>

            <Field label={t('receivedDate')} htmlFor="received_date" required>
              <DateInput
                id="received_date"
                value={watch('received_date') ?? ''}
                onChange={(event) => setValue('received_date', event.target.value, { shouldDirty: true })}
              />
            </Field>

            <Field label={t('storageLocation')} htmlFor="storage_location">
              <Input id="storage_location" {...register('storage_location')} />
            </Field>

            <Field label={tc('notes')} htmlFor="notes" className="sm:col-span-2">
              <Input id="notes" {...register('notes')} />
            </Field>
          </FieldGrid>
        </CardBody>
      </Card>

      <FormActionBar>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : <PackagePlus className="h-4 w-4" />}
          {t('receive')}
        </Button>
      </FormActionBar>
    </form>
  );
}
