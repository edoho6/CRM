import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Saves a form on a timer, so a treatment record cannot be lost to a closed tab.
 *
 * A consultation lasts an hour and the note is written across all of it. The
 * failure this exists to prevent is not a crash — it is the ordinary one: the
 * browser is closed, the laptop sleeps and the session expires, someone
 * navigates away to look something up. Losing a full clinical record to any of
 * those is not acceptable, and remembering to press save is not a control.
 *
 * Three things make it safe to leave running:
 *
 *   · it compares a serialisation of the value against what was last written, so
 *     an idle form makes no requests at all
 *   · it never runs while `enabled` is false, which is how a signed record —
 *     locked by the database anyway — avoids pointless rejected writes
 *   · it also saves when the tab is hidden, which catches the close and the
 *     switch-away that the timer would otherwise miss by up to a full interval
 *
 * `beforeunload` is deliberately not used: it cannot await an async save, so it
 * promises something it does not deliver. Saving on `visibilitychange` fires
 * before it and actually completes.
 */

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveResult {
  state: AutosaveState;
  /** When the last successful save landed, for "saved at 14:32". */
  lastSavedAt: Date | null;
  /** Forces a save now, and marks the current value as written. */
  saveNow: () => Promise<void>;
  /** Tells the hook a manual save already persisted this value. */
  markSaved: () => void;
}

export function useAutosave<T>({
  value,
  onSave,
  enabled = true,
  intervalMs = 45_000,
}: {
  value: T;
  onSave: (value: T) => Promise<boolean>;
  enabled?: boolean;
  /** Between thirty seconds and a minute is the useful range. */
  intervalMs?: number;
}): AutosaveResult {
  const [state, setState] = useState<AutosaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs, not state: the interval callback is created once and must see the
  // current value without the timer being torn down and rebuilt on every
  // keystroke — which would mean it never actually fires while someone types.
  const valueRef = useRef(value);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  // The first render's value is the baseline: opening a record and touching
  // nothing must not write it back. Taken once, not re-stringified per render.
  const [baseline] = useState(() => JSON.stringify(value));
  const savedSnapshotRef = useRef<string | null>(baseline);
  const inFlightRef = useRef(false);

  // Refreshed after each render, before the timer or an unload can read them.
  useLayoutEffect(() => {
    valueRef.current = value;
    onSaveRef.current = onSave;
    enabledRef.current = enabled;
  });

  const markSaved = useCallback(() => {
    savedSnapshotRef.current = JSON.stringify(valueRef.current);
    setLastSavedAt(new Date());
    setState('saved');
  }, []);

  const attempt = useCallback(async (force: boolean) => {
    if (!enabledRef.current || inFlightRef.current) return;

    const snapshot = JSON.stringify(valueRef.current);
    if (!force && snapshot === savedSnapshotRef.current) return;

    inFlightRef.current = true;
    setState('saving');
    try {
      const ok = await onSaveRef.current(valueRef.current);
      if (ok) {
        // Snapshot what was actually sent, not what the form holds now: anything
        // typed during the request is a genuine change still to be saved.
        savedSnapshotRef.current = snapshot;
        setLastSavedAt(new Date());
        setState('saved');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const saveNow = useCallback(() => attempt(true), [attempt]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => void attempt(false), intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, attempt]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void attempt(false);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [enabled, attempt]);

  return { state, lastSavedAt, saveNow, markSaved };
}
