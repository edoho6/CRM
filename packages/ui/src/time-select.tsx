'use client';

import * as React from 'react';
import { cn } from './cn';
import { Select } from './field';

/**
 * A time, as two dropdowns.
 *
 * Not `<input type="time">`, and that is the whole point of the component.
 * Chrome takes that control's clock from the *browser's* UI locale and ignores
 * the element's `lang`, so a practitioner on an English Windows sees AM/PM no
 * matter what the page asks for — while every other time in the app is
 * 24-hour. Two selects of our own are the only way to be certain, and they are
 * faster to use anyway: setting nine o'clock is one click from a list, against
 * three keystrokes or a spinner in the native control.
 *
 * The value is `HH:MM`, which is what the database columns and the schemas
 * already speak, so nothing around it has to change.
 */

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

/**
 * Every minute.
 *
 * It was quarter hours, on the reasoning that a clinic books on the quarter.
 * That is true of appointments and not of opening hours: a practice that starts
 * at ten past nine could not say so, and the setting is entered once and lived
 * with. Sixty options in a list that is only opened to change something is not a
 * cost worth optimising.
 */
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

/*
 * Wide enough for two digits.
 *
 * `Select` reserves `pe-9` on the inline-end for the dropdown arrow. At the
 * width this had before, that left about a quarter of an inch for the number and
 * the selected hour was invisible — the control looked empty. The width has to
 * clear the padding on both sides before it holds any text at all.
 */
// The two lists share the group's width instead of each owning 5.5rem: at
// 200% text two fixed lists were wider than a phone. The group is 12rem when
// there is room, the container's width when there is not.
const SELECT_WIDTH = 'min-w-0 flex-1';

function split(value: string): { hour: string; minute: string } {
  const [hour = '09', minute = '00'] = value.split(':');
  return { hour: hour.padStart(2, '0'), minute: minute.padStart(2, '0') };
}

export function TimeSelect({
  value,
  onChange,
  disabled,
  label,
  hourLabel,
  minuteLabel,
  className,
  allowEmpty = false,
  emptyLabel = '—',
}: {
  /** `HH:MM`, or `''` for no time when `allowEmpty` is set. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Names the pair for a screen reader — "from", "until". */
  label: string;
  hourLabel: string;
  minuteLabel: string;
  className?: string;
  /** The hour list starts with a blank choice that clears the time. */
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const empty = allowEmpty && value === '';
  const { hour, minute } = empty ? { hour: '', minute: '' } : split(value);

  return (
    <span
      role="group"
      aria-label={label}
      className={cn('flex w-full max-w-[12rem] items-center gap-1', className)}
      dir="ltr"
    >
      <Select
        aria-label={`${label} · ${hourLabel}`}
        disabled={disabled}
        value={hour}
        onChange={(event) =>
          onChange(event.target.value === '' ? '' : `${event.target.value}:${minute || '00'}`)
        }
        className={cn(SELECT_WIDTH, "tabular-nums")}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <span aria-hidden className="text-ink-500">
        :
      </span>
      <Select
        aria-label={`${label} · ${minuteLabel}`}
        disabled={disabled || empty}
        value={minute}
        onChange={(event) => onChange(`${hour || '09'}:${event.target.value}`)}
        className={cn(SELECT_WIDTH, "tabular-nums")}
      >
        {MINUTES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </span>
  );
}
