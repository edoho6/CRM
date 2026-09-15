-- ============================================================================
-- 54 · Messages that go out by themselves: four automations, WhatsApp
--      templates, and the door out of marketing
-- ============================================================================
-- Until now the queue held one kind of message a patient receives — the
-- appointment reminder — and a person sent it from the Messages screen.
-- Once a sending service is connected (the dispatch function, with 019 for
-- SMS and WhatsApp), the queue empties itself, and it is worth filling it
-- with the messages every clinic system sends and this one did not:
--
--   treatment_followup  — "how are you feeling", a day after a treatment
--   birthday            — a greeting on the day
--   inactive_reengage   — "it has been a while", to a patient in treatment
--                         with nothing booked and no visit for months
--   review_request      — a link to the clinic's Google page, after a visit
--
-- Three of the four are advertising in the eyes of the law (תיקון 40 לחוק
-- התקשורת): a greeting, a nudge to come back and a request for a review
-- are not service messages. They go only to a patient whose standing
-- marketing consent is "granted" — the append-only decision this database
-- already keeps — and every one of them ends with a link that withdraws
-- that consent in one tap. The follow-up is a service message, like the
-- reminder, and needs no consent.
--
-- What this migration adds:
--   clinic_automations         — one row per clinic and kind: on or off,
--                                the timing, the wording, and the id of the
--                                WhatsApp template that says it (a message a
--                                business starts on WhatsApp must be a
--                                pre-approved template; free text is allowed
--                                only in the day after the patient wrote)
--   message_log.params         — the values of the template's variables,
--                                in order, so the sender can fill {{1}}..{{5}}
--   patient_unsubscribe_tokens — a random capability per patient, for the
--                                link; no policies at all, read only through
--                                the two functions below
--   clinics.google_review_url  — where the review request points
--   enqueue_due_automations    — the hourly job, idempotent like the
--                                reminders' one; a message whose moment
--                                passed more than two days ago is not sent
--                                (switching an automation on must not write
--                                to every patient in the history)
--   unsubscribe_info /
--   unsubscribe_marketing      — the public page's two calls
--
-- Nothing here retries. A message the service refused stays `failed` on the
-- Messages screen, with the reason, where a person can send it by hand or
-- fix what the reason names (credit, a wrong number, a missing template).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The clinic's Google page, and the variables of a template
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists google_review_url text
    check (google_review_url is null or google_review_url ~ '^https://');

comment on column public.clinics.google_review_url is
  'The link the review request carries — the clinic''s Google page. Null switches that automation off whatever its row says.';

alter table public.message_log
  add column if not exists params jsonb;

comment on column public.message_log.params is
  'The values of the message''s template variables, in order ({{1}}..{{5}}), for a WhatsApp template send. Null for a message that carries only its body.';

-- Dedupe for messages that belong to a patient rather than to an appointment:
-- one birthday a year, one nudge a season.
create index if not exists message_log_patient_kind_idx
  on public.message_log (patient_id, template_key, created_at desc)
  where patient_id is not null and status in ('queued', 'sent');

-- ---------------------------------------------------------------------------
-- How each clinic wants each automation
-- ---------------------------------------------------------------------------
-- `appointment_reminder` is here for one field only, the WhatsApp template
-- id: the reminder's own switch, timing and wording stay on `clinics`.
create table if not exists public.clinic_automations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  kind text not null check (kind in (
    'appointment_reminder', 'treatment_followup', 'birthday', 'inactive_reengage', 'review_request'
  )),
  enabled boolean not null default false,
  -- Follow-up and review: hours after the treatment ended.
  delay_hours integer not null default 24 check (delay_hours between 1 and 720),
  -- Re-engagement: how long without a visit counts as "a while".
  inactive_days integer not null default 90 check (inactive_days between 14 and 730),
  -- Birthday and re-engagement: the clinic-local hour from which the message may go.
  send_hour integer not null default 10 check (send_hour between 6 and 20),
  -- The clinic's own wording; null means the built-in text in the patient's language.
  template text check (template is null or length(template) <= 1000),
  -- The approved WhatsApp template that says this message, from the sending service.
  whatsapp_template_id text check (whatsapp_template_id is null or length(whatsapp_template_id) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, kind)
);

