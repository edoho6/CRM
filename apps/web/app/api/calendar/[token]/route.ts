import { tryCreateServerSupabase } from '@clinic/db/server';
import { buildIcs, type IcsEvent } from '@/lib/ics';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FeedRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  patient_name: string;
  patient_phone: string | null;
  type_name_he: string | null;
  type_name_en: string | null;
  room_name: string | null;
  notes: string | null;
  updated_at: string;
  clinic_name: string;
}

/**
 * The diary as an iCalendar feed, for Google Calendar and the iPhone.
 *
 * `GET /api/calendar/<token>` — the token is the whole credential. Both
 * subscribers poll this address on their own schedule (Google every several
 * hours, Apple as often as the device is set to), so it has to be cheap,
 * cacheable for a few minutes, and must never require a cookie.
 *
 * Hebrew first in the event title, because that is what the phone shows in
 * the lock-screen notification. The phone number goes in the description so
 * the calendar entry itself is a way to ring the patient.
 *
 * Guesses are counted per caller address, not per token: a token is 122
 * random bits and nobody is walking that space, but a flood of wrong ones
 * from one place is still a flood.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!UUID.test(token)) return new Response('Not found', { status: 404 });

  const caller = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = checkRateLimit(`ics:${caller}`);
  if (!limit.allowed) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return new Response('Not configured', { status: 503 });

  const { data, error } = await supabase.rpc('calendar_feed_events', { p_token: token });
  if (error) {
    // The function raises for a token it does not know, so a regenerated
    // address stops working loudly rather than serving an empty diary.
    if (error.code === 'P0002' || error.message.includes('unknown_feed_token')) {
      recordFailure(`ics:${caller}`);
      return new Response('Not found', { status: 404 });
    }
    return new Response('Error', { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as FeedRow[];
  const calendarName = rows[0]?.clinic_name ?? 'Herbalist';

  const events: IcsEvent[] = rows.map((row) => {
    const type = row.type_name_he?.trim() || row.type_name_en?.trim() || '';
    const description = [row.patient_phone, row.notes].filter(Boolean).join('\n');
    return {
      uid: `${row.id}@herbalist`,
      start: new Date(row.start_at),
      end: new Date(row.end_at),
      summary: type ? `${row.patient_name} · ${type}` : row.patient_name,
      description: description || undefined,
      location: row.room_name ?? undefined,
      updatedAt: new Date(row.updated_at),
    };
  });

  return new Response(buildIcs(calendarName, events), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="diary.ics"',
      // Private to whoever holds the URL, and stale after five minutes.
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
