import { redirect } from '@clinic/i18n/navigation';
import { PREF_KEYS } from '@/lib/prefs';
import { InstallHint } from '@clinic/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';
import { AppShell } from '@/components/app-shell';
import { ReferenceSheetProvider } from '@/features/reference/reference-sheet';
import { getMembershipContext } from '@/lib/session';
import { needsSecondFactor } from '@/lib/second-factor';
import { tryCreateServerSupabase } from '@clinic/db/server';
import { getCurrentUser } from '@clinic/db/server';
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
  const tInstall = await getTranslations({ locale, namespace: 'common.install' });

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  const context = await getMembershipContext();
  if (!context) {
    // Signed in but in no clinic: a new account whose clinic is one step
    // away, or a portal patient in the wrong app. Both are told, on the
    // welcome page, rather than being bounced to a login they just passed.
    const user = await getCurrentUser();
    // With an authenticator on the account, the database holds the clinic
    // closed until the code is given — so there is no membership to find
    // yet, and the person is sent to give it rather than to a welcome page.
    const supabase = user ? await tryCreateServerSupabase() : null;
    if (supabase && (await needsSecondFactor(supabase))) {
      redirect({ href: '/verify', locale: locale as Locale });
      return null;
    }
    redirect({ href: user ? '/welcome' : '/login', locale: locale as Locale });
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
      // A clinic that holds no stock never sees the stock room at all — the
      // setting is read once here rather than checked on every screen.
      tracksInventory={context.clinic.tracks_inventory !== false}
      // A sandbox clinic announces itself on every screen. Read here, once, for
      // the same reason as the setting above.
      isSynthetic={context.clinic.is_synthetic === true}
      isPlatformAdmin={context.isPlatformAdmin}
      homePath={context.profile?.home_path ?? '/'}
      onSignOut={handleSignOut}
    >
      <ReferenceSheetProvider>{children}</ReferenceSheetProvider>
      {/* The home-screen hint, on a phone, until it is dismissed or the app
          runs from the home screen. Fixed above the tab bar: nothing shifts. */}
      <InstallHint
        storageKey={PREF_KEYS.installHintHidden}
        labels={{
          title: tInstall('title'),
          body: tInstall('body'),
          install: tInstall('install'),
          ios: tInstall('ios'),
          other: tInstall('other'),
          dismiss: tInstall('dismiss'),
        }}
        icon={
          <img
            src="/icons/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl"
          />
        }
      />
    </AppShell>
  );
}
