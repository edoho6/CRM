'use client';

import * as React from 'react';
import { parseShellUserAgent } from '@clinic/domain/shell';
import type { PushPermission } from './push';

/** What the site does with a token: the server action each app provides. */
export type RegisterPushDevice = (input: { token: string; platform: 'ios' | 'android'; locale: string }) => Promise<boolean>;

/** The cookie the sign-out action reads, to unregister the phone it is leaving. */
export const PUSH_TOKEN_COOKIE = 'herbalist-push-token';

/** Whether this is the store app does not change while the page is open. */
const noSubscription = () => () => {};

/** Raised by the settings card once permission is granted, so the registration runs at once. */
const GRANTED_EVENT = 'herbalist:push-granted';

function rememberToken(token: string | null) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = token
    ? `${PUSH_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=31536000; samesite=lax${secure}`
    : `${PUSH_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

/** Only an address on this site is followed; a notification cannot send the person elsewhere. */
function ownAddress(url: string | null): string | null {
  if (!url) return null;
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) return null;
    return target.pathname + target.search + target.hash;
  } catch {
    return null;
  }
}

/**
 * Keeps the phone registered while someone is signed in inside a shell.
 *
 * Mounted in each app's signed-in frame and rendering nothing. When the
 * phone already allows notifications it reads the token and registers it
 * (again — tokens rotate, and the row's `last_seen_at` is the proof of
 * life); when the settings card wins permission it does the same at once.
 * A tap on a notification lands on the address the notification carries.
 * Outside a shell nothing here runs.
 */
export function PushRegistration({
  locale,
  channelName,
  register,
}: {
  locale: string;
  /** The Android notification channel's visible name, in the person's language. */
  channelName: string;
  register: RegisterPushDevice;
}) {
  React.useEffect(() => {
    if (!parseShellUserAgent(navigator.userAgent)) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    async function registerNow(push: typeof import('./push')) {
      if ((await push.pushPermission()) !== 'granted') return;
      const token = await push.currentPushToken();
      if (!token || cancelled) return;
      const ok = await register({ token, platform: push.pushPlatform(), locale });
      if (ok) rememberToken(token);
    }

    import('./push')
      .then(async (push) => {
        // The user agent says shell; only a live bridge can answer.
        if (cancelled || !push.pushAvailable()) return;
        await push.ensureNotificationChannel(channelName);
        cleanups.push(
          push.onPushToken((token) => {
            void register({ token, platform: push.pushPlatform(), locale }).then((ok) => ok && rememberToken(token));
          }),
        );
        cleanups.push(
          push.onNotificationTap((url) => {
            const path = ownAddress(url);
            if (path) window.location.assign(path);
          }),
        );
        const onGranted = () => void registerNow(push);
        window.addEventListener(GRANTED_EVENT, onGranted);
        cleanups.push(() => window.removeEventListener(GRANTED_EVENT, onGranted));
        await registerNow(push);
      })
      .catch(() => {
        /* The shell without its notifications; everything else works. */
      });

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [locale, channelName, register]);
  return null;
}

/**
 * The card in the personal area (and the patient's account): where the phone
 * stands, and the one button that asks. In a browser it says the feature
 * lives in the app; on a phone that refused, it says where to allow it.
 */
export function PushSettings({
  labels,
  register,
  locale,
}: {
  labels: {
    unsupported: string;
    prompt: string;
    granted: string;
    denied: string;
    enable: string;
    enabling: string;
    failed: string;
  };
  register: RegisterPushDevice;
  locale: string;
}) {
  // Whether this is the store app at all, read from the browser as a store:
  // null on the server and through hydration (nothing drawn), then the answer.
  const inShell = React.useSyncExternalStore(
    noSubscription,
    () => Boolean(parseShellUserAgent(navigator.userAgent)),
    () => null,
  );
  const [asked, setPermission] = React.useState<PushPermission | 'unknown'>('unknown');
  const permission: PushPermission | 'unknown' = inShell === false ? 'unsupported' : asked;
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!inShell) return;
    let cancelled = false;
    import('./push')
      .then((push) => push.pushPermission())
      .then((state) => {
        if (!cancelled) setPermission(state);
      })
      .catch(() => {
        if (!cancelled) setPermission('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, [inShell]);

  async function enable() {
    setBusy(true);
    setFailed(false);
    try {
      const push = await import('./push');
      const state = await push.requestPushPermission();
      setPermission(state);
      if (state !== 'granted') return;
      const token = await push.currentPushToken();
      const ok = token ? await register({ token, platform: push.pushPlatform(), locale }) : false;
      if (!ok) {
        setFailed(true);
        return;
      }
      window.dispatchEvent(new CustomEvent(GRANTED_EVENT));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (permission === 'unknown') return null;
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-700" role="status">
        {permission === 'unsupported'
          ? labels.unsupported
          : permission === 'granted'
            ? labels.granted
            : permission === 'denied'
              ? labels.denied
              : labels.prompt}
      </p>
      {failed ? <p className="text-sm text-danger">{labels.failed}</p> : null}
      {permission === 'prompt' ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg shadow-xs transition-colors hover:bg-accent-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {busy ? labels.enabling : labels.enable}
          </button>
        </div>
      ) : null}
    </div>
  );
}
