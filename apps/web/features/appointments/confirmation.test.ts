import { describe, expect, it } from 'vitest';
import { confirmationState, fillReminderTemplate } from './confirmation';

describe('confirmationState', () => {
  it('is none before anything has happened', () => {
    expect(
      confirmationState({ status: 'scheduled', reminder_sent_at: null, confirmation_response: null }),
    ).toBe('none');
  });

  it('is sent once a reminder went out and nobody answered', () => {
    expect(
      confirmationState({
        status: 'scheduled',
        reminder_sent_at: '2026-09-09T10:00:00Z',
        confirmation_response: null,
      }),
    ).toBe('sent');
  });

  it('is confirmed on a tap of the link', () => {
    expect(
      confirmationState({
        status: 'scheduled',
        reminder_sent_at: '2026-09-09T10:00:00Z',
        confirmation_response: 'confirmed',
      }),
    ).toBe('confirmed');
  });

  it('is confirmed when the desk marked the booking confirmed by phone', () => {
    expect(
      confirmationState({ status: 'confirmed', reminder_sent_at: null, confirmation_response: null }),
    ).toBe('confirmed');
  });

  it('a decline wins over an earlier confirmed status', () => {
    expect(
      confirmationState({
        status: 'confirmed',
        reminder_sent_at: '2026-09-09T10:00:00Z',
        confirmation_response: 'declined',
      }),
    ).toBe('declined');
  });
});

describe('fillReminderTemplate', () => {
  const facts = {
    name: 'דנה',
    date: '10/09/2026',
    time: '09:30',
    clinic: 'הרבליסט',
    link: 'https://example.test/he/confirm/abc',
  };

  it('fills every known placeholder', () => {
    expect(fillReminderTemplate('{name} {date} {time} {clinic} {link}', facts)).toBe(
      'דנה 10/09/2026 09:30 הרבליסט https://example.test/he/confirm/abc',
    );
  });

  it('fills a placeholder used twice', () => {
    expect(fillReminderTemplate('{name}, {name}', facts)).toBe('דנה, דנה');
  });

  it('leaves an unknown placeholder as typed', () => {
    expect(fillReminderTemplate('שלום {שם}', facts)).toBe('שלום {שם}');
  });
});
