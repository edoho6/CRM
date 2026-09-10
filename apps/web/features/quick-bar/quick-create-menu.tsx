'use client';

import { useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';

/**
 * The "+" available on every screen.
 *
 * A real menu, on the same primitive as every other menu in the app: it
 * opens on a click (never on the pointer passing over it), the arrow keys
 * move through it, Escape and a click outside close it, and focus goes back
 * to the button. The hand-rolled version announced itself as a menu to a
 * screen reader and then could not be driven like one.
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
  { key: 'newEncounter', href: '/encounters/new', icon: Stethoscope },
  { key: 'newInvoice', href: '/billing/new', icon: Receipt },
  { key: 'receiveStock', href: '/inventory/batches/receive', icon: PackagePlus, startsGroup: true },
  { key: 'newHerb', href: '/reference/herbs/new', icon: Sprout },
  { key: 'newFormula', href: '/reference/formulas/new', icon: FlaskConical },
];

export function QuickCreateMenu() {
  const t = useTranslations('quickBar');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('create')}
          title={t('create')}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg',
            'transition-all duration-150 ease-out',
            'hover:-translate-y-px hover:bg-accent hover:shadow-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            open && 'bg-accent shadow-md',
          )}
        >
          <Plus className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-45')} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-xl p-1.5">
        {QUICK_ACTIONS.map((action) => (
          <div key={action.key}>
            {action.startsGroup ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => router.push(action.href)}>
              <action.icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
              {t(`actions.${action.key}`)}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
