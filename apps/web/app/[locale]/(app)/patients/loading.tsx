import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** The patient list's shape: the numbers, the search, the table. */
export default async function PatientsLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton shape="heading" className="w-32" />
          <Skeleton className="w-24" />
        </div>
        <Skeleton shape="button" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <SkeletonTable rows={8} columns={6} />
    </SkeletonPage>
  );
}
