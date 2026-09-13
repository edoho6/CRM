import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Images } from 'lucide-react';
import { EmptyState, PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { ExternalLink } from '@/components/external-link';
import { Link } from '@clinic/i18n/navigation';
import { getClinicScope } from '@/lib/session';
import { medicineImageCredits } from '@/features/medicine/images';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('medicine.credits', 'title');

/**
 * Where the reference's pictures come from, one line each: the file on
 * Commons, who made it, under which licence. CC BY asks that the credit be
 * shown; every entry shows it under its picture, and this page shows them
 * all together.
 */
export default async function MedicineCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('medicine.credits');
  const tm = await getTranslations('medicine');
  const tc = await getTranslations('common');

  const credits = medicineImageCredits();
  // The entries' names, in one read: the manifest knows only the Wikidata ids.
  const names = new Map<string, { slug: string; name: string }>();
  for (let i = 0; i < credits.length; i += 500) {
    const { data } = await scope.supabase
      .from('med_entries')
      .select('wikidata_id, slug, name_he, name_en')
      .in(
        'wikidata_id',
        credits.slice(i, i + 500).map((c) => c.qid),
      );
    for (const row of data ?? []) names.set(row.wikidata_id, { slug: row.slug, name: row.name_he ?? row.name_en });
  }

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} actions={<ReferenceNav compact />} />
      <PageBody width="narrow">
        {credits.length === 0 ? (
          <EmptyState icon={<Images className="h-8 w-8" />} title={t('none')} />
        ) : (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
            {credits.map(({ qid, image }) => {
              const entry = names.get(qid);
              return (
                <li key={qid} className="flex items-start gap-3 p-3">
                  <img src={image.src} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border border-ink-200 object-cover" />
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="font-medium text-ink-900">
                      {entry ? (
                        <Link href={`/reference/medicine/${entry.slug}`} className="underline-offset-2 hover:underline">
                          {entry.name}
                        </Link>
                      ) : (
                        <span dir="ltr">{qid}</span>
                      )}
                    </p>
                    <p className="text-ink-700" dir="ltr">
                      {image.title}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
                      {image.author ? <span dir="auto">{image.author}</span> : null}
                      <span>{tm('sources.licence', { licence: image.licence })}</span>
                      <ExternalLink href={image.page} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
                        {t('open')}
                      </ExternalLink>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}
