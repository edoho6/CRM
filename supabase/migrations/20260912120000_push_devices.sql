-- ============================================================================
-- 41 · Notifications on the phone: the devices, the channel, who decides
-- ============================================================================
-- The store apps can receive a notification while closed. This migration
-- gives the database what it needs to use that, and keeps every decision
-- where the other channels' decisions already are — in SQL, on the hour:
--
--   device_push_tokens        — one row per phone that asked for
--                               notifications: whose it is, which app, which
--                               platform, the token the push service knows it
--                               by. Registered from the app after sign-in
--                               (register_push_device), removed at sign-out.
--   message_log.channel       — gains 'push'. For a push row `recipient` is
--                               the user id the devices belong to (never a
--                               number or an address) and `link_url` is where
--                               a tap on the notification lands.
--   clinics.reminder_push_enabled — the clinic's say: a patient with the app
--                               gets the reminder as a notification instead of
--                               a message on the clinic's channel.
--   clinic_tasks.remind_via   — gains 'push': the alert reaches the phone.
--
-- What a notification carries: a short text with the clinic's name, the date
-- and the hour — never the patient's name or anything clinical. It passes
-- through Google and Apple; the confirmation page it opens is ours.
--
-- The fallback needs no machinery: a push that finds no live device is marked
-- failed and the device row is dropped by the sender, so the next hourly run
-- sees no device and queues the reminder on the clinic's channel instead.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The devices
-- ---------------------------------------------------------------------------
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The clinic for a member of staff; null for a patient, who belongs to no
  -- clinic through memberships.
  clinic_id uuid references public.clinics(id) on delete cascade,
  app text not null check (app in ('clinic', 'portal')),
  platform text not null check (platform in ('ios', 'android')),
  -- What the push service knows the phone by. Unique: a phone that changes
  -- hands is re-bound, not duplicated.
  token text not null unique,
  locale text not null default 'he' check (locale in ('he', 'en')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id, app);

alter table public.device_push_tokens enable row level security;

-- A phone is its owner's: seen and removed by them, written only through the
-- function below (which binds the row to the caller, whatever it was told).
drop policy if exists device_push_tokens_self_select on public.device_push_tokens;
create policy device_push_tokens_self_select on public.device_push_tokens
  for select using (user_id = auth.uid());

drop policy if exists device_push_tokens_self_delete on public.device_push_tokens;
create policy device_push_tokens_self_delete on public.device_push_tokens
  for delete using (user_id = auth.uid());

comment on table public.device_push_tokens is
  'Phones registered for notifications: owner, app, platform and the push token. Written only by register_push_device; a dead token is dropped by the sender.';

