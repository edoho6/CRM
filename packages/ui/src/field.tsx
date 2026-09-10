import * as React from 'react';
import { cn } from './cn';
import { focusField, focusRing } from './focus';

/* Form primitives.
 *
 * Every control uses logical properties only (ps/pe, text-start) so the same
 * markup lays out correctly in Hebrew and English without a mirrored stylesheet. */

export const inputClasses =
  // 16px on a phone: below that iOS zooms the page in on focus and never zooms back.
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base sm:text-sm text-ink-900 ' +
  'placeholder:text-ink-500 shadow-xs transition-colors text-start ' +
  `${focusField} ` +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500 ' +
  'read-only:bg-ink-50 read-only:text-ink-700';

/**
 * `compact` is the one smaller height a field may have: 32px, for a number
 * inside a table row or a filter bar, where the standard 40px would be taller
 * than the row it sits in. It is still a full-size target for a finger. There
 * is deliberately no third size — four different input heights across the
 * app was how this prop came to exist.
 */
export interface FieldSizing {
  compact?: boolean;
}

const compactClasses = 'h-8 px-2 py-1';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldSizing
>(({ className, compact = false, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(inputClasses, compact ? compactClasses : 'h-10', className)}
    {...props}
  />
));
Input.displayName = 'Input';

/**
 * The locale a native date or time control should format itself with.
 *
 * These controls choose their format from the page's language, and English gives
 * a twelve-hour clock with AM/PM. The clinic runs on a 24-hour clock everywhere
 * — every displayed time already does, through the shared formatter — so the
 * inputs are told to use a locale that agrees. British English differs from
 * American on exactly this point and on nothing else that matters here.
 *
 * Firefox has always honoured `lang` on these controls and current Chrome does
 * too. A browser that ignores it falls back to its own locale, which is what
 * happened before — not fixed, but no worse.
 */
export const TIME_INPUT_LANG = 'en-GB';

/**
 * Input for values that are always read left-to-right — phone numbers, ID numbers,
 * emails, times. Without this, digits inside a Hebrew page render in a confusing
 * visual order. This is the single most common RTL bug in clinic software.
 *
 * A `time` or `datetime-local` input also gets the 24-hour locale, so the clock
 * in the picker matches every clock elsewhere in the app.
 */
export const LtrInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldSizing
>(({ className, type, lang, compact = false, ...props }, ref) => {
  const isClock = type === 'time' || type === 'datetime-local';
  return (
    <input
      ref={ref}
      dir="ltr"
      type={type}
      lang={lang ?? (isClock ? TIME_INPUT_LANG : undefined)}
      className={cn(inputClasses, compact ? compactClasses : 'h-10', 'field-ltr', className)}
      {...props}
    />
  );
});
LtrInput.displayName = 'LtrInput';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(inputClasses, 'resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/**
 * Native select on purpose: it is fully accessible, matches the platform, and
 * flips direction with the page for free. A custom listbox would have to
 * reimplement all three.
 */
/**
 * A dropdown.
 *
 * The trailing padding is the whole reason this is not just `inputClasses`. A
 * `<select>` draws its own arrow on the inline-end edge, inside the box, and
 * with equal padding on both sides the text runs underneath it — a long option
 * like "בחירה מרובה" came out visibly clipped. `pe-9` reserves the arrow its
 * room. It is a logical property, so it is the left edge in Hebrew and the right
 * in English, which is where the browser puts the arrow in each.
 *
 * `text-ellipsis` covers the rest: an option longer than the control now ends in
 * a dash rather than being cut mid-letter, which at least reads as truncation.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & FieldSizing
>(({ className, children, compact = false, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      inputClasses,
      compact ? compactClasses : 'h-10',
      // `ui-select` draws the one arrow (see base.css) instead of the platform's.
      'ui-select cursor-pointer pe-9 text-ellipsis',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'h-5 w-5 shrink-0 rounded-sm border-ink-300 accent-accent pointer-coarse:h-6 pointer-coarse:w-6',
      focusRing,
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('block text-sm font-medium text-ink-700', className)} {...props}>
      {children}
      {required ? <span className="text-red-700"> *</span> : null}
    </label>
  );
}

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  /** 'compact' shrinks the label for fields grouped under a shared heading. */
  density?: 'default' | 'compact';
  children: React.ReactNode;
}

/** Label + control + error message, with the wiring that keeps them associated. */
/**
 * A labelled form field.
 *
 * The hint and the error carry ids derived from the field's own, and the input
 * points at them through `aria-describedby`. Without that the error is a red
 * paragraph a screen reader may never associate with the control it belongs to
 * — and colour alone is never a message.
 *
 * `aria-live` on the error means a validation failure that appears after
 * submission is announced rather than silently rendered.
 *
 * `density="compact"` shrinks the label for fields sitting side by side under a
 * shared heading — the tongue's colour, shape and coating, say. It changes the
 * type size and nothing else: the label is still a real `<label>`, still
 * associated, and still read out. Compact is about the eye, not the tree.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  density = 'default',
  children,
}: FieldProps) {
  const hintId = htmlFor && hint && !error ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const compact = density === 'compact';

  return (
    <div className={cn(compact ? 'space-y-0.5' : 'space-y-1.5', className)}>
      {label ? (
        <Label
          htmlFor={htmlFor}
          required={required}
          className={compact ? 'text-xs font-normal text-ink-600' : undefined}
        >
          {label}
        </Label>
      ) : null}
      {/* The control is cloned only to attach the description and the invalid
          state; everything else about it is the caller's business. */}
      {describedBy && React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': describedBy,
            ...(error ? { 'aria-invalid': true } : {}),
          })
        : children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="text-xs font-medium text-red-700"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Consistent two-column form grid that collapses on small screens. */
export function FieldGrid({
  children,
  className,
  columns = 2,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
