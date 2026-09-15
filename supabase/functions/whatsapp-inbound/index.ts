// What WhatsApp sends us.
//
// The sending service (019) posts here whenever a patient writes to the
// clinic's line, and whenever one of the clinic's messages is sent,
// delivered, read or refused. The function checks the secret the address
// carries, tells the three kinds of event apart, and hands the object to
// the database, which makes it into rows under the clinic whose line it
// was sent to (whatsapp_receive / whatsapp_ack, migration 55). A message
// the patient answered with a tap — "אגיע" — may have queued a line back;
// the sender is woken so it goes now rather than at the next five minutes.
//
// Why here and not in the web app: writing a patient's message needs to
// find the clinic by its line and write under it with no session, which
// only the service role may do — and the web app, by design, holds none.
//
// Two dialects are accepted: 019's push, and the plain shape a practitioner's
// own ManyChat flow or Make scenario posts (`event: "message"` / `"status"`,
// see DEPLOY.md), folded into the first by _shared/messaging/inbound.ts.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   WHATSAPP_INBOUND_SECRET — the address given to the service ends in
//                             `?key=<this>`; without it, nothing is accepted
//   DISPATCH_SECRET         — to wake the sender for a reply that was queued
//
// Nothing about a patient is logged. The service is answered 200 for every
// event it sent well-formed, including ones the database dropped (an
// unknown line, a retry of a message already written): a non-200 makes it
// retry, and there is nothing a retry would fix.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { parsePush } from '../_shared/messaging/inbound.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('WHATSAPP_INBOUND_SECRET');
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? request.headers.get('x-inbound-key');
  if (!secret || key !== secret) return new Response('Forbidden', { status: 403 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: 'not_json' }, { status: 400 });
  }
  // A practitioner's own scenario may not know the clinic's line; the
  // address can carry it (`&to=972…`) for the messages it forwards.
  const event = parsePush(raw, { fallbackTo: url.searchParams.get('to') });
  if (event.hook === 'ignored') return Response.json({ ok: false, reason: event.reason });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc(event.hook === 'new' ? 'whatsapp_receive' : 'whatsapp_ack', {
    p: event.payload,
  });
  if (error) return Response.json({ ok: false, reason: 'write_failed' }, { status: 500 });

  // A tap on the reminder's button queued an acknowledgement: send it now.
  const result = (data ?? {}) as { ok?: boolean; appointment?: string | null };
  const dispatchSecret = Deno.env.get('DISPATCH_SECRET');
  if (event.hook === 'new' && result.appointment && dispatchSecret) {
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/dispatch-messages`, {
        method: 'POST',
        headers: { 'x-dispatch-secret': dispatchSecret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ only: 'whatsapp' }),
      });
    } catch {
      // The schedule sends it within five minutes either way.
    }
  }

  return Response.json({ ok: result.ok !== false });
});
