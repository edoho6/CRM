import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import { tryCreateServerSupabase } from '@clinic/db/server';
import type { InvitationSummary } from '@clinic/db/types';
import { Card, CardBody } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { Leaf } from 'lucide-react';
import { Link } from '@clinic/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getMembershipContext } from '@/lib/session';
import { SignupForm } from './signup-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('auth.signup', 'title');

/**
 * A new clinic, from nothing.
 *
 * The same frame as sign-in, so the two read as one door. Someone already
 * signed in and already in a clinic has no business here and goes home.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ join?: string }>;
}) {
  const { locale } = await params;
  const { join } = await searchParams;
  setRequestLocale(locale);

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  const context = await getMembershipContext();
  if (context) {
    redirect({ href: '/', locale: locale as Locale });
  }

  const t = await getTranslations('auth.signup');
  const tc = await getTranslations('common');

  // From an invitation link: the clinic already exists, and is named here.
  let joining: { token: string; clinic: string } | null = null;
  if (join && UUID.test(join)) {
    const supabase = await tryCreateServerSupabase();
    const { data } = supabase ? await supabase.rpc('invitation_by_token', { p_token: join }) : { data: null };
    const summary = (Array.isArray(data) ? data[0] : null) as InvitationSummary | null | undefined;
    if (summary?.status === 'open') joining = { token: join, clinic: summary.clinic_name };
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{tc('appName')}</h1>
            <p className="text-xs text-ink-500">{tc('appTagline')}</p>
          </div>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">
                {joining ? t('joinTitle', { clinic: joining.clinic }) : t('title')}
              </h2>
              <p className="text-xs text-ink-500">{joining ? t('joinSubtitle') : t('subtitle')}</p>
            </div>
            <SignupForm locale={locale as Locale} joinToken={joining?.token} joinClinic={joining?.clinic} />
          </CardBody>
        </Card>

        <p className="text-center text-sm text-ink-600">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-jade-800 underline-offset-2 hover:underline">
            {t('signInInstead')}
          </Link>
        </p>

        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
