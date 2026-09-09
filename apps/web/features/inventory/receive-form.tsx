'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { PackagePlus } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Select,
  Spinner,
  useToast,
} from '@clinic/ui';
import { HERB_UNITS, receiveBatchSchema, type Locale } from '@clinic/domain';
import type { z } from 'zod';
import { useRouter } from '@clinic/i18n/navigation';
import type { Herb, Supplier } from '@clinic/db/types';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { receiveBatch } from './actions';

type ReceiveInput = z.input<typeof receiveBatchSchema>;
type ReceiveOutput = z.output<typeof receiveBatchSchema>;

/**
 * Receiving stock.
 *
 * Writes through the `receive_herb_batch` function so the batch and its opening
 * ledger entry are created together — the running balance is then always
 * explainable by the ledger rather than appearing from nowhere.
 */
export function ReceiveForm({
  herbs,
  suppliers,
  defaultHerbId,
}: {
  herbs: Herb[];
  suppliers: Supplier[];
  defaultHerbId?: string;
}) {
  const t = useTranslations('inventory.batches');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReceiveInput, unknown, ReceiveOutput>({
    resolver: zodResolver(receiveBatchSchema),
    defaultValues: {
      herb_id: defaultHerbId ?? '',
      supplier_id: '',
      batch_number: '',
      quantity: '',
      unit: 'gram',
      unit_cost: '',
      expiry_date: '',
      storage_location: '',
      received_date: today,
      notes: '',
    },
  });

  function onSubmit(values: ReceiveOutput) {
    setStatus('idle');
    startTransition(async () => {
      const result = await receiveBatch(values);
      if (!result.ok) {
        setStatus('error');
        return;
      }
      toast({ tone: 'success', title: t('received') });
      reset({
        herb_id: '',
        supplier_id: '',
        batch_number: '',
        quantity: '',
        unit: 'gram',
        unit_cost: '',
        expiry_date: '',
        storage_location: '',
        received_date: today,
        notes: '',
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

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
              <Select id="herb_id" {...register('herb_id')}>
                <option value="">—</option>
                {herbs.map((herb) => {
                  const secondary = herbSecondaryName(herb, locale);
                  return (
                    <option key={herb.id} value={herb.id}>
                      {herbPrimaryName(herb, locale)}
                      {secondary ? ` · ${secondary}` : ''}
                    </option>
                  );
                })}
              </Select>
            </Field>

            <Field
              label={t('quantityReceived')}
              htmlFor="quantity"
              required
              error={errors.quantity ? tc('requiredField') : null}
            >
              <LtrInput id="quantity" type="number" min={0} step="0.01" {...register('quantity')} />
            </Field>

            <Field label={tc('unit')} htmlFor="unit">
              <Select id="unit" {...register('unit')}>
                {HERB_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {tUnit(unit)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('supplier')} htmlFor="supplier_id">
              <Select id="supplier_id" {...register('supplier_id')}>
                <option value="">—</option>
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

            <Field label={t('unitCost')} htmlFor="unit_cost">
              <LtrInput
                id="unit_cost"
                type="number"
                min={0}
                step="0.0001"
                {...register('unit_cost')}
              />
            </Field>

            <Field label={t('expiryDate')} htmlFor="expiry_date">
              <LtrInput id="expiry_date" type="date" {...register('expiry_date')} />
            </Field>

            <Field label={t('receivedDate')} htmlFor="received_date" required>
              <LtrInput id="received_date" type="date" {...register('received_date')} />
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

      <div className="flex justify-end gap-2">
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
      </div>
    </form>
  );
}
