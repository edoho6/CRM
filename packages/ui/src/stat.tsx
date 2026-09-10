import * as React from 'react';
import { cn } from './cn';

/**
 * One number and what it is.
 *
 * The dashboard, the patient list's tiles and the reports each drew their own
 * big figure, three ways. This is the one way: the value large and tabular,
 * the label small under it, an optional delta or note beside it, and a tone
 * for the value only — never colour alone, the label always says what it is.
 */
export function Stat({
  value,
  label,
  note,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  /** A change, a comparison, a hint — quieter, beside the value. */
  note?: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'warning' | 'danger';
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            'font-semibold tabular-nums leading-none',
            size === 'lg' ? 'text-3xl' : 'text-2xl',
            tone === 'neutral' && 'text-ink-900',
            tone === 'accent' && 'text-jade-800',
            tone === 'warning' && 'text-amber-800',
            tone === 'danger' && 'text-red-700',
          )}
        >
          {value}
        </span>
        {note ? <span className="text-xs text-ink-600">{note}</span> : null}
      </span>
      <span className="text-xs text-ink-600">{label}</span>
    </div>
  );
}
