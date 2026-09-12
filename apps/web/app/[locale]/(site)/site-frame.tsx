import { getTranslations } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Button } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getMembershipContext } from '@/lib/session';

/**
 * The header and footer of the public pages: the product's name, the way in
 * (or the way back to the dashboard for someone already signed in), the
 * language switch, and the links every public page owes its reader — what
 * this is, and the accessibility statement.
 */
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('site');
  const tc = await getTranslations('common');
  const context = await getMembershipContext();

  return (
    <>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link href="/about" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Leaf className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-semibold text-ink-900">{tc('appName')}</span>
            <span className="block text-xs text-ink-500">{tc('appTagline')}</span>
          </span>
        </Link>
        <nav aria-label={t('nav')} className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          {context ? (
            <Button asChild>
              <Link href="/">{t('cta.dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="secondary">
                <Link href="/login">{t('cta.login')}</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">{t('cta.signup')}</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-6 pb-16">
        {children}
      </main>

      <footer className="border-t border-ink-200 py-6 text-center text-xs text-ink-500">
        <p>{t('footer.note')}</p>
        <nav aria-label={t('footer.nav')} className="mt-2 flex flex-wrap justify-center gap-4">
          <Link href="/about" className="underline-offset-2 hover:text-ink-900 hover:underline">
            {t('footer.about')}
          </Link>
          <Link href="/accessibility" className="underline-offset-2 hover:text-ink-900 hover:underline">
            {t('footer.accessibility')}
          </Link>
          <Link href="/privacy" className="underline-offset-2 hover:text-ink-900 hover:underline">
            {t('footer.privacy')}
          </Link>
          <Link href="/terms" className="underline-offset-2 hover:text-ink-900 hover:underline">
            {t('footer.terms')}
          </Link>
          <Link href="/delete-account" className="underline-offset-2 hover:text-ink-900 hover:underline">
            {t('footer.deleteAccount')}
          </Link>
          {context ? null : (
            <Link href="/login" className="underline-offset-2 hover:text-ink-900 hover:underline">
              {t('cta.login')}
            </Link>
          )}
        </nav>
      </footer>
    </>
  );
}