create or replace function public.register_push_device(
  p_token text,
  p_platform text,
  p_app text,
  p_locale text default 'he'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'invalid token' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android') or p_app not in ('clinic', 'portal') then
    raise exception 'invalid device' using errcode = '22023';
  end if;

  insert into public.device_push_tokens (user_id, clinic_id, app, platform, token, locale)
  values (
    auth.uid(),
    case when p_app = 'clinic' then public.current_clinic_id() else null end,
    p_app,
    p_platform,
    p_token,
    case when p_locale in ('he', 'en') then p_locale else 'he' end
  )
  on conflict (token) do update
    set user_id = excluded.user_id,
        clinic_id = excluded.clinic_id,
        app = excluded.app,
        platform = excluded.platform,
        locale = excluded.locale,
        last_seen_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.register_push_device(text, text, text, text) from public;
grant execute on function public.register_push_device(text, text, text, text) to authenticated;

comment on function public.register_push_device(text, text, text, text) is
  'Registers (or re-binds) the calling user''s phone for notifications. The clinic is the caller''s own, never the payload''s.';

create or replace function public.unregister_push_device(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.device_push_tokens
   where token = p_token
     and user_id = auth.uid();
$$;

revoke all on function public.unregister_push_device(text) from public;
grant execute on function public.unregister_push_device(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The channel
-- ---------------------------------------------------------------------------
alter table public.message_log drop constraint if exists message_log_channel_check;
alter table public.message_log
  add constraint message_log_channel_check check (channel in ('sms', 'whatsapp', 'email', 'push'));

alter table public.message_log
  add column if not exists link_url text;

comment on column public.message_log.link_url is
  'For a push row: where a tap on the notification lands. Null for the other channels.';

alter table public.clinic_tasks drop constraint if exists clinic_tasks_remind_via_check;
alter table public.clinic_tasks
  add constraint clinic_tasks_remind_via_check check (remind_via in ('app', 'email', 'sms', 'push'));

alter table public.clinics
  add column if not exists reminder_push_enabled boolean not null default true;

comment on column public.clinics.reminder_push_enabled is
  'A patient who installed the app gets the reminder as a phone notification instead of a message on reminder_channel.';

-- ---------------------------------------------------------------------------
-- The short text a notification carries: clinic, date, hour. No name.
-- ---------------------------------------------------------------------------
create or replace function public.render_push_reminder(
  p_locale text,
  p_date text,
  p_time text,
  p_clinic text
)
returns text
language sql
immutable
as $$
  select case when p_locale = 'en'
    then 'Reminder: your appointment at ' || coalesce(p_clinic, '') || ' on ' || coalesce(p_date, '') || ' at ' || coalesce(p_time, '') || '. Tap to confirm.'
    else 'תזכורת: התור שלך ב-' || coalesce(p_clinic, '') || ' בתאריך ' || coalesce(p_date, '') || ' בשעה ' || coalesce(p_time, '') || '. לאישור הגעה — לחיצה על ההודעה.'
  end;
$$;

-- ---------------------------------------------------------------------------
-- The hourly job, now aware of phones. Same idempotence, same window; the
-- one new decision is the channel, made per patient from what is true now.
-- ---------------------------------------------------------------------------
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
  v_link text;
  v_push_user uuid;
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
      c.reminder_push_enabled,
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
    v_link := rtrim(p_base_url, '/') || '/' || v_locale || '/confirm/' || r.confirmation_token::text;

    -- A phone with the portal app, signed in as this patient: the reminder
    -- goes there, and nowhere else.
    v_push_user := null;
    if r.reminder_push_enabled then
      select ppa.user_id into v_push_user
        from public.patient_portal_access ppa
       where ppa.patient_id = r.patient_id
         and ppa.is_active
         and ppa.user_id is not null
         and exists (select 1 from public.device_push_tokens d
                      where d.user_id = ppa.user_id and d.app = 'portal')
       limit 1;
    end if;

    if v_push_user is not null then
      insert into public.message_log
        (clinic_id, channel, template_key, recipient, body, subject, link_url, patient_id, appointment_id, status)
      values
        (r.clinic_id, 'push', 'appointment_reminder', v_push_user::text,
         public.render_push_reminder(
           v_locale,
           to_char(r.start_at at time zone r.timezone, 'DD/MM/YYYY'),
           to_char(r.start_at at time zone r.timezone, 'HH24:MI'),
           r.clinic_name),
         r.clinic_name, v_link, r.patient_id, r.appointment_id, 'queued');
      v_count := v_count + 1;
      continue;
    end if;

    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_body := public.render_reminder(
      r.reminder_template,
      v_locale,
      r.first_name,
      to_char(r.start_at at time zone r.timezone, 'DD/MM/YYYY'),
      to_char(r.start_at at time zone r.timezone, 'HH24:MI'),
      r.clinic_name,
      v_link
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

-- ---------------------------------------------------------------------------
-- Task alerts: 'push' joins email and SMS. The phone must be the task
-- owner's, signed in to the staff app; without one the alert is skipped and
-- says so, rather than queued to nobody.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_due_task_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_recipient text;
  v_has_device boolean;
begin
  for r in
    select t.id, t.clinic_id, t.title, t.due_at, t.remind_via, t.created_by,
           pr.phone, pr.preferred_locale, u.email
      from public.clinic_tasks t
      left join public.profiles pr on pr.id = t.created_by
      left join auth.users u on u.id = t.created_by
     where t.done_at is null
       and t.reminded_at is null
       and t.due_at is not null
       and t.due_at - make_interval(mins => t.remind_offset_minutes) <= now() + interval '5 minutes'
       and t.remind_via in ('email', 'sms', 'push')
  loop
    if r.remind_via = 'push' then
      v_has_device := r.created_by is not null and exists (
        select 1 from public.device_push_tokens d where d.user_id = r.created_by and d.app = 'clinic');
      insert into public.message_log
        (clinic_id, channel, template_key, recipient, body, subject, link_url, task_id, status, error_code)
      values
        (r.clinic_id, 'push', 'task_alert', r.created_by::text, r.title,
         case when coalesce(r.preferred_locale, 'he') = 'en' then 'Task reminder' else 'תזכורת למשימה' end,
         '/' || coalesce(r.preferred_locale, 'he') || '/tasks',
         r.id,
         case when v_has_device then 'queued' else 'skipped' end,
         case when v_has_device then null else 'no_device' end);
    else
      v_recipient := case when r.remind_via = 'email' then r.email else r.phone end;
      insert into public.message_log
        (clinic_id, channel, template_key, recipient, body, subject, task_id, status, error_code)
      values
        (r.clinic_id, r.remind_via, 'task_alert', v_recipient, r.title,
         case when r.remind_via = 'email' then r.title else null end,
         r.id,
         case when v_recipient is null then 'skipped' else 'queued' end,
         case when v_recipient is null then 'no_recipient' else null end);
    end if;
    update public.clinic_tasks set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- The sender marks what it sent. `mark_message_sent` checked clinic
-- membership only, which the sending function — running as the service, with
-- no person behind it — never has: every provider send would have stayed
-- `queued` and gone out again five minutes later. The service is now let
-- through; a signed-in person still needs to be a member of the row's clinic.
-- ---------------------------------------------------------------------------
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
   where m.id = p_id
     and (public.is_clinic_member(m.clinic_id) or auth.role() = 'service_role');
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
