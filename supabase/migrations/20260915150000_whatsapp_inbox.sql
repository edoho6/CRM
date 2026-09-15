-- ============================================================================
-- 55 · WhatsApp inside the system: the conversations, what comes in, what
--      goes out, and the one tap that confirms an appointment
-- ============================================================================
-- Until now WhatsApp was a door out of the system: a reminder went, and the
-- reply — "אגיע", a question, a photo — landed on the practitioner's phone,
-- outside the file. The sending service (019) can push what patients write
-- to an address of ours, and this migration gives that push somewhere to
-- land and the staff somewhere to answer from:
--
--   whatsapp_conversations — one per clinic and contact: the number (or,
--                            from Meta's username era, an opaque id), the
--                            name WhatsApp shows, the patient whose file it
--                            is when exactly one carries the number, how
--                            many messages wait unread, and when the
--                            patient last wrote — because a message the
--                            clinic starts more than a day after that must
--                            be a template Meta approved
--   whatsapp_messages      — every message either way: what the patient
--                            sent (text, a media link the service keeps a
--                            week, a button tap), and what the clinic sent
--                            with the service's own acknowledgements
--                            (sent, delivered, read) as they arrive
--   whatsapp_receive       — the push, made into rows: dedupe on the
--                            service's id, the conversation, the message,
--                            the patient match, and the tap on "אגיע" /
--                            "לא אגיע" that answers the next appointment
--                            through the same function the reminder link
--                            uses, acknowledged with a line back
--   whatsapp_ack           — the service's delivery reports and system
--                            notices, onto the message they concern
--   whatsapp_note_outbound — an automated send (a reminder, a greeting)
--                            written into the thread, so the conversation
--                            shows everything the clinic said
--   whatsapp_claim_outbound — how the sender takes what staff wrote,
--                            atomically, so two runs never send one twice
--   whatsapp_open_for_patient — a conversation started from the file
--
-- A patient's message is medical-adjacent and stays in this database under
-- the clinic's RLS like everything else about them. Nothing of it is written
-- to any log. The functions the service calls run as the owner and are
-- granted to the service role alone; staff read and write through policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The clinic's own line, and the template that opens a conversation
-- ---------------------------------------------------------------------------
-- The number as verified with the sending service, international without a
-- plus. It is what the push carries as `to`, and what a send goes out from.
alter table public.clinics
  add column if not exists whatsapp_number text
    check (whatsapp_number is null or whatsapp_number ~ '^972\d{8,9}$');

create unique index if not exists clinics_whatsapp_number_idx
  on public.clinics (whatsapp_number) where whatsapp_number is not null;

comment on column public.clinics.whatsapp_number is
  'The clinic''s WhatsApp line as verified with the sending service (972…). Incoming pushes are matched to the clinic by it; sends go out from it.';

-- A message the clinic starts more than a day after the patient last wrote
-- must be an approved template; this one says "we have something for you,
-- reply here" and opens the day-long window in which free text may follow.
alter table public.clinic_automations drop constraint if exists clinic_automations_kind_check;
alter table public.clinic_automations
  add constraint clinic_automations_kind_check check (kind in (
    'appointment_reminder', 'treatment_followup', 'birthday', 'inactive_reengage', 'review_request',
    'conversation_opener'
  ));

-- ---------------------------------------------------------------------------
-- A stored phone, as WhatsApp addresses it
-- ---------------------------------------------------------------------------
-- "050-123-4567", "+972 50 123 4567", "0501234567" are one line: 972501234567.
-- Null for anything that is not an Israeli number — the service cannot send
-- there, and a push from abroad keeps its own digits as the key instead.
create or replace function public.whatsapp_key(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if d = '' then return null; end if;
  if d like '00972%' then d := '0' || substr(d, 6);
  elsif d like '972%' then d := '0' || substr(d, 4);
  elsif d ~ '^5\d{8}$' then d := '0' || d;
  end if;
  if d !~ '^0[2-9]\d{7,8}$' then return null; end if;
  return '972' || substr(d, 2);
end;
$$;

-- ---------------------------------------------------------------------------
-- The conversations
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  -- The other side: the number as WhatsApp writes it (972…), or the opaque
  -- id Meta sends for a person who hides their number.
  contact_key text not null,
  phone text,
  -- The name WhatsApp shows for them — theirs to set, not a fact about the file.
  contact_name text,
  patient_id uuid references public.patients(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  -- When the patient last wrote: free text may go for a day after it.
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, contact_key)
);

create index if not exists whatsapp_conversations_clinic_idx
  on public.whatsapp_conversations (clinic_id, last_message_at desc);
create index if not exists whatsapp_conversations_patient_idx
  on public.whatsapp_conversations (patient_id) where patient_id is not null;

drop trigger if exists whatsapp_conversations_set_updated_at on public.whatsapp_conversations;
create trigger whatsapp_conversations_set_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();

alter table public.whatsapp_conversations enable row level security;

drop policy if exists whatsapp_conversations_member_select on public.whatsapp_conversations;
create policy whatsapp_conversations_member_select on public.whatsapp_conversations
  for select using (public.is_clinic_member(clinic_id));
drop policy if exists whatsapp_conversations_member_insert on public.whatsapp_conversations;
create policy whatsapp_conversations_member_insert on public.whatsapp_conversations
  for insert with check (public.is_clinic_member(clinic_id));
drop policy if exists whatsapp_conversations_member_update on public.whatsapp_conversations;
create policy whatsapp_conversations_member_update on public.whatsapp_conversations
  for update using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.whatsapp_conversations is
  'One WhatsApp thread per clinic and contact. Written by the push (whatsapp_receive), by the sender, and by staff; never deleted — closed instead.';

-- ---------------------------------------------------------------------------
-- The messages
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  kind text not null default 'text' check (kind in (
    'text', 'image', 'audio', 'video', 'document', 'location', 'button', 'list',
    'reaction', 'contacts', 'order', 'template', 'other'
  )),
  body text,
  -- The service's link to a file the patient sent; it keeps files a week.
  media_url text,
  provider_message_id text,
  -- For a message sent as an approved template: which, and its variables.
  template_id text,
  params jsonb,
  status text not null default 'queued' check (status in (
    'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received'
  )),
  error_code text,
  -- Who wrote it, for a message the clinic sent by hand.
  sent_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  constraint whatsapp_messages_direction_status check (
    (direction = 'in' and status = 'received') or (direction = 'out' and status <> 'received')
  )
);

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, created_at);
create unique index if not exists whatsapp_messages_provider_idx
  on public.whatsapp_messages (clinic_id, provider_message_id) where provider_message_id is not null;
