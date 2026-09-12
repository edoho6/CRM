import { getLocale, getTranslations } from 'next-intl/server';
import { LogOut, UserRound } from 'lucide-react';
import { InstallHint, Button } from '@clinic/ui';
import { PushRegistration } from '@clinic/native';
import { registerPortalPushDevice } from './account/push-actions';
import { Link } from '@clinic/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { PortalNav } from './portal-nav';
import { portalSignOut } from './login/actions';

/**
 * Every signed-in portal screen in one frame: a skip link, the screen's
 * title, the three-place navigation, the content as the main region, and a
 * foot with the language and the way out.
 *
 * The staff app's shell is a sidebar and a tab bar; a patient who opens
 * this twice a year gets three named places and nothing to learn. Signing
 * out moved from beside the title to the foot: it is the one thing on the
 * page nobody comes for, and it sat where the eye lands first.
 */
export async function PortalShell({
  current,
  title,
  children,
}: {
  current: 'home' | 'forms' | 'consent' | 'account';
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations('portal');
  const tNav = await getTranslations('nav');
  const tInstall = await getTranslations('common.install');
  const tLegal = await getTranslations('legal');
  const tPush = await getTranslations('portal.account.push');
  const locale = await getLocale();

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:pt-8">
      {/* Visually hidden until focused: the first thing a keyboard reaches. */}
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-popover"
      >
        {tNav('skipToContent')}
      </a>

      <header className="mb-5 space-y-4">
        {title ? <h1 className="text-2xl font-semibold text-ink-900">{title}</h1> : null}
        <PortalNav current={current} />
      </header>

      {/* Inside the store app only: this phone stays registered for the
          appointment reminders while the patient is signed in. */}
      <PushRegistration locale={locale} channelName={tPush('channelName')} register={registerPortalPushDevice} />

      {/* `tabIndex={-1}` so the skip link can move focus here. */}
      <main id="main-content" tabIndex={-1} className="flex-1 space-y-5 focus:outline-none">
        {children}
      </main>

      <InstallHint
        storageKey="herbalist-portal-install-hint-hidden"
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

      <footer className="mt-10 space-y-3 border-t border-ink-200 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LanguageSwitcher />
          <form action={portalSignOut}>
            <Button type="submit" variant="ghost">
              <LogOut className="h-4 w-4" aria-hidden />
              {t('signOut')}
            </Button>
          </form>
        </div>
        {/* The account (and the way to delete it) and the documents, where a
            foot is expected to hold them; none of the three is a place to
            visit twice a year, so none is in the navigation above. */}
        <nav aria-label={t('footer.nav')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <Link href="/account" className="inline-flex min-h-11 items-center gap-1 underline-offset-2 hover:text-ink-900 hover:underline">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {t('nav.account')}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline-offset-2 hover:text-ink-900 hover:underline">
            {tLegal('privacy.title')}
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center underline-offset-2 hover:text-ink-900 hover:underline">
            {tLegal('terms.title')}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
