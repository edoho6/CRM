'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Select, useToast } from '@clinic/ui';
import { HOME_PATHS, type HomePath } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { saveHomePath } from './actions';
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
export function AppearanceSettings({ homePath = '/' }: { homePath?: HomePath }) {
  const t = useTranslations('account');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink-900">{t('homePath')}</span>
          <span className="block text-xs text-ink-600">{t('homePathHint')}</span>
        </span>
        <HomePathChoice value={homePath} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
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

/** Where the clinic name leads, written to the profile as soon as it is picked. */
function HomePathChoice({ value }: { value: HomePath }) {
  const t = useTranslations('account');
  const tNav = useTranslations('nav');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const labels: Record<HomePath, string> = {
    '/': tNav('dashboard'),
    '/calendar': tNav('calendar'),
    '/patients': tNav('patients'),
    '/tasks': tNav('tasks'),
    '/encounters': tNav('encounters'),
  };
  return (
    <Select
      aria-label={t('homePath')}
      value={value}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value as HomePath;
        startTransition(async () => {
          const result = await saveHomePath(next);
          if (!result.ok) {
            toast({ tone: 'danger', title: tc('errorGeneric') });
            return;
          }
          toast({ tone: 'success', title: t('homePathSaved') });
          router.refresh();
        });
      }}
    >
      {HOME_PATHS.map((path) => (
        <option key={path} value={path}>
          {labels[path]}
        </option>
      ))}
    </Select>
  );
}
