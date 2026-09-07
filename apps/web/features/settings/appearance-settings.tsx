'use client';

import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Theme and language, given their own labelled home.
 *
 * Both already live in the sidebar as bare controls, which is right for
 * something switched daily and wrong for discovering that it exists at all. Here
 * each one is named and explained; there they are two icons you learn once.
 *
 * Both are per-browser rather than per-account, and the copy says so. Someone
 * who sets dark mode on a laptop and then opens the clinic on a tablet should
 * know why it did not follow them.
 */
export function AppearanceSettings() {
  const t = useTranslations('account');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink-900">{t('theme')}</span>
          <span className="block text-xs text-ink-600">{t('themeHint')}</span>
        </span>
        <ThemeToggle />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink-900">{t('language')}</span>
          <span className="block text-xs text-ink-600">{t('languageHint')}</span>
        </span>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
