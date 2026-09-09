import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/** The reports' shape: the period filter, two wide cards, three narrow ones. */
export default async function ReportsLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" className="w-24" />
        <Skeleton className="w-56" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} shape="badge" className="w-16" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </SkeletonPage>
  );
}
