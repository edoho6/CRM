import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/** The message queue's shape: heading, then the waiting list and the history. */
export default async function MessagesLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" className="w-28" />
        <Skeleton className="w-72" />
      </div>
      <div className="max-w-3xl space-y-4">
        <SkeletonCard lines={4} header />
        <SkeletonCard lines={5} header />
      </div>
    </SkeletonPage>
  );
}
