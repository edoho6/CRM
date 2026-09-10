import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/** The task board's shape: heading, then a narrow column of grouped cards. */
export default async function TasksLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" className="w-28" />
        <Skeleton className="w-64" />
      </div>
      <div className="max-w-3xl space-y-4">
        <SkeletonCard lines={3} header />
        <SkeletonCard lines={4} header />
        <SkeletonCard lines={2} header />
      </div>
    </SkeletonPage>
  );
}
