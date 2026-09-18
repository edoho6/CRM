'use server';

import {
  clinicSettingsSchema,
  dispenseRequestSchema,
  formulaThresholdUpdateSchema,
  herbFormSchema,
  herbFormulaFormSchema,
  orderListEntrySchema,
  prescriptionRequestSchema,
  receiveBatchSchema,
  stockAdjustmentSchema,
  supplierFormSchema,
  thresholdUpdateSchema,
  type DispenseRequestData,
} from '@clinic/domain';
import { getScopeWithAbility, type ClinicScope } from '@/lib/session';
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
  const scope = await getScopeWithAbility('inventory');
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
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = herbFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('herbs').update(parsed.data).eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

export async function createSupplier(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = supplierFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const row = { ...parsed.data, clinic_id: scope.context.clinic.id };
  let { data, error } = await scope.supabase
    .from('suppliers')
    .insert(row)
    .select('id')
    .single<{ id: string }>();

  // Until migration 20260910180000 has been run the column is not there;
  // the supplier is still worth saving, without its terms.
  if (error?.code === '42703' || /payment_terms/.test(error?.message ?? '')) {
    const { payment_terms: _dropped, ...withoutTerms } = row;
    ({ data, error } = await scope.supabase
      .from('suppliers')
      .insert(withoutTerms)
      .select('id')
      .single<{ id: string }>());
  }

  if (error || !data) return actionError(error ?? new Error('insert'));
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
  const scope = await getScopeWithAbility('inventory');
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
  const scope = await getScopeWithAbility('inventory');
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
    p_received_date: parsed.data.received_date || null,
    p_notes: parsed.data.notes,
    p_preparation: parsed.data.preparation,
  });

  if (error) return actionError(error);
  return actionOk({ id: data as string });
}

export async function adjustStock(input: unknown): Promise<ActionResult> {
  const scope = await getScopeWithAbility('inventory');
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
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = dispenseRequestSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  /*
   * One call, one transaction: the allocation and the prescription's details
   * (preparation, dose, timing) are written together or not at all. They used
   * to be two calls, and a failure between them reported an error for herbs
   * that had already left the jar — which a retry then took a second time.
   * The form's key makes a retry return the first dispensing instead.
   */
  const { data, error } = await scope.supabase.rpc('dispense_with_details', {
    p_encounter_id: parsed.data.encounter_id,
    p_formula_id: parsed.data.formula_id,
    p_items: parsed.data.items,
    p_multiplier: parsed.data.multiplier,
    p_notes: parsed.data.notes,
    p_preparation: parsed.data.preparation ?? null,
    p_dose_amount: parsed.data.dose_amount,
    p_dose_unit: parsed.data.dose_unit ?? null,
    p_dose_timing: parsed.data.dose_timing ?? null,
    p_doses_per_day: parsed.data.doses_per_day,
    p_idempotency_key: parsed.data.idempotency_key ?? null,
  });

  // A database that has not run migration 20260919090000 has no such
  // function (PGRST202): the two calls of before, so dispensing keeps working
  // until the SQL is pasted.
  if (error?.code === 'PGRST202') return dispenseTheOldWay(scope, parsed.data);
  if (error) return actionError(error);
  return actionOk({ id: data as string });
}

/**
 * Records a prescription without touching stock.
 *
 * The counterpart to `dispenseHerbs` for a clinic that holds nothing: same
 * request shape, but the database function writes the record and its lines
 * without allocating batches or moving the ledger, because there is nothing to
 * move. Without this a stockless clinic could not record a prescription at all.
 */
export async function recordPrescription(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = prescriptionRequestSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase.rpc('record_prescription', {
    p_encounter_id: parsed.data.encounter_id,
    p_formula_id: parsed.data.formula_id,
    p_items: parsed.data.items,
    p_multiplier: parsed.data.multiplier,
    p_notes: parsed.data.notes,
    p_preparation: parsed.data.preparation ?? null,
    p_days_supply: parsed.data.days_supply,
    p_custom_formula: parsed.data.custom_formula,
    p_dose_amount: parsed.data.dose_amount,
    p_dose_unit: parsed.data.dose_unit ?? null,
    p_dose_timing: parsed.data.dose_timing ?? null,
    p_doses_per_day: parsed.data.doses_per_day,
  });

  if (error) return actionError(error);
  return actionOk({ id: data as string });
}

