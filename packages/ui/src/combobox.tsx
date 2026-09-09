'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';
import { focusField } from './focus';
import { FloatingList, useAnchoredPosition } from './popover';

/**
 * Type-ahead selection over a list that is too long for a dropdown.
 *
 * The list of formulas is 170 entries and the herb catalogue is 376. A `<select>`
 * of either is unusable: you cannot type "Chai Hu" into one, and scrolling to
 * find it takes longer than writing the prescription.
 *
 * The important behaviour is what happens when nothing matches. A practitioner
 * regularly prescribes something the catalogue has never heard of — a patent
 * remedy, a supplement, a formula they have modified. Refusing to record it does
 * not stop it being prescribed; it just moves the record onto a piece of paper,
 * where nothing can find it again. So `allowCustom` keeps whatever was typed,
 * and the caller is told it was free text rather than a catalogue entry.
 *
 * Keyboard: ArrowUp/ArrowDown move, Enter takes the highlighted match or, when
 * nothing is highlighted, whatever has been typed. Escape closes the list without
 * clearing the field, so a mis-typed entry can be corrected rather than retyped.
 */

export interface ComboboxOption {
  id: string;
  /** The main label. Shown in the field once chosen. */
  label: string;
  /** Shown beside the label in the list — a pinyin name, a Chinese name. */
  secondary?: string | null;
  /** Shown at the far end of the row, quieter. */
  tertiary?: string | null;
  /** Everything to match against, in addition to the three above. */
  keywords?: string;
  /** Force LTR on the label, for pinyin and codes inside a Hebrew page. */
  ltr?: boolean;
}

