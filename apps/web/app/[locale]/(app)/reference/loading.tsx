import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** A catalogue's shape: the heading, the section tabs, the search, the table. */
export default async function ReferenceLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton shape="heading" className="w-40" />
          <Skeleton className="w-56" />
        </div>
        <Skeleton shape="button" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <SkeletonTable rows={12} columns={5} />
    </SkeletonPage>
  );
}
