import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonCard, SkeletonPage } from '@clinic/ui';

/** A treatment's shape: the record on the wide side, the side column beside it. */
export default async function EncounterLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton shape="heading" className="w-64" />
          <Skeleton className="w-48" />
        </div>
        <Skeleton shape="button" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <Skeleton shape="block" className="h-44" />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </SkeletonPage>
  );
}
