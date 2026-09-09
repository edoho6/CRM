import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/**
 * What every screen shows while it is on its way, unless it has a skeleton
 * of its own shape closer to it.
 *
 * Present for two reasons. The first is felt: a click does something at once,
 * instead of the old page sitting there until the new one arrives. The
 * second is structural: the router only prefetches a dynamic route as far as
 * its nearest loading boundary, so without one nothing is prefetched at all.
 */
export default async function AppLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" />
        <Skeleton className="w-64" />
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
    </SkeletonPage>
  );
}
