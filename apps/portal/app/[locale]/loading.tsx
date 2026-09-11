import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/**
 * What a portal screen shows while it is on its way: the shape of the page
 * that is coming, so a tap does something at once. Also what lets the router
 * prefetch these dynamic routes at all — it prefetches only as far as the
 * nearest loading boundary.
 */
export default async function PortalLoading() {
  const t = await getTranslations('common');
  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 sm:px-6 sm:pt-8">
      <SkeletonPage label={t('loading')}>
        <div className="space-y-2">
          <Skeleton shape="heading" />
          <Skeleton className="h-11 w-full" />
        </div>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </SkeletonPage>
    </div>
  );
}
