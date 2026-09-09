'use client';

import * as React from 'react';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * An on/off switch.
 *
 * A real `<button role="switch">` rather than a styled checkbox: `aria-checked`
 * on a switch is announced as "on"/"off", which is what this means, where a
 * checkbox is announced as "checked" — and "working Sunday, checked" is a
 * sentence nobody says.
 *
 * The state is never carried by colour alone. The knob moves, and the control
 * carries a label that says which day it belongs to.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The accessible name — e.g. "Sunday". */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        focusRing,
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-ink-300',
        className,
      )}
    >
      {/* Physically left-to-right in both languages: a switch is a machine
          control, and the knob sliding right for "on" is the convention
          everywhere including in Hebrew interfaces. */}
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
