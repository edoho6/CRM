'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@clinic/ui';
import { THEME_STORAGE_KEY, type ThemeChoice } from '@/lib/theme';

/**
 * Light / dark / follow-the-system, as a three-position switch.
 *
 * Three rather than two because a plain on-off toggle has to pick a starting
 * side, and whichever it picks is wrong for half the people using it. "Follow
 * the system" is the honest default and is worth being able to return to — once
 * a binary toggle is touched there is usually no way back to it.
 *
 * The choice lives in localStorage rather than in the database: it belongs to
 * this browser, not to the practitioner's account. Reading it back is wrapped in
 * try/catch because a browser set to block site data throws on access rather
 * than returning null, and a theme preference is not worth a blank screen.
 */

function apply(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const OPTIONS: { value: ThemeChoice; icon: typeof Sun; labelKey: 'light' | 'dark' | 'system' }[] = [
  { value: 'light', icon: Sun, labelKey: 'light' },
  { value: 'dark', icon: Moon, labelKey: 'dark' },
  { value: 'system', icon: Monitor, labelKey: 'system' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  // 'system' until the stored value is read. The script in the head has already
  // painted the right colours; this is only the switch catching up with it.
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Site data blocked. The script in the head already fell back to light.
    }
    if (stored === 'light' || stored === 'dark') setChoice(stored);
  }, []);

  // While following the system, a change to the OS setting has to be picked up
  // live — otherwise the app is dark at dusk only after a reload.
  useEffect(() => {
    if (choice !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    setChoice(next);
    apply(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The theme still applies for this page; it just will not be remembered.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(option.labelKey)}
            onClick={() => select(option.value)}
            className={cn(
              'inline-flex h-7 flex-1 items-center justify-center rounded-md px-2 transition-colors',
              active ? 'bg-accent text-accent-fg' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
            )}
          >
            <option.icon className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
