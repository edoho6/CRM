'use client';

import { useTranslations } from 'next-intl';
import { CalendarOff, CalendarPlus, Plus } from 'lucide-react';
import { Popover, cn } from '@clinic/ui';

/**
 * The "+" beside a day: book someone, or close the day.
 *
 * Two verbs and no more. Both are decisions made while looking at a day —
 * "put her in on Thursday", "Thursday is off" — and both belong on Thursday
 * rather than on a toolbar or a settings page.
 */
export function DayAddMenu({
  onNew,
  onBlock,
  blocked,
  className,
}: {
  onNew: () => void;
  onBlock: () => void;
  /** The day is already closed; the second verb becomes "change the closure". */
  blocked?: boolean;
  className?: string;
}) {
  const t = useTranslations('appointments');
  return (
    <Popover
      triggerContent={<Plus className="h-3.5 w-3.5" aria-hidden />}
      triggerLabel={t('addOn')}
      triggerTitle={t('addOn')}
      triggerClassName={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      panelLabel={t('addOn')}
      width={220}
    >
      {({ close }) => (
        <div className="flex flex-col p-1">
          <button
            type="button"
            onClick={() => {
              close();
              onNew();
            }}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm text-ink-800 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          >
            <CalendarPlus className="h-4 w-4 text-ink-500" aria-hidden />
            {t('new')}
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              onBlock();
            }}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm text-ink-800 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          >
            <CalendarOff className="h-4 w-4 text-ink-500" aria-hidden />
            {blocked ? t('block.reopen') : t('blockDay')}
          </button>
        </div>
      )}
    </Popover>
  );
}
