/**
 * iCalendar (RFC 5545) output, the subset a diary subscription needs.
 *
 * Written by hand rather than pulled in as a dependency: the whole format for
 * our purpose is a header, one VEVENT per booking, and three rules that every
 * library gets wrong in a different way — escaping, line folding at 75 octets,
 * and UTC timestamps. Thirty lines here are easier to be sure of than a
 * package whose Hebrew handling nobody has checked.
 *
 * In the domain package because three routes write it: the staff diary feed,
 * a patient's own appointment in the portal, and the public confirmation
 * page's "add to calendar".
 */

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  /** Feeds carry the last change, so a subscriber updates a moved booking. */
  updatedAt?: Date;
}

/** `20260910T073000Z` — always UTC, so every subscriber agrees on the hour. */
export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Backslash, semicolon and comma are structural; newlines become `\n`. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Lines longer than 75 octets are continued on the next line with a single
 * leading space. Octets, not characters: Hebrew is two bytes a letter, so the
 * fold is measured on the UTF-8 encoding, never inside a multi-byte sequence.
 */
export function icsFold(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  // The first line has 75 octets; continuation lines carry the leading space
  // and so hold 74.
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      out.push(current);
      current = ' ';
      currentBytes = 1;
      limit = 75;
    }
    current += char;
    currentBytes += size;
  }
  out.push(current);
  return out.join('\r\n');
}

export function buildIcs(calendarName: string, events: IcsEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Herbalist//Clinic Diary//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    // Ask subscribers to refresh often. Google ignores it; Apple honours it.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  const stamp = icsDate(new Date());

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${icsEscape(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    if (event.updatedAt) lines.push(`LAST-MODIFIED:${icsDate(event.updatedAt)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** The response headers for one appointment offered as a file to add to a calendar. */
export const ICS_DOWNLOAD_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'attachment; filename="appointment.ics"',
  'Cache-Control': 'private, no-store',
} as const;
