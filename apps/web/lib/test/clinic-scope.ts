import type { Clinic, Membership, MembershipContext, Profile } from '@clinic/db/types';

/**
 * A signed-in practitioner, for tests.
 *
 * Every server action begins with `getClinicScope()` and then reads
 * `scope.context.clinic.id` and `scope.context.membership.user_id` on its way to
 * the database. A test that mocks the scope has to hand over a whole clinic and
 * membership to get at those two strings, which is enough ceremony to put
 * anyone off writing the test — so it lives here once.
 *
 * The defaults are deliberately boring and deliberately not synthetic: a clinic
 * flagged `is_synthetic` takes different paths through the messaging code, and a
 * test should have to ask for that rather than inherit it.
 */

const CLINIC: Clinic = {
  id: 'clinic-1',
  name: 'Test Clinic',
  slug: 'test-clinic',
  timezone: 'Asia/Jerusalem',
  default_locale: 'he',
  address: null,
  phone: null,
  email: null,
  tax_id: null,
  tracks_inventory: true,
  is_synthetic: false,
  reminder_template: null,
  reminders_enabled: true,
  reminder_hours_before: 24,
  reminder_channel: 'whatsapp',
  reminder_push_enabled: false,
  booking_enabled: false,
  booking_slug: null,
  booking_intro: null,
  booking_lead_hours: 12,
  booking_horizon_days: 60,
  booking_verify_sms: false,
  patient_changes_enabled: false,
  patient_changes_notice_hours: 24,
  google_review_url: null,
  whatsapp_number: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MEMBERSHIP: Membership = {
  id: 'membership-1',
  clinic_id: CLINIC.id,
  user_id: 'user-1',
  role: 'owner',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

const PROFILE: Profile = {
  id: MEMBERSHIP.user_id,
  full_name: 'Test Practitioner',
  phone: null,
  preferred_locale: 'he',
  created_via: 'staff',
  avatar_url: null,
  title: null,
  license_number: null,
  national_id: null,
  email: 'practitioner@example.test',
  address: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export function testMembershipContext(
  overrides: {
    clinic?: Partial<Clinic>;
    membership?: Partial<Membership>;
    profile?: Partial<Profile> | null;
    isPlatformAdmin?: boolean;
  } = {},
): MembershipContext {
  const clinic = { ...CLINIC, ...overrides.clinic };
  return {
    clinic,
    membership: { ...MEMBERSHIP, clinic_id: clinic.id, ...overrides.membership },
    profile: overrides.profile === null ? null : { ...PROFILE, ...overrides.profile },
    isPlatformAdmin: overrides.isPlatformAdmin ?? false,
  };
}

/** The pair an action expects back from `getClinicScope()`. */
export function testClinicScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the double is shaped like the client, not typed as it
  supabase: any,
  overrides?: Parameters<typeof testMembershipContext>[0],
) {
  return { supabase, context: testMembershipContext(overrides) };
}
