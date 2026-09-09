import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** The treatments list's shape: the heading, the date filter, the table. */
export default async function EncountersLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" className="w-32" />
        <Skeleton className="w-40" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} shape="badge" className="w-20" />
        ))}
      </div>
      <SkeletonTable rows={10} columns={6} />
    </SkeletonPage>
  );
}
