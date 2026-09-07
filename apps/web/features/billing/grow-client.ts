import 'server-only';

/**
 * Grow (formerly Meshulam) payment API client.
 *
 * Flow, per Grow's documentation:
 *   1. Our server calls `createPaymentProcess` and gets back a payment URL.
 *   2. The patient pays on that URL (redirect or iframe).
 *   3. Grow POSTs the result to our `notifyUrl`.
 *   4. Our server calls `approveTransaction` to acknowledge it.
 *
 * Two things Grow is strict about and that shape this file:
 * - Requests must come from a server. Browser-side calls are blocked, hence
 *   `server-only` at the top.
 * - Parameters must not contain special characters, so every free-text field
 *   (a patient's name, a treatment description) goes through `clean()` before
 *   it is sent.
 */

const BASE_URLS = {
  sandbox: 'https://sandbox.meshulam.co.il/api/light/server/1.0',
  production: 'https://secure.meshulam.co.il/api/light/server/1.0',
} as const;

export type GrowEnvironment = keyof typeof BASE_URLS;

export interface GrowCredentials {
  environment: GrowEnvironment;
  userId: string;
  pageCode: string;
}

export interface CreatePaymentProcessInput {
  sum: number;
  description: string;
  fullName: string;
  phone: string;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Grow issues the tax document itself when invoicing is enabled on their side. */
  invoiceNotifyUrl?: string;
  /** Our invoice id, echoed back on the callback so we can match it up. */
  reference?: string;
  maxPayments?: number;
}

export interface GrowPaymentProcess {
  url: string;
  processId: string;
  processToken: string;
}

export interface GrowResult<T> {
  ok: boolean;
  data?: T;
  /** Grow's own message, kept for the audit trail rather than shown to a patient. */
  error?: string;
  raw?: unknown;
}

/**
 * Grow rejects special characters outright, so strip rather than escape: a
 * rejected charge is worse than a slightly plainer description.
 */
function clean(value: string, maxLength = 120): string {
  return value
    .replace(/[^\p{L}\p{N} .,'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Grow expects an Israeli mobile number with no separators. */
function cleanPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('972')) return `0${digits.slice(3)}`;
  return digits;
}

/**
 * Grow requires at least two names. A single-word patient name would be
 * rejected, so pad it rather than fail the charge.
 */
function cleanFullName(value: string): string {
  const cleaned = clean(value, 60);
  return cleaned.includes(' ') ? cleaned : `${cleaned} .`;
}

async function post(
  credentials: GrowCredentials,
  path: string,
  fields: Record<string, string>,
): Promise<GrowResult<Record<string, unknown>>> {
  const form = new FormData();
  form.append('pageCode', credentials.pageCode);
  form.append('userId', credentials.userId);
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URLS[credentials.environment]}/${path}/`, {
      method: 'POST',
      body: form,
      // Payment calls must never be served from a cache.
      cache: 'no-store',
    });
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'network_error' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: 'invalid_response', raw: await response.text().catch(() => null) };
  }

  const body = payload as {
    status?: number | string;
    data?: Record<string, unknown>;
    err?: unknown;
  };
  // Grow signals success with status 1.
  const succeeded = String(body?.status ?? '') === '1';

  if (!succeeded) {
    const err = body?.err as { message?: string } | undefined;
    return { ok: false, error: err?.message ?? 'grow_rejected', raw: payload };
  }

  return { ok: true, data: body.data ?? {}, raw: payload };
}

export async function createPaymentProcess(
  credentials: GrowCredentials,
  input: CreatePaymentProcessInput,
): Promise<GrowResult<GrowPaymentProcess>> {
  const fields: Record<string, string> = {
    sum: input.sum.toFixed(2),
    description: clean(input.description, 100),
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    notifyUrl: input.notifyUrl,
    'pageField[fullName]': cleanFullName(input.fullName),
    'pageField[phone]': cleanPhone(input.phone),
  };

  if (input.email) fields['pageField[email]'] = input.email.trim();
  if (input.invoiceNotifyUrl) fields.invoiceNotifyUrl = input.invoiceNotifyUrl;
  // cField1 comes back on the callback untouched — it carries our invoice id.
  if (input.reference) fields.cField1 = input.reference;
  if (input.maxPayments && input.maxPayments > 1) {
    fields.maxPaymentNum = String(input.maxPayments);
  }

  const result = await post(credentials, 'createPaymentProcess', fields);
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error, raw: result.raw };
  }

  const url = String(result.data.url ?? '');
  const processId = String(result.data.processId ?? '');
  const processToken = String(result.data.processToken ?? '');

  if (!url || !processId) {
    return { ok: false, error: 'missing_payment_url', raw: result.raw };
  }

  return { ok: true, data: { url, processId, processToken }, raw: result.raw };
}

/**
 * Acknowledges a callback.
 *
 * Grow requires this after every server notification; without it the transaction
 * is treated as unacknowledged on their side.
 */
export async function approveTransaction(
  credentials: GrowCredentials,
  processId: string,
  processToken: string,
): Promise<GrowResult<Record<string, unknown>>> {
  return post(credentials, 'approveTransaction', {
    processId,
    processToken,
  });
}

export function growEnvironmentLabel(environment: GrowEnvironment): string {
  return environment === 'production' ? 'production' : 'sandbox';
}
