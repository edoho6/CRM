import { tryCreateServerSupabase } from '@clinic/db';
import { buildIcs, ICS_DOWNLOAD_HEADERS } from '@clinic/domain/ics';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Row {
  id: string;
  start_at: string;
  end_at: string;
  location: string | null;
  updated_at: string;
  appointment_type: { name_he: string; name_en: string } | null;
  practitioner: { full_name: string | null } | null;
}

/**
 * One of the patient's own appointments as a calendar file.
 *
 * Read through the session's own client, so Row Level Security decides
 * whether this appointment is theirs; there is no token and nothing to
 * guess. A phone opens the file straight into its calendar.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID.test(id)) return new Response('Not found', { status: 404 });

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return new Response('Not configured', { status: 503 });

  const { data } = await supabase
    .from('appointments')
    .select(
      'id, start_at, end_at, location, updated_at, appointment_type:appointment_types(name_he, name_en), practitioner:profiles(full_name)',
    )
    .eq('id', id)
    .maybeSingle<Row>();
  if (!data) return new Response('Not found', { status: 404 });

  const type = data.appointment_type?.name_he?.trim() || data.appointment_type?.name_en?.trim() || '';
  const summary = [type, data.practitioner?.full_name].filter(Boolean).join(' · ') || 'Appointment';

  const body = buildIcs('Herbalist', [
    {
      uid: `${data.id}@herbalist`,
      start: new Date(data.start_at),
      end: new Date(data.end_at),
      summary,
      location: data.location ?? undefined,
      updatedAt: new Date(data.updated_at),
    },
  ]);
  return new Response(body, { headers: ICS_DOWNLOAD_HEADERS });
}
