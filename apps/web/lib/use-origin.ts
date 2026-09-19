'use client';

import { useSyncExternalStore } from 'react';

const noSubscription = () => () => {};
const readOrigin = () => window.location.origin;
const serverOrigin = () => '';

/**
 * This site's origin, for a link someone copies (the booking page, the calendar
 * feed, an invitation). Empty on the server and through hydration — a URL drawn
 * there would name whatever machine built the page — and the real one in the
 * render straight after, with no effect and no second state.
 */
export function useOrigin(): string {
  return useSyncExternalStore(noSubscription, readOrigin, serverOrigin);
}
