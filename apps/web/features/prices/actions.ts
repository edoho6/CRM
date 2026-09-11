'use server';

import { shopRefreshSchema, shopStoreStatusSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * The two things a platform admin may do to a shop from the app.
 *
 * Both go through functions that check is_platform_admin() themselves; the
 * check here only saves a round trip. The reader itself is never called
 * with a service key from here — the app has none. "Read now" asks the
 * database to put the shop first in line and then, when the shared secret is
 * configured, knocks on the reader's door so it starts within seconds rather
 * than at the next scheduled tick.
 */

export async function setStoreStatus(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!scope.context.isPlatformAdmin) return actionError(new Error('forbidden'));

  const parsed = shopStoreStatusSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.rpc('shop_set_store_status', {
    p_store: parsed.data.storeId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return actionError(error);
  return actionOk();
}

export async function refreshStoreNow(input: unknown): Promise<ActionResult<{ started: boolean }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!scope.context.isPlatformAdmin) return actionError(new Error('forbidden'));

  const parsed = shopRefreshSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase.rpc('shop_request_refresh', { p_store: parsed.data.storeId });
  if (error) return actionError(error);
  const slug = typeof data === 'string' ? data : null;
  const started = slug ? await knock(slug) : false;
  return actionOk({ started });
}

/**
 * Asks the reader to run now for one shop. Waits a few seconds for an
 * answer and no longer: a full pass takes up to a minute, the reader keeps
 * going after this returns, and the request is already recorded in the
 * database for the next tick either way.
 */
async function knock(slug: string): Promise<boolean> {
  const secret = process.env.SHOP_PRICES_SECRET;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !base) return false;
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/fetch-shop-prices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shop-prices-secret': secret },
      body: JSON.stringify({ trigger: 'manual', store: slug }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    // A timeout is the usual case for a shop with many pages: the reader is
    // busy reading. That is a success from the admin's point of view.
    return true;
  }
}
