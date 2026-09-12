import type { FirebaseMessagingPlugin } from '@capacitor-firebase/messaging';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * The native plugin, reached through the bridge by name rather than through
 * the package's own entry point: that entry point also carries a browser
 * implementation built on the Firebase web SDK, which this site neither has
 * nor wants in its bundle. Nothing here runs outside a shell, where the
 * native side is always there to answer.
 */
const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>('FirebaseMessaging');

/**
 * Notifications on the phone, from the page's side. Loaded on demand and
 * only inside a shell; the plugin behind it talks to Firebase on both
 * platforms and hands back one token per phone, which the site registers
 * (register_push_device) so the hourly queue can reach this device.
 *
 * Permission is asked from a settings card, never at launch: a request the
 * person did not choose is one they refuse, and iOS never asks twice.
 */

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** True only where the native side can answer: the user agent alone (a test, a copy) is not enough. */
export function pushAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/** The Android channel the sender addresses (`channel_id: 'reminders'`). */
const CHANNEL_ID = 'reminders';

function toPermission(receive: string): PushPermission {
  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  return 'prompt';
}

export async function pushPermission(): Promise<PushPermission> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    return toPermission(receive);
  } catch {
    return 'unsupported';
  }
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { receive } = await FirebaseMessaging.requestPermissions();
    return toPermission(receive);
  } catch {
    return 'unsupported';
  }
}

/** The phone's token now — null when there is none yet or it cannot be read. */
export async function currentPushToken(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { token } = await FirebaseMessaging.getToken();
    return token || null;
  } catch {
    return null;
  }
}

/** Android groups notifications by channel; ours is made once, named in the person's language. */
export async function ensureNotificationChannel(name: string): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await FirebaseMessaging.createChannel({ id: CHANNEL_ID, name, importance: 4 });
  } catch {
    /* An older phone, or a channel already there. */
  }
}

/** A new token for the same phone — Firebase rotates them — arrives here. */
export function onPushToken(listener: (token: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = FirebaseMessaging.addListener('tokenReceived', (event) => listener(event.token)).catch(() => null);
  return () => void handle.then((h) => h?.remove());
}

/** The person tapped a notification: the address it carries, if any. */
export function onNotificationTap(listener: (url: string | null) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = FirebaseMessaging
    .addListener('notificationActionPerformed', (event) => {
      const data = event.notification.data as { url?: unknown } | undefined;
      listener(typeof data?.url === 'string' ? data.url : null);
    })
    .catch(() => null);
  return () => void handle.then((h) => h?.remove());
}

/** Forgets the phone's token on the phone, so a fresh one is made next time. */
export async function forgetPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await FirebaseMessaging.deleteToken();
  } catch {
    /* Nothing to forget. */
  }
}

/** The platform the token belongs to, as the database names it. */
export function pushPlatform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
}
