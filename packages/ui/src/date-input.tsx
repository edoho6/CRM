'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from './cn';
import { LtrInput } from './field';
import { useUiLabels } from './ui-labels';

/**
 * A date typed as day/month/year, with the native calendar a click away.
 *
 * `<input type="date">` takes its display order from the *browser's* language,
 * not the page's: on an English Windows it shows mm/dd/yyyy, and 03/09 is
 * March 9th to the control and the ninth of March to the person typing it —
 * a wrong date of birth or a wrong expiry waiting to happen. So the visible
 * field is plain text that accepts digits and writes the slashes itself, and
 * a native date input sits hidden beside it for the calendar button and for
 * `min`/`max`. The value that goes out is always `YYYY-MM-DD`, as before, so
 * nothing around this component changes.
 *
 * Controlled only: `value` in ISO, `onChange` with an event whose target's
 * value is ISO (or `''`). Forms on react-hook-form use `watch`/`setValue`.
 *
 * Shared by both apps because the questionnaire renderer needs it too. Its
 * three words — the placeholder, the calendar button's name, the "not a
 * date" message — come from `UiLabelsProvider` (mounted once per app) or
 * from `labels`, whichever is given.
 */
export interface DateInputLabels {
  placeholder: string;
  openCalendar: string;
  invalid: string;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  compact = true,
  className,
  id,
  name,
  disabled,
  required,
  labels: ownLabels,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  autoFocus,
}: {
  value: string | null | undefined;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  compact?: boolean;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  labels?: DateInputLabels;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  autoFocus?: boolean;
}) {
  const shared = useUiLabels().dateInput;
  // Never unlabelled: without either source the placeholder stays the
  // language-neutral pattern and the button is named by that pattern.
  const labels: DateInputLabels = ownLabels ??
    shared ?? { placeholder: 'dd/mm/yyyy', openCalendar: 'dd/mm/yyyy', invalid: 'dd/mm/yyyy' };
  const native = React.useRef<HTMLInputElement>(null);
  const iso = value ?? '';
  const [text, setText] = React.useState(() => toDisplayDate(iso));
  const [invalid, setInvalid] = React.useState(false);
  const editing = React.useRef(false);

  // The outside value is the truth whenever the field is not being typed in.
  React.useEffect(() => {
    if (editing.current) return;
    setText(toDisplayDate(iso));
    setInvalid(false);
  }, [iso]);

  const emit = (next: string) => {
    const target = native.current;
    if (!target) return;
    target.value = next;
    onChange?.({ target, currentTarget: target } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handleText = (raw: string) => {
    const masked = maskDate(raw);
    setText(masked);
    if (masked === '') {
      setInvalid(false);
      if (iso !== '') emit('');
      return;
    }
    const parsed = fromDisplayDate(masked);
    if (parsed) {
      setInvalid(false);
      if (parsed !== iso) emit(parsed);
    } else {
      // Ten characters that are not a date is a mistake to point at; fewer is
      // just a date still being typed.
      setInvalid(masked.length === 10);
    }
  };

  const describedBy =
    [ariaDescribedBy, invalid && id ? `${id}-date-error` : null].filter(Boolean).join(' ') ||
    undefined;

  // A click anywhere in the field opens the calendar, not only the button at
  // its end — that is where a mouse expects a date to come from. Reaching the
  // field with Tab does not: a keyboard is there to type the digits.
  const openPicker = () => {
    const picker = native.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!picker || disabled) return;
    try {
      picker.showPicker?.();
    } catch {
      picker.focus();
    }
  };

  // Left-to-right as a whole, so "end" is the same edge for the field's
  // padding and for the calendar button — inside a Hebrew page the two
  // otherwise land on opposite sides and the button covers the day.
  return (
    <span dir="ltr" className={cn('relative inline-flex w-auto items-center', className)}>
      <LtrInput
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={labels.placeholder}
        value={text}
        compact={compact}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        maxLength={10}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid || invalid || undefined}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          // Leaving a half-typed date behind is leaving nothing behind.
          if (text !== '' && !fromDisplayDate(text)) {
            setText(toDisplayDate(iso));
            setInvalid(false);
          }
        }}
        onChange={(event) => handleText(event.target.value)}
        onClick={openPicker}
        className={cn('w-[9.5rem] pe-9 tabular-nums', invalid && 'border-red-700')}
      />
      <button
        type="button"
        aria-label={labels.openCalendar}
        title={labels.openCalendar}
        disabled={disabled}
        onClick={openPicker}
        className="absolute inset-y-0 end-1 my-auto flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800 active:bg-ink-200 disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
      </button>
      {/* The native control, kept for its picker and for min/max. Not display:none —
          the browser refuses to open the picker of an element it cannot lay out. */}
      <input
        ref={native}
        type="date"
        name={name}
        tabIndex={-1}
        aria-hidden
        min={min}
        max={max}
        defaultValue={iso}
        onChange={(event) => {
          const next = event.target.value;
          setText(toDisplayDate(next));
          setInvalid(false);
          onChange?.(event);
        }}
        className="pointer-events-none absolute inset-y-0 end-0 h-full w-8 opacity-0"
      />
      {invalid && id ? (
        <span id={`${id}-date-error`} role="alert" className="sr-only">
          {labels.invalid}
        </span>
      ) : null}
    </span>
  );
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`; anything else comes back as it is. */
export function toDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** `DD/MM/YYYY` → `YYYY-MM-DD` when it is a real calendar date, else null. */
export function fromDisplayDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Digits only, slashes written by the field: "3" → "3", "0309" → "03/09", "03092026" → "03/09/2026". */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(
    (p) => p !== '',
  );
  let out = parts.join('/');
  // Keep the slash the person just typed past, so "03/" does not snap back to "03".
  if (/\/$/.test(raw) && (digits.length === 2 || digits.length === 4)) out += '/';
  return out;
}
