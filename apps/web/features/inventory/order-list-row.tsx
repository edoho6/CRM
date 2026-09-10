'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Trash2, Undo2 } from 'lucide-react';
import { Input, LtrInput, Select, Spinner, Td } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { ORDER_LIST_STATUSES, type OrderListStatus } from '@clinic/domain';
import { removeFromOrderList, updateOrderListEntry } from './actions';

/**
 * One line on the order list.
 *
 * The list is a working document rather than a purchase order: quantity, note
 * and status are edited in place, and a line is deleted outright when it turns
 * out not to be needed. Nothing here commits to a supplier — that decision
 * happens later, when a batch is actually received.
 */
export function OrderListRowControls({
  entry,
  suppliers = [],
}: {
  entry: {
    id: string;
    herb_id: string | null;
    formula_id: string | null;
    quantity: number | null;
    unit: string;
    preparation?: string | null;
    supplier_id: string | null;
    status: OrderListStatus;
    notes: string | null;
  };
  suppliers?: { id: string; name: string }[];
}) {
  const t = useTranslations('inventory.order');
  const tBatches = useTranslations('inventory.batches');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const router = useRouter();
  const [quantity, setQuantity] = useState(entry.quantity === null ? '' : String(entry.quantity));
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [supplierId, setSupplierId] = useState(entry.supplier_id ?? '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(patch: {
    quantity?: string;
    notes?: string;
    status?: OrderListStatus;
    supplier_id?: string;
  }) {
    startTransition(async () => {
      // Every field goes back, edited or not: this used to send the supplier
      // as null, so changing the status of a line forgot who it was from.
      const result = await updateOrderListEntry(entry.id, {
        herb_id: entry.herb_id,
        formula_id: entry.formula_id,
        quantity: patch.quantity ?? quantity,
        unit: entry.unit,
        preparation: entry.preparation ?? null,
        supplier_id: (patch.supplier_id ?? supplierId) || null,
        status: patch.status ?? entry.status,
        notes: patch.notes ?? notes,
      });
      if (result.ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeFromOrderList(entry.id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <Td>
        <span className="inline-flex items-center gap-1">
          <LtrInput
            type="number"
            min={0}
            step="0.1"
            compact
            value={quantity}
            aria-label={tc('quantity')}
            placeholder="—"
            onChange={(event) => setQuantity(event.target.value)}
            onBlur={() => save({})}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="w-24 tabular-nums"
          />
          <span className="text-xs text-ink-500">
            {entry.unit === 'dose' ? t('doses') : tUnit(entry.unit as never)}
          </span>
        </span>
      </Td>
      <Td>
        <Select
          aria-label={tBatches('supplier')}
          value={supplierId}
          compact
          className="min-w-32"
          onChange={(event) => {
            setSupplierId(event.target.value);
            save({ supplier_id: event.target.value });
          }}
        >
          <option value="">{tBatches('noSupplier')}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Input
          type="text"
          compact
          value={notes}
          aria-label={tc('notes')}
          placeholder={t('notesPlaceholder')}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => save({})}
          className="min-w-32"
        />
      </Td>
      <Td>
        <Select
          aria-label={tc('status')}
          value={entry.status}
          compact
          className="min-w-28"
          onChange={(event) => save({ status: event.target.value as OrderListStatus })}
        >
          {ORDER_LIST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </Select>
      </Td>
      <Td className="text-end">
        <span className="inline-flex items-center gap-1">
          {isPending ? <Spinner className="h-3 w-3 text-ink-500" /> : null}
          {saved ? <Check className="h-3.5 w-3.5 text-jade-600" /> : null}
          {entry.status === 'received' ? (
            <button
              type="button"
              onClick={() => save({ status: 'pending' })}
              aria-label={t('status.pending')}
              className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={remove}
            aria-label={tc('delete')}
            className="rounded p-1 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </Td>
    </>
  );
}
