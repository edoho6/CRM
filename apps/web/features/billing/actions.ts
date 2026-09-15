'use server';

import { siteUrl } from '@clinic/db';
import type {
  ClinicPaymentSettings,
  DispensingRecordWithItems,
  Invoice,
  Patient,
} from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { createPaymentProcess, type GrowCredentials } from './grow-client';

/**
 * Billing actions.
 *
 * The invoice is built and stored locally first, and only then handed to Grow.
 * Doing it in that order means the clinic always has its own record of what was
 * charged, even if the provider call fails or the patient never pays.
 */

interface DraftLine {
  description: string;
  quantity: number;
  unit_price: number;
  source_table?: string;
  source_id?: string;
}

/**
 * Creates a draft invoice for a treatment.
 *
 * Lines come from two places: the appointment type's price is not modelled yet,
 * so the visit itself is added as a single editable line, and every herb
 * dispensed during the encounter is added at the cost actually recorded for the
 * batch it came from — which is exactly why `dispensing_items` has carried
 * `unit_cost_snapshot` since Milestone 1.
 */
export async function createInvoiceFromEncounter(
  encounterId: string,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data: encounter, error: encounterError } = await scope.supabase
    .from('encounters')
    .select('id, patient_id, appointment_id, encounter_date')
    .eq('id', encounterId)
    .maybeSingle<{
      id: string;
      patient_id: string;
      appointment_id: string | null;
      encounter_date: string;
    }>();

  if (encounterError) return actionError(encounterError);
  if (!encounter) return actionError(new Error('encounter_not_found'));

  // One invoice per encounter: re-opening the screen should reuse the draft
  // rather than quietly create a second bill for the same visit.
  const { data: existing } = await scope.supabase
    .from('invoices')
    .select('id')
    .eq('encounter_id', encounterId)
    .neq('status', 'cancelled')
    .maybeSingle<{ id: string }>();

  if (existing) return actionOk({ id: existing.id });

  const { data: dispensing } = await scope.supabase
    .from('dispensing_records')
    .select(
      '*, items:dispensing_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name)), formula:herb_formulas(id, name_pinyin, name_english)',
    )
    .eq('encounter_id', encounterId)
    .returns<DispensingRecordWithItems[]>();

  const lines: DraftLine[] = [];

  for (const record of dispensing ?? []) {
    // Herbs are billed per dispensing, not per batch split: a patient should see
    // one line for what they were handed, whatever the shelf had to do to fill it.
    const total = record.items.reduce((sum, item) => sum + Number(item.line_total ?? 0), 0);
    const name =
      record.formula?.name_english ??
      record.formula?.name_pinyin ??
      null;

    lines.push({
      description: name ? `Herbs — ${name}` : 'Herbs dispensed',
      quantity: 1,
      unit_price: Number(total.toFixed(2)),
      source_table: 'dispensing_records',
      source_id: record.id,
    });
  }

  const { data: invoice, error } = await scope.supabase
    .from('invoices')
    .insert({
      clinic_id: scope.context.clinic.id,
      patient_id: encounter.patient_id,
      encounter_id: encounter.id,
      appointment_id: encounter.appointment_id,
      status: 'draft',
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);

  // The treatment line always comes first, priced by the practitioner.
  const allLines: DraftLine[] = [
    {
      description: 'Treatment',
      quantity: 1,
      unit_price: 0,
      source_table: 'encounters',
      source_id: encounter.id,
    },
    ...lines,
  ];

  const { error: itemsError } = await scope.supabase.from('invoice_items').insert(
    allLines.map((line, index) => ({
      clinic_id: scope.context.clinic.id,
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_total: Number((line.quantity * line.unit_price).toFixed(2)),
      source_table: line.source_table ?? null,
      source_id: line.source_id ?? null,
      sequence: index,
    })),
  );

  if (itemsError) return actionError(itemsError);
  return actionOk({ id: invoice.id });
}

export async function createBlankInvoice(patientId: string): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase
    .from('invoices')
    .insert({
      clinic_id: scope.context.clinic.id,
      patient_id: patientId,
      status: 'draft',
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

export async function upsertInvoiceItem(input: {
  id?: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sequence?: number;
}): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const lineTotal = Number((input.quantity * input.unitPrice).toFixed(2));
  const row = {
    clinic_id: scope.context.clinic.id,
    invoice_id: input.invoiceId,
    description: input.description.trim() || '—',
    quantity: input.quantity,
    unit_price: input.unitPrice,
    line_total: lineTotal,
    sequence: input.sequence ?? 0,
  };

  const { error } = input.id
    ? await scope.supabase.from('invoice_items').update(row).eq('id', input.id)
    : await scope.supabase.from('invoice_items').insert(row);

  if (error) return actionError(error);
  return actionOk();
}

export async function deleteInvoiceItem(itemId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('invoice_items').delete().eq('id', itemId);
  if (error) return actionError(error);
  return actionOk();
}

export async function cancelInvoice(invoiceId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId);

  if (error) return actionError(error);
  return actionOk();
}

