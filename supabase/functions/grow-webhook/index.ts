// What Grow tells us about a payment.
//
// Grow (Meshulam) posts here when a payment page finishes. It signs nothing,
// so nothing in the post is taken on its word:
//
//   1 · the callback is read as Grow sends it — `data[processId]`,
//       `data[statusCode]`, … (../_shared/grow/callback.ts). A callback that
//       does not say "completed" (status code 2) records a failure at most;
//   2 · the process token must match the one Grow issued when the payment was
//       created, which we stored and never published — the process id alone
//       travels through the payer's browser and proves nothing;
//   3 · before any money is recorded, Grow's own server is asked about the
//       transaction (getTransactionInfo), and the amount it reports must equal
//       the amount we asked for, in shekels;
//   4 · `settle_grow_payment` does the rest in the database: idempotent, and a
//       paid payment never goes back, whatever arrives later or twice.
//
// A callback that cannot be verified settles nothing: the payment stays
// pending, where the desk sees it and can record it by hand. That is the
// failure worth having — the other one is an invoice marked paid that was not.
//
// Why here and not in the web app: settling writes across the clinic
// boundary with no signed-in user, which only the service role may do, and the
// web app by design holds none.
//
// Deploy:
//   supabase functions deploy grow-webhook --no-verify-jwt
//
// Then put the function's address in the clinic's Grow account as the
// notification URL — DEPLOY.md, "סליקה דרך Grow".

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  callbackSaysPaid,
  readGrowCallback,
  readTransactionInfo,
  sameAmount,
  type GrowCallback,
} from '../_shared/grow/callback.ts';

const GROW_BASE = {
  sandbox: 'https://sandbox.meshulam.co.il/api/light/server/1.0',
  production: 'https://secure.meshulam.co.il/api/light/server/1.0',
} as const;

type GrowEnvironment = keyof typeof GROW_BASE;

interface Credentials {
  environment: GrowEnvironment;
  userId: string;
  pageCode: string;
}

/** Grow posts form fields; JSON is accepted too. Values only, never files. */
async function readFields(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }
  const form = await request.formData();
  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}

function baseFor(environment: GrowEnvironment): string {
  return GROW_BASE[environment] ?? GROW_BASE.sandbox;
}

/** Asks Grow's server what it knows about this transaction. Null when it cannot say. */
async function verifyWithGrow(credentials: Credentials, callback: GrowCallback) {
  if (!callback.transactionId) return null;
  const form = new FormData();
  form.append('pageCode', credentials.pageCode);
  form.append('userId', credentials.userId);
  form.append('transactionId', callback.transactionId);
  if (callback.transactionToken) form.append('transactionToken', callback.transactionToken);
  if (callback.processId) form.append('processId', callback.processId);
  if (callback.processToken) form.append('processToken', callback.processToken);
  try {
    const response = await fetch(`${baseFor(credentials.environment)}/getTransactionInfo/`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) return null;
    return readTransactionInfo(await response.json());
  } catch {
    return null;
  }
}

/**
 * Acknowledges the transaction to Grow, which requires it after a callback.
 * Best effort: the payment is already settled by this point.
 */
async function approveTransaction(credentials: Credentials, callback: GrowCallback): Promise<void> {
  const form = new FormData();
  form.append('pageCode', credentials.pageCode);
  form.append('userId', credentials.userId);
  form.append('processId', callback.processId ?? '');
  form.append('processToken', callback.processToken ?? '');
  if (callback.transactionId) form.append('transactionId', callback.transactionId);
  try {
    await fetch(`${baseFor(credentials.environment)}/approveTransaction/`, {
      method: 'POST',
      body: form,
    });
  } catch {
    // Nothing of the patient or the clinic belongs in a log here.
  }
}

/** Every answer is a 200 with a short code: a non-2xx has Grow retrying what no retry would fix. */
function answer(reason: string | null, status = 200): Response {
  return Response.json(reason ? { received: true, reason } : { received: true }, { status });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let fields: Record<string, unknown>;
  try {
    fields = await readFields(request);
  } catch {
    return answer('invalid_payload', 400);
  }

  const callback = readGrowCallback(fields);
  if (!callback.processId || !callback.processToken) {
    return answer('missing_process_credentials', 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // The clinic's Grow identifiers, for this one payment only.
  const { data: credentialRows } = await supabase.rpc('grow_credentials_for_process', {
    p_process_id: callback.processId,
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
  if (!settings?.grow_user_id || !settings.grow_page_code) return answer('unknown_process');
  const credentials: Credentials = {
    environment: settings.environment,
    userId: settings.grow_user_id,
    pageCode: settings.grow_page_code,
  };

  // Only the raw fields Grow sent about the transaction are kept, never the
  // payer's details: those are Grow's to hold, not the log's.
  const raw = {
    processId: callback.processId,
    transactionId: callback.transactionId,
    statusCode: callback.statusCode,
    sum: callback.sum,
  };

  if (!callbackSaysPaid(callback)) {
    const { data } = await supabase.rpc('settle_grow_payment', {
      p_process_id: callback.processId,
      p_process_token: callback.processToken,
      p_transaction_id: null,
      p_status: 'failed',
      p_raw: raw,
    });
    const result = data as { ok?: boolean; reason?: string } | null;
    return answer(result?.ok ? 'not_completed' : (result?.reason ?? 'settle_failed'));
  }

  const verified = await verifyWithGrow(credentials, callback);
  if (!verified || !verified.paid || !sameAmount(verified.sum, callback.sum)) {
    // Not confirmed by Grow's server, or the two disagree about the amount.
    // Nothing is recorded; the payment stays pending for a person.
    return answer('unverified');
  }

  const { data, error } = await supabase.rpc('settle_grow_payment', {
    p_process_id: callback.processId,
    p_process_token: callback.processToken,
    p_transaction_id: callback.transactionId,
    p_status: 'paid',
    p_raw: raw,
    p_amount: verified.sum,
    p_currency: 'ILS',
  });
  const result = data as { ok?: boolean; reason?: string } | null;
  if (error || !result?.ok) return answer(result?.reason ?? 'settle_failed');

  await approveTransaction(credentials, callback);
  return answer(null);
});