drop trigger if exists clinic_automations_set_updated_at on public.clinic_automations;
create trigger clinic_automations_set_updated_at
  before update on public.clinic_automations
  for each row execute function public.set_updated_at();

alter table public.clinic_automations enable row level security;

drop policy if exists clinic_automations_member_all on public.clinic_automations;
create policy clinic_automations_member_all on public.clinic_automations
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.clinic_automations is
  'Per clinic and kind: whether the automated message goes, when, in what words, and which WhatsApp template says it. Read by the hourly job and by the sender.';

-- ---------------------------------------------------------------------------
-- The way out of marketing messages
-- ---------------------------------------------------------------------------
-- A random capability per patient, made the first time a marketing message
-- is queued for them. No policies: nobody reads this table directly, not
-- even the clinic — the token is a secret that belongs to the link.
create table if not exists public.patient_unsubscribe_tokens (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.patient_unsubscribe_tokens enable row level security;

comment on table public.patient_unsubscribe_tokens is
  'The capability in a marketing message''s removal link. No policies: read and used only through unsubscribe_info and unsubscribe_marketing.';

-- A withdrawal that arrived through the link is its own kind of evidence.
alter table public.patient_consents drop constraint if exists patient_consents_method_check;
alter table public.patient_consents
  add constraint patient_consents_method_check
  check (method in ('in_person', 'portal', 'paper_form', 'phone', 'email', 'link'));

-- ---------------------------------------------------------------------------
-- May this patient be written to about anything but their care?
-- ---------------------------------------------------------------------------
-- The latest marketing decision, whatever document it cites; no decision at
-- all is "no". Owner-only: the jobs call it, a caller cannot probe with it.
create or replace function public.has_marketing_consent(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.granted
      from public.patient_consents c
     where c.patient_id = p_patient and c.kind = 'marketing'
     order by c.decided_at desc, c.created_at desc
     limit 1
  ), false);
$$;