/** Sets what counts as low stock for one herb, edited straight from the table. */
export async function setHerbThreshold(herbId: string, input: unknown): Promise<ActionResult> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = thresholdUpdateSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('herbs').update(parsed.data).eq('id', herbId);
  if (error) return actionError(error);
  return actionOk();
}

/** The same, for a formula — where "low" is counted in whole doses. */
export async function setFormulaThreshold(
  formulaId: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = formulaThresholdUpdateSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('herb_formulas')
    .update(parsed.data)
    .eq('id', formulaId);
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Adds a herb or formula to the order list, or tops up the line already there.
 *
 * "The same thing" now includes the preparation. Ordering dried root and powder
 * of one herb is an ordinary week, and treating the second as a duplicate of the
 * first — which is what the old unique index did — meant the second order simply
 * could not be placed. Two preparations are two lines; the same preparation
 * twice tops up the line that exists, because noticing something is low on
 * Monday and again on Thursday should not produce two orders.
 */
export async function addToOrderList(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = orderListEntrySchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const target = parsed.data.herb_id
    ? { column: 'herb_id' as const, value: parsed.data.herb_id }
    : { column: 'formula_id' as const, value: parsed.data.formula_id as string };

  let existingQuery = scope.supabase
    .from('order_list')
    .select('id')
    .eq(target.column, target.value)
    .neq('status', 'received');

  // `.is` rather than `.eq` for the unspecified case: SQL equality against null
  // matches nothing, so an unspecified line would never find itself.
  existingQuery = parsed.data.preparation
    ? existingQuery.eq('preparation', parsed.data.preparation)
    : existingQuery.is('preparation', null);

  const { data: existing } = await existingQuery.maybeSingle<{ id: string }>();

  if (existing) {
    const { error } = await scope.supabase
      .from('order_list')
      .update({
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        supplier_id: parsed.data.supplier_id,
        notes: parsed.data.notes,
      })
      .eq('id', existing.id);
    if (error) return actionError(error);
    return actionOk({ id: existing.id });
  }

  const { data, error } = await scope.supabase
    .from('order_list')
    .insert({
      ...parsed.data,
      clinic_id: scope.context.clinic.id,
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

export async function updateOrderListEntry(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = orderListEntrySchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('order_list').update(parsed.data).eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

export async function removeFromOrderList(id: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('inventory');
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('order_list').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Clinic-wide settings.
 *
 * Turning stock tracking off hides the stock room; it never deletes a batch or
 * a ledger entry, so turning it back on restores exactly what was there.
 */
export async function saveClinicSettings(input: unknown): Promise<ActionResult> {
  const scope = await getScopeWithAbility('settings');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = clinicSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinics')
    .update(parsed.data)
    .eq('id', scope.context.clinic.id);

  if (error) return actionError(error);
  return actionOk();
}

/** Before migration 20260919090000: allocate, then write the details. Kept only as the bridge. */
async function dispenseTheOldWay(
  scope: ClinicScope,
  request: DispenseRequestData,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await scope.supabase.rpc('dispense_formula', {
    p_encounter_id: request.encounter_id,
    p_formula_id: request.formula_id,
    p_items: request.items,
    p_multiplier: request.multiplier,
    p_notes: request.notes,
  });
  if (error) return actionError(error);
  const recordId = data as string;
  const { error: detailError } = await scope.supabase
    .from('dispensing_records')
    .update({
      preparation: request.preparation ?? null,
      dose_amount: request.dose_amount,
      dose_unit: request.dose_unit ?? null,
      dose_timing: request.dose_timing ?? null,
      doses_per_day: request.doses_per_day,
    })
    .eq('id', recordId);
  if (detailError) return actionError(detailError);
  return actionOk({ id: recordId });
}