create index if not exists whatsapp_messages_queue_idx
  on public.whatsapp_messages (created_at) where status in ('queued', 'sending');

alter table public.whatsapp_messages enable row level security;

-- Staff read the thread and write outbound; what comes in is written only
-- by the push function, as the owner.
drop policy if exists whatsapp_messages_member_select on public.whatsapp_messages;
create policy whatsapp_messages_member_select on public.whatsapp_messages
  for select using (public.is_clinic_member(clinic_id));
drop policy if exists whatsapp_messages_member_insert on public.whatsapp_messages;
create policy whatsapp_messages_member_insert on public.whatsapp_messages
  for insert with check (public.is_clinic_member(clinic_id) and direction = 'out');
drop policy if exists whatsapp_messages_member_update on public.whatsapp_messages;
create policy whatsapp_messages_member_update on public.whatsapp_messages
  for update using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id) and direction = 'out');

comment on table public.whatsapp_messages is
  'Every WhatsApp message either way. Inbound rows come from the push (status received); outbound rows are queued by staff or by a function and marked by the sender and by the service''s acknowledgements.';

-- Every new message tells its conversation: the moment, a preview, and —
-- for one from the patient — one more unread and the window reopened.
create or replace function public.whatsapp_touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.whatsapp_conversations c
     set last_message_at = greatest(c.last_message_at, new.created_at),
         last_message_preview = left(coalesce(new.body, '[' || new.kind || ']'), 120),
         last_inbound_at = case when new.direction = 'in'
           then greatest(coalesce(c.last_inbound_at, new.created_at), new.created_at)
           else c.last_inbound_at end,
         unread_count = case when new.direction = 'in' then c.unread_count + 1 else c.unread_count end,
         status = case when new.direction = 'in' then 'open' else c.status end
   where c.id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists whatsapp_messages_touch on public.whatsapp_messages;
