import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_DEFAULT_TEXTS,
  AUTOMATION_KINDS,
  AUTOMATION_PLACEHOLDERS,
  MARKETING_AUTOMATION_KINDS,
  automationDefault,
  fillAutomationTemplate,
} from '@clinic/domain';

// The database renders the messages the hourly job queues; the app previews
// them. Two copies of the same words, which is a drift waiting to happen —
// so the migration is read here and every default is looked up in it.
const MIGRATION = readFileSync(
  new URL('../../../supabase/migrations/20260915090000_messaging_automations.sql', import.meta.url),
  'utf8',
);

describe('automated message wording', () => {
  it('keeps every built-in text identical to the migration that renders it', () => {
    for (const text of AUTOMATION_DEFAULT_TEXTS) {
      expect(MIGRATION, text).toContain(text);
    }
  });

  it('fills the blanks and leaves an unknown placeholder as typed', () => {
    const text = fillAutomationTemplate('treatment_followup', 'שלום {name}, {שם}, מ-{clinic}', 'he', {
      name: 'דנה',
      clinic: 'הקליניקה',
    });
    expect(text).toBe('שלום דנה, {שם}, מ-הקליניקה');
  });

  it('uses the built-in text when the clinic wrote nothing', () => {
    const text = fillAutomationTemplate('birthday', '   ', 'en', { name: 'Dana', clinic: 'Herbs', unsubscribe: 'https://x/u' });
    expect(text.startsWith('Happy birthday Dana, from all of us at Herbs!')).toBe(true);
  });

  it('ends every marketing kind with the removal line, once', () => {
    for (const kind of MARKETING_AUTOMATION_KINDS) {
      const text = fillAutomationTemplate(kind, null, 'he', {
        name: 'דנה',
        clinic: 'הקליניקה',
        link: 'https://g/r',
        booking_link: 'https://b/k',
        unsubscribe: 'https://x/u',
      });
      expect(text.endsWith('להסרה מהודעות כאלה: https://x/u')).toBe(true);
      expect(text.split('https://x/u')).toHaveLength(2);
    }
    const own = fillAutomationTemplate('birthday', 'מזל טוב {name}! הסרה: {unsubscribe}', 'he', {
      name: 'דנה',
      clinic: 'x',
      unsubscribe: 'https://x/u',
    });
    expect(own).toBe('מזל טוב דנה! הסרה: https://x/u');
  });

  it('never adds the removal line to a service message', () => {
    const text = fillAutomationTemplate('treatment_followup', null, 'he', { name: 'דנה', clinic: 'הקליניקה' });
    expect(text).not.toContain('להסרה');
    expect(text).not.toContain('{');
  });

  it('offers the nudge with the booking link only when there is one', () => {
    expect(automationDefault('inactive_reengage', 'he', { hasBookingLink: true })).toContain('{booking_link}');
    expect(automationDefault('inactive_reengage', 'he')).not.toContain('{booking_link}');
    const without = fillAutomationTemplate('inactive_reengage', null, 'en', { name: 'Dana', clinic: 'Herbs', unsubscribe: 'u' });
    expect(without).not.toContain('To book');
  });

  it('lists placeholders in the order a WhatsApp template takes its variables', () => {
    for (const kind of AUTOMATION_KINDS) {
      expect(AUTOMATION_PLACEHOLDERS[kind][0]).toBe('name');
      expect(AUTOMATION_PLACEHOLDERS[kind][1]).toBe('clinic');
    }
    expect(AUTOMATION_PLACEHOLDERS.review_request).toEqual(['name', 'clinic', 'link', 'unsubscribe']);
  });
});
