import * as React from 'react';
import { cn } from './cn';

/* Form primitives.
 *
 * Every control uses logical properties only (ps/pe, text-start) so the same
 * markup lays out correctly in Hebrew and English without a mirrored stylesheet. */

export const inputClasses =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 ' +
  'placeholder:text-ink-400 shadow-xs transition-colors text-start ' +
  'focus:border-jade-500 focus:outline-2 focus:outline-offset-0 focus:outline-jade-600/30 ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500 ' +
  'read-only:bg-ink-50 read-only:text-ink-700';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClasses, 'h-10', className)} {...props} />
  ),
);
Input.displayName = 'Input';

/**
 * Input for values that are always read left-to-right — phone numbers, ID numbers,
 * emails, times. Without this, digits inside a Hebrew page render in a confusing
 * visual order. This is the single most common RTL bug in clinic software.
 */
export const LtrInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} dir="ltr" className={cn(inputClasses, 'h-10 field-ltr', className)} {...props} />
  ),
);
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
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(inputClasses, 'h-10 cursor-pointer', className)} {...props}>
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
      'h-4 w-4 shrink-0 rounded border-ink-300 text-jade-600 accent-jade-600',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-600',
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
      {required ? <span className="text-red-600"> *</span> : null}
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
  children: React.ReactNode;
}

/** Label + control + error message, with the wiring that keeps them associated. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-xs text-ink-500">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
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
