-- ============================================================================
-- 32 · Blocked hours, and the message log
-- ============================================================================
-- Two things the diary needs next.
--
--   schedule_blocks — hours a practitioner is not available on one day: a
--     course from 14:00 to 16:00, a dentist at 11:00. Several on one day,
--     each with its own reason. This is the opposite question from
--     schedule_exceptions, which says when a day is *open*; a block says when
--     it is not, and is subtracted from whatever the day would otherwise be.
--
--   message_log — every message the clinic sends a patient (or a practitioner
--     sends themselves): what, to whom, through which channel, and whether it
--     went. The queue lives here too. A row is queued by the hourly job, then
--     either sent by a connected provider, or sent by hand from the app and
--     marked so. Until a provider is connected, the queue *is* the list of
--     reminders to send this evening — which is the feature, not a fallback.
--
-- The recipient's number or address is stored here and nowhere else outside
-- our own database; nothing about a patient is ever written to a third-party
-- log. Provider errors are kept as a short code, never the provider's full
-- response.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Blocked hours
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  practitioner_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_blocks_order check (end_at > start_at),
  constraint schedule_blocks_reason_length check (reason is null or length(reason) <= 160)
);

create index if not exists schedule_blocks_practitioner_idx
  on public.schedule_blocks (practitioner_id, start_at);

alter table public.schedule_blocks enable row level security;

drop policy if exists schedule_blocks_staff_all on public.schedule_blocks;
create policy schedule_blocks_staff_all on public.schedule_blocks
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.schedule_blocks is
  'Hours a practitioner is away on one day, each with a reason. Subtracted from the working hours; several may sit on one day.';

-- ---------------------------------------------------------------------------
-- How each clinic wants its reminders
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_hours_before integer not null default 24
    check (reminder_hours_before between 1 and 168),
  add column if not exists reminder_channel text not null default 'whatsapp'
    check (reminder_channel in ('sms', 'whatsapp', 'email'));

-- ---------------------------------------------------------------------------
-- The message log
-- ---------------------------------------------------------------------------
create table if not exists public.message_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  -- What this message is, so the same one is never queued twice.
  template_key text not null,
  -- The number or address, as it will be sent to.
  recipient text,
  body text not null,
  subject text,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  task_id uuid references public.clinic_tasks(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  -- 'manual' when a person sent it from the app; otherwise the provider's name.
  provider text,
  provider_message_id text,
  -- A short reason code, never the provider's full response.
  error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists message_log_queue_idx
  on public.message_log (status, created_at)
  where status = 'queued';

create index if not exists message_log_clinic_idx
  on public.message_log (clinic_id, created_at desc);

-- One reminder per appointment, one alert per task: the hourly job checks
-- this before queueing, and the index makes the check cheap.
create index if not exists message_log_dedupe_idx
  on public.message_log (appointment_id, template_key)
  where appointment_id is not null and status in ('queued', 'sent');

alter table public.message_log enable row level security;

-- Staff see their clinic's messages and may mark one sent by hand. Rows are
-- written by the queueing functions below, and by the app for a manual send.
drop policy if exists message_log_staff_select on public.message_log;
create policy message_log_staff_select on public.message_log
  for select using (public.is_clinic_member(clinic_id));

drop policy if exists message_log_staff_insert on public.message_log;
create policy message_log_staff_insert on public.message_log
  for insert with check (public.is_clinic_member(clinic_id));

drop policy if exists message_log_staff_update on public.message_log;
create policy message_log_staff_update on public.message_log
  for update using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.message_log is
  'Every message to a patient or practitioner: queued by the hourly job, sent by a provider or by hand. Recipient details live here and in no external service.';

-- ---------------------------------------------------------------------------
-- The reminder text, rendered in SQL
-- ---------------------------------------------------------------------------
-- The same placeholders the app fills — {name} {date} {time} {clinic} {link}
-- — and the same built-in wording, kept here in both languages because the
-- job runs with no app around to ask.
create or replace function public.render_reminder(
  p_template text,
  p_locale text,
  p_name text,
  p_date text,
  p_time text,
  p_clinic text,
  p_link text
)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(replace(
    coalesce(nullif(btrim(p_template), ''),
      case when p_locale = 'en'
        then 'Hi {name}, a reminder of your appointment at {clinic} on {date} at {time}. Please confirm here: {link}'
        else 'שלום {name}, תזכורת לתור שלך ב-{clinic} בתאריך {date} בשעה {time}. לאישור הגעה: {link}'
      end),
    '{name}', coalesce(p_name, '')),
    '{date}', coalesce(p_date, '')),
    '{time}', coalesce(p_time, '')),
    '{clinic}', coalesce(p_clinic, '')),
    '{link}', coalesce(p_link, ''));
$$;

