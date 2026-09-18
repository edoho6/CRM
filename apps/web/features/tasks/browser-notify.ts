'use client';

/**
 * The browser's own notification, the one that shows outside the tab.
 *
 * One function for the bell and for the "send a test" button, so the test
 * proves exactly what the reminder does. It stays on screen until it is
 * dismissed (`requireInteraction`): on Windows a notification that leaves by
 * itself after five seconds goes straight to the notification centre, and a
 * reminder nobody was looking at the corner for is a reminder that did not
 * happen. A click brings the tab forward and opens the tasks.
 *
 * Returns false when the browser would not show it — no permission, or a
 * browser that only allows notifications from a service worker — so the
 * caller can say so instead of assuming it went out. What it cannot know is
 * whether the operating system then hid it ("do not disturb", or the browser
 * switched off in the system's notification settings); the test button is how
 * a person finds that out.
 */
export function showBrowserNotification({
  title,
  body,
  tag,
  href,
}: {
  title: string;
  body: string;
  /** One notification per task: a second for the same tag replaces the first. */
  tag: string;
  /** Where a click takes the tab. */
  href?: string;
}): boolean {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const notification = new Notification(title, {
      body,
      tag,
      requireInteraction: true,
      icon: '/icons/icon-192.png',
      lang: document.documentElement.lang || undefined,
      dir: document.documentElement.dir === 'rtl' ? 'rtl' : 'auto',
    });
    notification.onclick = () => {
      window.focus();
      if (href) window.location.assign(href);
      notification.close();
    };
    return true;
  } catch {
    // Chrome on Android throws here: notifications there come only from a
    // service worker. The in-app toast has already said it.
    return false;
  }
}
