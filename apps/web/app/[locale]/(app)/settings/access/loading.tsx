import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** The access log: heading, the settings strip, the anomalies card, filters, table. */
export default async function AccessLoading() {
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
      <SkeletonCard lines={3} header />
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      <SkeletonTable rows={10} columns={5} />
    </SkeletonPage>
  );
}