revoke all on function public.has_marketing_consent(uuid) from public;
revoke execute on function public.has_marketing_consent(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The wording, rendered in SQL
-- ---------------------------------------------------------------------------
-- The same placeholders the app previews — {name} {clinic} {link}
-- {booking_link} {unsubscribe} — and the same built-in text in both
-- languages, kept here because the job runs with no app around to ask. The
-- three marketing kinds end with the removal line unless the clinic's own
-- wording already places {unsubscribe} somewhere.
create or replace function public.render_automation(
  p_kind text,
  p_template text,
  p_locale text,
  p_name text,
  p_clinic text,
  p_link text,
  p_booking_link text,
  p_unsubscribe text
)
returns text
language plpgsql
immutable
as $$
declare
  v_text text := nullif(btrim(coalesce(p_template, '')), '');
  v_en boolean := p_locale = 'en';
begin
  if v_text is null then
    v_text := case p_kind
      when 'treatment_followup' then
        case when v_en
          then 'Hi {name}, how are you feeling after your treatment at {clinic}? We would love to hear, and if anything is bothering you, get in touch.'
          else 'שלום {name}, איך ההרגשה אחרי הטיפול ב-{clinic}? נשמח לשמוע, ואם משהו מטריד, אפשר לפנות אלינו.'
        end
      when 'birthday' then
        case when v_en
          then 'Happy birthday {name}, from all of us at {clinic}! Wishing you a year of good health.'
          else 'שלום {name}, מזל טוב ליום ההולדת מכולנו ב-{clinic}! שתהיה שנה של בריאות.'
        end
      when 'inactive_reengage' then
        case
          when v_en and coalesce(p_booking_link, '') <> ''
            then 'Hi {name}, it has been a while since your last visit to {clinic}. We would be glad to see you again. To book: {booking_link}'
          when v_en
            then 'Hi {name}, it has been a while since your last visit to {clinic}. We would be glad to see you again.'
          when coalesce(p_booking_link, '') <> ''
            then 'שלום {name}, עבר זמן מאז הביקור האחרון ב-{clinic}. נשמח לראותך שוב. לקביעת תור: {booking_link}'
          else 'שלום {name}, עבר זמן מאז הביקור האחרון ב-{clinic}. נשמח לראותך שוב.'
        end
      when 'review_request' then
        case when v_en
          then 'Hi {name}, thank you for choosing {clinic}. If you were happy, a short Google review would mean a lot: {link}'
          else 'שלום {name}, תודה שבחרת ב-{clinic}. אם היה טוב, נשמח לחוות דעת קצרה בגוגל: {link}'
        end
      else coalesce(p_template, '')
    end;
  end if;

  if p_kind in ('birthday', 'inactive_reengage', 'review_request')
     and position('{unsubscribe}' in v_text) = 0 then
    v_text := v_text || E'\n' || case when v_en
      then 'To stop these messages: {unsubscribe}'
      else 'להסרה מהודעות כאלה: {unsubscribe}'
    end;
  end if;

  return replace(replace(replace(replace(replace(v_text,
    '{name}', coalesce(p_name, '')),
    '{clinic}', coalesce(p_clinic, '')),
    '{link}', coalesce(p_link, '')),
    '{booking_link}', coalesce(p_booking_link, '')),
    '{unsubscribe}', coalesce(p_unsubscribe, ''));
end;
$$;

revoke execute on function public.render_automation(text, text, text, text, text, text, text, text) from anon;

-- ---------------------------------------------------------------------------
-- One row into the queue
-- ---------------------------------------------------------------------------
-- The one insert every automation makes, so "no address means skipped, with
-- the reason" is decided once. Owner-only.
create or replace function public.automation_enqueue(
  p_clinic uuid,
  p_kind text,
  p_channel text,
  p_recipient text,
  p_body text,
  p_subject text,
  p_patient uuid,
  p_appointment uuid,
  p_params jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.message_log
    (clinic_id, channel, template_key, recipient, body, subject, patient_id, appointment_id, params, status, error_code)
  values
    (p_clinic, p_channel, p_kind, nullif(btrim(coalesce(p_recipient, '')), ''), p_body, p_subject, p_patient, p_appointment, p_params,
     case when nullif(btrim(coalesce(p_recipient, '')), '') is null then 'skipped' else 'queued' end,
     case when nullif(btrim(coalesce(p_recipient, '')), '') is null then 'no_recipient' else null end);
$$;

revoke all on function public.automation_enqueue(uuid, text, text, text, text, text, uuid, uuid, jsonb) from public;
revoke execute on function public.automation_enqueue(uuid, text, text, text, text, text, uuid, uuid, jsonb) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The hourly job: queue what is due
-- ---------------------------------------------------------------------------
-- Runs for every clinic at once, so it is SECURITY DEFINER and takes no
-- caller's clinic for granted. Idempotent: a message already queued or sent
-- for the same appointment, or for the same patient within the season, is
-- never queued again. Civil hours only — a treatment that ended at 22:00
-- gets its follow-up the next morning, not at 22:05 the next night.
-- `p_base_url` is the app's public address, for the links. The moment is a
-- parameter so the test can run the job at a chosen hour; this form is the
-- owner's only, and the one-argument wrapper below is what everyone else calls.
create or replace function public.enqueue_due_automations_at(p_base_url text, p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_now timestamptz := p_now;
  v_base text := rtrim(p_base_url, '/');
  r record;
  v_locale text;
  v_recipient text;
  v_subject text;
  v_body text;
  v_token uuid;
  v_unsubscribe text;
  v_booking text;
begin
  -- 1 · Follow-up after treatment: a service message, no consent needed.
  --     "A treatment happened" is the desk's mark (arrived / completed) or
  --     a record written for the appointment; a booking that simply passed
  --     may have been a no-show nobody marked, and gets nothing.
  for r in
    select a.id as appointment_id, a.clinic_id, a.patient_id,
           c.name as clinic_name, c.reminder_channel,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.appointments a on a.clinic_id = c.id
      join public.patients p on p.id = a.patient_id
     where ca.kind = 'treatment_followup' and ca.enabled
       and a.status not in ('cancelled', 'no_show')
       and (a.status in ('checked_in', 'completed')
            or exists (select 1 from public.encounters e where e.appointment_id = a.id))
       and a.end_at <= v_now - make_interval(hours => ca.delay_hours)
       and a.end_at >  v_now - make_interval(hours => ca.delay_hours) - interval '48 hours'
       and extract(hour from (v_now at time zone c.timezone)) between 8 and 20
       and not exists (
         select 1 from public.message_log m
          where m.appointment_id = a.id
            and m.template_key = 'treatment_followup'
            and m.status in ('queued', 'sent'))
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    v_body := public.render_automation('treatment_followup', r.template, v_locale,
                r.first_name, r.clinic_name, null, null, null);
    perform public.automation_enqueue(r.clinic_id, 'treatment_followup', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, r.appointment_id,
      jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name));
    v_count := v_count + 1;
  end loop;

  -- 2 · Birthday: on the day, from the clinic's chosen hour, once a year.
  --     A 29 February is greeted on 1 March in a year that has no 29th.
  for r in
    select p.id as patient_id, p.clinic_id,
           c.name as clinic_name, c.reminder_channel, c.timezone,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template, ca.send_hour
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.patients p on p.clinic_id = c.id
     where ca.kind = 'birthday' and ca.enabled
       and p.is_active and p.date_of_birth is not null
       and extract(hour from (v_now at time zone c.timezone)) between ca.send_hour and 20
       and (
         to_char(p.date_of_birth, 'MM-DD') = to_char((v_now at time zone c.timezone)::date, 'MM-DD')
         or (to_char(p.date_of_birth, 'MM-DD') = '02-29'
             and to_char((v_now at time zone c.timezone)::date, 'MM-DD') = '03-01'
             and to_char((v_now at time zone c.timezone)::date - 1, 'MM-DD') = '02-28')
       )
       and public.has_marketing_consent(p.id)
       and not exists (
         select 1 from public.message_log m
          where m.patient_id = p.id
            and m.template_key = 'birthday'
            and m.status in ('queued', 'sent')
            and m.created_at > v_now - interval '300 days')
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    insert into public.patient_unsubscribe_tokens (patient_id, clinic_id)
      values (r.patient_id, r.clinic_id) on conflict (patient_id) do nothing;
    select t.token into v_token from public.patient_unsubscribe_tokens t where t.patient_id = r.patient_id;
    v_unsubscribe := v_base || '/' || v_locale || '/unsubscribe/' || v_token::text;
    v_body := public.render_automation('birthday', r.template, v_locale,
                r.first_name, r.clinic_name, null, null, v_unsubscribe);
    perform public.automation_enqueue(r.clinic_id, 'birthday', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, null,
      jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, v_unsubscribe));
    v_count := v_count + 1;
  end loop;

  -- 3 · Re-engagement: in treatment, nothing booked, and no visit for a
  --     season. A file with no visit at all is a lead, not a lapsed patient.
  for r in
    select p.id as patient_id, p.clinic_id,
           c.name as clinic_name, c.reminder_channel, c.booking_enabled, c.booking_slug,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.patients p on p.clinic_id = c.id
     where ca.kind = 'inactive_reengage' and ca.enabled
       and p.is_active and coalesce(p.treatment_status, 'active') = 'active'
       and extract(hour from (v_now at time zone c.timezone)) between ca.send_hour and 20
       and not exists (
         select 1 from public.appointments f
          where f.patient_id = p.id
            and f.status not in ('cancelled', 'no_show')
            and f.start_at > v_now)
       and greatest(
             (select max(a.start_at) from public.appointments a
               where a.patient_id = p.id and a.status not in ('cancelled', 'no_show') and a.start_at <= v_now),
             (select max(e.encounter_date)::timestamptz from public.encounters e where e.patient_id = p.id)
           ) < v_now - make_interval(days => ca.inactive_days)
       and public.has_marketing_consent(p.id)
       and not exists (
         select 1 from public.message_log m
          where m.patient_id = p.id
            and m.template_key = 'inactive_reengage'
            and m.status in ('queued', 'sent')
            and m.created_at > v_now - interval '180 days')
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    v_booking := case when r.booking_enabled and r.booking_slug is not null
                   then v_base || '/' || v_locale || '/book/' || r.booking_slug
                   else '' end;
    insert into public.patient_unsubscribe_tokens (patient_id, clinic_id)
      values (r.patient_id, r.clinic_id) on conflict (patient_id) do nothing;
    select t.token into v_token from public.patient_unsubscribe_tokens t where t.patient_id = r.patient_id;
    v_unsubscribe := v_base || '/' || v_locale || '/unsubscribe/' || v_token::text;
    v_body := public.render_automation('inactive_reengage', r.template, v_locale,
                r.first_name, r.clinic_name, null, v_booking, v_unsubscribe);
    perform public.automation_enqueue(r.clinic_id, 'inactive_reengage', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, null,
      jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, v_booking, v_unsubscribe));
    v_count := v_count + 1;
  end loop;

  -- 4 · A review: after a visit that happened, to a consenting patient, once
  --     a season; two visits in a day are one request.
  for r in
    select distinct on (p.id)
           a.id as appointment_id, a.clinic_id, p.id as patient_id,
           c.name as clinic_name, c.reminder_channel, c.google_review_url,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.appointments a on a.clinic_id = c.id
      join public.patients p on p.id = a.patient_id
     where ca.kind = 'review_request' and ca.enabled
       and c.google_review_url is not null
       and a.status not in ('cancelled', 'no_show')
       and (a.status in ('checked_in', 'completed')
            or exists (select 1 from public.encounters e where e.appointment_id = a.id))
       and a.end_at <= v_now - make_interval(hours => ca.delay_hours)
       and a.end_at >  v_now - make_interval(hours => ca.delay_hours) - interval '48 hours'
       and extract(hour from (v_now at time zone c.timezone)) between 8 and 20
       and public.has_marketing_consent(p.id)
       and not exists (
         select 1 from public.message_log m
          where m.patient_id = p.id
            and m.template_key = 'review_request'
            and m.status in ('queued', 'sent')
            and m.created_at > v_now - interval '180 days')
     order by p.id, a.end_at desc
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    insert into public.patient_unsubscribe_tokens (patient_id, clinic_id)
      values (r.patient_id, r.clinic_id) on conflict (patient_id) do nothing;
    select t.token into v_token from public.patient_unsubscribe_tokens t where t.patient_id = r.patient_id;
    v_unsubscribe := v_base || '/' || v_locale || '/unsubscribe/' || v_token::text;
    v_body := public.render_automation('review_request', r.template, v_locale,
                r.first_name, r.clinic_name, r.google_review_url, null, v_unsubscribe);
    perform public.automation_enqueue(r.clinic_id, 'review_request', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, r.appointment_id,
      jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, r.google_review_url, v_unsubscribe));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_automations_at(text, timestamptz) from public;
