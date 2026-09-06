import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@clinic/i18n/routing';
import { refreshSession } from '@clinic/db/middleware';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Locale routing and Supabase session refresh, in that order and on one response.
 *
 * The intl middleware decides the final response (it may rewrite `/patients` to
 * `/he/patients` or redirect), and the refreshed auth cookies are then written onto
 * that same object. Running them as two separate responses would drop either the
 * locale rewrite or the new session cookies.
 *
 * Named `proxy` because Next 16 renamed this file convention from `middleware`.
 */
export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  await refreshSession(request, response);
  return response;
}

export const config = {
  // Everything except Next internals, the auth callback, and files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|favicon.ico|.*\\..*).*)'],
};
