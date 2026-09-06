import Link from 'next/link';
import { defaultLocale, getDirection } from '@clinic/i18n';
import './globals.css';

export default function GlobalNotFound() {
  return (
    <html lang={defaultLocale} dir={getDirection(defaultLocale)}>
      <body className="grid min-h-dvh place-items-center bg-ink-50 p-6">
        <div className="text-center">
          <p className="text-5xl font-semibold text-ink-300">404</p>
          <p className="mt-2 text-sm text-ink-600">הדף לא נמצא · Page not found</p>
          <Link
            href={`/${defaultLocale}`}
            className="mt-4 inline-block text-sm font-medium text-jade-700 underline-offset-4 hover:underline"
          >
            חזרה · Back
          </Link>
        </div>
      </body>
    </html>
  );
}
