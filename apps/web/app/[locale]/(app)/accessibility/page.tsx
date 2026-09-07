import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Accessibility, AlertTriangle, Check } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';

/**
 * The accessibility statement.
 *
 * Required of a service in Israel under standard 5568, and useful regardless:
 * it says what has been done, what has not, and who to contact when something
 * blocks you. The list of known gaps is the part that matters — a statement
 * that claims full conformance and is wrong is worse than one that names its
 * own limits.
 *
 * The clinic's own contact details are filled in from the settings screen. The
 * placeholders below are visible on purpose: a statement with an unfilled
 * contact is not a statement, and it should look unfinished until it is.
 */
export const dynamic = 'force-static';

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('accessibility');
  const format = await getFormatter();

  const done = [
    'keyboard',
    'contrast',
    'landmarks',
    'labels',
    'rtl',
    'zoom',
    'motion',
    'automated',
  ] as const;
  const gaps = ['screenReaderAudit', 'automatedScope', 'bodyMap', 'calendar', 'pdf'] as const;

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      <div className="max-w-3xl space-y-5">
        <Card>
          <CardBody>
            <p className="text-sm leading-relaxed text-ink-800">{t('intro')}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-800">{t('standard')}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Accessibility className="me-1.5 inline h-4 w-4" aria-hidden />
              {t('doneTitle')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {done.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm text-ink-800">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-jade-700" aria-hidden />
                  <span>{t(`done.${key}`)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <AlertTriangle className="me-1.5 inline h-4 w-4" aria-hidden />
              {t('gapsTitle')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-ink-700">{t('gapsIntro')}</p>
            <ul className="space-y-2">
              {gaps.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm text-ink-800">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span>{t(`gaps.${key}`)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('contactTitle')}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-relaxed text-ink-800">{t('contactBody')}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="text-ink-600">{t('contactName')}</dt>
                <dd className="font-medium text-amber-800">{t('placeholder')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-600">{t('contactEmail')}</dt>
                <dd className="font-medium text-amber-800">{t('placeholder')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-600">{t('contactPhone')}</dt>
                <dd className="font-medium text-amber-800">{t('placeholder')}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {t('placeholderWarning')}
            </p>
          </CardBody>
        </Card>

        <p className="text-xs text-ink-600">
          {t('updated', { date: format.dateTime(new Date('2026-09-07'), 'short') })}
        </p>
      </div>
    </>
  );
}
