import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';
import { Link } from '@clinic/i18n/navigation';
import { PortalShell } from '../portal-shell';
import { DeleteAccountForm } from './delete-account-form';
import { PushSettings } from '@clinic/native';
import { registerPortalPushDevice } from './push-actions';

/**
 * The patient's account: the address they sign in with, the documents that
 * govern the service, and the way to delete the sign-in. The stores require
 * the last from inside the app; the page says plainly that the medical file
 * is the clinic's to keep, so nobody deletes an account expecting a file to
 * vanish with it.
 */
export const dynamic = 'force-dynamic';

const STAYS = ['file', 'invoices'] as const;

export default async function PortalAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('portal.account');
  const tLegal = await getTranslations('legal');
  const tc = await getTranslations('common');

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <Alert tone="warning">{tc('errorGeneric')}</Alert>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: locale as Locale });
    return null;
  }

  return (
    <PortalShell current="account" title={t('title')}>
      <Card>
        <CardHeader>
          <CardTitle>{t('signInTitle')}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-600">{tc('email')}</dt>
              <dd className="font-medium text-ink-900" dir="ltr">
                {user.email}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('documentsTitle')}</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-1.5 text-sm">
            <li>
              <Link href="/privacy" className="font-medium text-jade-700 underline-offset-4 hover:underline">
                {tLegal('privacy.title')}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="font-medium text-jade-700 underline-offset-4 hover:underline">
                {tLegal('terms.title')}
              </Link>
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('push.title')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed text-ink-700">{t('push.subtitle')}</p>
          <PushSettings
            locale={locale}
            register={registerPortalPushDevice}
            labels={{
              unsupported: t('push.unsupported'),
              prompt: t('push.prompt'),
              granted: t('push.granted'),
              denied: t('push.denied'),
              enable: t('push.enable'),
              enabling: t('push.enabling'),
              failed: t('push.failed'),
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('deletion.title')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-700">{t('deletion.body')}</p>
          <section aria-labelledby="portal-deletion-stays">
            <h3 id="portal-deletion-stays" className="text-sm font-semibold text-ink-900">
              {t('deletion.staysTitle')}
            </h3>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-ink-700">
              {STAYS.map((key) => (
                <li key={key}>{t(`deletion.stays.${key}`)}</li>
              ))}
            </ul>
          </section>
          <DeleteAccountForm locale={locale as Locale} />
        </CardBody>
      </Card>
    </PortalShell>
  );
}
