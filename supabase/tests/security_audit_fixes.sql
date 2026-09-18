-- ============================================================================
--  The 18.9 audit fixes (migrations 20260919090000 and 20260919092000)
-- ============================================================================
--  Paste into the Supabase SQL editor after 74_security_audit_fixes_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a patient's questionnaire or consent from the portal takes its clinic
--       from the patient (it failed on a null clinic before)
--    2. portal access is granted by the owner only, and never with a user id
--    3. nobody writes memberships directly
--    4. a wrong booking code is counted, and five end it; a second code within
--       the minute is refused; every outcome is a typed result
--    5. the booking page offers only practitioners; an existing patient booked
--       online is not linked to the practitioner (a task asks the desk), a new
--       file is
--    6. Grow settlement checks the amount, is idempotent, and a paid payment
--       never regresses; the invoice status follows what was paid
--    7. moving an appointment withdraws its queued reminder and clears the mark
--    8. the queue is claimed atomically: two claims never return one row, a
--       stale claim stops as stalled, a push to an outsider is dropped
--    9. from the app, the log takes only a test message to oneself, and an
--       update may only skip
--   10. dispensing with a key twice dispenses once
--   11. the access log refuses a record the caller cannot read
--   12. "send now" refuses a link base that is not an origin
--   13. the restricted functions are closed to members and anonymous callers
-- ============================================================================

begin;

