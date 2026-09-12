import { getTranslations, setRequestLocale } from 'next-intl/server';
import { missingSupabaseEnvVars } from '@clinic/db';
import { Alert, Card, CardBody } from '@clinic/ui';
import { Database, KeyRound, Terminal } from 'lucide-react';

/**
 * Shown whenever the app has no database credentials.
 *
 * The alternative — crashing on a missing environment variable — tells the person
 * setting this up nothing they can act on. This page names the exact variables that
 * are missing and the three steps that fill them.
 */
export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('setup');
  const missing = missingSupabaseEnvVars();

  const steps = [
    { icon: Database, title: t('step1Title'), body: t('step1Body') },
    { icon: Terminal, title: t('step2Title'), body: t('step2Body') },
    { icon: KeyRound, title: t('step3Title'), body: t('step3Body') },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <header>
        <h1 className="text-xl font-semibold text-ink-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-ink-600">{t('intro')}</p>
      </header>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card>
              <CardBody className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jade-100 text-jade-700">
                  <step.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-sm break-words text-ink-600">{step.body}</p>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>

      {missing.length > 0 ? (
        <Alert tone="warning" title={t('missingVars')}>
          <ul className="mt-1 space-y-0.5">
            {missing.map((name) => (
              // break-all: a variable name has no spaces to wrap at, and at 200%
              // text on a phone it was the one thing wider than the page.
              <li key={name} dir="ltr" className="break-all font-mono text-xs">
                {name}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <p className="text-xs text-ink-500">
        {t('restartNote')} {t('readmeLink')}
      </p>
    </main>
  );
}