/** Records money taken outside the provider — cash at the desk, a bank transfer. */
export async function recordManualPayment(
  invoiceId: string,
  amount: number,
  method: 'cash' | 'bank_transfer' | 'bit' | 'other',
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!(amount > 0)) return actionError(new Error('invalid_amount'));

  const { error } = await scope.supabase.from('payments').insert({
    clinic_id: scope.context.clinic.id,
    invoice_id: invoiceId,
    amount,
    method,
    status: 'paid',
    provider: 'manual',
    paid_at: new Date().toISOString(),
    created_by: scope.context.membership.user_id,
  });

  if (error) return actionError(error);
  return actionOk();
}

async function loadGrowCredentials(
  scope: NonNullable<Awaited<ReturnType<typeof getClinicScope>>>,
): Promise<GrowCredentials | null> {
  const { data } = await scope.supabase
    .from('clinic_payment_settings')
    .select('*')
    .eq('clinic_id', scope.context.clinic.id)
    .maybeSingle<ClinicPaymentSettings>();

  if (!data?.is_active || !data.grow_user_id || !data.grow_page_code) return null;

  return {
    environment: data.environment,
    userId: data.grow_user_id,
    pageCode: data.grow_page_code,
  };
}

/**
 * Asks Grow for a payment page and stores the pending payment against the invoice.
 *
 * The payment row is written *before* the URL is handed out, so the webhook that
 * arrives later always has a row to match its process id against.
 */
export async function createGrowPaymentLink(
  invoiceId: string,
): Promise<ActionResult<{ url: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const credentials = await loadGrowCredentials(scope);
  if (!credentials) return actionError(new Error('grow_not_configured'));

  const { data: invoice, error: invoiceError } = await scope.supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle<Invoice>();

  if (invoiceError) return actionError(invoiceError);
  if (!invoice) return actionError(new Error('invoice_not_found'));

  const outstanding = Number(invoice.total) - Number(invoice.amount_paid);
  if (!(outstanding > 0)) return actionError(new Error('nothing_to_charge'));

  const { data: patient } = await scope.supabase
    .from('patients')
    .select('id, full_name, phone, email')
    .eq('id', invoice.patient_id)
    .maybeSingle<Pick<Patient, 'id' | 'full_name' | 'phone' | 'email'>>();

  if (!patient?.phone) {
    // Grow requires a valid Israeli mobile number; failing here with a clear
    // code beats a rejected charge with an opaque provider message.
    return actionError(new Error('patient_phone_required'));
  }

  const base = siteUrl();
  const result = await createPaymentProcess(credentials, {
    sum: Number(outstanding.toFixed(2)),
    description: `${scope.context.clinic.name} invoice ${invoice.invoice_number}`,
    fullName: patient.full_name,
    phone: patient.phone,
    email: patient.email,
    successUrl: `${base}/he/billing/${invoice.id}?paid=1`,
    cancelUrl: `${base}/he/billing/${invoice.id}?cancelled=1`,
    notifyUrl: `${base}/api/billing/grow/webhook`,
    reference: invoice.id,
  });

  if (!result.ok || !result.data) {
    return actionError(new Error(result.error ?? 'grow_failed'));
  }

  const { error: paymentError } = await scope.supabase.from('payments').insert({
    clinic_id: scope.context.clinic.id,
    invoice_id: invoice.id,
    amount: Number(outstanding.toFixed(2)),
    method: 'card',
    status: 'pending',
    provider: 'grow',
    provider_process_id: result.data.processId,
    provider_process_token: result.data.processToken,
    created_by: scope.context.membership.user_id,
  });

  if (paymentError) return actionError(paymentError);

  await scope.supabase
    .from('invoices')
    .update({
      payment_url: result.data.url,
      status: invoice.status === 'draft' ? 'sent' : invoice.status,
      issued_at: invoice.issued_at ?? new Date().toISOString(),
    })
    .eq('id', invoice.id);

  return actionOk({ url: result.data.url });
}

export async function saveGrowSettings(input: {
  environment: 'sandbox' | 'production';
  growUserId: string;
  growPageCode: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('clinic_payment_settings').upsert(
    {
      clinic_id: scope.context.clinic.id,
      provider: 'grow',
      environment: input.environment,
      grow_user_id: input.growUserId.trim() || null,
      grow_page_code: input.growPageCode.trim() || null,
      is_active: input.isActive,
    },
    { onConflict: 'clinic_id' },
  );

  if (error) return actionError(error);
  return actionOk();
}
