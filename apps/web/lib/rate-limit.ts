/**
 * The sign-in rate limiter moved to the shared data package so the portal's
 * sign-in (a code, a password for the stores' reviewers) counts attempts the
 * same way. This path stays for the five places that import it here.
 */
export { checkRateLimit, clearAttempts, recordFailure, type RateLimitResult } from '@clinic/db/rate-limit';
