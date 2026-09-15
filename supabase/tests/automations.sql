-- ============================================================================
--  Automated messages — what goes, to whom, and only once
-- ============================================================================
--  Run in the Supabase SQL editor after 54_messaging_automations_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a follow-up goes once per treatment that happened, and not for a
--       booking whose moment passed more than two days ago
--    2. a birthday greeting and a review request go only to a patient whose
--       standing marketing consent is "granted", and carry the removal link
--    3. a nudge goes to a patient in treatment with nothing booked and no
--       visit for a season, with the booking link
--    4. nothing before the clinic's chosen hour, and nothing twice
--    5. the removal link withdraws consent — a new decision in the history,
--       marked as having come through the link — and a second tap is harmless
--    6. another clinic's patients are untouched, and a random token is nobody
--
--  The job takes its moment as an argument here (the owner-only form), so the
--  checks do not depend on the hour this file happens to be run at.
-- ============================================================================

begin;

do $test$
declare
  v_clinic   uuid;
  v_other    uuid;
  v_user     uuid := gen_random_uuid();
  v_a        uuid;   -- birthday today, consent, a treatment yesterday
  v_b        uuid;   -- birthday today, no consent
  v_c        uuid;   -- in treatment, last visit 100 days ago, consent
  v_d        uuid;   -- birthday today, consent — used for the hour check
  v_f        uuid;   -- a treatment that ended 80 hours ago: too long ago
  v_doc      uuid;
  v_token    uuid;
  v_noon     timestamptz;
  v_dawn     timestamptz;
  v_today    date;
  v_count    integer;
  v_queued   integer;
  v_body     text;
  v_params   jsonb;
  v_granted  boolean;
  v_method   text;
  v_info     record;
