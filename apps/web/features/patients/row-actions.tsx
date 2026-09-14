'use client';

import { useTranslations } from 'next-intl';
import { CalendarPlus, FolderOpen, MoreHorizontal, Phone } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';

/**
 * The few things done to a patient straight from the list — open the file,
 * book a visit, or call — without opening the file first. A real menu on the
 * same primitive as every other menu: click to open, arrows to move, Escape
 * to close, focus back to the button.
 *
 * "Call" is a `tel:` link, which does nothing useful on a desktop and
 * everything on the phone this list is most often read on; it appears only
 * when there is a number to call.
 */
export function PatientRowActions({ patientId, name, phone }: { patientId: string; name: string; phone: string | null }) {
  const t = useTranslations('patients');
  const router = useRouter();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('rowMenu.label', { name })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(`/patients/${patientId}`)}>
          <FolderOpen className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
          {t('rowMenu.open')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/calendar?new=1&patient=${patientId}`)}>
          <CalendarPlus className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
          {t('rowMenu.newAppointment')}
        </DropdownMenuItem>
        {phone ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { window.location.href = `tel:${phone}`; }}>
              <Phone className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
              {t('rowMenu.call')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
