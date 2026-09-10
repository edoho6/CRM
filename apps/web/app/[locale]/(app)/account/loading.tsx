import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage } from '@clinic/ui';

/** The personal area: heading, the settings strip, then six folded panels. */
export default async function AccountLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" className="w-32" />
        <Skeleton className="w-64" />
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <div className="max-w-5xl space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} shape="block" className="h-12 rounded-card" />
        ))}
      </div>
    </SkeletonPage>
  );
}
