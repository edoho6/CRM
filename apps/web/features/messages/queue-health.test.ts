import { describe, expect, it } from 'vitest';
import { STALL_AFTER_MINUTES, queueHealth } from './queue-health';

const now = new Date('2026-09-16T12:00:00.000Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

describe('queueHealth', () => {
  it('is quiet when nothing is waiting', () => {
    expect(queueHealth({ oldestQueuedAt: null, lastAutomaticSendAt: minutesAgo(600) }, now)).toEqual(
      { state: 'ok', waitingMinutes: 0, silentMinutes: null },
    );
  });

  it('calls a full queue with no service "manual" rather than broken', () => {
    const health = queueHealth(
      { oldestQueuedAt: minutesAgo(5000), lastAutomaticSendAt: null },
      now,
    );
    // This is how the screen looks in a clinic that sends by hand. A red banner
    // here every day is a banner nobody reads on the third day.
    expect(health.state).toBe('manual');
    expect(health.silentMinutes).toBeNull();
  });

  it('says nothing while the service is keeping up', () => {
    const health = queueHealth(
      { oldestQueuedAt: minutesAgo(10), lastAutomaticSendAt: minutesAgo(5) },
      now,
    );
    expect(health.state).toBe('ok');
  });

  it('raises the alarm when messages have waited and nothing has gone out', () => {
    const health = queueHealth(
      {
        oldestQueuedAt: minutesAgo(STALL_AFTER_MINUTES + 60),
        lastAutomaticSendAt: minutesAgo(STALL_AFTER_MINUTES + 30),
      },
      now,
    );
    expect(health.state).toBe('stalled');
    expect(health.waitingMinutes).toBe(STALL_AFTER_MINUTES + 60);
    expect(health.silentMinutes).toBe(STALL_AFTER_MINUTES + 30);
  });

  it('does not fire on an old message when the service is plainly alive', () => {
    // A message that has sat for a day because it was skipped or is scheduled
    // ahead, while everything else goes out on time.
    const health = queueHealth(
      { oldestQueuedAt: minutesAgo(2000), lastAutomaticSendAt: minutesAgo(3) },
      now,
    );
    expect(health.state).toBe('ok');
  });

  it('does not fire on a quiet night with a fresh queue', () => {
    const health = queueHealth(
      { oldestQueuedAt: minutesAgo(2), lastAutomaticSendAt: minutesAgo(900) },
      now,
    );
    expect(health.state).toBe('ok');
  });

  it('takes the threshold it is given, so the rule can be tuned in one place', () => {
    const input = { oldestQueuedAt: minutesAgo(40), lastAutomaticSendAt: minutesAgo(40) };
    expect(queueHealth(input, now, 30).state).toBe('stalled');
    expect(queueHealth(input, now, 60).state).toBe('ok');
  });

  it('never reports a negative wait when a clock runs backwards', () => {
    const health = queueHealth(
      { oldestQueuedAt: minutesAgo(-30), lastAutomaticSendAt: minutesAgo(-30) },
      now,
    );
    expect(health.waitingMinutes).toBe(0);
    expect(health.silentMinutes).toBe(0);
  });
});
