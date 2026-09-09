import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage, SkeletonTable } from '@clinic/ui';

/** Billing's shape: the heading with its action, then the invoice table. */
export default async function BillingLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton shape="heading" className="w-28" />
          <Skeleton className="w-48" />
        </div>
        <Skeleton shape="button" />
      </div>
      <SkeletonTable rows={8} columns={6} />
    </SkeletonPage>
  );
}
