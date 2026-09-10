'use client';

import * as React from 'react';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * One choice out of a few, shown as a row of segments.
 *
 * Day / week / month; formula / herb; tiles / row / bar; this month / all.
 * This is the one shape every such switch shares, whether its segments are
 * buttons (this component) or links to a URL (`SegmentedLinks` in the app,
 * built from the same classes). Every segment is a real button with
 * `aria-pressed`, the group carries its name, and the chosen segment is told
 * apart by weight and background — never colour alone.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** A small number beside the label — how many rows this segment holds. */
  count?: number;
}

export type SegmentedSize = 'sm' | 'md';

/** The group's frame. Shared with the link-based variant so the two match. */
export const segmentGroupClasses =
  'inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5';

/** One segment. Shared with the link-based variant so the two match. */
export function segmentClasses(selected: boolean, size: SegmentedSize, iconOnly = false) {
  return cn(
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[color,background-color,scale] duration-(--duration-fast) active:scale-[0.98]',
    size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-sm',
    iconOnly && (size === 'sm' ? 'w-8 px-0' : 'w-10 px-0'),
    selected ? 'bg-accent text-accent-fg' : 'text-ink-600 hover:bg-ink-50',
    focusRing,
  );
}

/** The count bubble inside a segment. */
export function SegmentCount({ value, selected }: { value: number; selected: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-xs tabular-nums',
        selected ? 'bg-accent-fg/20' : 'bg-ink-100 text-ink-600',
      )}
    >
      {value}
    </span>
  );
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
  size?: SegmentedSize;
  /** Icons only, with the label as the accessible name and the title. */
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn(segmentGroupClasses, className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={segmentClasses(selected, size, iconOnly)}
          >
            {option.icon}
            {iconOnly ? <span className="sr-only">{option.label}</span> : option.label}
            {option.count !== undefined ? (
              <SegmentCount value={option.count} selected={selected} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
