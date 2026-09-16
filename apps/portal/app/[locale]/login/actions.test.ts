import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createSupabaseDouble } from '@clinic/db/test-double';

/**
 * The portal's front door.
 *
 * This is the only place a patient signs in, and until now nothing tested it.
 * The three cases that matter are not about the happy path:
 *
 *   · the password door is asked about **before** anything is claimed. It used
 *     to be asked after `claim_portal_access`, which meant a real patient who
 *     happened to hold a password got a live session and a linked access row
 *     before being turned away (migration 68);
 *   · a refused sign-in ends this session only. `signOut()` with its default
 *     scope ends every session the account holds anywhere, which is not what a
 *     wrong answer at a door should do;
 *   · the magic-link form answers the same whether the address is known or not,
 *     rate limit included — otherwise the timing tells an attacker who is a
 *     patient here.
 */

const { headers } = vi.hoisted(() => ({
  headers: vi.fn(async () => new Map([['x-forwarded-for', '203.0.113.9']])),
}));
const { createServerSupabase, isSupabaseConfigured } = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    // Next's redirect throws to unwind the request; the sentinel lets a test
    // say "this path got as far as sending the patient in".
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/headers', () => ({ headers }));
vi.mock('@clinic/i18n/navigation', () => ({ redirect }));
vi.mock('@clinic/db', () => ({
  createServerSupabase,
  isSupabaseConfigured,
  siteUrl: () => 'https://portal.example',
}));
vi.mock('../account/push-actions', () => ({
  unregisterPortalPushDeviceFromCookie: vi.fn(async () => {}),
}));

const { sendMagicLink, signInWithPassword } = await import('./actions');
const { clearAttempts } = await import('@clinic/db/rate-limit');

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

/** A fresh address per test: the rate limiter is a module-level store. */
let counter = 0;
function freshEmail(): string {
  counter += 1;
  return `patient${counter}@example.test`;
}

beforeEach(() => {
  vi.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(true);
});

describe('signInWithPassword', () => {
  it('asks whether the door is open before claiming the patient file', async () => {
    const db = createSupabaseDouble({
      auth: { signInWithPassword: () => ({ data: {}, error: null }) },
      rpc: { portal_password_login_allowed: () => true, claim_portal_access: () => null },
    });
    createServerSupabase.mockResolvedValue(db.client);

    await expect(
      signInWithPassword(
        'he',
        { status: 'idle' },
        form({ email: freshEmail(), password: 'a-password' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT');

    const order = db.calls.map((call) => call.target);
    expect(order.indexOf('portal_password_login_allowed')).toBeLessThan(
      order.indexOf('claim_portal_access'),
    );
  });

  it('claims nothing and ends only this session when the door is shut', async () => {
    const db = createSupabaseDouble({
      auth: { signInWithPassword: () => ({ data: {}, error: null }) },
      rpc: { portal_password_login_allowed: () => false, claim_portal_access: () => null },
    });
    createServerSupabase.mockResolvedValue(db.client);

    const state = await signInWithPassword(
      'he',
      { status: 'idle' },
      form({ email: freshEmail(), password: 'a-password' }),
    );

    expect(state).toEqual({ status: 'notAllowed' });
    expect(db.callsTo('claim_portal_access')).toHaveLength(0);
    expect(redirect).not.toHaveBeenCalled();
    // Local scope, not the account's sessions everywhere.
    expect(db.callsTo('signOut')[0].payload).toEqual({ scope: 'local' });
  });

  it('rejects a wrong password without asking the database anything', async () => {
    const db = createSupabaseDouble({
      auth: { signInWithPassword: () => ({ data: null, error: { message: 'invalid' } }) },
    });
    createServerSupabase.mockResolvedValue(db.client);

    const state = await signInWithPassword(
      'he',
      { status: 'idle' },
      form({ email: freshEmail(), password: 'wrong' }),
    );

    expect(state).toEqual({ status: 'invalidCredentials' });
    expect(db.calls.filter((call) => call.operation === 'rpc')).toHaveLength(0);
  });

  it('locks the address out after repeated wrong passwords', async () => {
    const email = freshEmail();
    const db = createSupabaseDouble({
      auth: { signInWithPassword: () => ({ data: null, error: { message: 'invalid' } }) },
    });
    createServerSupabase.mockResolvedValue(db.client);

    let state = { status: 'idle' } as Awaited<ReturnType<typeof signInWithPassword>>;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      state = await signInWithPassword('he', state, form({ email, password: 'wrong' }));
      if (state.status === 'tooManyAttempts') break;
    }

    expect(state.status).toBe('tooManyAttempts');
    clearAttempts(`portal|${email}|203.0.113.9`);
  });

  it('refuses a malformed address before it reaches the auth service', async () => {
    const db = createSupabaseDouble();
    createServerSupabase.mockResolvedValue(db.client);

    const state = await signInWithPassword(
      'he',
      { status: 'idle' },
      form({ email: 'not-an-address', password: 'a-password' }),
    );

    expect(state).toEqual({ status: 'invalidCredentials' });
    expect(createServerSupabase).not.toHaveBeenCalled();
  });
});

describe('sendMagicLink', () => {
  it('never creates an account for an address the clinic did not register', async () => {
    const db = createSupabaseDouble({ auth: { signInWithOtp: () => ({ error: null }) } });
    createServerSupabase.mockResolvedValue(db.client);

    const state = await sendMagicLink('he', { status: 'idle' }, form({ email: freshEmail() }));

    expect(state).toEqual({ status: 'sent' });
    expect(db.callsTo('signInWithOtp')[0].payload).toMatchObject({
      options: { shouldCreateUser: false },
    });
  });

  it('answers "sent" once the rate limit bites, so the form cannot be used to probe', async () => {
    const email = freshEmail();
    const db = createSupabaseDouble({ auth: { signInWithOtp: () => ({ error: null }) } });
    createServerSupabase.mockResolvedValue(db.client);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sendMagicLink('he', { status: 'idle' }, form({ email }));
    }
    const sentCount = db.callsTo('signInWithOtp').length;

    const state = await sendMagicLink('he', { status: 'idle' }, form({ email }));

    // Same answer as a delivered link, and no sixth mail.
    expect(state).toEqual({ status: 'sent' });
    expect(db.callsTo('signInWithOtp')).toHaveLength(sentCount);
    clearAttempts(`portal|link:${email}|203.0.113.9`);
  });

  it('says so plainly when the app has no database configured', async () => {
    isSupabaseConfigured.mockReturnValue(false);

    const state = await sendMagicLink('he', { status: 'idle' }, form({ email: freshEmail() }));

    expect(state).toEqual({ status: 'notConfigured' });
    expect(createServerSupabase).not.toHaveBeenCalled();
  });
});