-- ---------------------------------------------------------------------------
-- The hourly job: queue what is due
-- ---------------------------------------------------------------------------
-- Runs for every clinic at once, so it is SECURITY DEFINER and takes no
-- caller's clinic for granted. Idempotent: a reminder already queued or sent
-- for an appointment is never queued again, so running it twice an hour costs
-- nothing. `p_base_url` is the app's public address, for the confirmation
-- link — it lives in the schedule that calls this, not in the database.
create or replace function public.enqueue_due_reminders(p_base_url text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_recipient text;
  v_locale text;
  v_body text;
begin
  for r in
    select
      a.id as appointment_id,
      a.clinic_id,
      a.patient_id,
      a.start_at,
      a.confirmation_token,
      c.name as clinic_name,
      c.timezone,
      c.reminder_template,
      c.reminder_channel,
      p.first_name,
      p.phone,
      p.email,
      p.preferred_locale
    from public.appointments a
    join public.clinics c on c.id = a.clinic_id
    join public.patients p on p.id = a.patient_id
    where c.reminders_enabled
      and a.status in ('scheduled', 'confirmed')
      and a.reminder_sent_at is null
      and a.start_at > now()
      and a.start_at <= now() + make_interval(hours => c.reminder_hours_before)
      and not exists (
        select 1 from public.message_log m
         where m.appointment_id = a.id
           and m.template_key = 'appointment_reminder'
           and m.status in ('queued', 'sent')
      )
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_body := public.render_reminder(
      r.reminder_template,
      v_locale,
      r.first_name,
      to_char(r.start_at at time zone r.timezone, 'DD/MM/YYYY'),
      to_char(r.start_at at time zone r.timezone, 'HH24:MI'),
      r.clinic_name,
      rtrim(p_base_url, '/') || '/' || v_locale || '/confirm/' || r.confirmation_token::text
    );

    insert into public.message_log
      (clinic_id, channel, template_key, recipient, body, subject, patient_id, appointment_id, status, error_code)
    values
      (r.clinic_id, r.reminder_channel, 'appointment_reminder', v_recipient, v_body,
       case when r.reminder_channel = 'email' then r.clinic_name else null end,
       r.patient_id, r.appointment_id,
       case when v_recipient is null then 'skipped' else 'queued' end,
       case when v_recipient is null then 'no_recipient' else null end);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_reminders(text) from public;
-- Callable by a signed-in member too, so the app can top the queue up on
-- demand; the schedule calls it as the database owner.
grant execute on function public.enqueue_due_reminders(text) to authenticated;

-- Task alerts that asked for email or SMS. The in-app channel is the bell's
-- business and never comes through here. The task is marked reminded as it
-- is queued, so it is queued once.
create or replace function public.enqueue_due_task_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select t.id, t.clinic_id, t.title, t.due_at, t.remind_via, t.created_by,
           pr.phone, u.email
      from public.clinic_tasks t
      left join public.profiles pr on pr.id = t.created_by
      left join auth.users u on u.id = t.created_by
     where t.done_at is null
       and t.reminded_at is null
       and t.due_at is not null
       and t.due_at <= now() + interval '5 minutes'
       and t.remind_via in ('email', 'sms')
  loop
    insert into public.message_log
      (clinic_id, channel, template_key, recipient, body, subject, task_id, status, error_code)
    values
      (r.clinic_id, r.remind_via, 'task_alert',
       case when r.remind_via = 'email' then r.email else r.phone end,
       r.title,
       case when r.remind_via = 'email' then r.title else null end,
       r.id,
       case when (case when r.remind_via = 'email' then r.email else r.phone end) is null then 'skipped' else 'queued' end,
       case when (case when r.remind_via = 'email' then r.email else r.phone end) is null then 'no_recipient' else null end);
    update public.clinic_tasks set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.enqueue_due_task_alerts() from public;
grant execute on function public.enqueue_due_task_alerts() to authenticated;

-- ---------------------------------------------------------------------------
-- Marking a message sent by hand
-- ---------------------------------------------------------------------------
-- One statement for the log row and the appointment's own mark, so the dot in
-- the diary and the queue can never disagree.
create or replace function public.mark_message_sent(p_id uuid, p_provider text default 'manual')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.message_log%rowtype;
begin
  select * into v_row from public.message_log m
   where m.id = p_id and public.is_clinic_member(m.clinic_id);
  if not found then return false; end if;

  update public.message_log
     set status = 'sent', provider = p_provider, sent_at = now(), error_code = null
   where id = p_id;

  if v_row.appointment_id is not null then
    update public.appointments
       set reminder_sent_at = coalesce(reminder_sent_at, now())
     where id = v_row.appointment_id;
  end if;
  return true;
end;
$$;

revoke all on function public.mark_message_sent(uuid, text) from public;
grant execute on function public.mark_message_sent(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The schedule itself — run once, by hand, in the SQL editor
-- ---------------------------------------------------------------------------
-- Not run here because it needs the app's public address, which is not the
-- database's to know. With pg_cron enabled on the project (Database →
-- Extensions → pg_cron), paste and run, with your own address:
--
--   select cron.schedule(
--     'enqueue-reminders', '5 * * * *',
--     $job$ select public.enqueue_due_reminders('https://YOUR-APP-ADDRESS') $job$
--   );
--   select cron.schedule(
--     'enqueue-task-alerts', '* * * * *',
--     $job$ select public.enqueue_due_task_alerts() $job$
--   );
--
-- That fills the queue. Sending it is the dispatch-messages function in
-- supabase/functions, once a provider is connected; until then the queue is
-- the "to send" list on the Messages screen.
