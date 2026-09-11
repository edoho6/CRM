import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import { getCurrentUser, tryCreateServerSupabase } from '@clinic/db/server';
import { Button, Card, CardBody } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { ShieldCheck } from 'lucide-react';
import { needsSecondFactor } from '@/lib/second-factor';
import { pageTitle } from '@/lib/page-title';
import { signOutAction } from '../actions';
import { VerifyForm } from './verify-form';

export const generateMetadata = pageTitle('auth.verify', 'title');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The second step of signing in, for an account that has an authenticator.
 *
 * The password has been accepted; the clinic is still closed — the database
 * itself keeps it closed (migration 39) until the code from the app is
 * given here. Someone who lands here with no factor to give is sent on.
 */
export default async function VerifyPage({
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

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: locale as Locale });
    return null;
  }

  const supabase = await tryCreateServerSupabase();
  if (!supabase || !(await needsSecondFactor(supabase))) {
    redirect({ href: '/', locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('auth.verify');
  const tc = await getTranslations('common');
  const tNav = await getTranslations('nav');

  async function handleSignOut() {
    'use server';
    await signOutAction(locale as Locale);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold text-ink-900">{tc('appName')}</h1>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">{t('title')}</h2>
              <p className="text-xs text-ink-500">{t('subtitle')}</p>
            </div>
            <VerifyForm locale={locale as Locale} joinToken={join && UUID.test(join) ? join : undefined} />
            <form action={handleSignOut} className="text-center">
              <Button type="submit" variant="ghost" size="sm">
                {tNav('signOut')}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
