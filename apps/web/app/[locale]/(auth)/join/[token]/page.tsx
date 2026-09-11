import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Alert, Button, Card, CardBody } from '@clinic/ui';
import { isSupabaseConfigured } from '@clinic/db';
import { getCurrentUser, tryCreateServerSupabase } from '@clinic/db/server';
import type { InvitationSummary } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { Link, redirect } from '@clinic/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getMembershipContext } from '@/lib/session';
import { JoinForm } from './join-form';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The page behind an invitation link.
 *
 * Reads the invitation through a token-checked function, so a guessed
 * address learns nothing and a real one shows only the clinic's name and
 * the role. Who is looking decides what it offers: sign up or sign in for
 * a stranger, one button for a signed-in account with no clinic, and a
 * plain answer for an account that already belongs somewhere.
 */
export default async function JoinPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  const t = await getTranslations('join');
  const tc = await getTranslations('common');
  const tRoles = await getTranslations('settings.team.roles');

  const supabase = await tryCreateServerSupabase();
  const { data } = UUID.test(token) && supabase ? await supabase.rpc('invitation_by_token', { p_token: token }) : { data: null };
  const summary = (Array.isArray(data) ? data[0] : null) as InvitationSummary | null | undefined;
  const context = await getMembershipContext();
  const user = await getCurrentUser();

  let body: React.ReactNode;
  if (!summary) {
    body = <Alert tone="warning">{t('notFound')}</Alert>;
  } else if (summary.status !== 'open') {
    body = <Alert tone="warning">{t('closed')}</Alert>;
  } else if (context) {
    body = (
      <div className="space-y-4">
        <Alert tone="info">{t('alreadyMember', { clinic: context.clinic.name })}</Alert>
        <Button asChild className="w-full">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    );
  } else if (user) {
    body = (
      <JoinForm locale={locale as Locale} token={token} clinic={summary.clinic_name} role={tRoles(summary.role)} />
    );
  } else {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-ink-800">{t('body', { clinic: summary.clinic_name, role: tRoles(summary.role) })}</p>
        <Button asChild className="w-full">
          <Link href={{ pathname: '/signup', query: { join: token } }}>{t('signUp')}</Link>
        </Button>
        <Link
          href={{ pathname: '/login', query: { join: token } }}
          className="block text-center text-sm text-jade-800 underline-offset-2 hover:underline"
        >
          {t('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{t('title')}</h1>
            <p className="text-xs text-ink-500">{tc('appName')}</p>
          </div>
        </div>
        <Card>
          <CardBody>{body}</CardBody>
        </Card>
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
