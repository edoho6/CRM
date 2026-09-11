import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Images } from 'lucide-react';
import { Badge, Button, EmptyState, PageBody } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { PageHeader } from '@/components/app-shell';
import { ExternalLink } from '@/components/external-link';
import { getClinicScope } from '@/lib/session';
import { shopImageCredits } from '@/features/prices/shop-image';

/**
 * Where the comparison's pictures come from, one line each.
 *
 * CC BY asks that the credit be shown; this is where it is shown in full,
 * linked from every picture in the list. The shops' own photographs are not
 * here because they are not used.
 */
export default async function PriceCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;

  const t = await getTranslations('prices.credits');
  const tPrices = await getTranslations('prices');
  const tc = await getTranslations('common');
  const credits = shopImageCredits();

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild variant="secondary">
            <Link href="/prices">{t('backToList')}</Link>
          </Button>
        }
      />
      <PageBody width="narrow">
        {credits.length === 0 ? (
          <EmptyState icon={<Images className="h-8 w-8" />} title={t('none')} />
        ) : (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
            {credits.map(({ key, image }) => (
              <li key={`${image.scope}:${key}`} className="flex items-start gap-3 p-3">
                <img
                  src={image.src}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg border border-ink-200 object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="muted">{image.scope === 'category' ? t('category') : t('product')}</Badge>
                    <span className="font-medium text-ink-900">
                      {image.scope === 'category' ? tPrices(`categories.${key}` as never) : key}
                    </span>
                  </p>
                  <p className="text-ink-700" dir="ltr">
                    {image.title}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
                    <span>{image.author}</span>
                    <span aria-hidden>·</span>
                    <span>{image.source}</span>
                    <span aria-hidden>·</span>
                    <ExternalLink href={image.licenceUrl} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
                      {image.licence}
                    </ExternalLink>
                    {image.page ? (
                      <>
                        <span aria-hidden>·</span>
                        <ExternalLink href={image.page} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
                          {t('sourcePage')}
                        </ExternalLink>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
