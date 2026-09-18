// What Grow says about a payment, read the way Grow sends it.
//
// Grow's server callback is a form post in PHP's nested style — the useful
// fields are `data[processId]`, `data[statusCode]`, `data[sum]` and so on, with a
// top-level `status` that describes the *request*, not the payment (see
// developers.grow.business, "Server-to-Server Callback"). The webhook used to
// read `processId` and `status` at the top level: it found no process id in a
// real callback, and a callback without a status counted as paid.
//
// Grow signs nothing. What we can check is the process token it gave us when
// the payment was created (stored, never published) and, before any money is
// recorded, the transaction as Grow's own server describes it when we ask.
//
// Plain TypeScript with no Deno or Node imports, so the web app's tests can
// load it (apps/web/lib/grow-callback.test.ts).

export interface GrowCallback {
  processId: string | null;
  processToken: string | null;
  transactionId: string | null;
  transactionToken: string | null;
  /** Grow's payment status code; '2' is a completed payment. */
  statusCode: string | null;
  sum: number | null;
}

type Fields = Record<string, unknown>;

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 && s.length <= 200 ? s : null;
}

function amount(value: unknown): number | null {
  const s = text(value);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * A field from any of the shapes a callback arrives in: flat form keys
 * (`data[processId]`), a nested object (`data.processId`, from JSON), or the
 * top level (older integrations).
 */
function field(fields: Fields, name: string): unknown {
  const flat = fields[`data[${name}]`];
  if (flat !== undefined) return flat;
  const nested = fields.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const value = (nested as Fields)[name];
    if (value !== undefined) return value;
  }
  return fields[name];
}

export function readGrowCallback(fields: Fields): GrowCallback {
  return {
    processId: text(field(fields, 'processId')),
    processToken: text(field(fields, 'processToken')),
    transactionId: text(field(fields, 'transactionId')),
    transactionToken: text(field(fields, 'transactionToken')),
    statusCode: text(field(fields, 'statusCode')),
    sum: amount(field(fields, 'sum')),
  };
}

/** Only an explicit completed code is a payment; anything else — missing included — is not. */
export function callbackSaysPaid(callback: GrowCallback): boolean {
  return callback.statusCode === '2';
}

export interface VerifiedTransaction {
  paid: boolean;
  sum: number | null;
}

/**
 * Grow's own answer about a transaction, from `getTransactionInfo`. The
 * request succeeded only when the top-level `status` is 1; the transaction is
 * paid only when its own status code is 2. Anything unreadable is null — and
 * null settles nothing.
 */
export function readTransactionInfo(response: unknown): VerifiedTransaction | null {
  if (!response || typeof response !== 'object') return null;
  const body = response as Fields;
  if (String(body.status ?? '') !== '1') return null;
  let data = body.data as unknown;
  if (Array.isArray(data)) data = data[0];
  if (!data || typeof data !== 'object') return null;
  const record = data as Fields;
  const code = text(record.statusCode ?? record.transactionStatusCode);
  if (code === null) return null;
  return { paid: code === '2', sum: amount(record.sum ?? record.transactionSum) };
}

/** Same amount to the agora: money compared as whole agorot, never as floats. */
export function sameAmount(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}
