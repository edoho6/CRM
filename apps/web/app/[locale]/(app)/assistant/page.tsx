import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Sparkles } from 'lucide-react';
import { Alert, EmptyState } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { assistantAvailable } from '@/features/assistant/actions';
import { AssistantPanel } from '@/features/assistant/assistant-panel';

/**
 * Questions about the clinic's own numbers.
 *
 * Not a clinical tool and not a chat: a question, one of a fixed set of queries,
 * and the table it returned. The model chooses which query to run and reads the
 * result back in a sentence — it cannot compose a query of its own, so there is
 * nothing it can reach that is not in `features/assistant/queries.ts`.
 *
 * With no API key set the screen says so rather than offering a box that fails
 * on the first question.
 */
export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('assistant');

  const scope = await getClinicScope();
  if (!scope) return null;

  const available = await assistantAvailable();

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      {available ? (
        <div className="max-w-3xl space-y-4">
          {/* Said once, plainly, on the screen where it applies: asking a
              question sends the result of a query to an external service. The
              practitioner decided that; they should not have to remember it. */}
          <Alert tone="info" title={t('privacyTitle')}>
            {t('privacyBody')}
          </Alert>

          <AssistantPanel
            examples={[t('examples.busy'), t('examples.inactive'), t('examples.herbs'), t('examples.owed')]}
          />
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title={t('notConfigured')}
          description={t('notConfiguredBody')}
        />
      )}
    </>
  );
}
