import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** The questionnaire list's shape: the heading with its action, then the table. */
export default async function FormsLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton shape="heading" className="w-32" />
          <Skeleton className="w-56" />
        </div>
        <Skeleton shape="button" />
      </div>
      <SkeletonTable rows={6} columns={4} />
    </SkeletonPage>
  );
}