export interface ComboboxValue {
  /** Null when the text was typed rather than chosen from the list. */
  id: string | null;
  label: string;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Ranked so an exact code beats a prefix, and a prefix beats a mention. */
function rank(option: ComboboxOption, needle: string): number {
  const fields = [
    option.label,
    option.secondary ?? '',
    option.tertiary ?? '',
    option.keywords ?? '',
  ];
  let best = -1;
  for (const raw of fields) {
    const field = normalise(raw);
    if (!field) continue;
    let score = -1;
    if (field === needle) score = 0;
    else if (field.startsWith(needle)) score = 1;
    else if (field.includes(` ${needle}`)) score = 2;
    else if (field.includes(needle)) score = 3;
    if (score >= 0 && (best === -1 || score < best)) best = score;
  }
  return best;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  label,
  allowCustom = false,
  disabled = false,
  id,
  limit = 200,
  className,
  emptyCustomHint,
}: {
  options: ComboboxOption[];
  value: ComboboxValue | null;
  onChange: (value: ComboboxValue | null) => void;
  placeholder?: string;
  /** Accessible name. Required, because the field carries no visible label of its own. */
  label: string;
  allowCustom?: boolean;
  disabled?: boolean;
  id?: string;
  /**
   * How many matches to keep. Generous on purpose: the list scrolls, and
   * truncating it silently means an empty search stops at whatever herb happens
   * to be tenth alphabetically with no sign that there is more.
   */
  limit?: number;
  className?: string;
  /** Shown under the list when nothing matched and free text is allowed. */
  emptyCustomHint?: string;
}) {
  const [term, setTerm] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const reactId = React.useId();
  const listId = `${id ?? reactId}-options`;

  // The field shows the chosen label until the user starts typing again. On
  // focus the label is selected whole, so typing replaces it and the name
  // does not vanish the moment the field is clicked.
  const display = term !== '' ? term : (value?.label ?? '');

  const matches = React.useMemo(() => {
    const needle = normalise(term);
    if (!needle) return options.slice(0, limit);
    const scored: { option: ComboboxOption; score: number }[] = [];
    for (const option of options) {
      const score = rank(option, needle);
      if (score >= 0) scored.push({ option, score });
    }
    scored.sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label));
    return scored.slice(0, limit).map((entry) => entry.option);
  }, [options, term, limit]);

  function choose(option: ComboboxOption) {
    onChange({ id: option.id, label: option.label });
    setTerm('');
    setOpen(false);
  }

  function takeTyped() {
    const typed = term.trim();
    if (!typed) return;
    if (!allowCustom) return;
    onChange({ id: null, label: typed });
    setTerm('');
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setTerm('');
    setOpen(false);
    inputRef.current?.focus();
  }

  const showCustomHint = allowCustom && term.trim() !== '' && matches.length === 0;
  const listVisible = open && (matches.length > 0 || showCustomHint);

  // The list is rendered into the body and positioned against the field, so a
  // combobox inside a scrolling table is not cut off by it.
  const listStyle = useAnchoredPosition(fieldRef, listVisible, {
    contentRef: listRef,
    // Re-measure whenever the result count changes, so narrowing a search
    // re-seats the list under the field instead of leaving it at its old size.
    revision: matches.length + (showCustomHint ? 1 : 0),
    // Tall enough to scan, short enough not to cover the form behind it. The
    // list scrolls past this; it does not stop at it.
    maxHeight: 320,
  });

  return (
    <div ref={fieldRef} className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-4 w-4 text-ink-500"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(event) => {
          setTerm(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        // The delay lets a click on an option land before the list unmounts.
        // Text typed but never chosen is dropped when the field is left, so
        // what the field shows is always what the value is — a half-typed
        // name over a different, still-selected patient was a wrong booking
        // waiting to happen.
        onBlur={() =>
          window.setTimeout(() => {
            setOpen(false);
            if (!allowCustom) setTerm('');
          }, 140)
        }
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlight((current) => Math.min(current + 1, matches.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter') {
            // Only swallow the key when it is doing something here, so Enter
            // still submits the surrounding form when the field is settled.
            if (open && matches[highlight]) {
              event.preventDefault();
              choose(matches[highlight]);
            } else if (allowCustom && term.trim()) {
              event.preventDefault();
              takeTyped();
            }
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={cn(
          'h-10 w-full rounded-lg border border-ink-200 bg-white ps-8 pe-8 text-sm text-ink-900',
          'shadow-xs placeholder:text-ink-500',
          focusField,
          'disabled:bg-ink-50 disabled:text-ink-600',
        )}
      />

      {value && !disabled ? (
        <button
          type="button"
          onClick={clear}
          aria-label={`${label} — ✕`}
          className="absolute inset-y-0 end-1 my-auto h-7 w-7 rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
        >
          <X className="mx-auto h-4 w-4" aria-hidden />
        </button>
      ) : null}

      {listVisible ? (
        <FloatingList ref={listRef} id={listId} role="listbox" aria-label={label} style={listStyle}>
          {matches.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={cn(
                  'flex w-full items-baseline gap-2 px-2.5 py-1.5 text-start text-sm',
                  index === highlight ? 'bg-jade-50' : 'hover:bg-ink-50',
                )}
              >
                <span
                  dir={option.ltr ? 'ltr' : undefined}
                  className="shrink-0 font-medium text-ink-900"
                >
                  {option.label}
                </span>
                {option.secondary ? (
                  <span className="truncate text-ink-700">{option.secondary}</span>
                ) : null}
                {option.tertiary ? (
                  <span className="ms-auto shrink-0 truncate text-xs text-ink-600">
                    {option.tertiary}
                  </span>
                ) : null}
              </button>
            </li>
          ))}

          {showCustomHint ? (
            <li>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={takeTyped}
                className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-start text-sm hover:bg-ink-50"
              >
                <span className="font-medium text-jade-800">{term.trim()}</span>
                {emptyCustomHint ? (
                  <span className="text-xs text-ink-600">{emptyCustomHint}</span>
                ) : null}
              </button>
            </li>
          ) : null}
        </FloatingList>
      ) : null}
    </div>
  );
}