do $test$
declare
  v_clinic    uuid;
  v_owner     uuid := gen_random_uuid();
  v_prac      uuid := gen_random_uuid();
  v_desk      uuid := gen_random_uuid();
  v_portal    uuid := gen_random_uuid();
  v_patient   uuid;
  v_known     uuid;
  v_type      uuid;
  v_day       date;
  v_slot      timestamptz;
  v_result    jsonb;
  v_count     integer;
  v_ok        boolean;
  v_text      text;
  v_invoice   uuid;
  v_payment   uuid;
  v_appt      uuid;
  v_msg       uuid;
  v_msg2      uuid;
  v_ids       uuid[];
  v_ids2      uuid[];
  v_encounter uuid;
  v_herb      uuid;
  v_before    numeric;
  v_after     numeric;
  v_rec1      uuid;
  v_rec2      uuid;
  v_key       uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values
      (v_owner, 'owner@audit.test'), (v_prac, 'prac@audit.test'),
      (v_desk, 'desk@audit.test'), (v_portal, 'patient@audit.test')
    ) as u(id, email);
  insert into public.profiles (id, full_name, phone)
  values (v_owner, 'Owner', '0500000001'), (v_prac, 'Practitioner', '0500000002'), (v_desk, 'Desk', '0500000003')
  on conflict (id) do update set phone = excluded.phone;

  insert into public.clinics (name, slug, booking_enabled, booking_slug, booking_verify_sms, booking_lead_hours)
  values ('Audit fixes', 'audit-fixes', true, 'audit-fixes', true, 0)
  returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role) values
    (v_clinic, v_owner, 'owner'), (v_clinic, v_prac, 'practitioner'), (v_clinic, v_desk, 'staff');

  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Dana', 'Levi', '050-123-4567') returning id into v_known;
  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic, 'Portal', 'Patient') returning id into v_patient;
  insert into public.patient_portal_access (clinic_id, patient_id, user_id, email, activated_at)
  values (v_clinic, v_patient, v_portal, 'patient@audit.test', now());

  insert into public.appointment_types (clinic_id, name_he, name_en, default_duration_minutes, online_bookable)
  values (v_clinic, 'טיפול', 'Treatment', 60, true) returning id into v_type;

  -- A day three days out, the practitioner working 08:00–20:00 on it.
  select ((now() at time zone c.timezone)::date + 3) into v_day from public.clinics c where c.id = v_clinic;
  insert into public.practitioner_schedules (clinic_id, practitioner_id, weekday, start_time, end_time)
  values (v_clinic, v_prac, extract(dow from v_day)::int, '08:00', '20:00');
  select ((v_day + time '10:00') at time zone c.timezone) into v_slot from public.clinics c where c.id = v_clinic;

  -- 1 · the portal -------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_portal, 'role', 'authenticated')::text, true);
  insert into public.patient_consents (patient_id, kind, method, granted)
  values (v_patient, 'marketing', 'portal', false);
  perform set_config('role', 'postgres', true);
  select count(*) into v_count from public.patient_consents where patient_id = v_patient and clinic_id = v_clinic;
  if v_count <> 1 then raise exception 'FAIL 1: the portal consent did not take the patient''s clinic'; end if;
  raise notice 'PASS 1: a portal row takes its clinic from the patient';

  -- 2 · portal access --------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    insert into public.patient_portal_access (clinic_id, patient_id, email) values (v_clinic, v_known, 'x@audit.test');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 2: a practitioner granted portal access'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    insert into public.patient_portal_access (clinic_id, patient_id, email, user_id) values (v_clinic, v_known, 'x@audit.test', v_owner);
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 2: the owner granted portal access to a user id'; end if;
  insert into public.patient_portal_access (clinic_id, patient_id, email) values (v_clinic, v_known, 'dana@audit.test');
  raise notice 'PASS 2: portal access is the owner''s to grant, and only by address';

  -- 3 · memberships ------------------------------------------------------------
  v_ok := false;
  begin
    insert into public.memberships (clinic_id, user_id, role) values (v_clinic, v_portal, 'owner');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 3: an owner wrote a membership directly'; end if;
  raise notice 'PASS 3: memberships are written only by the functions';

  -- 4 · the booking code -------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  v_result := public.booking_send_code('audit-fixes', '050-999-0000');
  if not (v_result ->> 'ok')::boolean then raise exception 'FAIL 4: the first code was refused: %', v_result; end if;
  v_result := public.booking_send_code('audit-fixes', '050-999-0000');
  if v_result ->> 'reason' is distinct from 'cooldown' then raise exception 'FAIL 4: a second code within the minute: %', v_result; end if;

  for i in 1..5 loop
    v_result := public.booking_request('audit-fixes', v_type, v_prac, null, v_slot,
      'Guess', 'Er', '050-999-0000', null, null, 'wrong!');
    if (v_result ->> 'ok')::boolean then raise exception 'FAIL 4: a wrong code booked'; end if;
  end loop;
  if v_result ->> 'reason' is distinct from 'bad_code' then raise exception 'FAIL 4: the fifth wrong code said %', v_result; end if;
  v_result := public.booking_request('audit-fixes', v_type, v_prac, null, v_slot,
    'Guess', 'Er', '050-999-0000', null, null, 'wrong!');
  if v_result ->> 'reason' is distinct from 'code_expired' then raise exception 'FAIL 4: a sixth guess was allowed: %', v_result; end if;
  perform set_config('role', 'postgres', true);
  select attempts into v_count from public.booking_codes where clinic_id = v_clinic order by created_at desc limit 1;
  if v_count <> 5 then raise exception 'FAIL 4: % wrong guesses were counted, expected 5', v_count; end if;
  raise notice 'PASS 4: wrong codes are counted and five end the code';

  -- 5 · who the page books, and who it links ----------------------------------
  update public.clinics set booking_verify_sms = false where id = v_clinic;
  perform set_config('role', 'anon', true);
  v_result := public.booking_request('audit-fixes', v_type, v_desk, null, v_slot,
    'Dana', 'Levi', '0501234567', null, null, null);
  if v_result ->> 'reason' is distinct from 'slot_taken' then raise exception 'FAIL 5: the secretary was bookable: %', v_result; end if;

  v_result := public.booking_request('audit-fixes', v_type, v_prac, null, v_slot,
    'Dana', 'Levi', '0501234567', null, null, null);
  if not (v_result ->> 'ok')::boolean then raise exception 'FAIL 5: the booking failed: %', v_result; end if;
  perform set_config('role', 'postgres', true);
  if exists (select 1 from public.patient_practitioners where patient_id = v_known and user_id = v_prac) then
    raise exception 'FAIL 5: an online booking made an existing patient the practitioner''s';
  end if;
  if not exists (select 1 from public.clinic_tasks where clinic_id = v_clinic and patient_id = v_known) then
    raise exception 'FAIL 5: no task asked the desk to confirm the practitioner';
  end if;

  perform set_config('role', 'anon', true);
  v_result := public.booking_request('audit-fixes', v_type, v_prac, null, v_slot + interval '2 hours',
    'Newcomer', '', '0547777777', null, null, null);
  if not (v_result ->> 'ok')::boolean then raise exception 'FAIL 5: a new patient could not book: %', v_result; end if;
  perform set_config('role', 'postgres', true);
  if not exists (
    select 1 from public.patient_practitioners pp join public.patients p on p.id = pp.patient_id
     where p.clinic_id = v_clinic and p.first_name = 'Newcomer' and pp.user_id = v_prac
  ) then raise exception 'FAIL 5: the file a booking opened was not linked'; end if;
  raise notice 'PASS 5: the page books practitioners, and links only the file it opened';

  -- 6 · Grow settlement --------------------------------------------------------
  insert into public.invoices (clinic_id, patient_id, status, issued_at)
  values (v_clinic, v_known, 'sent', now()) returning id into v_invoice;
  insert into public.invoice_items (clinic_id, invoice_id, description, quantity, unit_price, line_total)
  values (v_clinic, v_invoice, 'Treatment', 1, 100, 100);
  insert into public.payments (clinic_id, invoice_id, amount, provider, provider_process_id, provider_process_token)
  values (v_clinic, v_invoice, 100, 'grow', 'proc-1', 'tok-1') returning id into v_payment;

  v_result := public.settle_grow_payment('proc-1', 'tok-1', 'tx-1', 'paid', null, 90, 'ILS');
  if v_result ->> 'reason' is distinct from 'amount_mismatch' then raise exception 'FAIL 6: a short amount settled: %', v_result; end if;
  v_result := public.settle_grow_payment('proc-1', 'wrong', 'tx-1', 'paid', null, 100, 'ILS');
  if v_result ->> 'reason' is distinct from 'payment_token_mismatch' then raise exception 'FAIL 6: a wrong token settled: %', v_result; end if;
  v_result := public.settle_grow_payment('proc-1', 'tok-1', 'tx-1', 'paid', null, 100, 'ILS');
  if not (v_result ->> 'changed')::boolean then raise exception 'FAIL 6: the payment did not settle: %', v_result; end if;
  select status into v_text from public.invoices where id = v_invoice;
  if v_text <> 'paid' then raise exception 'FAIL 6: the invoice says % after full payment', v_text; end if;

  v_result := public.settle_grow_payment('proc-1', 'tok-1', 'tx-1', 'paid', null, 100, 'ILS');
  if (v_result ->> 'changed')::boolean then raise exception 'FAIL 6: a replayed callback changed the payment'; end if;
  v_result := public.settle_grow_payment('proc-1', 'tok-1', null, 'failed', null, null, null);
  select status into v_text from public.payments where id = v_payment;
  if v_text <> 'paid' then raise exception 'FAIL 6: a late failure turned a paid payment into %', v_text; end if;

  insert into public.invoice_items (clinic_id, invoice_id, description, quantity, unit_price, line_total)
  values (v_clinic, v_invoice, 'Herbs', 1, 50, 50);
  select status into v_text from public.invoices where id = v_invoice;
  if v_text <> 'partially_paid' then raise exception 'FAIL 6: a line added to a paid invoice left it %', v_text; end if;
  raise notice 'PASS 6: settlement checks the amount, is idempotent, and never goes back';

  -- 7 · moving re-arms the reminder -------------------------------------------
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at, reminder_sent_at)
  values (v_clinic, v_known, v_prac, now() + interval '5 days', now() + interval '5 days 1 hour', now())
  returning id into v_appt;
  insert into public.message_log (clinic_id, channel, template_key, recipient, body, appointment_id, status)
  values (v_clinic, 'sms', 'appointment_reminder', '0501234567', 'old time', v_appt, 'queued') returning id into v_msg;
  insert into public.message_log (clinic_id, channel, template_key, recipient, body, appointment_id, status, claimed_at)
  values (v_clinic, 'sms', 'appointment_reminder', '0501234567', 'being sent', v_appt, 'sending', now()) returning id into v_msg2;
  update public.appointments set start_at = start_at + interval '1 day', end_at = end_at + interval '1 day' where id = v_appt;
  select status into v_text from public.message_log where id = v_msg;
  if v_text <> 'skipped' then raise exception 'FAIL 7: the queued reminder for the old time is %', v_text; end if;
  select status into v_text from public.message_log where id = v_msg2;
  if v_text <> 'sending' then raise exception 'FAIL 7: a reminder being sent was touched (%)', v_text; end if;
  if exists (select 1 from public.appointments where id = v_appt and (reminder_sent_at is not null or rescheduled_at is null)) then
    raise exception 'FAIL 7: the moved appointment kept its reminder mark';
  end if;
  raise notice 'PASS 7: a move withdraws the waiting reminder and re-arms the next';

  -- 8 · the queue --------------------------------------------------------------
  update public.message_log set status = 'skipped' where status in ('queued', 'sending');
  insert into public.message_log (clinic_id, channel, template_key, recipient, body, status)
  select v_clinic, 'sms', 'test_message', '050000000' || g, 'q' || g, 'queued' from generate_series(1, 3) g;
  select array_agg(id) into v_ids from public.claim_queued_messages(array['sms'], 'worker-a', 2);
  select array_agg(id) into v_ids2 from public.claim_queued_messages(array['sms'], 'worker-b', 2);
  if coalesce(array_length(v_ids, 1), 0) <> 2 or coalesce(array_length(v_ids2, 1), 0) <> 1 then
    raise exception 'FAIL 8: claims returned % and % rows, expected 2 and 1', array_length(v_ids, 1), array_length(v_ids2, 1);
  end if;
  if v_ids && v_ids2 then raise exception 'FAIL 8: two claims returned the same row'; end if;
  select count(*) into v_count from public.message_log where id = any(v_ids || v_ids2) and status = 'sending';
  if v_count <> 3 then raise exception 'FAIL 8: % of 3 claimed rows are sending', v_count; end if;

  update public.message_log set claimed_at = now() - interval '1 hour' where id = v_ids[1];
  perform public.claim_queued_messages(array['sms'], 'worker-c', 10);
  select status into v_text from public.message_log where id = v_ids[1];
  if v_text <> 'stalled' then raise exception 'FAIL 8: an abandoned claim is %, not stalled', v_text; end if;

  insert into public.message_log (clinic_id, channel, template_key, recipient, body, status)
  values (v_clinic, 'push', 'task_alert', gen_random_uuid()::text, 'to a stranger', 'queued') returning id into v_msg;
  perform public.claim_queued_messages(array['push'], 'worker-d', 10);
  select status into v_text from public.message_log where id = v_msg;
  if v_text <> 'skipped' then raise exception 'FAIL 8: a push to someone outside the clinic is %', v_text; end if;
  raise notice 'PASS 8: the queue is claimed once, stalls for a person, and pushes stay in the clinic';

  -- 9 · the log from the app ---------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    insert into public.message_log (clinic_id, channel, template_key, recipient, body, status)
    values (v_clinic, 'sms', 'anything', '0529999999', 'Click here', 'queued');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 9: a member queued a message to anyone'; end if;
  insert into public.message_log (clinic_id, channel, template_key, recipient, body, status)
  values (v_clinic, 'sms', 'test_message', '0500000003', 'Test', 'queued') returning id into v_msg;

  v_ok := false;
  begin
    update public.message_log set status = 'sent' where id = v_msg;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 9: a member marked a message sent by writing the row'; end if;
  update public.message_log set status = 'skipped', error_code = 'skipped_by_staff' where id = v_msg;
  perform set_config('role', 'postgres', true);
  select status into v_text from public.message_log where id = v_msg;
  if v_text <> 'skipped' then raise exception 'FAIL 9: skipping a message did not stick'; end if;
  raise notice 'PASS 9: the app writes only a test to oneself, and may only skip';

  -- 10 · dispensing once -------------------------------------------------------
  insert into public.encounters (clinic_id, patient_id, practitioner_id, encounter_date)
  values (v_clinic, v_known, v_prac, current_date) returning id into v_encounter;
  insert into public.herbs (clinic_id, pinyin_name) values (v_clinic, 'Audit Herb') returning id into v_herb;
  insert into public.herb_batches (clinic_id, herb_id, quantity_received, quantity_remaining)
  values (v_clinic, v_herb, 100, 100);
  select sum(quantity_remaining) into v_before from public.herb_batches where herb_id = v_herb;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac, 'role', 'authenticated')::text, true);
  v_rec1 := public.dispense_with_details(v_encounter, null,
    jsonb_build_array(jsonb_build_object('herb_id', v_herb, 'quantity', 10, 'unit', 'gram')),
    1, null, null, null, null, null, null, v_key);
  v_rec2 := public.dispense_with_details(v_encounter, null,
    jsonb_build_array(jsonb_build_object('herb_id', v_herb, 'quantity', 10, 'unit', 'gram')),
    1, null, null, null, null, null, null, v_key);
  perform set_config('role', 'postgres', true);
  if v_rec1 is distinct from v_rec2 then raise exception 'FAIL 10: the same key dispensed twice'; end if;
  select sum(quantity_remaining) into v_after from public.herb_batches where herb_id = v_herb;
  if v_before - v_after <> 10 then raise exception 'FAIL 10: % grams left the jar for one dispensing of 10', v_before - v_after; end if;
  raise notice 'PASS 10: one key, one dispensing';

  -- 11 · the access log --------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    perform public.log_record_access('encounters', v_encounter, 'view');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 11: the secretary logged a view of a treatment record'; end if;
  perform public.log_record_access('patients', v_known, 'view');
  raise notice 'PASS 11: the access log records only what the caller reads';

  -- 12 · "send now" -----------------------------------------------------------
  v_ok := false;
  begin
    perform public.enqueue_now_for_my_clinic('https://evil.example/phish?x=');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 12: a link base with a path and query was accepted'; end if;
  raise notice 'PASS 12: the link base must be an origin';
  perform set_config('role', 'postgres', true);

  -- 13 · closed doors ----------------------------------------------------------
  foreach v_text in array array[
    'public.claim_queued_messages(text[], text, integer)',
    'public.settle_grow_payment(text, text, text, text, jsonb, numeric, text)',
    'public.push_recipient_in_clinic(uuid, text)'
  ] loop
    if has_function_privilege('authenticated', v_text, 'execute')
       or has_function_privilege('anon', v_text, 'execute') then
      raise exception 'FAIL 13: % is open to callers', v_text;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.enqueue_now_for_my_clinic(text)', 'execute')
     or has_function_privilege('anon', 'public.dispense_with_details(uuid, uuid, jsonb, numeric, text, text, numeric, text, text, numeric, uuid)', 'execute') then
    raise exception 'FAIL 13: a member function is open to anonymous callers';
  end if;
  raise notice 'PASS 13: the restricted functions are closed';

  raise notice 'ALL AUDIT FIX CHECKS PASSED';
end;
$test$;

rollback;
