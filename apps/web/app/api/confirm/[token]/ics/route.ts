import { tryCreateServerSupabase } from '@clinic/db/server';
import { buildIcs, ICS_DOWNLOAD_HEADERS } from '@clinic/domain/ics';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TokenRow {
  start_at: string;
  end_at: string;
  status: string;
  clinic_name: string;
  clinic_address: string | null;
  practitioner_name: string | null;
  type_name_he: string | null;
  type_name_en: string | null;
  room_name: string | null;
}

/**
 * The appointment behind a reminder link, as a calendar file.
 *
 * The same token-checked function the confirmation page reads through, so
 * the file says exactly what the page says and nothing else — and the same
 * per-caller rate limit as the diary feed, because a token in a URL is a
 * credential and a flood of wrong ones from one address is still a flood.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!UUID.test(token)) return new Response('Not found', { status: 404 });

  const caller = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = checkRateLimit(`confirm-ics:${caller}`);
  if (!limit.allowed) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return new Response('Not configured', { status: 503 });

  const { data } = await supabase.rpc('appointment_by_token', { p_token: token });
  const row = (Array.isArray(data) ? data[0] : null) as TokenRow | undefined;
  if (!row || row.status === 'cancelled') {
    recordFailure(`confirm-ics:${caller}`);
    return new Response('Not found', { status: 404 });
  }

  const type = row.type_name_he?.trim() || row.type_name_en?.trim() || '';
  const summary = [type || row.clinic_name, row.clinic_name !== type ? row.clinic_name : null]
    .filter(Boolean)
    .join(' · ');
  const description = [row.practitioner_name, row.room_name].filter(Boolean).join(' · ');

  const body = buildIcs(row.clinic_name, [
    {
      uid: `${token}@herbalist`,
      start: new Date(row.start_at),
      end: new Date(row.end_at),
      summary,
      description: description || undefined,
      location: row.clinic_address ?? undefined,
    },
  ]);
  return new Response(body, { headers: ICS_DOWNLOAD_HEADERS });
}
