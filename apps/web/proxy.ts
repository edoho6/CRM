import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@clinic/i18n/routing';
import { refreshSession } from '@clinic/db/middleware';
import { parseShellUserAgent } from '@clinic/domain/shell';

const intlMiddleware = createIntlMiddleware(routing);

/** `/`, `/he`, `/en`, with or without a trailing slash — the front door and nothing deeper. */
const ROOT = /^\/(he|en)?\/?$/;

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
  const { userId } = await refreshSession(request, response);

  // Someone who types the address and is not signed in sees what this is,
  // not a sign-in form. Only the front door: a deep link still goes to
  // sign-in and back to where it pointed, as before. The store app is the
  // exception: whoever opens it has already chosen the app, and the page
  // that sells it would be a strange first screen — it opens on sign-in.
  const root = request.nextUrl.pathname.match(ROOT);
  if (!userId && root && !parseShellUserAgent(request.headers.get('user-agent'))) {
    const locale = root[1] ?? routing.defaultLocale;
    const redirect = NextResponse.redirect(new URL(`/${locale}/about`, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // Everything except Next internals, the auth callback, and files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|favicon.ico|.*\\..*).*)'],
};
