'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Check, Pencil } from 'lucide-react';
import { Button, Field, Input, LtrInput, Popover, Select, Spinner } from '@clinic/ui';
import { HERB_PREPARATIONS, preparationUnit, type HerbPreparation } from '@clinic/domain';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { receiveBatch, setHerbThreshold } from './actions';
import { formatDate } from '@clinic/i18n';

export interface StockBatchSummary {
  id: string;
  preparation: HerbPreparation;
  quantity_remaining: number;
  expiry_date: string | null;
}

/**
 * Everything about one herb's stock, from the row it is on.
 *
 * Setting a threshold, booking in what arrived, correcting an expiry date —
 * these are all things noticed while reading down the stock table, and each one
 * used to mean leaving the table for a form and losing your place in it. A
 * dropdown keeps the list underneath, which is what makes it worth doing at the
 * moment you notice rather than later, which is to say never.
 *
 * Adding stock goes through `receive_herb_batch` rather than writing a number
 * into the herb: the balance is the sum of the ledger, and a quantity typed
 * straight over it would be a figure nothing could explain. What looks here like
 * "editing the stock" is booking in a batch, which is what actually happened.
 */
export function StockEditor({
  herbId,
  herbName,
  threshold,
  reorderQuantity,
  batches,
}: {
  herbId: string;
  herbName: string;
  threshold: number | null;
  reorderQuantity: number | null;
  /** The live batches, so expiry dates can be seen and corrected in place. */
  batches: StockBatchSummary[];
}) {
  const t = useTranslations('inventory.stock');
  const tPrep = useTranslations('inventory.preparation');
  const tBatches = useTranslations('inventory.batches');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();

  const [thresholdDraft, setThresholdDraft] = useState(threshold === null ? '' : String(threshold));
  const [quantityDraft, setQuantityDraft] = useState(
    reorderQuantity === null ? '' : String(reorderQuantity),
  );
  const [addPreparation, setAddPreparation] = useState<HerbPreparation>('dried_herb');
  const [addQuantity, setAddQuantity] = useState('');
  const [addExpiry, setAddExpiry] = useState('');
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function saveThresholds() {
    startTransition(async () => {
      const result = await setHerbThreshold(herbId, {
        reorder_threshold: thresholdDraft,
        reorder_quantity: quantityDraft,
      });
      if (result.ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function bookIn() {
    const amount = Number(addQuantity);
    if (!Number.isFinite(amount) || amount <= 0) return;

    startTransition(async () => {
      const result = await receiveBatch({
        herb_id: herbId,
        quantity: amount,
        unit: preparationUnit(addPreparation),
        preparation: addPreparation,
        supplier_id: null,
        batch_number: '',
        unit_cost: '',
        expiry_date: addExpiry,
        storage_location: '',
        received_date: '',
        notes: '',
      });
      if (result.ok) {
        setAddQuantity('');
        setAddExpiry('');
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  return (
    <Popover
      width={300}
      align="end"
      panelLabel={t('editStockFor', { herb: herbName })}
      triggerLabel={t('editStockFor', { herb: herbName })}
      triggerTitle={t('editStock')}
      triggerClassName="rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
      triggerContent={
        saved ? (
          <Check className="h-4 w-4 text-jade-700" aria-hidden />
        ) : (
          <Pencil className="h-4 w-4" aria-hidden />
        )
      }
    >
      <>
        <p className="mb-2 text-sm font-semibold text-ink-900">{herbName}</p>

        <div className="space-y-3">
          <div>
            <h3 className="mb-1 text-xs font-semibold text-ink-600">{t('threshold')}</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label={t('thresholdShort')} htmlFor={`th-${herbId}`} density="compact">
                <LtrInput
                  id={`th-${herbId}`}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="—"
                  value={thresholdDraft}
                  onChange={(event) => setThresholdDraft(event.target.value)}
                />
              </Field>
              <Field label={t('reorderQuantity')} htmlFor={`rq-${herbId}`} density="compact">
                <LtrInput
                  id={`rq-${herbId}`}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="—"
                  value={quantityDraft}
                  onChange={(event) => setQuantityDraft(event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-1.5 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={saveThresholds}
                disabled={isPending}
              >
                {isPending ? <Spinner className="h-3.5 w-3.5" /> : null}
                {tc('save')}
              </Button>
            </div>
          </div>

          <div className="border-t border-ink-100 pt-2.5">
            <h3 className="mb-1 text-xs font-semibold text-ink-600">{tBatches('receive')}</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label={tPrep('label')} htmlFor={`pr-${herbId}`} density="compact">
                <Select
                  id={`pr-${herbId}`}
                  value={addPreparation}
                  onChange={(event) => setAddPreparation(event.target.value as HerbPreparation)}
                >
                  {HERB_PREPARATIONS.map((option) => (
                    <option key={option} value={option}>
                      {tPrep(option)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={`${tc('quantity')} · ${tUnit(preparationUnit(addPreparation))}`}
                htmlFor={`aq-${herbId}`}
                density="compact"
              >
                <LtrInput
                  id={`aq-${herbId}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={addQuantity}
                  onChange={(event) => setAddQuantity(event.target.value)}
                />
              </Field>
            </div>
            <Field
              label={tBatches('expiryDate')}
              htmlFor={`ex-${herbId}`}
              density="compact"
              className="mt-1.5"
            >
              <Input
                id={`ex-${herbId}`}
                type="date"
                dir="ltr"
                value={addExpiry}
                onChange={(event) => setAddExpiry(event.target.value)}
              />
            </Field>
            <div className="mt-1.5 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={bookIn}
                disabled={isPending || !(Number(addQuantity) > 0)}
              >
                {isPending ? <Spinner className="h-3.5 w-3.5" /> : null}
                {tBatches('receive')}
              </Button>
            </div>
          </div>

          {batches.length > 0 ? (
            <div className="border-t border-ink-100 pt-2.5">
              <h3 className="mb-1 text-xs font-semibold text-ink-600">{tBatches('title')}</h3>
              <ul className="space-y-0.5 text-xs">
                {batches.map((batch) => (
                  <li key={batch.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-ink-700">{tPrep(batch.preparation)}</span>
                    <span dir="ltr" className="tabular-nums text-ink-800">
                      {format.number(Number(batch.quantity_remaining))}{' '}
                      {tUnit(preparationUnit(batch.preparation))}
                    </span>
                    <span dir="ltr" className="tabular-nums text-ink-600">
                      {batch.expiry_date
                        ? formatDate(new Date(batch.expiry_date))
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Correcting a batch is a bigger job than this panel should
                    hold — supplier, cost, storage — so it links rather than
                    duplicating the batch form badly. */}
              <Link
                href={{ pathname: '/inventory/batches', query: { herb: herbId } }}
                className="mt-1.5 inline-block text-xs text-jade-800 underline-offset-2 hover:underline"
              >
                {tBatches('title')}
              </Link>
            </div>
          ) : null}
        </div>
      </>
    </Popover>
  );
}
