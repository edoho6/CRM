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
  showLabel = false,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The accessible name — e.g. "Sunday". */
  label: string;
  /**
   * Also print the label beside the switch. Off where the row already says
   * what the switch is for (a day name, a room); on where the switch stands
   * alone — an unlabelled switch in a form is a guess.
   */
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-8 w-13 shrink-0 items-center rounded-full transition-colors duration-(--duration-base)',
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
          // `bg-accent-fg`, not `bg-white`: the knob must stay white in the
          // dark theme, where `--color-white` is the card surface.
          'absolute left-0.5 h-7 w-7 rounded-full bg-accent-fg shadow-sm transition-transform duration-(--duration-spring) ease-(--ease-spring)',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );

  if (!showLabel) return control;
  return (
    <span className={cn('inline-flex items-center gap-2', disabled && 'opacity-50')}>
      {control}
      {/* Hidden from assistive tech: the button already carries the name. */}
      <span
        aria-hidden
        onClick={() => !disabled && onChange(!checked)}
        className="cursor-pointer text-sm text-ink-800 select-none"
      >
        {label}
      </span>
    </span>
  );
}
