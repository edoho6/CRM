'use client';

import * as React from 'react';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * One choice out of a few, shown as a row of segments.
 *
 * Day / week / month; formula / herb; tiles / row / bar. These were four
 * separate hand-made groups of buttons with four slightly different looks;
 * this is the one shape they share, so a switch reads as a switch wherever
 * it is. Every segment is a real button with `aria-pressed`, the group
 * carries its name, and the chosen segment is told apart by weight and
 * background — never colour alone.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  iconOnly = false,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The group's accessible name. */
  label: string;
  size?: 'sm' | 'md';
  /** Icons only, with the label as the accessible name and the title. */
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm',
              iconOnly && (size === 'sm' ? 'w-7 px-0' : 'w-9 px-0'),
              selected ? 'bg-accent text-accent-fg' : 'text-ink-600 hover:bg-ink-50',
              focusRing,
            )}
          >
            {option.icon}
            {iconOnly ? <span className="sr-only">{option.label}</span> : option.label}
          </button>
        );
      })}
    </div>
  );
}
