'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Trash2, Undo2 } from 'lucide-react';
import { Select, Spinner, Td } from '@clinic/ui';
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
}: {
  entry: {
    id: string;
    herb_id: string | null;
    formula_id: string | null;
    quantity: number | null;
    unit: string;
    status: OrderListStatus;
    notes: string | null;
  };
}) {
  const t = useTranslations('inventory.order');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const router = useRouter();
  const [quantity, setQuantity] = useState(entry.quantity === null ? '' : String(entry.quantity));
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(patch: { quantity?: string; notes?: string; status?: OrderListStatus }) {
    startTransition(async () => {
      const result = await updateOrderListEntry(entry.id, {
        herb_id: entry.herb_id,
        formula_id: entry.formula_id,
        quantity: patch.quantity ?? quantity,
        unit: entry.unit,
        supplier_id: null,
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
          <input
            type="number"
            min={0}
            step="0.1"
            dir="ltr"
            value={quantity}
            aria-label={tc('quantity')}
            placeholder="—"
            onChange={(event) => setQuantity(event.target.value)}
            onBlur={() => save({})}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="h-7 w-24 rounded-md border border-ink-200 bg-white px-1.5 text-sm tabular-nums shadow-xs outline-none focus:border-jade-500"
          />
          <span className="text-xs text-ink-500">
            {entry.unit === 'dose' ? t('doses') : tUnit(entry.unit as never)}
          </span>
        </span>
      </Td>
      <Td>
        <input
          type="text"
          value={notes}
          aria-label={tc('notes')}
          placeholder={t('notesPlaceholder')}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => save({})}
          className="h-7 w-full min-w-32 rounded-md border border-ink-200 bg-white px-1.5 text-sm shadow-xs outline-none focus:border-jade-500"
        />
      </Td>
      <Td>
        <Select
          aria-label={tc('status')}
          value={entry.status}
          className="h-7 w-auto text-xs"
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
            className="rounded p-1 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </Td>
    </>
  );
}
