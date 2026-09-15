// What Grow tells us about a payment.
//
// Grow (Meshulam) posts here when a payment page finishes. It sends no
// signature we could verify, so the credential is the *process token*: a value
// Grow issued when the payment was created, which this system stored at that
// moment and has never published. The process id alone proves nothing — it
// travels through the payer's own browser — and that is exactly how this used
// to be settled.
//
// Why here and not in the web app: settling a payment writes across the
// clinic boundary with no signed-in user, which only the service role may do,
// and the web app by design holds none. It used to call `settle_grow_payment`
// with the public anon key, which meant anyone else could too.
//
// There is no secret in this address. The address is public because Grow has
// to reach it and can carry nothing extra; a secret in the query string would
// be written into every proxy log on the way. The token in the body is the
// whole of the check, and a request without a matching one changes nothing.
//
// Deploy:
//   supabase functions deploy grow-webhook --no-verify-jwt
//
// Then put the function's address in the clinic's Grow account as the
// notification URL — DEPLOY.md, "סליקה דרך Grow".

import { createClient } from 'npm:@supabase/supabase-js@2';

const GROW_BASE = {
  sandbox: 'https://sandbox.meshulam.co.il/api/light/server/1.0',
  production: 'https://secure.meshulam.co.il/api/light/server/1.0',
} as const;

type GrowEnvironment = keyof typeof GROW_BASE;

interface Callback {
  processId?: string;
  processToken?: string;
  transactionId?: string;
  transactionCode?: string;
  status?: string;
  [key: string]: unknown;
}

/** Grow may post form-encoded or JSON; accept whichever arrives. */
async function readPayload(request: Request): Promise<Callback> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as Callback;
  }
  const form = await request.formData();
  const payload: Callback = {};
  for (const [key, value] of form.entries()) {
    payload[key] = typeof value === 'string' ? value : value.name;
  }
  return payload;
}

/**
 * Acknowledges the transaction to Grow, which requires it after every
 * callback. Best effort: the payment is already settled by this point, and a
 * failure here is Grow's retry to make, not a reason to lose the settlement.
 */
async function approveTransaction(
  credentials: { environment: GrowEnvironment; userId: string; pageCode: string },
  processId: string,
  processToken: string,
): Promise<void> {
  const form = new FormData();
  form.append('pageCode', credentials.pageCode);
  form.append('userId', credentials.userId);
  form.append('processId', processId);
  form.append('processToken', processToken);
  try {
    await fetch(`${GROW_BASE[credentials.environment] ?? GROW_BASE.sandbox}/approveTransaction/`, {
      method: 'POST',
      body: form,
    });
  } catch {
    // Nothing to do and nothing to say: no patient or clinic detail belongs in
    // a log here, and the money is already recorded.
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: Callback;
  try {
    payload = await readPayload(request);
  } catch {
    return Response.json({ received: true, reason: 'invalid_payload' }, { status: 400 });
  }

  const processId = payload.processId ? String(payload.processId) : '';
  const processToken = payload.processToken ? String(payload.processToken) : '';

  // Checked before the database is touched, so a flood of empty posts costs a
  // string comparison rather than a query.
  if (!processId || !processToken || processId.length > 200 || processToken.length > 200) {
    return Response.json(
      { received: true, reason: 'missing_process_credentials' },
      { status: 400 },
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const succeeded = String(payload.status ?? '1') === '1';
  const transactionId =
    (payload.transactionId ? String(payload.transactionId) : null) ??
    (payload.transactionCode ? String(payload.transactionCode) : null);

  const { error } = await supabase.rpc('settle_grow_payment', {
    p_process_id: processId,
    p_process_token: processToken,
    p_transaction_id: transactionId,
    p_status: succeeded ? 'paid' : 'failed',
    p_raw: payload,
  });

  if (error) {
    // An unknown process id or a token that does not match lands here, and so
    // does a forged callback. Answer 200 regardless: a non-2xx has Grow
    // retrying something no retry would fix. The short code says which, with
    // nothing of the payment in it.
    const reason = error.message?.includes('payment_token_mismatch')
      ? 'token_mismatch'
      : error.message?.includes('payment_not_found')
        ? 'unknown_process'
        : 'settle_failed';
    return Response.json({ received: true, reason }, { status: 200 });
  }

  // Credentials for the acknowledgement, for this one payment only.
  const { data: credentialRows } = await supabase.rpc('grow_credentials_for_process', {
    p_process_id: processId,
  });
  const settings = (
    credentialRows as
      | {
          environment: GrowEnvironment;
          grow_user_id: string | null;
          grow_page_code: string | null;
        }[]
      | null
  )?.[0];

  if (settings?.grow_user_id && settings.grow_page_code) {
    await approveTransaction(
      {
        environment: settings.environment,
        userId: settings.grow_user_id,
        pageCode: settings.grow_page_code,
      },
      processId,
      processToken,
    );
  }

  return Response.json({ received: true }, { status: 200 });
});
