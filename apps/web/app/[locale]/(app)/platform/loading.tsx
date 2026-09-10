import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** The clinics overview: heading with a count, then one table. */
export default async function PlatformLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="space-y-2">
        <Skeleton shape="heading" className="w-40" />
        <Skeleton className="w-32" />
      </div>
      <SkeletonTable rows={8} columns={5} />
    </SkeletonPage>
  );
}
