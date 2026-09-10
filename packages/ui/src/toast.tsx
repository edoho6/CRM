'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { ALERT_TONE_CLASSES, type AlertTone } from './feedback';
import { focusRing } from './focus';

/**
 * Confirmation that something happened, without moving anything.
 *
 * Every "saved" and "deleted" used to be an `Alert` dropped into the page,
 * which shifts the form under the cursor and stays until the next navigation;
 * and several actions said nothing at all. A toast sits in the corner, says
 * its piece and leaves. It is for news about a finished action. State that the
 * form needs to keep showing — a validation error, a locked record — stays
 * inline, where it belongs.
 *
 * Not `@radix-ui/react-toast`: its swipe-to-dismiss, viewport hotkey and second
 * live region all want RTL-specific configuration, and the whole of what is
 * needed here is under two hundred lines with no new dependency.
 *
 * Accessibility, by the rules rather than by feel: one polite live region that
 * exists from the first render (a region created together with its message is
 * not announced); a `danger` toast never leaves on its own; timers stop while
 * the pointer or focus is on a toast; Escape closes the focused one; and no
 * more than three are shown, the oldest giving way.
 */

export interface ToastOptions {
  /** A stable id: a second toast with the same id replaces the first rather than stacking. */
  id?: string;
  tone?: AlertTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Milliseconds before it goes. Ignored for `danger`, which stays until closed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastRecord {
  id: string;
  tone: AlertTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  duration: number;
  action?: ToastOptions['action'];
  leaving: boolean;
}

export interface ToastApi {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 3;
/** If `animationend` never arrives — animations switched off at the OS, a throttled tab — the toast still goes. */
const EXIT_FALLBACK_MS = 400;

let counter = 0;

export function ToastProvider({
  closeLabel,
  children,
}: {
  /** Accessible name of the close button, in the page's language. */
  closeLabel: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = React.useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const remove = React.useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((current) => current.filter((item) => item.id !== id));
    },
    [clearTimer],
  );

  // Two steps: mark it leaving so the exit animation plays, then take it out
  // when the animation reports done — or after the fallback, whichever first.
  const dismiss = React.useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
      );
      timers.current.set(
        id,
        setTimeout(() => remove(id), EXIT_FALLBACK_MS),
      );
    },
    [clearTimer, remove],
  );

  const schedule = React.useCallback(
    (item: ToastRecord) => {
      if (item.tone === 'danger') return;
      clearTimer(item.id);
      timers.current.set(
        item.id,
        setTimeout(() => dismiss(item.id), item.duration),
      );
    },
    [clearTimer, dismiss],
  );

  const toast = React.useCallback(
    (options: ToastOptions) => {
      counter += 1;
      const record: ToastRecord = {
        id: options.id ?? `toast-${counter}`,
        tone: options.tone ?? 'info',
        title: options.title,
        description: options.description,
        duration: options.duration ?? DEFAULT_DURATION_MS,
        action: options.action,
        leaving: false,
      };
      setItems((current) =>
        [...current.filter((item) => item.id !== record.id), record].slice(-MAX_VISIBLE),
      );
      schedule(record);
      return record.id;
    },
    [schedule],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  const api = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Always in the tree, even empty — that is what makes a message added
          later get read out. `pointer-events-none` on the stack so an empty
          corner never blocks what is under it; each toast turns them back on. */}
      <div
        role="status"
        aria-live="polite"
        // Clear of a phone's tab bar (`--bottom-bar`, set by the app that has
        // one) and of the home indicator; otherwise a rem above the edge.
        className="pointer-events-none fixed end-4 bottom-[calc(var(--bottom-bar,0px)+env(safe-area-inset-bottom)+1rem)] z-toast flex w-[min(24rem,calc(100dvw-2rem))] flex-col gap-2"
      >
        {items.map((item) => (
          <ToastItem
            key={item.id}
            item={item}
            closeLabel={closeLabel}
            onPause={() => clearTimer(item.id)}
            onResume={() => schedule(item)}
            onDismiss={() => dismiss(item.id)}
            onGone={() => remove(item.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  item,
  closeLabel,
  onPause,
  onResume,
  onDismiss,
  onGone,
}: {
  item: ToastRecord;
  closeLabel: string;
  onPause: () => void;
  onResume: () => void;
  onDismiss: () => void;
  onGone: () => void;
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg',
        ALERT_TONE_CLASSES[item.tone],
        item.leaving ? 'animate-toast-out' : 'animate-toast-in',
      )}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDismiss();
      }}
      onAnimationEnd={() => {
        if (item.leaving) onGone();
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.title}</p>
        {item.description ? <div className="mt-0.5 opacity-90">{item.description}</div> : null}
        {item.action ? (
          <button
            type="button"
            onClick={item.action.onClick}
            className={cn(
              'mt-1.5 rounded text-xs font-semibold underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onDismiss}
        className={cn(
          '-me-2 -my-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100',
          focusRing,
        )}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = React.useContext(ToastContext);
  if (!api) {
    throw new Error('useToast() needs a <ToastProvider> above it — mount one in the root layout.');
  }
  return api;
}
