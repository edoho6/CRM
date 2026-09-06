import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { readSupabaseEnv } from '@clinic/db';
import { approveTransaction, type GrowEnvironment } from '@/features/billing/grow-client';

/**
 * Grow's server-to-server callback.
 *
 * Grow sends no signature we could verify, so trust is anchored elsewhere: the
 * only thing this route can do is settle a payment whose `processId` this system
 * generated and stored. An unknown id does nothing. That check lives inside
 * `settle_grow_payment`, which is also idempotent, because Grow retries.
 *
 * There is no signed-in user on a webhook, so this uses a bare anon client with
 * no cookies — it can reach exactly one definer-rights function and nothing else.
 * That is deliberate: a leaked service-role key would be far worse than a
 * narrowly scoped function.
 *
 * Grow requires an `approveTransaction` acknowledgement after every callback;
 * without it the transaction stays unacknowledged on their side.
 */

interface GrowCallbackShape {
  processId?: string;
  processToken?: string;
  transactionId?: string;
  transactionCode?: string;
  status?: string;
  cField1?: string;
  [key: string]: unknown;
}

/** Grow may post form-encoded or JSON; accept whichever arrives. */
async function readPayload(request: Request): Promise<GrowCallbackShape> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as GrowCallbackShape;
  }

  const form = await request.formData();
  const payload: GrowCallbackShape = {};
  for (const [key, value] of form.entries()) {
    payload[key] = typeof value === 'string' ? value : value.name;
  }
  return payload;
}

export async function POST(request: Request) {
  const env = readSupabaseEnv();
  if (!env) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  let payload: GrowCallbackShape;
  try {
    payload = await readPayload(request);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const processId = payload.processId ? String(payload.processId) : null;
  if (!processId) {
    return NextResponse.json({ error: 'missing_process_id' }, { status: 400 });
  }

  // Cookie-less client: this request carries no user session by definition.
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
  });

  const succeeded = String(payload.status ?? '1') === '1';
  const transactionId =
    (payload.transactionId ? String(payload.transactionId) : null) ??
    (payload.transactionCode ? String(payload.transactionCode) : null);

  const { error } = await supabase.rpc('settle_grow_payment', {
    p_process_id: processId,
    p_transaction_id: transactionId,
    p_status: succeeded ? 'paid' : 'failed',
    p_raw: payload as unknown as Record<string, unknown>,
  });

  if (error) {
    // An unknown process id lands here. Answer 200 anyway: retrying will not
    // help Grow, and a non-2xx would have them hammering the endpoint.
    console.error('[grow-webhook] settle failed', error.message);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Acknowledge to Grow. Credentials are read here rather than passed in,
  // because the webhook has no clinic context of its own.
  const processToken = payload.processToken ? String(payload.processToken) : null;
  if (processToken) {
    // `clinic_payment_settings` is owner-only, and this request has no user.
    // The function below hands back the credentials for this one payment,
    // keyed by the process id the callback already proved it holds.
    const { data: credentialRows } = await supabase.rpc('grow_credentials_for_process', {
      p_process_id: processId,
    });

    const settings = (
      credentialRows as
        | { environment: GrowEnvironment; grow_user_id: string | null; grow_page_code: string | null }[]
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
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
