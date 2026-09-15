-- ============================================================================
-- 68 · Three doors that were standing open
-- ============================================================================
-- Supabase grants EXECUTE on every new function in `public` to anon,
-- authenticated and service_role through default privileges. Migration 36
-- recorded that lesson for the price reader; three functions written before it
-- never got the treatment, and this file closes them.
--
--   1 · settle_grow_payment / grow_credentials_for_process — a payment could be
--       marked paid, and a clinic's payment-page identifiers read, by anyone
--       holding the public anon key and a process id. The process id travels
--       through the payer's own browser, so it is not a secret. Settlement now
--       belongs to the service role alone (the grow-webhook function), and the
--       callback must also present the process *token* Grow issued when the
--       payment was created and which we stored at that moment.
--
--   2 · enqueue_due_reminders / _task_alerts / _automations — granted to every
--       signed-in member, and each ran over *every* clinic, with the link
--       domain taken from the caller. One clinic's staff could queue messages
--       to another clinic's patients carrying those patients' confirmation and
--       unsubscribe tokens, pointed at a domain of their choosing. The jobs
--       keep their whole-service form for the schedule, which runs as the
--       database owner; members reach them only through
--       `enqueue_now_for_my_clinic`, which pins the clinic to their own.
--
--   3 · log_record_access accepted any table name and any record id, so the one
--       trail that is meant to be unforgeable could be filled with rows about
--       records the caller never opened, or that do not exist.
--
-- And the audit trigger, which covered fourteen tables, now also covers five
-- that hold patient data and did not have it: documents (including the flag
-- that shares a file with the portal), appointments, dispensing, payments and
-- portal access.
--
-- Note for whoever pastes SQL by hand: re-running an older file (54, 19) after
-- this one would recreate the old function bodies and re-grant them. If that
-- happens, run this file again.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Payments: settlement is the service role's, and needs the token
-- ---------------------------------------------------------------------------
-- The signature gains the process token, so the old four-argument form is
-- dropped rather than replaced. Nothing else called it: the webhook is the
-- only caller, and it moves to an Edge Function in this same change.

drop function if exists public.settle_grow_payment(text, text, text, jsonb);

