'use client';

import { useSyncExternalStore } from 'react';

/*
 * A value this browser remembers, read as an external store.
 *
 * The pattern it replaces — `useState(default)` and then `setState(stored)` in
 * an effect after mount — drew every such component twice: once with the
 * default, then again with the remembered value. Read as a store, the server and
 * the hydrating render both see "nothing stored" (so their markup agrees), and
 * the render straight after hydration sees the real value, with no effect and no
 * second state in between.
 *
 * Only for preferences that do not move the layout. One that does (a collapsed
 * sidebar, a table's row size) belongs to the pre-paint script in lib/theme.ts,
 * or the page jumps — see "בלי קפיצות אחרי הטעינה" in CLAUDE.md.
 *
 * A browser that blocks site data throws on every access; the value is then
 * kept in memory for the life of the page, so a choice still sticks until reload.
 */

const listeners = new Map<string, Set<() => void>>();
const memory = new Map<string, string | null>();

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remember (or, with null, forget) a value, and redraw everything reading it. */
export function writeStored(key: string, raw: string | null): void {
  memory.set(key, raw);
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch {
    // Kept in memory above; it just will not outlive the page.
  }
  for (const listener of listeners.get(key) ?? []) listener();
}

function subscribeTo(key: string) {
  return (listener: () => void) => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };
}

const subscriptions = new Map<string, (listener: () => void) => () => void>();
function subscription(key: string) {
  let subscribe = subscriptions.get(key);
  if (!subscribe) subscriptions.set(key, (subscribe = subscribeTo(key)));
  return subscribe;
}

const serverSnapshot = () => null;

/**
 * The stored string for `key`, or null when nothing is stored — and always null
 * on the server and during hydration. An empty key reads nothing.
 */
export function useStoredRaw(key: string): string | null {
  return useSyncExternalStore(
    subscription(key),
    () => (key ? readRaw(key) : null),
    serverSnapshot,
  );
}
