import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FileText } from 'lucide-react';
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState } from '@clinic/ui';
import { CONSENT_KINDS } from '@clinic/domain';
import type { ConsentDocument } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { ConsentDocumentForm } from '@/features/consent/consent-document-form';
import { formatDate } from '@clinic/i18n';

/**
 * The consent texts the clinic asks patients to accept.
 *
 * Publishing is one-way: the version number is allocated by the database and
 * the text is then frozen by a trigger. Correcting a published document means
 * publishing the next version, which is what lets a consent record from two
 * years ago still say exactly what was agreed.
 */
export default async function ConsentDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('consent');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('consent_documents')
    .select('*')
    .order('kind', { ascending: true })
    .order('version', { ascending: false })
    .returns<ConsentDocument[]>();

  const documents = data ?? [];

  return (
    <>
      <PageHeader title={t('documentsTitle')} description={t('documentsSubtitle')} />
      <SettingsNav />

      <div className="max-w-3xl space-y-5">
        <Alert tone="info">{t('immutableNote')}</Alert>

        {CONSENT_KINDS.map((kind) => {
          const versions = documents.filter((doc) => doc.kind === kind);
          const current = versions.find((doc) => doc.published_at !== null);
          return (
            <Card key={kind}>
              <CardHeader>
                <CardTitle>{t(`kinds.${kind}`)}</CardTitle>
                {current ? (
                  <Badge tone="success">{t('version', { version: current.version })}</Badge>
                ) : (
                  <Badge tone="warning">{t('notPublished')}</Badge>
                )}
              </CardHeader>
              <CardBody className="space-y-4">
                {versions.length === 0 ? (
                  <EmptyState icon={<FileText className="h-8 w-8" />} title={t('noVersions')} />
                ) : (
                  <ul className="divide-y divide-ink-100 text-sm">
                    {versions.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2"
                      >
                        <Badge tone="neutral">{t('version', { version: doc.version })}</Badge>
                        <span className="font-medium text-ink-900">{doc.title}</span>
                        <span className="text-xs text-ink-600">{doc.locale.toUpperCase()}</span>
                        {doc.published_at ? (
                          <span dir="ltr" className="text-xs tabular-nums text-ink-600">
                            {formatDate(new Date(doc.published_at))}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                <ConsentDocumentForm kind={kind} locale={locale} />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
