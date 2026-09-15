-- ============================================================================
--  WhatsApp inbox — what a push becomes, and what a tap does
-- ============================================================================
--  Run in the Supabase SQL editor after 55_whatsapp_inbox_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a message pushed for the clinic's number opens a thread, joins the
--       file whose number it is, and counts as unread; pushed twice, it is one
--    2. a tap on "אגיע" confirms the patient's next appointment and a line
--       goes back; "לא אגיע" declines it; other words do nothing
--    3. a number no file carries opens a thread with no patient
--    4. the service's ticks land on the message they concern and never
--       downgrade; a failure after acceptance is a reason on the row
--    5. an automated send is written into the thread; a push for a number
--       nobody here owns is dropped
--    6. the sender takes queued rows once, and a run that died is retried
--    7. a conversation started from the file uses the file's number
-- ============================================================================

begin;

do $test$
declare
  v_clinic   uuid;
  v_user     uuid := gen_random_uuid();
  v_patient  uuid;
  v_twin_a   uuid;
  v_twin_b   uuid;
  v_appt     uuid;
  v_conv     uuid;
  v_conv2    uuid;
  v_out      uuid;
  v_result   jsonb;
  v_count    integer;
  v_status   text;
  v_response text;
  v_text     text;
  v_row      record;
begin
  -- ------------------------------------------------------------------------
  -- Fixtures
  -- ------------------------------------------------------------------------
  insert into public.clinics (name, slug, timezone, whatsapp_number)
  values ('WA Test', 'wa-test-' || gen_random_uuid(), 'Asia/Jerusalem', '972500000001')
  returning id into v_clinic;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'wa-' || v_user || '@example.test', '', now(), now(), now());
  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic, v_user, 'owner', true);

  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Dana', 'Levi', '050-123-4567') returning id into v_patient;
  -- Two files on one number: a person must choose, the push must not.
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Twin', 'One', '052-000-1111') returning id into v_twin_a;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Twin', 'Two', '+972 52 000 1111') returning id into v_twin_b;

  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at, status)
  values (v_clinic, v_patient, v_user, now() + interval '2 days', now() + interval '2 days 1 hour', 'scheduled')
  returning id into v_appt;

  -- ------------------------------------------------------------------------
  -- 1 · A message becomes a thread on the right file
  -- ------------------------------------------------------------------------
  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-1', 'from', '972501234567', 'to', '972500000001',
    'senderName', 'Dana', 'type', 'text', 'body', 'שלום, שאלה על המרשם', 'timestamp', extract(epoch from now())::bigint::text));
  if (v_result->>'ok') <> 'true' then raise exception 'FAIL: the push was refused: %', v_result; end if;
  select id, unread_count, status into v_row from public.whatsapp_conversations
   where clinic_id = v_clinic and contact_key = '972501234567';
  if v_row.id is null then raise exception 'FAIL: no conversation was opened'; end if;
  v_conv := v_row.id;
  if v_row.unread_count <> 1 then raise exception 'FAIL: unread is % after one message', v_row.unread_count; end if;
  select patient_id into v_row from public.whatsapp_conversations where id = v_conv;
  if v_row.patient_id is distinct from v_patient then raise exception 'FAIL: the thread did not join Dana''s file'; end if;
  select count(*) into v_count from public.whatsapp_messages where conversation_id = v_conv and direction = 'in' and status = 'received';
  if v_count <> 1 then raise exception 'FAIL: expected one received message, found %', v_count; end if;

  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-1', 'from', '972501234567', 'to', '972500000001',
    'type', 'text', 'body', 'שלום, שאלה על המרשם'));
  if (v_result->>'duplicate') <> 'true' then raise exception 'FAIL: the same message pushed twice was not recognised'; end if;
  select count(*) into v_count from public.whatsapp_messages where conversation_id = v_conv;
  if v_count <> 1 then raise exception 'FAIL: a retried push made a second row'; end if;
  raise notice 'ok   a push opens a thread on the file, counts unread, and is one row however often it is retried';

  -- ------------------------------------------------------------------------
  -- 2 · A tap answers the next appointment
  -- ------------------------------------------------------------------------
  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-2', 'from', '972501234567', 'to', '972500000001',
    'type', 'button', 'body', 'אגיע'));
  if (v_result->>'appointment') is distinct from 'confirmed' then raise exception 'FAIL: the tap did not confirm: %', v_result; end if;
  select status, confirmation_response into v_status, v_response from public.appointments where id = v_appt;
  if v_status <> 'confirmed' or v_response <> 'confirmed' then
    raise exception 'FAIL: after the tap the appointment is % / %', v_status, v_response;
  end if;
  select body into v_text from public.whatsapp_messages
   where conversation_id = v_conv and direction = 'out' and status = 'queued' order by created_at desc limit 1;
  if v_text is null or position('אושרה' in v_text) = 0 then raise exception 'FAIL: no acknowledgement went back: %', v_text; end if;

  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-3', 'from', '972501234567', 'to', '972500000001',
    'type', 'text', 'body', 'לא אגיע.'));
  select confirmation_response into v_response from public.appointments where id = v_appt;
  if v_response <> 'declined' then raise exception 'FAIL: "לא אגיע" did not decline (got %)', v_response; end if;

  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-4', 'from', '972501234567', 'to', '972500000001',
    'type', 'text', 'body', 'לא בטוחה אם אגיע, אעדכן מחר'));
  if (v_result->>'appointment') is not null then raise exception 'FAIL: a sentence was read as an answer'; end if;
  select confirmation_response into v_response from public.appointments where id = v_appt;
  if v_response <> 'declined' then raise exception 'FAIL: a sentence changed the answer'; end if;
  raise notice 'ok   a tap confirms or declines the next appointment and is acknowledged; a sentence is not an answer';

  -- ------------------------------------------------------------------------
  -- 3 · Unknown and ambiguous numbers
  -- ------------------------------------------------------------------------
  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-5', 'from', '972509999999', 'to', '972500000001',
    'type', 'image', 'caption', 'הפריחה', 'media', 'https://files.example.test/a.jpg'));
  select patient_id, phone into v_row from public.whatsapp_conversations where clinic_id = v_clinic and contact_key = '972509999999';
  if v_row.phone <> '972509999999' or v_row.patient_id is not null then raise exception 'FAIL: an unknown number got a patient'; end if;
  select kind, body, media_url into v_row from public.whatsapp_messages where provider_message_id = 'MSG-5';
  if v_row.kind <> 'image' or v_row.body <> 'הפריחה' or v_row.media_url is null then raise exception 'FAIL: the image message lost its shape'; end if;

  v_result := public.whatsapp_receive(jsonb_build_object(
    'status', 'OK', 'hook', 'new', 'unique', 'MSG-6', 'from', '972520001111', 'to', '972500000001', 'type', 'text', 'body', 'hi'));
  select patient_id into v_row from public.whatsapp_conversations where clinic_id = v_clinic and contact_key = '972520001111';
  if v_row.patient_id is not null then raise exception 'FAIL: a number two files share was joined to one of them'; end if;
  raise notice 'ok   an unknown number opens an unlinked thread; a shared number waits for a person';

  -- ------------------------------------------------------------------------
  -- 4 · Ticks and failures
  -- ------------------------------------------------------------------------
  insert into public.whatsapp_messages (clinic_id, conversation_id, direction, kind, body, provider_message_id, status, sent_at)
  values (v_clinic, v_conv, 'out', 'text', 'נתראה מחר', 'OUT-1', 'sent', now()) returning id into v_out;
  v_result := public.whatsapp_ack(jsonb_build_object('status', 'OK', 'hook', 'update', 'unique', 'OUT-1', 'ack', 3));
  select status, read_at into v_row from public.whatsapp_messages where id = v_out;
  if v_row.status <> 'read' or v_row.read_at is null then raise exception 'FAIL: two blue ticks did not mark the message read'; end if;
  v_result := public.whatsapp_ack(jsonb_build_object('status', 'OK', 'hook', 'update', 'unique', 'OUT-1', 'ack', 2));
  select status into v_status from public.whatsapp_messages where id = v_out;
  if v_status <> 'read' then raise exception 'FAIL: a late "delivered" downgraded a read message'; end if;
  v_result := public.whatsapp_ack(jsonb_build_object('status', 'OK', 'hook', 'update', 'unique', 'OUT-1', 'ack', 0));
  select status into v_status from public.whatsapp_messages where id = v_out;
  if v_status <> 'read' then raise exception 'FAIL: a failure report overrode a read message'; end if;

  insert into public.whatsapp_messages (clinic_id, conversation_id, direction, kind, body, provider_message_id, status, sent_at)
  values (v_clinic, v_conv, 'out', 'text', 'תזכורת', 'OUT-2', 'sent', now()) returning id into v_out;
  v_result := public.whatsapp_ack(jsonb_build_object('status', 'OK', 'hook', 'system', 'type', 'messages', 'unique', 'OUT-2', 'messageUpdate', 8));
  select status, error_code into v_row from public.whatsapp_messages where id = v_out;
  if v_row.status <> 'failed' or v_row.error_code <> 'needs_template' then raise exception 'FAIL: the system notice did not name the reason (% / %)', v_row.status, v_row.error_code; end if;
  raise notice 'ok   ticks land on their message and never downgrade; a late failure carries its reason';

  -- ------------------------------------------------------------------------
  -- 5 · Automated sends in the thread; a stranger''s number dropped
  -- ------------------------------------------------------------------------
  v_out := public.whatsapp_note_outbound(v_clinic, '050-123-4567', 'template', 'תזכורת לתור מחר', 'TPL-1', '["דנה"]'::jsonb, 'OUT-3', 'sent', null);
  select conversation_id into v_row from public.whatsapp_messages where id = v_out;
  if v_row.conversation_id <> v_conv then raise exception 'FAIL: the reminder was not written into Dana''s thread'; end if;
  if public.whatsapp_note_outbound(v_clinic, '+44 20 7946 0958', 'template', 'x', null, null, 'OUT-4', 'sent', null) is not null then
    raise exception 'FAIL: a foreign number was written as a thread';
  end if;
  v_result := public.whatsapp_receive(jsonb_build_object('status', 'OK', 'hook', 'new', 'unique', 'MSG-7', 'from', '972501234567', 'to', '972500000002', 'type', 'text', 'body', 'x'));
  if (v_result->>'reason') <> 'unknown_number' then raise exception 'FAIL: a push for a number nobody owns was accepted: %', v_result; end if;
  raise notice 'ok   an automated send shows in the thread; a push for a stranger''s line is dropped';

  -- ------------------------------------------------------------------------
  -- 6 · Claiming
  -- ------------------------------------------------------------------------
  select count(*) into v_count from public.whatsapp_claim_outbound(10);
  if v_count <> 1 then raise exception 'FAIL: expected to claim the one queued acknowledgement, claimed %', v_count; end if;
  select count(*) into v_count from public.whatsapp_claim_outbound(10);
  if v_count <> 0 then raise exception 'FAIL: a second claim took % row(s) again', v_count; end if;
  update public.whatsapp_messages set claimed_at = now() - interval '16 minutes' where status = 'sending';
  select count(*) into v_count from public.whatsapp_claim_outbound(10);
  if v_count <> 1 then raise exception 'FAIL: a run that died was not offered again'; end if;
  raise notice 'ok   a queued message is claimed once, and a dead run is retried';

  -- ------------------------------------------------------------------------
  -- 7 · From the file
  -- ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_conv2 := public.whatsapp_open_for_patient(v_patient);
  if v_conv2 <> v_conv then raise exception 'FAIL: opening from the file made a second thread for the same number'; end if;
  begin
    perform public.whatsapp_open_for_patient(v_twin_a);
    -- Twin One's number is fine; the conversation simply opens.
  exception when others then
    raise exception 'FAIL: opening a thread for a file with a number failed: %', sqlerrm;
  end;
  insert into public.patients (clinic_id, first_name, last_name) values (v_clinic, 'No', 'Phone') returning id into v_twin_b;
  begin
    perform public.whatsapp_open_for_patient(v_twin_b);
    raise exception 'FAIL: a file without a number opened a thread';
  exception
    when invalid_parameter_value then null;
  end;
  perform set_config('role', 'postgres', true);
  raise notice 'ok   a thread opens from the file, once per number, and not without a number';

  raise notice ' ';
  raise notice 'ALL WHATSAPP INBOX CHECKS PASSED';
end
$test$;

rollback;