revoke execute on function public.enqueue_due_automations_at(text, timestamptz) from anon, authenticated;

-- The job as everyone calls it: now. Callable by a signed-in member too, so
-- the Messages screen can top the queue up on demand; the schedule calls it
-- as the database owner.
create or replace function public.enqueue_due_automations(p_base_url text)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.enqueue_due_automations_at(p_base_url, now());
$$;

revoke all on function public.enqueue_due_automations(text) from public;
grant execute on function public.enqueue_due_automations(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The reminder now carries its variables too, for a WhatsApp template:
-- {{1}} name, {{2}} clinic, {{3}} date, {{4}} time, {{5}} link.
-- Same job as before in every other respect (migration 41).
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
  v_date text;
  v_time text;
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
    v_date := to_char(r.start_at at time zone r.timezone, 'DD/MM/YYYY');
    v_time := to_char(r.start_at at time zone r.timezone, 'HH24:MI');

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
         public.render_push_reminder(v_locale, v_date, v_time, r.clinic_name),
         r.clinic_name, v_link, r.patient_id, r.appointment_id, 'queued');
      v_count := v_count + 1;
      continue;
    end if;

    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_body := public.render_reminder(
      r.reminder_template, v_locale, r.first_name, v_date, v_time, r.clinic_name, v_link
    );

    insert into public.message_log
      (clinic_id, channel, template_key, recipient, body, subject, patient_id, appointment_id, params, status, error_code)
    values
      (r.clinic_id, r.reminder_channel, 'appointment_reminder', v_recipient, v_body,
       case when r.reminder_channel = 'email' then r.clinic_name else null end,
       r.patient_id, r.appointment_id,
       jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, v_date, v_time, v_link),
       case when v_recipient is null then 'skipped' else 'queued' end,
       case when v_recipient is null then 'no_recipient' else null end);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Marking a message sent: only a reminder marks its appointment reminded.
