import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase, getCurrentUser, tryCreateServerSupabase } from '@clinic/db/server';
import type { Clinic, Membership, MembershipContext, Profile } from '@clinic/db/types';

/**
 * Resolves who is signed in and which clinic they work for.
 *
 * Wrapped in React's `cache` so the several server components that need it during
 * one render share a single round trip.
 *
 * Returns null for every "cannot proceed" case — not configured, signed out, or
 * signed in without a membership (which is what a patient portal user looks like
 * if they wander into the staff app). Callers decide where to send them.
 */
export const getMembershipContext = cache(async (): Promise<MembershipContext | null> => {
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const { data: membership, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<Membership>();

  if (error || !membership) return null;

  const [{ data: clinic }, { data: profile }, { data: platformAdmin }] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', membership.clinic_id).maybeSingle<Clinic>(),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>(),
    // Whether this person runs the service. A function rather than a table
    // read so the answer is the same one every policy uses.
    supabase.rpc('is_platform_admin'),
  ]);

  if (!clinic) return null;

  return {
    membership,
    clinic,
    profile: profile ?? null,
    isPlatformAdmin: platformAdmin === true,
  };
});

export interface ClinicScope {
  supabase: SupabaseClient;
  context: MembershipContext;
}

/**
 * The pair every authenticated page needs: a request-bound client and the clinic
 * it belongs to.
 *
 * Returns null instead of throwing when the app is unconfigured or nobody is signed
 * in, so a page can bail out quietly and let the layout handle the redirect. This
 * also keeps `next build` working before any credentials exist.
 */
export const getClinicScope = cache(async (): Promise<ClinicScope | null> => {
  const context = await getMembershipContext();
  if (!context) return null;
  const supabase = await createServerSupabase();
  return { supabase, context };
});

/** Display name for the signed-in user, falling back to the email local part. */
export function displayName(context: MembershipContext | null, fallback = ''): string {
  return context?.profile?.full_name?.trim() || fallback;
}
