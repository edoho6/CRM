import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { MedicineBody, MedicineKindIcon } from '@/features/medicine/medicine-body';
import { loadMedicineEntry, loadMedicineLinks } from '@/features/medicine/queries';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('medicine', 'single');

/**
 * One entry of the Western medicine reference, addressed by its slug — a
 * name, not an id, so the address can be read and shared. The body is the
 * same component the card over a treatment record shows.
 */
export default async function MedicineEntryPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const scope = await getClinicScope();
  if (!scope) return null;

  const entry = await loadMedicineEntry(scope.supabase, { slug: slug.toLowerCase() });
  if (!entry) notFound();
  const links = await loadMedicineLinks(scope.supabase, entry.id);
  const t = await getTranslations('medicine');

  const name = entry.name_he ?? entry.name_en;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
              <MedicineKindIcon kind={entry.kind} className="h-5 w-5" />
              <span className="sr-only">{t(`kind.${entry.kind}`)}</span>
            </span>
            <span>{name}</span>
          </span>
        }
        description={
          <span className="block">
            <span className="text-ink-600">{t(`kind.${entry.kind}`)}</span>
            {entry.name_he ? (
              <>
                {' · '}
                <span dir="ltr">{entry.name_en}</span>
              </>
            ) : null}
          </span>
        }
        actions={<ReferenceNav compact />}
      />
      <PageBody width="narrow">
        <MedicineBody entry={entry} links={links} headingLevel="h2" />
      </PageBody>
    </>
  );
}
