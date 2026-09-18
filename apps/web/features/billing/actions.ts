'use server';

import { readSupabaseEnv, siteUrl } from '@clinic/db';
import type {
  ClinicPaymentSettings,
  DispensingRecordWithItems,
  Invoice,
  Patient,
} from '@clinic/db/types';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { getScopeWithAbility, type ClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { createPaymentProcess, type GrowCredentials } from './grow-client';

/**
 * Billing actions.
 *
 * The invoice is built and stored locally first, and only then handed to Grow.
 * Doing it in that order means the clinic always has its own record of what was
 * charged, even if the provider call fails or the patient never pays.
 */

/** A link younger than this, for the same amount, is handed out again rather than replaced. */
const OPEN_LINK_MS = 24 * 60 * 60 * 1000;

const invoiceItemSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  invoiceId: z.string().min(1).max(64),
  description: z.string().max(300),
  quantity: z.number().finite().positive().max(10_000),
  unitPrice: z.number().finite().min(0).max(1_000_000),
  sequence: z.number().int().min(0).max(10_000).optional(),
});

const manualPaymentSchema = z.object({
  amount: z.number().finite().positive().max(1_000_000),
  method: z.enum(['cash', 'bank_transfer', 'bit', 'other']),
});

/** The treatment's invoice that is not cancelled, if there is one. The newest, if an older database holds two. */
async function openInvoiceFor(
  scope: ClinicScope,
  encounterId: string,
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await scope.supabase
    .from('invoices')
    .select('id')
    .eq('encounter_id', encounterId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<{ id: string }[]>();
  if (error) return { id: null, error: new Error(error.message) };
  return { id: data?.[0]?.id ?? null, error: null };
}

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
  const scope = await getScopeWithAbility('money');
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
  const existing = await openInvoiceFor(scope, encounterId);
  if (existing.error) return actionError(existing.error);
  if (existing.id) return actionOk({ id: existing.id });

  // The lines are written in the clinic's language: an invoice is a document
  // the patient keeps, and "Treatment" on a Hebrew invoice is a typo in it.
  const tLines = await getTranslations({
    locale: scope.context.clinic.default_locale,
    namespace: 'billing.lines',
  });

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
    const name = record.formula?.name_english ?? record.formula?.name_pinyin ?? null;

    lines.push({
      description: name ? tLines('herbsNamed', { name }) : tLines('herbs'),
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

  // Two clicks at once: the database keeps one invoice per treatment
  // (migration 20260919092000), and the second click is handed the first's.
  if (error?.code === '23505') {
    const again = await openInvoiceFor(scope, encounterId);
    if (again.id) return actionOk({ id: again.id });
  }
  if (error) return actionError(error);

  // The treatment line always comes first, priced by the practitioner.
  const allLines: DraftLine[] = [
    {
      description: tLines('treatment'),
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
  const scope = await getScopeWithAbility('money');
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
  const scope = await getScopeWithAbility('money');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = invoiceItemSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));
  input = parsed.data;

  // The price is rounded to the agora before it is multiplied, so the line is
  // the sum the database stores and not one computed from a longer decimal.
  input.unitPrice = Math.round(input.unitPrice * 100) / 100;
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
  const scope = await getScopeWithAbility('money');
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('invoice_items').delete().eq('id', itemId);
  if (error) return actionError(error);
  return actionOk();
}

export async function cancelInvoice(invoiceId: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('money');
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
  const scope = await getScopeWithAbility('money');
  if (!scope) return actionError(new Error('unauthorized'));
  const parsed = manualPaymentSchema.safeParse({ amount, method });
  if (!parsed.success) return actionError(new Error('invalid_amount'));

  // More than is owed is a typing slip (4,000 for 400), not a payment.
  const { data: owed, error: owedError } = await scope.supabase
    .from('invoices')
    .select('total, amount_paid')
    .eq('id', invoiceId)
    .maybeSingle<{ total: number; amount_paid: number }>();
  if (owedError) return actionError(owedError);
  if (!owed) return actionError(new Error('invoice_not_found'));
  const outstanding = Number(owed.total) - Number(owed.amount_paid);
  if (parsed.data.amount > outstanding + 0.005)
    return actionError(new Error('amount_exceeds_outstanding'));

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

async function loadGrowCredentials(scope: ClinicScope): Promise<GrowCredentials | null> {
  // The page identifiers through the function every money role may call
  // (migration 20260919110000): the settings table itself is the owner's, and
  // reading it directly left the secretary unable to send a payment link.
  const viaFunction = await scope.supabase.rpc('grow_payment_config');
  if (!viaFunction.error) {
    const row = (Array.isArray(viaFunction.data) ? viaFunction.data[0] : viaFunction.data) as
      | {
          environment: GrowCredentials['environment'];
          grow_user_id: string | null;
          grow_page_code: string | null;
        }
      | null
      | undefined;
    if (!row?.grow_user_id || !row.grow_page_code) return null;
    return { environment: row.environment, userId: row.grow_user_id, pageCode: row.grow_page_code };
  }

  // A database that has not run that SQL yet: the owner's own read, as before.
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
  const scope = await getScopeWithAbility('money');
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

  const { data: open } = await scope.supabase
    .from('payments')
    .select('id, amount, created_at')
    .eq('invoice_id', invoice.id)
    .eq('provider', 'grow')
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - OPEN_LINK_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<{ id: string; amount: number; created_at: string }[]>();
  if (invoice.payment_url && open?.[0] && Math.abs(Number(open[0].amount) - outstanding) < 0.005) {
    return actionOk({ url: invoice.payment_url });
  }

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
  // Back to the page in the clinic's own language, not always Hebrew.
  const locale = scope.context.clinic.default_locale;
  const tPay = await getTranslations({ locale, namespace: 'billing.lines' });
  // Grow's callback goes to the Edge Function, not to this app. Settling a
  // payment needs the service role, which the app does not hold and should not
  // (migration 68); the app's old route called the settlement function with the
  // public anon key, which is the same key every browser has.
  const env = readSupabaseEnv();
  if (!env) return actionError(new Error('not_configured'));
  const notifyUrl = `${env.url.replace(/\/$/, '')}/functions/v1/grow-webhook`;

  const result = await createPaymentProcess(credentials, {
    sum: Number(outstanding.toFixed(2)),
    description: tPay('description', {
      clinic: scope.context.clinic.name,
      number: invoice.invoice_number,
    }),
    fullName: patient.full_name,
    phone: patient.phone,
    email: patient.email,
    successUrl: `${base}/${locale}/billing/${invoice.id}?paid=1`,
    cancelUrl: `${base}/${locale}/billing/${invoice.id}?cancelled=1`,
    notifyUrl,
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
  const scope = await getScopeWithAbility('settings');
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
