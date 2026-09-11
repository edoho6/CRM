'use server';

import { invitationSchema, membershipActiveSchema, membershipRoleSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * The team screen's writes. All four are owner-only, and the database says
 * so too (the invitations policy, and the two membership functions), so the
 * check here only saves a round trip. The clinic is the session's; a member
 * id in the payload that belongs elsewhere is refused below.
 */

async function ownerScope() {
  const scope = await getClinicScope();
  if (!scope) return { scope: null, error: actionError(new Error('unauthorized')) };
  if (scope.context.membership.role !== 'owner') return { scope: null, error: actionError(new Error('forbidden')) };
  return { scope, error: null };
}

/** Makes a link. Sending it is the owner's business — WhatsApp, in person, however they like. */
export async function createInvitation(input: unknown): Promise<ActionResult<{ token: string }>> {
  const { scope, error: gate } = await ownerScope();
  if (!scope) return gate;
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('clinic_invitations')
    .insert({
      clinic_id: scope.context.clinic.id,
      role: parsed.data.role,
      invitee_name: parsed.data.inviteeName,
      invited_by: scope.context.membership.user_id,
    })
    .select('token')
    .single<{ token: string }>();
  if (error) return actionError(error);
  return actionOk({ token: data.token });
}

/** Closes a link that has not been used. A used one is history and stays. */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { scope, error: gate } = await ownerScope();
  if (!scope) return gate;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('clinic_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', scope.context.clinic.id)
    .is('accepted_at', null)
    .is('revoked_at', null);
  if (error) return actionError(error);
  return actionOk();
}

export async function setMemberRole(input: unknown): Promise<ActionResult> {
  const { scope, error: gate } = await ownerScope();
  if (!scope) return gate;
  const parsed = membershipRoleSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.rpc('set_membership_role', {
    p_membership: parsed.data.membershipId,
    p_role: parsed.data.role,
  });
  if (error) return actionError(error);
  return actionOk();
}

export async function setMemberActive(input: unknown): Promise<ActionResult> {
  const { scope, error: gate } = await ownerScope();
  if (!scope) return gate;
  const parsed = membershipActiveSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.rpc('set_membership_active', {
    p_membership: parsed.data.membershipId,
    p_active: parsed.data.active,
  });
  if (error) return actionError(error);
  return actionOk();
}
