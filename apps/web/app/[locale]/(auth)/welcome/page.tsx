import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import { getCurrentUser, tryCreateServerSupabase } from '@clinic/db/server';
import { Alert, Button, Card, CardBody } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { Leaf } from 'lucide-react';
import { getMembershipContext } from '@/lib/session';
import { needsSecondFactor } from '@/lib/second-factor';
import { signOutAction } from '../actions';
import { WelcomeForm } from './welcome-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('auth.welcome', 'title');

/**
 * Where a signed-in person with no clinic lands.
 *
 * Two kinds of people arrive here. Someone who just confirmed their sign-up
 * email, whose clinic is one click from existing. And a patient who opened
 * the staff app with their portal login by mistake — they are told so and
 * offered the way out, rather than being silently signed out as before,
 * which looked like a broken login.
 */
export default async function WelcomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  const context = await getMembershipContext();
  if (context) {
    redirect({ href: '/', locale: locale as Locale });
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: locale as Locale });
    return null;
  }

  const supabase = await tryCreateServerSupabase();
  // A member whose session still owes its code has no clinic yet; the code
  // comes first, not a welcome page offering to open a clinic.
  if (supabase && (await needsSecondFactor(supabase))) {
    redirect({ href: '/verify', locale: locale as Locale });
    return null;
  }
  const { data: patientId } = supabase ? await supabase.rpc('current_patient_id') : { data: null };
  const isPortalAccount = Boolean(patientId);

  const t = await getTranslations('auth.welcome');
  const tc = await getTranslations('common');
  const tNav = await getTranslations('nav');

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const clinicName = typeof metadata.clinic_name === 'string' ? metadata.clinic_name : '';
  const phone = typeof metadata.phone === 'string' ? metadata.phone : '';

  // An account made from an invitation link finishes the join here, after
  // the email confirmation put a screen between the sign-up and the clinic.
  const invitationToken = typeof metadata.invitation_token === 'string' ? metadata.invitation_token : '';
  let invitationClosed = false;
  if (invitationToken && supabase && !isPortalAccount) {
    const { error } = await supabase.rpc('accept_invitation', { p_token: invitationToken });
    if (!error || error.message.includes('already_member')) {
      redirect({ href: '/', locale: locale as Locale });
    }
    invitationClosed = true;
  }

  async function handleSignOut() {
    'use server';
    await signOutAction(locale as Locale);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Leaf className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold text-ink-900">{tc('appName')}</h1>
        </div>

        <Card>
          <CardBody className="space-y-4">
            {isPortalAccount ? (
              <>
                <Alert tone="info" title={t('portalTitle')}>
                  {t('portalBody')}
                </Alert>
                <form action={handleSignOut}>
                  <Button type="submit" variant="secondary" className="w-full">
                    {tNav('signOut')}
                  </Button>
                </form>
              </>
            ) : (
              <>
                {invitationClosed ? <Alert tone="warning">{t('invitationClosed')}</Alert> : null}
                <div>
                  <h2 className="text-sm font-semibold text-ink-900">{t('title')}</h2>
                  <p className="text-xs text-ink-500">{t('subtitle')}</p>
                </div>
                <WelcomeForm
                  locale={locale as Locale}
                  defaultClinicName={clinicName}
                  defaultPhone={phone}
                />
                <form action={handleSignOut} className="text-center">
                  <button
                    type="submit"
                    className="text-xs text-ink-500 underline-offset-2 hover:underline"
                  >
                    {tNav('signOut')}
                  </button>
                </form>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
