'use client';

import { useTranslations } from 'next-intl';
import {
  CalendarPlus,
  FlaskConical,
  PackagePlus,
  Plus,
  Sprout,
  Stethoscope,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';

/**
 * The "+" available on every screen.
 *
 * Actions are a plain list rather than hard-coded markup, so adding one later is
 * a single entry here — the same idea as the dashboard widget registry. Anything
 * that needs a patient chosen first (a treatment, for instance) routes to the
 * screen that asks for one rather than opening a half-empty form.
 */
interface QuickAction {
  key: string;
  href: string;
  icon: LucideIcon;
  /** Separator drawn above this item, to group unrelated actions. */
  startsGroup?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'newPatient', href: '/patients/new', icon: UserPlus },
  { key: 'newAppointment', href: '/calendar?new=1', icon: CalendarPlus },
  { key: 'newEncounter', href: '/patients', icon: Stethoscope },
  { key: 'receiveStock', href: '/inventory/batches/receive', icon: PackagePlus, startsGroup: true },
  { key: 'newHerb', href: '/inventory/herbs/new', icon: Sprout },
  { key: 'newFormula', href: '/inventory/formulas/new', icon: FlaskConical },
];

export function QuickCreateMenu() {
  const t = useTranslations('quickBar');
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" aria-label={t('create')} title={t('create')}>
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {QUICK_ACTIONS.map((action) => (
          <div key={action.key}>
            {action.startsGroup ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => router.push(action.href)}>
              <action.icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
              {t(`actions.${action.key}`)}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
