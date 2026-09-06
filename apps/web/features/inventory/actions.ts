'use server';

import {
  dispenseRequestSchema,
  herbFormSchema,
  herbFormulaFormSchema,
  receiveBatchSchema,
  stockAdjustmentSchema,
  supplierFormSchema,
} from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Inventory mutations.
 *
 * Anything that changes stock goes through a database function rather than a
 * direct table write. That keeps the ledger, the batch balance and the dispensing
 * record in one transaction — a partial write here would leave the clinic's stock
 * figures permanently wrong.
 */

export async function createHerb(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = herbFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('herbs')
    .insert({ ...parsed.data, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

export async function updateHerb(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = herbFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('herbs').update(parsed.data).eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

export async function createSupplier(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = supplierFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('suppliers')
    .insert({ ...parsed.data, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Saves a formula and its lines together.
 *
 * Items are replaced wholesale rather than diffed: a formula is small, and a
 * failed diff that leaves a herb behind would silently change a prescription.
 */
export async function saveFormula(
  formulaId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = herbFormulaFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { items, ...formula } = parsed.data;
  let id = formulaId;

  if (id) {
    const { error } = await scope.supabase.from('herb_formulas').update(formula).eq('id', id);
    if (error) return actionError(error);
  } else {
    const { data, error } = await scope.supabase
      .from('herb_formulas')
      .insert({
        ...formula,
        clinic_id: scope.context.clinic.id,
        created_by: scope.context.membership.user_id,
      })
      .select('id')
      .single<{ id: string }>();
    if (error) return actionError(error);
    id = data.id;
  }

  const { error: deleteError } = await scope.supabase
    .from('herb_formula_items')
    .delete()
    .eq('formula_id', id);
  if (deleteError) return actionError(deleteError);

  const { error: insertError } = await scope.supabase.from('herb_formula_items').insert(
    items.map((item, index) => ({
      clinic_id: scope.context.clinic.id,
      formula_id: id,
      herb_id: item.herb_id,
      dosage: item.dosage,
      unit: item.unit,
      sequence: index,
      notes: item.notes,
    })),
  );
  if (insertError) return actionError(insertError);

  return actionOk({ id });
}

export async function receiveBatch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = receiveBatchSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase.rpc('receive_herb_batch', {
    p_herb_id: parsed.data.herb_id,
    p_quantity: parsed.data.quantity,
    p_unit: parsed.data.unit,
    p_supplier_id: parsed.data.supplier_id,
    p_batch_number: parsed.data.batch_number,
    p_unit_cost: parsed.data.unit_cost,
    p_expiry_date: parsed.data.expiry_date,
    p_storage_location: parsed.data.storage_location,
    p_received_date: parsed.data.received_date,
    p_notes: parsed.data.notes,
  });

  if (error) return actionError(error);
  return actionOk({ id: data as string });
}

export async function adjustStock(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.rpc('adjust_stock', {
    p_batch_id: parsed.data.batch_id,
    p_quantity: parsed.data.quantity,
    p_movement_type: parsed.data.movement_type,
    p_notes: parsed.data.notes,
  });

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Dispenses herbs against an encounter.
 *
 * All the interesting work happens in `dispense_formula`: it allocates
 * first-expiry-first-out across batches and rolls the whole transaction back if any
 * herb is short, so the caller never has to unwind a partial deduction.
 */
export async function dispenseHerbs(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = dispenseRequestSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase.rpc('dispense_formula', {
    p_encounter_id: parsed.data.encounter_id,
    p_formula_id: parsed.data.formula_id,
    p_items: parsed.data.items,
    p_multiplier: parsed.data.multiplier,
    p_notes: parsed.data.notes,
  });

  if (error) return actionError(error);
  return actionOk({ id: data as string });
}
