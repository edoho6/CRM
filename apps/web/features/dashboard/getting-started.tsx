'use client';

import { useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Check, Stethoscope, UserPlus, X } from 'lucide-react';
import { Button, Card, CardBody, cn } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { PREF_KEYS } from '@/lib/prefs';

const STORAGE_KEY = PREF_KEYS.gettingStartedHidden;

/**
 * The first thing a new clinic sees.
 *
 * Day one used to be a dashboard of zeros, an unshaded calendar and no
 * appointment types — every screen technically working and none of them
 * saying what to do first. Three steps, each a link, each ticked off as the
 * data appears. It is rendered only while the clinic has no patients, and
 * it can be hidden for good from this browser.
 */
export function GettingStarted({
  hasHours,
  hasTypes,
  hasPatients,
}: {
  hasHours: boolean;
  hasTypes: boolean;
  hasPatients: boolean;
}) {
  const t = useTranslations('dashboard.gettingStarted');
  // Shown by default, and hidden before paint when this browser has
  // dismissed it — the stylesheet hides it first, from the attribute the
  // pre-paint script wrote, so the card never appears and then vanishes.
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    setHidden(document.documentElement.dataset.gettingStarted === 'hidden');
  }, []);

  if (hidden || hasPatients) return null;

  const steps = [
    { key: 'hours', done: hasHours, href: '/account/schedule', icon: CalendarClock },
    { key: 'types', done: hasTypes, href: '/account', icon: Stethoscope },
    { key: 'patient', done: hasPatients, href: '/patients/new', icon: UserPlus },
  ] as const;

  return (
    <Card data-getting-started className="mb-5 border-jade-200 bg-jade-50/60">
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink-900">{t('title')}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={t('dismiss')}
            title={t('dismiss')}
            onClick={() => {
              setHidden(true);
              document.documentElement.dataset.gettingStarted = 'hidden';
              try {
                localStorage.setItem(STORAGE_KEY, '1');
              } catch {
                // Forgetting is the whole cost.
              }
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cn(
                  'flex h-full items-start gap-3 rounded-lg border bg-white p-3 transition-colors hover:border-jade-400',
                  step.done ? 'border-jade-300' : 'border-ink-200',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    step.done ? 'bg-jade-600 text-accent-fg' : 'bg-ink-100 text-ink-600',
                  )}
                  aria-hidden
                >
                  {step.done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-900">
                    {t(step.key)}
                    {step.done ? <span className="sr-only"> · {t('done')}</span> : null}
                  </span>
                  <span className="block text-xs text-ink-600">{t(`${step.key}Body`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
