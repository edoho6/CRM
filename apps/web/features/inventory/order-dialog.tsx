'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Plus, ShoppingCart } from 'lucide-react';
import { Button, Field, LtrInput, Select, Spinner } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { HERB_PREPARATIONS, preparationUnit, type HerbPreparation } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { addToOrderList } from './actions';

/**
 * Adds a line to the order list, after asking what to order.
 *
 * The button used to add the herb silently and then refuse to add it again. Both
 * halves were wrong: an order needs a preparation and an amount before it is an
 * order, and the same herb in dried and powdered form is two orders rather than
 * a duplicate of one. So it asks, and it never blocks.
 *
 * A popover, not a page. Ordering is done while reading down a list of low
 * stock, and a form that replaces the list loses your place in it.
 */
export function OrderDialog({
  herbId,
  formulaId,
  suggestedQuantity,
  listedPreparations = [],
}: {
  herbId?: string;
  formulaId?: string;
  /** Pre-fills the amount from the reorder quantity when one is set. */
  suggestedQuantity?: number | null;
  /** Preparations already on the list, shown as a reminder rather than a block. */
  listedPreparations?: (HerbPreparation | null)[];
}) {
  const t = useTranslations('inventory.order');
  const tPrep = useTranslations('inventory.preparation');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [preparation, setPreparation] = useState<HerbPreparation>('dried_herb');
  const [quantity, setQuantity] = useState(
    suggestedQuantity ? String(suggestedQuantity) : '',
  );
  const [isPending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // A formula is ordered in doses; a herb in whatever its preparation is measured in.
  const unit = formulaId ? 'dose' : preparationUnit(preparation);
  const alreadyListed = listedPreparations.includes(preparation);

  useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function submit() {
    startTransition(async () => {
      const result = await addToOrderList({
        herb_id: herbId ?? null,
        formula_id: formulaId ?? null,
        quantity: quantity.trim() === '' ? null : Number(quantity),
        unit,
        preparation: formulaId ? null : preparation,
        supplier_id: null,
        status: 'pending',
        notes: null,
      });
      if (result.ok) {
        setJustAdded(true);
        setOpen(false);
        window.setTimeout(() => setJustAdded(false), 1800);
        router.refresh();
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
          justAdded
            ? 'bg-jade-50 text-jade-800'
            : 'bg-ink-100 text-ink-700 hover:bg-jade-100 hover:text-jade-800',
        )}
      >
        {justAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {justAdded ? t('listed') : t('add')}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('add')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          className="absolute z-40 mt-1 w-64 rounded-lg border border-ink-200 bg-white p-3 shadow-lg"
        >
          <div className="space-y-2.5">
            {!formulaId ? (
              <Field label={tPrep('label')} htmlFor={`order-prep-${herbId}`} density="compact">
                <Select
                  id={`order-prep-${herbId}`}
                  ref={firstFieldRef}
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
            ) : null}

            <Field
              label={`${tc('quantity')} · ${tUnit(unit)}`}
              htmlFor={`order-qty-${herbId ?? formulaId}`}
              density="compact"
            >
              <LtrInput
                id={`order-qty-${herbId ?? formulaId}`}
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit();
                }}
              />
            </Field>

            {/* A reminder, not a refusal: topping up a line that already exists
                is a normal thing to do, and so is ordering the same herb in a
                second preparation. */}
            {alreadyListed ? (
              <p className="text-xs text-amber-800">{t('alreadyListedTopUp')}</p>
            ) : null}

            <div className="flex justify-end gap-1.5 pt-0.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button type="button" size="sm" onClick={submit} disabled={isPending}>
                {isPending ? <Spinner className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                {t('add')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
