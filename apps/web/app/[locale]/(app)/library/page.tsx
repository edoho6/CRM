import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { LibraryChat } from '@/features/library/library-chat';
import { LibraryNav } from '@/features/library/library-nav';
import { isLibraryConfigured } from '@/features/library/voyage';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('library', 'title');

/**
 * Questions to the professional library. The page says what the library
 * is before the first question: what it answers from, where a question
 * goes, and what must not be typed into it.
 */
export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('library');

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<LibraryNav current="chat" />} />
      <PageBody width="narrow">
        <div className="space-y-4">
          <Alert tone="info" title={t('privacyTitle')}>
            {t('privacyBody')}
          </Alert>
          <LibraryChat configured={isLibraryConfigured()} examples={[t('examples.a'), t('examples.b'), t('examples.c')]} />
        </div>
      </PageBody>
    </>
  );
}
