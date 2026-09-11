import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import { defaultLocale, isLocale } from '@clinic/i18n';

/**
 * Magic-link landing point.
 *
 * Exchanges the one-time code for a session, then calls `claim_portal_access()`,
 * which links this auth user to the patient file the clinic invited by that email
 * address. Until that link exists the patient's own Row Level Security policies
 * match nothing, so the claim has to happen before the first page render.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const localeParam = url.searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  if (!isSupabaseConfigured() || !code) {
    return NextResponse.redirect(new URL(`/${locale}/login`, url.origin));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Back to the sign-in page with a reason: a link that is opened twice, or
    // a day late, used to land on the same form with nothing said.
    return NextResponse.redirect(new URL(`/${locale}/login?error=expired`, url.origin));
  }

  // Best effort: a failure here still leaves a signed-in user, and the portal page
  // then shows the "not linked yet, contact the clinic" message.
  await supabase.rpc('claim_portal_access');

  return NextResponse.redirect(new URL(`/${locale}`, url.origin));
}
