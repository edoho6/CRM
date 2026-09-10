import { LtrInput } from '@clinic/ui';

/**
 * A native date field, the way every date field in the app should look.
 *
 * Two screens had hand-copied the whole class string for this control at two
 * different heights. A date reads left to right even in Hebrew, and the
 * native picker lays its fields out that way regardless — `LtrInput` already
 * knows both of those things, and the 24-hour locale besides.
 */
export function DateInput({
  compact = true,
  className,
  ...props
}: Omit<React.ComponentProps<typeof LtrInput>, 'type'> & { compact?: boolean }) {
  return (
    <LtrInput
      type="date"
      compact={compact}
      className={['w-auto tabular-nums', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}
