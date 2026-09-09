'use client';

import { useTranslations } from 'next-intl';
import { Badge, cn } from '@clinic/ui';
import { confirmationState, type ConfirmationFields } from './confirmation';

/**
 * The one mark that says whether the patient is coming.
 *
 * Grey until a reminder goes out, amber while it is unanswered, green for
 * yes, red for no. Never colour alone: the dot carries the word in its title
 * and for a screen reader, and the badge form spells it out.
 */

const DOT_CLASSES = {
  none: 'border border-ink-300 bg-transparent',
  sent: 'bg-amber-500',
  confirmed: 'bg-jade-600',
  declined: 'bg-red-600',
} as const;

const BADGE_TONES = {
  none: 'muted',
  sent: 'warning',
  confirmed: 'success',
  declined: 'danger',
} as const;

export function ConfirmationDot({
  appointment,
  className,
}: {
  appointment: ConfirmationFields;
  className?: string;
}) {
  const t = useTranslations('appointments.confirmation');
  const state = confirmationState(appointment);
  return (
    <span
      role="img"
      aria-label={t(state)}
      title={t(state)}
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', DOT_CLASSES[state], className)}
    />
  );
}

export function ConfirmationBadge({ appointment }: { appointment: ConfirmationFields }) {
  const t = useTranslations('appointments.confirmation');
  const state = confirmationState(appointment);
  return (
    <Badge tone={BADGE_TONES[state]}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn('h-2 w-2 rounded-full', DOT_CLASSES[state])} />
        {t(state)}
      </span>
    </Badge>
  );
}
