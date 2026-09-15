import 'server-only';

/**
 * A small in-process rate limiter for the sign-in form.
 *
 * Two honest limitations, stated here rather than discovered later:
 *
 * It is per-process. On one server it is a real control; behind several
 * instances an attacker gets one budget per instance. That is a meaningful
 * weakening but not a defeat, and the alternative — a shared store — is not
 * worth adding before there is a second instance to share it with.
 *
 * It is memory only, so a restart clears it. Again: it raises the cost of
 * guessing, which is what it is for. Supabase applies its own limits underneath
 * this, so neither layer is load-bearing alone.
 *
 * When this app is deployed behind more than one instance, replace the Map with
 * the shared store and delete this comment.
 */

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const attempts = new Map<string, Attempt>();

/** Failures allowed inside the window before the key is locked out. */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

/**
 * A different budget, for a caller that is not a sign-in.
 *
 * The defaults are a password form's: eight wrong guesses buys a quarter of an
 * hour off. Counting something a person does on purpose — taking a copy of a
 * document, asking for a link by email — wants its own number, so the budget is
 * a parameter rather than a second copy of this file.
 */
export interface RateLimitOptions {
  /** Events allowed inside the window. */
  max?: number;
  windowMs?: number;
  blockMs?: number;
}

function budget(options?: RateLimitOptions) {
  return {
    max: options?.max ?? MAX_ATTEMPTS,
    windowMs: options?.windowMs ?? WINDOW_MS,
    blockMs: options?.blockMs ?? BLOCK_MS,
  };
}
/** Nothing is remembered for longer than this, so the map cannot grow forever. */
const SWEEP_AFTER_MS = 60 * 60 * 1000;

function sweep(now: number) {
  if (attempts.size < 500) return;
  for (const [key, entry] of attempts) {
    if (now - entry.firstAt > SWEEP_AFTER_MS && now > entry.blockedUntil) attempts.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfterSeconds: number;
}

/** Checks without recording anything: call before doing the work. */
export function checkRateLimit(key: string, options?: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const { windowMs } = budget(options);
  sweep(now);

  const entry = attempts.get(key);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };

  if (now < entry.blockedUntil) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  // The window has rolled over; start again.
  if (now - entry.firstAt > windowMs) {
    attempts.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Records one event against the key.
 *
 * For a sign-in that means one failure — a correct password is not suspicious.
 * For a download or a mailed link it means one of those, because there the
 * thing worth bounding is how many succeed.
 */
export function recordFailure(key: string, options?: RateLimitOptions): void {
  const now = Date.now();
  const { max, windowMs, blockMs } = budget(options);
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > windowMs) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  entry.count += 1;
  if (entry.count >= max) {
    entry.blockedUntil = now + blockMs;
  }
}

/** Clears the record after a successful sign-in. */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}