create or replace function public.settle_grow_payment(
  p_process_id text,
  p_process_token text,
  p_transaction_id text default null,
  p_status text default 'paid',
  p_raw jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  if p_process_id is null or length(trim(p_process_id)) = 0 then
    raise exception 'process_id_required';
  end if;

  select * into v_payment
  from public.payments
  where provider_process_id = p_process_id
  for update;

  if v_payment.id is null then
    raise exception 'payment_not_found';
  end if;

  -- The token Grow issued when the payment was created, which we stored then
  -- and never published. A process id alone is not evidence: it passes through
  -- the payer's own browser. A payment with no stored token cannot be verified
  -- at all, so it is refused rather than trusted.
  if v_payment.provider_process_token is null
     or p_process_token is null
     or p_process_token <> v_payment.provider_process_token then
    raise exception 'payment_token_mismatch';
  end if;

  -- Grow may retry a callback; settling twice must not double-count.
  if v_payment.status = 'paid' and p_status = 'paid' then
    return v_payment.id;
  end if;

  update public.payments
     set status = case when p_status = 'paid' then 'paid' else 'failed' end,
         provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
         paid_at = case when p_status = 'paid' then now() else null end,
         raw_response = coalesce(p_raw, raw_response)
   where id = v_payment.id;

  return v_payment.id;
end;
$$;

comment on function public.settle_grow_payment(text, text, text, text, jsonb) is
  'Settles a Grow payment from the webhook. Requires both the process id and the process token this system stored when the payment was created, and is idempotent so a retried callback cannot double-count. Service role only.';

revoke all on function public.settle_grow_payment(text, text, text, text, jsonb) from public;
revoke execute on function public.settle_grow_payment(text, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.settle_grow_payment(text, text, text, text, jsonb) to service_role;

-- The page code and user id a callback needs in order to be acknowledged. Same
-- reasoning: the webhook holds the service role now, so nobody else needs this.
revoke all on function public.grow_credentials_for_process(text) from public;
revoke execute on function public.grow_credentials_for_process(text) from anon, authenticated;
grant execute on function public.grow_credentials_for_process(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2 · The queues: the schedule keeps the service, a member gets their clinic
-- ---------------------------------------------------------------------------
-- Each job gains an optional clinic. Null is the old behaviour — every clinic,
-- which is what the hourly schedule wants and what only the database owner may
-- now ask for. The schedule's own call is unchanged: with the argument left
-- off, `enqueue_due_reminders('https://…')` still resolves, through the
-- default, to exactly the work it did before.

drop function if exists public.enqueue_due_reminders(text);
drop function if exists public.enqueue_due_task_alerts();
drop function if exists public.enqueue_due_automations(text);
drop function if exists public.enqueue_due_automations_at(text, timestamptz);

create or replace function public.enqueue_due_reminders(p_base_url text, p_clinic uuid default null)
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
      and (p_clinic is null or a.clinic_id = p_clinic)
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

create or replace function public.enqueue_due_task_alerts(p_clinic uuid default null)
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
       and (p_clinic is null or t.clinic_id = p_clinic)
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

create or replace function public.enqueue_due_automations_at(p_base_url text, p_now timestamptz, p_clinic uuid default null)
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
       and (p_clinic is null or ca.clinic_id = p_clinic)
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
       and (p_clinic is null or ca.clinic_id = p_clinic)
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
       and (p_clinic is null or ca.clinic_id = p_clinic)
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
       and (p_clinic is null or ca.clinic_id = p_clinic)
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

-- The job as the schedule calls it: now, every clinic.
create or replace function public.enqueue_due_automations(p_base_url text, p_clinic uuid default null)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.enqueue_due_automations_at(p_base_url, now(), p_clinic);
$$;

-- ---------------------------------------------------------------------------
-- Who may run them
-- ---------------------------------------------------------------------------
-- Nobody but the database owner, which is what `cron.schedule` runs as. The
-- whole-service form is the thing that was dangerous in a member's hands.

revoke all on function public.enqueue_due_reminders(text, uuid) from public;
revoke execute on function public.enqueue_due_reminders(text, uuid) from anon, authenticated;

revoke all on function public.enqueue_due_task_alerts(uuid) from public;
revoke execute on function public.enqueue_due_task_alerts(uuid) from anon, authenticated;

revoke all on function public.enqueue_due_automations(text, uuid) from public;
revoke execute on function public.enqueue_due_automations(text, uuid) from anon, authenticated;

revoke all on function public.enqueue_due_automations_at(text, timestamptz, uuid) from public;
revoke execute on function public.enqueue_due_automations_at(text, timestamptz, uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- enqueue_now_for_my_clinic — what the Messages screen calls
-- ---------------------------------------------------------------------------
-- The screen's "send now" button exists so the queue is never an hour behind.
-- It runs the same three jobs, pinned to the caller's own clinic, so pressing
-- it can never reach another clinic's patients.
--
-- `p_base_url` stays a parameter because the database does not know the app's
-- address. What a caller can do with it is now bounded: the links it builds go
-- only into their own clinic's messages, to their own clinic's patients.

create or replace function public.enqueue_now_for_my_clinic(p_base_url text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid := public.current_clinic_id();
begin
  -- Null for anyone who is not an active member, and for a session that has
  -- not yet given its second-factor code: both are told no, not given zero.
  if v_clinic is null then
    raise exception 'forbidden';
  end if;

  return public.enqueue_due_reminders(p_base_url, v_clinic)
       + public.enqueue_due_task_alerts(v_clinic)
       + public.enqueue_due_automations(p_base_url, v_clinic);
end;
$$;

comment on function public.enqueue_now_for_my_clinic(text) is
  'Tops up the message queue for the caller''s own clinic. The three jobs behind it run for every clinic and are the database owner''s alone; this is the door a signed-in member has to them.';

revoke all on function public.enqueue_now_for_my_clinic(text) from public;
grant execute on function public.enqueue_now_for_my_clinic(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 · log_record_access: only real records, only the caller's own
-- ---------------------------------------------------------------------------
-- The function had definer rights precisely so the trail could not be forged,
-- and then took the table name and the record id on trust. A member could
-- write "viewed" rows naming a table that does not exist, or a record they
-- never opened. Both are now refused: the table must be one this system logs,
-- and the record must be one the caller could actually have read.
--
-- The portal reaches this too. A patient reading their own file has no
-- membership, so the clinic comes from their own patient row — and the record
-- must be theirs, not merely their clinic's.

create or replace function public.log_record_access(
  p_table text,
  p_record uuid,
  p_action text default 'view'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_patient uuid;
  v_user uuid := auth.uid();
  v_belongs boolean;
begin
  if v_user is null or p_record is null then
    return;
  end if;

  if p_action not in ('view', 'export') then
    raise exception 'log_record_access only records view or export';
  end if;

  -- A closed list, not a free-text column. Anything outside it is a caller
  -- inventing history.
  if p_table not in (
    'patients', 'encounters', 'tcm_notes', 'patient_documents', 'invoices',
    'appointments', 'form_submissions', 'dispensing_records', 'treatment_confirmations'
  ) then
    raise exception 'log_record_access does not record %', p_table;
  end if;

  v_clinic := public.current_clinic_id();

  if v_clinic is null then
    -- The portal: a patient, reading their own.
    v_patient := public.current_patient_id();
    if v_patient is null then
      return;
    end if;
    if p_table not in ('patients', 'patient_documents', 'invoices', 'appointments', 'form_submissions') then
      raise exception 'log_record_access does not record % from the portal', p_table;
    end if;
    execute format(
      'select exists (select 1 from public.%I where id = $1 and %I = $2)',
      p_table,
      case when p_table = 'patients' then 'id' else 'patient_id' end
    ) into v_belongs using p_record, v_patient;
    if not v_belongs then
      raise exception 'log_record_access: that record is not this patient''s';
    end if;
    select p.clinic_id into v_clinic from public.patients p where p.id = v_patient;
    if v_clinic is null then
      return;
    end if;
  else
    -- Staff. Definer rights see past RLS, so the clinic is checked here by
    -- hand rather than assumed from the fact that the read succeeded.
    execute format('select exists (select 1 from public.%I where id = $1 and clinic_id = $2)', p_table)
      into v_belongs using p_record, v_clinic;
    if not v_belongs then
      raise exception 'log_record_access: that record is not in this clinic';
    end if;
  end if;

  -- An export is always recorded; a repeat view within the window is not.
  if p_action = 'view' and exists (
    select 1 from public.audit_log
    where clinic_id = v_clinic
      and table_name = p_table
      and record_id = p_record
      and changed_by = v_user
      and action = 'view'
      and changed_at > now() - interval '15 minutes'
  ) then
    return;
  end if;

  insert into public.audit_log (clinic_id, table_name, record_id, action, changed_by, diff)
  values (v_clinic, p_table, p_record, p_action, v_user, null);
end;
$$;

comment on function public.log_record_access is
  'Records that a user read or exported a record. Definer rights so the entry cannot be forged or skipped by a client; the table must be one of the nine this system logs and the record must belong to the caller''s clinic — or, from the portal, to the patient themselves. Views are deduplicated over fifteen minutes so one act of looking is one row.';

revoke all on function public.log_record_access(text, uuid, text) from public;
grant execute on function public.log_record_access(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · Five more tables under the audit trigger
-- ---------------------------------------------------------------------------
-- The trigger has covered changes to the patient record and its clinical notes
-- since the first milestone. These five hold patient data too and were never
-- attached:
--
--   patient_documents      — an upload, a deletion, and `shared_with_patient`,
--                            the flag that puts a file in front of the portal
--   appointments           — who moved, cancelled or marked a visit
--   dispensing_records     — what was handed to a patient
--   payments               — money marked received
--   patient_portal_access  — who was granted, or refused, a patient's file
--
-- `write_audit_log` reads clinic_id from the row, and all five carry one.
-- `changed_by` stays null for a row written with no session (an online
-- booking), which is itself worth seeing in the trail.

drop trigger if exists patient_documents_audit on public.patient_documents;
create trigger patient_documents_audit
  after insert or update or delete on public.patient_documents
  for each row execute function public.write_audit_log();

drop trigger if exists appointments_audit on public.appointments;
create trigger appointments_audit
  after insert or update or delete on public.appointments
  for each row execute function public.write_audit_log();

drop trigger if exists dispensing_records_audit on public.dispensing_records;
create trigger dispensing_records_audit
  after insert or update or delete on public.dispensing_records
  for each row execute function public.write_audit_log();

drop trigger if exists payments_audit on public.payments;
create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function public.write_audit_log();

drop trigger if exists patient_portal_access_audit on public.patient_portal_access;
create trigger patient_portal_access_audit
  after insert or update or delete on public.patient_portal_access
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 5 · The portal's password door, answerable before the claim
-- ---------------------------------------------------------------------------
-- The reviewers' password door is checked by the database, which is right. But
-- it matched on `user_id`, and `user_id` is only filled in by
-- `claim_portal_access` — so the sign-in had to claim the patient file first
-- and ask afterwards, which gave a real patient holding a password a live
-- session and a claimed row before being turned away.
--
-- Matching the address as well as the id lets the question be asked first. The
-- answer is the same one: only inside a synthetic clinic.

create or replace function public.portal_password_login_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.patient_portal_access a
      join public.clinics c on c.id = a.clinic_id
     where a.is_active
       and c.is_synthetic
       and (
         a.user_id = auth.uid()
         or lower(a.email) = (select lower(u.email) from auth.users u where u.id = auth.uid())
       )
  );
$$;

revoke all on function public.portal_password_login_allowed() from public;
grant execute on function public.portal_password_login_allowed() to authenticated;

comment on function public.portal_password_login_allowed() is
  'True only when the signed-in portal user belongs to a synthetic (sandbox) clinic: the stores'' reviewers sign in with a password there; a real patient never does. Matches on the address as well as the id, so it can be asked before the patient file is claimed.';
