'use client';

import * as React from 'react';
import { parseShellUserAgent } from '@clinic/domain/shell';

/** True inside one of the store apps — decided by the user agent they append to. */
export function isNativeShell(): boolean {
  if (typeof navigator === 'undefined') return false;
  return parseShellUserAgent(navigator.userAgent) !== null;
}

/**
 * The one component the store apps add to the site.
 *
 * Mounted in both root layouts and rendering nothing, it does its work in an
 * effect, and only inside a shell: the status bar that follows the theme, the
 * phone's back button, links that open the app from outside, the splash that
 * hides once the page is here. The code that talks to the phone lives in a
 * module loaded on demand, so a browser — the case for everyone not in the
 * shell — never downloads it.
 *
 * A shell whose plugins fail to load is still the site in a web view; the
 * failure is swallowed rather than surfaced, because there is nothing a
 * practitioner could do about it and every screen still works.
 */
export function NativeShellBridge() {
  React.useEffect(() => {
    const shell = parseShellUserAgent(navigator.userAgent);
    if (!shell) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    import('./bridge')
      .then(({ startBridge }) => startBridge(shell))
      .then((dispose) => {
        if (cancelled) dispose();
        else stop = dispose;
      })
      .catch(() => {
        /* The site in a web view, without the phone's extras. */
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}