begin
  -- Today, noon, in the clinic's own zone: a moment every automation may fire.
  v_today := (now() at time zone 'Asia/Jerusalem')::date;
  v_noon := (v_today::text || ' 12:00')::timestamp at time zone 'Asia/Jerusalem';
  v_dawn := (v_today::text || ' 05:00')::timestamp at time zone 'Asia/Jerusalem';

  -- ------------------------------------------------------------------------
  -- Fixtures
  -- ------------------------------------------------------------------------
  insert into public.clinics (name, slug, timezone, reminder_channel, google_review_url, booking_enabled, booking_slug)
  values ('Auto Test', 'auto-test-' || gen_random_uuid(), 'Asia/Jerusalem', 'sms',
          'https://g.page/r/auto-test', true, 'auto-test-x')
  returning id into v_clinic;

  insert into public.clinics (name, slug, timezone, reminder_channel)
  values ('Auto Other', 'auto-other-' || gen_random_uuid(), 'Asia/Jerusalem', 'sms')
  returning id into v_other;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'auto-' || v_user || '@example.test', '', now(), now(), now());

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic, v_user, 'owner', true);

  insert into public.clinic_automations (clinic_id, kind, enabled, delay_hours, inactive_days, send_hour)
  values (v_clinic, 'treatment_followup', true, 24, 90, 6),
         (v_clinic, 'birthday', true, 24, 90, 6),
         (v_clinic, 'inactive_reengage', true, 24, 90, 6),
         (v_clinic, 'review_request', true, 24, 90, 6),
         (v_other, 'birthday', true, 24, 90, 6);

  insert into public.consent_documents (clinic_id, kind, version, locale, title, body, published_at)
  values (v_clinic, 'marketing', 1, 'he', 'דיוור', 'נוסח', now())
  returning id into v_doc;

  insert into public.patients (clinic_id, first_name, last_name, phone, date_of_birth)
  values (v_clinic, 'Auto', 'Alpha', '050-0001111', make_date(1980, extract(month from v_today)::int, extract(day from v_today)::int))
  returning id into v_a;
  insert into public.patients (clinic_id, first_name, last_name, phone, date_of_birth)
  values (v_clinic, 'Auto', 'Beta', '050-0002222', make_date(1984, extract(month from v_today)::int, extract(day from v_today)::int))
  returning id into v_b;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Auto', 'Gamma', '050-0003333')
  returning id into v_c;
  insert into public.patients (clinic_id, first_name, last_name, phone, date_of_birth)
  values (v_clinic, 'Auto', 'Delta', '050-0004444', make_date(1988, extract(month from v_today)::int, extract(day from v_today)::int))
  returning id into v_d;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Auto', 'Foxtrot', '050-0005555')
  returning id into v_f;
  -- The other clinic's patient: birthday today, consent — and nothing enabled for followup.
  insert into public.patients (clinic_id, first_name, last_name, phone, date_of_birth)
  values (v_other, 'Other', 'Person', '050-0009999', make_date(1976, extract(month from v_today)::int, extract(day from v_today)::int));

  insert into public.patient_consents (clinic_id, patient_id, document_id, kind, granted, method)
  values (v_clinic, v_a, v_doc, 'marketing', true, 'in_person'),
         (v_clinic, v_c, v_doc, 'marketing', true, 'in_person'),
         (v_clinic, v_d, v_doc, 'marketing', true, 'in_person');

  -- A treatment for Alpha that ended 26 hours before noon, marked completed.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at, status)
  values (v_clinic, v_a, v_user, v_noon - interval '27 hours', v_noon - interval '26 hours', 'completed');
  -- Gamma's last visit, 100 days ago; nothing ahead.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at, status)
  values (v_clinic, v_c, v_user, v_noon - interval '100 days', v_noon - interval '100 days' + interval '1 hour', 'completed');
  -- Foxtrot's treatment ended 80 hours ago: due 56 hours ago, past the window.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at, status)
  values (v_clinic, v_f, v_user, v_noon - interval '81 hours', v_noon - interval '80 hours', 'completed');

  -- ------------------------------------------------------------------------
  -- 4 (first half) · Before the clinic's hour, nothing goes
  -- ------------------------------------------------------------------------
  v_queued := public.enqueue_due_automations_at('https://t.test', v_dawn);
  select count(*) into v_count from public.message_log where clinic_id = v_clinic and template_key in ('birthday', 'inactive_reengage');
  if v_count <> 0 then raise exception 'FAIL: % greeting/nudge row(s) were queued at 05:00, before the clinic''s hour', v_count; end if;
  raise notice 'ok   nothing goes before the clinic''s chosen hour';

  -- ------------------------------------------------------------------------
  -- 1–3 · At noon: one of each, to the right people
  -- ------------------------------------------------------------------------
  v_queued := public.enqueue_due_automations_at('https://t.test', v_noon);

  select count(*), min(body), min(params::text)::jsonb into v_count, v_body, v_params
    from public.message_log where clinic_id = v_clinic and template_key = 'treatment_followup';
  if v_count <> 1 then raise exception 'FAIL: expected one follow-up, found %', v_count; end if;
  if v_params <> '["Auto", "Auto Test"]'::jsonb then raise exception 'FAIL: follow-up params were %', v_params; end if;
  if position('Auto Test' in v_body) = 0 then raise exception 'FAIL: the follow-up does not name the clinic'; end if;
  if position('להסרה' in v_body) > 0 then raise exception 'FAIL: a service message carried the removal line'; end if;
  select count(*) into v_count from public.message_log where patient_id = v_f;
  if v_count <> 0 then raise exception 'FAIL: a treatment 80 hours old got a follow-up'; end if;
  raise notice 'ok   one follow-up per treatment that happened, none for one long past';

  select count(*) into v_count from public.message_log where patient_id = v_a and template_key = 'birthday';
  if v_count <> 1 then raise exception 'FAIL: expected one birthday greeting for Alpha, found %', v_count; end if;
  select count(*) into v_count from public.message_log where patient_id = v_b;
  if v_count <> 0 then raise exception 'FAIL: Beta, without marketing consent, got % message(s)', v_count; end if;
  select body into v_body from public.message_log where patient_id = v_a and template_key = 'birthday';
  if position('להסרה' in v_body) = 0 or position('https://t.test/he/unsubscribe/' in v_body) = 0 then
    raise exception 'FAIL: the greeting has no removal link: %', v_body;
  end if;
  raise notice 'ok   a greeting goes only with consent, and carries the removal link';

  select count(*), min(body) into v_count, v_body from public.message_log where patient_id = v_a and template_key = 'review_request';
  if v_count <> 1 then raise exception 'FAIL: expected one review request for Alpha, found %', v_count; end if;
  if position('https://g.page/r/auto-test' in v_body) = 0 then raise exception 'FAIL: the review request has no Google link'; end if;
  raise notice 'ok   a review request follows a visit, with the clinic''s link';

  select count(*), min(body) into v_count, v_body from public.message_log where patient_id = v_c and template_key = 'inactive_reengage';
  if v_count <> 1 then raise exception 'FAIL: expected one nudge for Gamma, found %', v_count; end if;
  if position('https://t.test/he/book/auto-test-x' in v_body) = 0 then raise exception 'FAIL: the nudge has no booking link: %', v_body; end if;
  raise notice 'ok   a nudge goes to a lapsed patient, with the booking link';

  select count(*) into v_count from public.message_log where clinic_id = v_clinic and status = 'queued';
  if v_count <> 5 then raise exception 'FAIL: expected 5 queued rows in all (follow-up, 2 greetings, review, nudge), found %', v_count; end if;
  if v_queued <> 5 then raise exception 'FAIL: the job reported % rows, queued 5', v_queued; end if;

  -- The other clinic has its own greeting switched on; its patient gets it only
  -- once its consent is recorded — which it is not.
  select count(*) into v_count from public.message_log where clinic_id = v_other;
  if v_count <> 0 then raise exception 'FAIL: the other clinic''s patient, without consent, got % message(s)', v_count; end if;
  raise notice 'ok   another clinic is judged by its own rows and its own consents';

  -- ------------------------------------------------------------------------
  -- 4 (second half) · Nothing twice
  -- ------------------------------------------------------------------------
  v_queued := public.enqueue_due_automations_at('https://t.test', v_noon + interval '1 hour');
  if v_queued <> 0 then raise exception 'FAIL: a second run an hour later queued % more row(s)', v_queued; end if;
  raise notice 'ok   a second run adds nothing';

  -- ------------------------------------------------------------------------
  -- 5 · The removal link
  -- ------------------------------------------------------------------------
  select token into v_token from public.patient_unsubscribe_tokens where patient_id = v_a;
  if v_token is null then raise exception 'FAIL: no removal token was made for Alpha'; end if;

  select * into v_info from public.unsubscribe_info(v_token);
  if v_info.clinic_name <> 'Auto Test' or v_info.first_name <> 'Auto' or v_info.already_withdrawn then
    raise exception 'FAIL: unsubscribe_info said % / % / withdrawn=%', v_info.clinic_name, v_info.first_name, v_info.already_withdrawn;
  end if;

  if not public.unsubscribe_marketing(v_token) then raise exception 'FAIL: the removal link was refused'; end if;
  select granted, method into v_granted, v_method from public.patient_consent_status where patient_id = v_a and kind = 'marketing';
  if v_granted is distinct from false or v_method <> 'link' then
    raise exception 'FAIL: after the link, the standing marketing answer is % via %', v_granted, v_method;
  end if;
  select count(*) into v_count from public.patient_consents where patient_id = v_a and kind = 'marketing';
  if v_count <> 2 then raise exception 'FAIL: expected the grant and the withdrawal, found % row(s)', v_count; end if;

  if not public.unsubscribe_marketing(v_token) then raise exception 'FAIL: a second tap was refused'; end if;
  select count(*) into v_count from public.patient_consents where patient_id = v_a and kind = 'marketing';
  if v_count <> 2 then raise exception 'FAIL: a second tap added a row (% in all)', v_count; end if;
  select * into v_info from public.unsubscribe_info(v_token);
  if not v_info.already_withdrawn then raise exception 'FAIL: the page does not know the consent is withdrawn'; end if;
  raise notice 'ok   the removal link withdraws consent once, through the history';

  -- With the greeting and the review gone from the log, a fresh run finds
  -- Alpha again — and now leaves them alone.
  delete from public.message_log where patient_id = v_a and template_key in ('birthday', 'review_request');
  v_queued := public.enqueue_due_automations_at('https://t.test', v_noon + interval '2 hours');
  select count(*) into v_count from public.message_log where patient_id = v_a and template_key in ('birthday', 'review_request');
  if v_count <> 0 then raise exception 'FAIL: % marketing row(s) queued after the consent was withdrawn', v_count; end if;
  raise notice 'ok   a withdrawn consent stops the marketing messages';

  -- ------------------------------------------------------------------------
  -- 6 · A random token is nobody
  -- ------------------------------------------------------------------------
  if public.unsubscribe_marketing(gen_random_uuid()) then raise exception 'FAIL: a random token withdrew something'; end if;
  select count(*) into v_count from public.unsubscribe_info(gen_random_uuid());
  if v_count <> 0 then raise exception 'FAIL: a random token showed a page'; end if;
  raise notice 'ok   a random token opens onto nothing';

  raise notice ' ';
  raise notice 'ALL AUTOMATION CHECKS PASSED';
end
$test$;

rollback;
