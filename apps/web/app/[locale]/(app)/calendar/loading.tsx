import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonPage } from '@clinic/ui';

/** The diary's shape: the toolbar, then a week of columns over a time gutter. */
export default async function CalendarLoading() {
  const t = await getTranslations('common');
  return (
    <SkeletonPage label={t('loading')}>
      <Skeleton shape="heading" className="w-24" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Skeleton shape="button" className="w-9" />
          <Skeleton shape="button" className="w-9" />
          <Skeleton shape="heading" className="w-40" />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} shape="button" className="w-16" />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-ink-200 bg-white">
        <div
          className="grid border-b border-ink-200"
          style={{ gridTemplateColumns: '4rem repeat(7, minmax(0, 1fr))' }}
        >
          <div />
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-1 px-2 py-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: '4rem repeat(7, minmax(0, 1fr))' }}>
          <div className="space-y-10 py-3 pe-2 text-end">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="ms-auto h-3 w-8" />
            ))}
          </div>
          {Array.from({ length: 7 }, (_, column) => (
            <div key={column} className="h-[28rem] border-s border-ink-100 p-1">
              {column % 2 === 0 ? (
                <Skeleton shape="block" className="mt-16 h-14" />
              ) : (
                <Skeleton shape="block" className="mt-32 h-20" />
              )}
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
