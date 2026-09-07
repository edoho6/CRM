'use server';

import { appointmentTypeSchema } from '@clinic/domain';
import { isPaymentProviderId } from '@/features/billing/providers';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Settings mutations.
 *
 * These are the knobs a practitioner turns for their own practice rather than
 * clinical data, but they are written through the same door: validated against
 * the shared schema, scoped by the session's clinic, and never trusting an id
 * that arrived in the payload.
 */
/**
 * Creates or updates one treatment type.
 *
 * The clinic id comes from the session rather than from the payload, so a
 * crafted request cannot write a type into someone else's diary — the RLS
 * policy would refuse it anyway, and this makes the refusal unnecessary.
 */
export async function saveAppointmentType(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentTypeSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  if (id) {
    const { error } = await scope.supabase
      .from('appointment_types')
      .update(parsed.data)
      .eq('id', id);
    if (error) return actionError(error);
    return actionOk({ id });
  }

  const { data, error } = await scope.supabase
    .from('appointment_types')
    .insert({ ...parsed.data, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Removes a treatment type, or retires it when it is already in use.
 *
 * A type attached to a booking cannot be deleted without rewriting what
 * happened, and the foreign key says so. Rather than surface a constraint
 * violation, it is deactivated: it stops appearing in the picker and every past
 * appointment keeps its label.
 */
export async function deleteAppointmentType(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { count } = await scope.supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('appointment_type_id', id);

  if ((count ?? 0) > 0) {
    const { error } = await scope.supabase
      .from('appointment_types')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return actionError(error);
    return actionError(new Error('appointment_type_in_use_deactivated'));
  }

  const { error } = await scope.supabase.from('appointment_types').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Chooses which company takes the money, and stores that provider's credentials.
 *
 * Credentials go into the per-provider blob rather than into columns, so trying
 * SUMIT and going back to Grow does not lose what was typed for either. They are
 * written and read on the server only; nothing here is ever sent to a browser.
 *
 * Switching provider deliberately does not deactivate the settings — a
 * practitioner changing supplier mid-year still has unpaid invoices carrying
 * payment links from the old one, and those links keep working because they live
 * on the old provider's domain.
 */
export async function savePaymentProvider(input: {
  provider: unknown;
  environment: unknown;
  credentials: Record<string, string>;
  isActive: boolean;
}): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!isPaymentProviderId(input.provider)) return actionError(new Error('unknown_provider'));

  const environment = input.environment === 'production' ? 'production' : 'sandbox';

  const { data: existing } = await scope.supabase
    .from('clinic_payment_settings')
    .select('id, credentials')
    .maybeSingle<{ id: string; credentials: Record<string, unknown> | null }>();

  // Merge rather than replace: the blob holds every provider ever configured.
  const credentials = {
    ...(existing?.credentials ?? {}),
    [input.provider]: input.credentials,
  };

  const payload = {
    provider: input.provider,
    environment,
    credentials,
    is_active: input.isActive,
  };

  if (existing) {
    const { error } = await scope.supabase
      .from('clinic_payment_settings')
      .update(payload)
      .eq('id', existing.id);
    if (error) return actionError(error);
    return actionOk();
  }

  const { error } = await scope.supabase
    .from('clinic_payment_settings')
    .insert({ ...payload, clinic_id: scope.context.clinic.id });

  if (error) return actionError(error);
  return actionOk();
}
