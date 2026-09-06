import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@clinic/i18n/routing';
import { refreshSession } from '@clinic/db/middleware';

const intlMiddleware = createIntlMiddleware(routing);

/** Locale routing plus Supabase session refresh, as in the staff app. */
export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  await refreshSession(request, response);
  return response;
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|favicon.ico|.*\\..*).*)'],
};
