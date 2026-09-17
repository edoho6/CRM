'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, Spinner, cn, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';

/**
 * Which clinic this person is working in, for the few who work in more than one
 * (migration 76).
 *
 * Shown only to them: with one membership there is nothing to choose, and a
 * control that always says the same thing is furniture. The choice is the
 * person's, not the browser's — every policy in the database reads it — so it is
 * saved there and the page is refreshed, and what comes back is the new clinic's.
 */
export function ClinicSwitcher({
  clinics,
  currentId,
  onSwitch,
  collapsed = false,
}: {
  clinics: { id: string; name: string }[];
  currentId: string;
  onSwitch: (clinicId: string) => Promise<void>;
  collapsed?: boolean;
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (clinics.length < 2) return null;

  return (
    <Popover
      width={240}
      align="start"
      panelLabel={t('switchClinic')}
      triggerLabel={t('switchClinic')}
      triggerTitle={t('switchClinic')}
      triggerClassName={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800',
        collapsed && 'mx-auto',
      )}
      triggerContent={isPending ? <Spinner /> : <ChevronsUpDown className="h-4 w-4" aria-hidden />}
    >
      {({ close }) => (
        <ul className="py-1">
          {clinics.map((clinic) => {
            const current = clinic.id === currentId;
            return (
              <li key={clinic.id}>
                <button
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-800 hover:bg-ink-50"
                  onClick={() => {
                    close();
                    if (current) return;
                    startTransition(async () => {
                      try {
                        await onSwitch(clinic.id);
                      } catch {
                        toast({ tone: 'danger', title: tc('errorGeneric') });
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  <Check
                    className={cn('h-4 w-4 shrink-0', current ? 'text-jade-700' : 'invisible')}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate" dir="auto">
                    {clinic.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}
