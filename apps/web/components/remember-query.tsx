'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/**
 * A list remembers how it was last filtered, for the length of the browser tab.
 *
 * Coming back to "patients" from a file reopened the full list and the search
 * had to be typed again; every list page had the same complaint. The filters
 * live in the URL (linkable, reloadable, filtered on the server), so this only
 * copies them out when they change and puts them back when the page is
 * opened without any.
 *
 * Restoring happens once, on the first paint of a bare URL. After that the
 * URL is the truth: clearing the search writes an empty memory, so an
 * emptied filter stays empty and does not spring back on the next visit.
 *
 * `sessionStorage`, not `localStorage`, for the same reason as the open-files
 * strip: a search term is a patient's name, and a shared clinic computer must
 * not still be showing it tomorrow. Signing out clears it outright.
 * The page number is never remembered — page 3 of last time is nowhere.
 */
export function RememberQuery({ id, keys }: { id: string; keys: readonly string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restored = useRef(false);

  const present = keys.filter((key) => searchParams.has(key));
  const serialised = present.map((key) => `${key}=${searchParams.get(key)}`).join('&');

  useEffect(() => {
    const storageKey = `${STORAGE_PREFIX}${id}`;
    if (!restored.current) {
      restored.current = true;
      if (present.length === 0) {
        const saved = read(storageKey);
        if (saved) {
          const next = new URLSearchParams(searchParams.toString());
          for (const [key, value] of Object.entries(saved)) {
            if (keys.includes(key)) next.set(key, value);
          }
          const query = next.toString();
          if (query !== searchParams.toString()) {
            router.replace(query ? `${pathname}?${query}` : pathname);
          }
          return;
        }
      }
    }
    const memory: Record<string, string> = {};
    for (const key of present) memory[key] = searchParams.get(key) ?? '';
    write(storageKey, memory);
    // `serialised` stands in for the keys' values; `present` is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, serialised]);

  return null;
}

const STORAGE_PREFIX = 'herbalist-filters:';

function read(storageKey: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const memory: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value) memory[key] = value;
    }
    return Object.keys(memory).length > 0 ? memory : null;
  } catch {
    return null;
  }
}

function write(storageKey: string, memory: Record<string, string>) {
  try {
    if (Object.keys(memory).length === 0) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, JSON.stringify(memory));
  } catch {
    // Storage that refuses is a page that simply does not remember.
  }
}

/** Called on sign-out: the next person at this machine starts with nothing. */
export function forgetAllFilters() {
  try {
    const doomed: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear if nothing could be stored.
  }
}
