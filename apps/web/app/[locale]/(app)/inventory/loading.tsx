import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** The stock room's shape: the heading, the section tabs, the table. */
export default async function InventoryLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton shape="heading" className="w-36" />
          <Skeleton className="w-56" />
        </div>
        <Skeleton shape="button" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <SkeletonTable rows={10} columns={5} />
    </SkeletonPage>
  );
}
