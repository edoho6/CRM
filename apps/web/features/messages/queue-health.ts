/**
 * Has the sending stopped?
 *
 * A cron that dies leaves no trace on any screen. The queue fills, nothing goes
 * out, and it looks exactly like a quiet week — which is the worst kind of
 * failure this system can have, because the practitioner finds out when a
 * patient does not arrive.
 *
 * The hard part is not noticing a stall; it is not crying wolf. A clinic that
 * has no sending service at all works the queue by hand in the evening, and a
 * permanent red banner on that screen is a banner nobody reads by the third
 * day. So the alarm needs evidence that something *was* sending and has
 * stopped, not merely that messages are waiting.
 */

export type QueueState =
  /** Nothing waiting, or the service is keeping up. */
  | 'ok'
  /** Messages are waiting and no service has ever sent for this clinic. */
  | 'manual'
  /** Something was sending, and has not sent for longer than it should have. */
  | 'stalled';

export interface QueueHealth {
  state: QueueState;
  /** How long the oldest waiting message has waited, in minutes. */
  waitingMinutes: number;
  /** How long since anything was sent automatically, in minutes; null if never. */
  silentMinutes: number | null;
}

/**
 * How long the dispatcher may be quiet before it counts as stopped.
 *
 * The queue is filled hourly and drained on a schedule of minutes, so three
 * hours is several missed rounds and still short of a morning: long enough not
 * to fire on a slow night, short enough that the day's reminders can still be
 * sent by hand.
 */
export const STALL_AFTER_MINUTES = 180;

const minutesBetween = (later: Date, earlier: Date) =>
  Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60_000));

export function queueHealth(
  input: {
    /** When the oldest still-queued message was created; null when none wait. */
    oldestQueuedAt: string | null;
    /** When a service last sent something for this clinic; null if never. */
    lastAutomaticSendAt: string | null;
  },
  now: Date = new Date(),
  stallAfterMinutes: number = STALL_AFTER_MINUTES,
): QueueHealth {
  if (!input.oldestQueuedAt) {
    return { state: 'ok', waitingMinutes: 0, silentMinutes: null };
  }

  const waitingMinutes = minutesBetween(now, new Date(input.oldestQueuedAt));
  const silentMinutes = input.lastAutomaticSendAt
    ? minutesBetween(now, new Date(input.lastAutomaticSendAt))
    : null;

  // Nothing has ever been sent by a service: this queue is worked by hand, and
  // a full one is how it is supposed to look.
  if (silentMinutes === null) {
    return { state: 'manual', waitingMinutes, silentMinutes };
  }

  // Waiting longer than a service should take, and the service has been quiet
  // for just as long. Either alone is ordinary: a message queued a minute ago
  // has not been missed, and a quiet night with an empty queue is a quiet night.
  const stalled = waitingMinutes >= stallAfterMinutes && silentMinutes >= stallAfterMinutes;
  return { state: stalled ? 'stalled' : 'ok', waitingMinutes, silentMinutes };
}
