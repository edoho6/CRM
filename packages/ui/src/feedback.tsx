import * as React from 'react';
import { cn } from './cn';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-ink-100 text-ink-700',
        tone === 'muted' && 'bg-ink-50 text-ink-600',
        tone === 'success' && 'bg-jade-100 text-jade-800',
        tone === 'warning' && 'bg-amber-100 text-amber-800',
        tone === 'danger' && 'bg-red-100 text-red-700',
        tone === 'info' && 'bg-sky-100 text-sky-800',
        className,
      )}
      {...props}
    />
  );
}

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

/**
 * One palette for every message, inline or floating. A "saved" toast is the
 * same green as a "saved" banner because it is the same news.
 */
export const ALERT_TONE_CLASSES: Record<AlertTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-jade-200 bg-jade-50 text-jade-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      // A danger message interrupts; everything else is announced when the
      // reader next pauses. Both are announced — colour alone is not a message.
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      className={cn('rounded-lg border px-3 py-2 text-sm', ALERT_TONE_CLASSES[tone], className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-ink-200 bg-white px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? <div className="text-ink-300">{icon}</div> : null}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}

/** Key/value row used across detail panels. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 py-1.5', className)}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-900">{children}</dd>
    </div>
  );
}

/**
 * "No value", as one mark everywhere.
 *
 * A dash, quiet, and the same dash in every table: it used to be drawn three
 * ways across the app. Zero is a measurement and gets written as 0; this is
 * for the absence of one. Hidden from screen readers unless a label is given,
 * so a column of dashes is not read as a column of "em dash".
 */
export function Dash({ label, className }: { label?: string; className?: string }) {
  return (
    <span
      data-dash
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn('text-ink-400', className)}
    >
      —
    </span>
  );
}