-- A follow-up or a review request also names an appointment, and used to
-- set the reminder's own mark on a booking long past — harmless, but wrong.
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

  if v_row.appointment_id is not null and v_row.template_key = 'appointment_reminder' then
    update public.appointments
       set reminder_sent_at = coalesce(reminder_sent_at, now())
     where id = v_row.appointment_id;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public: the removal page
-- ---------------------------------------------------------------------------
-- What the page shows before the patient decides: whose messages these are,
-- their first name so they know it is theirs, and their language.
create or replace function public.unsubscribe_info(p_token uuid)
returns table (
  clinic_name text,
  first_name text,
  locale text,
  already_withdrawn boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.name,
         p.first_name,
         coalesce(p.preferred_locale, 'he'),
         not public.has_marketing_consent(p.id)
    from public.patient_unsubscribe_tokens t
    join public.patients p on p.id = t.patient_id
    join public.clinics c on c.id = t.clinic_id
   where t.token = p_token;
$$;

revoke all on function public.unsubscribe_info(uuid) from public;
grant execute on function public.unsubscribe_info(uuid) to anon, authenticated;

-- The decision. A new row in the append-only consent history, in the
-- patient's own name, citing no document — the same shape as any other
-- withdrawal. The clinic is the token's, never the caller's: an anonymous
-- caller has none. Idempotent: a second tap changes nothing and still says yes.
create or replace function public.unsubscribe_marketing(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient uuid;
  v_clinic uuid;
  v_latest boolean;
begin
  select t.patient_id, t.clinic_id into v_patient, v_clinic
    from public.patient_unsubscribe_tokens t
   where t.token = p_token;
  if not found then return false; end if;

  select c.granted into v_latest
    from public.patient_consents c
   where c.patient_id = v_patient and c.kind = 'marketing'
   order by c.decided_at desc, c.created_at desc
   limit 1;
  if v_latest is false then return true; end if;

  insert into public.patient_consents
    (clinic_id, patient_id, document_id, kind, granted, method, decided_at, notes)
  values
    (v_clinic, v_patient, null, 'marketing', false, 'link', now(), 'unsubscribe link');
  return true;
end;
$$;

revoke all on function public.unsubscribe_marketing(uuid) from public;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The schedule — run once, by hand, in the SQL editor
-- ---------------------------------------------------------------------------
-- Not run here because it needs the app's public address, which is not the
-- database's to know. With pg_cron enabled, paste and run with your own
-- address (the reminders' schedule from migration 32 stays as it is):
--
--   select cron.schedule(
--     'enqueue-automations', '5 * * * *',
--     $job$ select public.enqueue_due_automations('https://YOUR-APP-ADDRESS') $job$
--   );
--
-- That fills the queue. Sending it is the dispatch-messages function, once
-- 019 is connected (supabase/functions/README.md); until then the queue is
-- the "to send" list on the Messages screen, as before.
