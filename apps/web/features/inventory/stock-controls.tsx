'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Plus, ShoppingCart } from 'lucide-react';
import { LtrInput, Spinner, useToast } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { useRouter } from '@clinic/i18n/navigation';
import { addToOrderList, setFormulaThreshold, setHerbThreshold } from './actions';

/**
 * The two things a practitioner does while reading the stock tables: decide
 * what "low" means for this particular herb, and put something on the order
 * list. Both are one click from the row they are looking at, because walking to
 * an edit form to type one number is how a threshold ends up never being set.
 */

export function ThresholdCell({
  id,
  kind,
  value,
  suffix,
  reorderQuantity = null,
}: {
  id: string;
  kind: 'herb' | 'formula';
  value: number | null;
  /** Grams for a herb, doses for a formula. */
  suffix: string;
  /** A herb's reorder quantity, carried through untouched: this cell edits only the threshold. */
  reorderQuantity?: number | null;
}) {
  const t = useTranslations('inventory.stock');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if (next !== null && !Number.isFinite(next)) return;
    if (next === value) return;

    startTransition(async () => {
      const result =
        kind === 'herb'
          ? await setHerbThreshold(id, {
              reorder_threshold: trimmed,
              reorder_quantity: reorderQuantity === null ? '' : String(reorderQuantity),
            })
          : await setFormulaThreshold(id, { reorder_threshold_doses: trimmed });
      if (!result.ok) {
        // The number the server still has, and a word about it.
        setDraft(value === null ? '' : String(value));
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }

  return (
    // dir="ltr" on the wrapper, not just on the input: in a Hebrew page the
    // unit would otherwise be laid out before the number, so "0 doses" reads as
    // "doses 0". The value comes first and the unit follows it, in both
    // languages.
    <span dir="ltr" className="inline-flex items-center gap-1">
      <LtrInput
        type="number"
        min={0}
        step="0.1"
        compact
        value={draft}
        aria-label={t('threshold')}
        placeholder="—"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="w-20 tabular-nums"
      />
      <span className="text-xs text-ink-600">{suffix}</span>
      {/* A fixed slot: the cell must not widen and narrow while it saves. */}
      <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>
        {isPending ? (
          <Spinner className="h-3 w-3 text-ink-500" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5 text-jade-700" />
        ) : null}
      </span>
    </span>
  );
}

export function AddToOrderButton({
  herbId,
  formulaId,
  unit,
  suggestedQuantity,
  alreadyListed,
}: {
  herbId?: string;
  formulaId?: string;
  unit: string;
  /** Pre-fills the line with the reorder quantity when one is set. */
  suggestedQuantity?: number | null;
  alreadyListed?: boolean;
}) {
  const t = useTranslations('inventory.order');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function add() {
    // Listed at once; unlisted again only if the write fails.
    setDone(true);
    startTransition(async () => {
      const result = await addToOrderList({
        herb_id: herbId ?? null,
        formula_id: formulaId ?? null,
        quantity: suggestedQuantity ?? null,
        unit,
        supplier_id: null,
        status: 'pending',
        notes: null,
      });
      if (!result.ok) {
        setDone(false);
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      router.refresh();
    });
  }

  const listed = alreadyListed || done;

  return (
    <button
      type="button"
      onClick={add}
      disabled={isPending || listed}
      title={listed ? t('alreadyListed') : t('add')}
      className={cn(
        'inline-flex min-h-8 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-10',
        listed
          ? 'cursor-default bg-jade-50 text-jade-700'
          : 'bg-ink-100 text-ink-700 hover:bg-jade-100 hover:text-jade-800',
      )}
    >
      {isPending ? (
        <Spinner className="h-3 w-3" />
      ) : listed ? (
        <ShoppingCart className="h-3.5 w-3.5" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      {listed ? t('listed') : t('add')}
    </button>
  );
}
