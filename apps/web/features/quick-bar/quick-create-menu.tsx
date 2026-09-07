'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarPlus,
  FlaskConical,
  PackagePlus,
  Plus,
  Receipt,
  Sprout,
  Stethoscope,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';

/**
 * The "+" available on every screen.
 *
 * It opens on hover rather than on click, so reaching an action costs one
 * movement instead of a click plus a movement. Focus and keyboard still open it,
 * and a short close delay means crossing the small gap to the menu does not
 * dismiss what you were reaching for.
 *
 * Actions are data, not markup: adding one later is a single entry below.
 */
interface QuickAction {
  key: string;
  href: string;
  icon: LucideIcon;
  startsGroup?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'newPatient', href: '/patients/new', icon: UserPlus },
  { key: 'newAppointment', href: '/calendar?new=1', icon: CalendarPlus },
  { key: 'newEncounter', href: '/patients', icon: Stethoscope },
  { key: 'newInvoice', href: '/billing', icon: Receipt },
  { key: 'receiveStock', href: '/inventory/batches/receive', icon: PackagePlus, startsGroup: true },
  { key: 'newHerb', href: '/reference/herbs/new', icon: Sprout },
  { key: 'newFormula', href: '/reference/formulas/new', icon: FlaskConical },
];

const CLOSE_DELAY_MS = 180;

export function QuickCreateMenu() {
  const t = useTranslations('quickBar');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  useEffect(() => cancelClose, []);

  // Escape closes, matching what a keyboard user expects from any open menu.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-label={t('create')}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('create')}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg',
          'transition-all duration-150 ease-out',
          'hover:-translate-y-px hover:bg-accent hover:shadow-md',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-600',
          open && 'bg-accent shadow-md',
        )}
      >
        <Plus className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-45')} />
      </button>

      {open ? (
        <div
          role="menu"
          // Hangs from the trailing edge, which is the left in Hebrew and the
          // right in English — a logical offset gets that for free.
          className="absolute top-full z-50 mt-1.5 min-w-56 rounded-xl border border-ink-200 bg-white p-1.5 shadow-lg"
          style={{ insetInlineEnd: 0 }}
        >
          {QUICK_ACTIONS.map((action) => (
            <div key={action.key}>
              {action.startsGroup ? <div className="my-1.5 h-px bg-ink-100" /> : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push(action.href);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-ink-800',
                  'transition-colors hover:bg-jade-50 hover:text-jade-900',
                  'focus-visible:bg-jade-50 focus-visible:outline-none',
                )}
              >
                <action.icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                {t(`actions.${action.key}`)}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