create trigger whatsapp_messages_touch
  after insert on public.whatsapp_messages
  for each row execute function public.whatsapp_touch_conversation();

-- ---------------------------------------------------------------------------
-- "אגיע" / "לא אגיע": a tap on the reminder's button, or the same words typed
-- ---------------------------------------------------------------------------
-- Exact matches only, after trimming punctuation: a sentence that happens to
-- contain "לא" is not an answer, a button's title is.
create or replace function public.whatsapp_reply_intent(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  t text := lower(coalesce(p_text, ''));
begin
  t := regexp_replace(t, '[.!?,;:"()\-–—''’]', '', 'g');
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  if t in ('אגיע', 'מגיע', 'מגיעה', 'מאשר', 'מאשרת', 'מאשר/ת', 'מאשר הגעה', 'מאשרת הגעה', 'אישור', 'אישור הגעה',
           'כן', 'כן אגיע', 'yes', 'confirm', 'confirmed', 'i will come', 'ill be there', 'i will be there') then
    return 'confirmed';
  end if;
  if t in ('לא אגיע', 'לא מגיע', 'לא מגיעה', 'לא אוכל להגיע', 'ביטול', 'לבטל', 'לא',
           'no', 'cancel', 'decline', 'i cant make it', 'cant make it') then
    return 'declined';
  end if;
  return null;
end;
$$;

-- The line back, in the patient's language.
create or replace function public.render_whatsapp_ack(p_intent text, p_locale text, p_date text, p_time text)
returns text
language sql
immutable
as $$
  select case
    when p_intent = 'confirmed' and p_locale = 'en'
      then 'Thank you! Your appointment on ' || p_date || ' at ' || p_time || ' is confirmed.'
    when p_intent = 'confirmed'
      then 'תודה! ההגעה לתור ב-' || p_date || ' בשעה ' || p_time || ' אושרה.'
    when p_locale = 'en'
      then 'Thanks for letting us know. Your appointment on ' || p_date || ' at ' || p_time || ' is marked as not attending; we would be glad to find another time.'
    else 'תודה על העדכון. התור ב-' || p_date || ' בשעה ' || p_time || ' סומן כלא מגיע/ה. נשמח לתאם מועד אחר.'
  end;
$$;

-- ---------------------------------------------------------------------------
-- The push, made into rows
-- ---------------------------------------------------------------------------
-- Owner-only, called by the inbound function with the service's payload as
-- it came. The clinic is the one whose line the message was sent to; a
-- push for a number nobody here owns is answered and dropped. The same
-- message pushed twice (the service retries a slow answer) is one row.
create or replace function public.whatsapp_receive(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to text := regexp_replace(coalesce(p->>'to', ''), '\D', '', 'g');
  v_from text := btrim(coalesce(p->>'from', ''));
  v_unique text := nullif(p->>'unique', '');
  v_clinic public.clinics%rowtype;
  v_key text;
  v_phone text;
  v_kind text;
  v_body text;
  v_media text;
  v_at timestamptz;
  v_patient uuid;
  v_conv uuid;
  v_msg uuid;
  v_intent text;
  v_appt record;
  v_locale text;
begin
  if coalesce(p->>'hook', '') <> 'new' then
    return jsonb_build_object('ok', false, 'reason', 'not_new');
  end if;
  select * into v_clinic from public.clinics c where c.whatsapp_number = v_to;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_number');
  end if;
  if v_from = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_sender');
  end if;

  -- A phone, folded to the one shape; anything else (Meta's "IL.1234…") kept as is.
  if v_from ~ '^\+?\d+$' then
    v_phone := coalesce(public.whatsapp_key(v_from), regexp_replace(v_from, '\D', '', 'g'));
    v_key := v_phone;
  else
    v_phone := null;
    v_key := v_from;
  end if;

  v_kind := case
    when p->>'type' in ('text', 'image', 'audio', 'video', 'document', 'location', 'button', 'list', 'reaction', 'contacts', 'order') then p->>'type'
    when p->>'type' = 'ptt' then 'audio'
    else 'other' end;
  v_body := coalesce(nullif(p->>'body', ''), nullif(p->>'caption', ''));
  v_media := case when jsonb_typeof(p->'media') = 'string' and (p->>'media') ~ '^https?://' then p->>'media' else null end;
  v_at := case when (p->>'timestamp') ~ '^\d+$' then to_timestamp((p->>'timestamp')::bigint) else now() end;

  if v_unique is not null and exists (
    select 1 from public.whatsapp_messages m where m.clinic_id = v_clinic.id and m.provider_message_id = v_unique
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- The file, when exactly one carries this number. Two (a parent and a
  -- child on one phone) is a choice for a person, and the thread waits unlinked.
  if v_phone is not null then
    select case when count(*) = 1 then (array_agg(pt.id))[1] end into v_patient
      from public.patients pt
     where pt.clinic_id = v_clinic.id and public.whatsapp_key(pt.phone) = v_phone;
  end if;

  insert into public.whatsapp_conversations (clinic_id, contact_key, phone, contact_name, patient_id, last_message_at, status)
  values (v_clinic.id, v_key, v_phone, nullif(p->>'senderName', ''), v_patient, v_at, 'open')
  on conflict (clinic_id, contact_key) do update
    set phone = coalesce(whatsapp_conversations.phone, excluded.phone),
        contact_name = coalesce(excluded.contact_name, whatsapp_conversations.contact_name),
        patient_id = coalesce(whatsapp_conversations.patient_id, excluded.patient_id),
        status = 'open'
  returning id, patient_id into v_conv, v_patient;

  insert into public.whatsapp_messages
    (clinic_id, conversation_id, direction, kind, body, media_url, provider_message_id, status, created_at)
  values
    (v_clinic.id, v_conv, 'in', v_kind, v_body, v_media, v_unique, 'received', v_at)
  returning id into v_msg;

  -- One tap answers the next appointment, through the same function the
  -- reminder link uses; a line goes back so the patient knows it landed.
  v_intent := case when v_kind in ('text', 'button', 'list') then public.whatsapp_reply_intent(v_body) end;
  if v_intent is not null and v_patient is not null then
    select a.id, a.confirmation_token, a.start_at into v_appt
      from public.appointments a
     where a.clinic_id = v_clinic.id
       and a.patient_id = v_patient
       and a.status in ('scheduled', 'confirmed')
       and a.start_at > now()
     order by a.start_at
     limit 1;
    if found then
      perform public.respond_to_appointment(v_appt.confirmation_token, v_intent);
      select coalesce(pt.preferred_locale, v_clinic.default_locale) into v_locale
        from public.patients pt where pt.id = v_patient;
      insert into public.whatsapp_messages (clinic_id, conversation_id, direction, kind, body, status)
      values (v_clinic.id, v_conv, 'out', 'text',
              public.render_whatsapp_ack(v_intent, coalesce(v_locale, 'he'),
                to_char(v_appt.start_at at time zone v_clinic.timezone, 'DD/MM/YYYY'),
                to_char(v_appt.start_at at time zone v_clinic.timezone, 'HH24:MI')),
              'queued');
    else
      v_intent := null;
    end if;
  else
    v_intent := null;
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv, 'message_id', v_msg,
                            'patient_id', v_patient, 'appointment', v_intent);
end;
$$;

revoke all on function public.whatsapp_receive(jsonb) from public;
revoke execute on function public.whatsapp_receive(jsonb) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the service says about a message it carried
-- ---------------------------------------------------------------------------
-- `update`: one grey tick, two, two blue — or none, for a message that
-- could not be delivered. `system`: a reason the send failed after the
-- service had accepted it. Never downgraded: a message read stays read.
create or replace function public.whatsapp_ack(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hook text := coalesce(p->>'hook', '');
  v_unique text := nullif(p->>'unique', '');
  v_ack integer;
  v_code integer;
  v_status text;
  v_error text;
  v_count integer := 0;
begin
  if v_unique is null then
    return jsonb_build_object('ok', false, 'reason', 'no_id');
  end if;

  if v_hook = 'update' then
    if (p->>'ack') !~ '^\d+$' then
      return jsonb_build_object('ok', false, 'reason', 'bad_ack');
    end if;
    v_ack := (p->>'ack')::integer;
    v_status := case v_ack when 0 then 'failed' when 1 then 'sent' when 2 then 'delivered' when 3 then 'read' end;
    if v_status is null then
      return jsonb_build_object('ok', false, 'reason', 'bad_ack');
    end if;

    update public.whatsapp_messages m
       set status = v_status,
           error_code = case when v_status = 'failed' then 'not_delivered' else null end,
           sent_at = coalesce(m.sent_at, case when v_status <> 'failed' then now() end),
           delivered_at = coalesce(m.delivered_at, case when v_status in ('delivered', 'read') then now() end),
           read_at = coalesce(m.read_at, case when v_status = 'read' then now() end)
     where m.provider_message_id = v_unique
       and m.direction = 'out'
       and case v_status
             when 'failed' then m.status not in ('delivered', 'read', 'failed')
             when 'sent' then m.status in ('queued', 'sending')
             when 'delivered' then m.status in ('queued', 'sending', 'sent')
             else m.status <> 'read'
           end;
    get diagnostics v_count = row_count;

    -- A reminder the service could not deliver comes back to the Messages
    -- screen for a person to send another way.
    if v_status = 'failed' then
      update public.message_log
         set status = 'failed', error_code = 'not_delivered'
       where provider_message_id = v_unique and status = 'sent';
    end if;
    return jsonb_build_object('ok', true, 'updated', v_count, 'status', v_status);
  end if;

  if v_hook = 'system' then
    v_code := case when (p->>'messageUpdate') ~ '^\d+$' then (p->>'messageUpdate')::integer end;
    v_error := case v_code
      when 2 then 'no_credit'
      when 5 then 'daily_limit'
      when 7 then 'outdated_app'
      when 8 then 'needs_template'
      when 12 then 'template_not_approved'
      when 16 then 'rate_limit'
      else 'provider_' || coalesce(v_code::text, 'error') end;
    update public.whatsapp_messages m
       set status = 'failed', error_code = v_error
     where m.provider_message_id = v_unique
       and m.direction = 'out'
       and m.status not in ('delivered', 'read');
    get diagnostics v_count = row_count;
    update public.message_log
       set status = 'failed', error_code = v_error
     where provider_message_id = v_unique and status = 'sent';
    return jsonb_build_object('ok', true, 'updated', v_count, 'error', v_error);
  end if;

  return jsonb_build_object('ok', false, 'reason', 'unknown_hook');
end;
$$;

revoke all on function public.whatsapp_ack(jsonb) from public;
revoke execute on function public.whatsapp_ack(jsonb) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- An automated send, written into the thread
-- ---------------------------------------------------------------------------
-- A reminder or a greeting the sender just sent on WhatsApp belongs in the
-- conversation like anything else the clinic said; the sender calls this
-- with the outcome. Null when the number is not one WhatsApp can address.
create or replace function public.whatsapp_note_outbound(
  p_clinic uuid,
  p_phone text,
  p_kind text,
  p_body text,
  p_template_id text,
  p_params jsonb,
  p_provider_id text,
  p_status text,
  p_error text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.whatsapp_key(p_phone);
  v_conv uuid;
  v_msg uuid;
begin
  if v_key is null or p_status not in ('sent', 'failed') then return null; end if;
  insert into public.whatsapp_conversations (clinic_id, contact_key, phone)
  values (p_clinic, v_key, v_key)
  on conflict (clinic_id, contact_key) do update
    set phone = coalesce(whatsapp_conversations.phone, excluded.phone)
  returning id into v_conv;

  insert into public.whatsapp_messages
    (clinic_id, conversation_id, direction, kind, body, template_id, params, provider_message_id, status, error_code, sent_at)
  values
    (p_clinic, v_conv, 'out', coalesce(nullif(p_kind, ''), 'template'), p_body, p_template_id, p_params, p_provider_id,
     p_status, p_error, case when p_status = 'sent' then now() end)
  returning id into v_msg;
  return v_msg;
end;
$$;

revoke all on function public.whatsapp_note_outbound(uuid, text, text, text, text, jsonb, text, text, text) from public;
revoke execute on function public.whatsapp_note_outbound(uuid, text, text, text, text, jsonb, text, text, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the sender takes, atomically
-- ---------------------------------------------------------------------------
-- The sender is woken by the schedule, by a staff message and by the push;
-- two wakings may overlap. Each takes its rows by marking them `sending`
-- under a lock, so a row is sent once; a row left `sending` for a quarter
-- of an hour (a run that died) is offered again.
create or replace function public.whatsapp_claim_outbound(p_limit integer default 50)
returns setof public.whatsapp_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_messages
     set status = 'queued', claimed_at = null
   where status = 'sending' and claimed_at < now() - interval '15 minutes';

  return query
    update public.whatsapp_messages m
       set status = 'sending', claimed_at = now()
     where m.id in (
       select q.id from public.whatsapp_messages q
        where q.status = 'queued' and q.direction = 'out'
        order by q.created_at
        limit greatest(1, least(p_limit, 200))
        for update skip locked)
    returning m.*;
end;
$$;

revoke all on function public.whatsapp_claim_outbound(integer) from public;
revoke execute on function public.whatsapp_claim_outbound(integer) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- A conversation started from the file
-- ---------------------------------------------------------------------------
-- The caller's own clinic and RLS: the patient must be theirs to read, and
-- the row is written under the member policy. Raises when the file has no
-- number WhatsApp can address.
create or replace function public.whatsapp_open_for_patient(p_patient uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid := public.current_clinic_id();
  v_phone text;
  v_key text;
  v_conv uuid;
begin
  if v_clinic is null then raise exception 'no_clinic' using errcode = '42501'; end if;
  select pt.phone into v_phone from public.patients pt where pt.id = p_patient and pt.clinic_id = v_clinic;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_key := public.whatsapp_key(v_phone);
  if v_key is null then raise exception 'no_phone' using errcode = '22023'; end if;

  insert into public.whatsapp_conversations (clinic_id, contact_key, phone, patient_id)
  values (v_clinic, v_key, v_key, p_patient)
  on conflict (clinic_id, contact_key) do update
    set patient_id = coalesce(whatsapp_conversations.patient_id, excluded.patient_id),
        status = 'open'
  returning id into v_conv;
  return v_conv;
end;
$$;

revoke all on function public.whatsapp_open_for_patient(uuid) from public;
grant execute on function public.whatsapp_open_for_patient(uuid) to authenticated;

revoke execute on function public.whatsapp_key(text) from anon;
revoke execute on function public.whatsapp_reply_intent(text) from anon;
revoke execute on function public.render_whatsapp_ack(text, text, text, text) from anon;

-- ---------------------------------------------------------------------------
-- What the practitioner does, once
-- ---------------------------------------------------------------------------
-- Deploy the inbound function (supabase functions deploy whatsapp-inbound
-- --no-verify-jwt) with WHATSAPP_INBOUND_SECRET set, and give the sending
-- service the address with the secret as `?key=`; enter the clinic's number
-- in Settings → Messages. DEPLOY.md walks through it.
