import { redirect } from '@clinic/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';
import { AppShell } from '@/components/app-shell';
import { getMembershipContext } from '@/lib/session';
import { signOutAction } from '../(auth)/actions';

/**
 * Authenticated shell.
 *
 * Three gates, in order: is the app configured, is someone signed in, and do they
 * belong to a clinic. A signed-in user without a membership is a patient-portal
 * account that wandered in, so they are signed back out rather than shown an empty
 * staff app.
 */

// Everything below this layout is per-user clinical data. Rendering it at build
// time would be meaningless at best and would bake one user's view into a static
// page at worst.
export const dynamic = 'force-dynamic';
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  const context = await getMembershipContext();
  if (!context) {
    redirect({ href: '/login', locale: locale as Locale });
    // Unreachable: next-intl's redirect throws but is typed as returning void.
    return null;
  }

  async function handleSignOut() {
    'use server';
    await signOutAction(locale as Locale);
  }

  return (
    <AppShell
      clinicName={context.clinic.name}
      userName={context.profile?.full_name ?? ''}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
}
