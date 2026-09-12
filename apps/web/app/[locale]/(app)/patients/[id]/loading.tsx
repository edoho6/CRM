import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/** A patient file's shape: the name, the tab strip, the cards. */
export default async function PatientLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      {/* Wraps and caps itself: at 200% text on a phone the fixed widths of
          a name and two buttons in one row scrolled the page sideways. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton shape="heading" className="w-56 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton shape="badge" />
            <Skeleton className="w-16" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton shape="button" />
          <Skeleton shape="button" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden border-b border-ink-200 pb-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-20 shrink-0 rounded-md" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </SkeletonPage>
  );
}
