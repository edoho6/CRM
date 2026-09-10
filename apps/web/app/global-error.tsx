'use client';

import { useEffect } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import './globals.css';

/**
 * The last resort: shown when the root layout itself fails.
 *
 * Nothing above it survives — no message catalogue, no theme script, no font
 * — so it carries its own `<html>` and `<body>`, says the one thing it has to
 * say in both languages, and applies the remembered theme by hand so that
 * someone in dark mode is not blinded on the worst screen of their day.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const dark =
        stored === 'dark' ||
        (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } catch {
      // Site data blocked: the light theme, which is the default anyway.
    }
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh bg-ink-50 antialiased">
        <main className="grid min-h-dvh place-items-center px-6 py-12">
          <div className="w-full max-w-md rounded-card border border-red-200 bg-white p-6 text-center">
            <h1 className="text-xl font-semibold text-ink-900">משהו השתבש</h1>
            <p className="mt-1 text-sm text-ink-600">אפשר לנסות שוב. אם זה חוזר, לרענן את הדף.</p>
            <p className="mt-3 text-sm text-ink-500" lang="en" dir="ltr">
              Something went wrong. Try again, or reload the page.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              ניסיון נוסף · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
